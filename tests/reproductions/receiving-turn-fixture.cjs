const { labFixture } = require('../support/lab.cjs');

function receivingFixture(direction = 1) {
  const { api, input } = labFixture({ seed: 73 }); input.match = false;
  input.teams.forEach((team, index) => { team.direction = index ? -direction : direction; });
  const simulation = api.createSimulation(input), player = simulation.teams[0].players.at(-1), defender = simulation.teams[1].players.at(-1);
  for (const team of simulation.teams) for (const p of team.players) { p.position = { x: -35 * direction, y: 25 }; p.target = { ...p.position }; }
  Object.assign(player.attributes, { technique: 95, firstTouch: 95, dribbling: 95 });
  player.position = { x: 30 * direction, y: 0 }; player.heading = direction < 0 ? 0 : Math.PI;
  defender.position = { x: 31.25 * direction, y: 0 }; defender.target = { ...defender.position }; defender.heading = player.heading;
  defender.duel.nextTackleTick = 10000;
  Object.assign(simulation.ball, { ownerId: null, carry: null, control: null, position: { x: 29.4 * direction, y: 0 }, velocity: { x: 6 * direction, y: 0 }, height: 0, verticalVelocity: 0 });
  const eventIndex = api.emitSimulationEvent(simulation, { type: 'pass', fromId: 'home-CAM', toId: player.id, teamId: player.teamId,
    fromPos: { x: 20 * direction, y: 0 }, toPos: { ...player.position }, success: null });
  simulation.ball.flight = { eventIndex, teamId: player.teamId, fromId: 'home-CAM', toId: player.id, fromPos: { x: 20 * direction, y: 0 }, target: { ...player.position }, launchTick: 0 };
  return { api, simulation, player, defender, direction };
}

module.exports = { receivingFixture };
