const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./support/game.cjs');

function match() {
  const game = loadGame({ quiet: true });
  game.run('S=fresh();init();S.matchSalt=73;setExperimentalMatchEngine(true);startMatch()');
  return game;
}

test('the detached drawing contract includes physical motion, direction, goalkeeper and contact state', () => {
  const game = match(), simulation = game.api.M.simulation;
  const before = JSON.stringify(game.api.snapshotSimulation(simulation));
  const frame = game.api.captureSimulationFrame(simulation);
  const player = frame.players[0];
  assert.deepEqual({ ...player.velocity }, { x: 0, y: 0 });
  assert.equal(player.direction, simulation.teams[0].direction);
  assert.equal(player.slot, simulation.teams[0].players[0].slot);
  assert.ok(player.keeper && player.duel);
  assert.equal(frame.ball.heldBy, simulation.ball.heldBy);
  frame.players[0].keeper.mode = 'test';
  frame.ball.position.x = 999;
  assert.equal(JSON.stringify(game.api.snapshotSimulation(simulation)), before);
});

test('metres, height and heading map once to the scene, for either direction and half', () => {
  const game = match();
  assert.deepEqual({ ...game.api.simulationWorldPoint({ x: -52.5, y: 34 }, 2.44) }, { x: -52.5, y: 2.55, z: 34 });
  assert.equal(game.api.simulationWorldHeading(0), Math.PI / 2);
  assert.equal(game.api.simulationWorldHeading(Math.PI), -Math.PI / 2);
  for (const team of game.api.M.simulation.teams) {
    const player = team.players[0];
    const scene = game.api.sampleSimulationScene(game.api.M.simulationPlayback, { immediate: true });
    const drawn = scene.players.find(item => item.id === player.id);
    assert.equal(drawn.position.x, player.position.x);
    assert.equal(drawn.position.z, player.position.y);
    assert.equal(drawn.direction, team.direction);
  }
});

test('visual samples stay between observed physical frames and never advance or mutate the engine', () => {
  const game = match(), playback = game.api.M.simulationPlayback;
  game.run('advanceExperimentalPlayback(.1,{maxSteps:10})');
  const previous = playback.previousFrame, current = playback.frame;
  game.run('advanceExperimentalPlayback(.025,{maxSteps:10})');
  assert.equal(playback.previousFrame, previous, 'RAF-only draws retain the last physical frame');
  const snapshot = JSON.stringify(game.api.snapshotSimulation(game.api.M.simulation));
  const drawn = game.api.sampleSimulationScene(playback);
  assert.ok(drawn.physicsTime >= previous.physicsTime && drawn.physicsTime <= current.physicsTime);
  assert.ok(Math.abs(drawn.alpha - .25) < 1e-9);
  const player = drawn.players[5], from = previous.players[5].position, to = current.players[5].position;
  assert.ok(Math.abs(player.position.x - (from.x + (to.x - from.x) * .25)) < 1e-9);
  for (let index = 0; index < 20; index++) game.api.sampleSimulationScene(playback);
  assert.equal(JSON.stringify(game.api.snapshotSimulation(game.api.M.simulation)), snapshot);
});

test('scene membership follows the real active roster without keeping removed players', () => {
  const game = match();
  game.run('M.simulation.teams[0].players.at(-1).sentOff=true;refreshPlaybackFrame(M.simulationPlayback,M.simulation)');
  const scene = game.api.sampleSimulationScene(game.api.M.simulationPlayback, { immediate: true });
  assert.equal(scene.players.length, 21);
  assert.ok(scene.players.every(player => !player.sentOff));
});

test('switching views preserves the active object, exact clock, lineup, score and RNG without enabling the old director', () => {
  const game = match(), active = game.api.M, simulation = active.simulation;
  game.run('advanceExperimentalPlayback(1,{maxSteps:20})');
  const checkpoint = JSON.stringify(game.api.snapshotSimulation(simulation));
  game.run('presentation.live3d={enable(){throw new Error("Legacy driver reached")}}');
  for (const view of ['3d', '2d', '3d']) {
    game.api.setMatchView(view);
    assert.equal(active.fieldView, view);
    assert.equal(game.api.M, active);
    assert.equal(game.api.M.simulation, simulation);
    assert.equal(JSON.stringify(game.api.snapshotSimulation(simulation)), checkpoint);
  }
});

test('2D and 3D execute identical physical-step commands and retain events, RNG and final state', () => {
  const flat = match(), spatial = match();
  spatial.api.setMatchView('3d');
  for (const game of [flat, spatial]) game.run(`
    for(let tick=0;tick<4200;tick++){
      if(M.reason==='half')startSecondHalf();
      if(M.requiredSubstitution){
        const incoming=eligibleSubstitutes()[0];
        if(incoming)queueExperimentalSubstitution({outId:M.requiredSubstitution.playerId,inId:incoming.id});
      }
      if(M.pause)resumeLive();
      if(M.simulation.tick===30)setMatchTactic('press','Yüksek');
      if(M.pause&&!M.requiredSubstitution)resumeLive();
      advanceExperimentalPlayback(.1,{maxSteps:1});
      sampleSimulationScene(M.simulationPlayback);
    }`);
  assert.equal(flat.api.M.matchElapsedSeconds, 5400);
  assert.deepEqual(spatial.json('snapshotSimulation(M.simulation)'), flat.json('snapshotSimulation(M.simulation)'));
  assert.deepEqual(spatial.json('[M.hg,M.ag,M.active]'), flat.json('[M.hg,M.ag,M.active]'));
});

test('a 3D failure explains the fallback and keeps the same match and persisted checkpoint', () => {
  const game = match(), simulation = game.api.M.simulation;
  game.api.setMatchView('3d');
  game.api.fallbackSimulationView(new Error('WebGL unavailable'));
  assert.equal(game.api.M.fieldView, '2d');
  assert.equal(game.api.M.simulation, simulation);
  assert.match(game.html(), /3D.*2D.*devam/s);
  game.api.save();
  const restored = loadGame({ storage: game.storage, quiet: true });
  assert.equal(restored.api.M.simulation.tick, simulation.tick);
});

test('old saved drawing caches are rebuilt from the checkpoint without changing physics or RNG', () => {
  const game = match();
  game.run('advanceExperimentalPlayback(1,{maxSteps:20});pauseLive();save()');
  const career = JSON.parse(game.storage.get('msv4')), saved = game.api.unpackMatchSnapshot(career.activeMatchV71);
  for (const player of saved.simulationPlayback.frame.players) { delete player.velocity; delete player.keeper; delete player.heading; }
  delete saved.simulationPlayback.frame.contacts;
  saved.fieldView = '3d';
  career.activeMatchV71 = game.api.packExperimentalMatch(saved);
  game.storage.set('msv4', JSON.stringify(career));
  const restored = loadGame({ storage: game.storage, quiet: true });
  assert.equal(restored.api.M.fieldView, '3d');
  assert.deepEqual(restored.json('snapshotSimulation(M.simulation)'), game.json('snapshotSimulation(M.simulation)'));
  const scene = restored.api.sampleSimulationScene(restored.api.M.simulationPlayback);
  assert.ok(scene.players.every(player => player.velocity && player.keeper));
});

test('pause/resume cannot send the interpolated drawing clock backwards', () => {
  const game = match();
  game.run('advanceExperimentalPlayback(.125,{maxSteps:10});pauseLive()');
  const paused = game.api.sampleSimulationScene(game.api.M.simulationPlayback, { immediate: true });
  game.run('resumeLive();advanceExperimentalPlayback(.01,{maxSteps:10})');
  const resumed = game.api.sampleSimulationScene(game.api.M.simulationPlayback);
  assert.ok(resumed.physicsTime >= paused.physicsTime);
});
