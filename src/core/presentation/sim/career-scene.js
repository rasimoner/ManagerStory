import { animateSimulationCrowd } from './scene-atmosphere.js';
import { createSimulationGoalOverlay } from './scene-goal-overlay.js';
import { M } from '../../state.js';
import { presentation } from '../registry.js';
import { changed } from '../../hooks.js';
import { resolveClubIdentity } from '../../clubs/clubs.js';
import { CLUBSTYLE } from '../../clubs/club-style.js';
import { pauseLive, resumeLive, setMatchSpeed } from '../../engine/live-match.js';
import { loadSimulationSceneAssets, createSimulationStage } from './scene-stage.js';
import { createSimulationBallView } from './scene-ball.js';
import { createSimulationActors } from './scene-actors.js';
import { createSimulationCamera } from './scene-camera.js';
import { paintSimulationRadar } from './scene-radar.js';
import { simulationSceneKit } from './scene-kits.js';
import { sampleSimulationScene } from './scene-frame.js';
import { fallbackSimulationView } from './view-status.js';
import SIM_VIEW_DATA from '../../../data/match-sim-view.json';
import { simulationSceneStatus } from './scene-status.js';
import { paintSimulationHud } from './scene-hud.js';
import { simulationSceneCaption } from './scene-event-label.js';
import { createSimulationOffsideLine } from './scene-offside.js';
import './career-scene.css';

const surface = document.createElement('div');
surface.className = 'career3d sim-scene';
surface.dataset.simScene = '';
surface.innerHTML = `<canvas class=career3d-scene aria-label="Yeni motorun canlı 3D sahası"></canvas>
  <canvas class=career3d-radar width=200 height=130 aria-label="Gerçek konumların radarı"></canvas>
  <div class=sim-scene-tools><span class=sim-scene-score><b data-scene-home></b><strong data-scene-score></strong><b data-scene-away></b><time data-scene-clock></time></span><button type=button data-scene-full aria-label="Tam ekran">⤢</button></div>
  <div class=sim-scene-player hidden><b></b><span></span></div><span class=sim-scene-direction hidden></span>
  <div class=sim-scene-cameras role=group aria-label="Kamera"><button type=button data-scene-camera=auto aria-pressed=true>Otomatik</button><button type=button data-scene-camera=tv aria-pressed=false>Yayın</button><button type=button data-scene-camera=close aria-pressed=false>Yakın</button><button type=button data-scene-camera=stand aria-pressed=false>Tribün</button></div>
  <div class=sim-scene-caption aria-live=polite></div><span data-scene-loading>3D saha hazırlanıyor…</span>
  <div class=sim-scene-controls><button type=button data-scene-speed=0.5>0,5×</button><button type=button data-scene-speed=1>1×</button><button type=button data-scene-speed=2>2×</button><button type=button data-scene-pause>Duraklat</button><button type=button data-scene-intervene>Müdahale</button><button type=button data-scene-flat>2D</button></div>`;
const canvas = surface.querySelector('.career3d-scene'), radar = surface.querySelector('.career3d-radar');
let stage, actors, broadcast, match, loading, clubs, lastPaint = null, fullscreen = false, failed = false;
let ballView;
let offsideLine;
let crowd = [], cameraMode = 'auto';
const goalOverlay = createSimulationGoalOverlay(surface);
let sceneWasSkipped = false;
let cameraAnimation = null;

function mount() {
  if (!M?.experimental || M.fieldView !== '3d') { leaveFullscreen(); return; }
  if (failed) { fallbackSimulationView(new Error('3D rendering unavailable')); return; }
  const host = document.querySelector('#sim-3d-host');
  if (!host && !fullscreen) { sceneWasSkipped = true; return; }
  if (!fullscreen) host.replaceChildren(surface);
  if (!stage) {
    loading ??= loadSimulationSceneAssets().then(loaded => {
      stage = createSimulationStage(canvas, loaded);
      offsideLine = createSimulationOffsideLine(stage.scene);
      paintCurrentFrame();
    }).catch(fail);
    return;
  }
  paintCurrentFrame();
}

function paintCurrentFrame() {
  if (M?.experimental) paint(sampleSimulationScene(M.simulationPlayback, { immediate: M.pause || M.finished }));
}

function startSceneMatch() {
  for (const player of stage.runtime.players) stage.scene.remove(player.model);
  for (const mesh of crowd) stage.scene.remove(mesh);
  stage.runtime.players.length = 0;
  match = M;
  clubs = { user: resolveClubIdentity('goal', { teamId: M.userHome ? M.home : M.away }),
    opponent: resolveClubIdentity('goal', { teamId: M.userHome ? M.away : M.home }) };
  crowd = buildSceneCrowd();
  actors = createSimulationActors(stage.runtime, describePlayer);
  ballView = createSimulationBallView(stage.ball, stage.shadow, { runtime: stage.runtime });
  broadcast = createSimulationCamera(stage.camera);
  lastPaint = null;
  sceneWasSkipped = false;
}

function buildSceneCrowd() {
  const home = M.userHome ? clubs.user : clubs.opponent, away = M.userHome ? clubs.opponent : clubs.user;
  return stage.stadium.buildCrowd(home.primaryColor, home.secondaryColor, away.primaryColor, away.secondaryColor,
    CLUBSTYLE[M.home]?.[2] ?? 'v', CLUBSTYLE[M.away]?.[2] ?? 'v');
}

function describePlayer(player) {
  return { key: `${player.teamId}:${player.id}`, id: player.id, side: player.teamId === 'user' ? 'user' : 'opp',
    role: player.slot, no: player.number, keeper: player.slot === 'GK', kit: simulationSceneKit(clubs[player.teamId], player) };
}

function paint(frame) {
  if (!sceneActive()) return;
  try {
    if (match !== M) startSceneMatch();
    if (M.reason === 'half' || M.finished || M.requiredSubstitution) leaveFullscreen();
    if (skipSceneDrawing(frame)) return;
    refocusAfterSkippedScene();
    actors.apply(frame);
    ballView.apply(frame);
    offsideLine.paint(frame);
    animateSimulationCrowd(stage.stadium, frame, M.userHome);
    goalOverlay.paint(frame, clubs);
    paintSceneGeometry(frame);
    paintSimulationRadar(radar, frame, clubs);
    paintSceneLabels(frame);
  } catch (error) { fail(error); }
}

function sceneActive() { return !!stage && !failed && surface.isConnected && M?.experimental && M.fieldView === '3d'; }

function skipSceneDrawing(frame) {
  if (!M.skipExperimental || M.pause || M.finished) return false;
  sceneWasSkipped = true;
  goalOverlay.hide();
  paintSceneLabels(frame);
  return true;
}

function refocusAfterSkippedScene() {
  if (!sceneWasSkipped) return;
  broadcast = createSimulationCamera(stage.camera);
  lastPaint = null;
  sceneWasSkipped = false;
}

function paintSceneGeometry(frame) {
  const width = canvas.clientWidth, height = canvas.clientHeight;
  if (!width || !height) return;
  const now = performance.now(), seconds = lastPaint == null ? 0 : Math.min(SIM_VIEW_DATA.camera.maximumFrameSeconds, (now - lastPaint) / 1000);
  lastPaint = now;
  resizeScene(width, height);
  const look = broadcast.update(frame, seconds, { aspect: width / height, mode: cameraMode });
  surface.dataset.simCameraMode = cameraMode;
  surface.dataset.simCrowdTime = String(stage.stadium.flagMat.uniforms.uTime.value);
  surface.dataset.simCameraFov = stage.camera.fov.toFixed(3);
  surface.dataset.simBallRotation = stage.ball.quaternion.toArray().map(value => value.toFixed(5)).join(',');
  stage.stadium.sun.target.position.copy(look);
  stage.stadium.sun.position.copy(look).add({ x: -30, y: 60, z: 40 });
  stage.runtime.scaleOutlines(stage.camera, stage.renderer.domElement.width, stage.renderer.domElement.height);
  stage.outline.render(stage.scene, stage.camera);
  surface.querySelector('[data-scene-loading]').hidden = true;
}

function resizeScene(width, height) {
  if (stage.width === width && stage.height === height) return;
  stage.renderer.setSize(width, height, false);
  stage.width = width;
  stage.height = height;
}

function paintSceneLabels(frame) {
  const status = simulationSceneStatus(frame);
  surface.classList.toggle('sim-preparing', status.preparing);
  surface.dataset.simTick = String(frame.tick);
  surface.dataset.simPhysicsTime = String(frame.physicsTime);
  surface.dataset.simMatchTime = String(frame.matchTime);
  surface.dataset.simPlayers = String(frame.players.length);
  paintSimulationHud(surface, frame, { match: M, clubs });
  const notice = simulationSceneCaption(frame), event = notice.event;
  const caption = surface.querySelector('.sim-scene-caption');
  caption.textContent = status.preparing ? status.label : M.skipExperimental && !M.pause && !M.finished ? 'Maç hesaplanıyor…'
    : notice.text;
  caption.classList.toggle('sim-scene-goal', event?.type === 'goal');
  surface.querySelector('[data-scene-pause]').textContent = M.pause ? 'Devam et' : 'Duraklat';
}

function setFullscreen(value) {
  fullscreen = value;
  surface.classList.toggle('sim-scene-full', value);
  document.documentElement.classList.toggle('sim-scene-lock', value);
  if (value) document.body.append(surface);
  else { surface.remove(); mount(); }
  paintCurrentFrame();
}

function leaveFullscreen() { if (fullscreen) setFullscreen(false); }
function fail(error) { failed = true; leaveFullscreen(); fallbackSimulationView(error); }

function sceneControl(event) {
  const button = event.target.closest('button');
  if (!button || !M?.experimental) return;
  if (button.dataset.sceneCamera) {
    cameraMode = button.dataset.sceneCamera;
    for (const control of surface.querySelectorAll('[data-scene-camera]')) control.setAttribute('aria-pressed', String(control.dataset.sceneCamera === cameraMode));
    paintCurrentFrame();
    easePausedCamera();
  }
  else if (button.hasAttribute('data-scene-full')) setFullscreen(!fullscreen);
  else if (button.dataset.sceneSpeed) setMatchSpeed(Number(button.dataset.sceneSpeed));
  else handleSceneControl(button);
}

function easePausedCamera() {
  if (!M.pause || !sceneActive()) return;
  if (cameraAnimation != null) cancelAnimationFrame(cameraAnimation);
  const until = performance.now() + SIM_VIEW_DATA.camera.modeTransitionSeconds * 1000;
  surface.dataset.simCameraSettling = 'true';
  const draw = () => {
    if (!M.pause || !sceneActive() || performance.now() >= until) {
      cameraAnimation = null;
      surface.dataset.simCameraSettling = 'false';
      return;
    }
    paintCurrentFrame();
    cameraAnimation = requestAnimationFrame(draw);
  };
  cameraAnimation = requestAnimationFrame(draw);
}

function handleSceneControl(button) {
  if (button.hasAttribute('data-scene-pause')) { if (M.pause) resumeLive(); else pauseLive(); }
  else if (button.hasAttribute('data-scene-intervene')) { leaveFullscreen(); pauseLive(); }
  else if (button.hasAttribute('data-scene-flat')) { M.fieldView = '2d'; leaveFullscreen(); changed(); }
}

surface.addEventListener('click', sceneControl);
canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); fail(new Error('WebGL context lost')); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') leaveFullscreen(); });
globalThis.addEventListener('resize', paintCurrentFrame);
function detach() {
  if (M?.experimental && (M.fieldView !== '3d' || M.activeTab !== 'pitch')) sceneWasSkipped = true;
  if (!fullscreen) surface.remove();
}

presentation.simulation3d = { mount, paint, detach, get fullscreen() { return fullscreen; } };
mount();
