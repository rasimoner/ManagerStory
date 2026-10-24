/* V7.9.6 season transition: when the 34th round is played the career no longer stops. A season-end pipeline
   runs as an ordered list of steps; each step is either automatic or a screen the manager confirms. The list
   is a registry (seasonEndStep) so later work can slot in by id: relegation and promotion after 'summary',
   a cup final before it, a manager contract review before 'newSeason'. A save taken mid-pipeline resumes at
   the same step (S.seasonEnd keeps the step list, the position and every step's data).

   Season 1 is untouched: seed offsets are zero while S.seasonIndex is 0, so existing careers, the 34-match
   tests and determinism stay exactly as they were. Every draw here comes from its own hashed seed, never
   from match randomness. */
const SEASON_BASE_YEAR = 2025;
const SEASON_DEPARTED = 'Transfer oldu';
const SEASON_POOL_SIZE = 110;
const SEASON_MIN_SQUAD = 16;

function seasonLabel(index) { const y = SEASON_BASE_YEAR + index; return `${y}/${String((y + 1) % 100).padStart(2, '0')}`; }
// added to the fixed per-week seeds (AI results, league development): 0 in the first season
function seasonSeedOffset() { return (typeof S !== 'undefined' && S ? S.seasonIndex || 0 : 0) * 100003; }
function seasonRnd(tag) { return R(hashProfileSeed(`${tag}|${S.seasonIndex || 0}|${S.matchSalt || 0}`)); }
function seasonClamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function seasonEsc(v) { return typeof escapeHTML === 'function' ? escapeHTML(String(v)) : String(v).replace(/[<>&"]/g, ''); }
function seasonClub() { return typeof managedClubName === 'function' ? managedClubName() : 'Anadolu Hisarı'; }
function seasonActive(p) { return p && p.status !== SEASON_DEPARTED; }

/* ---------- state and save migration ---------- */
function ensureSeasonState() {
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
function seasonInitialContract(p) {
  const r = R(hashProfileSeed(`contract|${p.id}|${p.name}|${S.matchSalt || 0}`))();
  if (p.status === 'Altyapıdan A takım') return 3;
  if (p.status === 'Yeni transfer') return 4;
  const [lo, hi] = p.age <= 21 ? [2, 4] : p.age <= 26 ? [1, 3] : p.age <= 30 ? [1, 2] : [1, 1];
  return lo + Math.floor(r * (hi - lo + 1));
}
// ids only ever grow, so a departed player's id (and anything keyed by it, like a highlight archive) is never reused
function nextPlayerId() {
  return Math.max(S.v796?.maxPlayerId ?? -1, ...S.players.map(p => +p.id || 0)) + 1;
}
// the captain for event texts: the leader in the dressing room, not a fixed name
function captainName() {
  const on = (S?.players || []).filter(p => seasonActive(p) && p.status !== 'Kirada');
  // Burak wears the armband from the first day; when he is gone the dressing room's leader takes it and keeps it
  const kept = on.find(p => p.id === S.v796?.captainId) || on.find(p => p.id === 6 && p.name === 'Burak');
  if (kept) return kept.name;
  const lead = on.filter(p => p.personality === 'Lider').sort((a, b) => (b.relation || 0) - (a.relation || 0) || b.age - a.age)[0]
    || on.slice().sort((a, b) => b.age - a.age || b.overall - a.overall)[0];
  if (lead && S.v796) S.v796.captainId = lead.id;
  return lead?.name || 'Kaptan';
}
function youngestTalentName() {
  const on = (S?.players || []).filter(seasonActive).sort((a, b) => a.age - b.age || b.potential - a.potential);
  return on[0]?.name || 'gençler';
}

/* ---------- match records: season tag and assists ---------- */
// an assist: the last completed pass or cross to the scorer in the same move (a rebound, a set piece or a
// penalty has none). Read from the saved match events, the engine is not touched.
function seasonMatchAssists(match) {
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
function seasonRecordMatch(match, result) {
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
function offseasonChange(age, overall, potential, gk, rnd) {
  const gap = potential - overall, peakEnd = gk ? 32 : 29, declineAt = gk ? 34 : 31;
  if (age <= 21) return gap > 0 ? Math.min(gap, 1 + Math.floor(rnd() * 3)) : 0;
  if (age <= 24) return gap > 0 ? Math.min(gap, Math.floor(rnd() * 3)) : 0;
  if (age <= peakEnd) return gap > 0 && rnd() < .35 ? 1 : 0;
  if (age < declineAt) return rnd() < .4 ? -1 : 0;
  return -Math.min(5, 1 + Math.floor(rnd() * 2) + Math.floor((age - declineAt) / 2));
}
function agedPotential(age, overall, potential, gk) {
  const late = gk ? 31 : 28, declineAt = gk ? 34 : 31;
  let pot = potential;
  if (age >= declineAt) pot = overall;
  else if (age >= late) pot = Math.max(overall, potential - 1);
  return Math.max(overall, pot);
}
function retireChance(age, overall, gk) {
  const eff = age - (gk ? 2 : 0);
  const base = eff <= 32 ? 0 : eff === 33 ? .08 : eff === 34 ? .2 : eff === 35 ? .4 : eff === 36 ? .6 : eff === 37 ? .8 : 1;
  if (base >= 1) return 1;
  return Math.min(1, base * (overall >= 78 ? .6 : overall < 65 ? 1.4 : 1));
}
function isGK(pos) { return String(pos || '').split('/')[0] === 'GK'; }
function seasonDevelop(p, pos, rnd, minOverall = 40) {
  p.age++;
  const gk = isGK(pos), before = p.overall;
  p.overall = seasonClamp(p.overall + offseasonChange(p.age, p.overall, p.potential, gk, rnd), minOverall, 99);
  p.potential = agedPotential(p.age, p.overall, p.potential, gk);
  return p.overall - before;
}

/* ---------- leaving the club ---------- */
function departPlayer(p, reason) {
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
function seasonFreeAgent(p) {
  const st = S.v796, r = seasonRnd(`fa|${p.id}`);
  const fee = Math.round(Math.max(1, p.overall - 50) ** 2 * 21000 * (.75 + r() * .6) * .15);
  const x = { id: `v6fa${st.faSerial++}`, name: p.name, pos: p.pos, age: p.age, overall: p.overall, potential: p.potential,
    club: 'Serbest', price: Math.max(100000, Math.round(fee / 1e5) * 1e5), happiness: 72, free: true, faSeason: S.seasonIndex || 0,
    star: p.overall >= 75 && p.potential >= 84, profile: structuredClone(p.profile) };
  if (x.profile) refreshPlayerProfile(x); else marketProfile(x);
  S.v6.transferPool.unshift(x);
  return x;
}
function seasonWageDemand(p) {
  const base = (p.overall * p.overall) * 900;
  const happy = (p.happiness ?? 70) < 55 ? 1.2 : 1.1;
  return Math.round(Math.max(p.wage || 0, base) * (p.age >= 32 ? .85 : happy) / 1e4) * 1e4;
}
function seasonMaxYears(p) { return p.age >= 33 ? 1 : p.age >= 31 ? 2 : 3; }

/* ---------- the pipeline ---------- */
const SEASON_END_STEPS = [];
function seasonEndStep(step, where = {}) {
  let i = SEASON_END_STEPS.length;
  if (where.after) { const k = SEASON_END_STEPS.findIndex(s => s.id === where.after); if (k >= 0) i = k + 1; }
  else if (where.before) { const k = SEASON_END_STEPS.findIndex(s => s.id === where.before); if (k >= 0) i = k; }
  SEASON_END_STEPS.splice(i, 0, step);
}
function seasonStepById(id) { return SEASON_END_STEPS.find(s => s.id === id) || null; }
function seasonComplete() {
  if (!S?.leagueSchedule || S.leagueSchedule.length !== 34) return false;
  return S.leagueSchedule.every(round => round.every(g => g.played));
}
// called first thing in nextEvent: true while the season-end screens own the career
function seasonEndCheck() {
  if (!S || (typeof M !== 'undefined' && M)) return false;
  if (S.seasonEnd) { runSeasonEnd(); return !!S.seasonEnd; }
  if (!seasonComplete()) return false;
  beginSeasonEnd();
  return !!S.seasonEnd;
}
function beginSeasonEnd() {
  S.seasonEnd = { season: S.season, index: S.seasonIndex || 0, steps: SEASON_END_STEPS.map(s => s.id), at: 0, done: {}, prepared: {}, data: { log: {} } };
  S.event = { kind: 'seasonEnd', title: 'Sezon Sonu', speaker: 'Yönetim', text: `${S.season} sezonu tamamlandı.`, choices: [] };
  runSeasonEnd();
}
function runSeasonEnd() {
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
function seasonEndNext(id) {
  const se = S.seasonEnd; if (!se || se.steps[se.at] !== id) return;
  const step = seasonStepById(id);
  if (step?.canContinue && !step.canContinue(se)) { alert(step.blockedText || 'Devam etmeden önce kararlarını tamamla.'); return; }
  step?.finish?.(se);
  se.done[id] = true; se.at++;
  runSeasonEnd();
  save();
  window.scrollTo?.(0, 0);
  render();
}

/* step 1 — season summary (screen) */
function seasonTableSorted() { return [...S.table].sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf); }
function seasonPlayerStats(index) {
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
seasonEndStep({ id: 'summary', screen: seasonSummaryUI,
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

/* step 5 — what the summer did (screen) */
seasonEndStep({ id: 'report', screen: seasonReportUI });

/* step 6 — expiring contracts (screen; skipped when none expire) */
seasonEndStep({ id: 'contracts', screen: seasonContractsUI,
  prepare(se) {
    for (const p of S.players.filter(seasonActive)) p.contract = Math.max(0, (Number.isFinite(p.contract) ? p.contract : 1) - 1);
    se.data.expiring = S.players.filter(p => seasonActive(p) && p.contract <= 0)
      .sort((a, b) => b.overall - a.overall)
      .map(p => ({ id: p.id, demand: seasonWageDemand(p), maxYears: seasonMaxYears(p) }));
    se.data.decisions = {};
  },
  skip: se => !se.data.expiring.length,
  canContinue: se => se.data.expiring.every(x => se.data.decisions[x.id] != null || !S.players.some(p => p.id === x.id)),
  blockedText: 'Sözleşmesi biten her oyuncu için yenile ya da bırak seç.',
  finish(se) {
    const kept = [], gone = [];
    for (const x of se.data.expiring) {
      const p = S.players.find(q => q.id === x.id); if (!p) continue;
      const years = se.data.decisions[x.id];
      if (years > 0) { p.contract = years; p.wage = x.demand; p.happiness = Math.min(100, (p.happiness ?? 70) + 4); kept.push(p.name); }
      else { seasonFreeAgent(p); gone.push(p.name); S.history.push(`${p.name} ile yollar ayrıldı; serbest oyuncu oldu.`); departPlayer(p, 'released'); }
    }
    se.data.log.contracts = { kept, gone };
    if (kept.length || gone.length) pushInbox('Sportif Direktör', 'Sözleşme kararları',
      `${kept.length ? `Yenilenen: ${kept.join(', ')}.` : ''}${gone.length ? ` Ayrılan: ${gone.join(', ')} (serbest oyuncu havuzunda).` : ''}`.trim(), 'board');
  } });
function seasonContractPick(id, years) {
  const se = S.seasonEnd; if (!se?.data?.decisions) return;
  se.data.decisions[id] = years;
  save();
  const y = window.scrollY || 0; render(); window.scrollTo?.(0, y);
}
function seasonContractAll(years) {
  const se = S.seasonEnd; if (!se?.data?.expiring) return;
  for (const x of se.data.expiring) se.data.decisions[x.id] = years > 0 ? Math.min(years, x.maxYears) : 0;
  save(); render();
}

/* steps 7–10 — automatic: academy, league squads, transfer market, tidy-up */
seasonEndStep({ id: 'academy', run(se) {
  const unlocked = [];
  for (const p of S.players.filter(p => seasonActive(p) && p.academyLocked)) { p.academyLocked = false; unlocked.push(p.name); }
  for (const a of S.v6.academy || []) if (a.pinned) a.age++;
  refreshAcademy(false);
  se.data.log.academy = { unlocked, intake: (S.v6.academy || []).filter(a => !a.pinned).length };
} });
seasonEndStep({ id: 'rivals', run(se) { se.data.log.rivals = seasonRefreshRivals(); } });
seasonEndStep({ id: 'market', run(se) { se.data.log.market = seasonRefreshMarket(); } });
seasonEndStep({ id: 'cleanup', run(se) {
  for (const p of S.players.filter(p => p.status === SEASON_DEPARTED)) departPlayer(p, 'sold');
  seasonTopUpSquad(se);
  seasonFillXI();
  // replay chains are kept for the season that just ended only; older seasons keep score and player stats
  for (const r of S.results || []) if ((r.season ?? 0) < (S.seasonIndex || 0) && r.matchSummary?.events) { delete r.matchSummary.events; r.matchSummary.compact = true; }
  if (S.history.length > 300) S.history = S.history.slice(-300);
} });

/* step 11 — the new season */
seasonEndStep({ id: 'newSeason', run(se) {
  const offset = S.week, summary = se.data.summary || {};
  S.seasonIndex = (S.seasonIndex || 0) + 1;
  S.season = seasonLabel(S.seasonIndex);
  S.week = 1; S.day = 1; S.fixture = 0;
  S.leagueSchedule = seasonSchedule();
  S.schedule = S.leagueSchedule.map(g => { const x = g.find(m => m.home === 'Anadolu Hisarı' || m.away === 'Anadolu Hisarı');
    return { opp: OPP.findIndex(o => o[0] === (x.home === 'Anadolu Hisarı' ? x.away : x.home)), home: x.home === 'Anadolu Hisarı' }; });
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
  S.budget += summary.prize || 0;
  pushInbox('Başkan', `${S.season} sezonu başlıyor`, `Geçen sezonu ${summary.rank || '-'}. sırada bitirdik. Lig ödülü ${money(summary.prize || 0)} transfer bütçesine eklendi. Transfer dönemi ilk 6 hafta açık.`, 'board');
  S.history.push(`${S.season} sezonu başladı.`);
  S.event = { kind: 'board', title: `${S.season} Sezonu Başlıyor`, speaker: 'Yönetim Başkanı',
    text: `Yeni sezon başlıyor. Geçen sezon ${summary.rank || '-'}. olduk; bu yıl senden ne bekleyeceğimizi söyle.`,
    choices: [['Hedefimiz üst sıralar.', 'ambitious'], ['Adım adım ilerleyeceğiz.', 'calm'], ['Gençlere güveneceğim.', 'youth']] };
  setClock('09:00');
  delete S.seasonEnd;
} });

/* ---------- helpers for the automatic steps ---------- */
// a new fixture order each season: the same round-robin, with the clubs drawn into different places
function seasonSchedule() {
  const teams = allTeams(), rnd = seasonRnd('schedule'), order = [...teams];
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const map = Object.fromEntries(teams.map((t, i) => [t, order[i]]));
  return makeLeagueSchedule().map(round => round.map(g => ({ ...g, home: map[g.home], away: map[g.away] })));
}
function seasonStarterAvg(squad) { const xi = squad.slice(0, 11); return xi.reduce((n, p) => n + p.overall, 0) / Math.max(1, xi.length); }
function seasonMakeRival(teamIndex, slot, position, overall, age, rnd, ceiling = 94) {
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
function seasonRefreshRivals() {
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
  if (typeof syncWonderOffers === 'function') syncWonderOffers();
  return stats;
}
function seasonMarketPlayer(rnd) {
  const st = S.v796, n = st.poolSerial++, clubs = Object.keys(CLUBSTYLE).filter(x => x !== 'Anadolu Hisarı');
  const pos = V6POS[Math.floor(rnd() * V6POS.length)], age = 18 + Math.floor(rnd() * 15), ov = 57 + Math.floor(rnd() * 21);
  const pot = Math.min(93, Math.max(ov, ov + Math.floor(rnd() * 15) - (age >= 29 ? 8 : 0)));
  const x = { id: `v6n${n}`, name: `${V6FN[Math.floor(rnd() * V6FN.length)]} ${V6LN[Math.floor(rnd() * V6LN.length)]}`, pos, age, overall: ov, potential: pot,
    club: clubs[Math.floor(rnd() * clubs.length)], price: seasonMarketPrice(ov, age, pot, rnd), happiness: 40 + Math.floor(rnd() * 61), star: ov >= 75 && pot >= 84 };
  marketProfile(x);
  return x;
}
function seasonMarketPrice(ov, age, pot, rnd) {
  return Math.round(Math.max(1, ov - 50) ** 2 * 21000 * (.75 + rnd() * .6) * (age <= 21 && pot - ov >= 10 ? 1.3 : 1) * (age >= 31 ? .7 : 1));
}
// the market ages with everyone else: players develop, old ones retire, last summer's unsigned free agents
// move on, and new names fill it back to its usual size
function seasonRefreshMarket() {
  const pool = S.v6.transferPool, rnd = seasonRnd('market'), stats = { retired: 0, added: 0, freeAgents: 0 };
  const keep = [];
  for (const x of pool) {
    if (x.wonder && x.squadRef) { keep.push(x); continue; }
    if (x.free && x.faSeason < (S.seasonIndex || 0)) { stats.retired++; continue; }
    if (!(x.free && x.faSeason === (S.seasonIndex || 0))) {
      if (rnd() < retireChance(x.age + 1, x.overall, isGK(x.pos))) { stats.retired++; continue; }
      const d = seasonDevelop(x, x.pos, rnd, 45);
      x.price = x.free ? x.price : seasonMarketPrice(x.overall, x.age, x.potential, rnd);
      x.star = x.overall >= 75 && x.potential >= 84;
      if (x.profile && d) refreshPlayerProfile(x);
    } else stats.freeAgents++;
    keep.push(x);
  }
  while (keep.length < SEASON_POOL_SIZE) { keep.push(seasonMarketPlayer(rnd)); stats.added++; }
  S.v6.transferPool = keep;
  return stats;
}
// a squad never starts a season unplayable: below SEASON_MIN_SQUAD the best academy prospects step up
function seasonTopUpSquad(se) {
  const promoted = [];
  while (S.players.filter(p => seasonActive(p) && p.status !== 'Kirada').length < SEASON_MIN_SQUAD && (S.v6.academy || []).length) {
    const a = S.v6.academy.slice().sort((x, y) => y.overall - x.overall || y.potential - x.potential)[0];
    promoted.push(seasonPromoteQuiet(a).name);
  }
  if (!S.players.some(p => seasonActive(p) && p.status !== 'Kirada' && isGK(p.pos))) {
    const gk = S.v6.academy.find(a => isGK(a.pos)) || (() => { const c = createUniqueAcademyCandidate(); c.pos = 'GK'; c.type = pickPlayerType('GK', R(c.profileSeed)); c.special = false; c.overall = Math.max(c.overall, 58); c.age = Math.max(c.age, 17); return c; })();
    S.v6.academy = S.v6.academy.filter(q => q !== gk); S.v6.academy.unshift(gk);
    seasonPromoteQuiet(gk); promoted.push(gk.name);
  }
  if ((S.v6.academy || []).length < 5) while (S.v6.academy.length < 5) S.v6.academy.push(createUniqueAcademyCandidate());
  if (promoted.length) pushInbox('Altyapı Sorumlusu', 'Altyapıdan takviye', `Kadro çok daraldığı için ${promoted.join(', ')} A takıma alındı.`, 'player');
  se.data.log.promoted = promoted;
}
function seasonPromoteQuiet(a) {
  S.v6.academy = S.v6.academy.filter(q => q !== a);
  S.v6.usedAcademyCandidateIds?.push(a.id);
  const p = { id: nextPlayerId(), academyCandidateId: a.id, name: a.name, age: a.age, pos: a.pos, overall: a.overall, potential: a.potential, fitness: 100,
    morale: 84, form: 68, relation: 70, minutes: 0, value: 800000, contract: 3, status: 'Altyapıdan A takım', goals: 0, assists: 0, yellow: 0, red: 0,
    injury: 0, personality: a.special ? 'Özel yetenek' : 'Hırslı', happiness: 84, growth: 0, secondary: [], academyLocked: true, debutDone: false,
    wage: 480000, careerGoals: 0, careerApps: 0 };
  S.players.push(p);
  assignPlayerProfile(p, { seed: a.profileSeed, type: a.type || (a.special ? WONDER_TYPES[profilePositionGroup(a.pos)] : undefined), special: a.special });
  if (a.pinned) { const k = (S.v795?.wonderkids || []).find(w => w.academyId === a.id); if (k) { k.where = 'squad'; k.playerId = p.id; } }
  return p;
}
// gaps in the first eleven (retired, released, sold) are filled with the best fitting man on the bench
function seasonFillXI() {
  normalizeFormation();
  const slots = Object.entries(SLOT_POS), taken = new Set();
  for (const id of S.xi) { const pos = S.positions[id]; const slot = slots.find(([, xy]) => pos && Math.abs(xy[0] - pos[0]) < 3 && Math.abs(xy[1] - pos[1]) < 3); if (slot) taken.add(slot[0]); }
  const group = key => key === 'GK' ? 'GK' : /CB/.test(key) ? 'CB' : key === 'LB' || key === 'RB' ? key : /CM/.test(key) ? 'CM' : key;
  for (const [key, xy] of slots) {
    if (S.xi.length >= 11) break;
    if (taken.has(key)) continue;
    const need = group(key);
    const pool = S.players.filter(p => seasonActive(p) && p.status !== 'Kirada' && !S.xi.includes(p.id) && !(p.injury > 0));
    const fit = p => p.pos.split('/').includes(need) ? 2 : need !== 'GK' && !isGK(p.pos) ? (need === 'CB' && /B$/.test(p.pos) ? 1 : 0) : -9;
    const best = pool.sort((a, b) => fit(b) - fit(a) || b.overall - a.overall)[0];
    if (!best || fit(best) < 0) continue;
    S.xi.push(best.id); S.positions[best.id] = [...xy]; taken.add(key);
  }
  if (Array.isArray(S.bench)) S.bench = S.players.filter(p => seasonActive(p) && !S.xi.includes(p.id)).map(p => p.id).slice(0, 7);
}

/* ---------- screens ---------- */
const SEASON_CSS = `<style>
.seasonend .seasonsteps{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0 12px}
.seasonend .seasonsteps span{font-size:12px;padding:4px 9px;border-radius:999px;background:rgba(127,127,127,.16);opacity:.7}
.seasonend .seasonsteps span.on{background:#f2c94c;color:#1d1d1d;opacity:1;font-weight:700}
.seasonend .seasonsteps span.ok{opacity:.95}
.seasonend .champion{display:flex;align-items:center;gap:12px}
.seasonend .champion h2{margin:2px 0}
.seasonend .seasonkpis{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}
.seasonend .seasonkpis div{background:rgba(127,127,127,.12);border-radius:10px;padding:8px;text-align:center}
.seasonend .seasonkpis b{display:block;font-size:20px}
.seasonend .seasonkpis small{font-size:11px;opacity:.75}
.seasonend .toprow{display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid rgba(127,127,127,.18);font-size:14px}
.seasonend .toprow:last-child{border-bottom:0}
.seasonend .leaguerow.me{background:rgba(242,201,76,.18);border-radius:6px}
.seasonend .delta{font-weight:700;min-width:46px;text-align:right}
.seasonend .delta.up{color:#2fa36b}.seasonend .delta.down{color:#d65a4a}
.seasonend .contract{padding:10px 0;border-bottom:1px solid rgba(127,127,127,.18)}
.seasonend .contract:last-child{border-bottom:0}
.seasonend .contract .choices{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:8px}
.seasonend .contract .choices button{min-height:40px;padding:6px 4px;font-size:13px}
.seasonend .contract .choices button.on{background:#f2c94c;color:#1d1d1d;border-color:#f2c94c;font-weight:700}
.seasonend .contract .choices button.release.on{background:#d65a4a;color:#fff;border-color:#d65a4a}
.seasonend .warn{color:#d65a4a;font-weight:600}
.seasonend .stickycta{position:sticky;bottom:calc(70px + env(safe-area-inset-bottom,0px));z-index:3;margin-top:12px;padding-right:58px}
.seasonend .stickycta button{width:100%}
</style>`;
function seasonStepsBar(se) {
  const labels = [['summary', 'Özet'], ['report', 'Sezon arası'], ['contracts', 'Sözleşmeler'], ['newSeason', 'Yeni sezon']];
  const current = se.steps[se.at];
  return `<div class=seasonsteps>${labels.filter(([id]) => se.steps.includes(id)).map(([id, l]) =>
    `<span class="${id === current ? 'on' : se.done[id] ? 'ok' : ''}">${se.done[id] ? '✓ ' : ''}${l}</span>`).join('')}</div>`;
}
function seasonEndUI() {
  const se = S.seasonEnd, step = seasonStepById(se?.steps?.[se.at]);
  const body = step?.screen ? step.screen(se) : `<section class=card><p>Sezon sonu işlemleri tamamlanıyor…</p><button onclick="seasonEndCheck();save();render()">Devam</button></section>`;
  return `${header()}${SEASON_CSS}<main class="appcontent seasonend"><small class=muted>SEZON SONU • ${seasonEsc(se.season)}</small>${seasonStepsBar(se)}${body}</main>${bottomNav('home')}`;
}
function seasonTopList(title, rows, unit) {
  return `<div><small>${title}</small>${rows.length ? rows.map((r, i) => `<div class=toprow><span>${i + 1}. ${seasonEsc(r.name)} <small class=muted>${r.apps} maç</small></span><b>${r.value}${unit}</b></div>`).join('')
    : `<p class=muted>—</p>`}</div>`;
}
function seasonSummaryUI(se) {
  const d = se.data.summary, club = seasonClub();
  return `<section class="card champion">${typeof crest === 'function' ? crest(d.champion, 52) : ''}<div><small>ŞAMPİYON</small><h2>${seasonEsc(d.champion)}</h2>
   <p class=muted>${d.champion === club ? 'Tebrikler hocam, kupa bizim!' : `${seasonEsc(club)} sezonu ${d.rank}. sırada bitirdi.`}</p></div></section>
  <section class=card><div class=seasonkpis><div><small>SIRAMIZ</small><b>${d.rank}.</b></div><div><small>PUAN</small><b>${d.pts}</b></div><div><small>AVERAJ</small><b>${d.gf - d.ga >= 0 ? '+' : ''}${d.gf - d.ga}</b></div></div>
   ${d.objectives.map(o => `<div class=toprow><span>${seasonEsc(o.text)}</span><b>${o.met == null ? '' : o.met ? '✓ Tuttu' : '✗ Tutmadı'} <small class=muted>${seasonEsc(o.detail)}</small></b></div>`).join('')}
   <div class=toprow><span>Lig ödülü</span><b>${money(d.prize)}</b></div></section>
  <section class=card><h3>Sezonun öne çıkanları</h3>${seasonTopList('GOL', d.goals, '')}${seasonTopList('ASİST', d.assists, '')}${seasonTopList('ORTALAMA PUAN', d.rating, '')}</section>
  <section class=card><h3>Final puan durumu</h3><div class=leaguehead><span>Takım</span><span>O</span><span>AV</span><span>P</span></div>
   ${d.table.map((x, i) => `<div class="leaguerow${x.n === club ? ' me' : ''}"><span>${i + 1}. ${seasonEsc(x.n)}</span><span>${x.p}</span><span>${x.gf - x.ga}</span><b>${x.pts}</b></div>`).join('')}</section>
  <div class=stickycta><button class=goldbtn onclick="seasonEndNext('summary')">Sezon arasına geç</button></div>`;
}
function seasonReportUI(se) {
  const L = se.data.log, aging = (L.aging || []).slice().sort((a, b) => (b.to - b.from) - (a.to - a.from) || b.to - a.to);
  const row = x => { const d = x.to - x.from; return `<div class=toprow><span><span class=badge>${seasonEsc(x.pos)}</span> ${seasonEsc(x.name)} <small class=muted>${x.age} yaş</small>${x.learned?.length ? ' ✨' : ''}</span><span>OVR ${x.to} <span class="delta ${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d > 0 ? '▲' + d : d < 0 ? '▼' + (-d) : '–'}</span></span></div>`; };
  return `<section class=card><h3>Bir yaş büyüdüler</h3><p class=muted>Gençler potansiyellerine yaklaştı, 30 yaş üstünde düşüş başladı (kalecilerde daha geç).</p>${aging.map(row).join('') || '<p class=muted>—</p>'}</section>
  <section class=card><h3>Emekli olanlar</h3>${(L.retired || []).length ? L.retired.map(x => `<div class=toprow><span>${seasonEsc(x.name)} <small class=muted>${seasonEsc(x.pos)}</small></span><b>${x.age} yaş</b></div>`).join('') : '<p class=muted>Bu yaz kimse futbolu bırakmadı.</p>'}</section>
  ${(L.loans || []).length ? `<section class=card><h3>Kiralıktan dönenler</h3><p>${L.loans.map(seasonEsc).join(', ')}</p></section>` : ''}
  <div class=stickycta><button class=goldbtn onclick="seasonEndNext('report')">Devam</button></div>`;
}
function seasonContractsUI(se) {
  const rows = se.data.expiring.map(x => ({ x, p: S.players.find(q => q.id === x.id) })).filter(r => r.p);
  const dec = se.data.decisions;
  const keptAfter = S.players.filter(p => seasonActive(p) && !(rows.some(r => r.p === p) && dec[p.id] === 0));
  const wage = keptAfter.reduce((n, p) => { const r = rows.find(r => r.p === p); return n + (r && dec[p.id] > 0 ? r.x.demand : p.wage || 0); }, 0);
  const now = S.players.filter(seasonActive).reduce((n, p) => n + (p.wage || 0), 0), open = rows.filter(r => dec[r.p.id] == null).length;
  return `<section class=card><h3>Sözleşmesi bitenler</h3><p class=muted>Yenilersen oyuncu yeni maaş talebiyle kalır; bırakırsan serbest oyuncu olarak transfer havuzuna düşer.</p>
   <div class=toprow><span>Yıllık maaş gideri</span><b>${money(now)} → ${money(wage)}</b></div>
   ${keptAfter.some(p => isGK(p.pos)) ? '' : `<p class=warn>Bu kararlarla kadroda kaleci kalmıyor; altyapıdan acil bir kaleci yukarı alınır.</p>`}
   <div class=toprow><span>Gelecek sezon kadro</span><b class="${keptAfter.length < SEASON_MIN_SQUAD ? 'warn' : ''}">${keptAfter.length} oyuncu</b></div>
   ${keptAfter.length < SEASON_MIN_SQUAD ? `<p class=muted>Kadro ${SEASON_MIN_SQUAD} oyuncunun altına inerse eksik kalan yerler altyapıdan doldurulur.</p>` : ''}
   <div class="row between" style="gap:8px;margin-top:8px"><button class=secondary onclick="seasonContractAll(1)">Hepsini 1 yıl yenile</button><button class=secondary onclick="seasonContractAll(0)">Hepsini bırak</button></div></section>
  <section class=card>${rows.map(({ x, p }) => `<div class=contract><div class="row between"><div><span class=badge>${seasonEsc(p.pos)}</span> <b>${seasonEsc(p.name)}</b><br><small class=muted>${p.age} yaş • OVR ${p.overall} / POT ${p.potential}</small></div>
     <div style="text-align:right"><small class=muted>Talep</small><br><b>${money(x.demand)}</b><small class=muted>/yıl</small></div></div>
     <small class=muted>Şimdiki maaş ${money(p.wage || 0)}</small>
     <div class=choices>${[1, 2, 3].map(y => `<button class="secondary${dec[p.id] === y ? ' on' : ''}" ${y > x.maxYears ? 'disabled' : ''} onclick="seasonContractPick(${p.id},${y})">${y} yıl</button>`).join('')}
     <button class="secondary release${dec[p.id] === 0 ? ' on' : ''}" onclick="seasonContractPick(${p.id},0)">Bırak</button></div></div>`).join('')}</section>
  <div class=stickycta><button class=goldbtn ${open ? 'aria-disabled="true"' : ''} onclick="seasonEndNext('contracts')">${open ? `${open} karar bekliyor` : 'Kararları onayla, yeni sezona geç'}</button></div>`;
}
