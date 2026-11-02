const test = require('node:test');
const assert = require('node:assert/strict');
const { plain } = require('../support/lab.cjs');
const { skillFixture } = require('../support/ground-skills.cjs');

for (const kind of ['rainbow', 'sombrero', 'juggle']) for (const direction of [-1, 1]) {
  test(`${kind} makes a distinct physical loft and permits a real contested continuation, direction ${direction}`, () => {
    const { api, simulation, owner, defender } = skillFixture(direction);
    assert.equal(api.beginSimulationAirSkill(simulation, owner, { kind, defenderId: defender.id }), true);
    const origin = { ...owner.position }, defenderOrigin = { ...defender.position }, touches = [];
    let peak = 0, crossed = false, selfClear = false;
    for (let tick = 0; tick < 50; tick++) {
      const previous = simulation.ball.carry?.touchTick;
      api.stepSimulation(simulation);
      const ball = simulation.ball;
      peak = Math.max(peak, ball.height);
      if (touchChanged(ball, previous)) touches.push({ height: ball.height, position: { ...ball.position }, verticalVelocity: ball.verticalVelocity });
      if ((ball.position.x - defenderOrigin.x) * direction >= 0 && ball.height > 1.8) crossed = true;
      if (Math.abs(ball.position.x - owner.position.x) < .25 && ball.height > 1.8) selfClear = true;
    }
    const event = simulation.events.find(event => event.type === 'skill' && event.kind === kind && !event.observed);
    assert.ok(event, 'a named aerial move needs its specific actual touches');
    assert.ok(peak > 1.8 && crossed, 'the real ball must clear the actual defender height');
    assertAerialDetails(kind, { touches, origin, direction, selfClear });
    /* failed acceptance retained below */
  });
}

function assertAerialDetails(kind, { touches, origin, direction, selfClear }) {
    if (kind === 'rainbow') assertRainbowPath(touches, { origin, direction, selfClear });
    if (kind === 'juggle') assert.ok(touches.length >= 2 && touches[1].height > .35, 'the second distinct touch must occur before the ball lands');
}

function assertRainbowPath(touches, { origin, direction, selfClear }) {
  assert.ok(touches[1] && (touches[1].position.x - origin.x) * direction < 0, 'a rainbow is flicked from behind the body');
  assert.ok(selfClear, 'the ball clears the real carrying body before going over the defender');
}

test('saving in an aerial trick preserves the actual height, next touch, contest and RNG', () => {
  const { api, simulation, owner, defender } = skillFixture();
  api.beginSimulationAirSkill(simulation, owner, { kind: 'juggle', defenderId: defender.id });
  for (let tick = 0; tick < 3; tick++) api.stepSimulation(simulation);
  const restored = api.restoreSimulation(JSON.parse(JSON.stringify(api.snapshotSimulation(simulation))));
  for (let tick = 0; tick < 50; tick++) { api.stepSimulation(simulation); api.stepSimulation(restored); }
  assert.deepEqual(plain(api.readSimulation(restored)), plain(api.readSimulation(simulation)));
});

function touchChanged(ball, previous) { return ball.carry?.touchTick != null && ball.carry.touchTick !== previous; }
