import MATCH_SIM_DATA from '../../data/match-sim.json';
import { simulationPassFlight } from './ball-physics.js';
import { pointDistance } from './geometry.js';
import { drawSimulationRandom, simulationRuntime } from './simulation-runtime.js';
import { simulationOwnerPressure } from './pass-evaluation.js';
import { emitSimulationEvent } from './ball-events.js';

const { cos, sin } = Math;

export function releaseSimulationPass(simulation, owner, option) {
  const ball = simulation.ball, fromPos = { ...ball.position };
  const flight = simulationPassFlight(fromPos, option.target, option.lofted);
  applyPassError(simulation, owner, flight);
  Object.assign(ball, flight, { ownerId: null, excludedId: owner.id, controlAfterTick: simulation.tick + owner.limits.reactionTicks });
  const eventIndex = emitSimulationEvent(simulation, { type: 'pass', fromId: owner.id, toId: option.toId, fromPos,
    toPos: { ...option.target }, teamId: owner.teamId, lofted: option.lofted, leadDistance: pointDistance(option.target, simulationRuntime(simulation).byId.get(option.toId).position), distance: pointDistance(fromPos, option.target) });
  ball.backpassTeamId = owner.teamId;
  ball.shot = null;
  ball.flight = { eventIndex, teamId: owner.teamId, fromId: owner.id, toId: option.toId, fromPos, target: { ...option.target }, launchTick: simulation.tick };
  simulation.statistics.teams[owner.teamId].passes++;
  simulation.passing.selected = { ...option, fromPos };
  simulation.passing.requested = null;
}

function applyPassError(simulation, owner, flight) {
  const settings = MATCH_SIM_DATA.passing;
  const error = (1 - owner.attributes.passing / MATCH_SIM_DATA.attributes.maximum) * (1 + simulationOwnerPressure(simulation, owner) * settings.pressureErrorFactor);
  const angle = (drawSimulationRandom(simulation) * 2 - 1) * settings.angleError * error;
  const speed = 1 + (drawSimulationRandom(simulation) * 2 - 1) * settings.speedError * error;
  const { x, y } = flight.velocity;
  flight.velocity.x = (x * cos(angle) - y * sin(angle)) * speed;
  flight.velocity.y = (x * sin(angle) + y * cos(angle)) * speed;
}
