// Yıldız transfer sahnesi (3D): out of the tunnel in front of a full stand, then his best special move.
// A small stage of its own, built from the match view's pieces (stadium, crowd, footballer runtime and the
// director that plays the special moves): the star, one team-mate, one opponent and the keepers. Its own
// WebGL renderer is created for the scene and released when it ends (phones keep little GPU memory).
import * as THREE from './vendor/three/three.module.min.js';
import { OutlineEffect } from './vendor/three/addons/effects/OutlineEffect.js';
import { buildStadium } from './newview/stadium.js';
import { createRuntime, analyseGait, BALL_R, V } from './newview/runtime.js';
import { loadRig } from './newview/rig.js';
import { createDirector } from './newview/director.js';
import { createBroadcastCamera } from './newview/camera.js';

// timings (seconds): the whole scene stays short on a phone
export const TIMES = { walk: 5.6, cheer: 2.2, fade: 0.35, showMax: 12, after: 1.6, closing: 4, cap: 40 };
const TUNNEL_Z = 37.4, TUNNEL_BLACK = 38.7, WALK_FROM = 41.2, WALK_TO = 31;

const css = `.sts{position:fixed;inset:0;z-index:1200;background:#0b0f14;overflow:hidden;touch-action:none}
.sts canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.sts-fade{position:absolute;inset:0;background:#000;opacity:1;transition:opacity .35s;pointer-events:none}
.sts-fade.off{opacity:0}
.sts-vig{position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 90px 12px #000a}
.sts-top{position:absolute;left:max(12px,env(safe-area-inset-left,0px));top:calc(env(safe-area-inset-top,0px) + 12px);display:flex;border-radius:5px;overflow:hidden;font:800 12px/1 -apple-system,BlinkMacSystemFont,sans-serif;letter-spacing:.08em;box-shadow:0 2px 8px #0008}
.sts-top span{background:#f4c430;color:#0d1117;padding:6px 9px}.sts-top b{background:#0d1117e0;color:#f4c430;padding:6px 8px}
.sts-card{position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 9%);transform:translateX(-50%);width:min(400px,calc(100% - 24px));text-align:center;color:#fff;font-family:-apple-system,BlinkMacSystemFont,sans-serif;opacity:0;transition:opacity .4s,transform .4s;pointer-events:none}
.sts-card.on{opacity:1}
.sts-card strong{display:inline-block;transform:skewX(-8deg);background:#f4c430;color:#0d1117;font-weight:900;font-size:clamp(20px,7vw,30px);letter-spacing:.05em;padding:2px 14px;box-shadow:0 3px 12px #0009;text-transform:uppercase}
.sts-card em{display:block;margin-top:7px;font-style:normal;font-weight:800;font-size:15px;letter-spacing:.06em;text-shadow:0 1px 4px #000}
.sts-card em i{font-style:normal;color:#f4c430}
.sts-card span{display:block;margin-top:4px;font-size:14px;font-weight:500;text-shadow:0 1px 4px #000;color:#e8edf2}
.sts-close{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(340px,calc(100% - 32px));background:#0d1117ee;border:1px solid #f4c43088;border-radius:14px;padding:16px;color:#f3f5f7;text-align:center;font-family:-apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 8px 30px #000b}
.sts-close small{color:#f4c430;font-weight:800;letter-spacing:.1em}.sts-close h3{margin:6px 0 4px;font-size:19px}.sts-close p{margin:0 0 12px;color:#aab4bf;font-size:13px}
.sts-close button{font:700 15px/1 -apple-system,BlinkMacSystemFont,sans-serif;min-height:44px;padding:0 18px;border-radius:10px;border:1px solid #ffffff30;background:#1f2731;color:#f3f5f7;cursor:pointer;touch-action:manipulation}
.sts-close i{display:block;height:3px;margin-top:12px;border-radius:2px;background:#ffffff26;overflow:hidden}.sts-close i b{display:block;height:100%;width:100%;background:#f4c430;transform-origin:left;transition:transform linear}
.sts-load{position:absolute;inset:0;display:grid;place-items:center;color:#cfe0d3;font:600 15px -apple-system,BlinkMacSystemFont,sans-serif;background:#10251a}
@media (prefers-reduced-motion:reduce){.sts-fade,.sts-card{transition:none}}`;

let rigPromise = null;
function loadAssets() {
  rigPromise ??= fetch(new URL('./assets/models/footballer-rig.json', import.meta.url)).then(r => { if (!r.ok) throw new Error('rig ' + r.status); return r.json(); }).then(data => {
    const rig = loadRig(data), gait = {};
    for (const k of ['walk', 'run', 'sprint']) gait[k] = analyseGait(rig.newInstance().group, rig.clips[k]);
    return { rig, gait };
  });
  return rigPromise;
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const roleOf = pos => { const r = String(pos || '').split('/')[0]; return ['GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST', 'CF'].includes(r) ? r : 'CAM'; };

// the roster of the little stage: who stands where (engine percentages) before the move is set up
export function stageRoster(player, move) {
  const star = { id: player.id, name: player.name, role: player.keeper ? 'GK' : roleOf(player.pos), no: player.no, moves: [move], stars: 5 };
  const user = player.keeper
    ? [star, { id: 990101, name: 'Takım arkadaşı', role: 'CB', no: 4, moves: [] }, { id: 990102, name: 'Takım arkadaşı', role: 'CM', no: 8, moves: [] }]
    : [star, { id: 990101, name: 'Takım arkadaşı', role: 'CM', no: 8, moves: [] }, { id: 990102, name: 'Kaleci', role: 'GK', no: 1, moves: [] }];
  const opp = player.keeper
    ? [{ id: 'st1', name: 'Rakip', role: 'ST', moves: [] }, { id: 'st2', name: 'Rakip', role: 'CB', moves: [] }, { id: 'st3', name: 'Rakip kaleci', role: 'GK', moves: [] }]
    : [{ id: 'st1', name: 'Rakip', role: 'CB', moves: [] }, { id: 'st2', name: 'Rakip', role: 'CM', moves: [] }, { id: 'st3', name: 'Rakip kaleci', role: 'GK', moves: [] }];
  const home = { GK: [5, 50], CB: [30, 45], CM: [44, 38], CAM: [55, 55], ST: [62, 52] };
  const at = (r, side) => {
    if (r.role === 'GK') return side === 'user' ? [4, 50] : [96, 50];
    if (r === star) return [52, 56];
    if (side === 'opp') return r.role === 'CB' ? [72, 50] : [60, 30];
    return home[r.role] || [44, 40];
  };
  const pl = [...user.map(r => [r.id, 'user', at(r, 'user')]), ...opp.map(r => [r.id, 'opp', at(r, 'opp')])];
  return { user, opp, snaps: [{ n: 1, pl, ball: [50, 50] }] };
}

// takes the seats out of the stand where the tunnel goes, so no fan sits inside it
export function clearTunnelSeats(meshes) {
  let n = 0;
  for (const m of meshes || []) {
    const a = m?.geometry?.attributes?.aPos; if (!a) continue;
    for (let i = 0; i < a.count; i++) {
      const x = a.getX(i), y = a.getY(i), z = a.getZ(i);
      if (Math.abs(x) < 2.8 && z > TUNNEL_Z && z < 48 && y < 3.8) { a.setY(i, -80); n++; }
    }
    a.needsUpdate = true;
  }
  return n;
}

function buildTunnel(scene, stadium, club) {
  const g = new THREE.Group();
  // inside the mouth it is dark: a short dark passage ending in black just before the stand's backing
  // (which would show through a deeper tunnel); he comes out of that black
  const dark = stadium.noOutline(new THREE.MeshBasicMaterial({ color: '#07090c', side: THREE.DoubleSide }));
  const depth = TUNNEL_BLACK - TUNNEL_Z;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 3.1), stadium.noOutline(new THREE.MeshBasicMaterial({ color: '#000000' }))); back.rotation.y = Math.PI; back.position.set(0, 1.55, TUNNEL_BLACK); g.add(back);
  for (const x of [-2.2, 2.2]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(depth, 3.0), dark); w.rotation.y = Math.PI / 2; w.position.set(x, 1.5, TUNNEL_Z + depth / 2); g.add(w); }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(4.4, depth), dark); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 3.0, TUNNEL_Z + depth / 2); g.add(ceil);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(4.4, depth + 0.1), stadium.noOutline(new THREE.MeshBasicMaterial({ color: '#15191f' }))); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0.02, TUNNEL_Z + depth / 2); g.add(floor);
  const wallMat = stadium.noOutline(new THREE.MeshToonMaterial({ color: '#232a36', gradientMap: stadium.toonRamp }));
  for (const [w, h, x, y] of [[6, 4.6, -5.2, 2.3], [6, 4.6, 5.2, 2.3], [4.4, 1.6, 0, 3.8]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 1.2), wallMat); b.position.set(x, y, TUNNEL_Z + 0.6); b.receiveShadow = true; g.add(b);
  }
  const clubMat = new THREE.MeshToonMaterial({ color: club.primaryColor, gradientMap: stadium.toonRamp });
  for (const x of [-2.35, 2.35]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.1, 0.4), clubMat); p.position.set(x, 1.55, TUNNEL_Z - 0.05); p.castShadow = true; p.layers.enable(1); g.add(p); }
  // the club's name over the mouth
  const c = document.createElement('canvas'); c.width = 512; c.height = 96; const x2 = c.getContext('2d');
  x2.fillStyle = club.primaryColor; x2.fillRect(0, 0, 512, 96); x2.fillStyle = club.secondaryColor; x2.fillRect(0, 84, 512, 12);
  x2.font = '900 52px "Arial Narrow", "Helvetica Neue", Arial, sans-serif'; x2.textAlign = 'center'; x2.textBaseline = 'middle'; x2.fillText(String(club.name || '').toLocaleUpperCase('tr'), 256, 44, 490);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 0.95), stadium.noOutline(new THREE.MeshBasicMaterial({ map: t }))); sign.rotation.y = Math.PI; sign.position.set(0, 3.55, TUNNEL_Z - 0.03); g.add(sign);
  scene.add(g);
  return g;
}

function makeBall(scene, stadium) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#fbfbfb'; g.fillRect(0, 0, 256, 128); g.fillStyle = '#16181d';
  for (const [x, y] of [[32, 30], [96, 30], [160, 30], [224, 30], [0, 76], [64, 76], [128, 76], [192, 76], [256, 76], [32, 118], [160, 118]]) { g.beginPath(); for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 - Math.PI / 2; g.lineTo(x + Math.cos(a) * 13, y + Math.sin(a) * 11); } g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 24, 16), new THREE.MeshToonMaterial({ map: t, gradientMap: stadium.toonRamp }));
  mesh.castShadow = true; mesh.layers.enable(1); scene.add(mesh);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.16, 20), stadium.noOutline(new THREE.MeshBasicMaterial({ color: '#0b1a08', transparent: true, opacity: .45, depthWrite: false })));
  shadow.rotation.x = -Math.PI / 2; scene.add(shadow);
  return { mesh, shadow };
}
function numberTextureFactory() {
  const cache = new Map();
  return (no, kit) => {
    const k = no + kit.number + kit.numberEdge; if (cache.has(k)) return cache.get(k);
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    g.font = '800 100px "Arial Narrow", "Helvetica Neue", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 10; g.strokeStyle = kit.numberEdge; g.strokeText(String(no), 64, 70); g.fillStyle = kit.number; g.fillText(String(no), 64, 70);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; cache.set(k, t); return t;
  };
}

/* opts: { player:{id,name,no,pos,keeper}, move, moveName, stars, excite (0..1), club:{name,primaryColor,secondaryColor,shortName}, closing, trial }
   resolves { closed:true } after the closing note, { done:true } without it, or null when 3D is not available */
export function playStarTransferScene(opts) {
  return new Promise(resolve => {
    const root = document.createElement('div'); root.className = 'sts';
    root.innerHTML = `<style>${css}</style><canvas aria-label="Yıldız transfer sahnesi"></canvas><div class="sts-vig"></div><div class="sts-top"><span>SAHAYA ÇIKIŞ</span><b>${esc(opts.club.shortName || '')}</b></div>
<div class="sts-card"><strong>${esc(opts.player.name)}</strong><em>#${esc(opts.player.no)} • <i>${'★'.repeat(opts.stars || 4)}</i></em><span>${esc(opts.club.name)} taraftarı yeni yıldızını selamlıyor</span></div>
<div class="sts-fade"></div><div class="sts-load">Tribünler doluyor…</div>`;
    document.body.append(root); document.documentElement.classList.add('nv-lock');
    const canvas = root.querySelector('canvas'), fadeEl = root.querySelector('.sts-fade'), cardEl = root.querySelector('.sts-card'), topEl = root.querySelector('.sts-top span'), loadEl = root.querySelector('.sts-load');
    let renderer = null, raf = null, finished = false;
    const finish = result => {
      if (finished) return; finished = true;
      if (raf) cancelAnimationFrame(raf);
      try {
        scene?.traverse(o => { o.geometry?.dispose?.(); const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; for (const m of ms) { for (const v of Object.values(m)) if (v?.isTexture) v.dispose(); m.uniforms && Object.values(m.uniforms).forEach(u => u.value?.isTexture && u.value.dispose()); m.dispose?.(); } });
        renderer?.dispose(); renderer?.forceContextLoss?.();
      } catch (e) { /* releasing is best effort */ }
      document.documentElement.classList.remove('nv-lock'); root.remove();
      resolve(result);
    };
    let scene;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    } catch (e) { finish(null); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace;
    const outline = new OutlineEffect(renderer, { defaultThickness: 0.0042, defaultColor: [0.05, 0.06, 0.08] });
    scene = new THREE.Scene(); scene.background = new THREE.Color('#9fb8cf'); scene.fog = new THREE.Fog('#9fb8cf', 90, 220);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400); camera.layers.enable(1);
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); finish(null); });
    let stadium;
    try { stadium = buildStadium({ scene, renderer, boardName: String(opts.club.name || '').toLocaleUpperCase('tr') }); } catch (e) { finish(null); return; }
    const opp = { name: 'Rakip', primaryColor: '#55646b', secondaryColor: '#d8dedc', shortName: 'RK' };
    const crowd = stadium.buildCrowd(opts.club.primaryColor, opts.club.secondaryColor, opp.primaryColor, opp.secondaryColor) || [];
    clearTunnelSeats(crowd);
    buildTunnel(scene, stadium, opts.club);
    const ballObj = makeBall(scene, stadium);

    loadAssets().then(assets => {
      if (finished) return;
      const rt = createRuntime({ scene, rig: assets.rig, gait: assets.gait, ramp: stadium.toonRamp, numberTexture: numberTextureFactory(), cadence: 1, stride: 0.75 });
      const { user, opp: oppRoster, snaps } = stageRoster(opts.player, opts.move);
      let autoCam = { mode: 'tv', a: null, b: null }, simSlow = 1, excite = 0.2;
      const director = createDirector(rt, { events: [], snaps, meta: { user, opp: oppRoster, teams: { home: opts.club, away: opp }, userHome: true } }, {
        say() {}, banner() {}, flash() {}, offsideLine() {}, score() {}, minute() {}, whistle() {}, finished() {}, star() {},
        excite: v => { excite = Math.max(excite, v); },
        // (the far TV picture is for matches: here the camera stays close on the move)
        cam: (mode, a = null, b = null, hard = false) => { autoCam = mode === 'tv' ? { mode: 'close', a: star, b: null } : { mode, a, b }; if (hard) cut = true; },
        slow: s => { simSlow = s < 1 ? 0.5 : 1; },
      }, { startIndex: 0 });
      const star = rt.players.find(p => p.side === 'user' && p.id === opts.player.id);
      const broadcast = createBroadcastCamera(camera);
      let cut = true, phase = 'walk', phaseT = 0, total = 0, last = performance.now();
      const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), wantPos = new THREE.Vector3(), wantLook = new THREE.Vector3();
      const setExcite = v => { stadium.crowdMat.uniforms.uExcite.value = stadium.flagMat.uniforms.uExcite.value = v; };

      // walk: only the star, from the dark of the tunnel onto the grass, towards the camera
      for (const p of rt.players) p.model.visible = p === star;
      ballObj.mesh.visible = ballObj.shadow.visible = false;
      rt.place(star, V(0.6, 0, WALK_FROM), Math.PI);
      const walkSpeed = (WALK_FROM - WALK_TO) / TIMES.walk;
      star.drive = { pos: t => V(0.6 - Math.min(1, (t - t0) / TIMES.walk) * 0.9, 0, Math.max(WALK_TO, WALK_FROM - (t - t0) * walkSpeed)), heading: () => Math.PI };
      const t0 = rt.S.t;
      loadEl.remove();
      requestAnimationFrame(() => fadeEl.classList.add('off'));

      function startShow() {
        phase = 'show'; phaseT = 0;
        star.drive = null;
        for (const p of rt.players) p.model.visible = true;
        ballObj.mesh.visible = ballObj.shadow.visible = true;
        const ok = director.stage(opts.move);
        rt.S.t += 1 / 120; director.update();          // the stage is set before the picture comes back
        const other = rt.players.find(p => p.side === 'opp' && p.role !== 'GK');
        const gk = rt.players.find(p => p.side === 'user' && p.role === 'GK');
        autoCam = opts.player.keeper ? (opts.move === 'scorpion' ? { mode: 'side', a: other, b: gk } : { mode: 'close', a: gk, b: null }) : { mode: 'close', a: star, b: other };
        cut = true; topEl.textContent = 'GÖSTERİ';
        cardEl.querySelector('span').textContent = opts.moveName || '';
        cardEl.classList.add('on');
        if (!ok) phase = 'after';
        fadeEl.classList.add('off');
      }
      function startClosing() {
        phase = 'closing'; phaseT = 0; cardEl.classList.remove('on');
        if (!opts.closing) { finish({ done: true }); return; }
        const box = document.createElement('div'); box.className = 'sts-close';
        box.innerHTML = `<small>KAPANIŞ</small><h3>Kariyer highlight arşivine eklendi</h3><p>${esc(opts.player.name)} • ${esc(opts.moveName || '')}${opts.trial ? ' (deneme: arşive yazılmadı)' : ''}</p><button type="button">Atla ›</button><i><b></b></i>`;
        root.append(box);
        box.querySelector('button').addEventListener('click', () => finish({ closed: true }));
        const bar = box.querySelector('i b'); bar.style.transitionDuration = TIMES.closing + 's'; requestAnimationFrame(() => { bar.style.transform = 'scaleX(0)'; });
      }

      function frame(now) {
        if (finished) return;
        raf = requestAnimationFrame(frame);
        const dtReal = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
        total += dtReal; phaseT += dtReal;
        if (total > TIMES.cap) { finish(opts.closing ? { closed: true } : { done: true }); return; }
        let dt = dtReal;
        if (phase === 'walk') {
          rt.S.t += dt; rt.move(star, dt);
          const out = star.pos.z < TUNNEL_Z - 0.4;
          if (out && !cardEl.classList.contains('on')) cardEl.classList.add('on');
          excite += ((out ? opts.excite : 0.2) - excite) * Math.min(1, dt * 1.5); setExcite(excite);
          // the camera walks backwards in front of him, the stand rising behind: first wide on the tunnel's
          // dark mouth (never inside it), closing in as he comes out onto the grass
          const k = Math.min(1, phaseT / TIMES.walk), e = k * k * (3 - 2 * k), d = 13.5 - 7 * e;
          wantPos.set(star.pos.x + 2.2 + e * 0.8, 2.5 - e * 0.9, star.pos.z - d);
          wantLook.set(star.pos.x * 0.6, 1.9 - e * 0.5, star.pos.z + 0.6);
          if (phaseT >= TIMES.walk) { phase = 'cheer'; phaseT = 0; star.drive = null; rt.place(star, star.pos.clone(), Math.PI); rt.startMotion(star, 'cheer'); excite = Math.min(1, opts.excite + 0.15); setExcite(excite); }
        } else if (phase === 'cheer') {
          rt.S.t += dt; rt.move(star, dt);
          // a slow turn round him while he greets the stand
          const a = phaseT / TIMES.cheer * 0.9;
          wantPos.set(star.pos.x + Math.sin(0.35 + a) * 7.2, 1.6 + phaseT * 0.25, star.pos.z - Math.cos(0.35 + a) * 7.2);
          wantLook.set(star.pos.x, 1.3, star.pos.z + 0.5);
          if (phaseT >= TIMES.cheer) { phase = 'fade'; phaseT = 0; fadeEl.classList.remove('off'); cardEl.classList.remove('on'); }
        } else if (phase === 'fade') {
          dt = 0;
          if (phaseT >= TIMES.fade) startShow();
        } else if (phase === 'show' || phase === 'after') {
          dt = dtReal * simSlow;
          const n = Math.max(1, Math.ceil(dt / (1 / 120)));
          for (let i = 0; i < n; i++) { rt.S.t += dt / n; director.update(); for (const p of rt.players) if (!p.offPitch) rt.move(p, dt / n); rt.stepBall(dt / n); rt.contacts(); }
          setExcite(Math.max(opts.excite, Math.min(1, excite)));
          if (phase === 'show' && (!director.tryDebug.staged || phaseT > TIMES.showMax)) { phase = 'after'; phaseT = 0; simSlow = 1; rt.startMotion(star, 'cheer'); autoCam = { mode: 'close', a: star, b: null }; setExcite(1); }
          else if (phase === 'after' && phaseT > TIMES.after) startClosing();
        } else if (phase === 'closing') {
          dt = 0;
          if (phaseT >= TIMES.closing) finish({ closed: true });
        }
        // draw
        for (const p of rt.players) if (!p.offPitch && p.model.visible) rt.pose(p, dt);
        const b = rt.ball;
        ballObj.mesh.position.copy(b.p);
        const sp = Math.hypot(b.v.x, b.v.z);
        if (sp > 0.01 && dt > 0) ballObj.mesh.rotateOnWorldAxis(new THREE.Vector3(b.v.z, 0, -b.v.x).normalize(), sp * dt / BALL_R);
        ballObj.shadow.position.set(b.p.x, .012, b.p.z);
        const hgt = Math.max(0, b.p.y - BALL_R); ballObj.shadow.scale.setScalar(1 + hgt * .35); ballObj.shadow.material.opacity = .45 / (1 + hgt * 1.4);
        const t3 = now / 1000; stadium.crowdMat.uniforms.uTime.value = t3; stadium.flagMat.uniforms.uTime.value = t3;
        stadium.updateNets(rt.S.netHit, rt.S.t);
        const w = canvas.clientWidth, h = canvas.clientHeight;
        if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) renderer.setSize(w, h, false);
        const aspect = w / Math.max(1, h);
        if (phase === 'walk' || phase === 'cheer') {
          if (cut) { camPos.copy(wantPos); camLook.copy(wantLook); cut = false; }
          camPos.lerp(wantPos, Math.min(1, dtReal * 4)); camLook.lerp(wantLook, Math.min(1, dtReal * 5));
          camera.fov = aspect < 1 ? 58 : 44; camera.aspect = aspect; camera.updateProjectionMatrix();
          camera.position.copy(camPos); camera.lookAt(camLook);
          stadium.sun.target.position.copy(camLook); stadium.sun.position.copy(camLook).add(new THREE.Vector3(-30, 60, 40));
        } else if (phase !== 'fade') {
          if (cut) { broadcast.cut(); cut = false; }
          broadcast.update(rt, autoCam, dtReal, aspect);
          stadium.sun.target.position.copy(broadcast.look); stadium.sun.position.copy(broadcast.look).add(new THREE.Vector3(-30, 60, 40));
        }
        renderer.render(scene, camera);
        camera.layers.set(1); outline.renderOutline(scene, camera); camera.layers.enable(0);
      }
      raf = requestAnimationFrame(frame);
      // automated checks only: where the scene is
      window.ManagerStoryStarScene = { get phase() { return phase; }, get total() { return total; }, get star() { return star && { x: star.pos.x, z: star.pos.z, no: star.no }; }, get excite() { return stadium.crowdMat.uniforms.uExcite.value; }, skipToEnd: () => finish({ closed: true }) };
    }).catch(e => { console.warn('Yıldız sahnesi', e); finish(null); });
  });
}
