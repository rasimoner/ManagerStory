import * as THREE from 'three';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';
import { buildStadium } from '../match3d/newview/stadium.js';
import { loadRig } from '../match3d/newview/rig.js';
import { createRuntime, analyseGait, BALL_R } from '../match3d/newview/runtime.js';
import SIM_VIEW_DATA from '../../../data/match-sim-view.json';

let assets;

export function loadSimulationSceneAssets() {
  assets ??= fetch(new URL('../../../assets/models/footballer-rig.json', import.meta.url)).then(response => {
    if (!response.ok) throw new Error(`Footballer rig: ${response.status}`);
    return response.json();
  }).then(data => {
    const rig = loadRig(data), gait = {};
    for (const name of ['walk', 'run', 'sprint']) gait[name] = analyseGait(rig.newInstance().group, rig.clips[name]);
    return { rig, gait };
  });
  return assets;
}

export function createSimulationStage(canvas, loaded) {
  const settings = SIM_VIEW_DATA.renderer, renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, settings.maximumPixelRatio));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(46, 1, 0.1, 400);
  scene.background = new THREE.Color(settings.background);
  scene.fog = new THREE.Fog(settings.background, settings.fogNear, settings.fogFar);
  camera.layers.enable(1);
  const stadium = buildStadium({ scene, renderer });
  const runtime = createRuntime({ scene, ...loaded, ramp: stadium.toonRamp, numberTexture: simulationNumberTexture, stride: SIM_VIEW_DATA.pose.stride });
  const ball = createSceneBall(stadium.toonRamp);
  scene.add(ball);
  const outline = new OutlineEffect(renderer, { defaultThickness: settings.outlineThickness, defaultColor: [0.05, 0.06, 0.08] });
  return { scene, camera, renderer, stadium, runtime, ball, outline };
}

function simulationNumberTexture(number, kit) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const paint = canvas.getContext('2d');
  paint.font = '800 100px "Arial Narrow", "Helvetica Neue", Arial, sans-serif';
  paint.textAlign = 'center'; paint.textBaseline = 'middle'; paint.lineWidth = 10;
  paint.strokeStyle = kit.numberEdge; paint.strokeText(String(number), 64, 70);
  paint.fillStyle = kit.number; paint.fillText(String(number), 64, 70);
  return new THREE.CanvasTexture(canvas);
}

function createSceneBall(ramp) {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 128;
  const paint = canvas.getContext('2d');
  paint.fillStyle = '#fafafa'; paint.fillRect(0, 0, 256, 128);
  paint.fillStyle = '#15171c';
  for (const [x, y] of [[32, 30], [96, 30], [160, 30], [224, 30], [0, 76], [64, 76], [128, 76], [192, 76], [256, 76], [32, 118], [160, 118]]) {
    paint.beginPath();
    for (let corner = 0; corner < 5; corner++) { const angle = corner / 5 * Math.PI * 2 - Math.PI / 2; paint.lineTo(x + Math.cos(angle) * 13, y + Math.sin(angle) * 11); }
    paint.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 24, 16), new THREE.MeshToonMaterial({ map: texture, gradientMap: ramp }));
  ball.castShadow = true; ball.layers.enable(1);
  return ball;
}
