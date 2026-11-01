import { createSimulationReplay } from './scene-replay.js';
import { STAR_MOVES } from '../match3d/newview/replay.js';
import SIM_VIEW_DATA from '../../../data/match-sim-view.json';

export function createSimulationReplayPanel(stage, surface, callbacks) { return new SimulationReplayPanel(stage, surface, callbacks); }

class SimulationReplayPanel {
  constructor(stage, surface, callbacks) {
    this.stage = stage; this.surface = surface; this.callbacks = callbacks;
    this.replay = createSimulationReplay(stage.runtime, stage.ball, stage.camera);
    this.panel = document.createElement('div');
    this.panel.className = 'sim-replay'; this.panel.hidden = true;
    this.panel.innerHTML = `<div class=sim-replay-heading>TEKRAR · YILDIZ KAMERASI <span>0,35×</span><button type=button aria-label="Tekrarı kapat">✕</button></div>
      <div class=sim-replay-card><strong></strong><span></span></div><div class=sim-replay-track><i></i></div>`;
    surface.append(this.panel);
    this.panel.querySelector('button').addEventListener('click', () => this.stop());
    this.animation = null;
  }

  get active() { return this.replay.active; }

  record(frame, { paused, automatic }) {
    this.replay.record(frame);
    this.surface.querySelector('[data-scene-replay]').disabled = !paused || !this.replay.canStart;
    if (this.replay.startAutomatic(frame.physicsTime, automatic)) this.show();
  }

  start(paused) {
    if (!paused || !this.replay.start()) return;
    this.show();
  }

  show() {
    const event = this.replay.metadata;
    this.panel.querySelector('strong').textContent = STAR_MOVES[event.kind]?.name ?? 'GOL';
    this.panel.querySelector('.sim-replay-card span').textContent = this.callbacks.name(event.fromId);
    this.panel.hidden = false; this.surface.dataset.simReplaying = 'true';
    this.previous = performance.now(); this.draw(this.previous);
  }

  draw(now) {
    if (!this.active) return;
    const canvas = this.stage.renderer.domElement;
    const seconds = Math.min(SIM_VIEW_DATA.camera.maximumFrameSeconds, (now - this.previous) / 1000);
    this.previous = now;
    this.replay.advance(seconds, canvas.clientWidth / canvas.clientHeight);
    const event = this.replay.metadata;
    this.panel.querySelector('i').style.width = `${(event.time - event.start) / (event.end - event.start) * 100}%`;
    this.stage.shadow.position.x = this.stage.ball.position.x; this.stage.shadow.position.z = this.stage.ball.position.z;
    this.stage.outline.render(this.stage.scene, this.stage.camera);
    if (this.replay.complete) this.stop();
    else this.animation = requestAnimationFrame(time => this.draw(time));
  }

  stop() {
    if (this.animation != null) cancelAnimationFrame(this.animation);
    this.animation = null; this.replay.stop(); this.panel.hidden = true;
    this.surface.dataset.simReplaying = 'false'; this.callbacks.closed();
  }

  dispose() {
    if (this.animation != null) cancelAnimationFrame(this.animation);
    this.replay.stop(); this.panel.remove();
  }
}
