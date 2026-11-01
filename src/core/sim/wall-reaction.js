import RESTART_DATA from '../../data/match-sim-restarts.json';
import MATCH_SIM_DATA from '../../data/match-sim.json';
import { pointDistance } from './geometry.js';

export function reactSimulationWall(simulation, restart) {
  if (restart.kind !== 'freeKick' || restart.delivery.kind !== 'direct') return;
  for (const team of simulation.teams) for (const player of team.players) {
    if (team.id === restart.teamId || player.slot === 'GK' || player.sentOff) continue;
    if (pointDistance(player.position, restart.position) > MATCH_SIM_DATA.refereeing.restartDistance + RESTART_DATA.wall.radiusMargin) continue;
    player.duel.wallJump = { start: simulation.time + RESTART_DATA.wall.reactionSeconds };
  }
}

export function simulationWallLift(player, time) {
  const jump = player.duel?.wallJump;
  if (!jump) return 0;
  const elapsed = time - jump.start;
  if (elapsed <= 0 || elapsed >= RESTART_DATA.wall.jumpSeconds) return 0;
  const phase = elapsed / RESTART_DATA.wall.jumpSeconds;
  return RESTART_DATA.wall.jumpHeight * 4 * phase * (1 - phase);
}

export function simulationWallJumpActive(player, motion) {
  const jump = player.duel?.wallJump;
  if (!jump) return false;
  const time = motion.startTime ?? jump.start, seconds = motion.seconds ?? MATCH_SIM_DATA.clock.stepSeconds;
  return time + seconds >= jump.start && time < jump.start + RESTART_DATA.wall.jumpSeconds;
}

export function simulationWallContactFraction(player, interval, motion) {
  const seconds = motion.seconds ?? MATCH_SIM_DATA.clock.stepSeconds;
  const startTime = motion.startTime ?? player.duel.wallJump.start - RESTART_DATA.wall.reactionSeconds;
  for (let index = 0; index <= RESTART_DATA.wall.contactSamples; index++) {
    const fraction = interval.start + (interval.end - interval.start) * index / RESTART_DATA.wall.contactSamples;
    const elapsed = fraction * seconds, lift = simulationWallLift(player, startTime + elapsed);
    const height = motion.before.height + motion.before.verticalVelocity * elapsed - MATCH_SIM_DATA.ball.gravity * elapsed ** 2 / 2;
    if (height >= lift - MATCH_SIM_DATA.ball.radius && height <= MATCH_SIM_DATA.ball.reachableHeight + lift) return fraction;
  }
  return null;
}
