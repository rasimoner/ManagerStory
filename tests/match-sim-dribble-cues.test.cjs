const test = require('node:test');
const assert = require('node:assert/strict');
const { labFixture, plain } = require('./support/lab.cjs');
const { sceneFixture } = require('./support/simulation-scene.cjs');
const { loadGame } = require('./support/game.cjs');

function skillFixture() {
  const { api, simulation } = labFixture({ seed: 731 });
  simulation.match.enabled = false;
  const owner = simulation.teams[0].players.at(-1), defender = simulation.teams[1].players[4];
  owner.position = { x: 30, y: 0 }; owner.heading = 0; owner.velocity = { x: 3, y: 0 };
  for (const player of simulation.teams[1].players) player.position = { x: -30, y: 20 };
  defender.position = { x: 31.5, y: 0 }; defender.duel.state = 'jockey'; defender.velocity = { x: 3, y: 2 };
  api.placeSimulationBall(simulation, { teamId: 'home', ownerId: owner.id, position: { x: 30.35, y: 0 } });
  simulation.ownerDecision.selected = 'dribble';
  api.trackSimulationBeats(simulation);
  return { api, simulation, owner, defender };
}

function traceTurn(fixture, heading) {
  const { api, simulation, owner, defender } = fixture;
  simulation.tick++; simulation.time = simulation.physicsTime = simulation.tick * .1;
  owner.heading = heading; owner.velocity = { x: Math.cos(heading) * 3, y: Math.sin(heading) * 3 };
  owner.position.x += owner.velocity.x * .1; owner.position.y += owner.velocity.y * .1;
  defender.position.x += defender.velocity.x * .1; defender.position.y += defender.velocity.y * .1;
  api.followSimulationBallOwner(simulation);
  api.trackSimulationBeats(simulation);
}

test('only measured changes of direction in a real encounter emit cut and body-feint cues', () => {
  const fixture = skillFixture();
  for (const heading of [.4, .8, .4, 0, -.4]) traceTurn(fixture, heading);
  const skills = fixture.simulation.events.filter(event => event.type === 'skill');
  assert.deepEqual(plain(skills.map(event => event.kind)), ['cut', 'bodyFeint']);
  for (const skill of skills) {
    assert.equal(skill.fromId, fixture.owner.id);
    assert.equal(skill.toId, fixture.defender.id);
    assert.ok(Math.abs(skill.turn) >= .65);
  }
  const quiet = skillFixture(); quiet.defender.position = { x: -30, y: -30 };
  for (const heading of [.4, .8, .4, 0, -.4]) traceTurn(quiet, heading);
  assert.equal(quiet.simulation.events.some(event => event.type === 'skill'), false);
});

test('observing a skill never changes the ball, players, football statistics or RNG', () => {
  const fixture = skillFixture(), game = loadGame({ quiet: true });
  traceTurn(fixture, .4);
  fixture.owner.heading = .8;
  const simulation = fixture.simulation, control = game.api.restoreSimulation(game.api.snapshotSimulation(simulation));
  const before = plain({ ball: simulation.ball, teams: simulation.teams, statistics: simulation.statistics, rng: simulation.rngState });
  fixture.api.observeSimulationDribbleChange(simulation, simulation.defending.engagements[0], { owner: fixture.owner, defender: fixture.defender });
  assert.deepEqual(plain({ ball: simulation.ball, teams: simulation.teams, statistics: simulation.statistics, rng: simulation.rngState }), before);
  for (let index = 0; index < 200; index++) { fixture.api.stepSimulation(simulation); game.api.stepSimulation(control); }
  assert.deepEqual(physicalTeams(simulation), physicalTeams(control));
  assert.deepEqual(plain(simulation.statistics), plain(control.statistics));
  assert.equal(simulation.rngState, control.rngState);
  assert.deepEqual(plain(simulation.ball.position), plain(control.ball.position));
  assert.equal(simulation.ball.ownerId, control.ball.ownerId);
});

test('observed skills reuse old poses, release back to running and receive actual close-up cameras', async () => {
  const fixture = skillFixture(), game = loadGame({ quiet: true }), scene = await sceneFixture();
  for (const heading of [.4, .8]) traceTurn(fixture, heading);
  const frame = game.api.sampleSimulationScene({ frame: game.api.captureSimulationFrame(fixture.simulation) }, { immediate: true });
  const skill = frame.contacts.find(event => event.type === 'skill');
  assert.ok(skill);
  skill.closeUp = true;
  scene.actors.apply(frame);
  const actor = scene.runtime.players.find(actor => actor.id === fixture.owner.id);
  assert.match(actor.act?.name, /^cut/);
  assert.equal(scene.api.simulationCameraShot(frame, 'auto').mode, 'close');
  assert.equal(scene.api.simulationSceneCaption(frame).text, 'Yön değiştirme');
  frame.physicsTime += 2;
  scene.actors.apply(frame);
  assert.equal(actor.act, null);
});

function physicalTeams(simulation) {
  return plain(simulation.teams.flatMap(team => team.players.map(player => ({ id: player.id, position: player.position, velocity: player.velocity, heading: player.heading, fitness: player.attributes.fitness }))));
}
