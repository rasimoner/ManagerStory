const test = require('node:test');
const assert = require('node:assert/strict');
const { plain } = require('./support/lab.cjs');

const { skillFixture } = require('./support/ground-skills.cjs');

const moves = ['stepover', 'elastico', 'cruyff', 'croqueta', 'roulette', 'dragBack'];
for (const kind of moves) for (const direction of [-1, 1]) {
  test(`${kind} has its own real contact sequence and returns to normal play, direction ${direction}`, () => {
    const { api, simulation, owner, defender } = skillFixture(direction);
    assert.equal(api.beginSimulationGroundSkill(simulation, owner, { kind, defenderId: defender.id }), true);
    const before = { ...simulation.ball.position }, touches = [];
    for (let tick = 0; tick < 65; tick++) {
      const touch = simulation.ball.carry?.touchTick;
      api.stepSimulation(simulation);
      if (simulation.ball.carry?.touchTick != null && simulation.ball.carry.touchTick !== touch) touches.push({ ...simulation.ball.velocity });
    }
    const move = simulation.events.find(event => event.type === 'skill' && event.kind === kind && !event.observed);
    assert.ok(move, 'named skills require a completed specific touch sequence');
    assert.ok(touches.length >= (['stepover', 'dragBack', 'cruyff'].includes(kind) ? 1 : 2));
    assertDistinctBallPath(kind, touches, direction);
    assert.ok(Math.hypot(simulation.ball.position.x - before.x, simulation.ball.position.y - before.y) > .2);
    assert.equal(simulation.ball.carry?.skill ?? null, null);
  });
}

test('skill selection is explained by ability, real pressure, speed and usable field space', () => {
  const { api, simulation, owner, defender } = skillFixture();
  const before = simulation.rngState;
  const choice = api.chooseSimulationGroundSkill(simulation, owner);
  assert.ok(choice && moves.includes(choice.kind));
  assert.equal(simulation.rngState, before, 'selection draws no success dice');
  owner.attributes.technique = owner.attributes.dribbling = 20;
  assert.equal(api.chooseSimulationGroundSkill(simulation, owner), null);
  owner.attributes.technique = owner.attributes.dribbling = 95;
  defender.position = { x: 45, y: 20 };
  assert.equal(api.chooseSimulationGroundSkill(simulation, owner), null);
});

test('a live opponent can take the ball during the attempted move; the move does not preassign success', () => {
  const { api, simulation, owner, defender } = skillFixture();
  api.beginSimulationGroundSkill(simulation, owner, { kind: 'stepover', defenderId: defender.id });
  const ball = { ...simulation.ball.position };
  defender.position = { x: ball.x + .3, y: ball.y };
  api.resolveSimulationTackle(simulation, { defenderId: defender.id, victimId: owner.id, kind: 'standing', from: { x: ball.x + .3, y: ball.y }, to: ball, speed: 3 });
  assert.equal(simulation.ball.ownerId, defender.id);
  assert.equal(simulation.ball.carry, null);
});

test('a mid-sequence JSON checkpoint resumes the same physical touches, defender response and RNG', () => {
  const { api, simulation, owner, defender } = skillFixture();
  api.beginSimulationGroundSkill(simulation, owner, { kind: 'elastico', defenderId: defender.id });
  for (let tick = 0; tick < 3; tick++) api.stepSimulation(simulation);
  const restored = api.restoreSimulation(JSON.parse(JSON.stringify(api.snapshotSimulation(simulation))));
  for (let tick = 0; tick < 65; tick++) { api.stepSimulation(simulation); api.stepSimulation(restored); }
  assert.deepEqual(plain(api.readSimulation(restored)), plain(api.readSimulation(simulation)));
});

test('roulette turns through a real full circle within the ordinary angular limit', () => {
  const { api, simulation, owner, defender } = skillFixture();
  api.beginSimulationGroundSkill(simulation, owner, { kind: 'roulette', defenderId: defender.id });
  let turned = 0;
  for (let tick = 0; tick < 22; tick++) {
    const before = owner.heading;
    api.stepSimulation(simulation);
    const delta = Math.atan2(Math.sin(owner.heading - before), Math.cos(owner.heading - before));
    assert.ok(Math.abs(delta) <= owner.limits.turnRate * .1 + 1e-8);
    turned += delta;
  }
  assert.ok(Math.abs(turned) > 5.7, `roulette must actually turn (${turned})`);
});

test('a defender reads the actual feint with ability-dependent error, then ordinary movement decides the duel', () => {
  const { api, simulation, owner, defender } = skillFixture();
  api.beginSimulationGroundSkill(simulation, owner, { kind: 'stepover', defenderId: defender.id });
  simulation.time = .3;
  const target = { x: 31.6, y: 0 };
  defender.attributes.positioning = defender.attributes.reactions = 95;
  const good = api.simulationSkillDefenderTarget(simulation, defender, target);
  defender.attributes.positioning = defender.attributes.reactions = 20;
  const poor = api.simulationSkillDefenderTarget(simulation, defender, target);
  assert.ok(Math.hypot(poor.x - target.x, poor.y - target.y) > Math.hypot(good.x - target.x, good.y - target.y));
  assert.equal(simulation.ball.ownerId, owner.id, 'reading a signal does not decide who wins the ball');
});

module.exports = { skillFixture };

function assertDistinctBallPath(kind, touches, direction) {
  if (['elastico', 'croqueta'].includes(kind)) assert.ok(touches.some((touch, index) => index && touch.y * touches[0].y < 0), 'outside and inside contacts must actually reverse the ball');
  if (['dragBack', 'cruyff'].includes(kind)) assert.ok(touches[0].x * direction < 0, 'the first real contact draws the ball behind the standing player');
}
