const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLab, plain } = require('./support/lab.cjs');

function scriptedSession(frameSeconds, frameCount, speed) {
  const { api } = loadLab();
  const runner = api.createLabSession({ seed: 508 });
  runner.session.speed = speed;
  for (let frame = 0; frame < frameCount; frame++) runner.advance(frameSeconds);
  return plain(runner.snapshot().simulation);
}

test('the automatic ball follows the fixed clock at 60/15 fps and 0.5/1/2 playback speeds', () => {
  const normal = scriptedSession(1 / 60, 1200, 1);
  assert.deepEqual(normal, scriptedSession(1 / 15, 300, 1));
  assert.deepEqual(normal, scriptedSession(1 / 60, 2400, 0.5));
  assert.deepEqual(normal, scriptedSession(1 / 60, 600, 2));
});

test('manual placement and possession selection stay visible while paused, in either order', () => {
  const { api } = loadLab();
  const runner = api.createLabSession();
  runner.session.running = false;
  runner.placeBall({ x: 11, y: 22 });
  runner.chooseOwner('away');
  assert.deepEqual(plain(runner.snapshot().simulation.ball), { position: { x: 11, y: 22 }, teamId: 'away' });
  runner.placeBall({ x: -12, y: -23 });
  assert.equal(runner.snapshot().simulation.ball.teamId, 'away');
  runner.advance(10);
  assert.equal(runner.snapshot().simulation.tick, 0);
  runner.session.running = true;
  runner.advance(0.1);
  assert.equal(runner.snapshot().simulation.teams[0].phase, 'counterpress');
});

test('live tactics preserve positions and a failed reset preserves the running experiment', () => {
  const { api } = loadLab();
  const runner = api.createLabSession();
  runner.advance(5);
  const positions = plain(runner.snapshot().simulation.teams.map(team => team.players.map(player => player.position)));
  runner.setTactics({ press: 'Yüksek', line: 'Önde' });
  assert.deepEqual(plain(runner.snapshot().simulation.teams.map(team => team.players.map(player => player.position))), positions);
  const before = plain(runner.snapshot());
  assert.throws(() => runner.reset({ seed: NaN }), /seed/i);
  assert.deepEqual(plain(runner.snapshot()), before);
});

test('the automatic ball stays continuous at its configured speed and exercises both owners', () => {
  const { api } = loadLab();
  const simulation = api.createSimulation(api.createLabScenario({ seed: 901 }));
  const driver = api.createLabBallDriver(901);
  const owners = new Set();
  let previous = simulation.ball.position;
  const maximumStep = api.MATCH_SIM_DATA.lab.ballSpeed * api.MATCH_SIM_DATA.clock.stepSeconds;
  for (let tick = 0; tick < 3000; tick++) {
    const ball = api.advanceLabBall(driver, simulation);
    assert.ok(Math.hypot(ball.position.x - previous.x, ball.position.y - previous.y) <= maximumStep + 1e-9);
    api.stepSimulation(simulation, ball);
    for (const team of simulation.teams) assert.ok(team.players.filter(player => player.role === 'press').length <= api.MATCH_SIM_DATA.roles.maxPressers);
    previous = ball.position;
    owners.add(ball.teamId);
  }
  assert.equal(owners.size, 2);
});
