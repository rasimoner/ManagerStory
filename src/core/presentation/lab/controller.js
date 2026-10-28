import MATCH_SIM_DATA from '../../../data/match-sim.json';
import { clampSimValue } from '../../sim/geometry.js';
import { createLabSession } from './session.js';
import { createLaboratoryView, showLaboratoryControls } from './screen.js';
import { renderLaboratoryField } from './field-view.js';

export function startLaboratory() {
  const view = createLaboratoryView(document.querySelector('#lab'));
  const runner = createLabSession();
  const context = { view, runner, layers: { roles: true, shape: true, velocity: false, anchors: false, passes: true, flight: true }, lastFrame: null };
  bindLaboratoryControls(context);
  document.addEventListener('visibilitychange', () => {
    context.lastFrame = null;
    if (document.hidden) runner.session.running = false;
  });
  const frame = timestamp => {
    guardedLabAction(view, () => advanceLaboratoryFrame(context, timestamp), false);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function advanceLaboratoryFrame(context, timestamp) {
  const elapsed = context.lastFrame === null ? 0 : (timestamp - context.lastFrame) / 1000;
  context.lastFrame = timestamp;
  context.runner.advance(elapsed);
  const snapshot = context.runner.snapshot();
  renderChangedLaboratoryField(context, snapshot);
  showLaboratoryControls(context.view, snapshot);
}

function renderChangedLaboratoryField(context, snapshot) {
  const simulation = snapshot.simulation;
  const revision = JSON.stringify([simulation.seed, simulation.tick, simulation.ball.position, simulation.ball.teamId,
    context.layers, simulation.teams.map(team => [team.formation, team.tactics]), simulation.passing.requested]);
  if (revision === context.lastRevision) return;
  renderLaboratoryField(context.view, snapshot, context.layers);
  context.lastRevision = revision;
}

function bindLaboratoryControls(context) {
  const { root } = context.view;
  root.addEventListener('click', event => guardedLabAction(context.view, () => handleLaboratoryCommand(context, event)));
  root.addEventListener('change', event => guardedLabAction(context.view, () => handleLaboratorySetting(context, event.target)));
  root.querySelector('#lab-seed-form').addEventListener('submit', event => {
    event.preventDefault();
    guardedLabAction(context.view, () => resetLaboratorySeed(context));
  });
  context.view.field.addEventListener('pointerdown', event => guardedLabAction(context.view, () => placeLaboratoryBall(context, event)));
  context.view.field.addEventListener('keydown', event => moveLaboratoryBallWithKeys(context, event));
}

function handleLaboratoryCommand(context, event) {
  const button = event.target.closest('[data-command]');
  if (!button) return;
  const runner = context.runner;
  const commands = {
    play: () => { runner.session.running = !runner.session.running; },
    speed: () => { runner.session.speed = Number(button.dataset.speed); },
    owner: () => runner.chooseOwner(button.dataset.team),
    finish: () => { runner.completeMatch(); context.lastFrame = null; },
  };
  commands[button.dataset.command]();
}

function handleLaboratorySetting(context, target) {
  const { runner, view } = context;
  if (target.dataset.layer) { context.layers[target.dataset.layer] = target.checked; return; }
  if (target.id === 'lab-auto') { runner.enableAutomatic(target.checked); return; }
  if (['lab-press', 'lab-line', 'lab-passing-style'].includes(target.id)) {
    runner.setTactics({ press: view.root.querySelector('#lab-press').value, line: view.root.querySelector('#lab-line').value,
      passingStyle: view.root.querySelector('#lab-passing-style').value });
  }
  if (['lab-formation', 'lab-away-formation'].includes(target.id)) {
    runner.reset({ formation: view.root.querySelector('#lab-formation').value, awayFormation: view.root.querySelector('#lab-away-formation').value });
  }
}

function resetLaboratorySeed(context) {
  const input = context.view.root.querySelector('#lab-seed');
  const value = Number(input.value);
  if (!input.value || !Number.isSafeInteger(value) || value < 0) throw new RangeError('Tohum sıfır veya pozitif bir tam sayı olmalı.');
  context.runner.reset({ seed: value });
}

function placeLaboratoryBall(context, event) {
  event.preventDefault();
  const player = event.target.closest('[data-player]');
  if (player) { context.runner.passTo({ toId: player.dataset.player, lofted: context.view.root.querySelector('#lab-lob').checked }); return; }
  const field = context.view.field;
  const point = field.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const local = point.matrixTransform(field.getScreenCTM().inverse());
  context.runner.placeBall(laboratoryBallPosition({ x: local.x, y: local.y }));
}

function laboratoryBallPosition(point) {
  const { length, width } = MATCH_SIM_DATA.pitch;
  return { x: clampSimValue(length / 2 - point.y, -length / 2, length / 2), y: clampSimValue(point.x - width / 2, -width / 2, width / 2) };
}

function moveLaboratoryBallWithKeys(context, event) {
  const offsets = { ArrowUp: { x: 1, y: 0 }, ArrowDown: { x: -1, y: 0 }, ArrowLeft: { x: 0, y: -1 }, ArrowRight: { x: 0, y: 1 } };
  const offset = offsets[event.key];
  if (!offset) return;
  event.preventDefault();
  const ball = context.runner.snapshot().simulation.ball.position;
  const step = MATCH_SIM_DATA.lab.keyboardBallStep;
  const point = { x: MATCH_SIM_DATA.pitch.width / 2 + ball.y + offset.y * step, y: MATCH_SIM_DATA.pitch.length / 2 - ball.x - offset.x * step };
  context.runner.placeBall(laboratoryBallPosition(point));
}

function guardedLabAction(view, action, clearError = true) {
  try { action(); if (clearError) view.error.hidden = true; }
  catch (error) { view.error.textContent = error.message; view.error.hidden = false; }
}
