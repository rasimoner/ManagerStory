const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScene } = require('./support/simulation-scene.cjs');

test('actual stand backings fill crowd gaps from the pitch without painting dark undersides over the grass', async () => {
  const api = await loadScene(), THREE = await import('three'), scene = new THREE.Scene();
  const context = new Proxy({}, { get: (target, property) => target[property] ?? (() => {}) });
  global.document = { createElement: () => ({ getContext: () => context }) };
  try {
    const stadium = api.buildStadium({ scene, renderer: { capabilities: { getMaxAnisotropy: () => 1 } } });
    scene.updateMatrixWorld(true);
    const backings = [];
    scene.traverse(mesh => { if (mesh.material?.color?.getHexString() === '232a36') backings.push(mesh); });
    assert.equal(backings.length, 4);
    for (const mesh of backings) assertBackingVisibility(THREE, mesh);
    assert.equal(stadium.flagMat.side, THREE.DoubleSide, 'flags still wave visibly from both sides');
  } finally { delete global.document; }
});

function assertBackingVisibility(THREE, mesh) {
  const center = mesh.localToWorld(new THREE.Vector3()), normal = new THREE.Vector3(0, 0, 1).transformDirection(mesh.matrixWorld);
  const front = new THREE.Raycaster(center.clone().addScaledVector(normal, 2), normal.clone().negate());
  const behind = new THREE.Raycaster(center.clone().addScaledVector(normal, -2), normal.clone());
  assert.ok(front.intersectObject(mesh, false).length > 0, 'crowd-facing backing remains solid');
  assert.equal(behind.intersectObject(mesh, false).length, 0, 'a camera beneath the stand must see grass, not its dark reverse');
}
