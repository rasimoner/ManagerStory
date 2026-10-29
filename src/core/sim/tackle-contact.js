import MATCH_SIM_DATA from '../../data/match-sim.json';

export function simulationTackleContact({ from, to, ball, victim }) {
  const settings = MATCH_SIM_DATA.duels;
  const ballFraction = ball.height <= settings.footRadius ? segmentCircleEntry({ from, to, center: ball.position, radius: settings.footRadius }) : Infinity;
  const playerFraction = segmentCircleEntry({ from, to, center: victim.position, radius: settings.legRadius });
  const fraction = Math.min(ballFraction, playerFraction);
  const contact = Number.isFinite(fraction) ? ballFraction <= playerFraction ? 'ball' : 'player' : 'none';
  const along = Number.isFinite(fraction) ? fraction : 1;
  return { contact, fraction, bodyFraction: playerFraction, position: { x: from.x + (to.x - from.x) * along, y: from.y + (to.y - from.y) * along } };
}

function segmentCircleEntry({ from, to, center, radius }) {
  const offsetX = from.x - center.x, offsetY = from.y - center.y;
  const changeX = to.x - from.x, changeY = to.y - from.y;
  const squared = changeX * changeX + changeY * changeY;
  const distance = offsetX * offsetX + offsetY * offsetY - radius * radius;
  if (distance <= 0) return 0;
  if (!squared) return Infinity;
  const product = offsetX * changeX + offsetY * changeY;
  const discriminant = product * product - squared * distance;
  if (discriminant < 0) return Infinity;
  const fraction = (-product - Math.sqrt(discriminant)) / squared;
  return fraction >= 0 && fraction <= 1 ? fraction : Infinity;
}
