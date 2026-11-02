import MOVE_DATA from '../../data/moves.json';

export function movesFor(attr, role) {
  const settings = MOVE_DATA.rating;
  const flair = Object.entries(settings.flair).reduce((total, [key, weight]) => total + attr(key) * weight, 0);
  const stars = 1 + settings.starsAt.filter(threshold => flair >= threshold).length, moves = [];
  const rating = { attr, role, stars, moves };
  for (const move of MOVE_DATA.moves) {
    if (move.requires?.some(alternative => Object.entries(alternative).every(requirement => moveRequirementHolds(requirement, rating)))) moves.push(move.id);
  }
  return { stars, moves };
}

function moveRequirementHolds([key, expected], rating) {
  if (key === 'role') return expected.includes(rating.role);
  if (key === 'notRole') return !expected.includes(rating.role);
  if (key === 'roleContains') return String(rating.role || '').includes(expected);
  if (key === 'move') return rating.moves.includes(expected);
  return (key === 'stars' ? rating.stars : rating.attr(key)) >= expected;
}
