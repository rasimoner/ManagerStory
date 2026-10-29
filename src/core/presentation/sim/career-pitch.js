import { M } from '../../state.js';
import { simulationPitchPercent } from '../../match/career-events.js';
import { resolveClubIdentity } from '../../clubs/clubs.js';
import CAREER_SIM_DATA from '../../../data/match-sim-career.json';
import MATCH_SIM_DATA from '../../../data/match-sim.json';
import { captureSimulationFrame } from '../../match/playback-frames.js';
import { clockFromSeconds } from '../../engine/live-match.js';
import { usesNaturalMatchClock } from '../../sim/simulation-clock.js';
import MATCH_DURATION_DATA from '../../../data/match-duration.json';

export function experimentalPitch() {
  const frame = M.simulationDisplayFrame ?? captureSimulationFrame(M.simulation);
  const players = frame.players.filter(player => !player.sentOff).map(player => experimentalPlayerDot(player)).join('');
  return `<div class="sim-status"><span data-sim-mode>Kesintisiz · 2D</span><small>Müdahale anında; oyuncu değişikliği ilk duruşta.</small></div><div class="livepitch v73pitch sim-career-pitch" data-sim-pitch data-sim-paused="${M.pause}" aria-label="Deneysel 2D maç sahası"><div class=pitch-half-line></div><div class=pitch-center-circle></div><div class="pitch-box pitch-box-left"></div><div class="pitch-box pitch-box-right"></div><div class="pitch-goal-area pitch-goal-area-left"></div><div class="pitch-goal-area pitch-goal-area-right"></div>${players}<span class=sim-ball data-sim-ball aria-label=Top style="left:${M.ballX}%;top:${M.ballY}%">●</span><span class=sim-event data-sim-event></span></div>`;
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
  const bounds = { width: root.clientWidth, height: root.clientHeight };
  root.dataset.simTime = String(M.matchElapsedSeconds);
  root.dataset.simPhysicsTime = String(M.simulation.time);
  root.dataset.simTick = String(M.simulation.tick);
  root.dataset.simPaused = String(M.pause);
  paintExperimentalTransition(root);
  for (const element of root.querySelectorAll('[data-sim-player]')) {
    const position = M.dynamicPositions[element.dataset.simPlayer];
    element.hidden = !position;
    if (position) placeExperimentalElement(element, position, bounds);
    element.classList.toggle('sim-owner', String(M.ballOwner) === element.dataset.simPlayer);
  }
  const ball = root.querySelector('[data-sim-ball]');
  placeExperimentalElement(ball, [M.ballX, M.ballY], bounds);
  paintExperimentalCaption(root);
  paintExperimentalClock();
}

function paintExperimentalTransition(root) {
  const duration = Math.max(CAREER_SIM_DATA.playback.minimumTransitionSeconds,
    MATCH_SIM_DATA.clock.stepSeconds / M.simulationPlayback.currentRate).toFixed(3) + 's';
  if (root.style.getPropertyValue('--sim-transition') !== duration) root.style.setProperty('--sim-transition', duration);
}

function paintExperimentalCaption(root) {
  root.dataset.playback = M.simulationPlayback.mode;
  const label = document.querySelector('[data-sim-mode]');
  const mode = usesNaturalMatchClock(M.simulation) ? `Doğal akış · ${M.simulation.clock.durationSeconds / MATCH_DURATION_DATA.secondsPerMinute} dk (1×)` : 'Kesintisiz';
  paintExperimentalText(label, `${mode} · ${M.simulationPlayback.currentRate.toFixed(1)}× · 2D`);
  const event = M.events.findLast(entry => ['goal', 'shot', 'save', 'red', 'injury'].includes(entry.type));
  const visible = event && M.simulation.time - event.simulationTime <= CAREER_SIM_DATA.playback.eventCaptionSeconds;
  paintExperimentalText(root.querySelector('[data-sim-event]'), visible ? event.text : '');
  root.classList.toggle('sim-goal', !!(visible && event.type === 'goal'));
}

function paintExperimentalClock() {
  const clock = document.querySelector('#live-clock'), score = document.querySelector('#live-score');
  paintExperimentalText(clock, clockFromSeconds(M.matchElapsedSeconds));
  paintExperimentalText(score, `${M.hg}–${M.ag}`);
}

function placeExperimentalElement(element, position, bounds) {
  // A fixed percentage origin avoids a jump when the pitch is rebuilt; only transforms move thereafter.
  const x = bounds.width * (position[0] - parseFloat(element.style.left)) / CAREER_SIM_DATA.positionScale;
  const y = bounds.height * (position[1] - parseFloat(element.style.top)) / CAREER_SIM_DATA.positionScale;
  element.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;
}

function paintExperimentalText(element, text) { if (element && element.textContent !== text) element.textContent = text; }
