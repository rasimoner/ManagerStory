/* V7.9.6 season transition: when the 34th round is played the career no longer stops. A season-end pipeline
   runs as an ordered list of steps; each step is either automatic or a screen the manager confirms. The list
   is a registry (seasonEndStep) so later work can slot in by id: relegation and promotion after 'summary',
   a cup final before it, a manager contract review before 'newSeason'. A save taken mid-pipeline resumes at
   the same step (S.seasonEnd keeps the step list, the position and every step's data).

   Season 1 is untouched: seed offsets are zero while S.seasonIndex is 0, so existing careers, the 34-match
   tests and determinism stay exactly as they were. Every draw here comes from its own hashed seed, never
   from match randomness. */
import STARTING_SQUAD from '../../data/squad.json';
import BALANCE from '../../data/balance.json';
import { R } from '../random.js';
import { M, S } from '../state.js';
import { escapeHTML } from '../engine/match-support.js';
import { assignPlayerProfile, hashProfileSeed, refreshPlayerProfile } from '../players/player-profiles.js';
import { ensureOpponentSquads } from '../league/opponents-v731.js';
import { allTeams, ensureLeague, makeLeagueSchedule } from '../league/league.js';
import { managedClubName } from '../clubs/clubs.js';
import { save } from '../save.js';
import { movesNow } from '../players/moves.js';
import { pushInbox } from '../inbox.js';
import { changed, opponentsEvolved, seasonStarted } from '../hooks.js';
import { LEAGUE_LIFT, OPP, OPPONENT_FIRST, OPPONENT_LAST } from '../league/rivals.js';
import { SKILL_NAMES } from '../players/move-names.js';
export const SEASON_BASE_YEAR = BALANCE.season.baseYear;
export const SEASON_DEPARTED = 'Transfer oldu';
export const SEASON_POOL_SIZE = BALANCE.season.marketSize;
export const SEASON_MIN_SQUAD = BALANCE.season.minSquad;

export function seasonLabel(index) { const y = SEASON_BASE_YEAR + index; return `${y}/${String((y + 1) % 100).padStart(2, '0')}`; }
// added to the fixed per-week seeds (AI results, league development): 0 in the first season
export function seasonSeedOffset() { return (typeof S !== 'undefined' && S ? S.seasonIndex || 0 : 0) * 100003; }
export function seasonRnd(tag) { return R(hashProfileSeed(`${tag}|${S.seasonIndex || 0}|${S.matchSalt || 0}`)); }
export function seasonClamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
export function seasonEsc(v) { return typeof escapeHTML === 'function' ? escapeHTML(String(v)) : String(v).replace(/[<>&"]/g, ''); }
export function seasonClub() { return managedClubName(); }
export function seasonActive(p) { return p && p.status !== SEASON_DEPARTED; }

/* ---------- state and save migration ---------- */
export function ensureSeasonState() {
  if (!S) return;
  S.seasonIndex ??= 0;
  S.season ??= seasonLabel(S.seasonIndex);
  S.v796 ??= { schema: 1 };
  const st = S.v796;
  st.former ??= []; st.seasons ??= []; st.faSerial ??= 0; st.poolSerial ??= 0; st.rivalSerial ??= 0;
  st.maxPlayerId ??= -1;
  // contracts: the old field held 2/3/4 for everybody; read it as seasons left and spread it once by age
  if (!st.contractsSet) {
    for (const p of S.players) if (seasonActive(p)) p.contract = seasonInitialContract(p);
    st.contractsSet = true;
  }
  for (const p of S.players) {
    if (!Number.isFinite(p.contract)) p.contract = seasonInitialContract(p);
    p.careerGoals ??= 0; p.careerApps ??= 0;
  }
  for (const r of S.results || []) r.season ??= 0;
}
export function seasonInitialContract(p) {
  const r = R(hashProfileSeed(`contract|${p.id}|${p.name}|${S.matchSalt || 0}`))();
  if (p.status === 'Altyapıdan A takım') return 3;
  if (p.status === 'Yeni transfer') return 4;
  const [lo, hi] = p.age <= 21 ? [2, 4] : p.age <= 26 ? [1, 3] : p.age <= 30 ? [1, 2] : [1, 1];
  return lo + Math.floor(r * (hi - lo + 1));
}
// ids only ever grow, so a departed player's id (and anything keyed by it, like a highlight archive) is never reused
export function nextPlayerId() {
  return Math.max(S.v796?.maxPlayerId ?? -1, ...S.players.map(p => +p.id || 0)) + 1;
}
// the captain for event texts: the leader in the dressing room, not a fixed name
export function captainName() {
  const on = (S?.players || []).filter(p => seasonActive(p) && p.status !== 'Kirada');
  // the starting captain (data/squad.json) wears the armband from the first day; when he is gone the dressing room's
  // leader takes it and keeps it
  const kept = on.find(p => p.id === S.v796?.captainId) || on.find(p => p.id === STARTING_SQUAD.captain);
  if (kept) return kept.name;
  const lead = on.filter(p => p.personality === 'Lider').sort((a, b) => (b.relation || 0) - (a.relation || 0) || b.age - a.age)[0]
    || on.slice().sort((a, b) => b.age - a.age || b.overall - a.overall)[0];
  if (lead && S.v796) S.v796.captainId = lead.id;
  return lead?.name || 'Kaptan';
}
export function youngestTalentName() {
  const on = (S?.players || []).filter(seasonActive).sort((a, b) => a.age - b.age || b.potential - a.potential);
  return on[0]?.name || 'gençler';
}

/* ---------- match records: season tag and assists ---------- */
// an assist: the last completed pass or cross to the scorer in the same move (a rebound, a set piece or a
// penalty has none). Read from the saved match events, the engine is not touched.
export function seasonMatchAssists(match) {
  const events = match?.events || [], out = {};
  const neutral = new Set(['shot', 'chance', 'offBallRun', 'run', 'ballCarry', 'firstTouch', 'hold', 'shout', 'order', 'press']);
  events.forEach((e, i) => {
    if (e.type !== 'goal' || e.fromSide !== 'user' || e.penalty || typeof e.fromId !== 'number') return;
    for (let j = i - 1; j >= 0 && j >= i - 14; j--) {
      const x = events[j];
      if (neutral.has(x.type)) continue;
      if ((x.type === 'pass' || x.type === 'cross') && x.success !== false && x.toId === e.fromId && x.fromSide === 'user'
          && typeof x.fromId === 'number' && x.fromId !== e.fromId) out[x.fromId] = (out[x.fromId] || 0) + 1;
      break;
    }
  });
  return out;
}
export function seasonRecordMatch(match, result) {
  if (!result) return;
  result.season = S.seasonIndex || 0;
  const assists = seasonMatchAssists(match);
  result.assists = assists;
  for (const [id, n] of Object.entries(assists)) {
    const p = S.players.find(q => q.id === +id); if (p) p.assists = (p.assists || 0) + n;
    const row = result.matchSummary?.players?.find(q => q.id === +id); if (row) row.assists = (row.assists || 0) + n;
  }
}

/* ---------- ageing, retirement and development rules ---------- */
// the off-season step on top of the weekly development (evolveV6 / evolveOpponentSquads stay the only
// in-season growth): the young close in on their potential, 30+ slows down, keepers decline about three years later
// (the ages, chances and steps are in data/balance.json: development, retirement)
export function offseasonChange(age, overall, potential, gk, rnd) {
  const D = BALANCE.development, kind = gk ? 'keeper' : 'outfield';
  const gap = potential - overall, peakEnd = D.peakEnd[kind], declineAt = D.declineAt[kind];
  if (age <= D.youngUntil) return gap > 0 ? Math.min(gap, D.youngGain[0] + Math.floor(rnd() * D.youngGain[1])) : 0;
  if (age <= D.growingUntil) return gap > 0 ? Math.min(gap, D.growingGain[0] + Math.floor(rnd() * D.growingGain[1])) : 0;
  if (age <= peakEnd) return gap > 0 && rnd() < D.peakGainChance ? 1 : 0;
  if (age < declineAt) return rnd() < D.plateauDropChance ? -1 : 0;
  return -Math.min(D.maxDecline, D.decline[0] + Math.floor(rnd() * D.decline[1]) + Math.floor((age - declineAt) / D.declineStepYears));
}
export function agedPotential(age, overall, potential, gk) {
  const D = BALANCE.development, kind = gk ? 'keeper' : 'outfield';
  const late = D.potentialLate[kind], declineAt = D.declineAt[kind];
  let pot = potential;
  if (age >= declineAt) pot = overall;
  else if (age >= late) pot = Math.max(overall, potential - 1);
  return Math.max(overall, pot);
}
export function retireChance(age, overall, gk) {
  const T = BALANCE.retirement, eff = age - (gk ? T.keeperYearsYounger : 0);
  const base = eff < T.fromAge ? 0 : eff >= T.certainAt ? 1 : T.chanceByAge[eff];
  if (base >= 1) return 1;
  return Math.min(1, base * (overall >= T.starOverall ? T.starFactor : overall < T.weakBelow ? T.weakFactor : 1));
}
export function isGK(pos) { return String(pos || '').split('/')[0] === 'GK'; }
export function seasonDevelop(p, pos, rnd, minOverall = 40) {
  p.age++;
  const gk = isGK(pos), before = p.overall;
  p.overall = seasonClamp(p.overall + offseasonChange(p.age, p.overall, p.potential, gk, rnd), minOverall, 99);
  p.potential = agedPotential(p.age, p.overall, p.potential, gk);
  return p.overall - before;
}

/* ---------- leaving the club ---------- */
export function departPlayer(p, reason) {
  const st = S.v796;
  st.maxPlayerId = Math.max(st.maxPlayerId ?? -1, +p.id || 0);
  st.former.push({ id: p.id, name: p.name, pos: p.pos, age: p.age, overall: p.overall, reason, season: S.season,
    goals: (p.careerGoals || 0) + (p.goals || 0) });
  st.former = st.former.slice(-80);
  S.players = S.players.filter(q => q !== p);
  S.xi = (S.xi || []).filter(id => id !== p.id);
  if (Array.isArray(S.bench)) S.bench = S.bench.filter(id => id !== p.id);
  if (S.positions) delete S.positions[p.id];
  if (S.instructions) delete S.instructions[p.id];
  S.promises = (S.promises || []).filter(x => x.player !== p.id);
  if (S.v71?.playerMeetings) delete S.v71.playerMeetings[p.id];
  for (const k of S.v795?.wonderkids || []) if (k.where === 'squad' && k.playerId === p.id) k.where = reason === 'retired' ? 'retired' : 'left';
}

/* ---------- the pipeline ---------- */
export const SEASON_END_STEPS = [];
export function seasonEndStep(step, where = {}) {
  let i = SEASON_END_STEPS.length;
  if (where.after) { const k = SEASON_END_STEPS.findIndex(s => s.id === where.after); if (k >= 0) i = k + 1; }
  else if (where.before) { const k = SEASON_END_STEPS.findIndex(s => s.id === where.before); if (k >= 0) i = k; }
  SEASON_END_STEPS.splice(i, 0, step);
}
export function seasonStepById(id) { return SEASON_END_STEPS.find(s => s.id === id) || null; }
export function seasonComplete() {
  if (!S?.leagueSchedule || S.leagueSchedule.length !== 34) return false;
  return S.leagueSchedule.every(round => round.every(g => g.played));
}
// called first thing in nextEvent: true while the season-end screens own the career
export function seasonEndCheck() {
  if (!S || (typeof M !== 'undefined' && M)) return false;
  if (S.seasonEnd) { runSeasonEnd(); return !!S.seasonEnd; }
  if (!seasonComplete()) return false;
  beginSeasonEnd();
  return !!S.seasonEnd;
}
export function beginSeasonEnd() {
  S.seasonEnd = { season: S.season, index: S.seasonIndex || 0, steps: SEASON_END_STEPS.map(s => s.id), at: 0, done: {}, prepared: {}, data: { log: {} } };
  S.event = { kind: 'seasonEnd', title: 'Sezon Sonu', speaker: 'Yönetim', text: `${S.season} sezonu tamamlandı.`, choices: [] };
  runSeasonEnd();
}
export function runSeasonEnd() {
  const se = S.seasonEnd; if (!se) return;
  while (S.seasonEnd === se && se.at < se.steps.length) {
    const step = seasonStepById(se.steps[se.at]);
    if (!step || se.done[step.id]) { se.at++; continue; }
    if (step.prepare && !se.prepared[step.id]) { step.prepare(se); se.prepared[step.id] = true; }
    if (step.skip?.(se)) { se.done[step.id] = true; se.at++; continue; }
    if (step.screen) return;
    step.run(se); se.done[step.id] = true; se.at++;
  }
  if (S.seasonEnd === se && se.at >= se.steps.length) delete S.seasonEnd;
}
export function seasonEndNext(id) {
  const se = S.seasonEnd; if (!se || se.steps[se.at] !== id) return;
  const step = seasonStepById(id);
  if (step?.canContinue && !step.canContinue(se)) { alert(step.blockedText || 'Devam etmeden önce kararlarını tamamla.'); return; }
  step?.finish?.(se);
  se.done[id] = true; se.at++;
  runSeasonEnd();
  save();
  window.scrollTo?.(0, 0);
  changed();
}

/* step 1 — season summary (screen) */
export function seasonTableSorted() { return [...S.table].sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf); }
export function seasonPlayerStats(index) {
  const stats = new Map();
  for (const r of (S.results || []).filter(r => (r.season ?? 0) === index)) {
    for (const row of r.matchSummary?.players || []) {
      if (!(row.minutes > 0)) continue;
      const s = stats.get(row.id) || { id: row.id, name: row.name, apps: 0, goals: 0, assists: 0, ratingSum: 0 };
      s.apps++; s.goals += row.goals || 0; s.assists += row.assists || 0; s.ratingSum += Number(row.rating) || 6.5;
      stats.set(row.id, s);
    }
  }
  for (const s of stats.values()) { s.name = S.players.find(p => p.id === s.id)?.name || s.name; s.rating = s.ratingSum / s.apps; }
  return [...stats.values()];
}
seasonEndStep({ id: 'summary', screen: true, // drawn by the mode (modes/manager/season-end.js)
  prepare(se) {
    const table = seasonTableSorted(), club = seasonClub(), rank = table.findIndex(x => x.n === club) + 1, me = table[rank - 1] || {};
    const all = seasonPlayerStats(se.index), minApps = Math.min(5, Math.max(1, ...all.map(s => s.apps), 1));
    const top = (key, list = all) => list.filter(s => s[key] > 0).sort((a, b) => b[key] - a[key] || b.apps - a.apps).slice(0, 3)
      .map(s => ({ name: s.name, value: key === 'rating' ? +s.rating.toFixed(2) : s[key], apps: s.apps }));
    const youthMinutes = S.players.filter(p => seasonActive(p) && p.age <= 21).reduce((n, p) => n + (p.minutes || 0), 0);
    const objectives = (S.objectives || []).map(o => ({ text: o.text,
      met: o.type === 'league' ? rank > 0 && rank <= o.target : o.type === 'youth' ? youthMinutes >= o.target : null,
      detail: o.type === 'league' ? `${rank}. sıra` : o.type === 'youth' ? `${youthMinutes} dk` : '' }));
    const prize = Math.round((2 + (18 - Math.max(1, rank)) * 10 / 17) * 10) * 1e5;
    se.data.summary = { season: se.season, table: table.map(x => ({ ...x })), champion: table[0]?.n, rank, pts: me.pts || 0, gf: me.gf || 0, ga: me.ga || 0,
      goals: top('goals'), assists: top('assists'), rating: top('rating', all.filter(s => s.apps >= minApps)), objectives, prize };
    S.v796.seasons.push({ season: se.season, rank, pts: me.pts || 0, champion: table[0]?.n,
      topScorer: se.data.summary.goals[0] || null, topRated: se.data.summary.rating[0] || null });
    S.history.push(`🏆 ${se.season} şampiyonu ${table[0]?.n}. ${club} sezonu ${rank}. sırada ${me.pts || 0} puanla bitirdi.`);
  } });

/* steps 2–4 — automatic: ageing and off-season development, retirements, loans back */
seasonEndStep({ id: 'aging', run(se) {
  const log = se.data.log.aging = [];
  for (const p of S.players.filter(seasonActive)) {
    const before = typeof movesNow === 'function' ? movesNow(p) : [], ov = p.overall;
    const d = seasonDevelop(p, p.pos, seasonRnd(`age|${p.id}`));
    p.growth = 0;
    if (d) refreshPlayerProfile(p);
    const learned = (typeof movesNow === 'function' ? movesNow(p) : []).filter(m => !before.includes(m));
    if (learned.length) {
      p.newMoves = [...new Set([...(p.newMoves || []), ...learned])];
      S.history.push(`${p.name} yeni hareket açtı: ${learned.map(m => SKILL_NAMES[m] || m).join(', ')}.`);
    }
    log.push({ id: p.id, name: p.name, pos: p.pos, age: p.age, from: ov, to: p.overall, learned });
  }
} });
seasonEndStep({ id: 'retire', run(se) {
  const out = se.data.log.retired = [];
  for (const p of S.players.filter(seasonActive)) {
    if (seasonRnd(`retire|${p.id}`)() < retireChance(p.age, p.overall, isGK(p.pos))) {
      out.push({ name: p.name, age: p.age, pos: p.pos, overall: p.overall });
      S.history.push(`${p.name}, ${p.age} yaşında futbolu bıraktı.`);
      departPlayer(p, 'retired');
    }
  }
  if (out.length) pushInbox('Sportif Direktör', out.length > 1 ? 'Emeklilikler' : `${out[0].name} futbolu bıraktı`,
    `${out.map(x => `${x.name} (${x.age}, ${x.pos})`).join(', ')} kariyerini noktaladı. Kulüp adına teşekkür ettik; yerlerini doldurmayı planlamalıyız.`, 'board');
} });
seasonEndStep({ id: 'loans', run(se) {
  const back = se.data.log.loans = [];
  for (const p of S.players.filter(p => p.status === 'Kirada')) { p.status = 'Takımın parçası'; back.push(p.name); }
  if (back.length) pushInbox('Sportif Direktör', 'Kiralıktan dönenler', `${back.join(', ')} kiralık dönemini tamamlayıp takıma döndü.`, 'board');
} });

/* steps 7–10 — automatic: academy (the manager's), league squads, transfer market (the manager's), tidy-up
   (the manager's): the manager's steps are in modes/manager/season-end.js, slotted in by id */
seasonEndStep({ id: 'rivals', run(se) { se.data.log.rivals = seasonRefreshRivals(); } });

/* step 11 — the new season */
seasonEndStep({ id: 'newSeason', run(se) {
  const offset = S.week, summary = se.data.summary || {};
  S.seasonIndex = (S.seasonIndex || 0) + 1;
  S.season = seasonLabel(S.seasonIndex);
  S.week = 1; S.day = 1; S.fixture = 0;
  S.leagueSchedule = seasonSchedule();
  S.schedule = S.leagueSchedule.map(g => { const x = g.find(m => m.home === managedClubName() || m.away === managedClubName());
    return { opp: OPP.findIndex(o => o[0] === (x.home === managedClubName() ? x.away : x.home)), home: x.home === managedClubName() }; });
  S.table = allTeams().map(n => ({ n, p: 0, gf: 0, ga: 0, pts: 0 }));
  S.form = {}; ensureLeague();
  if (S.v731) S.v731.lastEvolvedFixture = -1;
  // everything stamped with a week number moves back by one season, so cooldowns and promises keep their meaning
  const shift = v => Number.isFinite(v) ? v - offset : v;
  for (const k of Object.keys(S.cooldowns || {})) S.cooldowns[k] = shift(S.cooldowns[k]);
  for (const pr of S.promises || []) pr.due = shift(pr.due);
  if (S.v71) {
    S.v71.lastTacticWeek = shift(S.v71.lastTacticWeek);
    for (const map of [S.v71.playerMeetings, S.v71.categoryMeetings]) if (map) for (const k of Object.keys(map)) map[k] = shift(map[k]);
  }
  if (S.v6) { S.v6.boardBudgetAskedWeek = shift(S.v6.boardBudgetAskedWeek); S.v6.academyCounter = 0; S.v6.cup = { alive: true, round: '1. Tur', wins: 0 }; }
  S.sundayEvents = {};
  for (const p of S.players) {
    p.careerGoals = (p.careerGoals || 0) + (p.goals || 0);
    p.careerApps = (p.careerApps || 0) + Math.round((p.minutes || 0) / 90);
    p.goals = 0; p.assists = 0; p.yellow = 0; p.red = 0; p.minutes = 0;
    p.fitness = 100; p.injury = 0; p.form = 70;
    p.morale = Math.round(p.morale + (72 - p.morale) * .5);
  }
  seasonStarted(summary); // what the new season means for the mode (the manager: budget, chairman, board, clock)
  S.history.push(`${S.season} sezonu başladı.`);
  delete S.seasonEnd;
} });

/* ---------- helpers for the automatic steps ---------- */
// a new fixture order each season: the same round-robin, with the clubs drawn into different places
export function seasonSchedule() {
  const teams = allTeams(), rnd = seasonRnd('schedule'), order = [...teams];
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const map = Object.fromEntries(teams.map((t, i) => [t, order[i]]));
  return makeLeagueSchedule().map(round => round.map(g => ({ ...g, home: map[g.home], away: map[g.away] })));
}
export function seasonStarterAvg(squad) { const xi = squad.slice(0, 11); return xi.reduce((n, p) => n + p.overall, 0) / Math.max(1, xi.length); }
export function seasonMakeRival(teamIndex, slot, position, overall, age, rnd, ceiling = 94) {
  const st = S.v796, n = st.rivalSerial++;
  overall = seasonClamp(Math.round(overall), 50, 92);
  const potential = Math.min(ceiling, 94, overall + (age <= 21 ? 6 + Math.floor(rnd() * 12) : age <= 24 ? 2 + Math.floor(rnd() * 6) : Math.floor(rnd() * 3)));
  const p = { id: `opp-${teamIndex}-s${(S.seasonIndex || 0) + 1}-${slot}-${n}`,
    name: `${OPPONENT_FIRST[Math.floor(rnd() * OPPONENT_FIRST.length)]} ${OPPONENT_LAST[Math.floor(rnd() * OPPONENT_LAST.length)]}`,
    age, position, overall, potential: Math.round(potential), fitness: 95 + Math.floor(rnd() * 6), form: 68 };
  p.potential = Math.max(p.overall, p.potential);
  assignPlayerProfile(p, { seed: hashProfileSeed(`rival|${p.id}|${S.matchSalt || 0}`) });
  return p;
}
// league squads age, retire and renew; each club is pulled back toward its own level (base + LEAGUE_LIFT)
// so the league keeps its shape over many seasons. A club's wonderkid is never replaced or sold.
export function seasonRefreshRivals() {
  const stats = { retired: 0, signings: 0, sales: 0, clubs: {} };
  ensureOpponentSquads();
  OPP.forEach((team, ti) => {
    const squad = S.opponentSquads[team[0]]; if (!Array.isArray(squad)) return;
    const target = team[1] + LEAGUE_LIFT, rnd = seasonRnd(`rivals|${ti}`);
    for (const p of squad) {
      const d = seasonDevelop(p, p.position, rnd, 45);
      p.fitness = 95 + Math.floor(rnd() * 6); p.form = 68;
      if (d || p.profile) refreshPlayerProfile(p);
    }
    squad.forEach((p, i) => {
      if (p.profile?.special) return;
      if (rnd() < retireChance(p.age, p.overall, p.position === 'GK')) {
        const gapFix = (target - seasonStarterAvg(squad)) * 1.2;
        const ov = i < 11 ? target - 6 + gapFix + (rnd() - .5) * 4 : target - 9 + (rnd() - .5) * 4;
        squad[i] = seasonMakeRival(ti, i, p.position, seasonClamp(ov, 52, target + 4), 17 + Math.floor(rnd() * 4), rnd, target + 3 + Math.floor(rnd() * 4));
        stats.retired++;
      }
    });
    for (let k = 0; k < 3; k++) {
      const avg = seasonStarterAvg(squad);
      const starters = squad.slice(0, 11).map((p, i) => ({ p, i })).filter(x => !x.p.profile?.special);
      if (avg < target - 1.5) {
        const w = starters.filter(x => x.p.position !== 'GK').sort((a, b) => a.p.overall - b.p.overall)[0]; if (!w) break;
        squad[w.i] = seasonMakeRival(ti, w.i, w.p.position, target + 1 + rnd() * 3, 24 + Math.floor(rnd() * 6), rnd, target + 4); stats.signings++;
      } else if (avg > target + 1.5) {
        // the club's best man is sold abroad (the usual way a club that outgrew its level comes back to it)
        const s = starters.sort((a, b) => b.p.overall - a.p.overall)[0]; if (!s) break;
        squad[s.i] = seasonMakeRival(ti, s.i, s.p.position, target - 4 + rnd() * 2, 19 + Math.floor(rnd() * 5), rnd, target + 3); stats.sales++;
      } else break;
    }
    stats.clubs[team[0]] = +seasonStarterAvg(squad).toFixed(1);
  });
  opponentsEvolved();
  return stats;
}
