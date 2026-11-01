import * as THREE from 'three';
import { createReplay } from '../match3d/newview/replay.js';
import SIM_VIEW_DATA from '../../../data/match-sim-view.json';

export function createSimulationReplay(runtime, ball, camera) { return new RecordedSimulationReplay(runtime, ball, camera); }

class RecordedSimulationReplay {
  constructor(runtime, ball, camera) {
    const settings = SIM_VIEW_DATA.replay;
    this.runtime = runtime; this.ball = ball; this.camera = camera;
    this.buffer = createReplay({ frames: settings.frames, minDt: settings.minimumSeconds });
    this.live = createReplay({ frames: 1, minDt: 0 });
    this.source = { S: runtime.S, players: runtime.players, ball: { p: ball.position } };
    this.roster = ''; this.latest = null; this.playback = null;
  }

  record(frame) {
    if (this.playback) return;
    this.source.players = this.runtime.players.filter(player => !player.offPitch);
    const key = this.source.players.map(player => player.key).join(':');
    if (this.roster !== key) { this.buffer.clear(); this.latest = null; this.roster = key; }
    this.buffer.record(this.source, this.ball);
    const event = replayContact(frame);
    if (event) {
      event.key = this.source.players.find(player => player.id === event.fromId)?.key ?? event.key;
      this.latest = event;
    }
  }

  start() {
    if (this.playback || !this.canStart) return false;
    this.live.clear(); this.live.record(this.source, this.ball);
    const camera = this.camera;
    this.savedCamera = { position: camera.position.clone(), quaternion: camera.quaternion.clone(), fov: camera.fov };
    const range = replayRange(this.buffer, this.latest);
    this.playback = { ...this.latest, ...range, time: range.start };
    return true;
  }

  advance(seconds, aspect) {
    if (!this.playback) return;
    const playback = this.playback;
    playback.time = Math.min(playback.end, playback.time + Math.max(0, seconds) * SIM_VIEW_DATA.replay.speed);
    this.buffer.apply(this.runtime, this.ball, playback.time);
    const star = this.buffer.posOf(playback.key, playback.time) ?? this.ball.position.clone();
    poseRecordedReplayCamera(this.camera, { star, ball: this.ball.position, aspect });
  }

  stop() {
    if (!this.playback) return;
    this.live.apply(this.runtime, this.ball, 0);
    const camera = this.camera;
    camera.position.copy(this.savedCamera.position); camera.quaternion.copy(this.savedCamera.quaternion); camera.fov = this.savedCamera.fov;
    camera.updateProjectionMatrix(); this.playback = null;
  }

  get complete() { return this.playback && this.playback.time >= this.playback.end; }
  get active() { return !!this.playback; }
  get metadata() { return this.playback ? { ...this.playback } : null; }
  get canStart() { return !!replayRange(this.buffer, this.latest); }
  get count() { return this.buffer.count; }
  get estimatedBytes() { return SIM_VIEW_DATA.replay.frames * (this.source.players.length * SIM_VIEW_DATA.replay.actorStrideBytes + SIM_VIEW_DATA.replay.ballStrideBytes); }
}

function replayContact(frame) {
  const event = frame.contacts.findLast(event => event.time <= frame.physicsTime && replayKind(event));
  return event ? { type: event.type, kind: replayKind(event), eventTime: event.time, key: `${event.teamId}:${event.fromId}`, fromId: event.fromId } : null;
}

function replayKind(event) {
  if (event.type === 'shot' && ['chip', 'panenka'].includes(event.style)) return event.style;
  if (event.type === 'save' && event.success) return 'starsave';
  return event.type === 'goal' ? 'goal' : null;
}

function replayRange(record, event) {
  if (!event) return null;
  const [first, last] = record.span(), settings = SIM_VIEW_DATA.replay;
  if (event.eventTime < first || event.eventTime > last) return null;
  const start = Math.max(first, event.eventTime - settings.preSeconds), end = Math.min(last, event.eventTime + settings.postSeconds);
  return end - start >= settings.minimumSpan ? { start, end } : null;
}

function poseRecordedReplayCamera(camera, { star, ball, aspect }) {
  const settings = SIM_VIEW_DATA.replay.camera, tall = aspect < settings.tallAspect;
  const up = Math.max(0, ball.y - SIM_VIEW_DATA.replay.ballRadius), separation = Math.hypot(ball.x - star.x, ball.z - star.z);
  const pull = Math.max(1 + Math.min(settings.maximumAirPull, up * settings.airPull),
    (separation * (tall ? settings.tallSeparation : settings.wideSeparation) + settings.margin) / settings.span);
  const weight = separation > settings.separationThreshold ? settings.farBallWeight : settings.nearBallWeight + Math.min(settings.maximumBallWeight, up * settings.ballHeightWeight);
  star.lerp(ball.clone().setY(0), weight);
  camera.position.copy(star).add(new THREE.Vector3(settings.x * pull, (tall ? settings.tallHeight : settings.wideHeight) * pull, (tall ? settings.tallDepth : settings.wideDepth) * pull));
  camera.fov = tall ? settings.tallFov : settings.wideFov;
  camera.aspect = aspect; camera.updateProjectionMatrix();
  camera.lookAt(star.setY(settings.lookHeight + Math.min(settings.maximumLookLift, up * settings.lookLift)));
}
