// New 3D match view (V7.5.0 development).
// Same MatchEngine, same events, same pause/speed and the same presentation clock as the 2D view.
// This view plays each engine event as football; the existing presentation clock follows it
// (window.ManagerStoryNewView.gate) and the next engine minute is generated only after this view
// has played the current one (window.ManagerStoryNewView.busy).
import * as THREE from './vendor/three/three.module.min.js';
import { GLTFLoader } from './vendor/three/addons/loaders/GLTFLoader.js';
import { OutlineEffect } from './vendor/three/addons/effects/OutlineEffect.js';
import { buildStadium } from './newview/stadium.js';
import { createRuntime, analyseGait, BALL_R } from './newview/runtime.js';
import { createDirector } from './newview/director.js';

const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = new URL('./match3d-career.css', import.meta.url); document.head.append(link);
const css = document.createElement('style');
css.textContent = `.nv-banner{position:absolute;left:50%;top:30%;transform:translate(-50%,-50%) skewX(-8deg);font:800 clamp(22px,8vw,40px)/1.1 -apple-system,BlinkMacSystemFont,sans-serif;letter-spacing:.06em;color:#0d1117;background:#f4c430;padding:2px 16px;opacity:0;transition:opacity .25s;pointer-events:none}
.nv-banner.on{opacity:1}
.nv-who{position:absolute;left:8px;bottom:8px;display:flex;font:700 13px/1 -apple-system,BlinkMacSystemFont,sans-serif;letter-spacing:.04em;text-transform:uppercase;border-radius:5px;overflow:hidden;pointer-events:none;box-shadow:0 2px 8px #0006}
.nv-who b{padding:4px 6px;color:#fff;font-variant-numeric:tabular-nums}
.nv-who span{padding:4px 8px;background:#0d1117c8;color:#f3f5f7}
.nv-loading{position:absolute;inset:0;display:grid;place-items:center;color:#cfe0d3;font:600 14px -apple-system,BlinkMacSystemFont,sans-serif;background:#10251a}`;
document.head.append(css);

const surface = document.createElement('div'); surface.className = 'career3d v73pitch';
surface.innerHTML = '<canvas class="career3d-scene" aria-label="Canlı 3D saha"></canvas><canvas class="career3d-radar" width="200" height="130" aria-label="Aynı maçın radarı"></canvas><div class="nv-banner" aria-hidden="true"></div><div class="nv-who" hidden><b></b><span></span></div><div class="nv-loading">3D saha hazırlanıyor…</div><p role="status" hidden></p><div class="pitch-goal-overlay" hidden><img src="assets/atmosphere/fans-neutral.webp" alt="Gol atmosferi"><div class="goal-club-props"></div><strong>GOOOL!</strong><small></small></div>';
const canvas = surface.querySelector('.career3d-scene'), radar = surface.querySelector('.career3d-radar');
const bannerEl = surface.querySelector('.nv-banner'), whoEl = surface.querySelector('.nv-who'), loadingEl = surface.querySelector('.nv-loading'), status = surface.querySelector('[role=status]');

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
  assetsPromise ??= fetch(new URL('./assets/models/xbot.json', import.meta.url)).then(r => { if (!r.ok) throw new Error('model ' + r.status); return r.json(); }).then(j => {
    const bin = atob(j.glb), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Promise((res, rej) => new GLTFLoader().parse(bytes.buffer, './', res, rej));
  }).then(gltf => {
    const clips = {}; for (const c of gltf.animations) clips[c.name] = c;
    assets = { source: gltf.scene, clips, gait: { walk: analyseGait(gltf.scene, clips.walk), run: analyseGait(gltf.scene, clips.run) } };
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
  rt = createRuntime({ scene, source: assets.source, clips: assets.clips, gait: assets.gait, ramp: stadium.toonRamp, numberTexture });
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
  }, { startIndex: fresh ? 0 : M.events.length });
  if (!fresh) director.resync(M.ballOwner, M.ballSide, M.ballState?.position);
  lastEvents = M.events.length; match = M; cut = true;
}

// ---------- camera ----------
const camPos = new THREE.Vector3(-8, 12, 26), camLook = new THREE.Vector3(), wantPos = new THREE.Vector3(), wantLook = new THREE.Vector3();
let wantFov = 46;
function shot(mode, aspect) {
  const b = rt.ball.p, tall = aspect < 1.25, { a, b: o } = autoCam;
  if (mode === 'close' && a && o) {
    const d = o.pos.clone().sub(a.pos).setY(0); if (d.lengthSq() < 1e-4) d.set(1, 0, 0); d.normalize();
    const side = new THREE.Vector3(-d.z, 0, d.x); if (side.z < 0) side.negate();
    wantPos.copy(a.pos).addScaledVector(d, -4.8).addScaledVector(side, 2.6).setY(2.0);
    wantLook.copy(a.pos).lerp(o.pos, 0.55).setY(0.8); wantFov = tall ? 52 : 40;
  } else if (mode === 'close' && a) {
    wantPos.copy(a.pos).add(new THREE.Vector3(-Math.sign(a.pos.x || 1) * 4.5, 2.6, 6.5)); wantLook.copy(a.pos).setY(1.1); wantFov = tall ? 50 : 38;
  } else if (mode === 'shot' && a) {
    const gx = Math.sign(o ? o.pos.x : a.pos.x || 1) * 52.5, g = new THREE.Vector3(gx, 0, 0).sub(a.pos).setY(0).normalize();
    const side = new THREE.Vector3(-g.z, 0, g.x); if (side.z < 0) side.negate();
    wantPos.copy(a.pos).addScaledVector(g, -5.4).addScaledVector(side, 1.6).setY(2.0); wantLook.copy(a.pos).addScaledVector(g, 9).setY(1.0); wantFov = tall ? 54 : 42;
  } else if (mode === 'stand') {
    const sx = Math.sign(b.x || 1), sz = Math.sign(b.z || -1);
    wantPos.set(sx * 68, 24, sz * 56); wantLook.set(sx * 50.5, 1, sz * 31); wantFov = tall ? 46 : 36;
  } else {
    const back = tall ? 19 : 30, z = Math.min(b.z + back, 45), lift = b.z + back - z;
    wantPos.set(b.x - 2, (tall ? 10.5 : 14) + lift * 0.9, z); wantLook.set(b.x + 2, 0, b.z - 2); wantFov = tall ? 46 : 34;
  }
}
function updateCamera(dtReal, aspect) {
  shot(autoCam.mode, aspect);
  const k = 1 - Math.exp(-dtReal * (autoCam.mode === 'stand' ? 1.8 : autoCam.mode === 'shot' ? 2.4 : 3));
  if (cut || camPos.distanceTo(wantPos) > 30) { camPos.copy(wantPos); camLook.copy(wantLook); camera.fov = wantFov; cut = false; }
  else { camPos.lerp(wantPos, k); camLook.lerp(wantLook, k); camera.fov += (wantFov - camera.fov) * k; }
  camera.aspect = aspect; camera.updateProjectionMatrix();
  camera.position.copy(camPos); camera.lookAt(camLook);
  stadium.sun.target.position.copy(camLook); stadium.sun.position.copy(camLook).add(new THREE.Vector3(-30, 60, 40));
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
const TEST_SCALE = Math.min(20, Math.max(1, Number(new URLSearchParams(location.search).get('nvtest')) || 1));
let last = 0, frameNo = 0, rafId = null;
const paused = () => typeof livePlaybackPaused === 'function' ? livePlaybackPaused() : !!M?.pause;
function isActive() { return !failed && !!assets && !!M && M.fieldView === '3d' && surface.isConnected && canvas.clientWidth > 0; }
function frame(now) {
  rafId = requestAnimationFrame(frame);
  const active = isActive();
  if (!active) { if (wasActive) needResync = true; wasActive = false; last = now; return; }
  if (match !== M) { startMatchView(); needResync = false; }
  // back from 2D or another tab: the match went on without this view, so start from "now"
  if (needResync) { if (director.index < M.events.length) director.resync(M.ballOwner, M.ballSide, M.ballState?.position); needResync = false; cut = true; }
  wasActive = true;
  const dtReal = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
  // the engine generated a minute: record where everyone stands after it
  if (M.events.length !== lastEvents) { snaps.push({ n: M.events.length, pl: enginePositions() }); if (snaps.length > 40) snaps.splice(1, snaps.length - 40); lastEvents = M.events.length; }
  const roster = rosterList(), key = JSON.stringify(roster.map(r => [r.side, r.id]));
  if (key !== rosterKey) { director.syncRoster(roster); rosterKey = key; }
  const hold = paused() || (M.finished && !window.ManagerStoryLive3D?.finishing && !director.busy);
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
};

window.MatchView?.subscribe?.(snapshot => {
  if (!snapshot || match !== M || !surface.isConnected) return;
  try { window.paintPitchGoalFeedback?.(surface.querySelector('.pitch-goal-overlay'), snapshot.presentation?.goalFeedback); } catch (e) { /* overlay is optional */ }
});

window.ManagerStoryCareer3D = {
  detach() { surface.remove(); },
  mount() {
    if (failed && M?.fieldView === '3d') { M.fieldView = '2d'; render(); return; }
    if (M?.fieldView === '3d' && window.ManagerStoryLive3D && !window.ManagerStoryLive3D.enabled) { window.ManagerStoryLive3D.enable(); window.ManagerStoryLive3D.setTempo(1); }
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
