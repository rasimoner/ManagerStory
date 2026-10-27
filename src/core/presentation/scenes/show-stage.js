// The stage a special move is shown on outside a match (the star transfer scene, "İzle"): a WebGL renderer of
// its own for the scene (released when it ends: phones keep little GPU memory), the stadium and its crowd in
// the club's colours, a ball, and the match view's footballer runtime with the director that plays the moves.
import * as THREE from 'three';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';
import { buildStadium } from '../match3d/newview/stadium.js';
import { createRuntime, analyseGait, BALL_R } from '../match3d/newview/runtime.js';
import { loadRig } from '../match3d/newview/rig.js';
import { createDirector } from '../match3d/newview/director.js';
import { stageRoster } from '../match3d/newview/stage-roster.js';
import { CLUBSTYLE } from '../../clubs/club-style.js';

const SKY = '#9fb8cf';
// the visitors on a show stage: plain colours, nobody's club
export const SHOW_VISITORS = { name: 'Rakip', primaryColor: '#55646b', secondaryColor: '#d8dedc', shortName: 'RK' };

let footballers = null;
// the rigged footballer and his walking, running and sprinting gaits (loaded once)
export function loadFootballers() {
  footballers ??= fetch(new URL('../../../assets/models/footballer-rig.json', import.meta.url)).then(r => { if (!r.ok) throw new Error('rig ' + r.status); return r.json(); }).then(data => {
    const rig = loadRig(data), gait = {};
    for (const k of ['walk', 'run', 'sprint']) gait[k] = analyseGait(rig.newInstance().group, rig.clips[k]);
    return { rig, gait };
  });
  return footballers;
}

function ballTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#fbfbfb'; g.fillRect(0, 0, 256, 128); g.fillStyle = '#16181d';
  for (const [x, y] of [[32, 30], [96, 30], [160, 30], [224, 30], [0, 76], [64, 76], [128, 76], [192, 76], [256, 76], [32, 118], [160, 118]]) { g.beginPath(); for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 - Math.PI / 2; g.lineTo(x + Math.cos(a) * 13, y + Math.sin(a) * 11); } g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeBall(scene, stadium) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 24, 16), new THREE.MeshToonMaterial({ map: ballTexture(), gradientMap: stadium.toonRamp }));
  mesh.castShadow = true; mesh.layers.enable(1); scene.add(mesh);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.16, 20), stadium.noOutline(new THREE.MeshBasicMaterial({ color: '#0b1a08', transparent: true, opacity: .45, depthWrite: false })));
  shadow.rotation.x = -Math.PI / 2; scene.add(shadow);
  return { mesh, shadow };
}

// the shirt numbers on the players' backs, one texture per number and kit
export function numberTextureFactory() {
  const cache = new Map();
  return (no, kit) => {
    const k = no + kit.number + kit.numberEdge; if (cache.has(k)) return cache.get(k);
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    g.font = '800 100px "Arial Narrow", "Helvetica Neue", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 10; g.strokeStyle = kit.numberEdge; g.strokeText(String(no), 64, 70); g.fillStyle = kit.number; g.fillText(String(no), 64, 70);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; cache.set(k, t); return t;
  };
}

function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

// (a presentation, not a match: the whole ground is the club's, the visitors' block included)
function fillTheStands(stadium, club) {
  const flag = (typeof CLUBSTYLE !== 'undefined' && CLUBSTYLE[club.name]?.[2]) || 'v';
  return stadium.buildCrowd(club.primaryColor, club.secondaryColor, club.primaryColor, club.secondaryColor, flag, flag) || [];
}

/* The stage on this canvas: { renderer, outline, scene, camera, stadium, crowd, ball }, or null when the device
   has no WebGL (the caller shows something else). */
export function openShowStage(canvas, club) {
  let renderer;
  try { renderer = createRenderer(canvas); } catch { return null; }
  const outline = new OutlineEffect(renderer, { defaultThickness: 0.0042, defaultColor: [0.05, 0.06, 0.08] });
  const scene = new THREE.Scene(); scene.background = new THREE.Color(SKY); scene.fog = new THREE.Fog(SKY, 90, 220);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400); camera.layers.enable(1);
  const stage = { renderer, outline, scene, camera };
  try { stage.stadium = buildStadium({ scene, renderer, boardName: String(club.name || '').toLocaleUpperCase('tr') }); } catch { releaseShowStage(stage); return null; }
  stage.crowd = fillTheStands(stage.stadium, club);
  stage.ball = makeBall(scene, stage.stadium);
  return stage;
}

function disposeMaterial(m) {
  for (const v of Object.values(m)) if (v?.isTexture) v.dispose();
  if (m.uniforms) Object.values(m.uniforms).forEach(u => u.value?.isTexture && u.value.dispose());
  m.dispose?.();
}

// everything the stage put on the GPU goes, the renderer's context with it
export function releaseShowStage(stage) {
  try {
    stage?.scene?.traverse(o => { o.geometry?.dispose?.(); const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; ms.forEach(disposeMaterial); });
    stage?.renderer?.dispose(); stage?.renderer?.forceContextLoss?.();
  } catch (e) { console.warn('3D sahne bırakılırken', e); }
}

// the footballers of the little stage (the star, a team-mate, an opponent and the keepers) and the director
// that stages the move on them; hooks: excite, cam and slow (the rest of a match's hooks do nothing here)
export function stageShow(stage, { assets, player, move, club, hooks }) {
  const rt = createRuntime({ scene: stage.scene, rig: assets.rig, gait: assets.gait, ramp: stage.stadium.toonRamp, numberTexture: numberTextureFactory(), cadence: 1, stride: 0.75 });
  const { user, opp, snaps } = stageRoster(player, move);
  const quiet = () => {};
  const director = createDirector(rt, { events: [], snaps, meta: { user, opp, teams: { home: club, away: SHOW_VISITORS }, userHome: true } }, {
    say: quiet, banner: quiet, flash: quiet, offsideLine: quiet, score: quiet, minute: quiet, whistle: quiet, finished: quiet, star: quiet, ...hooks,
  }, { startIndex: 0 });
  return { rt, director, star: rt.players.find(p => p.side === 'user' && p.id === player.id) };
}

// the ball where the runtime has it, rolling as it moves, and its shadow on the grass
export function drawBall(stage, rt, dt) {
  const b = rt.ball, { mesh, shadow } = stage.ball;
  mesh.position.copy(b.p);
  const sp = Math.hypot(b.v.x, b.v.z);
  if (sp > 0.01 && dt > 0) mesh.rotateOnWorldAxis(new THREE.Vector3(b.v.z, 0, -b.v.x).normalize(), sp * dt / BALL_R);
  shadow.position.set(b.p.x, .012, b.p.z);
  const hgt = Math.max(0, b.p.y - BALL_R); shadow.scale.setScalar(1 + hgt * .35); shadow.material.opacity = .45 / (1 + hgt * 1.4);
}

export function setCrowdExcite(stage, v) { for (const m of [stage.stadium.crowdMat, stage.stadium.flagMat]) m.uniforms.uExcite.value = m.uniforms.uExciteAway.value = v; }

// the canvas at the size it is shown; returns its aspect
export function fitCanvas(stage) {
  const { renderer } = stage, canvas = renderer.domElement, w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) renderer.setSize(w, h, false);
  return w / Math.max(1, h);
}

// the sun follows what the camera looks at (its shadows stay sharp where the eye is)
export function aimSun(stage, look) { stage.stadium.sun.target.position.copy(look); stage.stadium.sun.position.copy(look).add(new THREE.Vector3(-30, 60, 40)); }

// one picture: the crowd and the nets move, the players' outlines keep their width, then the outline pass
export function renderStage(stage, { rt, now }) {
  const { stadium, renderer, scene, camera, outline } = stage, canvas = renderer.domElement;
  const t3 = now / 1000; stadium.crowdMat.uniforms.uTime.value = t3; stadium.flagMat.uniforms.uTime.value = t3;
  stadium.updateNets(rt.S.netHit, rt.S.t);
  rt.scaleOutlines(camera, canvas.width, canvas.height);
  renderer.render(scene, camera);
  camera.layers.set(1); outline.renderOutline(scene, camera); camera.layers.enable(0);
}
