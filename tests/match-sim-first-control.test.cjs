const test = require('node:test');
const assert = require('node:assert/strict');
const { labFixture, plain } = require('./support/lab.cjs');
const { sceneFixture } = require('./support/simulation-scene.cjs');

function controlledTouch(height) {
  const { api, simulation } = labFixture({ seed: 731 });
  const player = simulation.teams[0].players.at(-1);
  simulation.match.enabled = false;
  simulation.match.phase = 'playing';
  simulation.time = simulation.physicsTime = .1;
  simulation.tick = 1;
  player.position = { x: 0, y: 0 };
  player.velocity = { x: 0, y: 0 };
  player.heading = 0;
  player.attributes.firstTouch = player.attributes.technique = 100;
  const before = { position: { x: .1, y: 0 }, velocity: { x: 3, y: 0 }, height, verticalVelocity: height ? -.5 : 0 };
  const after = api.predictSimulationBall(before, .1);
  Object.assign(simulation.ball, after, { ownerId: null, carry: null, flight: null });
  api.controlSimulationBall(simulation, { player, previous: player.position, fraction: 1 }, { before, after });
  return { api, simulation, player, touching: after };
}

for (const [height, kind] of [[.5, 'foot'], [1.2, 'chest'], [1.75, 'head']]) {
  test(`${kind} control keeps the real contact point and descends over physical time`, () => {
    const { api, simulation, player, touching } = controlledTouch(height);
    const event = simulation.events.find(event => event.type === 'firstTouch');
    assert.equal(event.kind, kind);
    assert.equal(simulation.ball.ownerId, player.id);
    assert.equal(simulation.ball.height, touching.height);
    assert.deepEqual(plain(simulation.ball.position), plain(touching.position));
    const rng = simulation.rngState;
    for (let index = 0; index < 20; index++) {
      const previous = simulation.ball.height;
      simulation.time += .05;
      api.followSimulationBallOwner(simulation);
      assert.ok(simulation.ball.height <= previous);
      assert.ok(previous - simulation.ball.height < .4);
      assert.ok(Math.hypot(simulation.ball.position.x - player.position.x, simulation.ball.position.y - player.position.y) <= api.MATCH_SIM_DATA.ball.controlRadius);
    }
    assert.equal(simulation.ball.height, 0);
    assert.equal(simulation.ball.control, null);
    assert.equal(simulation.rngState, rng);
  });
}

test('ground possession changes keep contact coordinates and converge without a foot-offset teleport', () => {
  const { api, simulation, player, touching } = controlledTouch(0);
  assert.deepEqual(plain(simulation.ball.position), plain(touching.position));
  const before = plain(simulation.ball);
  api.followSimulationBallOwner(simulation);
  assert.deepEqual(plain(simulation.ball), before, 'drawing or following the same instant is idempotent');
  simulation.time += .05;
  api.followSimulationBallOwner(simulation);
  assert.ok(Math.abs(simulation.ball.position.x - touching.position.x) < .1);
  assert.equal(simulation.ball.ownerId, player.id);
});

test('an airborne receiver cannot erase height by selecting a pass, carry or shot before landing', () => {
  for (const selected of ['pass', 'dribble', 'shot']) {
    const { api, simulation, player } = controlledTouch(1.2);
    simulation.ownerDecision.selected = selected;
    const rng = simulation.rngState;
    api.finishSimulationOwnerStep(simulation);
    assert.throws(() => api.requestSimulationShot(simulation), /foot ball/);
    assert.ok(simulation.ball.height > 1);
    assert.equal(simulation.ball.ownerId, player.id);
    assert.equal(simulation.ball.shot, null);
    assert.equal(simulation.ball.carry, null);
    assert.equal(simulation.rngState, rng);
  }
});

test('chest and head contacts select distinct old rig animations without moving roots or ball', async () => {
  const fixture = await sceneFixture();
  for (const [kind, height] of [['chest', 1.2], ['head', 1.7]]) {
    const frame = { physicsTime: height, players: [{ id: 1, teamId: 'home', number: 9, slot: 'ST', position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 }, heading: 0, keeper: {}, duel: {} }],
    ball: { position: { x: 0, y: height + .11, z: .35 }, velocity: { x: 0, y: 0, z: 0 }, ownerId: 1 },
    contacts: [{ type: 'firstTouch', time: height, toId: 1, height, kind, success: true }] };
    const before = JSON.stringify(frame);
    fixture.actors.apply(frame);
    const actor = fixture.runtime.players[0];
    assert.equal(kind === 'head' ? actor.motion?.name : actor.act?.name, kind === 'head' ? 'header' : 'chest');
    assert.equal(actor.pos.x, 0);
    assert.equal(actor.pos.z, 0);
    assert.equal(JSON.stringify(frame), before);
  }
});
