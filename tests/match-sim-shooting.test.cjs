const test = require('node:test');
const assert = require('node:assert/strict');
const { labFixture, plain } = require('./support/lab.cjs');

function shootingScene(options = {}) {
  const { api, input } = labFixture({ seed: options.seed ?? 901 });
  input.match = false;
  for (const [index, team] of input.teams.entries()) for (const [slot, player] of team.players.entries()) {
    player.position = { x: -25 + index * 4, y: -28 + slot * 5 };
  }
  const shooter = input.teams[0].players.find(player => player.slot === 'ST');
  shooter.position = { x: options.x ?? 35, y: options.y ?? 0 };
  const keeper = input.teams[1].players[0];
  keeper.position = { x: 51, y: options.keeperY ?? 0 };
  keeper.attributes.gk = { reflexes: 100, handling: 100, oneOnOne: 90 };
  input.ball = { position: { ...shooter.position }, teamId: 'home', ownerId: shooter.id };
  const simulation = api.createSimulation(input);
  simulation.automaticPasses = false;
  return { api, simulation, shooter: simulation.teams[0].players.at(-1), keeper: simulation.teams[1].players[0] };
}

function fire(fixture, { y = 0, height = 0, speed = 25 } = {}) {
  const { api, simulation, shooter } = fixture;
  api.requestSimulationShot(simulation);
  const ball = simulation.ball;
  const dx = 52.5 - ball.position.x;
  const dy = y - ball.position.y;
  const duration = Math.hypot(dx, dy) / speed;
  ball.velocity = { x: dx / duration, y: dy / duration };
  ball.verticalVelocity = height > 0 ? (height + 9.81 * duration ** 2 / 2) / duration : 0;
  ball.height = 0;
  assert.equal(simulation.events.find(event => event.type === 'shot').fromId, shooter.id);
}

function run(fixture, seconds = 3) {
  for (let tick = 0; tick < seconds * 10; tick++) fixture.api.stepSimulation(fixture.simulation);
}

const events = (fixture, type) => fixture.simulation.events.filter(event => event.type === type);

test('a physical corner outside keeper reach scores only after the entire ball crosses', () => {
  const fixture = shootingScene({ x: 48, keeperY: -3 });
  fire(fixture, { y: 3, speed: 32 });
  run(fixture);
  assert.equal(events(fixture, 'goal').length, 1);
  assert.equal(fixture.simulation.match.score.home, 1);
  assert.equal(events(fixture, 'goal')[0].fromId, fixture.shooter.id);
  assert.ok(events(fixture, 'goal')[0].toPos.x >= 52.5 + fixture.api.MATCH_SIM_DATA.ball.radius - 1e-8);
});

test('a set keeper physically reaches a central shot and records catch/parry/tip difficulty', () => {
  const fixture = shootingScene();
  fixture.keeper.keeper.setSeconds = 1;
  fire(fixture, { speed: 20 });
  run(fixture);
  const save = events(fixture, 'save')[0];
  assert.ok(save);
  assert.ok(['catch', 'parry', 'tip'].includes(save.kind));
  assert.ok(save.difficulty >= 0 && save.difficulty <= 1);
  assert.equal(events(fixture, 'goal').length, 0);
});

test('the same swept contact in a shot lane blocks rather than assigning possession', () => {
  const fixture = shootingScene();
  const defender = fixture.simulation.teams[1].players[4];
  defender.position = { x: 40, y: 0 };
  fire(fixture);
  run(fixture, 0.3);
  assert.equal(events(fixture, 'block').length, 1);
  assert.equal(fixture.simulation.ball.ownerId, null);
  assert.ok(Math.hypot(fixture.simulation.ball.velocity.x, fixture.simulation.ball.velocity.y) > 0);
});

test('a shot over the crossbar is wide and cannot score', () => {
  const fixture = shootingScene();
  fire(fixture, { height: 3.2 });
  run(fixture);
  assert.equal(events(fixture, 'goal').length, 0);
  assert.equal(events(fixture, 'wide').length, 1);
});

test('post and crossbar collisions reflect the actual velocity and may remain in play', () => {
  for (const target of [{ y: 3.66 }, { y: 0, height: 2.44 }]) {
    const fixture = shootingScene({ x: 48, keeperY: -3 });
    fire(fixture, { ...target, speed: 30 });
    run(fixture, 0.3);
    assert.equal(events(fixture, 'post').length, 1);
    assert.equal(events(fixture, 'goal').length, 0);
    assert.ok(fixture.simulation.ball.velocity.x < 0);
    assert.equal(fixture.simulation.ball.restart, null);
  }
});

test('keeper reaction is deterministic and later when the keeper was not set', () => {
  const ready = shootingScene(), moving = shootingScene();
  ready.keeper.keeper.setSeconds = 1;
  moving.keeper.keeper.setSeconds = 0;
  fire(ready); fire(moving);
  assert.ok(moving.keeper.keeper.reactionAt > ready.keeper.keeper.reactionAt);
  assert.equal(ready.keeper.keeper.reactionAt, shootingReactionRepeat());
});

function shootingReactionRepeat() {
  const fixture = shootingScene();
  fixture.keeper.keeper.setSeconds = 1;
  fire(fixture);
  return fixture.keeper.keeper.reactionAt;
}

test('keepers claim loose balls only inside the penalty area and cannot handle a deliberate backpass', () => {
  const fixture = shootingScene();
  const { api, simulation, keeper } = fixture;
  for (const [x, backpass, expected] of [[30, null, false], [48, 'away', false], [48, null, true]]) {
    keeper.position = { x, y: 0 };
    api.placeSimulationBall(simulation, { teamId: 'away', position: { ...keeper.position } });
    simulation.ball.backpassTeamId = backpass;
    run(fixture, 0.1);
    assert.equal(simulation.ball.heldBy === keeper.id, expected);
  }
});

test('a held ball is immune to tackles and is distributed within the configured time', () => {
  const fixture = shootingScene();
  const { api, simulation, keeper, shooter } = fixture;
  keeper.position = { x: 48, y: 0 };
  api.placeSimulationBall(simulation, { teamId: 'away', position: { ...keeper.position } });
  run(fixture, 0.1);
  assert.equal(simulation.ball.heldBy, keeper.id);
  shooter.position = { x: 47.5, y: 0 };
  const before = simulation.events.length;
  api.resolveSimulationTackle(simulation, { defenderId: shooter.id, victimId: keeper.id, kind: 'standing', from: shooter.position, to: keeper.position, speed: 6 });
  assert.equal(simulation.events.length, before);
  assert.equal(simulation.ball.heldBy, keeper.id);
  run(fixture, 7);
  assert.ok(events(fixture, 'keeperDistribution').length > 0);
});

test('xG is geometry for decisions only; distance, angle, blockers and body position reduce it without dice', () => {
  const fixture = shootingScene();
  const { api, simulation, shooter } = fixture;
  const state = simulation.rngState;
  const clear = api.evaluateSimulationShot(simulation, shooter);
  shooter.position.y = 22;
  const angled = api.evaluateSimulationShot(simulation, shooter);
  shooter.position = { x: 10, y: 0 };
  const distant = api.evaluateSimulationShot(simulation, shooter);
  shooter.position = { x: 35, y: 0 };
  simulation.teams[1].players[2].position = { x: 40, y: 0 };
  const blocked = api.evaluateSimulationShot(simulation, shooter);
  assert.ok(clear.xg > angled.xg && clear.xg > distant.xg && clear.xg > blocked.xg);
  assert.equal(simulation.rngState, state);
});

test('a ball crossing the mouth without a shot cannot create a goal', () => {
  const fixture = shootingScene({ x: 48 });
  fixture.simulation.ball.ownerId = null;
  fixture.simulation.ball.position = { x: 52, y: 0 };
  fixture.simulation.ball.velocity = { x: 20, y: 0 };
  run(fixture);
  assert.equal(events(fixture, 'goal').length, 0);
});

test('goals restart by the conceding side at centre; half switches ends and end freezes the engine', () => {
  const fixture = shootingScene({ x: 48, keeperY: -3 });
  fixture.simulation.match.enabled = true;
  fire(fixture, { y: 3, speed: 32 });
  run(fixture, 50);
  const kickoff = events(fixture, 'kickoff')[0];
  assert.equal(kickoff.teamId, 'away');
  assert.deepEqual(plain(kickoff.fromPos), { x: 0, y: 0 });
  fixture.simulation.tick = 26999;
  fixture.simulation.time = 2699.9;
  run(fixture, 0.1);
  assert.equal(fixture.simulation.teams[0].direction, -1);
  assert.equal(events(fixture, 'half').length, 1);
  fixture.simulation.tick = 53999;
  fixture.simulation.time = 5399.9;
  run(fixture, 0.1);
  assert.equal(events(fixture, 'end').length, 1);
  const snapshot = plain(fixture.api.readSimulation(fixture.simulation));
  run(fixture, 2);
  assert.deepEqual(plain(fixture.api.readSimulation(fixture.simulation)), snapshot);
});

test('the last successful pass assists a goal, while a post or rebound removes that assist', () => {
  const clean = shootingScene({ x: 48, keeperY: -3 });
  clean.simulation.ball.assist = { fromId: 'home-CAM', toId: clean.shooter.id, teamId: 'home' };
  fire(clean, { y: 3, speed: 32 });
  run(clean);
  assert.equal(events(clean, 'goal')[0].assistId, 'home-CAM');
  const rebound = shootingScene({ x: 48, keeperY: -3 });
  rebound.simulation.ball.assist = { fromId: 'home-CAM', toId: rebound.shooter.id, teamId: 'home' };
  fire(rebound, { y: 3.66, speed: 30 });
  run(rebound, 0.2);
  assert.equal(rebound.simulation.ball.shot.assistId, null);
});

test('full-ball crossing and height are both required; a partly crossed ball is not a goal', () => {
  const fixture = shootingScene({ x: 48, keeperY: -3 });
  fire(fixture, { y: 2, speed: 25 });
  fixture.simulation.ball.position = { x: 52.4, y: 2 };
  fixture.simulation.ball.velocity = { x: 1, y: 0 };
  fixture.simulation.ball.verticalVelocity = 0;
  run(fixture, 0.1);
  assert.equal(events(fixture, 'goal').length, 0);
  run(fixture, 0.3);
  assert.equal(events(fixture, 'goal').length, 1);
});

test('a non-shot ball also physically rebounds off a post without creating a goal', () => {
  const fixture = shootingScene({ x: 48, keeperY: -3 });
  Object.assign(fixture.simulation.ball, { ownerId: null, position: { x: 51.5, y: 3.66 }, velocity: { x: 20, y: 0 } });
  run(fixture, 0.1);
  assert.equal(events(fixture, 'post').length, 1);
  assert.ok(fixture.simulation.ball.velocity.x < 0);
  assert.equal(events(fixture, 'goal').length, 0);
});

test('a foot-controlling keeper continues a physical carry rather than abandoning the free touch', () => {
  const fixture = shootingScene();
  const { api, simulation, keeper } = fixture;
  keeper.position = { x: 45, y: 5 };
  api.placeSimulationBall(simulation, { position: { ...keeper.position }, teamId: 'away', ownerId: keeper.id });
  api.forceSimulationDribble(simulation, keeper.id);
  simulation.automaticPasses = true;
  run(fixture, 0.1);
  assert.ok(simulation.ball.carry);
  {
    simulation.ball.position = { x: 40, y: 7 };
    simulation.ball.velocity = { x: 0, y: 0 };
    api.stepSimulation(simulation);
    assert.deepEqual(plain(keeper.target), { x: 40, y: 7 });
  }
  assert.ok(events(fixture, 'dribble').length > 0);
});

test('a rushed keeper narrowing the whole mouth changes the DOGSO judgment', () => {
  const fixture = shootingScene({ x: 35 });
  const { api, simulation, shooter, keeper } = fixture;
  const defender = simulation.teams[1].players[2];
  shooter.velocity.x = 5;
  defender.position = { x: 34, y: 0 };
  keeper.position = { x: 51, y: 0 };
  const open = api.evaluateSimulationFoul(simulation, defender, { victim: shooter, kind: 'standing', speed: 4 });
  keeper.position = { x: 35.5, y: 0 };
  const closed = api.evaluateSimulationFoul(simulation, defender, { victim: shooter, kind: 'standing', speed: 4 });
  assert.equal(open.dogso, true);
  assert.equal(closed.dogso, false);
});

test('mentality, finishing and the nonzero error floor affect execution and selection without a goal roll', () => {
  const fixture = shootingScene();
  const { api, simulation, shooter } = fixture;
  const state = simulation.rngState;
  simulation.teams[0].tactics.mentality = 'Temkinli';
  const cautious = api.evaluateSimulationShot(simulation, shooter);
  simulation.teams[0].tactics.mentality = 'Cesur';
  const brave = api.evaluateSimulationShot(simulation, shooter);
  assert.ok(brave.score > cautious.score);
  assert.equal(simulation.rngState, state);
  assert.ok(api.MATCH_SIM_DATA.shooting.minimumAngleError > 0);
  assert.ok(api.MATCH_SIM_DATA.shooting.minimumPowerError > 0);
  assert.throws(() => api.setSimulationTactics(simulation, { press: 'Normal', line: 'Normal', mentality: 'missing' }), /mentality/);
});

test('both teams accept the game keeper profile schema and reject invalid keeper attributes', () => {
  const { api, input } = labFixture();
  input.teams[0].players[0].gk = { reflexes: 95, handling: 83, oneOnOne: 91 };
  const simulation = api.createSimulation(input);
  assert.deepEqual(plain(simulation.teams[0].players[0].attributes.gk), input.teams[0].players[0].gk);
  input.teams[1].players[0].gk = { reflexes: NaN, handling: 80, oneOnOne: 80 };
  assert.throws(() => api.createSimulation(input), /gk.reflexes/);
});

test('the opening kickoff reaches its settled receiver instead of rolling forty metres through the shape', () => {
  const { api, simulation } = labFixture({ seed: 731 });
  while (simulation.tick < 100 && !simulation.events.some(event => event.type === 'kickoff')) api.stepSimulation(simulation);
  const kickoff = simulation.events.find(event => event.type === 'kickoff');
  assert.ok(kickoff);
  for (const player of simulation.teams[1].players) assert.ok(Math.hypot(player.position.x, player.position.y) >= api.MATCH_SIM_DATA.pitch.centerCircleRadius);
  for (let tick = 0; tick < 15 && simulation.ball.ownerId == null; tick++) api.stepSimulation(simulation);
  assert.equal(simulation.ball.ownerId, kickoff.toId);
  assert.ok(simulation.time - kickoff.time <= 1.5);
});

test('a keeper stops following an old loose-ball target once an opponent controls the ball', () => {
  const fixture = shootingScene();
  fixture.keeper.role = 'recover';
  fixture.keeper.target = { x: 40, y: 20 };
  fixture.api.prepareSimulationKeepers(fixture.simulation);
  assert.equal(fixture.keeper.role, 'keeper');
  assert.notDeepEqual(plain(fixture.keeper.target), { x: 40, y: 20 });
});

test('the first crossed boundary wins at a corner and keeps the event log chronological', () => {
  const fixture = shootingScene();
  fire(fixture);
  Object.assign(fixture.simulation.ball, { position: { x: 52.5, y: 33.9 }, velocity: { x: 2, y: 10 }, height: 3, verticalVelocity: 0 });
  run(fixture, 0.1);
  assert.equal(events(fixture, 'wide').length, 0, 'the ball left through the touchline before the goal line');
  assert.equal(fixture.simulation.ball.restart.kind, 'touchline');
  let previous = 0;
  for (const event of fixture.simulation.events) { assert.ok(event.time >= previous); previous = event.time; }
});

test('an opponent touch clears the deliberate backpass restriction even when that first touch rebounds', () => {
  const fixture = shootingScene({ seed: 0 });
  const { api, simulation, shooter } = fixture;
  simulation.ball.backpassTeamId = 'away';
  shooter.attributes.firstTouch = 0;
  shooter.attributes.technique = 0;
  const before = { position: { ...shooter.position }, velocity: { x: 80, y: 0 }, height: 0, verticalVelocity: 0 };
  const after = api.predictSimulationBall(before, 0.1);
  api.controlSimulationBall(simulation, { player: shooter, previous: { ...shooter.position }, fraction: 0 }, { before, after });
  assert.equal(simulation.ball.backpassTeamId, null);
  assert.ok(events(fixture, 'looseBall').length > 0, 'the opponent did not need a controlled interception');
});

test('goal dimensions describe the clear opening rather than the centres of the posts and bar', () => {
  for (const point of [{ y: 3.51, height: 1 }, { y: 0, height: 2.29 }]) {
    const fixture = shootingScene({ x: 48, keeperY: -3 });
    fire(fixture);
    Object.assign(fixture.simulation.ball, { position: { x: 51.5, y: point.y }, velocity: { x: 30, y: 0 }, height: point.height, verticalVelocity: 0 });
    run(fixture, 0.1);
    assert.equal(events(fixture, 'post').length, 0, 'a ball completely within the 7.32 by 2.44 m opening clears the frame');
    assert.equal(events(fixture, 'goal').length, 1);
  }
});
