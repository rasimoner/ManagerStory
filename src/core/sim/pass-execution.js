import MATCH_SIM_DATA from '../../data/match-sim.json';
import { simulationDeliveryFlight, recordSimulationCross } from './cross-delivery.js';
import { pointDistance } from './geometry.js';
import { drawSimulationRandom, simulationRuntime } from './simulation-runtime.js';
import { simulationOwnerPressure } from './pass-evaluation.js';
import { emitSimulationEvent } from './ball-events.js';
import { captureSimulationOffside } from './offside.js';
import { simulationNoLookPass } from './no-look-pass.js';
import { simulationPassTechniqueCue } from './pass-technique.js';

const { cos, sin } = Math;

export function releaseSimulationPass(simulation, owner, option) {
  captureSimulationOffside(simulation, owner, option.restartKind);
  const ball = simulation.ball, fromPos = { ...ball.position };
  const flight = simulationDeliveryFlight(simulation, owner, option);
  applyPassError(simulation, owner, flight);
  Object.assign(ball, flight, { ownerId: null, excludedId: owner.id, controlAfterTick: simulation.tick + owner.limits.reactionTicks });
  if (ball.control) ball.control = null;
  const eventIndex = emitSimulationEvent(simulation, { type: 'pass', fromId: owner.id, toId: option.toId, fromPos,
    ...(simulationPassTechniqueCue(simulation, owner) ?? simulationNoLookPass(simulation, owner, option)),
    ...(option.contactTime != null ? { time: option.contactTime, style: option.style, height: ball.height } : {}),
    ...(option.restartKind ? { restartKind: option.restartKind, temporaryRestart: false } : {}),
    toPos: { ...option.target }, teamId: owner.teamId, lofted: option.lofted, leadDistance: pointDistance(option.target, simulationRuntime(simulation).byId.get(option.toId).position), distance: pointDistance(fromPos, option.target) });
  ball.backpassTeamId = owner.teamId;
  ball.shot = null;
  ball.flight = { eventIndex, teamId: owner.teamId, fromId: owner.id, toId: option.toId, fromPos, target: { ...option.target }, launchTick: simulation.tick };
  simulation.statistics.teams[owner.teamId].passes++;
  simulation.passing.selected = { ...option, fromPos };
  simulation.passing.requested = null;
  if (simulation.passing.technique) simulation.passing.technique = null;
  recordSimulationCross(simulation, owner, option);
  return eventIndex;
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
