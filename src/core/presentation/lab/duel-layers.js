import MATCH_SIM_DATA from '../../../data/match-sim.json';
import { toLabFieldPoint } from './field-markings.js';

export function labOwnerOptionsMarkup(simulation) {
  const decision = simulation.ownerDecision;
  const ownerId = simulation.ball.ownerId ?? simulation.ball.carry?.playerId;
  if (ownerId == null || !decision.dribble || decision.selected == null) return '';
  const start = toLabFieldPoint(simulation.ball.position), end = toLabFieldPoint(decision.dribble.target);
  const scores = [['pass', 'Pas'], ['dribble', 'Sür'], ['shield', 'Koru'], ['shot', 'Şut']].map(([key, label]) => `${decision.selected === key ? '● ' : ''}${label} ${scoreLabel(decision[key]?.score)}`).join(' · ');
  return `<g data-overlay="decisions" pointer-events="none"><path data-dribble-direction d="M${start.x},${start.y} L${end.x},${end.y}" fill="none" stroke="#f5ce66" stroke-width=".6" marker-end="url(#dribble-arrow)"/><defs><marker id="dribble-arrow" markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4" fill="#f5ce66"/></marker></defs><rect x="1" y="-5.5" width="66" height="3.8" rx="1" fill="#09282f"/><text data-owner-options x="34" y="-2.8" fill="#fff1bc" text-anchor="middle" font-size="1.8">${scores}${decision.shot ? ` · xG ${decision.shot.xg.toFixed(2)}` : ''}</text></g>`;
}

function scoreLabel(score) {
  return Number.isFinite(score) ? score.toFixed(0) : '—';
}

export function labContactMarkup(simulation) {
  const contact = simulation.defending.lastContact;
  if (!contact || simulation.time - contact.time > MATCH_SIM_DATA.lab.incidentSeconds) return '';
  const point = toLabFieldPoint(contact.position);
  const color = contact.contact === 'ball' ? '#90f5ba' : contact.contact === 'player' ? '#ff8a8a' : '#d9e3e9';
  return `<g data-overlay="contact" data-contact="${contact.contact}" pointer-events="none"><circle cx="${point.x}" cy="${point.y}" r="2" fill="none" stroke="${color}" stroke-width=".5"/><text x="${point.x}" y="${point.y - 3}" text-anchor="middle" fill="${color}" font-size="1.7">${{ ball: 'TOP', player: 'OYUNCU', none: 'ISKA' }[contact.contact]}</text></g>`;
}

export function labDuelStateMarkup(player) {
  const state = player.duel.state;
  const label = MATCH_SIM_DATA.lab.duelLabels[state];
  if (!label) return '';
  return `<text data-defender-state="${state}" y="4.2" text-anchor="middle" fill="${state === 'sentOff' ? '#ff7d84' : '#f5e7b2'}" font-size="1.7" paint-order="stroke" stroke="#13362f" stroke-width=".6">${label}</text>`;
}
