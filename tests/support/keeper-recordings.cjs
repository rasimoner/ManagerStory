const assert = require('node:assert/strict');
const { loadGame } = require('./game.cjs');
const { labFixture, plain } = require('./lab.cjs');

const KEEPER_SCENARIOS = [
  { label: 'catch-low-right', seed: 903, side: 1, power: 18, height: .4, handling: 100, direction: 1, seconds: 5 },
  { label: 'parry-low-left', seed: 902, side: -1, power: 28, height: .4, handling: 10, direction: 1, seconds: 3.5 },
  { label: 'parry-high-other-goal', seed: 903, side: 1, power: 25, height: 2.1, handling: 100, direction: -1, seconds: 3.5 },
  { label: 'miss-low-left', seed: 904, side: -1, power: 32, height: .4, handling: 100, direction: 1, x: 46, seconds: 3.5 },
  { label: 'near-step', seed: 903, side: .1, power: 18, height: .7, handling: 100, direction: -1, seconds: 3.5 },
];

function keeperScenario(options) {
  const api = loadGame({ skip: ['main.js'], quiet: true }).api, { input } = labFixture({ seed: options.seed });
  input.match = false;
  for (const [side, team] of input.teams.entries()) {
    team.direction = side === 0 ? options.direction : -options.direction;
    for (const [index, player] of team.players.entries()) player.position = { x: (-25 + side * 4) * options.direction, y: -28 + index * 5 };
  }
  const x = (options.x ?? 34) * options.direction, shooter = input.teams[0].players.at(-1), keeper = input.teams[1].players[0];
  shooter.position = { x, y: 0 };
  keeper.position = { x: 50 * options.direction, y: 0 };
  keeper.attributes.gk = { reflexes: 80, handling: options.handling, oneOnOne: 90 };
  input.ball = { position: { ...shooter.position }, teamId: 'home', ownerId: shooter.id };
  const simulation = api.createSimulation(input);
  simulation.automaticPasses = false;
  simulation.teams[1].players[0].keeper.setSeconds = 1;
  const player = simulation.teams[0].players.at(-1), option = api.evaluateSimulationShot(simulation, player);
  api.releaseSimulationShot(simulation, player, { ...option, target: { x: 52.5 * options.direction, y: options.side * 2.7, height: options.height }, power: options.power });
  return { api, simulation, keeperId: keeper.id };
}

function recordKeeperScenario(options) {
  const fixture = keeperScenario(options), frames = [plain(fixture.api.captureSimulationFrame(fixture.simulation))];
  for (let tick = 0; tick < options.seconds * 10; tick++) {
    fixture.api.stepSimulation(fixture.simulation);
    frames.push(plain(fixture.api.captureSimulationFrame(fixture.simulation)));
  }
  return { ...options, source: 'isolated core geometry; unchanged engine resolves the result', keeperId: fixture.keeperId,
    frames, events: plain(fixture.simulation.events) };
}

function ordinaryKeeperCareer() {
  const game = loadGame({ quiet: true });
  game.run('S=fresh();init();S.matchSalt=73;setExperimentalMatchEngine(true);startMatch();setMatchView("3d")');
  game.run('for(let tick=0;tick<690;tick++)advanceExperimentalPlayback(.1,{maxSteps:1});pauseLive();save()');
  const storage = game.storage.get('msv4'), frames = [];
  let duringSaveStorage;
  game.api.resumeLive();
  for (let tick = 0; tick < 45; tick++) {
    game.api.advanceExperimentalPlayback(.1, { maxSteps: 1 });
    frames.push(plain(game.api.captureSimulationFrame(game.api.M.simulation)));
    if (!duringSaveStorage && game.api.M.simulation.events.some(event => event.type === 'save' && event.time >= 69)) {
      game.api.pauseLive(); game.api.save(); duringSaveStorage = game.storage.get('msv4'); game.api.resumeLive();
    }
  }
  const save = game.api.M.simulation.events.find(event => event.type === 'save' && event.time >= 69);
  assert.ok(save, 'the unchanged ordinary career produces a real save in the recorded window');
  return { storage, duringSaveStorage, frames, save: plain(save), source: 'ordinary career; seed salt 73; no geometry or results overridden' };
}

module.exports = { KEEPER_SCENARIOS, keeperScenario, recordKeeperScenario, ordinaryKeeperCareer };
