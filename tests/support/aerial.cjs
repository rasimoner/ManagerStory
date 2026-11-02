const { labFixture } = require('./lab.cjs');

function aerialFixture(options = {}) {
  const { height, direction, defending, x, bicycle } = { height: 1.65, direction: 1, defending: false, x: 42, bicycle: false, ...options };
  const { api, input } = labFixture({ seed: 73 });
  input.match = false; input.durationSeconds = 420;
  input.teams.forEach((team, index) => { team.direction = index ? -direction : direction; });
  const simulation = api.createSimulation(input), player = simulation.teams[defending ? 1 : 0].players.at(-1);
  for (const team of simulation.teams) for (const p of team.players) p.position = { x: -40 * direction, y: 25 };
  player.position = { x: x * direction, y: 1 }; player.heading = (direction < 0 ? Math.PI : 0) + (defending || bicycle ? Math.PI : 0);
  Object.assign(player.attributes, { technique: 95, firstTouch: 95, finishing: 95, passing: 95, vision: 95 });
  const ball = { x: (x + (bicycle ? .3 : -.05)) * direction, y: 1 };
  Object.assign(simulation.ball, { ownerId: null, position: ball, velocity: { x: (bicycle ? -8 : 8) * direction, y: 0 }, height, verticalVelocity: -1,
    lastTouchTeamId: 'home', flight: { eventIndex: 0, teamId: 'home', fromId: 'home-LW', toId: player.id,
      fromPos: { x: 30 * direction, y: -25 }, target: { ...player.position }, launchTick: 0, cross: true } });
  simulation.events = [{ type: 'pass', time: 0, fromPos: { x: 30 * direction, y: -25 }, success: null }];
  simulation.statistics.teams.home.passes = 1;
  return { api, simulation, player, direction };
}

module.exports = { aerialFixture };
