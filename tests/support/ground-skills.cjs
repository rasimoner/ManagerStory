const { labFixture } = require('./lab.cjs');

function skillFixture(direction = 1) {
  const { api, input } = labFixture({ seed: 73 });
  input.match = false; input.durationSeconds = 420;
  input.teams.forEach((team, index) => { team.direction = index ? -direction : direction; });
  const simulation = api.createSimulation(input), owner = simulation.teams[0].players.at(-1), defender = simulation.teams[1].players.at(-1);
  for (const team of simulation.teams) for (const player of team.players) { player.position = { x: -40 * direction, y: 25 }; player.target = { ...player.position }; }
  Object.assign(owner.attributes, { dribbling: 95, technique: 95, firstTouch: 95, vision: 95 });
  owner.position = { x: 30 * direction, y: 0 }; owner.heading = direction < 0 ? Math.PI : 0;
  defender.position = { x: 32.8 * direction, y: .4 }; defender.target = { ...defender.position };
  defender.duel.nextTackleTick = 10000;
  api.placeSimulationBall(simulation, { teamId: owner.teamId, ownerId: owner.id, position: { x: 30.35 * direction, y: 0 } });
  api.forceSimulationDribble(simulation, owner.id);
  simulation.ownerDecision.dribble = { target: { x: 40 * direction, y: 0 }, score: 100 };
  return { api, simulation, owner, defender, direction };
}

module.exports = { skillFixture };
