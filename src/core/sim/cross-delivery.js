import MATCH_SIM_DATA from '../../data/match-sim.json';
import RESTART_DATA from '../../data/match-sim-restarts.json';
import { simulationPassFlight } from './ball-physics.js';
import { pointDistance } from './geometry.js';
import { emitSimulationEvent } from './ball-events.js';

export function planSimulationCross(simulation, taker) {
  const settings = RESTART_DATA.delivery;
  const skill = (taker.attributes.passing + taker.attributes.technique) / (2 * MATCH_SIM_DATA.attributes.maximum);
  if (skill < settings.minimumSkill) return { kind: 'short' };
  const team = simulation.teams.find(team => team.id === taker.teamId);
  const target = { x: settings.runnerPositions[0].x * team.direction, y: settings.runnerPositions[0].y };
  const runners = team.players.filter(player => player.slot !== 'GK' && player.id !== taker.id && !player.sentOff);
  const receiver = runners.sort((a, b) => pointDistance(a.position, target) - pointDistance(b.position, target))[0];
  return receiver ? { kind: 'cross', target, receiverId: receiver.id } : { kind: 'short' };
}

export function simulationCrossCandidate(simulation, owner, option) {
  if (!simulation.clock.pauseHalfPreparation || !option.lofted) return false;
  if (option.cross) return true;
  const settings = RESTART_DATA.delivery, team = simulation.teams.find(team => team.id === owner.teamId);
  return owner.position.x * team.direction >= settings.openPlayX && Math.abs(owner.position.y) >= settings.wideY
    && option.target.x * team.direction >= settings.minimumTargetX && Math.abs(option.target.y) <= settings.maximumTargetY;
}

export function simulationDeliveryFlight(simulation, owner, option) {
  const cross = simulationCrossCandidate(simulation, owner, option);
  return simulationPassFlight(simulation.ball.position, option.target, { lofted: !!option.lofted,
    startHeight: option.startHeight ?? 0, arrivalHeight: cross ? RESTART_DATA.delivery.arrivalHeight : 0 });
}

export function recordSimulationCross(simulation, owner, option) {
  if (!simulationCrossCandidate(simulation, owner, option)) return;
  const ball = simulation.ball;
  ball.flight.cross = true;
  ball.flight.crossEventIndex = emitSimulationEvent(simulation, { type: 'cross', fromId: owner.id, toId: option.toId, teamId: owner.teamId,
    fromPos: { ...ball.position }, toPos: { ...option.target }, height: ball.height, restartKind: option.restartKind });
}
