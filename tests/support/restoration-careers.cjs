const assert = require('node:assert/strict');
const { loadGame } = require('./game.cjs');

function career() {
  const game = loadGame({ quiet: true });
  game.run('S=fresh();init();S.matchSalt=73;setExperimentalMatchEngine(true);startMatch();setMatchView("3d")');
  return game;
}

function snapshot(game) {
  game.api.pauseLive(); game.api.save();
  return game.storage.get('msv4');
}

function restartCareer(kind) {
  const game = career(), api = game.api, sim = api.M.simulation;
  const team = sim.teams.find(team => team.id === 'user'), other = sim.teams.find(team => team.id !== 'user');
  api.placeSimulationBall(sim, { teamId: team.id, position: { x: 0, y: 0 } });
  if (['freeKick', 'penalty'].includes(kind)) {
    const foul = { x: (kind === 'penalty' ? 44 : 25) * team.direction, y: 2 };
    const restart = api.simulationFoulRestartPosition(foul, other.direction);
    api.stopSimulationForFoul(sim, { teamId: team.id, toPos: foul, restartPosition: restart.position, penaltyPending: restart.penaltyPending });
  } else createBoundaryRestart(game, kind);
  for (let tick = 0; tick < 1500 && sim.ball.restart; tick++) advanceCareer(game);
  assert.ok(sim.events.some(event => event.type === kind), 'physical ' + kind + ' released');
  return snapshot(game);
}

function createBoundaryRestart(game, kind) {
  const api = game.api, sim = api.M.simulation, team = sim.teams.find(team => team.id === 'user');
  const direction = team.direction * (kind === 'goalKick' ? -1 : 1);
  const before = kind === 'throwIn' ? { x: 8, y: 33.9 } : { x: 52.3 * direction, y: 20 };
  sim.ball.position = kind === 'throwIn' ? { x: 8, y: 34.3 } : { x: 52.8 * direction, y: 20 };
  sim.ball.lastTouchTeamId = sim.teams.find(team => team.id !== 'user').id;
  api.resolveSimulationBallOut(sim, { position: before }, { startTime: 0, seconds: .1 });
}

function airborneCareer(height) {
  const game = career(), api = game.api, sim = api.M.simulation;
  const player = sim.teams.find(team => team.id === 'user').players.find(player => player.slot === 'ST');
  player.position = { x: 0, y: 0 }; player.heading = 0;
  player.attributes.firstTouch = player.attributes.technique = 100;
  const before = { position: { x: 0, y: 0 }, velocity: { x: 3, y: 0 }, height, verticalVelocity: -.5 };
  api.placeSimulationBall(sim, { teamId: 'user', ...before });
  api.advanceSimulationClock(sim);
  const after = api.predictSimulationBall(before, .1);
  Object.assign(sim.ball, after);
  api.controlSimulationBall(sim, { player, previous: player.position, fraction: 1 }, { before, after });
  api.synchronizeExperimentalMatch({ time: sim.time, frame: api.captureSimulationFrame(sim), forcePlayers: true });
  return snapshot(game);
}

function ordinarySkillCareer() {
  const game = career();
  for (let tick = 0; tick < 2000 && !game.api.M.simulation.events.some(event => event.type === 'skill'); tick++) advanceCareer(game);
  assert.ok(game.api.M.simulation.events.some(event => event.type === 'skill'), 'the ordinary career generates a real skill cue');
  return snapshot(game);
}

function advanceCareer(game) {
  const match = game.api.M;
  if (match.reason === 'half') game.api.startSecondHalf();
  if (match.requiredSubstitution) game.api.queueExperimentalSubstitution({ outId: match.requiredSubstitution.playerId, inId: game.api.eligibleSubstitutes()[0].id });
  if (match.pause) game.api.resumeLive();
  game.api.advanceExperimentalPlayback(.1, { maxSteps: 1 });
}

function restorationCareers() {
  return Object.fromEntries(['throwIn', 'corner', 'goalKick', 'freeKick', 'penalty'].map(kind => [kind, restartCareer(kind)])
    .concat([['chest', airborneCareer(1.2)], ['head', airborneCareer(1.75)], ['skill', ordinarySkillCareer()]]));
}

module.exports = { restorationCareers };
