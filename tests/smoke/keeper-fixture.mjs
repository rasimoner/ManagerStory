import * as THREE from 'three';
import rigData from '../../src/assets/models/footballer-rig.json';
import { loadRig } from '../../src/core/presentation/match3d/newview/rig.js';
import { analyseGait } from '../../src/core/presentation/match3d/newview/runtime.js';
import { createSimulationStage } from '../../src/core/presentation/sim/scene-stage.js';
import { createSimulationActors } from '../../src/core/presentation/sim/scene-actors.js';
import { sampleSimulationScene } from '../../src/core/presentation/sim/scene-frame.js';
import { simulationSceneKit } from '../../src/core/presentation/sim/scene-kits.js';
import { createSimulationBallView } from '../../src/core/presentation/sim/scene-ball.js';

// Test-only page, bundled separately by the smoke runner. No product entry or persisted game globals.
const rig = loadRig(rigData), gait = {};
for (const name of ['walk', 'run', 'sprint']) gait[name] = analyseGait(rig.newInstance().group, rig.clips[name]);
const canvas = document.querySelector('canvas'), stage = createSimulationStage(canvas, { rig, gait });
const club = { primaryColor: '#e2bc12', secondaryColor: '#d72231' };
const ballView = createSimulationBallView(stage.ball, stage.shadow, { runtime: stage.runtime });
const actors = createSimulationActors(stage.runtime, player => ({ key: String(player.id), id: player.id, no: player.number,
  keeper: player.slot === 'GK', role: player.slot, kit: simulationSceneKit(club, player) }));
let recording;
let cameraOffset;

function install(value) {
  recording = value;
  const keeper = value.frames[0].players.find(player => player.id === value.keeperId), direction = -keeper.direction;
  const portrait = innerWidth < innerHeight, distance = portrait ? 12 : 7;
  stage.renderer.setSize(innerWidth, innerHeight, false);
  stage.camera.aspect = innerWidth / innerHeight;
  stage.camera.fov = 42;
  cameraOffset = new THREE.Vector3(-direction * distance, 3, 3);
  stage.camera.updateProjectionMatrix();
  drawAt(0);
}

function drawAt(time) {
  const index = Math.max(0, recording.frames.findIndex(frame => frame.physicsTime >= time));
  const current = recording.frames[index], previous = recording.frames[Math.max(0, index - 1)];
  const frame = sampleSimulationScene({ frame: current, previousFrame: previous, accumulatorSeconds: time - previous.physicsTime });
  actors.apply(frame);
  ballView.apply(frame);
  const keeper = frame.players.find(player => player.id === recording.keeperId);
  stage.camera.position.copy(keeper.position).add(cameraOffset);
  stage.camera.lookAt(keeper.position.x, .8, keeper.position.z);
  stage.outline.render(stage.scene, stage.camera);
  const event = frame.contacts.findLast(contact => contact.time <= frame.physicsTime && ['save', 'goal', 'keeperDistribution'].includes(contact.type));
  document.querySelector('output').textContent = `Yalıtılmış motor senaryosu · ${recording.label}\nFizik ${frame.physicsTime.toFixed(3)} sn · ${event ? `${event.type} ${event.kind ?? ''}` : 'tepki / uçuş'}`;
  document.body.dataset.physicsTime = String(frame.physicsTime);
  return keeperPoints(frame);
}

function keeperPoints(frame) {
  const actor = stage.runtime.players.find(player => player.id === recording.keeperId);
  const drawn = frame.players.find(player => player.id === recording.keeperId);
  const bones = Object.fromEntries(Object.entries(actor.bones).map(([name, bone]) => [name, bone.getWorldPosition(new THREE.Vector3()).toArray()]));
  const grip = actor.bones.LeftHand.getWorldPosition(new THREE.Vector3()).add(actor.bones.RightHand.getWorldPosition(new THREE.Vector3())).multiplyScalar(.5);
  return { time: frame.physicsTime, root: actor.model.position.toArray(), expectedRoot: [drawn.position.x, 0, drawn.position.z], bones,
    held: frame.ball.heldBy === actor.id, gripGap: stage.ball.position.distanceTo(grip),
    webgl: stage.renderer.getContext().getParameter(stage.renderer.getContext().VERSION) };
}

globalThis.keeperEvidence = { install, drawAt };
