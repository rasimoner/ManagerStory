const test = require('node:test');
const assert = require('node:assert/strict');
const { labFixture, runLabSeconds, plain } = require('./support/lab.cjs');

const magnitude = vector => Math.hypot(vector.x, vector.y);
const distance = (a, b) => magnitude({ x: a.x - b.x, y: a.y - b.y });
const defenders = simulation => simulation.teams.find(team => team.id !== simulation.ball.teamId);
const outfield = team => team.players.filter(player => player.slot !== 'GK');

function trajectory(seed) {
  const fixture = labFixture({ seed });
  const samples = [];
  for (let tick = 0; tick < 300; tick++) {
    const ball = fixture.api.advanceLabBall(fixture.driver ??= fixture.api.createLabBallDriver(seed), fixture.simulation);
    fixture.api.stepSimulation(fixture.simulation, ball);
    if (tick % 10 === 0) samples.push(plain(fixture.api.readSimulation(fixture.simulation)));
  }
  return samples;
}

test('seeded input and scripted ball reproduce the entire position sequence', () => {
  assert.deepEqual(trajectory(731), trajectory(731));
  assert.notDeepEqual(trajectory(731), trajectory(732));
});

test('a fixed clock gives the same result at different render rates and playback speeds', () => {
  const slow = labFixture({ seed: 52 }), fast = labFixture({ seed: 52 });
  for (let frame = 0; frame < 1200; frame++) slow.api.advanceSimulation(slow.simulation, { seconds: 1 / 60, ball: slow.simulation.ball });
  for (let frame = 0; frame < 300; frame++) fast.api.advanceSimulation(fast.simulation, { seconds: 1 / 15, ball: fast.simulation.ball });
  assert.equal(slow.simulation.tick, 200);
  assert.equal(fast.simulation.tick, 200);
  assert.deepEqual(plain(slow.api.readSimulation(slow.simulation)), plain(fast.api.readSimulation(fast.simulation)));
});

test('every integration step respects each player speed, acceleration and turning limits', () => {
  const fixture = labFixture({ seed: 391 });
  const { api, simulation } = fixture;
  const driver = api.createLabBallDriver(391);
  for (let tick = 0; tick < 1800; tick++) {
    const previous = new Map(simulation.teams.flatMap(team => team.players.map(player => [player.id, plain(player)])));
    api.stepSimulation(simulation, api.advanceLabBall(driver, simulation));
    for (const team of simulation.teams) for (const player of team.players) assertMotion(player, previous.get(player.id), api.MATCH_SIM_DATA.clock.stepSeconds);
  }
});

function assertMotion(player, previous, seconds) {
  assert.ok(magnitude(player.velocity) <= player.limits.maxSpeed + 1e-9, `${player.id}: speed`);
  assert.ok(distance(player.velocity, previous.velocity) <= player.limits.acceleration * seconds + 1e-9, `${player.id}: acceleration`);
  const angle = Math.atan2(Math.sin(player.heading - previous.heading), Math.cos(player.heading - previous.heading));
  assert.ok(Math.abs(angle) <= player.limits.turnRate * seconds + 1e-9, `${player.id}: turn`);
  assert.ok(Number.isFinite(player.position.x) && Number.isFinite(player.position.y));
  assert.ok(Math.abs(player.position.x) <= 52.5 && Math.abs(player.position.y) <= 34, `${player.id}: inside pitch`);
}

test('pace, acceleration and fitness change physical capacity in the expected direction', () => {
  const { api } = labFixture();
  const attributes = { pace: 25, acceleration: 25, reactions: 50, fitness: 100 };
  const slow = api.playerMovementLimits(attributes);
  const fast = api.playerMovementLimits({ ...attributes, pace: 90, acceleration: 90 });
  const tired = api.playerMovementLimits({ ...attributes, fitness: 20 });
  assert.ok(fast.maxSpeed > slow.maxSpeed && fast.acceleration > slow.acceleration);
  assert.ok(tired.maxSpeed < slow.maxSpeed && tired.acceleration < slow.acceleration);
});

test('after a turnover the closest eligible defender reacts, sprints and stays within the pressing cap', () => {
  const fixture = labFixture({ seed: 213 });
  runLabSeconds(fixture, 15);
  const { api, simulation } = fixture;
  const team = simulation.teams.find(candidate => candidate.id === simulation.ball.teamId);
  const nearest = outfield(team).sort((a, b) => distance(a.position, simulation.ball.position) - distance(b.position, simulation.ball.position))[0];
  const ball = { position: { x: nearest.position.x + 2, y: nearest.position.y }, teamId: defenders(simulation).id };
  const before = simulation.tick;
  api.stepSimulation(simulation, ball);
  assert.equal(team.players.filter(player => player.role === 'press').length, 0, 'no instant decision');
  while (!team.players.some(player => player.role === 'press') && simulation.tick - before < 10) api.stepSimulation(simulation, ball);
  const pressers = team.players.filter(player => player.role === 'press');
  assert.equal(pressers[0]?.id, nearest.id);
  assert.equal(pressers[0].gait, 'sprint');
  assert.ok(team.pressReactionSeconds >= nearest.limits.reactionSeconds - 1e-9);
  assert.ok(team.pressReactionSeconds <= nearest.limits.reactionSeconds + api.MATCH_SIM_DATA.clock.stepSeconds + 1e-9);
  runLabSeconds(fixture, 10, ball);
  assert.ok(team.players.filter(player => player.role === 'press').length <= api.MATCH_SIM_DATA.roles.maxPressers);
});

test('cover is behind the presser on the most dangerous forward passing lane', () => {
  const fixture = labFixture({ seed: 411 });
  const { api, simulation } = fixture;
  const team = defenders(simulation);
  const nearest = outfield(team).sort((a, b) => distance(a.position, simulation.ball.position) - distance(b.position, simulation.ball.position))[0];
  const ball = { teamId: simulation.ball.teamId, position: { x: nearest.position.x, y: nearest.position.y + 3 } };
  runLabSeconds(fixture, 15, ball);
  const presser = team.players.find(player => player.role === 'press');
  const cover = team.players.find(player => player.role === 'cover');
  assert.ok(presser && cover, 'a presser and his cover exist');
  assert.equal(cover.coveringId, presser.id);
  assert.ok(cover.target.x * team.direction < ball.position.x * team.direction, 'goal side of the ball');
  const target = simulation.teams.flatMap(candidate => candidate.players).find(player => player.id === cover.laneTargetId);
  assert.ok(target, 'cover refers to a real opposition receiver');
  const lane = api.projectOntoSegment(cover.target, ball.position, target.position);
  assert.ok(distance(lane, cover.target) < 1, 'the cover target blocks the receiver lane');
});

test('the settled defensive block stays compact, shifts to the flank, and possession expands it', () => {
  const fixture = labFixture({ seed: 200 });
  const { api, simulation } = fixture;
  runLabSeconds(fixture, 35);
  const team = defenders(simulation);
  const compact = api.measureTeam(simulation, team.id);
  assert.ok(compact.length >= 25 && compact.length <= 40, `length ${compact.length}`);
  assert.ok(compact.width <= 45, `width ${compact.width}`);
  const wideBall = { ...plain(simulation.ball), position: { x: 0, y: 29 } };
  runLabSeconds(fixture, 30, wideBall);
  const shifted = api.measureTeam(simulation, team.id);
  assert.ok(shifted.center.y > compact.center.y + 6, 'the whole block shifts towards the ball');
  const ownBall = { ...wideBall, teamId: team.id };
  runLabSeconds(fixture, 35, ownBall);
  const expanded = api.measureTeam(simulation, team.id);
  assert.ok(expanded.length > compact.length + 5 && expanded.width > compact.width + 5, 'possession creates depth and width');
});

test('press and defensive line settings change behaviour using the existing tactic options', () => {
  const fixture = labFixture();
  const { api } = fixture;
  const deep = api.createSimulation(api.createLabScenario({ line: 'Geride', press: 'Düşük' }));
  const high = api.createSimulation(api.createLabScenario({ line: 'Önde', press: 'Yüksek' }));
  for (let tick = 0; tick < 300; tick++) { api.stepSimulation(deep, deep.ball); api.stepSimulation(high, high.ball); }
  const deepTeam = defenders(deep), highTeam = defenders(high);
  assert.ok(api.measureTeam(high, highTeam.id).center.x * highTeam.direction > api.measureTeam(deep, deepTeam.id).center.x * deepTeam.direction + 3);
  assert.ok(highTeam.pressTriggerDistance > deepTeam.pressTriggerDistance);
});

test('simulation owns its input and snapshots, rejects invalid inputs, and never writes the career', () => {
  const { api, input, simulation } = labFixture();
  const original = plain(input);
  runLabSeconds({ api, simulation }, 2);
  assert.deepEqual(plain(input), original);
  const snapshot = api.readSimulation(simulation);
  snapshot.teams[0].players[0].position.x = 999;
  assert.notEqual(simulation.teams[0].players[0].position.x, 999);
  assert.throws(() => api.createSimulation({ ...input, seed: NaN }), /seed/i);
  assert.throws(() => api.stepSimulation(simulation, { teamId: 'missing', position: { x: 0, y: 0 } }), /team/i);
  assert.throws(() => api.stepSimulation(simulation, { teamId: input.teams[0].id, position: { x: NaN, y: 0 } }), /position/i);
});

test('a headless 90-minute scripted-ball run finishes with finite positions and records its elapsed time', t => {
  const { performance } = require('node:perf_hooks');
  const fixture = labFixture({ seed: 901 });
  const { api, simulation } = fixture;
  const driver = api.createLabBallDriver(901);
  const start = performance.now();
  for (let tick = 0; tick < 54000; tick++) api.stepSimulation(simulation, api.advanceLabBall(driver, simulation));
  const elapsed = performance.now() - start;
  t.diagnostic(`90 minutes, 54,000 steps, 22 players: ${elapsed.toFixed(1)} ms`);
  assert.equal(simulation.time, 5400);
  for (const team of simulation.teams) for (const player of team.players) assert.ok(Number.isFinite(player.position.x) && Number.isFinite(player.position.y));
});
