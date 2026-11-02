const test = require('node:test');
const assert = require('node:assert/strict');
const { skillFixture } = require('./support/ground-skills.cjs');
const { sceneFixture } = require('./support/simulation-scene.cjs');
const { loadGame } = require('./support/game.cjs');
const { plain } = require('./support/lab.cjs');

for (const kind of ['nutmeg']) for (const direction of [-1, 1]) {
  test(`${kind} passes physically between the real jockey boots, direction ${direction}`, async () => {
    const result = await traceNutmeg({ kind, direction });
    assert.equal(result.crossed, true, 'a named nutmeg needs a real passage rather than a normal cut');
    assert.ok(result.simulation.events.some(e => e.type === 'skill' && e.kind === kind && !e.observed));
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

test('the leg channel blocks a ball aimed at an actual boot and permits only the open central gap', () => {
  for (const lateral of [0, .4]) {
    const { api, simulation, owner, defender } = skillFixture();
    defender.position.y = 0; defender.heading = Math.PI; defender.motionMode = 'jockey'; defender.duel.tackle = null;
    api.beginSimulationGroundSkill(simulation, owner, { kind: 'nutmeg', defenderId: defender.id });
    simulation.ball.ownerId = null; api.captureSimulationPlayerPositions(simulation);
    const before = { position: { x: 31.5, y: lateral }, velocity: { x: 18, y: 0 }, height: 0, verticalVelocity: 0 };
    const after = api.predictSimulationBall(before, .1);
    const contact = api.earliestSimulationBallContact(simulation, { before, after });
    if (lateral === 0) assert.equal(contact, null);
    else assert.equal(contact?.player.id, defender.id, 'a special move has no immunity from a boot collision');
  }
});

test('a mid-nutmeg save keeps the real leg contest, outcome and RNG identical', () => {
  const { api, simulation, owner, defender } = skillFixture();
  defender.position.y = 0; defender.target = { ...defender.position }; defender.heading = Math.PI;
  defender.duel.nextPlanTick = 10; defender.motionMode = 'jockey';
  api.beginSimulationGroundSkill(simulation, owner, { kind: 'nutmeg', defenderId: defender.id });
  for (let tick = 0; tick < 4; tick++) api.stepSimulation(simulation);
  const restored = api.restoreSimulation(JSON.parse(JSON.stringify(api.snapshotSimulation(simulation))));
  for (let tick = 0; tick < 40; tick++) { api.stepSimulation(simulation); api.stepSimulation(restored); }
  assert.deepEqual(plain(api.readSimulation(restored)), plain(api.readSimulation(simulation)));
});
