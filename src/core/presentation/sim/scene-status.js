import MATCH_SIM_DATA from '../../../data/match-sim.json';

function atSecondHalfBreak(frame) {
  return frame?.half === 2 && frame.phase === 'half';
}

// Only a break in which the teams visibly walk to their new ends needs a mask; relocated teams are already in place.
export function simulationSceneStatus(frame) {
  const preparing = atSecondHalfBreak(frame) && !frame.teamsRelocated;
  return { preparing, label: preparing ? 'İkinci yarı hazırlanıyor…' : '' };
}

export function simulationDisplayMatchTime(frame) {
  return atSecondHalfBreak(frame) ? MATCH_SIM_DATA.match.halfSeconds : frame?.matchTime ?? 0;
}
