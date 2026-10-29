import { M } from '../../state.js';
import { simulationPitchPercent } from '../../match/career-events.js';
import { resolveClubIdentity } from '../../clubs/clubs.js';
import CAREER_SIM_DATA from '../../../data/match-sim-career.json';
import { captureSimulationFrame } from '../../match/playback-frames.js';
import { clockFromSeconds } from '../../engine/live-match.js';

export function experimentalPitch() {
  const frame = M.simulationDisplayFrame ?? captureSimulationFrame(M.simulation);
  const players = frame.players.filter(player => !player.sentOff).map(player => experimentalPlayerDot(player)).join('');
  return `<div class="sim-status"><span data-sim-mode>Kesintisiz · 2D</span><small>Müdahale anında; oyuncu değişikliği ilk duruşta.</small></div><div class="livepitch v73pitch sim-career-pitch" data-sim-pitch aria-label="Deneysel 2D maç sahası"><div class=pitch-half-line></div><div class=pitch-center-circle></div><div class="pitch-box pitch-box-left"></div><div class="pitch-box pitch-box-right"></div><div class="pitch-goal-area pitch-goal-area-left"></div><div class="pitch-goal-area pitch-goal-area-right"></div>${players}<span class=sim-ball data-sim-ball aria-label=Top>●</span><span class=sim-event data-sim-event></span></div>`;
}

function experimentalPlayerDot(player) {
  const own = player.teamId === 'user';
  const name = own ? (M.userHome ? M.home : M.away) : (M.userHome ? M.away : M.home);
  const identity = resolveClubIdentity('goal', { teamId: name });
  const position = simulationPitchPercent(player.position);
  return `<button class=sim-player data-sim-player="${player.id}" data-action="${own ? 'openMatchPlayer' : 'openOpponentPlayer'}" data-id="${player.id}" style="left:${position[0]}%;top:${position[1]}%;--kit-primary:${identity.primaryColor};--kit-secondary:${identity.secondaryColor}" aria-label="${player.number} numaralı oyuncu">${player.number}</button>`;
}

export function paintExperimentalPitch() {
  const root = document.querySelector('[data-sim-pitch]');
  if (!root) return;
  for (const element of root.querySelectorAll('[data-sim-player]')) {
    const position = M.dynamicPositions[element.dataset.simPlayer];
    element.hidden = !position;
    if (position) placeExperimentalElement(element, position);
    element.classList.toggle('sim-owner', String(M.ballOwner) === element.dataset.simPlayer);
  }
  const ball = root.querySelector('[data-sim-ball]');
  placeExperimentalElement(ball, [M.ballX, M.ballY]);
  paintExperimentalCaption(root);
  paintExperimentalClock();
}

function paintExperimentalCaption(root) {
  root.dataset.playback = M.simulationPlayback.mode;
  const label = document.querySelector('[data-sim-mode]');
  if (label) label.textContent = `Kesintisiz · ${M.simulationPlayback.currentRate.toFixed(1)}× · 2D`;
  const event = M.events.filter(entry => ['goal', 'shot', 'save', 'red', 'injury'].includes(entry.type)).at(-1);
  const visible = event && M.matchElapsedSeconds - event.simulationTime <= CAREER_SIM_DATA.playback.eventCaptionSeconds;
  root.querySelector('[data-sim-event]').textContent = visible ? event.text : '';
  root.classList.toggle('sim-goal', !!(visible && event.type === 'goal'));
}

function paintExperimentalClock() {
  const clock = document.querySelector('#live-clock'), score = document.querySelector('#live-score');
  if (clock) clock.textContent = clockFromSeconds(M.matchElapsedSeconds);
  if (score) score.textContent = `${M.hg}–${M.ag}`;
}

function placeExperimentalElement(element, position) {
  element.style.left = position[0] + '%';
  element.style.top = position[1] + '%';
}
