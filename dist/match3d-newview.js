// New 3D match view (since V7.5.0).
// Same MatchEngine, same events, same pause/speed and the same presentation clock as the 2D view.
// This view plays each engine event as football; the existing presentation clock follows it
// (window.ManagerStoryNewView.gate) and the next engine minute is generated only after this view
// has played the current one (window.ManagerStoryNewView.busy).
import * as THREE from './vendor/three/three.module.min.js';
import { OutlineEffect } from './vendor/three/addons/effects/OutlineEffect.js';
import { buildStadium } from './newview/stadium.js';
import { createRuntime, analyseGait, BALL_R } from './newview/runtime.js';
import { loadRig } from './newview/rig.js';
import { createDirector } from './newview/director.js';
import { createBroadcastCamera } from './newview/camera.js';

const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = new URL('./match3d-career.css', import.meta.url); document.head.append(link);
const css = document.createElement('style');
css.textContent = `.nv-banner{position:absolute;left:50%;top:30%;transform:translate(-50%,-50%) skewX(-8deg);font:800 clamp(22px,8vw,40px)/1.1 -apple-system,BlinkMacSystemFont,sans-serif;letter-spacing:.06em;color:#0d1117;background:#f4c430;padding:2px 16px;opacity:0;transition:opacity .25s;pointer-events:none}
.nv-banner.on{opacity:1}
.nv-who{position:absolute;left:8px;bottom:8px;display:flex;font:700 13px/1 -apple-system,BlinkMacSystemFont,sans-serif;letter-spacing:.04em;text-transform:uppercase;border-radius:5px;overflow:hidden;pointer-events:none;box-shadow:0 2px 8px #0006}
.nv-who b{padding:4px 6px;color:#fff;font-variant-numeric:tabular-nums}
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
@media (prefers-reduced-motion:reduce){.nv-banner{transition:none}}`;
document.head.append(css);

const surface = document.createElement('div'); surface.className = 'career3d v73pitch';
surface.innerHTML = '<canvas class="career3d-scene" aria-label="Canlı 3D saha"></canvas><canvas class="career3d-radar" width="200" height="130" aria-label="Aynı maçın radarı"></canvas><div class="nv-banner" aria-hidden="true"></div><div class="nv-who" hidden><b></b><span></span></div><div class="nv-loading">3D saha hazırlanıyor…</div><button class="nv-fs" type="button" aria-label="Tam ekran" title="Tam ekran">⤢</button><div class="nv-hud"><div class="nv-bug" aria-label="Skor"><span class="t1"></span><span class="sc"></span><span class="t2"></span><span class="clk"></span></div><div class="nv-bottom"><div class="nv-comm" aria-live="polite"></div><div class="nv-row"><div class="nv-seg" role="group" aria-label="Kamera"><button type="button" data-cam="auto" aria-pressed="true">Otomatik</button><button type="button" data-cam="tv" aria-pressed="false">Yayın</button><button type="button" data-cam="close" aria-pressed="false">Yakın</button><button type="button" data-cam="stand" aria-pressed="false">Tribün</button></div></div><div class="nv-row"><div class="nv-seg" role="group" aria-label="Hız"><button type="button" data-speed="0.5">0.5×</button><button type="button" data-speed="1">1×</button><button type="button" data-speed="2">2×</button></div><button type="button" class="nv-pill" data-act="pause">Duraklat</button><button type="button" class="nv-pill go" data-act="intervene">Müdahale</button></div></div></div><p role="status" hidden></p><div class="pitch-goal-overlay" hidden><img src="assets/atmosphere/fans-neutral.webp" alt="Gol atmosferi"><div class="goal-club-props"></div><strong>GOOOL!</strong><small></small></div>';
const canvas = surface.querySelector('.career3d-scene'), radar = surface.querySelector('.career3d-radar');
const bannerEl = surface.querySelector('.nv-banner'), whoEl = surface.querySelector('.nv-who'), loadingEl = surface.querySelector('.nv-loading'), status = surface.querySelector('[role=status]');
const fsBtn = surface.querySelector('.nv-fs'), hud = surface.querySelector('.nv-hud'), commEl = surface.querySelector('.nv-comm');
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
    if (typeof render === 'function' && typeof M !== 'undefined' && M) render(); else window.ManagerStoryCareer3D.mount();
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
  else if (b.dataset.speed) setMatchSpeed(Number(b.dataset.speed));
  else if (b.dataset.act === 'pause') { const p = typeof livePlaybackPaused === 'function' ? livePlaybackPaused() : M.pause; if (p) resumeLive(); else pauseLive(); }
  else if (b.dataset.act === 'intervene') { setFull(false); if (typeof openDecisionSheet === 'function') openDecisionSheet(); }
  syncButtons();
});
function paintHud() {
  const t = teams(), st = typeof currentPitchState === 'function' ? currentPitchState() : null;
  bugT1.textContent = t.home.shortName || t.home.name.slice(0, 3); bugT2.textContent = t.away.shortName || t.away.name.slice(0, 3);
  bugT1.style.background = t.home.primaryColor; bugT1.style.color = t.home.secondaryColor;
  bugT2.style.background = t.away.primaryColor; bugT2.style.color = t.away.secondaryColor;
  bugSc.textContent = (st?.eventScore || [M.hg, M.ag]).join('–');
  bugClk.textContent = typeof clockFromSeconds === 'function' ? clockFromSeconds(st?.displayMatchSeconds ?? matchSecond()) : M.min + "'";
  const line = typeof liveCommentaryLines === 'function' ? liveCommentaryLines()[0] : '';
  if (commEl.textContent !== line) commEl.textContent = line || '';
  syncButtons();
}
// leave the broadcast view when the match needs the manager's screen
function shouldLeaveFull() {
  if (!M) return true;
  const halfReady = M.reason === 'half' && !window.ManagerStoryLive3D?.halfPending;
  const done = M.finished && !(typeof livePresentationPending === 'function' && livePresentationPending()) && !director?.busy;
  return halfReady || done || M.reason === 'injury' || !!M.requiredSubstitution;
}

let renderer, outline, scene, camera, stadium, assets = null, assetsPromise = null, failed = false;
let match = null, rt = null, director = null, snaps = [], crowd = [], rosterKey = '', lastEvents = 0, wasActive = false, needResync = false;

function fail(error) {
  failed = true; console.warn('Yeni 3D saha', error);
  status.hidden = false; status.textContent = '3D saha açılamadı. 2D görünümü seçerek devam edebilirsiniz.';
  if (typeof M !== 'undefined' && M && M.fieldView === '3d') { M.fieldView = '2d'; render(); }
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
  assetsPromise ??= fetch(new URL('./assets/models/footballer-rig.json', import.meta.url)).then(r => { if (!r.ok) throw new Error('rig ' + r.status); return r.json(); }).then(data => {
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
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#fbfbfb'; g.fillRect(0, 0, 256, 128); g.fillStyle = '#16181d';
  for (const [x, y] of [[32, 30], [96, 30], [160, 30], [224, 30], [0, 76], [64, 76], [128, 76], [192, 76], [256, 76], [32, 118], [160, 118]]) { g.beginPath(); for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 - Math.PI / 2; g.lineTo(x + Math.cos(a) * 13, y + Math.sin(a) * 11); } g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  ballMesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 24, 16), new THREE.MeshToonMaterial({ map: t, gradientMap: stadium.toonRamp }));
  ballMesh.castShadow = true; ballMesh.layers.enable(1); scene.add(ballMesh);
  ballShadow = new THREE.Mesh(new THREE.CircleGeometry(0.16, 20), stadium.noOutline(new THREE.MeshBasicMaterial({ color: '#0b1a08', transparent: true, opacity: .45, depthWrite: false })));
  ballShadow.rotation.x = -Math.PI / 2; scene.add(ballShadow);
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
const sideOf = id => typeof id === 'string' ? 'opp' : 'user';
function enginePositions() {
  return [...M.active.map(id => [id, 'user']), ...M.oppIds.map(id => [id, 'opp'])]
    .filter(([id, side]) => !(side === 'user' ? M.sentOff?.includes(id) : false))
    .map(([id, side]) => [id, side, eventPoint(id, side)]);
}
function rosterList() {
  const user = M.active.map((id, i) => { const p = S.players.find(x => x.id === id); return { id, side: 'user', name: p?.name ?? String(id), role: M.matchRoles[id], no: p?.number ?? (S.players.indexOf(p) + 1 || i + 1) }; });
  const opp = M.oppIds.map((id, i) => { const p = playerAtMarker(id, 'opp'); return { id, side: 'opp', name: p?.name ?? id, role: p?.position ?? (i ? 'CM' : 'GK'), no: i + 1 }; });
  return [...user, ...opp];
}
function teams() {
  return { home: resolveClubIdentity('goal', { teamId: M.home }), away: resolveClubIdentity('goal', { teamId: M.away }) };
}

// ---------- per match ----------
let banTimer;
function banner(text, ms) { clearTimeout(banTimer); bannerEl.textContent = text; bannerEl.classList.add('on'); banTimer = setTimeout(() => bannerEl.classList.remove('on'), Math.min(ms, 2200)); }
let autoCam = { mode: 'tv', a: null, b: null }, simSlow = 1, cut = true;
function startMatchView() {
  if (rt) for (const p of rt.players) scene.remove(p.model);
  for (const m of crowd) scene.remove(m);
  const t = teams();
  crowd = stadium.buildCrowd(t.home.primaryColor, t.home.secondaryColor, t.away.primaryColor, t.away.secondaryColor) || [];
  rt = createRuntime({ scene, rig: assets.rig, gait: assets.gait, ramp: stadium.toonRamp, numberTexture, cadence: CADENCE, stride: STRIDE });
  snaps = [{ n: M.events.length, pl: enginePositions() }];
  const roster = rosterList();
  rosterKey = JSON.stringify(roster.map(r => [r.side, r.id]));
  const fresh = matchSecond() === 0 && M.events.length <= 1;
  director = createDirector(rt, { events: M.events, snaps, meta: { user: roster.filter(r => r.side === 'user'), opp: roster.filter(r => r.side === 'opp'), teams: t, userHome: M.userHome } }, {
    say() {}, banner: (text, ms) => { if (text !== 'GOL' && text !== 'MAÇ SONU' && text !== 'DEVRE ARASI') banner(text, ms); },
    flash: text => banner(text, 1100), excite: v => { stadium.crowdMat.uniforms.uExcite.value = stadium.flagMat.uniforms.uExcite.value = v; },
    score() {}, minute() {},
    cam: (mode, a = null, b = null, hard = false) => { autoCam = { mode, a, b }; if (hard) cut = true; },
    slow: s => { simSlow = s; }, whistle() {}, finished() {},
  }, { startIndex: fresh ? 0 : M.events.length, debug: TEST_SCALE > 1 || /[?&]nvdebug/.test(location.search) });
  if (!fresh) director.resync(M.ballOwner, M.ballSide, M.ballState?.position);
  lastEvents = M.events.length; match = M; cut = true;
}

// ---------- camera ----------
let broadcast = null;
function updateCamera(dtReal, aspect) {
  let cam = autoCam;
  if (full && camMode !== 'auto') {
    const b = rt.ball.p, near = rt.ball.owner || rt.players.filter(p => !p.offPitch).reduce((m, p) => (!m || p.pos.distanceTo(b) < m.pos.distanceTo(b) ? p : m), null);
    cam = { mode: camMode === 'close' ? 'close' : camMode, a: camMode === 'close' ? near : null, b: null };
  }
  broadcast ||= createBroadcastCamera(camera);
  if (cut) { broadcast.cut(); cut = false; }
  broadcast.update(rt, cam, dtReal, aspect);
  stadium.sun.target.position.copy(broadcast.look); stadium.sun.position.copy(broadcast.look).add(new THREE.Vector3(-30, 60, 40));
}

// ---------- radar ----------
function drawRadar() {
  const c = radar.getContext('2d'), w = 200, h = 130, t = teams();
  c.clearRect(0, 0, w, h); c.strokeStyle = '#d5e2cd'; c.strokeRect(5, 5, w - 10, h - 10); c.beginPath(); c.moveTo(w / 2, 5); c.lineTo(w / 2, h - 5); c.stroke();
  const userTeam = M.userHome ? t.home : t.away, oppTeam = M.userHome ? t.away : t.home;
  const X = x => 5 + (x / 105 + .5) * 190, Y = z => 5 + (z / 68 + .5) * 120;
  for (const p of rt.players) { if (p.offPitch) continue; c.fillStyle = (p.side === 'user' ? userTeam : oppTeam).primaryColor; c.beginPath(); c.arc(X(p.pos.x), Y(p.pos.z), 2.5, 0, Math.PI * 2); c.fill(); c.stroke(); }
  c.fillStyle = 'white'; c.beginPath(); c.arc(X(rt.ball.p.x), Y(rt.ball.p.z), 2, 0, Math.PI * 2); c.fill();
}

// ---------- loop ----------
const ballAxis = new THREE.Vector3();
// automated checks only (?nvtest=N): play N times faster and draw every 10th frame
// running step rate; `?adim=1.05` tries a different one (the preview offers a few to compare)
const CADENCE = Math.min(1.3, Math.max(0.9, Number(new URLSearchParams(location.search).get('adim')) || 1));
// leg opening at jogging pace: 25% more compact than the recorded jog (`?bacak=1` shows the recorded one)
const STRIDE = Math.min(1, Math.max(0.5, Number(new URLSearchParams(location.search).get('bacak')) || 0.75));
const TEST_SCALE = Math.min(20, Math.max(1, Number(new URLSearchParams(location.search).get('nvtest')) || 1));
let last = 0, frameNo = 0, rafId = null;
const paused = () => typeof livePlaybackPaused === 'function' ? livePlaybackPaused() : !!M?.pause;
function isActive() { return !failed && !!assets && !!M && (M.fieldView === '3d' || full) && surface.isConnected && canvas.clientWidth > 0; }
function frame(now) {
  rafId = requestAnimationFrame(frame);
  if (full && shouldLeaveFull()) setFull(false);
  const active = isActive();
  if (!active) { if (wasActive) needResync = true; wasActive = false; last = now; return; }
  if (match !== M) { startMatchView(); needResync = false; }
  // back from 2D or another tab: the match went on without this view, so start from "now"
  if (needResync) { if (director.index < M.events.length) director.resync(M.ballOwner, M.ballSide, M.ballState?.position); needResync = false; cut = true; }
  wasActive = true;
  const dtReal = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
  // the engine generated a minute: record where everyone stands after it
  if (M.events.length !== lastEvents) { snaps.push({ n: M.events.length, pl: enginePositions(), ball: [...(M.ballState?.position || [50, 50])] }); if (snaps.length > 40) snaps.splice(1, snaps.length - 40); lastEvents = M.events.length; }
  const roster = rosterList(), key = JSON.stringify(roster.map(r => [r.side, r.id]));
  if (key !== rosterKey) { director.syncRoster(roster); rosterKey = key; }
  // after the final whistle the view still plays the match's last actions, unless the drain is paused
  const hold = M.finished ? !director.busy || (!!window.ManagerStoryLive3D?.finishing && paused()) : paused();
  const dt = hold ? 0 : dtReal * (M.speed || 1) * simSlow * TEST_SCALE;
  if (dt > 0) {
    const n = Math.max(1, Math.ceil(dt / (1 / 120)));
    for (let i = 0; i < n; i++) { rt.S.t += dt / n; director.update(); for (const p of rt.players) if (!p.offPitch) rt.move(p, dt / n); rt.stepBall(dt / n); rt.contacts(); }
  }
  const draw = TEST_SCALE === 1 || frameNo % 10 === 0;
  if (!draw) { frameNo++; return; }
  for (const p of rt.players) if (!p.offPitch) rt.pose(p, dt);
  const b = rt.ball;
  ballMesh.position.copy(b.p);
  const sp = Math.hypot(b.v.x, b.v.z);
  if (sp > 0.01 && dt > 0) ballMesh.rotateOnWorldAxis(ballAxis.set(b.v.z, 0, -b.v.x).normalize(), sp * dt / BALL_R);
  ballShadow.position.set(b.p.x, .012, b.p.z);
  const hgt = Math.max(0, b.p.y - BALL_R); ballShadow.scale.setScalar(1 + hgt * .35); ballShadow.material.opacity = .45 / (1 + hgt * 1.4);
  const o = b.owner;
  if (o && !rt.S.dead) {
    const t = teams(), team = o.side === 'user' ? (M.userHome ? t.home : t.away) : (M.userHome ? t.away : t.home);
    whoEl.hidden = false; whoEl.firstChild.textContent = o.no; whoEl.firstChild.style.background = team.primaryColor; whoEl.lastChild.textContent = o.name;
  } else whoEl.hidden = true;
  const now3 = performance.now() / 1000;
  stadium.crowdMat.uniforms.uTime.value = now3; stadium.flagMat.uniforms.uTime.value = now3;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) renderer.setSize(w, h, false);
  updateCamera(dtReal, w / Math.max(1, h));
  renderer.render(scene, camera);
  camera.layers.set(1); outline.renderOutline(scene, camera); camera.layers.enable(0);
  if (frameNo++ % 3 === 0) drawRadar();
  if (full && frameNo % 6 === 0) paintHud();
}

// ---------- the live presentation clock follows this view ----------
const FAST = 6;
window.ManagerStoryNewView = {
  get active() { return isActive() && !!director && match === M; },
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
  // where the ball is on screen (-1..1 inside the frame) and where the camera looks: for measuring the camera
  get framing() {
    if (!camera || !rt || !broadcast) return null;
    const v = rt.ball.p.clone().project(camera), d = broadcast.look.clone().sub(broadcast.pos);
    return { x: v.x, y: v.y, front: v.z < 1, mode: autoCam.mode, out: !!rt.ball.out, yaw: Math.atan2(d.x, d.z), pitch: Math.atan2(d.y, Math.hypot(d.x, d.z)), cam: broadcast.pos.toArray() };
  },
};

window.MatchView?.subscribe?.(snapshot => {
  if (!snapshot || match !== M || !surface.isConnected) return;
  try { window.paintPitchGoalFeedback?.(surface.querySelector('.pitch-goal-overlay'), snapshot.presentation?.goalFeedback); } catch (e) { /* overlay is optional */ }
});

window.ManagerStoryCareer3D = {
  // the app re-renders its screen often; a fullscreen view stays where it is
  detach() { if (!full) surface.remove(); },
  get fullscreen() { return full; },
  setFullscreen(on) { setFull(!!on); },
  mount() {
    if (failed && M?.fieldView === '3d') { M.fieldView = '2d'; render(); return; }
    if (M?.fieldView === '3d' && window.ManagerStoryLive3D && !window.ManagerStoryLive3D.enabled) { window.ManagerStoryLive3D.enable(); window.ManagerStoryLive3D.setTempo(1); }
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
window.ManagerStoryCareer3D.mount();
