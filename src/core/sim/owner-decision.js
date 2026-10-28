import { releaseSimulationShot } from './shot-execution.js';
import { evaluateSimulationShot } from './shot-evaluation.js';
import MATCH_SIM_DATA from '../../data/match-sim.json';
import { pointDistance, pointSquaredDistance } from './geometry.js';
import { validateSimPosition } from './validation.js';
import { simulationRuntime } from './simulation-runtime.js';
import { evaluateSimulationPass, simulationOwnerPressure } from './pass-evaluation.js';
import { evaluateSimulationOwnerOptions } from './owner-options.js';
import { followSimulationBallOwner } from './ball-possession.js';
import { releaseSimulationPass } from './pass-execution.js';
import { faceSimulationPlayer } from './player-movement.js';
import { simulationShieldTarget } from './dribble-evaluation.js';
import { kickSimulationDribble, endSimulationCarry } from './dribbling.js';

const { abs, atan2, sin, cos, max, hypot } = Math;

export function requestSimulationPass(simulation, request) {
  if (simulation.ball.ownerId == null) throw new TypeError('A controlled ball is required for a pass.');
  if (request.target) validateSimPosition(request.target);
  evaluateSimulationPass(simulation, request);
  simulation.passing.requested = { toId: request.toId, lofted: !!request.lofted, ...(request.target ? { target: { ...request.target } } : {}) };
  simulation.passing.selected = null;
  simulation.ownerDecision.forcedPlayerId = null;
  simulation.passing.nextEvaluationTick = simulation.tick;
}

export function prepareSimulationOwner(simulation) {
  const owner = simulationRuntime(simulation).byId.get(simulation.ball.ownerId ?? simulation.ball.carry?.playerId);
  if (!owner) return;
  if (simulation.ball.ownerId != null && simulation.tick >= simulation.passing.nextEvaluationTick) refreshSimulationOwnerPlan(simulation, owner);
  const decision = simulation.ownerDecision;
  owner.role = 'holder';
  owner.gait = 'walk';
  owner.target = { ...owner.position };
  if (decision.selected === 'dribble') {
    owner.target = carryMovementTarget(simulation, owner);
    owner.gait = 'sprint';
    owner.motionMode = 'dribble';
  }
  if (decision.selected === 'shield') { owner.target = simulationShieldTarget(simulation, owner); owner.motionMode = 'shield'; }
}

function refreshSimulationOwnerPlan(simulation, owner) {
  const options = evaluateSimulationOwnerOptions(simulation, owner);
  const forced = simulation.ownerDecision.forcedPlayerId;
  const shieldSinceTick = simulation.ownerDecision.selected === 'shield' ? simulation.ownerDecision.shieldSinceTick : simulation.tick;
  simulation.ownerDecision = { ...options, forcedPlayerId: forced, shieldSinceTick };
  simulation.passing.options = options.passOptions;
  const manual = simulation.passing.requested;
  if (manual) {
    simulation.ownerDecision.selected = 'pass';
    simulation.passing.selected = evaluateSimulationPass(simulation, manual);
  } else {
    simulation.ownerDecision.selected = simulation.automaticPasses ? options.selected : 'shield';
    if (forced === owner.id) simulation.ownerDecision.selected = 'dribble';
    simulation.passing.selected = simulation.ownerDecision.selected === 'pass' ? options.pass.option : null;
  }
  simulation.passing.nextEvaluationTick = simulation.tick + owner.limits.reactionTicks;
}

export function finishSimulationOwnerStep(simulation) {
  const owner = simulationRuntime(simulation).byId.get(simulation.ball.ownerId);
  if (!owner) return;
  if (simulation.ownerDecision.selected === 'shot') { finishOwnerShot(simulation, owner); return; }
  const option = simulation.passing.selected;
  if (option && simulation.ownerDecision.selected === 'pass') faceSimulationPlayer(owner, option.target);
  followSimulationBallOwner(simulation);
  if (simulation.ownerDecision.selected === 'dribble') { kickSimulationDribble(simulation, owner); return; }
  endSimulationCarry(simulation);
  if (option && ownerCanRelease(simulation, owner, option)) releaseCurrentOwnerPass(simulation, owner, option);
}

function releaseCurrentOwnerPass(simulation, owner, option) {
  const current = evaluateSimulationPass(simulation, option);
  if (simulation.passing.requested || (current.reachable && current.safe)) {
    endSimulationCarry(simulation);
    releaseSimulationPass(simulation, owner, current);
  } else { simulation.passing.selected = null; simulation.passing.nextEvaluationTick = simulation.tick; }
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

function carryMovementTarget(simulation, owner) {
  const ball = simulation.ball;
  const chasing = ball.ownerId == null && pointSquaredDistance(owner.position, ball.position) > MATCH_SIM_DATA.ball.controlRadius ** 2;
  return chasing ? ball.position : simulation.ownerDecision.dribble.target;
}

function finishOwnerShot(simulation, owner) {
  const option = evaluateSimulationShot(simulation, owner);
  faceSimulationPlayer(owner, option.target);
  followSimulationBallOwner(simulation);
  const waiting = (simulation.tick - simulation.ball.ownerSinceTick) * MATCH_SIM_DATA.clock.stepSeconds;
  if (waiting >= MATCH_SIM_DATA.shooting.releaseSeconds) releaseSimulationShot(simulation, owner, option);
}
