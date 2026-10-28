import MATCH_SIM_DATA from '../../../data/match-sim.json';
import { measureTeam } from '../../sim/team-measurements.js';
import { laboratoryPitchMarkup, toLabFieldPoint } from './field-markings.js';
import { labAnchorsMarkup, labCoverLaneMarkup, labTeamShapeMarkup, labVelocityMarkup } from './field-layers.js';
import { labPassOptionsMarkup, labBallPathMarkup } from './pass-layers.js';
import { labStatisticsMarkup } from './stats-view.js';

const phaseLabels = { possession: 'Topa sahip', defending: 'Savunma', winning: 'Kazanma geçişi', counterpress: 'Karşı pres' };

export function renderLaboratoryField(view, snapshot, layers) {
  const simulation = snapshot.simulation;
  const teams = simulation.teams.map((team, index) => laboratoryTeamMarkup({ simulation, team, layers, color: MATCH_SIM_DATA.lab.teams[index].color })).join('');
  const ball = toLabFieldPoint(simulation.ball.position);
  const passes = layers.passes ? labPassOptionsMarkup(simulation) : '';
  const flight = layers.flight ? labBallPathMarkup(simulation) : '';
  const height = simulation.ball.height ?? 0;
  view.field.innerHTML = laboratoryPitchMarkup() + passes + flight + teams + `<g data-ball="true" data-ball-owner="${simulation.ball.ownerId ?? ''}" pointer-events="none"><circle cx="${ball.x}" cy="${ball.y}" r="2.1" fill="none" stroke="#fff" opacity=".25" stroke-width=".2"/><circle cx="${ball.x}" cy="${ball.y}" r="${.85 + height * MATCH_SIM_DATA.lab.ballHeightScale}" fill="#fff" stroke="#102b28" stroke-width=".25"/>${height > 0 ? `<text x="${ball.x + 2}" y="${ball.y}" fill="#fff" font-size="1.7">${height.toFixed(1)} m</text>` : ''}</g>`;
  view.metrics.innerHTML = simulation.teams.map((team, index) => teamMetricMarkup(simulation, team, MATCH_SIM_DATA.lab.teams[index])).join('');
  view.stats.innerHTML = labStatisticsMarkup(snapshot.metrics);
}

function laboratoryTeamMarkup({ simulation, team, layers, color }) {
  const shape = layers.shape ? labTeamShapeMarkup(simulation, team, color) : '';
  const anchors = layers.anchors ? labAnchorsMarkup(simulation, team, color) : '';
  const cover = layers.roles ? labCoverLaneMarkup(simulation, team) : '';
  const players = team.players.map(player => labPlayerMarkup(player, layers, color)).join('');
  return shape + anchors + cover + players;
}

function labPlayerMarkup(player, layers, color) {
  const point = toLabFieldPoint(player.position);
  const ring = player.role === 'press' ? `<circle r="2.5" fill="none" stroke="${color}" stroke-width=".27" stroke-dasharray="1 .5"/>` : '';
  const role = layers.roles ? `<text data-role="${player.role}" y="-3" text-anchor="middle" fill="${color}" font-size="1.9" font-weight="700">${MATCH_SIM_DATA.lab.roleLabels[player.role]}</text>` : '';
  const velocity = layers.velocity ? labVelocityMarkup(player) : '';
  return `${velocity}<g data-player="${player.id}" transform="translate(${point.x},${point.y})">${ring}<circle r="1.65" fill="${color}" stroke="#092128" stroke-width=".35"/><text y=".76" text-anchor="middle" fill="#10252a" font-size="2.15" font-weight="800">${player.number}</text>${role}</g>`;
}

function teamMetricMarkup(simulation, team, appearance) {
  const box = measureTeam(simulation, team.id);
  const presser = team.players.find(player => player.id === box.presserId);
  const pressure = presser ? `B #${presser.number} · ${box.pressDistance.toFixed(1)} m` : 'Basan: tetik mesafesi dışında';
  const reaction = box.pressReactionSeconds === null ? '—' : `${box.pressReactionSeconds.toFixed(1)} sn`;
  return `<article class="team-metric" style="--team-color:${appearance.color}" data-metric-team="${team.id}"><div class="metric-title"><i></i>${appearance.label}<small>${phaseLabels[team.phase]}</small></div><div class="metric-values"><b data-measure="length">${box.length.toFixed(1)}</b><span>×</span><b data-measure="width">${box.width.toFixed(1)}</b><span>m</span></div><div class="metric-detail">${pressure}<br>Tepki: <span data-measure="reaction">${reaction}</span></div></article>`;
}
