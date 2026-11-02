import MATCH_SIM_DATA from '../../data/match-sim.json';
import RESTART_DATA from '../../data/match-sim-restarts.json';
import { chooseSimulationAerial } from './aerial-choice.js';
import { emitSimulationEvent, settleSimulationPass } from './ball-events.js';
import { releaseSimulationShot } from './shot-execution.js';
import { releaseSimulationPass } from './pass-execution.js';
import { predictSimulationBall, simulationPassFlight } from './ball-physics.js';
import { clampSimValue } from './geometry.js';
import { drawSimulationRandom } from './simulation-runtime.js';

export function redirectSimulationAerial(simulation, player, { touching, time }) {
  if (!simulation.clock.pauseHalfPreparation || !simulation.ball.flight?.cross || player.slot === 'GK') return false;
  Object.assign(simulation.ball, touching);
  const choice = chooseSimulationAerial(simulation, player, touching);
  if (!choice) return false;
  settleSimulationPass(simulation, { position: touching.position, controlled: true, playerId: player.id, teamId: player.teamId, time });
  const index = emitSimulationEvent(simulation, { type: 'aerialContact', time, kind: choice.kind, result: choice.result,
    fromId: player.id, teamId: player.teamId, fromPos: { ...touching.position }, toPos: { ...choice.option?.target ?? touching.position }, height: touching.height });
  if (choice.result === 'shot') releaseSimulationShot(simulation, player, { ...choice.option, contactTime: time });
  else if (choice.result === 'pass') releaseHeadPass(simulation, player, { ...choice.option, startHeight: touching.height, contactTime: time, style: choice.kind });
  else releaseAerialClearance(simulation, player, { touching, time });
  simulation.events[index].toPos = { ...simulation.ball.position };
  Object.assign(simulation.ball, predictSimulationBall(simulation.ball, Math.max(0, simulation.time - time)));
  return true;
}

function releaseHeadPass(simulation, player, option) {
  simulation.ball.flight = null;
  releaseSimulationPass(simulation, player, option);
  simulation.ball.backpassTeamId = null;
}

function releaseAerialClearance(simulation, player, { touching, time }) {
  const settings = RESTART_DATA.aerial, pitch = MATCH_SIM_DATA.pitch;
  const direction = simulation.teams.find(team => team.id === player.teamId).direction;
  const error = (drawSimulationRandom(simulation) * 2 - 1) * settings.clearanceError * (1 - player.attributes.technique / MATCH_SIM_DATA.attributes.maximum);
  const target = { x: clampSimValue(touching.position.x + direction * settings.clearanceDistance, -pitch.length / 2, pitch.length / 2),
    y: clampSimValue(touching.position.y + error, -pitch.width / 2, pitch.width / 2) };
  const flight = simulationPassFlight(touching.position, target, { lofted: true, startHeight: touching.height });
  Object.assign(simulation.ball, flight, { ownerId: null, flight: null, shot: null, carry: null, control: null, assist: null,
    teamId: player.teamId, lastTouchId: player.id, lastTouchTeamId: player.teamId, excludedId: player.id,
    controlAfterTick: simulation.tick + player.limits.reactionTicks, backpassTeamId: null });
  emitSimulationEvent(simulation, { type: 'clearance', time, fromId: player.id, teamId: player.teamId, fromPos: { ...touching.position }, toPos: target });
}
