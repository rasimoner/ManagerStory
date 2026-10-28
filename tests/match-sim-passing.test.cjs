const test = require('node:test');
const assert = require('node:assert/strict');
const { labFixture, plain } = require('./support/lab.cjs');

function play(seed, ticks = 1200) {
  const fixture = labFixture({ seed });
  const samples = [];
  for (let tick = 0; tick < ticks; tick++) {
    fixture.api.stepSimulation(fixture.simulation);
    if (tick % 20 === 0) samples.push(plain(fixture.api.readSimulation(fixture.simulation, { includeEvents: false })));
  }
  return { ...fixture, samples };
}

test('the internal ball reproduces every sampled position and event for identical seeds', () => {
  const first = play(123), second = play(123);
  assert.deepEqual(first.samples, second.samples);
  assert.deepEqual(plain(first.simulation.events), plain(second.simulation.events));
  assert.notDeepEqual(first.samples, play(124).samples);
  assert.ok(first.simulation.events.some(event => event.type === 'pass'));
  assert.ok(first.simulation.events.some(event => event.type === 'firstTouch'));
});

test('render rate and 0.25/0.5/1/2 speeds preserve the engine ball and event sequence', () => {
  const normal = labFixture({ seed: 301 }), mixed = labFixture({ seed: 301 });
  for (let frame = 0; frame < 1200; frame++) normal.api.advanceSimulation(normal.simulation, { seconds: 1 / 60 });
  for (let frame = 0; frame < 300; frame++) mixed.api.advanceSimulation(mixed.simulation, { seconds: 1 / 15 });
  assert.equal(normal.simulation.tick, 200);
  assert.deepEqual(plain(normal.api.readSimulation(normal.simulation)), plain(mixed.api.readSimulation(mixed.simulation)));
});

test('passing, chasing, turnovers and first touches never violate player movement or owner reach', () => {
  const { api, simulation } = labFixture({ seed: 901 });
  const players = simulation.teams.flatMap(team => team.players);
  for (let tick = 0; tick < 2400; tick++) {
    const previous = players.map(player => ({ position: { ...player.position }, velocity: { ...player.velocity }, heading: player.heading }));
    api.stepSimulation(simulation);
    players.forEach((player, index) => assertPlayerMotion(player, previous[index]));
    if (simulation.ball.ownerId) {
      const owner = players.find(player => player.id === simulation.ball.ownerId);
      assert.ok(Math.hypot(owner.position.x - simulation.ball.position.x, owner.position.y - simulation.ball.position.y) <= api.MATCH_SIM_DATA.ball.controlRadius + 1e-9);
    }
  }
});

function assertPlayerMotion(player, previous) {
  const speed = Math.hypot(player.velocity.x, player.velocity.y);
  const change = Math.hypot(player.velocity.x - previous.velocity.x, player.velocity.y - previous.velocity.y);
  const turn = Math.atan2(Math.sin(player.heading - previous.heading), Math.cos(player.heading - previous.heading));
  assert.ok(speed <= player.limits.maxSpeed + 1e-9, `${player.id}: speed`);
  assert.ok(change <= player.limits.acceleration * 0.1 + 1e-9, `${player.id}: acceleration`);
  assert.ok(Math.abs(turn) <= player.limits.turnRate * 0.1 + 1e-9, `${player.id}: turn`);
  const travelled = Math.hypot(player.position.x - previous.position.x, player.position.y - previous.position.y);
  assert.ok(travelled <= player.limits.maxSpeed * 0.1 + 1e-9, `${player.id}: no teleport`);
  assert.ok(Math.abs(player.position.x) <= 52.5 && Math.abs(player.position.y) <= 34, `${player.id}: inside pitch`);
}

test('event times and metre positions originate in the evolving ball and copies cannot mutate it', () => {
  const { api, simulation } = play(901, 3000);
  let previous = 0;
  for (const event of simulation.events) {
    assert.ok(event.time >= previous - 1e-9 && event.time <= simulation.time);
    previous = event.time;
    for (const point of [event.fromPos, event.toPos]) {
      assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
      assert.ok(Math.abs(point.x) < 106 && Math.abs(point.y) < 69);
    }
    if (event.type === 'firstTouch' || event.type === 'interception') {
      assert.ok(event.height <= api.MATCH_SIM_DATA.ball.reachableHeight + 1e-9);
      assert.ok(Math.hypot(event.fromPos.x - event.toPos.x, event.fromPos.y - event.toPos.y) <= api.MATCH_SIM_DATA.ball.controlRadius + 0.01);
    }
  }
  const snapshot = api.readSimulation(simulation);
  snapshot.events[0].fromPos.x = 999;
  snapshot.ball.velocity.x = 999;
  snapshot.passing.options.length = 0;
  assert.notEqual(simulation.events[0].fromPos.x, 999);
  assert.notEqual(simulation.ball.velocity.x, 999);
});

test('the passing style and vision influence deterministic evaluations without drawing dice', () => {
  const { api, simulation } = labFixture({ seed: 9 });
  const owner = simulation.teams[0].players.find(player => player.slot === 'LCM');
  const receiver = simulation.teams[0].players.find(player => player.slot === 'ST');
  api.placeSimulationBall(simulation, { teamId: 'home', position: { ...owner.position }, ownerId: owner.id });
  const before = simulation.rngState;
  simulation.teams[0].tactics.passingStyle = 'Kısa';
  const short = api.evaluateSimulationPass(simulation, { toId: receiver.id });
  simulation.teams[0].tactics.passingStyle = 'Direkt';
  const direct = api.evaluateSimulationPass(simulation, { toId: receiver.id });
  assert.notEqual(short.score, direct.score);
  owner.attributes.vision = 0;
  const lowVision = api.evaluateSimulationPass(simulation, { toId: receiver.id, target: { x: 40, y: 0 } });
  owner.attributes.vision = 100;
  const highVision = api.evaluateSimulationPass(simulation, { toId: receiver.id, target: { x: 40, y: 0 } });
  assert.equal(lowVision.visible, false);
  assert.equal(highVision.visible, true);
  assert.equal(simulation.rngState, before);
});

test('invalid referee interventions and pass requests fail without changing the match', () => {
  const { api, simulation } = labFixture();
  const before = plain(api.readSimulation(simulation));
  assert.throws(() => api.placeSimulationBall(simulation, { teamId: 'home', position: { x: 100, y: 0 } }), /pitch/i);
  assert.throws(() => api.placeSimulationBall(simulation, { teamId: 'home', position: { x: 0, y: 0 }, velocity: { x: NaN, y: 0 } }), /velocity/i);
  assert.throws(() => api.placeSimulationBall(simulation, { teamId: 'home', position: { x: 0, y: 0 }, ownerId: 'away-GK' }), /owner/i);
  assert.throws(() => api.requestSimulationPass(simulation, { toId: 'home-ST' }), /controlled/i);
  assert.deepEqual(plain(api.readSimulation(simulation)), before);
});

test('live statistics agree with resolved passes, touches and interceptions', () => {
  const { api, simulation } = play(301, 3600);
  const stats = api.readSimulationStatistics(simulation);
  const passes = simulation.events.filter(event => event.type === 'pass');
  const resolved = passes.filter(event => event.success !== null);
  const completed = resolved.filter(event => event.success);
  assert.equal(stats.passes, passes.length);
  assert.equal(stats.completedPasses, completed.length);
  assert.equal(stats.interceptions, simulation.events.filter(event => event.type === 'interception' && event.success).length);
  assert.ok(Math.abs(stats.accuracy - completed.length / resolved.length * 100) < 1e-9);
  assert.ok(Math.abs(stats.teams.reduce((sum, team) => sum + team.possessionPercent, 0) - 100) < 1e-9);
  assert.ok(stats.averageHoldSeconds > 0 && stats.averageDistance > 0);
});

test('automatic play keeps finding outlets instead of freezing on a stale selected target', () => {
  const { api, simulation } = labFixture({ seed: 901 });
  let lastPassTime = 0;
  for (let tick = 0; tick < 9000; tick++) {
    api.stepSimulation(simulation);
    if (simulation.ball.flight) lastPassTime = simulation.time;
    assert.ok(simulation.time - lastPassTime < 30, 'no half-minute deadlock while both teams have outlets');
  }
});

test('quarter-speed laboratory play has exactly the same internal match as normal speed', () => {
  const { api } = labFixture();
  const normal = api.createLabSession({ seed: 51 }), quarter = api.createLabSession({ seed: 51 });
  quarter.session.speed = 0.25;
  for (let frame = 0; frame < 300; frame++) normal.advance(1 / 15);
  for (let frame = 0; frame < 1200; frame++) quarter.advance(1 / 15);
  assert.deepEqual(plain(normal.snapshot().simulation), plain(quarter.snapshot().simulation));
});

test('numeric player identity zero is a valid owner and invalid passing styles fail at creation', () => {
  const { api, input } = labFixture();
  const player = input.teams[0].players.find(candidate => candidate.slot === 'LCM');
  player.id = 0;
  player.position = { x: 0, y: 0 };
  input.ball = { teamId: 'home', position: { x: 0, y: 0 }, ownerId: 0 };
  const simulation = api.createSimulation(input);
  assert.doesNotThrow(() => api.requestSimulationPass(simulation, { toId: 'home-RCM' }));
  assert.equal(simulation.statistics.teams.home.controls, 1);
  input.teams[0].tactics.passingStyle = 'missing';
  assert.throws(() => api.createSimulation(input), /passing style/i);
});
