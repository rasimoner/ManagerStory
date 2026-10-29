const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLab, plain } = require('./support/lab.cjs');

function openScene({ direction = 1, durationSeconds = 420, formation = '4-2-3-1', striker = false, reference = false } = {}) {
  const { api } = loadLab();
  const input = api.createLabScenario({ seed: 901, formation });
  input.match = false;
  for (const [side, team] of input.teams.entries()) {
    placeSceneTeam(team, side, direction);
  }
  const owner = input.teams[0].players[striker ? 10 : 6];
  owner.position = { x: -10 * direction, y: 0 };
  input.teams[0].players[5].position = { x: -25 * direction, y: -10 };
  input.teams[0].players[9].position = { x: 8 * direction, y: 10 };
  input.teams[1].players[6].position = { x: 8 * direction, y: 0 };
  input.ball = { teamId: 'home', ownerId: owner.id, position: { x: -9.65 * direction, y: 0 } };
  const simulation = api.createSimulation({ ...input, durationSeconds: reference ? undefined : durationSeconds });
  return { api, simulation, owner: simulation.teams[0].players.find(player => player.id === owner.id) };
}

function placeSceneTeam(team, side, direction) {
  team.direction = side ? -direction : direction;
  team.players.forEach((player, index) => { player.position = { x: (side ? 40 : -44) * direction, y: side ? 25 : -28 + index * .2 }; });
}

for (const direction of [1, -1]) {
  test(`available forward space is worth carrying into, direction ${direction}`, () => {
    const { api, simulation, owner } = openScene({ direction });
    const rng = simulation.rngState;
    const option = api.evaluateSimulationDribble(simulation, owner);
    assert.ok((option.target.x - owner.position.x) * direction > 6, 'advance diagonally instead of running almost sideways for extra safety');
    assert.equal(simulation.rngState, rng);
  });

  test(`a safe forward outlet beats an aimless carry, direction ${direction}`, () => {
    const { api, simulation, owner } = openScene({ direction });
    const rng = simulation.rngState;
    const options = api.evaluateSimulationOwnerOptions(simulation, owner);
    assert.equal(options.selected, 'pass');
    assert.equal(options.pass.option.safe, true);
    assert.ok((options.pass.option.target.x - owner.position.x) * direction > 15);
    assert.equal(simulation.rngState, rng);
  });
}

for (const formation of ['4-2-3-1', '4-4-2']) {
  test(`${formation} keeps a forward and a backward support plus a separate runner when the striker carries`, () => {
    const { api, simulation, owner } = openScene({ formation, striker: true });
    const team = simulation.teams[0];
    simulation.tick = 10;
    team.players.forEach(player => { player.nextDecisionTick = 0; });
    api.updateOffBallDecisions(simulation, team);
    api.prepareSimulationOwner(simulation);
    const supports = team.players.filter(player => player.role === 'support');
    assert.equal(supports.length, 2);
    assert.ok(supports.some(player => player.target.x > simulation.ball.position.x));
    assert.ok(supports.some(player => player.target.x < simulation.ball.position.x));
    assert.ok(team.players.some(player => player.role === 'depth' && player.id !== owner.id));
    simulation.ball.ownerId = null;
    simulation.ball.carry = { playerId: owner.id };
    team.players.forEach(player => { player.nextDecisionTick = 0; });
    api.updateOffBallDecisions(simulation, team);
    assert.ok(team.players.some(player => player.role === 'depth' && player.id !== owner.id));
  });
}

test('forward value does not make a cut-off pass safe and a defender still intercepts a real forced pass', () => {
  const { api, simulation, owner } = openScene();
  const receiver = simulation.teams[0].players[9], defender = simulation.teams[1].players[6];
  defender.position = { x: -1, y: 5 };
  const request = { toId: receiver.id, target: { ...receiver.position } };
  assert.equal(api.evaluateSimulationPass(simulation, request).safe, false);
  const options = api.evaluateSimulationOwnerOptions(simulation, owner);
  assert.ok(!options.pass.option || options.pass.option.safe);
  api.releaseSimulationPass(simulation, owner, api.evaluateSimulationPass(simulation, request));
  for (let tick = 0; tick < 30 && !simulation.events.some(event => event.type === 'interception'); tick++) api.stepSimulation(simulation);
  assert.ok(simulation.events.some(event => event.type === 'interception' && event.toId === defender.id));
});

test('all natural durations share the same physical attack decisions and reference decisions stay unchanged', () => {
  const natural = [180, 300, 420, 600].map(durationSeconds => {
    const { api, simulation, owner } = openScene({ durationSeconds });
    return plain(api.evaluateSimulationOwnerOptions(simulation, owner));
  });
  natural.forEach(options => assert.deepEqual(options, natural[0]));
  const { api, simulation, owner } = openScene({ reference: true });
  const reference = api.evaluateSimulationOwnerOptions(simulation, owner);
  assert.equal(reference.selected, 'dribble');
  assert.ok(Math.abs(reference.dribble.target.x - (-7.0481482861370495)) < 1e-10);
});
