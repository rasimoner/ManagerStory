const test = require('node:test');
const assert = require('node:assert/strict');
const { skillFixture } = require('../support/ground-skills.cjs');
const { sceneFixture } = require('../support/simulation-scene.cjs');
const { loadGame } = require('../support/game.cjs');
const { plain } = require('../support/lab.cjs');

for (const kind of ['nutmeg', 'flairnutmeg']) for (const direction of [-1, 1]) {
  test(`${kind} passes physically between the real jockey boots, direction ${direction}`, async () => {
    const result = await traceNutmeg({ kind, direction });
    assert.equal(result.crossed, true, 'a named nutmeg needs a real passage rather than a normal cut');
    assert.ok(result.simulation.events.some(e => e.type === 'skill' && e.kind === kind && !e.observed));
    if (kind === 'flairnutmeg') assert.equal(result.heel, true, 'the backward-facing heel makes the actual touch');
  });
}

async function traceNutmeg({ kind, direction }) {
  const fixture = skillFixture(direction), { api, simulation, owner, defender } = fixture;
  const scene = await sceneFixture(), game = loadGame({ quiet: true });
  defender.position.y = 0; defender.target = { ...defender.position }; defender.motionMode = 'jockey';
  defender.duel.state = 'jockey'; defender.duel.nextPlanTick = 10;
  defender.heading = direction < 0 ? 0 : Math.PI;
  assert.equal(api.beginSimulationGroundSkill(simulation, owner, { kind, defenderId: defender.id }), true);
  const result = { crossed: false, heel: false, previous: null, simulation };
  for (let tick = 0; tick < 45; tick++) {
    api.stepSimulation(simulation);
    const actors = drawNutmeg(fixture, { scene, game });
    if (!simulation.ball.carry?.skill) break;
    observeNutmegGap(result, fixture, actors);
    if (simulation.ball.carry?.touchTick === simulation.tick && kind === 'flairnutmeg') {
      const foot = actors.attacker.bones.RightFoot.getWorldPosition(new scene.THREE.Vector3());
      result.heel = foot.distanceTo(actors.ball) < .3 && Math.cos(owner.heading) * direction < -.7;
    }
  }
  return result;
}

function drawNutmeg({ api, simulation, owner, defender }, { scene, game }) {
  const before = plain(api.snapshotSimulation(simulation));
  const frame = game.api.sampleSimulationScene({ frame: game.api.captureSimulationFrame(simulation) }, { immediate: true }); scene.actors.apply(frame);
  assert.deepEqual(plain(api.snapshotSimulation(simulation)), before);
  const actor = scene.runtime.players.find(p => p.id === defender.id);
  return { attacker: scene.runtime.players.find(p => p.id === owner.id), ball: new scene.THREE.Vector3().copy(frame.ball.position),
    left: actor.bones.LeftToeBase.getWorldPosition(new scene.THREE.Vector3()), right: actor.bones.RightToeBase.getWorldPosition(new scene.THREE.Vector3()) };
}

function observeNutmegGap(result, { simulation, defender, direction }, { ball, left, right }) {
  const relative = (ball.x - defender.position.x) * direction;
  if (result.previous < 0 && relative >= 0 && simulation.ball.height < .25) {
    assert.ok(ball.z > Math.min(left.z, right.z) && ball.z < Math.max(left.z, right.z), 'the actual ball crosses the actual boot gap');
    assert.notEqual(simulation.ball.ownerId, defender.id); result.crossed = true;
  }
  result.previous = relative;
}
