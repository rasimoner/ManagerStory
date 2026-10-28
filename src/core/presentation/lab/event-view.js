import MATCH_SIM_DATA from '../../../data/match-sim.json';

const eventLabels = { dribble: 'Sürme', tackle: 'Müdahale', duel: 'Omuz omuza', foul: 'Faul', advantage: 'Avantaj', yellow: 'Sarı kart', red: 'Kırmızı kart', beat: 'Geçti', pass: 'Pas' };
const outcomeLabels = { won: 'kazandı', loose: 'top sekti', missed: 'ıska', played: 'devam', recalled: 'faul geri çağrıldı' };

export function labRecentEventsMarkup(events) {
  return events.slice(-MATCH_SIM_DATA.lab.recentEventCount).reverse().map(event => {
    const minutes = String(Math.floor(event.time / 60)).padStart(2, '0');
    const seconds = String(Math.floor(event.time % 60)).padStart(2, '0');
    const outcome = outcomeLabels[event.result ?? event.status] ?? '';
    const players = `${event.fromId ?? ''} → ${event.toId ?? ''}`;
    return `<li data-event="${event.type}"><time>${minutes}:${seconds}</time><b>${eventLabels[event.type] ?? event.type}</b><span>${players} ${outcome}${event.penaltyPending ? ' · penaltyPending (geçici)' : ''}</span></li>`;
  }).join('');
}

export function labRefereeSignalMarkup(simulation, events) {
  const event = events.findLast(candidate => ['foul', 'yellow', 'red', 'advantage'].includes(candidate.type));
  if (!event || simulation.time - event.time > MATCH_SIM_DATA.lab.incidentSeconds) return '';
  return `<span data-referee-signal="${event.type}" class="referee-signal signal-${event.type}">${eventLabels[event.type]}${event.status === 'recalled' ? ' · geri çağrıldı' : ''}</span>`;
}
