import MATCH_SIM_DATA from '../../../data/match-sim.json';
import { simulationKeeperReach } from '../../sim/keeper-reaction.js';
import { toLabFieldPoint } from './field-markings.js';

export function labShootingMarkup(simulation) {
  return shotAngleMarkup(simulation) + shotTrailMarkup(simulation) + simulation.teams.map(team => keeperReachMarkup(simulation, team)).join('');
}

function shotAngleMarkup(simulation) {
  const option = simulation.ownerDecision.shot;
  if (!option || simulation.ball.ownerId == null) return '';
  const start = toLabFieldPoint(simulation.ball.position);
  const lines = option.goalPosts.map(position => {
    const end = toLabFieldPoint(position);
    return `<path d="M${start.x},${start.y} L${end.x},${end.y}"/>`;
  }).join('');
  return `<g data-overlay="shot-angle" fill="none" stroke="#ffcb84" stroke-width=".3" stroke-dasharray="1 .7" pointer-events="none">${lines}</g>`;
}

function shotTrailMarkup(simulation) {
  const shooting = simulation.shooting;
  if (!shooting || (simulation.tick - shooting.lastShotTick) * MATCH_SIM_DATA.clock.stepSeconds > MATCH_SIM_DATA.lab.pathSeconds) return '';
  const points = shooting.path.map(position => { const point = toLabFieldPoint(position); return `${point.x},${point.y}`; }).join(' ');
  return `<polyline data-overlay="shot-path" points="${points}" fill="none" stroke="#ffb46d" stroke-width=".65" pointer-events="none"/>`;
}

function keeperReachMarkup(simulation, team) {
  const keeper = team.players.find(player => player.slot === 'GK');
  const point = toLabFieldPoint(keeper.position), state = keeper.keeper;
  const reach = simulationKeeperReach(keeper, simulation.time);
  const target = state.target?.y ?? keeper.position.y;
  const extension = Math.max(-reach.horizontal, Math.min(reach.horizontal, target - keeper.position.y));
  const reacting = state.shotIndex != null && simulation.time < state.reactionAt;
  const label = keeperLabel(simulation, state, reacting);
  return `<g data-overlay="keeper-reach" data-keeper-mode="${state.mode}" pointer-events="none"><ellipse cx="${point.x}" cy="${point.y}" rx="${reach.horizontal}" ry="${MATCH_SIM_DATA.goalkeeper.bodyReach}" fill="#80d6ff22" stroke="#93ddff" stroke-width=".25"/><path d="M${point.x},${point.y} h${reacting ? 0 : extension}" stroke="#b7ebff" stroke-width=".9"/><circle cx="${point.x + (reacting ? 0 : extension)}" cy="${point.y}" r=".35" fill="#e7f8ff"/><text x="${point.x}" y="${point.y + 4}" text-anchor="middle" fill="#c2eaff" font-size="1.65" paint-order="stroke" stroke="#12332d" stroke-width=".5">${label} · ↕${reach.vertical.toFixed(1)} m</text></g>`;
}

function keeperLabel(simulation, state, reacting) {
  if (state.lastSave && simulation.time - state.lastSave.time < MATCH_SIM_DATA.lab.incidentSeconds) return `${{ catch: 'TUTTU', parry: 'ÇELDİ', tip: 'SAPTIRDI' }[state.lastSave.kind]} ${state.lastSave.difficulty.toFixed(2)}`;
  if (reacting) return `Tepki ${(state.reactionAt - simulation.time).toFixed(2)} sn`;
  return { set: 'SET', positioning: 'Konum', rush: 'Çıkıyor', dive: 'PLONJON', step: 'Adım', holding: 'Elinde', distribution: 'Dağıtım', reacting: 'Uzanıyor' }[state.mode] ?? '';
}

export function labGoalSignalMarkup(simulation, events) {
  const goal = events.findLast(event => event.type === 'goal');
  if (!goal || simulation.time - goal.time > MATCH_SIM_DATA.lab.incidentSeconds) return '';
  return `<g data-goal-signal pointer-events="none"><rect x="23" y="46" width="22" height="10" rx="2" fill="#173a33ee" stroke="#ffe09d" stroke-width=".3"/><text x="34" y="53" fill="#ffe09d" font-size="5" font-weight="800" text-anchor="middle">GOL</text></g>`;
}
