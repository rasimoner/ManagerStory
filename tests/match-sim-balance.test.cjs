const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { labFixture } = require('./support/lab.cjs');

function boxScene() {
  const fixture = labFixture({ seed: 901 });
  fixture.input.match = false;
  const attacker = fixture.input.teams[0].players.at(-1);
  attacker.position = { x: 37, y: 2 };
  fixture.input.ball = { position: { ...attacker.position }, ownerId: attacker.id, teamId: 'home' };
  fixture.simulation = fixture.api.createSimulation(fixture.input);
  fixture.simulation.liveBall = true;
  return fixture;
}

test('live box defence narrows, protects the goal side and assigns a rebound screen', () => {
  const { api, simulation } = boxScene();
  const team = simulation.teams[1];
  const shape = api.simTeamShape(simulation, team);
  assert.ok(shape.width < api.MATCH_SIM_DATA.shape.defending.width);
  for (const player of team.players) player.nextDecisionTick = 0;
  api.updateOffBallDecisions(simulation, team);
  assert.ok(team.players.some(player => player.role === 'rebound'));
  const marker = team.players.find(player => player.role === 'mark');
  assert.ok(marker);
  const receiver = simulation.teams[0].players.find(player => player.id === marker.laneTargetId);
  assert.ok(marker.target.x >= receiver.position.x, 'defender stands between receiver and own goal');
});

test('clear central open-play xG has a plausible distance curve and shares the physical block radius', () => {
  const { api, simulation } = boxScene();
  const shooter = simulation.teams[0].players.at(-1);
  for (const opponent of simulation.teams[1].players) opponent.position = { x: -35, y: 30 };
  simulation.teams[1].players[0].position = { x: 51, y: 0 };
  shooter.heading = 0;
  for (const [distance, minimum, maximum] of [[5, 0.3, 0.5], [11, 0.15, 0.25], [18, 0.04, 0.09], [25, 0.015, 0.04]]) {
    shooter.position = { x: 52.5 - distance, y: 0 };
    const option = api.evaluateSimulationShot(simulation, shooter);
    assert.ok(option.xg >= minimum && option.xg <= maximum, `${distance} m: ${option.xg}`);
  }
  assert.equal(api.MATCH_SIM_DATA.shooting.outfieldShotReach, undefined, 'one block radius is used by evaluation and contact');
});

test('a preparing defender predicts the moving ball from the future launch point', () => {
  const { api, simulation } = boxScene();
  const victim = simulation.teams[0].players.at(-1), defender = simulation.teams[1].players[2];
  defender.position = { x: 35.5, y: 1.6 };
  defender.velocity = { x: 3, y: 0 };
  victim.velocity = { x: 4, y: 0 };
  api.beginSimulationTackle(simulation, defender, { victim, kind: 'standing' });
  assert.ok(defender.duel.tackle.aim);
  const aim = defender.duel.tackle.aim;
  assert.ok(aim.x > simulation.ball.position.x);
  assert.ok(api.MATCH_SIM_DATA.duels.footRadius > 0.16);
});

test('goal, reach and tackle resolution cannot draw an outcome lottery', () => {
  for (const name of ['match-lifecycle', 'keeper-reaction', 'tackle-resolution', 'shot-step', 'shot-blocks', 'box-defending']) {
    const source = fs.readFileSync(path.join(__dirname, '../src/core/sim', `${name}.js`), 'utf8');
    assert.doesNotMatch(source, /drawSimulationRandom|Math\.random|goalQuota|saveQuota|tackleQuota/);
  }
});

test('a fast slide through the ball into a leg is a foul; stopping before the leg stays legal', () => {
  for (const [endX, expected] of [[36.7, true], [37.5, false]]) {
    const { api, simulation } = boxScene();
    const victim = simulation.teams[0].players.at(-1), defender = simulation.teams[1].players[2];
    defender.position = { x: 39, y: 2 };
    api.resolveSimulationTackle(simulation, { defenderId: defender.id, victimId: victim.id, kind: 'sliding',
      from: { ...defender.position }, to: { x: endX, y: 2 }, speed: 11 });
    assert.equal(simulation.events.some(event => event.type === 'foul'), expected);
  }
});

test('shot blocking uses the same planted body and leg envelope as the decision model', () => {
  const { api, simulation } = boxScene();
  const shooter = simulation.teams[0].players.at(-1), defender = simulation.teams[1].players[2];
  shooter.position = { x: 35, y: 0 };
  api.placeSimulationBall(simulation, { ownerId: shooter.id, teamId: 'home', position: { ...shooter.position } });
  defender.position = { x: 39, y: 1.1 };
  simulation.automaticPasses = false;
  api.requestSimulationShot(simulation);
  Object.assign(simulation.ball, { velocity: { x: 25, y: 0 }, height: 0, verticalVelocity: 0 });
  for (let tick = 0; tick < 2; tick++) api.stepSimulation(simulation);
  assert.equal(simulation.events.filter(event => event.type === 'block').length, 0);
  assert.ok(api.MATCH_SIM_DATA.shooting.blockRadius < api.MATCH_SIM_DATA.ball.controlRadius);
});
