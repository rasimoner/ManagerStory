/* Yıldız transfer sahnesi (feat/star-transfer-scene).
   A big signing (a 4–5 star player) is an event in the career: the breaking news, the signing with the
   shirt number he picks, the walk out of the tunnel in front of a full stand, and his best special move.
   The clip is kept as the first entry of the career highlight archive (S.highlights), which the coming
   archive screen and "İzle" will read.

   Parallel work note: this file wraps v6Sign and showV6Transfers instead of editing them in app.js, so the
   season-transition branch (contracts, free agents) can change those lines without conflicts here. */

// the one place that says which transfers get the scene
import { MOVE_DATA } from '../../data/moves.js';
import { BALANCE } from '../../data/balance.js';
import { S } from '../../core/state.js';
import { defineActions } from '../../ui/actions.js';
import { onHook } from '../../core/hooks.js';
import { escapeHTML } from '../../core/engine/match-support.js';
import { $, SKILL_NAMES, asking, cinematic, clearCinematicNext, clubColor, clubProps, header, money, pushInbox, recordMoves, render, resolveClubIdentity, save } from './app.js';
export const STAR_SCENE_MIN_STARS = BALANCE.starScene.minStars;
// the most spectacular move he has is the one he shows (data/moves.js starShow); without one, the fallback
export const STAR_SHOW_ORDER = MOVE_DATA.starShow.order;
export const STAR_SHOW_FALLBACK = MOVE_DATA.starShow.fallback;
export const STAR_SHOW_NAMES = MOVE_DATA.starShow.names;
// the numbers a star asks for first, when they are free
export const STAR_SHIRT_WISH = BALANCE.starScene.shirtWish;

export function starIsKeeper(rec) { return String(rec?.pos || rec?.position || '').split('/')[0] === 'GK'; }
// a keeper's skill stars are always 1 (his only special is the scorpion), so for this scene his class
// comes from his overall instead
export function keeperShowStars(ovr) { return 1 + MOVE_DATA.starShow.keeperStars.filter(at => ovr >= at).length; }
export function starShowRating(rec) {
  let k = { stars: 1, moves: [] };
  try { k = typeof recordMoves === 'function' ? recordMoves(rec) : k; } catch (e) { /* no rating: 1 star */ }
  if (starIsKeeper(rec)) return { stars: keeperShowStars(Number(rec.overall) || 0), moves: k.moves || [], keeper: true };
  return { stars: k.stars || 1, moves: k.moves || [], keeper: false };
}
export function starSceneQualifies(rec) { return !!rec && starShowRating(rec).stars >= STAR_SCENE_MIN_STARS; }
export function starShowMove(rating) {
  if (rating.keeper) return rating.moves.includes(MOVE_DATA.starShow.keeperMove) ? MOVE_DATA.starShow.keeperMove : MOVE_DATA.starShow.keeperFallback;
  return STAR_SHOW_ORDER.find(m => rating.moves.includes(m)) || STAR_SHOW_FALLBACK;
}
export function starMoveName(kind) { return STAR_SHOW_NAMES[kind] || (typeof SKILL_NAMES === 'object' && SKILL_NAMES[kind]) || kind; }
// how loud the stand is: more stars and a bigger fee, more noise (0.45 … 1)
export function starTransferExcite(stars, fee) {
  const f = Math.max(0, Math.min(1, (Number(fee) || 0) / 30e6));
  return Math.max(0.3, Math.min(1, 0.45 + (stars - 4) * 0.25 + f * 0.3));
}

// ---- shirt numbers ----
// a player without a number wears his place in the squad list (that is what the 3D match shows)
export function takenShirtNumbers(exceptId) {
  const taken = new Set();
  (S.players || []).forEach((p, i) => {
    if (p.status === 'Transfer oldu' || p.id === exceptId) return;
    taken.add(Number.isInteger(p.number) ? p.number : i + 1);
  });
  return taken;
}
export function freeShirtNumbers(exceptId) { const t = takenShirtNumbers(exceptId), out = []; for (let n = 1; n <= 99; n++) if (!t.has(n)) out.push(n); return out; }
export function defaultShirtNumber(exceptId) { const free = freeShirtNumbers(exceptId); return STAR_SHIRT_WISH.find(n => free.includes(n)) ?? free[0] ?? 99; }

// ---- the highlight archive (minimal: the archive screen and "İzle" come later) ----
export function ensureHighlights() { if (!Array.isArray(S.highlights)) S.highlights = []; return S.highlights; }
export function addStarTransferHighlight(p, info) {
  const list = ensureHighlights();
  const old = list.find(h => h.kind === 'star-transfer' && h.playerId === p.id);
  if (old) return old;
  const n = list.reduce((m, h) => Math.max(m, Number(String(h.id).replace(/\D/g, '')) || 0), 0) + 1;
  const rec = {
    id: 'hl' + n, kind: 'star-transfer', playerId: p.id, playerName: p.name, pos: p.pos,
    move: info.move, stars: info.stars, keeper: !!info.keeper, fee: Math.round(Number(info.fee) || 0), fromClub: info.fromClub || '',
    season: S.season || '2025/26', week: S.week, matchday: (S.fixture ?? 0) + 1,
  };
  list.push(rec);
  return rec;
}
// the home-page flash card stays for the week of the signing and the next
export function latestStarTransfer() {
  const list = Array.isArray(S?.highlights) ? S.highlights : [];
  for (let i = list.length - 1; i >= 0; i--) {
    const h = list[i];
    if (h.kind !== 'star-transfer') continue;
    if (h.season === (S.season || '2025/26') && S.week - h.week <= 1 && S.players.some(p => p.id === h.playerId && p.status !== 'Transfer oldu')) return h;
    return null;
  }
  return null;
}

// ---- the flow ----
// one flow at a time; a trial ("Transfer sahnesi dene") works on a copy and saves nothing
export let starFlow = null;
export function endStarFlow() { starFlow = null; }
export function starFlowPlayer() { return starFlow?.trial ? starFlow.player : S.players.find(p => p.id === starFlow?.playerId); }

export function beginStarTransfer(p, x, fee) {
  const rating = starShowRating(p), move = starShowMove(rating);
  if (!Number.isInteger(p.number)) p.number = defaultShirtNumber(p.id);
  const rec = addStarTransferHighlight(p, { move, stars: rating.stars, keeper: rating.keeper, fee, fromClub: x?.free ? 'Serbest oyuncu' : x?.club });
  const moves = rating.moves.length;
  pushInbox('Spor Servisi', `SON DAKİKA • ${p.name} resmen bizde`, `${'★'.repeat(rating.stars)} ${p.pos} • ${moves ? moves + ' özel hareket' : 'özel hareketi yok'} • ${money(rec.fee)}. Taraftar stadın önüne akın etti; yıldız bu akşam tünelden çıkıp sahada ilk şovunu yapacak.`, 'board');
  save();
  clearCinematicNext();
  starFlow = { playerId: p.id, rec, rating, move, excite: starTransferExcite(rating.stars, fee), trial: false };
  starAnnounceScreen();
}

export function starTransferTrial(which) {
  const pool = (S.v6?.transferPool || []).filter(x => which === 'gk' ? starIsKeeper(x) : !starIsKeeper(x));
  if (!pool.length) return alert('Transfer listesinde uygun oyuncu yok.');
  const best = pool.map(x => ({ x, r: starShowRating(x) })).sort((a, b) => (b.r.stars - a.r.stars) || (b.r.moves.length - a.r.moves.length) || (b.x.overall - a.x.overall))[0];
  const x = best.x, fee = typeof asking === 'function' ? asking(x) : x.price;
  const player = { id: -1, name: x.name, pos: x.pos, overall: x.overall, age: x.age, number: defaultShirtNumber(-1) };
  const rec = { id: 'deneme', kind: 'star-transfer', playerId: -1, playerName: x.name, pos: x.pos, move: starShowMove(best.r), stars: best.r.stars, keeper: best.r.keeper, fee, fromClub: x.club };
  starFlow = { player, rec, rating: best.r, move: rec.move, excite: starTransferExcite(best.r.stars, fee), trial: true };
  starAnnounceScreen();
}

export function starStarsHTML(n, cls = '') { return `<span class="ststars ${cls}" aria-label="${n} yıldız">${'★'.repeat(n)}<i>${'★'.repeat(5 - n)}</i></span>`; }

// 1. the announcement: breaking news, big stars and the number of special moves (cannot be skipped)
export function starAnnounceScreen() {
  const p = starFlowPlayer(), f = starFlow, club = resolveClubIdentity('career'), n = f.rating.moves.length;
  $('#app').innerHTML = `<div class="stflash" style="--club:${clubColor(club.primaryColor) || '#c8102e'};--club2:${clubColor(club.secondaryColor) || '#fff'}">
<div class="stticker" aria-hidden="true"><span>SON DAKİKA • ${escapeHTML(p.name.toLocaleUpperCase('tr'))} ${escapeHTML(club.name.toLocaleUpperCase('tr'))}’NDA • SON DAKİKA • YILDIZ TRANSFER •</span></div>
<div class="stflashbody"><small>SON DAKİKA${f.trial ? ' • DENEME' : ''}</small><h1>${escapeHTML(p.name)}</h1><p>${escapeHTML(p.pos)} • ${f.rec.fromClub ? escapeHTML(f.rec.fromClub) + ' → ' : ''}${escapeHTML(club.name)}</p>
${starStarsHTML(f.rating.stars, 'big')}
<div class="stmoves"><b>${f.rating.keeper ? (f.move === 'scorpion' ? 'AKREP' : 'KALECİ') : n}</b><span>${f.rating.keeper ? (f.move === 'scorpion' ? 'Higuita’nın akrep vuruşu' : 'Yıldız kaleci') : n ? 'özel hareket' : 'özel hareketi yok'}</span></div>
<div class="stfee">Bonservis <b>${money(f.rec.fee)}</b></div></div>
<button class="goldbtn stnext" data-action="starSigningScreen">İmza törenine geç</button></div>`;
}

// 2. the signing: the handshake, the shirt, and the number he picks (can be skipped)
export function starSigningScreen() {
  const p = starFlowPlayer(), club = resolveClubIdentity('career'), free = freeShirtNumbers(p.id);
  const wish = STAR_SHIRT_WISH.filter(n => free.includes(n)), shown = [...new Set([...wish, ...free.slice(0, 12)])].slice(0, 12).sort((a, b) => a - b);
  if (!free.includes(p.number)) p.number = defaultShirtNumber(p.id);
  $('#app').innerHTML = `<div class="stsign">
<div class="stsignphoto"><img src="assets/atmosphere/signing-base.webp" alt="İmza töreni">${typeof clubProps === 'function' ? clubProps('career', { kind: 'signing' }) : ''}<div class="cinematicshade"></div>
<div class="stshirt" style="--club:${clubColor(club.primaryColor) || '#c8102e'};--club2:${clubColor(club.secondaryColor) || '#fff'}"><span>${escapeHTML(p.name.split(' ').slice(-1)[0].toLocaleUpperCase('tr'))}</span><b>${p.number}</b></div>
<div class="stsigncopy"><small>İMZA TÖRENİ</small><h2>Teknik direktörle el sıkıştı</h2><p>${escapeHTML(p.name)} formayla poz veriyor. Sırtındaki numarayı o seçiyor.</p></div>
<button class="ghost stskip" data-action="starSkipSigning">Atla ›</button></div>
<section class="card"><small>FORMA NUMARASI</small><h3>Boş numaralardan seç</h3><div class="stnumbers">${shown.map(n => `<button class="${n === p.number ? 'on' : ''}" data-action="starPickNumber" data-number="${n}">${n}</button>`).join('')}</div>
<label class="stmore">Diğer boş numaralar <select data-action="starPickNumber">${free.map(n => `<option value="${n}" ${n === p.number ? 'selected' : ''}>${n}</option>`).join('')}</select></label></section>
<button class="goldbtn stnext" data-action="starWalkOut">${p.number} numarayla sahaya çık</button></div>`;
}
export function starPickNumber(n) {
  const p = starFlowPlayer();
  if (!p || !freeShirtNumbers(p.id).includes(n)) return;
  p.number = n;
  if (!starFlow.trial) save();
  starSigningScreen();
}
export function starSkipSigning() { starWalkOut(); }

// 3 and 4. out of the tunnel in front of a full stand, then his move (3D; cannot be skipped)
export let starSceneModule = null;
export function starWalkOut(replayRec) {
  const replay = !!replayRec;
  if (replay) {
    const p = S.players.find(q => q.id === replayRec.playerId);
    if (!p) return render();
    starFlow = { playerId: p.id, rec: replayRec, rating: { stars: replayRec.stars, moves: [], keeper: replayRec.keeper }, move: replayRec.move, excite: starTransferExcite(replayRec.stars, replayRec.fee), trial: false, replay: true };
  }
  const p = starFlowPlayer(), f = starFlow, club = resolveClubIdentity('career');
  $('#app').innerHTML = `<div class="stloading"><small>STADYUM</small><h2>Tribünler doluyor…</h2></div>`;
  const opts = {
    player: { id: typeof p.id === 'number' && p.id > 0 ? p.id : 990001, name: p.name, no: p.number || 10, pos: p.pos, keeper: !!f.rating.keeper },
    move: f.move, moveName: starMoveName(f.move), stars: f.rec.stars, excite: f.excite,
    club: { name: club.name, primaryColor: clubColor(club.primaryColor) || '#c8102e', secondaryColor: clubColor(club.secondaryColor) || '#ffffff', shortName: club.shortName },
    closing: !replay, trial: f.trial,
  };
  const done = () => { endStarFlow(); render(); };
  const fallback = () => {
    // no 3D on this device: the old photo scene of the fans waiting for him
    cinematic('assets/atmosphere/fans-neutral.webp', 'TESİSLERİN ÖNÜ', 'TARAFTARLAR YENİ YILDIZI BEKLİYOR', `${p.name} ${p.number} numaralı formayla selamladı. Gösterisi: ${starMoveName(f.move)}.`, replay ? 'Kulübe dön' : 'Devam', replay ? done : () => starClosingScreen(), `${p.name}! ${p.name}! ${club.name}’a hoş geldin!`, 'fans');
  };
  (starSceneModule ??= import('../../core/presentation/scenes/star-transfer-scene.js'))
    .then(m => m.playStarTransferScene(opts))
    .then(r => { if (!r) return fallback(); if (replay) return done(); if (r.closed) return done(); starClosingScreen(); })
    .catch(e => { console.warn('Yıldız sahnesi açılamadı', e); fallback(); });
}

// 5. closing: "added to the career highlight archive" (can be skipped; shown on its own only when the 3D
// scene could not show it)
export function starClosingScreen() {
  const p = starFlowPlayer(), f = starFlow;
  $('#app').innerHTML = `${header()}<main class="appcontent"><section class="card stclose"><small>KAPANIŞ</small><h2>Kariyer highlight arşivine eklendi</h2><p>${escapeHTML(p?.name || '')} • ${escapeHTML(starMoveName(f?.move))}${f?.trial ? ' (deneme: arşive yazılmadı)' : ''}</p><div class="row"><button class="goldbtn" data-action="closeStarFlow">Kulübe dön</button><button class="ghost" data-action="closeStarFlow">Atla</button></div></section></main>`;
}

// the home-page flash card while the signing is fresh
/* Refactor C2: the star transfer screens' buttons. starPickNumber: a number button, or the select of the other free numbers. */
defineActions({
  starSigningScreen: () => starSigningScreen(),
  starSkipSigning: () => starSkipSigning(),
  starPickNumber: (d, el) => starPickNumber(+(d.number ?? el.value)),
  starWalkOut: () => starWalkOut(),
  starReplay: () => starWalkOut(latestStarTransfer()),
  closeStarFlow: () => { endStarFlow(); render(); },
  starTransferTrial: d => starTransferTrial(d.kind),
});

export function starFlashCard() {
  if (!S) return '';
  const h = latestStarTransfer(); if (!h) return '';
  const p = S.players.find(q => q.id === h.playerId), club = resolveClubIdentity('career');
  return `<section class="card stflashcard" style="--club:${clubColor(club.primaryColor) || '#c8102e'}"><div class="stflashtag">SON DAKİKA</div><div class="row between"><div><h3>${escapeHTML(h.playerName)} <span class="stno">${p?.number ?? ''}</span></h3><small>${escapeHTML(h.pos)} • ${money(h.fee)}${h.fromClub ? ' • Önceki kulüp: ' + escapeHTML(h.fromClub) : ''}</small></div>${starStarsHTML(h.stars, 'mid')}</div><p class="muted">${h.keeper ? 'Kaleci şovu: ' : 'Gösterisi: '}${escapeHTML(starMoveName(h.move))}</p><button class="ghost" data-action="starReplay">▶ Sahneyi izle</button></section>`;
}

// ---- what this file adds to the signing and to the transfer list (core/hooks.js); main.js installs it ----
export function installStarTransfer() {
  let big = false;
  // decided before the signing, as the player stood on the market
  onHook('beforeSigning', x => { big = starSceneQualifies(x); });
  onHook('afterSigning', (player, x, fee) => {
    if (!big) return;
    try { beginStarTransfer(player, x, fee); } catch (e) { console.warn('Yıldız transfer sahnesi', e); }
  });
  // (temporary) "Transfer sahnesi dene" on the transfer screen, like the other test buttons
  onHook('transferListShown', () => {
    // (under the transfer office picture: before the header it pushed the sticky header down the page)
    const anchor = document.querySelector('#app .vscene') || document.querySelector('#app .weekstrip');
    anchor?.insertAdjacentHTML?.('afterend', `<section class="card sttry"><small>GEÇİCİ TEST</small><b>Transfer sahnesi dene</b><div class="row"><button class="ghost" data-action="starTransferTrial" data-kind="out">Oyuncuyla</button><button class="ghost" data-action="starTransferTrial" data-kind="gk">Kaleciyle</button></div></section>`);
  });
  starTransferStyles();
}

export function starTransferStyles() {
  if (typeof document === 'undefined' || !document.createElement || !document.head) return;
  const css = document.createElement('style');
  css.textContent = `
.stflash{position:fixed;inset:0;z-index:1100;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;display:flex;flex-direction:column;justify-content:space-between;background:radial-gradient(120% 80% at 50% 20%,var(--club) 0%,#0b0f14 70%);color:#fff;overflow:hidden;padding:0 0 calc(env(safe-area-inset-bottom,0px) + 18px)}
.stticker{background:#f4c430;color:#0d1117;font:900 14px/1 -apple-system,BlinkMacSystemFont,sans-serif;letter-spacing:.08em;white-space:nowrap;overflow:hidden;padding:9px 0;margin-top:env(safe-area-inset-top,0px)}
.stticker span{display:inline-block;padding-left:100%;animation:stticker 9s linear infinite}
@keyframes stticker{to{transform:translateX(-100%)}}
.stflashbody{padding:22px 20px;text-align:center;animation:stpop .5s cubic-bezier(.2,1.4,.4,1)}
@keyframes stpop{from{transform:scale(.85);opacity:0}}
.stflashbody>small{display:inline-block;background:#e0182d;color:#fff;font-weight:900;letter-spacing:.12em;padding:4px 10px;transform:skewX(-8deg)}
.stflashbody h1{font-size:clamp(34px,11vw,56px);line-height:1;margin:14px 0 6px;text-transform:uppercase;text-shadow:0 3px 18px #000a}
.stflashbody p{margin:0 0 14px;color:#dfe6ee}
.ststars{color:#f4c430;letter-spacing:.04em;white-space:nowrap}.ststars i{font-style:normal;color:#ffffff30}
.ststars.big{display:block;font-size:clamp(44px,15vw,72px);line-height:1.05;text-shadow:0 0 24px #f4c43066}
.ststars.mid{font-size:24px}
.stmoves{display:inline-flex;align-items:baseline;gap:8px;margin-top:10px;background:#0d1117b0;border:1px solid #f4c43066;border-radius:14px;padding:10px 16px}
.stmoves b{font-size:clamp(34px,11vw,52px);color:#f4c430;line-height:1}.stmoves span{font-weight:700;font-size:16px}
.stfee{margin-top:12px;color:#cfd8e2}.stfee b{color:#fff}
.stnext{margin:0 16px;min-height:52px}
.stsign{position:fixed;inset:0;z-index:1100;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;background:#0b0f14;padding-bottom:calc(env(safe-area-inset-bottom,0px) + 16px)}
.stsignphoto{position:relative;height:min(58vh,420px);overflow:hidden}
.stsignphoto>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.stshirt{position:absolute;right:14px;top:calc(env(safe-area-inset-top,0px) + 14px);width:96px;height:104px;background:var(--club);color:var(--club2);border-radius:14px 14px 10px 10px;clip-path:polygon(22% 0,78% 0,100% 18%,88% 34%,84% 100%,16% 100%,12% 34%,0 18%);display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 6px 20px #000a;animation:stpop .45s cubic-bezier(.2,1.4,.4,1)}
.stshirt span{font:800 10px/1 -apple-system,BlinkMacSystemFont,sans-serif;letter-spacing:.06em;margin-top:6px}.stshirt b{font:900 44px/1 -apple-system,BlinkMacSystemFont,sans-serif}
.stsigncopy{position:absolute;left:16px;right:16px;bottom:16px;color:#fff}.stsigncopy small{color:#f4c430;font-weight:800;letter-spacing:.1em}.stsigncopy h2{margin:4px 0}.stsigncopy p{margin:0;color:#dfe6ee}
.stskip{position:absolute;left:14px;top:calc(env(safe-area-inset-top,0px) + 14px);background:#0d1117d9;color:#fff;border:1px solid #ffffff55;margin:0;min-height:40px;padding:8px 14px}
.stsign .card{margin:14px 16px}
.stnumbers{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-top:10px}
.stnumbers button{min-height:46px;font-size:18px;font-weight:800;padding:0;border-radius:10px;background:#1f2731;color:#f3f5f7;border:1px solid #ffffff22}
.stnumbers button.on{background:#f4c430;color:#0d1117;border-color:#f4c430}
.stmore{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:12px;font-size:14px}.stmore select{min-height:40px;font-size:16px}
.stloading{position:fixed;inset:0;z-index:1100;display:grid;place-content:center;text-align:center;background:#10251a;color:#cfe0d3}
.stflashcard{position:relative;border:1px solid var(--club);overflow:hidden}.stflashcard h3{margin:6px 0 2px}.stflashcard .stno{display:inline-block;min-width:28px;text-align:center;background:var(--club);color:#fff;border-radius:6px;padding:0 5px;font-size:15px}
.stflashtag{display:inline-block;background:#e0182d;color:#fff;font-weight:900;font-size:12px;letter-spacing:.1em;padding:3px 8px;transform:skewX(-8deg)}
.sttry{border:1px dashed #f4c43088;margin-top:12px}.sttry b{display:block;margin:2px 0 8px}.sttry .row{gap:8px}
.stclose h2{margin:6px 0}
@media (prefers-reduced-motion:reduce){.stticker span,.stflashbody,.stshirt{animation:none}}`;
  document.head.append(css);
}
