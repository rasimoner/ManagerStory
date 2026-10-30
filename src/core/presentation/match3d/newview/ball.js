import * as THREE from 'three';
import { BALL_R } from './runtime.js';

// The same panel pattern, physical radius and contact shadow in both renderers.
export function createMatchBall({ ramp, noOutline }) {
  const texture = createBallTexture();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 24, 16), new THREE.MeshToonMaterial({ map: texture, gradientMap: ramp }));
  ball.castShadow = true;
  ball.layers.enable(1);
  const material = noOutline(new THREE.MeshBasicMaterial({ color: '#0b1a08', transparent: true, opacity: .45, depthWrite: false }));
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.16, 20), material);
  shadow.rotation.x = -Math.PI / 2;
  return { ball, shadow };
}

function createBallTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 128;
  const paint = canvas.getContext('2d');
  paint.fillStyle = '#fbfbfb'; paint.fillRect(0, 0, 256, 128); paint.fillStyle = '#16181d';
  for (const [x, y] of [[32, 30], [96, 30], [160, 30], [224, 30], [0, 76], [64, 76], [128, 76], [192, 76], [256, 76], [32, 118], [160, 118]]) {
    paint.beginPath();
    for (let corner = 0; corner < 5; corner++) {
      const angle = corner / 5 * Math.PI * 2 - Math.PI / 2;
      paint.lineTo(x + Math.cos(angle) * 13, y + Math.sin(angle) * 11);
    }
    paint.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
