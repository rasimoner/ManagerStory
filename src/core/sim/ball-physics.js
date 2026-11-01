import MATCH_SIM_DATA from '../../data/match-sim.json';

const { hypot, max, min, sqrt } = Math;

export function predictSimulationBall(ball, seconds) {
  const next = { position: { ...ball.position }, velocity: { ...ball.velocity }, height: ball.height, verticalVelocity: ball.verticalVelocity };
  if (next.height > 0 || next.verticalVelocity > 0) advanceAirborneBall(next, seconds);
  else advanceRollingBall(next, seconds);
  return next;
}

function advanceAirborneBall(ball, seconds) {
  const gravity = MATCH_SIM_DATA.ball.gravity;
  const landing = (ball.verticalVelocity + sqrt(ball.verticalVelocity ** 2 + 2 * gravity * ball.height)) / gravity;
  const airborne = min(seconds, landing);
  ball.position.x += ball.velocity.x * airborne;
  ball.position.y += ball.velocity.y * airborne;
  ball.height = max(0, ball.height + ball.verticalVelocity * airborne - gravity * airborne * airborne / 2);
  ball.verticalVelocity -= gravity * airborne;
  if (seconds >= landing) {
    ball.height = 0;
    ball.verticalVelocity = 0;
    advanceRollingBall(ball, seconds - landing);
  }
}

function advanceRollingBall(ball, seconds) {
  const speed = hypot(ball.velocity.x, ball.velocity.y);
  if (!speed) return;
  const friction = MATCH_SIM_DATA.ball.rollingDeceleration;
  const rolling = min(seconds, speed / friction);
  const travel = speed * rolling - friction * rolling * rolling / 2;
  ball.position.x += ball.velocity.x / speed * travel;
  ball.position.y += ball.velocity.y / speed * travel;
  const factor = max(0, speed - friction * rolling) / speed;
  ball.velocity.x *= factor;
  ball.velocity.y *= factor;
}

export function simulationPassFlight(start, target, lofted = false) {
  const options = typeof lofted === 'object' ? lofted : { lofted };
  const distance = hypot(target.x - start.x, target.y - start.y);
  const settings = MATCH_SIM_DATA.passing;
  const seconds = settings.lobMinimumSeconds + distance * settings.lobSecondsPerMetre;
  const speed = options.lofted ? distance / seconds : min(settings.maximumSpeed, settings.minimumSpeed + distance * settings.distanceSpeedFactor);
  const factor = distance ? speed / distance : 0;
  return { position: { ...start }, velocity: { x: (target.x - start.x) * factor, y: (target.y - start.y) * factor },
    height: options.startHeight ?? 0, verticalVelocity: options.lofted ? MATCH_SIM_DATA.ball.gravity * seconds / 2
      + ((options.arrivalHeight ?? 0) - (options.startHeight ?? 0)) / seconds : 0 };
}

export function simulationBallTravelSeconds(flight, distance) {
  const speed = hypot(flight.velocity.x, flight.velocity.y);
  if (!speed) return distance === 0 ? 0 : Infinity;
  const gravity = MATCH_SIM_DATA.ball.gravity;
  const airborne = flight.height > 0 || flight.verticalVelocity > 0;
  const landing = airborne ? (flight.verticalVelocity + sqrt(flight.verticalVelocity ** 2 + 2 * gravity * flight.height)) / gravity : 0;
  if (distance <= speed * landing) return distance / speed;
  const rollingDistance = distance - speed * landing;
  const discriminant = speed * speed - 2 * MATCH_SIM_DATA.ball.rollingDeceleration * rollingDistance;
  return discriminant >= 0 ? landing + 2 * rollingDistance / (speed + sqrt(discriminant)) : Infinity;
}
