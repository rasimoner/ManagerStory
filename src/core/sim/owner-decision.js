import MATCH_SIM_DATA from '../../data/match-sim.json';
import { pointDistance } from './geometry.js';
import { validateSimPosition } from './validation.js';
import { simulationRuntime } from './simulation-runtime.js';
import { evaluateSimulationPass, evaluateSimulationPassOptions, simulationOwnerPressure } from './pass-evaluation.js';
import { followSimulationBallOwner } from './ball-possession.js';
import { releaseSimulationPass } from './pass-execution.js';
import { faceSimulationPlayer } from './player-movement.js';

const { abs, atan2, sin, cos, max, hypot } = Math;

export function requestSimulationPass(simulation, request) {
  if (simulation.ball.ownerId == null) throw new TypeError('A controlled ball is required for a pass.');
  if (request.target) validateSimPosition(request.target);
  evaluateSimulationPass(simulation, request);
  simulation.passing.requested = { toId: request.toId, lofted: !!request.lofted, ...(request.target ? { target: { ...request.target } } : {}) };
  simulation.passing.selected = null;
  simulation.passing.nextEvaluationTick = simulation.tick;
}

export function prepareSimulationOwner(simulation) {
  const owner = simulationRuntime(simulation).byId.get(simulation.ball.ownerId);
  if (!owner) return;
  if (simulation.tick >= simulation.passing.nextEvaluationTick) refreshSimulationOwnerPlan(simulation, owner);
  // Braking is physical. A holder never receives a dribbling target in this phase.
  owner.target = { ...owner.position };
  owner.role = 'holder';
  owner.gait = 'walk';
}

function refreshSimulationOwnerPlan(simulation, owner) {
  const passing = simulation.passing;
  if (passing.selected) {
    const current = evaluateSimulationPass(simulation, passing.selected);
    passing.selected = current.reachable ? current : null;
    passing.nextEvaluationTick = simulation.tick + owner.limits.reactionTicks;
  }
  if (!passing.selected) planSimulationOwnerPass(simulation, owner);
}

function planSimulationOwnerPass(simulation, owner) {
  const passing = simulation.passing;
  passing.options = evaluateSimulationPassOptions(simulation);
  const waiting = (simulation.tick - simulation.ball.ownerSinceTick) * MATCH_SIM_DATA.clock.stepSeconds;
  const allowRisk = waiting >= MATCH_SIM_DATA.passing.riskWaitSeconds;
  passing.selected = selectOwnerPass(simulation, allowRisk);
  passing.nextEvaluationTick = simulation.tick + owner.limits.reactionTicks;
}

function selectOwnerPass(simulation, allowRisk) {
  const passing = simulation.passing;
  if (passing.requested) return evaluateSimulationPass(simulation, passing.requested);
  return simulation.automaticPasses ? bestSimulationPass(passing.options, allowRisk) : null;
}

function bestSimulationPass(options, allowRisk) {
  let best = null;
  for (const option of options) {
    if (!option.visible || !option.reachable || (!option.safe && !allowRisk)) continue;
    if (!best || option.score > best.score) best = option;
  }
  return best;
}

export function finishSimulationOwnerStep(simulation) {
  const owner = simulationRuntime(simulation).byId.get(simulation.ball.ownerId);
  if (!owner) return;
  const option = simulation.passing.selected;
  if (option) faceSimulationPlayer(owner, option.target);
  followSimulationBallOwner(simulation);
  if (option && ownerCanRelease(simulation, owner, option)) releaseCurrentOwnerPass(simulation, owner, option);
}

function releaseCurrentOwnerPass(simulation, owner, option) {
  const current = evaluateSimulationPass(simulation, option);
  const waiting = (simulation.tick - simulation.ball.ownerSinceTick) * MATCH_SIM_DATA.clock.stepSeconds;
  const allowedRisk = waiting >= MATCH_SIM_DATA.passing.riskWaitSeconds;
  if (simulation.passing.requested || (current.reachable && (current.safe || allowedRisk))) releaseSimulationPass(simulation, owner, current);
  else { simulation.passing.selected = null; planSimulationOwnerPass(simulation, owner); }
}

function ownerCanRelease(simulation, owner, option) {
  const settings = MATCH_SIM_DATA.passing;
  const reaction = owner.limits.reactionSeconds;
  const skill = (owner.attributes.reactions + owner.attributes.technique) / (2 * MATCH_SIM_DATA.attributes.maximum);
  const hold = max(reaction, settings.holdMinimumSeconds + (1 - skill) * settings.holdSkillSeconds - simulationOwnerPressure(simulation, owner) * settings.pressureHoldReduction);
  const waiting = (simulation.tick - simulation.ball.ownerSinceTick) * MATCH_SIM_DATA.clock.stepSeconds;
  const angle = atan2(option.target.y - owner.position.y, option.target.x - owner.position.x) - owner.heading;
  const aligned = abs(atan2(sin(angle), cos(angle))) <= settings.angleTolerance;
  return waiting >= hold && aligned && hypot(owner.velocity.x, owner.velocity.y) <= settings.recoverySpeedThreshold && pointDistance(owner.position, option.target) > MATCH_SIM_DATA.movement.arrivalRadius;
}
