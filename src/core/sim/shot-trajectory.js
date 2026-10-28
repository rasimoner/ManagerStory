import MATCH_SIM_DATA from '../../data/match-sim.json';
import { predictSimulationBall, simulationBallTravelSeconds } from './ball-physics.js';

export function simulationShotGoalProjection(simulation, ball = simulation.ball) {
  const shot = simulation.ball.shot;
  const team = simulation.teams.find(candidate => candidate.id === shot?.teamId);
  if (!team || ball.velocity.x * team.direction <= 0) return null;
  const goalX = team.direction * (MATCH_SIM_DATA.pitch.length / 2 + MATCH_SIM_DATA.ball.radius);
  const speed = Math.hypot(ball.velocity.x, ball.velocity.y);
  const distance = (goalX - ball.position.x) * speed / ball.velocity.x;
  const seconds = simulationBallTravelSeconds(ball, distance);
  return Number.isFinite(seconds) ? { ...predictSimulationBall(ball, seconds), seconds } : null;
}

export function simulationShotProjectsInsideGoal(simulation, ball) {
  const projection = simulationShotGoalProjection(simulation, ball), pitch = MATCH_SIM_DATA.pitch;
  return projection != null && Math.abs(projection.position.y) + MATCH_SIM_DATA.ball.radius < pitch.goalWidth / 2
    && projection.height + MATCH_SIM_DATA.ball.radius < pitch.goalHeight;
}
