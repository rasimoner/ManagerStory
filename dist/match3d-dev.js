import { Scene, PerspectiveCamera, WebGLRenderer, REVISION } from './vendor/three/three.module.min.js';

// Stage 1 diagnostic only. No football geometry, simulated players or second clock.
const panel = document.createElement('section');
panel.setAttribute('aria-label', '3D development diagnostic');
panel.style.cssText = 'position:fixed;bottom:8px;left:8px;z-index:9999;width:240px;padding:8px;background:#16242eed;color:white';
const status = document.createElement('output');
const close = document.createElement('button');
close.textContent = '3D hazırlığını kapat';
panel.append(status, close);
document.body.append(panel);
let renderer, unsubscribe = () => {};
function dispose() {
  unsubscribe();
  renderer?.dispose();
  renderer?.forceContextLoss();
  panel.remove();
  window.removeEventListener('pagehide', dispose);
}
close.addEventListener('click', dispose);
window.addEventListener('pagehide', dispose, { once: true });
try {
  renderer = new WebGLRenderer({ antialias: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(224, 96);
  panel.prepend(renderer.domElement);
  const scene = new Scene();
  const camera = new PerspectiveCamera(45, 224 / 96, 0.1, 500);
  camera.position.set(0, 40, 65); // Elevated sideline; final framing is Stage 2.
  camera.lookAt(0, 0, 0);
  const paint = snapshot => {
    status.textContent = `Three r${REVISION} / WebGL2 hazır · ${snapshot ? snapshot.matchSeconds.toFixed(1) + ' sn · ' + snapshot.players.length + ' oyuncu' : 'maç yok'} · Aşama 1`;
    renderer.render(scene, camera);
  };
  unsubscribe = window.MatchView.subscribe(paint);
  paint(window.MatchView.read());
} catch (error) {
  renderer?.dispose();
  status.textContent = '3D hazırlığı açılamadı; radar ile devam edilebilir.';
  console.warn('3D development diagnostic unavailable', error);
}
