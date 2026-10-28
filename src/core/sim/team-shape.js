import MATCH_SIM_DATA from '../../data/match-sim.json';
import { clampSimValue } from './geometry.js';

export function teamOwnsSimBall(simulation, team) {
  return simulation.ball.teamId === team.id;
}

export function simTeamShape(simulation, team) {
  const attacking = teamOwnsSimBall(simulation, team);
  const settings = attacking ? MATCH_SIM_DATA.shape.attacking : MATCH_SIM_DATA.shape.defending;
  const localBall = simulation.ball.position.x * team.direction;
  const shift = MATCH_SIM_DATA.tactics.lineShift[team.tactics.line];
  const center = {
    x: (attacking ? localBall + settings.ballAheadCenter : localBall - settings.ballBehindCenter + shift) * team.direction,
    y: simulation.ball.position.y * settings.ballSideShift,
  };
  return { ...settings, center: fitShapeCenter(center, settings) };
}

function fitShapeCenter(center, shape) {
  const { length, width, targetMargin } = MATCH_SIM_DATA.pitch;
  const longitudinal = length / 2 - shape.envelopeLength / 2 - targetMargin;
  const lateral = width / 2 - shape.envelopeWidth / 2 - targetMargin;
  return { x: clampSimValue(center.x, -longitudinal, longitudinal), y: clampSimValue(center.y, -lateral, lateral) };
}

export function simAnchorPosition(team, player, shape) {
  return { x: shape.center.x + player.anchor.x * shape.length * team.direction, y: shape.center.y + player.anchor.y * shape.width };
}

export function fitTeamTarget(target, shape) {
  return {
    x: clampSimValue(target.x, shape.center.x - shape.envelopeLength / 2, shape.center.x + shape.envelopeLength / 2),
    y: clampSimValue(target.y, shape.center.y - shape.envelopeWidth / 2, shape.center.y + shape.envelopeWidth / 2),
  };
}

export function simKeeperTarget(simulation, team) {
  const { keeper } = MATCH_SIM_DATA.shape;
  const ownGoal = -MATCH_SIM_DATA.pitch.length / 2 * team.direction;
  const progress = simulation.ball.position.x * team.direction + MATCH_SIM_DATA.pitch.length / 2;
  const depth = clampSimValue(keeper.minimumDepth + progress * keeper.progressDepthFactor, keeper.minimumDepth, keeper.maximumDepth);
  return { x: ownGoal + depth * team.direction, y: clampSimValue(simulation.ball.position.y * keeper.sideFactor, -MATCH_SIM_DATA.pitch.goalWidth / 2, MATCH_SIM_DATA.pitch.goalWidth / 2) };
}
