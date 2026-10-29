import MATCH_SIM_DATA from '../../../data/match-sim.json';
import { toLabFieldPoint } from './field-markings.js';

export function recordLabShotMapEvents(state, events) {
  for (; state.cursor < events.length; state.cursor++) recordShotMapEvent(state, events[state.cursor]);
}

function recordShotMapEvent(state, event) {
  if (event.type === 'shot') {
    state.current = { shotId: state.cursor, position: { ...event.fromPos }, xg: event.xg, teamId: event.teamId, outcome: 'pending' };
    state.shots.push(state.current);
  }
  if (event.type === 'goal') {
    const shot = state.shots.find(shot => shot.shotId === event.shotId);
    if (shot) shot.outcome = 'goal';
    return;
  }
  if (!state.current || state.current.outcome === 'goal') return;
  const outcome = { save: 'save', block: 'block', wide: 'wide', post: 'wide', ballOut: 'wide', firstTouch: 'wide' }[event.type];
  if (outcome && (state.current.outcome === 'pending' || event.type === 'save')) state.current.outcome = outcome;
}

export function labShotMapMarkup(shots) {
  const dots = shots.map(shotMapDot).join('');
  return `<g data-overlay="shot-map" pointer-events="none">${dots}</g>`;
}

function shotMapDot(shot) {
  const point = toLabFieldPoint(shot.position), settings = MATCH_SIM_DATA.lab.shotMap;
  const radius = Math.sqrt(settings.minimumRadius ** 2 + shot.xg * settings.xgAreaScale);
  const label = { goal: 'Gol', save: 'Kurtarış', block: 'Blok', wide: 'Dışarı / direk', pending: 'Sürüyor' }[shot.outcome];
  return `<circle data-shot-result="${shot.outcome}" data-shot-id="${shot.shotId}" cx="${point.x}" cy="${point.y}" r="${radius.toFixed(2)}" fill="${settings.colors[shot.outcome]}" fill-opacity=".8" stroke="#102c28" stroke-width=".2"><title>${label} · xG ${shot.xg.toFixed(2)}</title></circle>`;
}
