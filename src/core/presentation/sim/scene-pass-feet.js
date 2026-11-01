import * as THREE from 'three';
import SKILL_DATA from '../../../data/match-sim-skills.json';
import MATCH_SIM_DATA from '../../../data/match-sim.json';
import { stepoverFeet } from '../match3d/newview/beats/feints.js';
import { backheelFeet, rabonaFeet } from '../match3d/newview/beats/flair-passes.js';

export function prepareSimulationPassFeet(runtime, actor, { sample, frame }) {
  const technique = observedPassTechnique(sample, frame);
  if (!technique || technique.readyAt == null) return;
  const settings = SKILL_DATA.flairPass;
  const elapsed = frame.physicsTime - technique.readyAt;
  if (elapsed > settings.poseSeconds) return;
  const b0 = new THREE.Vector3(technique.position.x, MATCH_SIM_DATA.ball.radius, technique.position.y);
  const f = new THREE.Vector3(Math.cos(technique.heading), 0, Math.sin(technique.heading));
  const r = new THREE.Vector3(f.z, 0, -f.x), rA = new THREE.Vector3(-f.z, 0, f.x);
  const context = { ball: { p: b0 } }, t0 = technique.readyAt;
  const plantL = b0.clone().addScaledVector(rA, settings.rabona.plantSide).addScaledVector(f, settings.rabona.plantForward).setY(settings.plantHeight);
  if (technique.kind === 'flairpass') { actor.feet = stepoverFeet(context, { t0, b0, f, r }); return; }
  actor.feet = technique.kind === 'backheel' ? backheelFeet(context, { t0, b0, f, r }) : rabonaFeet(context, { t0, aim: f, rA, plantL });
}

export function observedPassTechnique(sample, frame) {
  if (frame.ball.passTechnique?.ownerId === sample.id) return frame.ball.passTechnique;
  return frame.contacts.findLast(event => event.type === 'pass' && event.fromId === sample.id && event.time <= frame.physicsTime && event.technique)?.technique;
}
