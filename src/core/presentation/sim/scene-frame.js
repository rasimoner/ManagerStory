import MATCH_SIM_DATA from '../../../data/match-sim.json';
import { sampleSceneBall } from './ball-sample.js';

// The simulation uses metres with +x along the pitch; the rig faces +z at heading zero.
export function simulationWorldPoint(position, height = null) {
  return { x: position.x, y: height == null ? 0 : height + MATCH_SIM_DATA.ball.radius, z: position.y };
}

export function simulationWorldHeading(heading) { return Math.PI / 2 - heading; }

export function sampleSimulationScene(playback, options = {}) {
  const current = playback.frame, previous = playback.previousFrame ?? current;
  const span = current.physicsTime - previous.physicsTime;
  const alpha = options.immediate || span <= 0 ? 1 : Math.min(1, Math.max(0, playback.accumulatorSeconds / span));
  const before = new Map(previous.players.map(player => [player.id, player]));
  return { tick: current.tick, half: current.half, phase: current.phase, alpha,
    physicsTime: interpolateSceneValue(previous.physicsTime, current.physicsTime, alpha), matchTime: current.matchTime,
    players: current.players.filter(player => !player.sentOff).map(player => scenePlayer(player, before.get(player.id), alpha)),
    ball: sceneBall(previous, current, alpha), contacts: current.contacts };
}

function scenePlayer(player, previous = player, alpha) {
  const turn = Math.atan2(Math.sin(player.heading - previous.heading), Math.cos(player.heading - previous.heading));
  const observed = alpha < 1 ? previous : player;
  return { ...player, keeper: observed.keeper, keeperPresentation: observed.keeperPresentation,
    position: simulationWorldPoint(interpolateScenePoint(previous.position, player.position, alpha)),
    velocity: simulationWorldPoint(interpolateScenePoint(previous.velocity, player.velocity, alpha)), heading: simulationWorldHeading(previous.heading + turn * alpha) };
}

function sceneBall(previous, current, alpha) {
  const time = interpolateSceneValue(previous.physicsTime, current.physicsTime, alpha);
  const changed = current.contacts.some(event => ['firstTouch', 'keeperClaim', 'keeperDistribution', 'pass', 'shot', 'tackle'].includes(event.type)
    && event.time > previous.physicsTime && event.time <= time);
  const observed = alpha < 1 && !changed ? previous.ball : current.ball;
  return { ...observed, position: sampleSceneBall(previous, current, time), velocity: simulationWorldPoint(observed.velocity) };
}

function interpolateSceneValue(from, to, alpha) { return from + (to - from) * alpha; }
function interpolateScenePoint(from, to, alpha) {
  return { x: interpolateSceneValue(from.x, to.x, alpha), y: interpolateSceneValue(from.y, to.y, alpha) };
}
