import MATCH_SIM_DATA from '../../../data/match-sim.json';
import { predictSimulationBall } from '../../sim/ball-physics.js';
import { toLabFieldPoint } from './field-markings.js';

export function labPassOptionsMarkup(simulation) {
  const passing = simulation.passing;
  const options = passing.options.map(option => passOptionLine(option, false)).join('');
  const selected = passing.selected;
  if (!selected) return `<g data-overlay="passes" pointer-events="none">${options}</g>`;
  const target = toLabFieldPoint(selected.target);
  const padding = MATCH_SIM_DATA.lab.passLabelPadding;
  const position = { x: Math.max(padding, Math.min(MATCH_SIM_DATA.pitch.width - padding, target.x)), y: Math.max(3, Math.min(102, target.y - 3)) };
  return `<g data-overlay="passes" pointer-events="none">${options}${passOptionLine(selected, true)}<circle cx="${target.x}" cy="${target.y}" r="2.2" stroke="#f8e9ac" fill="none" stroke-width=".3"/>
    <text data-pass-arrival x="${position.x}" y="${position.y}" text-anchor="middle" fill="#fff4ca" font-size="1.8" paint-order="stroke" stroke="#10272b" stroke-width=".8">Alıcı ${arrivalLabel(selected.receiverSeconds)} / rakip ${arrivalLabel(selected.opponentSeconds)}</text></g>`;
}

function passOptionLine(option, selected) {
  const start = toLabFieldPoint(option.fromPos), end = toLabFieldPoint(option.target);
  const color = selected ? '#fff1bc' : option.safe ? '#86f3b3' : '#f47e7e';
  const width = selected ? .55 : Math.max(.1, Math.min(.35, .2 + option.score / 100));
  return `<path ${selected ? 'data-selected-pass' : 'data-pass-option'} data-to-id="${option.toId}" data-safe="${option.safe}" d="M${start.x},${start.y} L${end.x},${end.y}" stroke="${color}" stroke-width="${width}" opacity="${selected ? .95 : .32}" ${option.lofted ? 'stroke-dasharray="1 .7"' : ''} fill="none"/>`;
}

function arrivalLabel(seconds) {
  return Number.isFinite(seconds) ? `${seconds.toFixed(1)} sn` : '—';
}

export function labBallPathMarkup(simulation) {
  const ball = simulation.ball;
  if (ball.ownerId || !ball.velocity) return '';
  const points = [];
  if (ball.flight) points.push(toLabFieldPoint(ball.flight.fromPos));
  for (let seconds = 0; seconds <= MATCH_SIM_DATA.lab.pathSeconds; seconds += MATCH_SIM_DATA.lab.pathStepSeconds) {
    const predicted = predictSimulationBall(ball, seconds);
    if (Math.abs(predicted.position.x) > MATCH_SIM_DATA.pitch.length / 2 || Math.abs(predicted.position.y) > MATCH_SIM_DATA.pitch.width / 2) break;
    points.push(toLabFieldPoint(predicted.position));
  }
  return `<polyline data-overlay="flight" pointer-events="none" points="${points.map(point => `${point.x},${point.y}`).join(' ')}" fill="none" stroke="#fff" stroke-width=".28" stroke-dasharray=".6 .7" opacity=".7"/>`;
}
