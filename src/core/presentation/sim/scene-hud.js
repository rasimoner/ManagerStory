import { clockFromSeconds } from '../../engine/live-match.js';
import { simulationDisplayMatchTime, simulationSceneStatus } from './scene-status.js';

export function paintSimulationHud(surface, frame, { match, clubs }) {
  const home = match.userHome ? clubs.user : clubs.opponent, away = match.userHome ? clubs.opponent : clubs.user;
  paintClubBadge(surface.querySelector('[data-scene-home]'), home);
  paintClubBadge(surface.querySelector('[data-scene-away]'), away);
  surface.querySelector('[data-scene-score]').textContent = `${match.hg}–${match.ag}`;
  surface.querySelector('[data-scene-clock]').textContent = clockFromSeconds(simulationDisplayMatchTime(frame));
  paintPossessingPlayer(surface, frame, { match, clubs });
  for (const button of surface.querySelectorAll('[data-scene-speed]')) button.setAttribute('aria-pressed', String(Number(button.dataset.sceneSpeed) === match.speed));
}

function paintClubBadge(badge, club) {
  badge.textContent = club.shortName;
  badge.style.background = club.primaryColor;
  badge.style.color = club.secondaryColor;
  badge.title = club.name;
}

function paintPossessingPlayer(surface, frame, { match, clubs }) {
  const player = frame.players.find(candidate => candidate.id === frame.ball.ownerId);
  const label = surface.querySelector('.sim-scene-player'), direction = surface.querySelector('.sim-scene-direction');
  label.hidden = !player || simulationSceneStatus(frame).preparing;
  direction.hidden = !player;
  if (!player) return;
  const club = clubs[player.teamId];
  label.querySelector('b').textContent = player.number;
  label.querySelector('b').style.background = club.primaryColor;
  label.querySelector('span').textContent = match.simulationNames[player.id] ?? String(player.number);
  direction.textContent = `${club.shortName} ${player.direction > 0 ? '➜' : '⬅'}`;
}
