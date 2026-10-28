const test = require('node:test');
const assert = require('node:assert/strict');
const { labFixture, plain } = require('./support/lab.cjs');

function duelScene() {
  const { api, input } = labFixture({ seed: 901 });
  for (const [index, team] of input.teams.entries()) for (const [slot, player] of team.players.entries()) {
    player.position = { x: index ? 45 : -45, y: -30 + slot * 6 };
    Object.assign(player.attributes, { tackling: 100, dribbling: 100, technique: 100, firstTouch: 100, composure: 100, positioning: 100, strength: 75 });
  }
  input.teams[0].players[6].position = { x: 0, y: 0 };
  input.teams[1].players[6].position = { x: 2, y: 0 };
  input.ball = { teamId: 'home', ownerId: 'home-RCM', position: { x: 0.35, y: 0 } };
  const simulation = api.createSimulation(input);
  return { api, simulation, owner: simulation.teams[0].players[6], defender: simulation.teams[1].players[6] };
}

function strike(fixture, from, { to, ...extra }) {
  fixture.defender.position = { ...from };
  fixture.api.resolveSimulationTackle(fixture.simulation, { defenderId: fixture.defender.id, victimId: fixture.owner.id,
    kind: 'standing', from, to, speed: 3, ...extra });
}

test('ball-first contact wins by swept geometry; a short foot misses both', () => {
  const fixture = duelScene();
  fixture.defender.position.x = 1.4;
  strike(fixture, { x: 1.5, y: 0 }, { to: { x: 0.3, y: 0 } });
  assert.equal(fixture.simulation.events.find(event => event.type === 'tackle').result, 'won');
  assert.equal(fixture.simulation.ball.ownerId, fixture.defender.id);
  assert.equal(fixture.simulation.events.some(event => event.type === 'foul'), false);
  const miss = duelScene();
  strike(miss, { x: 2, y: 2 }, { to: { x: 1.5, y: 2 } });
  assert.equal(miss.simulation.events[0].result, 'missed');
  assert.equal(miss.simulation.ball.ownerId, miss.owner.id);
});

test('player-first contact causes a foul immediately after its tackle, never a success roll', () => {
  const fixture = duelScene();
  strike(fixture, { x: -1, y: 0 }, { to: { x: 0.4, y: 0 } });
  const events = fixture.simulation.events;
  const index = events.findIndex(event => event.type === 'foul');
  assert.ok(index > 0);
  assert.equal(events[index - 1].type, 'tackle');
  assert.equal(events[index - 1].fromId, events[index].fromId);
  assert.equal(events[index - 1].toId, events[index].toId);
  assert.equal(events[index].contact, 'player');
});

test('a ball contact outside control reach deflects loose and the first actual arrival recovers it', () => {
  const fixture = duelScene();
  fixture.defender.position = { x: 2.5, y: 0 };
  strike(fixture, { x: 2.5, y: 0 }, { to: { x: 0.3, y: 0 }, kind: 'sliding', speed: 6 });
  assert.equal(fixture.simulation.events[0].result, 'loose');
  assert.equal(fixture.simulation.ball.ownerId, null);
  assert.ok(Math.hypot(fixture.simulation.ball.velocity.x, fixture.simulation.ball.velocity.y) > 0);
});

test('behind the last defender with a clear route to goal is a direct red candidate', () => {
  const fixture = duelScene();
  for (const player of fixture.simulation.teams[1].players) player.position.x = 10;
  fixture.owner.position.x = 30;
  fixture.owner.velocity.x = 5;
  fixture.defender.position = { x: 29, y: 0 };
  fixture.simulation.ball.position = { x: 30.35, y: 0 };
  strike(fixture, { x: 29, y: 0 }, { to: { x: 30.4, y: 0 }, kind: 'sliding', speed: 8 });
  const foul = fixture.simulation.events.find(event => event.type === 'foul');
  assert.equal(foul.redCandidate, true);
  assert.equal(foul.dogso, true);
  assert.equal(fixture.defender.sentOff, true);
  assert.ok(fixture.simulation.events.some(event => event.type === 'red'));
});

test('a sliding miss leaves the defender unavailable until the attribute-based recovery ends', () => {
  const fixture = duelScene();
  strike(fixture, { x: 3, y: 3 }, { to: { x: 2, y: 3 }, kind: 'sliding' });
  assert.equal(fixture.defender.duel.state, 'grounded');
  const recovery = fixture.defender.duel.untilTick;
  fixture.simulation.automaticPasses = false;
  fixture.api.placeSimulationBall(fixture.simulation, { teamId: 'away', position: { ...fixture.defender.position } });
  for (let tick = 1; tick < recovery; tick++) {
    fixture.api.stepSimulation(fixture.simulation);
    assert.notEqual(fixture.simulation.ball.ownerId, fixture.defender.id);
    assert.equal(fixture.defender.duel.state, 'grounded');
  }
  fixture.api.stepSimulation(fixture.simulation);
  assert.notEqual(fixture.defender.duel.state, 'grounded');
});

test('continuing control and forward attack receives advantage, loss recalls the original foul', () => {
  const fixture = duelScene();
  fixture.owner.velocity.x = 3;
  strike(fixture, { x: -1, y: 0 }, { to: { x: 0.4, y: 0 } });
  assert.ok(fixture.simulation.events.some(event => event.type === 'advantage'));
  assert.equal(fixture.simulation.referee.stoppage, null);
  fixture.simulation.ball.ownerId = fixture.defender.id;
  fixture.simulation.ball.teamId = 'away';
  fixture.api.updateSimulationReferee(fixture.simulation);
  assert.equal(fixture.simulation.referee.advantage, null);
  assert.ok(fixture.simulation.referee.stoppage);
  assert.deepEqual(plain(fixture.simulation.referee.stoppage.foulPosition), { x: 0, y: 0 });
});

test('temporary penalty restarts move only the ball outside the box and keep opponents 9.15 m away', () => {
  const fixture = duelScene();
  fixture.owner.position = { x: 43, y: 2 };
  fixture.defender.position = { x: 42, y: 2 };
  fixture.simulation.ball.position = { x: 43.35, y: 2 };
  const before = plain(fixture.simulation.teams.map(team => team.players.map(player => player.position)));
  strike(fixture, { x: 42, y: 2 }, { to: { x: 43.4, y: 2 } });
  assert.equal(fixture.simulation.events.find(event => event.type === 'foul').penaltyPending, true);
  assert.deepEqual(plain(fixture.simulation.teams.map(team => team.players.map(player => player.position))), before);
  assert.ok(fixture.simulation.referee.stoppage.position.x < 36);
  for (let tick = 0; tick < 500 && !fixture.simulation.events.some(event => event.type === 'pass'); tick++) fixture.api.stepSimulation(fixture.simulation);
  const restart = fixture.simulation.events.find(event => event.type === 'pass');
  assert.ok(restart?.temporaryRestart);
  assert.ok(restart.nearestOpponentDistance >= 9.15 - 1e-6);
});

test('open space favours carrying; a short safe outlet beats shielding under pressure, without decision dice', () => {
  const fixture = duelScene();
  fixture.defender.position = { x: 20, y: 20 };
  const before = fixture.simulation.rngState;
  const options = fixture.api.evaluateSimulationOwnerOptions(fixture.simulation, fixture.owner);
  assert.equal(options.selected, 'dribble');
  assert.equal(fixture.simulation.rngState, before);
  fixture.defender.position = { x: 1.5, y: 0 };
  fixture.simulation.teams[0].players[5].position = { x: -8, y: 4 };
  const pressured = fixture.api.evaluateSimulationOwnerOptions(fixture.simulation, fixture.owner);
  assert.ok(['pass', 'shield'].includes(pressured.selected));
});

test('dribbling uses free rolling touches, reduced speed and the same contested control rule', () => {
  const fixture = duelScene();
  fixture.defender.position = { x: 30, y: 30 };
  fixture.api.forceSimulationDribble(fixture.simulation, fixture.owner.id);
  let freeTouches = 0, distance = 0;
  for (let tick = 0; tick < 80; tick++) {
    const before = { ...fixture.owner.position };
    fixture.api.stepSimulation(fixture.simulation);
    distance += Math.hypot(fixture.owner.position.x - before.x, fixture.owner.position.y - before.y);
    if (fixture.simulation.ball.carry && fixture.simulation.ball.ownerId === null) freeTouches++;
    assert.ok(Math.hypot(fixture.owner.velocity.x, fixture.owner.velocity.y) <= fixture.owner.limits.maxSpeed + 1e-9);
  }
  assert.ok(freeTouches > 5 && distance > 2);
  assert.ok(fixture.owner.carrySpeedRatio < 1);
  assert.ok(fixture.simulation.events.some(event => event.type === 'dribble' && event.touches > 0));
  assert.ok(fixture.api.readSimulationStatistics(fixture.simulation).dribbleDistance > 2);
});

test('a real one-on-one escape records a beat once, with defender state and speed', () => {
  const fixture = duelScene();
  fixture.simulation.ownerDecision.selected = 'dribble';
  fixture.defender.duel.state = 'jockey';
  fixture.defender.position = { x: 1, y: 0 };
  fixture.api.trackSimulationBeats(fixture.simulation);
  fixture.owner.position = { x: 5, y: 0 };
  fixture.owner.velocity.x = 5;
  fixture.simulation.ball.position = { x: 5.35, y: 0 };
  fixture.api.trackSimulationBeats(fixture.simulation);
  fixture.api.trackSimulationBeats(fixture.simulation);
  const beats = fixture.simulation.events.filter(event => event.type === 'beat');
  assert.equal(beats.length, 1);
  assert.equal(beats[0].fromId, fixture.owner.id);
  assert.equal(beats[0].toId, fixture.defender.id);
  assert.equal(beats[0].defenderState, 'jockey');
  assert.equal(beats[0].speed, 5);
});

test('every automatic-match foul has an immediately preceding contact by the same players', () => {
  const { api, simulation } = labFixture({ seed: 901 });
  for (let tick = 0; tick < 5400; tick++) api.stepSimulation(simulation);
  for (let index = 0; index < simulation.events.length; index++) {
    const event = simulation.events[index];
    if (event.type !== 'foul') continue;
    const contact = simulation.events[index - 1];
    assert.ok(['tackle', 'duel'].includes(contact.type));
    assert.equal(contact.fromId, event.fromId);
    assert.equal(contact.toId, event.toId);
    assert.equal(contact.time, event.time);
  }
  assert.ok(simulation.events.some(event => event.type === 'tackle'));
});

test('shoulder strength slows a runner through acceleration without assigning ball ownership', () => {
  const fixture = duelScene();
  fixture.simulation.ball.ownerId = null;
  fixture.owner.position = { x: 0, y: 0 };
  fixture.defender.position = { x: 0, y: 0.6 };
  fixture.owner.velocity = fixture.defender.velocity = { x: 5, y: 0 };
  fixture.owner.attributes.strength = 100;
  fixture.defender.attributes.strength = 0;
  fixture.api.prepareSimulationShoulders(fixture.simulation);
  assert.equal(fixture.simulation.ball.ownerId, null);
  assert.equal(fixture.owner.shoulderSpeedRatio, 1);
  assert.ok(fixture.defender.shoulderSpeedRatio < 1);
  assert.equal(fixture.defender.velocity.x, 5, 'no instantaneous velocity impulse');
});

test('second yellow sends off the same player and removes them from control and role selection', () => {
  const fixture = duelScene();
  fixture.defender.position = { x: -1, y: 0 };
  strike(fixture, { x: -1, y: 0 }, { to: { x: 0.4, y: 0 }, speed: 15 });
  assert.equal(fixture.defender.yellowCards, 1);
  fixture.api.placeSimulationBall(fixture.simulation, { teamId: 'home', ownerId: fixture.owner.id, position: { x: 0.35, y: 0 } });
  strike(fixture, { x: -1, y: 0 }, { to: { x: 0.4, y: 0 }, speed: 15 });
  assert.equal(fixture.defender.yellowCards, 2);
  assert.equal(fixture.defender.sentOff, true);
  assert.equal(fixture.api.simulationPlayerAvailable(fixture.defender), false);
  assert.equal(fixture.simulation.events.findLast(event => event.type === 'red').secondYellow, true);
});

test('a corner-side free-kick retreat stays on the pitch and cannot deadlock the restart', () => {
  const fixture = duelScene();
  fixture.owner.position = { x: 50, y: 30 };
  fixture.defender.position = { x: 49, y: 30 };
  fixture.simulation.ball.position = { x: 50.35, y: 30 };
  strike(fixture, { x: 49, y: 30 }, { to: { x: 50.4, y: 30 } });
  for (let tick = 0; tick < 600 && !fixture.simulation.events.some(event => event.temporaryRestart); tick++) fixture.api.stepSimulation(fixture.simulation);
  assert.ok(fixture.simulation.events.some(event => event.type === 'pass' && event.temporaryRestart));
});

test('a pass cannot be rated safe when an opponent already reaches the ball at launch', () => {
  const fixture = duelScene();
  fixture.defender.position = { x: 0.35, y: 0.8 };
  const option = fixture.api.evaluateSimulationPass(fixture.simulation, { toId: 'home-LCM' });
  assert.equal(option.safe, false);
  assert.equal(option.interceptionSeconds, 0);
});

test('tempo uses the shared tactic labels and changes outlet urgency without drawing dice', () => {
  const fixture = duelScene();
  fixture.defender.position = { x: 20, y: 20 };
  fixture.simulation.tick = 30;
  fixture.simulation.teams[0].tactics.tempo = 'Düşük';
  const before = fixture.simulation.rngState;
  const slow = fixture.api.evaluateSimulationOwnerOptions(fixture.simulation, fixture.owner);
  fixture.simulation.teams[0].tactics.tempo = 'Yüksek';
  const quick = fixture.api.evaluateSimulationOwnerOptions(fixture.simulation, fixture.owner);
  assert.ok(quick.pass.score > slow.pass.score);
  assert.equal(fixture.simulation.rngState, before);
  assert.throws(() => fixture.api.setSimulationTactics(fixture.simulation, { press: 'Normal', line: 'Normal', tempo: 'invalid' }), /tempo/i);
});

test('a grounded opponent still counts for the 9.15 m free-kick distance', () => {
  const fixture = duelScene();
  strike(fixture, { x: -1, y: 0 }, { to: { x: 0.4, y: 0 } });
  fixture.defender.position = { x: 1, y: 0 };
  fixture.defender.duel.state = 'grounded';
  fixture.defender.duel.untilTick = 100;
  fixture.simulation.referee.stoppage.readyTick = 0;
  fixture.api.finishSimulationFoulRestart(fixture.simulation);
  assert.ok(fixture.simulation.referee.stoppage);
  assert.equal(fixture.simulation.events.some(event => event.type === 'pass'), false);
});

test('a manual referee placement closes the physical carry before replacing the ball', () => {
  const fixture = duelScene();
  fixture.defender.position = { x: 30, y: 30 };
  fixture.api.forceSimulationDribble(fixture.simulation, fixture.owner.id);
  fixture.api.stepSimulation(fixture.simulation);
  const carry = fixture.simulation.events.find(event => event.type === 'dribble');
  assert.ok(carry);
  fixture.api.placeSimulationBall(fixture.simulation, { teamId: 'away', position: { x: 10, y: 0 } });
  assert.equal(fixture.simulation.ball.carry, null);
  assert.equal(carry.resolvedAt, fixture.simulation.time);
});

test('a rolling dribble touch preserves the jockey and support roles instead of starting a pass chase', () => {
  const fixture = duelScene();
  fixture.defender.position = { x: 30, y: 30 };
  fixture.api.forceSimulationDribble(fixture.simulation, fixture.owner.id);
  fixture.api.stepSimulation(fixture.simulation);
  assert.ok(fixture.simulation.ball.carry && fixture.simulation.ball.ownerId === null);
  fixture.defender.role = 'press';
  const support = fixture.simulation.teams[0].players[5];
  support.role = 'support';
  const defenderTarget = { ...fixture.defender.target }, supportTarget = { ...support.target };
  fixture.simulation.tick += 5;
  fixture.api.updateSimulationBallChasers(fixture.simulation);
  assert.equal(fixture.defender.role, 'press');
  assert.equal(support.role, 'support');
  assert.deepEqual(plain(fixture.defender.target), defenderTarget);
  assert.deepEqual(plain(support.target), supportTarget);
});
