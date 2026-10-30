import { fanPhoto } from '../../clubs/clubs.js';
import { observedSimulationGoal } from './scene-atmosphere.js';
import SIM_VIEW_DATA from '../../../data/match-sim-view.json';

export function createSimulationGoalOverlay(surface) {
  const overlay = document.createElement('div');
  overlay.className = 'pitch-goal-overlay sim-goal-overlay';
  overlay.hidden = true;
  overlay.innerHTML = '<img alt="Golü atan takımın taraftarları"><div class="goal-club-props"></div><strong>GOOOL!</strong><small></small>';
  surface.append(overlay);
  const image = overlay.querySelector('img');
  let lastGoal = null;
  image.onerror = () => {
    if (image.dataset.fallback === 'true') return;
    image.dataset.fallback = 'true';
    image.src = 'assets/atmosphere/fans-neutral.webp';
  };
  return {
    paint(frame, clubs) {
      const goal = observedSimulationGoal(frame), settings = SIM_VIEW_DATA.atmosphere;
      const elapsed = goal ? frame.physicsTime - goal.time : -1;
      overlay.hidden = !goal || elapsed < settings.photoDelaySeconds || elapsed >= settings.photoDelaySeconds + settings.photoSeconds;
      if (!goal) { lastGoal = null; return; }
      const key = `${goal.time}:${goal.fromId}`;
      if (key === lastGoal) return;
      lastGoal = key;
      const teamId = goal.teamId ?? frame.players.find(player => player.id === goal.fromId)?.teamId;
      const club = clubs[teamId];
      if (!club) { overlay.hidden = true; return; }
      overlay.style.setProperty('--goal-primary', club.primaryColor);
      overlay.style.setProperty('--goal-secondary', club.secondaryColor);
      overlay.querySelector('small').textContent = club.name;
      overlay.dataset.team = club.name;
      image.dataset.fallback = 'false';
      image.src = fanPhoto(club.name);
    },
    hide() { overlay.hidden = true; },
  };
}
