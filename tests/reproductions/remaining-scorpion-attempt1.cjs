const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const measurements = [];
const { keeperScene } = require('../support/keeper-scene.cjs');

for (const heading of [-Math.PI / 2, Math.PI / 2]) test(`scorpion heels reach the actual keeper-plane ball with a fixed root, heading ${heading}`, async () => {
  const scene = await keeperScene({ heading, keeper: { mode: 'set', reactionAt: null, target: null } });
  const { actor, before, ball } = prepareScorpionProbe(scene, heading);
  const heels = ['LeftFoot', 'RightFoot'].map(name => actor.bones[name].getWorldPosition(new scene.THREE.Vector3()));
  const gap = Math.min(...heels.map(heel => heel.distanceTo(ball)));
  measurements.push({ heading, gapMetres: gap, maximumGapMetres: .3, rootX: actor.model.position.x, expectedRootX: scene.sample.position.x,
    heels: heels.map(heel => heel.toArray()), ball: ball.toArray() });
  fs.writeFileSync(path.join(__dirname, 'scorpion-attempt1-contact.json'), JSON.stringify(measurements, null, 2) + '\n');
  assert.ok(gap < .3, `actual scorpion heel gap ${gap}`);
  const head = actor.bones.Head.getWorldPosition(new scene.THREE.Vector3());
  const forward = new scene.THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
  assert.ok(heels.every(heel => heel.clone().sub(head).dot(forward) < 0), 'the folded heels stay behind the head');
  assert.equal(actor.model.position.x, scene.sample.position.x); assert.equal(actor.model.position.z, scene.sample.position.z);
  assert.equal(JSON.stringify(scene.sample), before);
});

function prepareScorpionProbe(scene, heading) {
  const time = 2, actor = scene.draw(time), before = JSON.stringify(scene.sample);
  scene.frame.ball.position = { x: scene.sample.position.x, y: 1.53, z: scene.sample.position.z };
  const ball = new scene.THREE.Vector3().copy(scene.frame.ball.position), body = scene.api.scorpionBody(actor, time);
  body.pos = () => actor.pos.clone();
  actor.flip = body.flip;
  actor.act = { name: 'scorpion', t0: time - scene.api.ACTIONS.scorpion.dur * scene.api.ACTIONS.scorpion.contact };
  scene.api.scorpionLimbs(actor, { T: time, body, F: new scene.THREE.Vector3(Math.sin(heading), 0, Math.cos(heading)) });
  scene.runtime.pose(actor, 0);
  return { actor, before, ball };
}
