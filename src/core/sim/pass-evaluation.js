import { simulationPlayerAvailable } from './duel-state.js';
import MATCH_SIM_DATA from '../../data/match-sim.json';
import { planningDistance, clampSimValue } from './geometry.js';
import { simulationBallTravelSeconds } from './ball-physics.js';
import { simulationDeliveryFlight, simulationCrossCandidate } from './cross-delivery.js';
import { simulationPlayerArrival, simulationOpponentArrival } from './player-arrival.js';
import { simulationRuntime } from './simulation-runtime.js';

const { min, max, abs, hypot } = Math;

export function evaluateSimulationPass(simulation, request, prepared) {
  const context = prepared ?? preparePassEvaluation(simulation, request);
  const { passer, receiver, fromPos, target, distance, receiverSeconds, opponentSeconds, space } = context;
  const flight = simulationDeliveryFlight(simulation, passer, { ...request, target });
  const ballSeconds = simulationBallTravelSeconds(flight, distance);
  const reachable = receiverSeconds <= ballSeconds + MATCH_SIM_DATA.passing.arrivalGraceSeconds;
  const route = reachable ? evaluatePassRoute({ flight, ballSeconds, opponents: context.opponents, launchChecked: context.launchChecked })
    : { interceptingId: null, interceptionSeconds: null, minimumMargin: -Infinity };
  const option = { fromId: passer.id, toId: receiver.id, fromPos, target, lofted: !!request.lofted, distance, ballSeconds, receiverSeconds,
    opponentSeconds, space, reachable, safe: reachable && route.interceptingId === null, ...route };
  option.score = scoreSimulationPass(context, option);
  return option;
}

function preparePassEvaluation(simulation, request, scope) {
  const { owner: passer, team, opponents, fromPos } = scope ?? createPassEvaluationScope(simulation, request);
  const receiver = simulationRuntime(simulation).byId.get(request.toId);
  validatePassParticipants(passer, receiver);
  const target = { ...(request.target ?? receiver.position) };
  return { passer, receiver, team, opponents, target, fromPos, distance: planningDistance(fromPos, target),
    receiverSeconds: simulationPlayerArrival(receiver, target), launchChecked: scope?.launchChecked ?? false, ...evaluateTargetCompetition(opponents, target) };
}

function createPassEvaluationScope(simulation, request) {
  const owner = simulationRuntime(simulation).byId.get(request.fromId ?? simulation.ball.ownerId);
  if (!owner) throw new TypeError('Pass requires an owner and a different teammate.');
  const team = simulation.teams.find(candidate => candidate.id === owner.teamId);
  const opponents = simulation.teams.find(candidate => candidate.id !== team.id).players.filter(simulationPlayerAvailable);
  return { owner, team, opponents, fromPos: { ...simulation.ball.position } };
}

function validatePassParticipants(passer, receiver) {
  if (!receiver || passer.id === receiver.id || passer.teamId !== receiver.teamId) throw new TypeError('Pass requires an owner and a different teammate.');
}

function evaluateTargetCompetition(opponents, target) {
  let opponentSeconds = Infinity, space = MATCH_SIM_DATA.passing.spaceCap;
  for (const player of opponents) {
    const distance = planningDistance(player.position, target);
    space = min(space, distance);
    const maximumReach = MATCH_SIM_DATA.ball.controlRadius + player.limits.maxSpeed * opponentSeconds + MATCH_SIM_DATA.clock.epsilon;
    if (distance <= maximumReach) opponentSeconds = min(opponentSeconds, simulationOpponentArrival(player, target, distance));
  }
  return { opponentSeconds, space };
}

function evaluatePassRoute({ flight, ballSeconds, opponents, launchChecked }) {
  const interval = MATCH_SIM_DATA.passing.evaluationStepSeconds;
  const route = { interceptingId: null, interceptionSeconds: null, minimumMargin: Infinity };
  const speed = hypot(flight.velocity.x, flight.velocity.y);
  for (let time = launchChecked ? interval : 0; time < ballSeconds + interval; time += interval) {
    const sampleTime = min(time, ballSeconds);
    const sample = samplePassRoute(flight, sampleTime, speed);
    if (sample.height > MATCH_SIM_DATA.ball.reachableHeight) continue;
    inspectPassSample(route, opponents, { position: sample.position, time: sampleTime });
    if (route.interceptingId !== null) break;
  }
  return route;
}

function samplePassRoute(flight, time, speed) {
  const airborne = flight.verticalVelocity > 0;
  const distance = speed * time - (airborne ? 0 : MATCH_SIM_DATA.ball.rollingDeceleration * time * time / 2);
  return { position: { x: flight.position.x + flight.velocity.x / speed * distance, y: flight.position.y + flight.velocity.y / speed * distance },
    height: airborne ? max(0, flight.height + flight.verticalVelocity * time - MATCH_SIM_DATA.ball.gravity * time * time / 2) : 0 };
}

function inspectPassSample(route, opponents, sample) {
  for (const opponent of opponents) {
    const offsetX = opponent.position.x - sample.position.x, offsetY = opponent.position.y - sample.position.y;
    const reach = MATCH_SIM_DATA.ball.controlRadius + opponent.limits.maxSpeed * sample.time;
    if (offsetX * offsetX + offsetY * offsetY > reach * reach) continue;
    const arrival = simulationOpponentArrival(opponent, sample.position);
    route.minimumMargin = min(route.minimumMargin, arrival - sample.time);
    if (arrival <= sample.time && route.interceptionSeconds === null) {
      route.interceptingId = opponent.id;
      route.interceptionSeconds = sample.time;
      return;
    }
  }
}

function scoreSimulationPass({ passer, team }, option) {
  const settings = MATCH_SIM_DATA.passing;
  const style = settings.styles[team.tactics.passingStyle ?? settings.defaultStyle];
  const visionRange = settings.minimumVisionDistance + passer.attributes.vision / MATCH_SIM_DATA.attributes.maximum * settings.visionDistanceRange;
  const progress = (option.target.x - option.fromPos.x) * team.direction;
  option.visible = option.distance <= visionRange;
  const distanceCost = abs(option.distance - style.preferredDistance) * style.distanceWeight;
  const safety = clampSimValue(option.minimumMargin, -settings.chaseHorizonSeconds, settings.chaseHorizonSeconds) * settings.safetyWeight;
  return progress * style.progressWeight + option.space * style.spaceWeight + safety - distanceCost - (option.lofted ? settings.lobPenalty : 0);
}

export function evaluateSimulationPassOptions(simulation) {
  const owner = simulationRuntime(simulation).byId.get(simulation.ball.ownerId);
  if (!owner) return [];
  const team = simulation.teams.find(candidate => candidate.id === owner.teamId);
  const opponents = simulation.teams.find(candidate => candidate.id !== team.id).players.filter(simulationPlayerAvailable);
  if (isPassLaunchBlocked(simulation, opponents)) return [];
  const options = [];
  const context = { simulation, owner, options, team, opponents, fromPos: { ...simulation.ball.position }, launchChecked: true };
  for (const receiver of team.players) {
    if (receiver.id === owner.id || !simulationPlayerAvailable(receiver)) continue;
    appendReceiverOptions(context, receiver, team.direction);
  }
  return options;
}

function appendReceiverOptions(context, receiver, direction) {
  const lead = simulationLeadTarget(receiver, direction);
  const moving = simulationMovingReceiverTarget(receiver);
  for (const target of [moving, lead]) {
    const request = { fromId: context.owner.id, toId: receiver.id, target };
    const prepared = preparePassEvaluation(context.simulation, request, context);
    const ground = evaluateSimulationPass(context.simulation, request, prepared);
    if (ground.distance < MATCH_SIM_DATA.passing.minimumDistance) continue;
    context.options.push(ground);
    // A lob is an alternative to a blocked route, rather than a bonus for every clear short pass.
    if (!ground.safe || simulationCrossCandidate(context.simulation, context.owner, { ...request, lofted: true })) {
      context.options.push(evaluateSimulationPass(context.simulation, { ...request, lofted: true }, prepared));
    }
  }
}

function simulationLeadTarget(receiver, direction) {
  const settings = MATCH_SIM_DATA.passing, pitch = MATCH_SIM_DATA.pitch;
  return {
    x: clampSimValue(receiver.position.x + direction * settings.leadDistance + receiver.velocity.x * settings.leadVelocitySeconds, -pitch.length / 2 + pitch.targetMargin, pitch.length / 2 - pitch.targetMargin),
    y: clampSimValue(receiver.position.y + receiver.velocity.y * settings.leadVelocitySeconds, -pitch.width / 2 + pitch.targetMargin, pitch.width / 2 - pitch.targetMargin),
  };
}

export function simulationOwnerPressure(simulation, owner) {
  const opponents = simulation.teams.find(team => team.id !== owner.teamId).players;
  let distance = Infinity;
  for (const player of opponents) if (simulationPlayerAvailable(player)) distance = min(distance, planningDistance(player.position, owner.position));
  return max(0, 1 - distance / MATCH_SIM_DATA.passing.pressureDistance);
}

function simulationMovingReceiverTarget(receiver) {
  const seconds = MATCH_SIM_DATA.passing.receiverMotionSeconds, pitch = MATCH_SIM_DATA.pitch;
  return { x: clampSimValue(receiver.position.x + receiver.velocity.x * seconds, -pitch.length / 2 + pitch.targetMargin, pitch.length / 2 - pitch.targetMargin),
    y: clampSimValue(receiver.position.y + receiver.velocity.y * seconds, -pitch.width / 2 + pitch.targetMargin, pitch.width / 2 - pitch.targetMargin) };
}

function isPassLaunchBlocked(simulation, opponents) {
  return opponents.some(player => simulationPlayerAvailable(player) && planningDistance(player.position, simulation.ball.position) <= MATCH_SIM_DATA.ball.controlRadius);
}
