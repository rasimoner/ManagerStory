import MATCH_SIM_DATA from '../../../data/match-sim.json';

export function simulationSceneStatus(frame) {
  const preparing = frame?.half === 2 && frame.phase === 'half';
  return { preparing, label: preparing ? 'İkinci yarı hazırlanıyor…' : '' };
}

export function simulationDisplayMatchTime(frame) {
  return simulationSceneStatus(frame).preparing ? MATCH_SIM_DATA.match.halfSeconds : frame?.matchTime ?? 0;
}
