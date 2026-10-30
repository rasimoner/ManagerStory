import { createMatchBall } from './newview/ball.js';
// New 3D match view (since V7.5.0).
// Same MatchEngine, same events, same pause/speed and the same presentation clock as the 2D view.
// This view plays each engine event as football; the existing presentation clock follows it
// (presentation.newView.gate) and the next engine minute is generated only after this view
// has played the current one (presentation.newView.busy).
import * as THREE from 'three';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';
import { buildStadium } from './newview/stadium.js';
import { createRuntime, analyseGait, BALL_R } from './newview/runtime.js';
import { loadRig } from './newview/rig.js';
import { createDirector } from './newview/director.js';
import { createBroadcastCamera } from './newview/camera.js';
import { createReplay, STAR_MOVES } from './newview/replay.js';
import { M, S } from '../../state.js';
import { presentation } from '../registry.js';
import { liveCommentaryLines, presentationEvent } from '../../engine/match-support.js';
import { clockFromSeconds, livePlaybackPaused, livePresentationPending, matchSecond, pauseLive, resumeLive, setMatchSpeed } from '../../engine/live-match.js';
import { currentPitchState, eventPoint, paintPitchGoalFeedback } from '../../engine/pitch-v73.js';
import { attackDirection, playerAtMarker, skillMoves } from '../../engine/pitch-v731.js';
import { resolveClubIdentity } from '../../clubs/clubs.js';
import { changed, decisionsRequested, starMoment } from '../../hooks.js';
import { CLUBSTYLE } from '../../clubs/club-style.js';

const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = new URL('./match3d-career.css', import.meta.url); document.head.append(link);
const css = document.createElement('style');
css.textContent = `.nv-banner{position:absolute;left:50%;top:30%;transform:translate(-50%,-50%) skewX(-8deg);font:800 clamp(22px,8vw,40px)/1.1 -apple-system,BlinkMacSystemFont,sans-serif;letter-spacing:.06em;color:#0d1117;background:#f4c430;padding:2px 16px;opacity:0;transition:opacity .25s;pointer-events:none}
.nv-banner.on{opacity:1}
.nv-who{position:absolute;left:8px;bottom:8px;display:flex;font:700 13px/1 -apple-system,BlinkMacSystemFont,sans-serif;letter-spacing:.04em;text-transform:uppercase;border-radius:5px;overflow:hidden;pointer-events:none;box-shadow:0 2px 8px #0006}
.nv-who b{padding:4px 6px;color:#fff;font-variant-numeric:tabular-nums}
.nv-dir{position:absolute;top:8px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:6px;padding:3px 9px 3px 3px;border-radius:999px;background:#0d1117b8;color:#f3f5f7;font:700 12px/1 -apple-system,BlinkMacSystemFont,sans-serif;letter-spacing:.04em;pointer-events:none;box-shadow:0 2px 8px #0005}
.nv-dir b{padding:3px 6px;border-radius:999px}
.nv-dir i{font-style:normal;font-size:15px;display:inline-block;transition:transform .35s ease}
.nv-who span{padding:4px 8px;background:#0d1117c8;color:#f3f5f7}
.nv-loading{position:absolute;inset:0;display:grid;place-items:center;color:#cfe0d3;font:600 14px -apple-system,BlinkMacSystemFont,sans-serif;background:#10251a}
.nv-fs{position:absolute;top:8px;right:8px;width:36px;height:36px;display:grid;place-items:center;border:1px solid #ffffff38;border-radius:9px;background:#0d1117b0;color:#f3f5f7;font:700 18px/1 -apple-system,BlinkMacSystemFont,sans-serif;padding:0;cursor:pointer;touch-action:manipulation;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.nv-fs:focus-visible,.nv-hud button:focus-visible{outline:2px solid #f4c430;outline-offset:2px}
.nv-hud{display:none}
html.nv-lock,html.nv-lock body{overflow:hidden!important;overscroll-behavior:none}
.career3d.nv-full{position:fixed;inset:0;z-index:1000;width:100%;height:100%;border-radius:0;background:#0d1117}
.nv-full .nv-fs{top:calc(env(safe-area-inset-top,0px) + 10px);right:calc(env(safe-area-inset-right,0px) + 10px);width:44px;height:44px;font-size:20px}
.nv-full .nv-hud{display:flex;flex-direction:column;justify-content:space-between;position:absolute;inset:0;pointer-events:none;padding:calc(env(safe-area-inset-top,0px) + 10px) max(10px,env(safe-area-inset-right,0px)) calc(env(safe-area-inset-bottom,0px) + 10px) max(10px,env(safe-area-inset-left,0px));font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display",sans-serif}
.nv-bug{display:flex;align-self:flex-start;border-radius:6px;overflow:hidden;box-shadow:0 2px 10px #0006;font-weight:800;letter-spacing:.02em}
.nv-bug span{display:flex;align-items:center;padding:6px 9px;font-size:16px;line-height:1}
.nv-bug .sc{background:#fff;color:#0d1117;font-variant-numeric:tabular-nums}
.nv-bug .clk{background:#0d1117;color:#f3f5f7;font-weight:600;font-variant-numeric:tabular-nums}
.nv-bottom{display:flex;flex-direction:column;align-items:center;gap:8px}
.nv-comm{max-width:min(560px,100%);text-align:center;color:#f3f5f7;font-size:15px;font-weight:500;line-height:1.35;text-shadow:0 1px 3px #000c;min-height:1.35em}
.nv-row{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;max-width:100%}
.nv-seg{display:flex;background:#0d1117c4;border:1px solid #ffffff24;border-radius:10px;padding:3px;pointer-events:auto;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.nv-seg button,.nv-pill{font:700 14px/1 -apple-system,BlinkMacSystemFont,sans-serif;letter-spacing:.03em;color:#c3ccd6;background:transparent;border:0;border-radius:7px;padding:10px 11px;min-height:40px;cursor:pointer;touch-action:manipulation}
.nv-seg button[aria-pressed=true]{background:#fff;color:#0d1117}
.nv-pill{pointer-events:auto;background:#0d1117c4;border:1px solid #ffffff24;color:#f3f5f7;border-radius:10px;padding:10px 14px;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.nv-pill.go{background:#2fd17a;border-color:#2fd17a;color:#062012}
.nv-full .career3d-radar{top:calc(env(safe-area-inset-top,0px) + 64px);bottom:auto;left:auto;right:max(10px,env(safe-area-inset-right,0px));transform:none;width:110px;height:72px}
.nv-full .nv-who{left:max(10px,env(safe-area-inset-left,0px));top:calc(env(safe-area-inset-top,0px) + 50px);bottom:auto}
.nv-full .nv-banner{top:34%}
@media (orientation:landscape) and (max-height:520px){.nv-bottom{flex-direction:row;flex-wrap:wrap;justify-content:center;align-items:center;gap:6px 8px}.nv-comm{flex-basis:100%;font-size:14px}.nv-row{flex-wrap:nowrap}.nv-seg button,.nv-pill{min-height:36px;padding:8px 10px}}
@media (prefers-reduced-motion:reduce){.nv-banner{transition:none}}
.nv-tbtn{position:absolute;top:8px;right:52px;height:36px;padding:0 10px;display:grid;place-items:center;border:1px solid #f4c43088;border-radius:9px;background:#0d1117b0;color:#f4c430;font:700 13px/1 -apple-system,BlinkMacSystemFont,sans-serif;cursor:pointer;touch-action:manipulation;z-index:3}
.nv-full .nv-tbtn{top:calc(env(safe-area-inset-top,0px) + 10px);right:calc(env(safe-area-inset-right,0px) + 62px);height:44px}
.nv-tune{position:absolute;left:50%;top:52px;transform:translateX(-50%);width:min(340px,calc(100% - 20px));max-height:calc(100% - 64px);overflow:auto;z-index:4;background:#0d1117ee;border:1px solid #f4c43066;border-radius:12px;padding:10px 12px;color:#f3f5f7;font:500 14px/1.3 -apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 6px 24px #000a}
.nv-full .nv-tune{top:calc(env(safe-area-inset-top,0px) + 62px)}
.nv-tune h4{margin:0 0 4px;font-size:14px;color:#f4c430}.nv-tune p{margin:0 0 8px;font-size:12px;color:#aab4bf}
.nv-tune .r{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:5px 0;border-top:1px solid #ffffff14}
.nv-tune .r span{flex:1}.nv-tune .r b{min-width:46px;text-align:center;font-variant-numeric:tabular-nums}
.nv-tune button{font:700 16px/1 -apple-system,BlinkMacSystemFont,sans-serif;min-width:40px;min-height:36px;border:1px solid #ffffff30;border-radius:8px;background:#1f2731;color:#f3f5f7;cursor:pointer;touch-action:manipulation}
.nv-rp{position:absolute;inset:0;pointer-events:none;z-index:2;box-shadow:inset 0 0 90px 10px #000b}
.nv-rp-top{position:absolute;top:8px;left:8px;right:56px;max-width:340px;display:flex;flex-direction:column;align-items:flex-start;gap:5px}
.nv-full .nv-rp-top{top:calc(env(safe-area-inset-top,0px) + 14px);left:max(10px,env(safe-area-inset-left,0px));right:calc(env(safe-area-inset-right,0px) + 66px)}
.nv-rp-tag{display:flex;border-radius:5px;overflow:hidden;font:800 12px/1 -apple-system,BlinkMacSystemFont,sans-serif;letter-spacing:.07em;box-shadow:0 2px 8px #0008;white-space:nowrap;max-width:100%}
.nv-rp-tag span{background:#f4c430;color:#0d1117;padding:5px 8px}.nv-rp-tag b{background:#0d1117e0;color:#f4c430;padding:5px 7px;font-variant-numeric:tabular-nums}
.nv-rp-bar{width:100%;height:3px;border-radius:2px;background:#ffffff40;overflow:hidden}.nv-rp-bar i{display:block;height:100%;width:0;background:#f4c430}
.nv-rp-card{position:absolute;left:50%;bottom:16%;transform:translateX(-50%);width:min(380px,calc(100% - 24px));text-align:center;color:#fff;font-family:-apple-system,BlinkMacSystemFont,sans-serif}
.nv-full .nv-rp-card{bottom:calc(env(safe-area-inset-bottom,0px) + 74px)}
.nv-rp-card strong{display:inline-block;transform:skewX(-8deg);background:#f4c430;color:#0d1117;font-weight:900;font-size:clamp(20px,7vw,30px);letter-spacing:.06em;padding:2px 14px;box-shadow:0 3px 12px #0009}
.nv-rp-card em{display:block;margin-top:7px;font-style:normal;font-weight:800;font-size:13px;letter-spacing:.06em;text-transform:uppercase;text-shadow:0 1px 4px #000}
.nv-rp-card span{display:block;margin-top:4px;font-size:14px;font-weight:500;line-height:1.35;text-shadow:0 1px 4px #000;color:#e8edf2}
.nv-rp-skip{position:absolute;right:10px;bottom:10px;pointer-events:auto;font:700 13px/1 -apple-system,BlinkMacSystemFont,sans-serif;color:#f3f5f7;background:#0d1117c4;border:1px solid #ffffff30;border-radius:9px;padding:10px 12px;cursor:pointer;touch-action:manipulation}
.nv-full .nv-rp-skip{bottom:calc(env(safe-area-inset-bottom,0px) + 16px);right:max(10px,env(safe-area-inset-right,0px))}
.nv-replaying .nv-dir,.nv-replaying .nv-who,.nv-replaying .nv-banner,.nv-replaying .career3d-radar,.nv-replaying .nv-bug,.nv-replaying .nv-bottom,.nv-replaying .nv-tbtn,.nv-replaying .nv-tune{visibility:hidden}
.nv-tune .now{color:#2fd17a;font-weight:700}.nv-tune .end{display:flex;gap:8px;justify-content:flex-end;margin-top:8px}.nv-tune .end button{font-size:14px;padding:0 12px}
/* V7.9.12 phone on its side: the picture is short, so the banner (GOL, KORNER…) and the replay's move card sat
   on the action. The banner becomes one small line at the top, the card goes to the bottom-left corner. */
@media (orientation:landscape) and (max-height:520px){
.nv-banner{top:calc(env(safe-area-inset-top,0px) + 34px);transform:translate(-50%,0) skewX(-8deg);font-size:20px;white-space:nowrap;max-width:46vw;overflow:hidden;text-overflow:ellipsis;padding:2px 12px}
.nv-full .nv-banner{top:calc(env(safe-area-inset-top,0px) + 66px)}
.nv-rp-card,.nv-full .nv-rp-card{left:max(12px,env(safe-area-inset-left,0px));bottom:calc(env(safe-area-inset-bottom,0px) + 14px);transform:none;width:min(320px,38vw);text-align:left}
.nv-rp-card strong{font-size:18px;padding:2px 10px}
.nv-rp-card em{font-size:11px;margin-top:5px}
.nv-rp-card span{font-size:12px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
}`;
document.head.append(css);

const surface = document.createElement('div'); surface.className = 'career3d v73pitch';
surface.innerHTML = '<canvas class="career3d-scene" aria-label="Canlı 3D saha"></canvas><canvas class="career3d-radar" width="200" height="130" aria-label="Aynı maçın radarı"></canvas><div class="nv-banner" aria-hidden="true"></div><div class="nv-dir" aria-label="Hücum yönü"><b></b><i>➜</i></div><div class="nv-who" hidden><b></b><span></span></div><div class="nv-loading">3D saha hazırlanıyor…</div><button class="nv-fs" type="button" aria-label="Tam ekran" title="Tam ekran">⤢</button><button class="nv-tbtn" type="button" aria-label="Hız ayarları (geçici)">⚙ Hız</button><div class="nv-tune" hidden></div><div class="nv-rp" hidden><div class="nv-rp-top"><div class="nv-rp-tag"><span>TEKRAR · YILDIZ KAMERASI</span><b></b></div><div class="nv-rp-bar"><i></i></div></div><div class="nv-rp-card"><strong></strong><em></em><span></span></div><button type="button" class="nv-rp-skip">Geç ›</button></div><div class="nv-hud"><div class="nv-bug" aria-label="Skor"><span class="t1"></span><span class="sc"></span><span class="t2"></span><span class="clk"></span></div><div class="nv-bottom"><div class="nv-comm" aria-live="polite"></div><div class="nv-row"><div class="nv-seg" role="group" aria-label="Kamera"><button type="button" data-cam="auto" aria-pressed="true">Otomatik</button><button type="button" data-cam="tv" aria-pressed="false">Yayın</button><button type="button" data-cam="close" aria-pressed="false">Yakın</button><button type="button" data-cam="stand" aria-pressed="false">Tribün</button></div></div><div class="nv-row"><div class="nv-seg" role="group" aria-label="Hız"><button type="button" data-speed="0.5">0.5×</button><button type="button" data-speed="1">1×</button><button type="button" data-speed="2">2×</button></div><button type="button" class="nv-pill" data-act="pause">Duraklat</button><button type="button" class="nv-pill go" data-act="intervene">Müdahale</button></div></div></div><p role="status" hidden></p><div class="pitch-goal-overlay" hidden><img src="assets/atmosphere/fans-neutral.webp" alt="Gol atmosferi"><div class="goal-club-props"></div><strong>GOOOL!</strong><small></small></div>';
const canvas = surface.querySelector('.career3d-scene'), radar = surface.querySelector('.career3d-radar');
const bannerEl = surface.querySelector('.nv-banner'), whoEl = surface.querySelector('.nv-who'), loadingEl = surface.querySelector('.nv-loading'), status = surface.querySelector('[role=status]');
const dirEl = surface.querySelector('.nv-dir');
const rpEl = surface.querySelector('.nv-rp'), rpBar = rpEl.querySelector('.nv-rp-bar i'), rpSpeed = rpEl.querySelector('.nv-rp-tag b'), rpCard = rpEl.querySelector('.nv-rp-card');
rpEl.querySelector('.nv-rp-skip').addEventListener('click', () => { if (rp) rp.t = rp.t1; });
const fsBtn = surface.querySelector('.nv-fs'), hud = surface.querySelector('.nv-hud'), commEl = surface.querySelector('.nv-comm');
// ---------- temporary speed tuning (V7.8 dev; the user sets the real speeds on the phone) ----------
// Saved on this device only. Defaults are the current game: the buttons play at 0.5, 1 and 2,
// players and the ball at their normal pace, the camera at its normal easing, a shot in 0.45 slow motion.
const TUNE_KEY = 'managerstory-nv-tune-v1';
const TUNE_DEF = { s05: 0.5, s1: 1, s2: 2, player: 1, ball: 1, cam: 1, slowmo: 0.45, replay: 0.35 };
const TUNE_ROWS = [['s05', '0.5× tuşu = oyun hızı', 0.05], ['s1', '1× tuşu = oyun hızı', 0.05], ['s2', '2× tuşu = oyun hızı', 0.05], ['player', 'Oyuncu koşu hızı', 0.05], ['ball', 'Top hızı (pas ve şut)', 0.05], ['cam', 'Kamera takip hızı', 0.1], ['slowmo', 'Şut anı ağır çekim', 0.05], ['replay', 'Yıldız tekrarı hızı (0 = kapalı)', 0.05]];
const tune = { ...TUNE_DEF };
try { const saved = JSON.parse(localStorage.getItem(TUNE_KEY) || '{}'); for (const k of Object.keys(TUNE_DEF)) if (Number.isFinite(saved[k])) tune[k] = saved[k]; } catch (e) { /* storage unavailable: defaults */ }
const tuneBtn = surface.querySelector('.nv-tbtn'), tuneEl = surface.querySelector('.nv-tune');
function realSpeed() { const s = M?.speed || 1; return s === 0.5 ? tune.s05 : s === 2 ? tune.s2 : s === 1 ? tune.s1 : s; }
function paintTune() {
  if (tuneEl.hidden) return;
  tuneEl.innerHTML = '<h4>Hız ayarları (geçici)</h4><p>Şu an <span class="now">' + (M?.speed || 1) + '× tuşu → oyun ' + realSpeed().toFixed(2) + '</span>. Değerler bu cihazda saklanır.</p>'
    + TUNE_ROWS.map(([k, label]) => '<div class="r"><span>' + label + '</span><button type="button" data-tk="' + k + '" data-d="-1">−</button><b>' + tune[k].toFixed(2) + '</b><button type="button" data-tk="' + k + '" data-d="1">+</button></div>').join('')
    + '<div class="end"><button type="button" data-tk="reset">Varsayılan</button><button type="button" data-tk="close">Kapat</button></div>';
}
tuneBtn.addEventListener('click', () => { tuneEl.hidden = !tuneEl.hidden; paintTune(); });
tuneEl.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const k = b.dataset.tk;
  if (k === 'close') { tuneEl.hidden = true; return; }
  if (k === 'reset') Object.assign(tune, TUNE_DEF);
  else { const row = TUNE_ROWS.find(r => r[0] === k); if (!row) return; tune[k] = Math.round(Math.min(4, Math.max(k === 'replay' ? 0 : 0.05, tune[k] + Number(b.dataset.d) * row[2])) * 100) / 100; }
  try { localStorage.setItem(TUNE_KEY, JSON.stringify(tune)); } catch (err) { /* storage unavailable */ }
  paintTune();
});
const bugT1 = hud.querySelector('.t1'), bugT2 = hud.querySelector('.t2'), bugSc = hud.querySelector('.sc'), bugClk = hud.querySelector('.clk'), pauseBtn = hud.querySelector('[data-act=pause]');

// ---------- fullscreen broadcast mode ----------
// iPhone Safari has no element fullscreen, so the view covers the screen itself; where the
// Fullscreen API exists it is used as well. The surface lives on <body> while full, so the
// match screen can keep re-rendering underneath.
let full = false, camMode = 'auto';
function setFull(on) {
  if (on === full) return;
  full = on;
  surface.classList.toggle('nv-full', on); document.documentElement.classList.toggle('nv-lock', on);
  fsBtn.textContent = on ? '⤡' : '⤢'; fsBtn.setAttribute('aria-label', on ? 'Küçült' : 'Tam ekran'); fsBtn.title = on ? 'Küçült' : 'Tam ekran';
  if (on) {
    document.body.append(surface);
    try { const r = document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }); r?.catch?.(() => {}); } catch (e) { /* optional */ }
  } else {
    camMode = 'auto'; syncButtons();
    try { if (document.fullscreenElement) document.exitFullscreen?.().catch?.(() => {}); } catch (e) { /* optional */ }
    surface.remove();
    if (typeof changed === 'function' && typeof M !== 'undefined' && M) changed(); else presentation.career3d.mount();
  }
  cut = true;
}
fsBtn.addEventListener('click', () => setFull(!full));
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && full) setFull(false); });
function syncButtons() {
  for (const b of hud.querySelectorAll('[data-cam]')) b.setAttribute('aria-pressed', String(b.dataset.cam === camMode));
  for (const b of hud.querySelectorAll('[data-speed]')) b.setAttribute('aria-pressed', String(Number(b.dataset.speed) === (M?.speed || 1)));
  const p = typeof livePlaybackPaused === 'function' ? livePlaybackPaused() : !!M?.pause;
  pauseBtn.textContent = p ? 'Devam' : 'Duraklat';
}
hud.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || !M) return;
  if (b.dataset.cam) { camMode = b.dataset.cam; cut = true; }
  else if (b.dataset.speed) { setMatchSpeed(Number(b.dataset.speed)); paintTune(); }
  else if (b.dataset.act === 'pause') { const p = typeof livePlaybackPaused === 'function' ? livePlaybackPaused() : M.pause; if (p) resumeLive(); else pauseLive(); }
  else if (b.dataset.act === 'intervene') { setFull(false); decisionsRequested(); }
  syncButtons();
});
function paintHud() {
  const t = teams(), st = typeof currentPitchState === 'function' ? currentPitchState() : null;
  bugT1.textContent = t.home.shortName || t.home.name.slice(0, 3); bugT2.textContent = t.away.shortName || t.away.name.slice(0, 3);
  bugT1.style.background = t.home.primaryColor; bugT1.style.color = t.home.secondaryColor;
  bugT2.style.background = t.away.primaryColor; bugT2.style.color = t.away.secondaryColor;
  bugSc.textContent = (st?.eventScore || [M.hg, M.ag]).join('–');
  bugClk.textContent = typeof clockFromSeconds === 'function' ? clockFromSeconds(st?.displayMatchSeconds ?? matchSecond()) : M.min + "'";
  // the subtitle the view says at the moment it happens (the kick, or the end of a duel); the clock's line until then
  const line = sayLine ?? (typeof liveCommentaryLines === 'function' ? liveCommentaryLines()[0] : '');
  if (commEl.textContent !== line) commEl.textContent = line || '';
  syncButtons();
}
// leave the broadcast view when the match needs the manager's screen
function shouldLeaveFull() {
  if (!M) return true;
  const halfReady = M.reason === 'half' && !presentation.live3d?.halfPending;
  const done = M.finished && !(typeof livePresentationPending === 'function' && livePresentationPending()) && !director?.busy;
  return halfReady || done || M.reason === 'injury' || !!M.requiredSubstitution;
}

let renderer, outline, scene, camera, stadium, assets = null, assetsPromise = null, failed = false;
let match = null, rt = null, director = null, snaps = [], crowd = [], rosterKey = '', lastEvents = 0, wasActive = false, needResync = false;

function fail(error) {
  failed = true; console.warn('Yeni 3D saha', error);
  status.hidden = false; status.textContent = '3D saha açılamadı. 2D görünümü seçerek devam edebilirsiniz.';
  if (typeof M !== 'undefined' && M && M.fieldView === '3d') { M.fieldView = '2d'; changed(); }
}

function initRenderer() {
  if (renderer) return;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  outline = new OutlineEffect(renderer, { defaultThickness: 0.0042, defaultColor: [0.05, 0.06, 0.08] });
  scene = new THREE.Scene(); scene.background = new THREE.Color('#9fb8cf'); scene.fog = new THREE.Fog('#9fb8cf', 90, 220);
  camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400); camera.layers.enable(1);
  stadium = buildStadium({ scene, renderer });
}

function loadAssets() {
  assetsPromise ??= fetch(new URL('../../../assets/models/footballer-rig.json', import.meta.url)).then(r => { if (!r.ok) throw new Error('rig ' + r.status); return r.json(); }).then(data => {
    const rig = loadRig(data), gait = {};
    for (const k of ['walk', 'run', 'sprint']) gait[k] = analyseGait(rig.newInstance().group, rig.clips[k]);
    assets = { rig, gait };
    return assets;
  });
  return assetsPromise;
}

// ---------- ball, numbers ----------
let ballMesh, ballShadow;
function makeBall() {
  const created = createMatchBall({ ramp: stadium.toonRamp, noOutline: stadium.noOutline });
  ballMesh = created.ball; ballShadow = created.shadow;
  scene.add(ballMesh, ballShadow);
}

const numberCache = new Map();
function numberTexture(no, kit) {
  const k = no + kit.number + kit.numberEdge;
  if (numberCache.has(k)) return numberCache.get(k);
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.font = '800 100px "Arial Narrow", "Helvetica Neue", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 10; g.strokeStyle = kit.numberEdge; g.strokeText(String(no), 64, 70); g.fillStyle = kit.number; g.fillText(String(no), 64, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; numberCache.set(k, t); return t;
}

// ---------- engine data (read-only) ----------
function enginePositions() {
  return [...M.active.map(id => [id, 'user']), ...M.oppIds.map(id => [id, 'opp'])]
    .filter(([id, side]) => !(side === 'user' ? M.sentOff?.includes(id) : false))
    .map(([id, side]) => [id, side, eventPoint(id, side)]);
}
// the special moves a player has (pitch-v731.js skillMoves): most players have none
function movesOf(id, side) { try { return typeof skillMoves === 'function' ? skillMoves(id, side).moves : []; } catch { return []; } }
function starsOf(id, side) { try { return typeof skillMoves === 'function' ? skillMoves(id, side).stars : 1; } catch { return 1; } }
function rosterList() {
  const user = M.active.map(id => { const p = S.players.find(x => x.id === id); return { id, side: 'user', name: p?.name ?? String(id), role: M.matchRoles[id], no: p?.number, moves: movesOf(id, 'user'), stars: starsOf(id, 'user') }; });
  const opp = M.oppIds.map((id, i) => { const p = playerAtMarker(id, 'opp'); return { id, side: 'opp', name: p?.name ?? id, role: p?.position ?? (i ? 'CM' : 'GK'), no: i + 1, moves: movesOf(id, 'opp'), stars: starsOf(id, 'opp') }; });
  return [...user, ...opp];
}
function teams() {
  return { home: resolveClubIdentity('goal', { teamId: M.home }), away: resolveClubIdentity('goal', { teamId: M.away }) };
}

// ---------- per match ----------
let banTimer;
function banner(text, ms) { clearTimeout(banTimer); bannerEl.textContent = text; bannerEl.classList.add('on'); banTimer = setTimeout(() => bannerEl.classList.remove('on'), Math.min(ms, 2200)); }
let autoCam = { mode: 'tv', a: null, b: null }, simSlow = 1, cut = true, sayLine = null;
let offLine = null, offLineTimer = null;
function startMatchView() {
  if (rt) for (const p of rt.players) scene.remove(p.model);
  for (const m of crowd) scene.remove(m);
  const t = teams();
  // (each club's flag is split the way its crest is: CLUBSTYLE in app.js)
  const flagOf = name => (typeof CLUBSTYLE !== 'undefined' && CLUBSTYLE[name]?.[2]) || 'v';
  crowd = stadium.buildCrowd(t.home.primaryColor, t.home.secondaryColor, t.away.primaryColor, t.away.secondaryColor, flagOf(M.home), flagOf(M.away)) || [];
  rt = createRuntime({ scene, rig: assets.rig, gait: assets.gait, ramp: stadium.toonRamp, numberTexture, cadence: CADENCE, stride: STRIDE });
  rt.S.tune = tune; sayLine = null;
  replay.clear(); starPending = null; rp = null; lastReplay = -99; rpEl.hidden = true; surface.classList.remove('nv-replaying');
  snaps = [{ n: M.events.length, pl: enginePositions() }];
  const roster = rosterList();
  rosterKey = JSON.stringify(roster.map(r => [r.side, r.id]));
  const fresh = matchSecond() === 0 && M.events.length <= 1;
  director = createDirector(rt, { events: M.events, snaps, meta: { user: roster.filter(r => r.side === 'user'), opp: roster.filter(r => r.side === 'opp'), teams: t, userHome: M.userHome } }, {
    say: (text, e) => { sayLine = (e && typeof presentationEvent === 'function' ? presentationEvent(e).text : text) || sayLine; }, banner: (text, ms) => { if (text !== 'GOL' && text !== 'MAÇ SONU' && text !== 'DEVRE ARASI') banner(text, ms); },
    flash: text => banner(text, 1100),
    // a yellow line across the pitch at the offside line for a couple of seconds
    offsideLine: x => {
      if (!offLine) { offLine = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 68), stadium.noOutline(new THREE.MeshBasicMaterial({ color: '#ffd400', transparent: true, opacity: .9, depthWrite: false }))); offLine.rotation.x = -Math.PI / 2; offLine.position.y = 0.03; scene.add(offLine); }
      offLine.position.x = x; offLine.visible = true; clearTimeout(offLineTimer); offLineTimer = setTimeout(() => { offLine.visible = false; }, 2600);
    }, excite: (v, team) => {
      // V7.9.10 a goal: that team's fans go up and the other end falls quiet (team: 'home' | 'away'; none: both)
      const quiet = Math.min(v, 0.04), home = team === 'away' ? quiet : v, away = team === 'home' ? quiet : v;
      for (const m of [stadium.crowdMat, stadium.flagMat]) { m.uniforms.uExcite.value = home; m.uniforms.uExciteAway.value = away; }
    },
    score() {}, minute() {},
    cam: (mode, a = null, b = null, hard = false) => { autoCam = { mode, a, b }; if (hard) cut = true; },
    slow: s => { simSlow = s < 1 ? tune.slowmo : s; }, whistle() {}, finished() {},
    // a special move: shown again from the star camera once it is over
    star: (a, p, moment) => {
      keepStarMoment(a, p, moment);
      if (!STAR_MOVES[a.kind] || !(tune.replay > 0) || (TEST_SCALE > 1 && !REPLAY_IN_TEST)) return;
      if (rp || starPending || rt.S.t - lastReplay < REPLAY_GAP) return;
      starPending = { kind: a.kind, key: p.key, name: p.name, no: p.no, side: p.side, t: rt.S.t };
    },
  }, { startIndex: fresh ? 0 : M.events.length, debug: TEST_SCALE > 1 || /[?&]nvdebug/.test(location.search) });
  if (!fresh) director.resync(M.ballOwner, M.ballSide, M.ballState?.position);
  lastEvents = M.events.length; match = M; cut = true;
}

// a star moment of one of ours is the career's to keep (core/hooks.js starMoment), whether or not it is replayed
function keepStarMoment(audit, player, moment) {
  if (player.side === 'user' && STAR_MOVES[audit.kind]) starMoment({ move: audit.kind, playerId: player.id, ...moment });
}

// ---------- camera ----------
let broadcast = null;
function updateCamera(dtReal, aspect) {
  let cam = autoCam;
  if (full && camMode !== 'auto') {
    const b = rt.ball.p, near = rt.ball.owner || rt.players.filter(p => !p.offPitch).reduce((m, p) => (!m || p.pos.distanceTo(b) < m.pos.distanceTo(b) ? p : m), null);
    cam = { mode: camMode === 'close' ? 'close' : camMode, a: camMode === 'close' ? near : null, b: null };
  }
  const dev = presentation.newView?.devCam?.(rt); if (dev) cam = dev;     // (development: a held camera for reviews)
  broadcast ||= createBroadcastCamera(camera);
  if (cut) { broadcast.cut(); cut = false; }
  broadcast.update(rt, cam, dtReal * tune.cam, aspect);
  stadium.sun.target.position.copy(broadcast.look); stadium.sun.position.copy(broadcast.look).add(new THREE.Vector3(-30, 60, 40));
}

// ---------- radar ----------
// which way our team attacks, as seen on screen (and on the radar)
const dirA = new THREE.Vector3(), dirB = new THREE.Vector3();
let dirAngle = null;
function userAttackSign() { return typeof attackDirection === 'function' ? (attackDirection('user') >= 0 ? 1 : -1) : (M.userHome ? 1 : -1); }
function paintDirection() {
  const t = teams(), team = M.userHome ? t.home : t.away, s = userAttackSign();
  const b = dirEl.firstChild; b.textContent = team.shortName || team.name.slice(0, 3); b.style.background = team.primaryColor; b.style.color = team.secondaryColor;
  if (!broadcast) return;
  dirA.copy(broadcast.look).setY(0); dirB.copy(dirA).add(new THREE.Vector3(s * 6, 0, 0));
  dirA.project(camera); dirB.project(camera);
  if (dirA.z >= 1 || dirB.z >= 1) return;
  // screen x grows to the right, y downwards (CSS rotate is clockwise)
  let a = Math.atan2(-(dirB.y - dirA.y), (dirB.x - dirA.x) * camera.aspect) * 180 / Math.PI; if (dirAngle != null) { while (a - dirAngle > 180) a -= 360; while (a - dirAngle < -180) a += 360; }
  dirAngle = a; dirEl.lastChild.style.transform = `rotate(${a.toFixed(0)}deg)`;
}
function drawRadar() {
  const c = radar.getContext('2d'), w = 200, h = 130, t = teams();
  c.clearRect(0, 0, w, h); c.strokeStyle = '#d5e2cd'; c.strokeRect(5, 5, w - 10, h - 10); c.beginPath(); c.moveTo(w / 2, 5); c.lineTo(w / 2, h - 5); c.stroke();
  const userTeam = M.userHome ? t.home : t.away, oppTeam = M.userHome ? t.away : t.home;
  const X = x => 5 + (x / 105 + .5) * 190, Y = z => 5 + (z / 68 + .5) * 120;
  for (const p of rt.players) { if (p.offPitch) continue; c.fillStyle = (p.side === 'user' ? userTeam : oppTeam).primaryColor; c.beginPath(); c.arc(X(p.pos.x), Y(p.pos.z), 2.5, 0, Math.PI * 2); c.fill(); c.stroke(); }
  c.fillStyle = 'white'; c.beginPath(); c.arc(X(rt.ball.p.x), Y(rt.ball.p.z), 2, 0, Math.PI * 2); c.fill();
  // our attacking direction: an arrow in our colour along the top edge
  const s = userAttackSign(), cx = w / 2, y = 11; c.fillStyle = userTeam.primaryColor; c.strokeStyle = '#0d1117';
  c.beginPath(); c.moveTo(cx - s * 16, y - 2.5); c.lineTo(cx + s * 8, y - 2.5); c.lineTo(cx + s * 8, y - 6); c.lineTo(cx + s * 17, y); c.lineTo(cx + s * 8, y + 6); c.lineTo(cx + s * 8, y + 2.5); c.lineTo(cx - s * 16, y + 2.5); c.closePath(); c.fill(); c.stroke();
}

// ---------- star replay (V7.9) ----------
// a special move is kept and shown again at once: slowly, from a high close camera, with its name
const REPLAY_PRE = 1.25, REPLAY_POST = 0.9, REPLAY_GAP = 30;
const REPLAY_IN_TEST = /[?&]nvreplay/.test(location.search);
const replay = createReplay(), liveState = createReplay({ frames: 1, minDt: 0 });
let starPending = null, rp = null, lastReplay = -99;
const rpCamPos = new THREE.Vector3(), rpCamLook = new THREE.Vector3(), rpStar = new THREE.Vector3(), rpWant = new THREE.Vector3();
function startReplay() {
  const s = starPending; starPending = null;
  const [a, z] = replay.span(), t0 = Math.max(a, s.t - REPLAY_PRE), t1 = Math.min(z, s.t + REPLAY_POST);
  if (t1 - t0 < 0.8) return;
  liveState.clear(); liveState.record(rt, ballMesh);            // the pitch as it is now, put back afterwards
  rp = { ...s, t0, t1, t: t0, first: true };
  const info = STAR_MOVES[s.kind];
  rpCard.querySelector('strong').textContent = info.name;
  rpCard.querySelector('em').textContent = (s.no != null ? s.no + ' · ' : '') + (s.name || '');
  rpCard.querySelector('span').textContent = info.line;
  rpSpeed.textContent = tune.replay.toFixed(2).replace(/0$/, '') + '×';
  rpEl.hidden = false; surface.classList.add('nv-replaying');
}
function playReplay(dtReal) {
  if (!paused()) rp.t = Math.min(rp.t1, rp.t + dtReal * tune.replay);
  const at = replay.apply(rt, ballMesh, rp.t);
  rpBar.style.width = (100 * (rp.t - rp.t0) / Math.max(1e-3, rp.t1 - rp.t0)).toFixed(1) + '%';
  if (rp.t >= rp.t1) { const ballAt = at.clone(); endReplay(); return ballAt; }
  return at;
}
function endReplay() {
  liveState.apply(rt, ballMesh, 0);
  lastReplay = rt.S.t; rp = null; cut = true;
  rpEl.hidden = true; surface.classList.remove('nv-replaying');
}
function starCamera(dtReal, aspect, ballAt) {
  if (!rp) { updateCamera(dtReal, aspect); return; }
  const tall = aspect < 1.25;
  replay.posOf(rp.key, rp.t, rpStar) || rpStar.copy(ballAt);
  // a ball in the air pulls the picture its way and the camera back a little, so both stay in frame
  // the star and the ball both stay in the picture: a ball played away (a pass, a shot, a chip) widens it
  const up = Math.max(0, ballAt.y - BALL_R), sep = Math.hypot(ballAt.x - rpStar.x, ballAt.z - rpStar.z);
  const pull = Math.max(1 + Math.min(0.6, up * 0.22), (sep * (tall ? 1.9 : 1.1) + 2) / 5.8);
  rpStar.lerp(ballAt.clone().setY(0), sep > 2.5 ? 0.5 : 0.35 + Math.min(0.25, up * 0.12));
  rpWant.copy(rpStar).add(new THREE.Vector3(-1.7 * pull, (tall ? 3.6 : 3.3) * pull, (tall ? 5.0 : 4.4) * pull));
  const k = rp.first ? 1 : 1 - Math.exp(-dtReal * 4);
  rpCamPos.lerp(rpWant, k); rpCamLook.lerp(rpStar.setY(0.6 + Math.min(1.2, up * 0.45)), k); rp.first = false;
  camera.fov = tall ? 50 : 40; camera.aspect = aspect; camera.updateProjectionMatrix();
  camera.position.copy(rpCamPos); camera.lookAt(rpCamLook);
}

// a player standing right in front of a close camera is left out of the picture (a broadcast camera
// would be moved; ours just does not draw him), never the players the shot is about
const occA = new THREE.Vector3(), occF = new THREE.Vector3();
function hideOccluders() {
  const out = [];
  const close = rp || autoCam.mode === 'close' || autoCam.mode === 'shot' || (full && camMode === 'close');
  if (!close || !rt) return out;
  camera.getWorldDirection(occF);
  const keep = new Set([autoCam.a, autoCam.b, rp && rt.players.find(p => p.key === rp.key)].filter(Boolean));
  for (const p of rt.players) {
    if (p.offPitch || !p.model.visible || keep.has(p)) continue;
    occA.copy(p.model.position).setY(1.1).sub(camera.position);
    const d = occA.length();
    if (d < 3.6 && occA.dot(occF) > 0 && occA.dot(occF) / d > Math.cos(0.6)) { p.model.visible = false; out.push(p); }
  }
  return out;
}

// ---------- loop ----------
const ballAxis = new THREE.Vector3();
// automated checks only (?nvtest=N): play N times faster and draw every 10th frame
// running step rate; `?adim=1.05` tries a different one (the preview offers a few to compare)
const CADENCE = Math.min(1.3, Math.max(0.9, Number(new URLSearchParams(location.search).get('adim')) || 1));
// leg opening at jogging pace: 25% more compact than the recorded jog (`?bacak=1` shows the recorded one)
const STRIDE = Math.min(1, Math.max(0.5, Number(new URLSearchParams(location.search).get('bacak')) || 0.75));
// automated picture checks only (?nvfixdt): every frame is 1/60 s whatever the machine manages
const FIXED_DT = /[?&]nvfixdt/.test(location.search) ? 1 / 60 : 0;
const MANUAL = !!FIXED_DT && /[?&]nvmanual/.test(location.search);
let manualTick = false, manualNoDraw = false;
let fastForward = 1;          // (?nvfixdt only) a recording script skips ahead to the moment it wants
const TEST_SCALE = Math.min(20, Math.max(1, Number(new URLSearchParams(location.search).get('nvtest')) || 1));
let last = 0, frameNo = 0, rafId = null;
const paused = () => typeof livePlaybackPaused === 'function' ? livePlaybackPaused() : !!M?.pause;
function isActive() { return !failed && !!assets && !!M && !M.experimental && (M.fieldView === '3d' || full) && surface.isConnected && canvas.clientWidth > 0; }
function frame(now) {
  if (!manualTick) rafId = requestAnimationFrame(frame);
  if (MANUAL && !manualTick) return;          // (?nvmanual) a recording script steps the frames itself
  if (full && shouldLeaveFull()) setFull(false);
  const active = isActive();
  if (!active) { if (wasActive) needResync = true; wasActive = false; last = now; return; }
  if (match !== M) { startMatchView(); needResync = false; }
  // the engine generated a minute: record where everyone stands after it (V7.9.5: before a resync, so a view
  // coming back — after half-time, from 2D — lays the players out where they stand now, not a minute ago)
  if (M.events.length !== lastEvents) { snaps.push({ n: M.events.length, pl: enginePositions(), ball: [...(M.ballState?.position || [50, 50])] }); if (snaps.length > 40) snaps.splice(1, snaps.length - 40); lastEvents = M.events.length; }
  // back from 2D or another tab: the match went on without this view, so start from "now"
  if (needResync) { if (rp) endReplay(); replay.clear(); starPending = null; if (director.index < M.events.length) director.resync(M.ballOwner, M.ballSide, M.ballState?.position); needResync = false; cut = true; }
  wasActive = true;
  const dtReal = FIXED_DT || Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
  const roster = rosterList(), key = JSON.stringify(roster.map(r => [r.side, r.id]));
  if (key !== rosterKey) { director.syncRoster(roster); rosterKey = key; }
  // after the final whistle the view still plays the match's last actions, unless the drain is paused
  const hold = M.finished ? !director.busy || (!!presentation.live3d?.finishing && paused()) : paused();
  // while a star replay plays the match waits (the clock waits for this view)
  const dt = hold || rp ? 0 : dtReal * realSpeed() * simSlow * TEST_SCALE * (FIXED_DT ? fastForward : 1);
  if (dt > 0) {
    const n = Math.max(1, Math.ceil(dt / (1 / 120)));
    for (let i = 0; i < n; i++) { rt.S.t += dt / n; director.update(); for (const p of rt.players) if (!p.offPitch) rt.move(p, dt / n); rt.stepBall(dt / n); rt.contacts(); }
  }
  // the special move is over: show it again
  if (!rp && starPending && rt.S.t >= starPending.t + REPLAY_POST) startReplay();
  const draw = TEST_SCALE === 1 || frameNo % 10 === 0 || rp;
  if (!draw) { frameNo++; return; }
  const b = rt.ball;
  let ballAt = b.p;
  if (rp) ballAt = playReplay(dtReal);
  else {
    for (const p of rt.players) if (!p.offPitch) rt.pose(p, dt);
    ballMesh.position.copy(b.p);
    const sp = Math.hypot(b.v.x, b.v.z);
    if (sp > 0.01 && dt > 0) ballMesh.rotateOnWorldAxis(ballAxis.set(b.v.z, 0, -b.v.x).normalize(), sp * dt / BALL_R);
    if (dt > 0 && (tune.replay > 0)) replay.record(rt, ballMesh);
  }
  ballShadow.position.set(ballAt.x, .012, ballAt.z);
  const hgt = Math.max(0, ballAt.y - BALL_R); ballShadow.scale.setScalar(1 + hgt * .35); ballShadow.material.opacity = .45 / (1 + hgt * 1.4);
  const o = b.owner;
  if (o && !rt.S.dead) {
    const t = teams(), team = o.side === 'user' ? (M.userHome ? t.home : t.away) : (M.userHome ? t.away : t.home);
    whoEl.hidden = false; whoEl.firstChild.textContent = o.no; whoEl.firstChild.style.background = team.primaryColor; whoEl.lastChild.textContent = o.name;
  } else whoEl.hidden = true;
  const now3 = performance.now() / 1000;
  stadium.crowdMat.uniforms.uTime.value = now3; stadium.flagMat.uniforms.uTime.value = now3;
  stadium.updateNets(rt.S.netHit, rt.S.t);
  if ((fastForward > 1 && !rp && frameNo % 30) || manualNoDraw) { frameNo++; return; }      // skipping ahead: bodies posed, picture not drawn
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) renderer.setSize(w, h, false);
  if (rp) starCamera(dtReal, w / Math.max(1, h), ballAt); else updateCamera(dtReal, w / Math.max(1, h));
  const hidden = hideOccluders();
  renderer.render(scene, camera);
  rt.scaleOutlines(camera, canvas.width, canvas.height);
  camera.layers.set(1); outline.renderOutline(scene, camera); camera.layers.enable(0);
  for (const p of hidden) p.model.visible = true;
  if (frameNo++ % 3 === 0) { drawRadar(); paintDirection(); }
  if (full && frameNo % 6 === 0) paintHud();
}

// ---------- the live presentation clock follows this view ----------
const FAST = 6;
presentation.newView = {
  get active() { return isActive() && !!director && match === M; },
  get subtitle() { return sayLine; },
  get busy() { return this.active && director.busy; },
  gate(state) {
    if (!this.active) return null;
    const next = state.active ?? state.queue?.[0];
    const id = next?.eventId;
    if (id == null) return FAST;
    return id > director.progressId ? 0 : FAST;
  },
  get director() { return director; },
  get simTime() { return rt?.S.t ?? 0; },
  get runtime() { return rt; },          // for automated checks
  get replay() { return rp ? { kind: rp.kind, who: rp.key, t: rp.t, t0: rp.t0, t1: rp.t1 } : null; },
  get replayKept() { return replay.count; },
  get starPending() { return starPending; },
  get devScene() { return FIXED_DT ? { renderer, scene, crowd, outline } : null; },
  // (?nvfixdt&nvmanual) draw n frames of 1/60 s now
  step(n = 1, drawLastOnly = false) { if (!MANUAL) return; manualTick = true; try { for (let i = 0; i < n; i++) { manualNoDraw = drawLastOnly && i < n - 1; frame(performance.now()); } } finally { manualTick = false; manualNoDraw = false; } },
  set fastForward(v) { if (FIXED_DT) fastForward = Math.max(1, Number(v) || 1); },
  // where the ball is on screen (-1..1 inside the frame) and where the camera looks: for measuring the camera
  get framing() {
    if (!camera || !rt || !broadcast) return null;
    const v = rt.ball.p.clone().project(camera), d = broadcast.look.clone().sub(broadcast.pos);
    return { x: v.x, y: v.y, front: v.z < 1, mode: autoCam.mode, out: !!rt.ball.out, yaw: Math.atan2(d.x, d.z), pitch: Math.atan2(d.y, Math.hypot(d.x, d.z)), cam: broadcast.pos.toArray() };
  },
};

presentation.view?.subscribe?.(snapshot => {
  if (!snapshot || match !== M || !surface.isConnected) return;
  try { paintPitchGoalFeedback(surface.querySelector('.pitch-goal-overlay'), snapshot.presentation?.goalFeedback); } catch (e) { /* overlay is optional */ }
});

presentation.career3d = {
  // the app re-renders its screen often; a fullscreen view stays where it is
  detach() { if (!full) surface.remove(); },
  get fullscreen() { return full; },
  setFullscreen(on) { setFull(!!on); },
  mount() {
    if (M?.experimental) return;
    if (failed && M?.fieldView === '3d') { M.fieldView = '2d'; changed(); return; }
    if (M?.fieldView === '3d' && presentation.live3d && !presentation.live3d.enabled) { presentation.live3d.enable(); presentation.live3d.setTempo(1); }
    if (full) { if (!M) setFull(false); return; }
    const host = document.querySelector('#career-3d-host'); if (!host) return;
    host.append(surface);
    if (!renderer) { try { initRenderer(); makeBall(); } catch (e) { fail(e); return; } }
    if (!assets) loadAssets().then(() => { loadingEl.hidden = true; }).catch(fail);
    else loadingEl.hidden = true;
    rafId ??= requestAnimationFrame(frame);
  },
  get view() { return null; },
};
canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); fail(new Error('WebGL context lost')); });
presentation.career3d.mount();
