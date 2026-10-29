const test = require('node:test');
const assert = require('node:assert/strict');
const { labFixture, loadNativeLab, plain } = require('./support/lab.cjs');

function replacement(input, id = 'bench-1') {
  return { ...plain(input.teams[0].players.at(-1)), id, number: 19 };
}

test('a substitution waits for a football stoppage, replaces the slot and cannot replace a sent-off player', () => {
  const { api, input, simulation } = labFixture();
  simulation.match.phase = 'playing';
  const out = simulation.teams[0].players.at(-1);
  api.requestSimulationSubstitution(simulation, { teamId: 'home', outId: out.id, player: replacement(input) });
  assert.ok(simulation.teams[0].players.includes(out));
  api.applySimulationCommands(simulation);
  assert.ok(simulation.teams[0].players.includes(out));
  simulation.match.phase = 'half';
  api.applySimulationCommands(simulation);
  assert.equal(simulation.teams[0].players.length, 11);
  assert.equal(simulation.teams[0].players.at(-1).id, 'bench-1');
  assert.equal(simulation.events.at(-1).type, 'substitution');
  const dismissed = simulation.teams[0].players[2];
  dismissed.sentOff = true;
  assert.throws(() => api.requestSimulationSubstitution(simulation, { teamId: 'home', outId: dismissed.id, player: replacement(input, 'bench-2') }), /sent.off/i);
});

test('tactics and formation affect only the named team and record the exact application step', () => {
  const { api, simulation } = labFixture();
  const away = plain(simulation.teams[1]);
  api.commandSimulationTactics(simulation, { teamId: 'home', tactics: { press: 'Yüksek', width: 'Dar', tempo: 'Yüksek' }, formation: '4-4-2' });
  assert.equal(simulation.teams[0].formation, '4-4-2');
  assert.equal(simulation.teams[0].tactics.press, 'Yüksek');
  assert.deepEqual(plain(simulation.teams[1]), away);
  assert.equal(simulation.events.at(-1).tick, simulation.tick);
  assert.throws(() => api.commandSimulationTactics(simulation, { teamId: 'home', tactics: { tempo: 'INVALID' } }), /tactic|tempo/i);
});

test('pause freezes every step, and resume is an explicit logged command', () => {
  const { api, simulation } = labFixture();
  api.pauseSimulation(simulation);
  const tick = simulation.tick;
  api.advanceSimulation(simulation, { seconds: 20 });
  assert.equal(simulation.tick, tick);
  api.resumeSimulation(simulation);
  api.stepSimulation(simulation);
  assert.equal(simulation.tick, tick + 1);
  assert.ok(simulation.events.some(event => event.type === 'pause'));
});

test('individual instructions name their player and unsupported behaviour is explicitly logged as inactive', () => {
  const { api, simulation } = labFixture();
  const player = simulation.teams[0].players.at(-1);
  api.commandSimulationInstruction(simulation, { teamId: 'home', playerId: player.id, key: 'shoot' });
  assert.equal(player.instruction, 'shoot');
  assert.equal(simulation.events.at(-1).effective, true);
  api.commandSimulationInstruction(simulation, { teamId: 'home', playerId: player.id, key: 'overlap' });
  assert.equal(simulation.events.at(-1).effective, false);
});

test('contact injuries withdraw the victim and stop play; a replacement restores only that missing slot', () => {
  const { api, input, simulation } = labFixture();
  const victim = simulation.teams[0].players.at(-1);
  api.injureSimulationPlayer(simulation, { playerId: victim.id, cause: 'contact' });
  assert.equal(simulation.teams[0].players.length, 10);
  assert.equal(simulation.referee.stoppage.kind, 'injury');
  api.requestSimulationSubstitution(simulation, { teamId: 'home', outId: victim.id, player: replacement(input) });
  api.applySimulationCommands(simulation);
  assert.equal(simulation.teams[0].players.length, 11);
  assert.equal(simulation.events.filter(event => event.type === 'injury').length, 1);
});

test('distance, sprinting and contact consume fitness and update movement capacity', () => {
  const { api, simulation } = labFixture();
  const player = simulation.teams[0].players.at(-1);
  simulation.workload.enabled = true;
  player.velocity = { x: 7, y: 0 };
  player.gait = 'sprint';
  const speed = player.limits.maxSpeed;
  for (let step = 0; step < 100; step++) api.consumeSimulationFitness(simulation);
  assert.ok(player.attributes.fitness < 100);
  assert.ok(player.limits.maxSpeed < speed);
  assert.ok(player.workload.distanceMetres > 60);
});

test('a JSON round trip preserves the RNG, chase cache and pending commands through the final whistle', async () => {
  const api = await loadNativeLab(['createSimulation', 'createLabScenario', 'stepSimulation', 'snapshotSimulation', 'restoreSimulation', 'requestSimulationSubstitution']);
  const original = api.createSimulation(api.createLabScenario({ seed: 16 }));
  for (let tick = 0; tick < 27113; tick++) api.stepSimulation(original);
  const incoming = { ...structuredClone(original.teams[0].players.at(-1)), id: 'bench-1', number: 19 };
  api.requestSimulationSubstitution(original, { teamId: 'home', outId: original.teams[0].players.at(-1).id, player: incoming });
  const restored = api.restoreSimulation(JSON.parse(JSON.stringify(api.snapshotSimulation(original))));
  while (original.match.phase !== 'ended') api.stepSimulation(original);
  while (restored.match.phase !== 'ended') api.stepSimulation(restored);
  assert.deepEqual(api.snapshotSimulation(restored), api.snapshotSimulation(original));
});
