/* The manager's season end (refactor D5). The pipeline, the rules (ageing, retirement, development), the
   league's renewal and the new season are core (core/season/season.js); here is the manager's part of it:
   his steps, slotted into the pipeline by id (what the summer did, the expiring contracts, the academy's
   intake, the transfer market, the squad's tidy-up), what a new season means for him (budget, chairman,
   board, clock), and the season-end screens with their buttons. The steps keep their ids and places, so a
   save taken mid-way resumes where it stopped. */
import { SEASON_DEPARTED, SEASON_MIN_SQUAD, SEASON_POOL_SIZE, departPlayer, isGK, nextPlayerId, retireChance, seasonActive, seasonClub, seasonDevelop, seasonEndCheck, seasonEndNext, seasonEndStep, seasonEsc, seasonRnd, seasonStepById } from '../../core/season/season.js?v=7.11.0';
import { S } from '../../core/state.js?v=7.11.0';
import { pushInbox } from '../../core/inbox.js?v=7.11.0';
import { SLOT_POS, V6FN, V6LN, V6POS, bottomNav, createUniqueAcademyCandidate, header, marketProfile, money, normalizeFormation, refreshAcademy, render, setClock } from './app.js?v=7.11.0';
import { defineActions } from '../../ui/actions.js?v=7.11.0';
import { save } from '../../core/save.js?v=7.11.0';
import { WONDER_TYPES, assignPlayerProfile, pickPlayerType, profilePositionGroup, refreshPlayerProfile } from '../../core/players/player-profiles.js?v=7.11.0';
import { BALANCE } from '../../data/balance.js?v=7.11.0';
import { CLUBSTYLE, crest, managedClubName } from '../../core/clubs/clubs.js?v=7.11.0';
import { R } from '../../core/random.js?v=7.11.0';
/* step 5 — what the summer did (screen) */
seasonEndStep({ id: 'report', screen: seasonReportUI }, { after: 'loans' });

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
  } }, { after: 'report' });

/* steps 7, 9, 10 — automatic: the academy's new intake, the transfer market, the squad's tidy-up */
seasonEndStep({ id: 'academy', run(se) {
  const unlocked = [];
  for (const p of S.players.filter(p => seasonActive(p) && p.academyLocked)) { p.academyLocked = false; unlocked.push(p.name); }
  for (const a of S.v6.academy || []) if (a.pinned) a.age++;
  refreshAcademy(false);
  se.data.log.academy = { unlocked, intake: (S.v6.academy || []).filter(a => !a.pinned).length };
} }, { after: 'contracts' });
seasonEndStep({ id: 'market', run(se) { se.data.log.market = seasonRefreshMarket(); } }, { after: 'rivals' });
seasonEndStep({ id: 'cleanup', run(se) {
  for (const p of S.players.filter(p => p.status === SEASON_DEPARTED)) departPlayer(p, 'sold');
  seasonTopUpSquad(se);
  seasonFillXI();
  // replay chains are kept for the season that just ended only; older seasons keep score and player stats
  for (const r of S.results || []) if ((r.season ?? 0) < (S.seasonIndex || 0) && r.matchSummary?.events) { delete r.matchSummary.events; r.matchSummary.compact = true; }
  if (S.history.length > 300) S.history = S.history.slice(-300);
} }, { after: 'market' });

// the manager's new season (refactor D5: the season end says seasonStarted, main.js connects this): the
// league prize goes to his budget, the chairman writes, the board asks for his aim, the day starts at nine
export function managerSeasonStarted(summary) {
  S.budget += summary.prize || 0;
  pushInbox('Başkan', `${S.season} sezonu başlıyor`, `Geçen sezonu ${summary.rank || '-'}. sırada bitirdik. Lig ödülü ${money(summary.prize || 0)} transfer bütçesine eklendi. Transfer dönemi ilk 6 hafta açık.`, 'board');
  S.event = { kind: 'board', title: `${S.season} Sezonu Başlıyor`, speaker: 'Yönetim Başkanı',
    text: `Yeni sezon başlıyor. Geçen sezon ${summary.rank || '-'}. olduk; bu yıl senden ne bekleyeceğimizi söyle.`,
    choices: [['Hedefimiz üst sıralar.', 'ambitious'], ['Adım adım ilerleyeceğiz.', 'calm'], ['Gençlere güveneceğim.', 'youth']] };
  setClock('09:00');
}

/* Refactor C2: the season-end screens' buttons (moved with them in D5) */
defineActions({
  seasonEndCheck: () => { seasonEndCheck(); save(); render(); },
  seasonEndNext: d => seasonEndNext(d.step),
  seasonContractAll: d => seasonContractAll(+d.years),
  seasonContractPick: d => seasonContractPick(+d.id, +d.years),
});
export function seasonFreeAgent(p) {
  const st = S.v796, r = seasonRnd(`fa|${p.id}`);
  const fee = Math.round(Math.max(1, p.overall - 50) ** 2 * 21000 * (.75 + r() * .6) * .15);
  const x = { id: `v6fa${st.faSerial++}`, name: p.name, pos: p.pos, age: p.age, overall: p.overall, potential: p.potential,
    club: 'Serbest', price: Math.max(100000, Math.round(fee / 1e5) * 1e5), happiness: 72, free: true, faSeason: S.seasonIndex || 0,
    star: p.overall >= 75 && p.potential >= 84, profile: structuredClone(p.profile) };
  if (x.profile) refreshPlayerProfile(x); else marketProfile(x);
  S.v6.transferPool.unshift(x);
  return x;
}
export function seasonWageDemand(p) {
  const W = BALANCE.contracts.wage;
  const base = (p.overall * p.overall) * W.perOverallSquared;
  const happy = (p.happiness ?? 70) < W.unhappyBelow ? W.unhappyRaise : W.raise;
  return Math.round(Math.max(p.wage || 0, base) * (p.age >= W.veteranAge ? W.veteranFactor : happy) / W.roundTo) * W.roundTo;
}
export function seasonMaxYears(p) { const C = BALANCE.contracts; return (C.maxYears.find(([age]) => p.age >= age) || [0, C.defaultMaxYears])[1]; }
export function seasonContractPick(id, years) {
  const se = S.seasonEnd; if (!se?.data?.decisions) return;
  se.data.decisions[id] = years;
  save();
  const y = window.scrollY || 0; render(); window.scrollTo?.(0, y);
}
export function seasonContractAll(years) {
  const se = S.seasonEnd; if (!se?.data?.expiring) return;
  for (const x of se.data.expiring) se.data.decisions[x.id] = years > 0 ? Math.min(years, x.maxYears) : 0;
  save(); render();
}
export function seasonMarketPlayer(rnd) {
  const st = S.v796, n = st.poolSerial++, clubs = Object.keys(CLUBSTYLE).filter(x => x !== managedClubName());
  const pos = V6POS[Math.floor(rnd() * V6POS.length)], age = 18 + Math.floor(rnd() * 15), ov = 57 + Math.floor(rnd() * 21);
  const pot = Math.min(93, Math.max(ov, ov + Math.floor(rnd() * 15) - (age >= 29 ? 8 : 0)));
  const x = { id: `v6n${n}`, name: `${V6FN[Math.floor(rnd() * V6FN.length)]} ${V6LN[Math.floor(rnd() * V6LN.length)]}`, pos, age, overall: ov, potential: pot,
    club: clubs[Math.floor(rnd() * clubs.length)], price: seasonMarketPrice(ov, age, pot, rnd), happiness: 40 + Math.floor(rnd() * 61), star: ov >= 75 && pot >= 84 };
  marketProfile(x);
  return x;
}
export function seasonMarketPrice(ov, age, pot, rnd) {
  return Math.round(Math.max(1, ov - 50) ** 2 * 21000 * (.75 + rnd() * .6) * (age <= 21 && pot - ov >= 10 ? 1.3 : 1) * (age >= 31 ? .7 : 1));
}
// the market ages with everyone else: players develop, old ones retire, last summer's unsigned free agents
// move on, and new names fill it back to its usual size
export function seasonRefreshMarket() {
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
export function seasonTopUpSquad(se) {
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
export function seasonPromoteQuiet(a) {
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
export function seasonFillXI() {
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
export const SEASON_CSS = `<style>
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
export function seasonStepsBar(se) {
  const labels = [['summary', 'Özet'], ['report', 'Sezon arası'], ['contracts', 'Sözleşmeler'], ['newSeason', 'Yeni sezon']];
  const current = se.steps[se.at];
  return `<div class=seasonsteps>${labels.filter(([id]) => se.steps.includes(id)).map(([id, l]) =>
    `<span class="${id === current ? 'on' : se.done[id] ? 'ok' : ''}">${se.done[id] ? '✓ ' : ''}${l}</span>`).join('')}</div>`;
}
// a core step that is a screen (screen: true, e.g. the summary) is drawn by the mode; the mode's own steps carry theirs
export function seasonScreen(step) { return typeof step.screen === 'function' ? step.screen : { summary: seasonSummaryUI }[step.id]; }
export function seasonEndUI() {
  const se = S.seasonEnd, step = seasonStepById(se?.steps?.[se.at]);
  const body = step?.screen ? seasonScreen(step)(se) : `<section class=card><p>Sezon sonu işlemleri tamamlanıyor…</p><button data-action="seasonEndCheck">Devam</button></section>`;
  return `${header()}${SEASON_CSS}<main class="appcontent seasonend"><small class=muted>SEZON SONU • ${seasonEsc(se.season)}</small>${seasonStepsBar(se)}${body}</main>${bottomNav('home')}`;
}
export function seasonTopList(title, rows, unit) {
  return `<div><small>${title}</small>${rows.length ? rows.map((r, i) => `<div class=toprow><span>${i + 1}. ${seasonEsc(r.name)} <small class=muted>${r.apps} maç</small></span><b>${r.value}${unit}</b></div>`).join('')
    : `<p class=muted>—</p>`}</div>`;
}
export function seasonSummaryUI(se) {
  const d = se.data.summary, club = seasonClub();
  return `<section class="card champion">${typeof crest === 'function' ? crest(d.champion, 52) : ''}<div><small>ŞAMPİYON</small><h2>${seasonEsc(d.champion)}</h2>
   <p class=muted>${d.champion === club ? 'Tebrikler hocam, kupa bizim!' : `${seasonEsc(club)} sezonu ${d.rank}. sırada bitirdi.`}</p></div></section>
  <section class=card><div class=seasonkpis><div><small>SIRAMIZ</small><b>${d.rank}.</b></div><div><small>PUAN</small><b>${d.pts}</b></div><div><small>AVERAJ</small><b>${d.gf - d.ga >= 0 ? '+' : ''}${d.gf - d.ga}</b></div></div>
   ${d.objectives.map(o => `<div class=toprow><span>${seasonEsc(o.text)}</span><b>${o.met == null ? '' : o.met ? '✓ Tuttu' : '✗ Tutmadı'} <small class=muted>${seasonEsc(o.detail)}</small></b></div>`).join('')}
   <div class=toprow><span>Lig ödülü</span><b>${money(d.prize)}</b></div></section>
  <section class=card><h3>Sezonun öne çıkanları</h3>${seasonTopList('GOL', d.goals, '')}${seasonTopList('ASİST', d.assists, '')}${seasonTopList('ORTALAMA PUAN', d.rating, '')}</section>
  <section class=card><h3>Final puan durumu</h3><div class=leaguehead><span>Takım</span><span>O</span><span>AV</span><span>P</span></div>
   ${d.table.map((x, i) => `<div class="leaguerow${x.n === club ? ' me' : ''}"><span>${i + 1}. ${seasonEsc(x.n)}</span><span>${x.p}</span><span>${x.gf - x.ga}</span><b>${x.pts}</b></div>`).join('')}</section>
  <div class=stickycta><button class=goldbtn data-action="seasonEndNext" data-step="summary">Sezon arasına geç</button></div>`;
}
export function seasonReportUI(se) {
  const L = se.data.log, aging = (L.aging || []).slice().sort((a, b) => (b.to - b.from) - (a.to - a.from) || b.to - a.to);
  const row = x => { const d = x.to - x.from; return `<div class=toprow><span><span class=badge>${seasonEsc(x.pos)}</span> ${seasonEsc(x.name)} <small class=muted>${x.age} yaş</small>${x.learned?.length ? ' ✨' : ''}</span><span>OVR ${x.to} <span class="delta ${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d > 0 ? '▲' + d : d < 0 ? '▼' + (-d) : '–'}</span></span></div>`; };
  return `<section class=card><h3>Bir yaş büyüdüler</h3><p class=muted>Gençler potansiyellerine yaklaştı, 30 yaş üstünde düşüş başladı (kalecilerde daha geç).</p>${aging.map(row).join('') || '<p class=muted>—</p>'}</section>
  <section class=card><h3>Emekli olanlar</h3>${(L.retired || []).length ? L.retired.map(x => `<div class=toprow><span>${seasonEsc(x.name)} <small class=muted>${seasonEsc(x.pos)}</small></span><b>${x.age} yaş</b></div>`).join('') : '<p class=muted>Bu yaz kimse futbolu bırakmadı.</p>'}</section>
  ${(L.loans || []).length ? `<section class=card><h3>Kiralıktan dönenler</h3><p>${L.loans.map(seasonEsc).join(', ')}</p></section>` : ''}
  <div class=stickycta><button class=goldbtn data-action="seasonEndNext" data-step="report">Devam</button></div>`;
}
export function seasonContractsUI(se) {
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
   <div class="row between" style="gap:8px;margin-top:8px"><button class=secondary data-action="seasonContractAll" data-years="1">Hepsini 1 yıl yenile</button><button class=secondary data-action="seasonContractAll" data-years="0">Hepsini bırak</button></div></section>
  <section class=card>${rows.map(({ x, p }) => `<div class=contract><div class="row between"><div><span class=badge>${seasonEsc(p.pos)}</span> <b>${seasonEsc(p.name)}</b><br><small class=muted>${p.age} yaş • OVR ${p.overall} / POT ${p.potential}</small></div>
     <div style="text-align:right"><small class=muted>Talep</small><br><b>${money(x.demand)}</b><small class=muted>/yıl</small></div></div>
     <small class=muted>Şimdiki maaş ${money(p.wage || 0)}</small>
     <div class=choices>${[1, 2, 3].map(y => `<button class="secondary${dec[p.id] === y ? ' on' : ''}" ${y > x.maxYears ? 'disabled' : ''} data-action="seasonContractPick" data-id="${p.id}" data-years="${y}">${y} yıl</button>`).join('')}
     <button class="secondary release${dec[p.id] === 0 ? ' on' : ''}" data-action="seasonContractPick" data-id="${p.id}" data-years="0">Bırak</button></div></div>`).join('')}</section>
  <div class=stickycta><button class=goldbtn ${open ? 'aria-disabled="true"' : ''} data-action="seasonEndNext" data-step="contracts">${open ? `${open} karar bekliyor` : 'Kararları onayla, yeni sezona geç'}</button></div>`;
}
