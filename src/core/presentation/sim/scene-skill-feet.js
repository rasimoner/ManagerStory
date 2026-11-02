import * as THREE from 'three';
import SKILL_DATA from '../../../data/match-sim-skills.json';
import MATCH_SIM_DATA from '../../../data/match-sim.json';
import { stepoverFeet, elasticoFeet, croquetaFeet } from '../match3d/newview/beats/feints.js';
import { cruyffFeet, rouletteFeet } from '../match3d/newview/beats/turns.js';
import { simulationNutmegFeet } from '../../sim/nutmeg-geometry.js';
import { nutmegFeet } from '../match3d/newview/beats/through-the-legs.js';
import { sombreroFeet } from '../match3d/newview/beats/over-the-top.js';
import { simulationCarrySkillData } from '../../sim/carry-skill-data.js';

const paths = { stepover: stepoverFeet, elastico: elasticoFeet, cruyff: cruyffFeet };

export function prepareSimulationSkillFeet(runtime, actor, { sample, frame }) {
  const skill = frame.ball.carry?.playerId === sample.id ? frame.ball.carry.skill : null;
  if (!skill) { actor.feet = simulationNutmegDefenderFeet(sample, frame); actor.sceneSkill = null; return; }
  const key = `${skill.kind}:${skill.startedAt}`;
  if (actor.sceneSkill?.key !== key) actor.sceneSkill = { key, ...createSkillFeet(runtime, actor, skill) };
  actor.sceneSkill.state.touched = skill.phase;
  actor.sceneSkill.state.stage = skill.phase;
  actor.feet = actor.sceneSkill.feet;
}

function simulationNutmegDefenderFeet(sample, frame) {
  const skill = frame.ball.carry?.skill;
  if (!SKILL_DATA.ground[skill?.kind]?.throughLegs || skill.defenderId !== sample.id) return null;
  const feet = simulationNutmegFeet({ ...sample, heading: Math.PI / 2 - sample.heading,
    velocity: { x: sample.velocity.x, y: sample.velocity.z } });
  if (!feet) return null;
  const at = offset => new THREE.Vector3(sample.position.x + offset.x, SKILL_DATA.nutmeg.footHeight, sample.position.z + offset.y);
  return { Left: { w: () => 1, at: () => at(feet[0]) }, Right: { w: () => 1, at: () => at(feet[1]) } };
}

function createSkillFeet(runtime, actor, skill) {
  const f = new THREE.Vector3(Math.cos(skill.heading), 0, Math.sin(skill.heading));
  const r = new THREE.Vector3(f.z, 0, -f.x).multiplyScalar(skill.side);
  const b0 = new THREE.Vector3(skill.position.x, MATCH_SIM_DATA.ball.radius, skill.position.y);
  const pose = SKILL_DATA.pose;
  const m = { f, r, b0, t0: skill.startedAt, plantL: b0.clone().addScaledVector(f, pose.plantForward).addScaledVector(r, pose.plantSide).setY(pose.plantHeight) };
  const context = { ball: runtime.ball };
  const feet = skillFeetFor(context, actor, { skill, m });
  return { state: m, feet: skill.side < 0 && feet ? { Left: feet.Right, Right: feet.Left } : feet };
}

function skillFeetFor(context, actor, { skill, m }) {
  if (skill.kind === 'croqueta') return croquetaFeet(context, actor, m);
  if (skill.kind === 'roulette') return rouletteFeet(context, actor, m);
  if (skill.kind === 'nutmeg') return nutmegFeet(context, { ...m, tc: SKILL_DATA.ground.nutmeg.contacts[0].at });
  if (skill.kind === 'sombrero') return sombreroFeet(context, actor, m);
  return paths[skill.kind]?.(context, m);
}

export function poseSimulationSkillContact(runtime, actor, { sample, frame }) {
  const contact = activeSkillContact(sample, frame);
  if (!contact) return;
  const { skill, elapsed } = contact;
  let side = simulationCarrySkillData(skill.kind).feet[skill.phase - 1];
  if (skill.side < 0) side = side === 'Right' ? 'Left' : 'Right';
  const target = new THREE.Vector3().copy(frame.ball.position); target.y -= MATCH_SIM_DATA.ball.radius;
  if (skill.kind === 'croqueta') plantCroquetaSupport(runtime, actor, { target, side });
  runtime.footIK(actor, side, target, 1 - elapsed / SKILL_DATA.contactSeconds);
}

function activeSkillContact(sample, frame) {
  const carry = frame.ball.carry, skill = carry?.playerId === sample.id ? carry.skill : null;
  if (!skill || carry.touchTick == null || skill.phase === 0) return null;
  if (simulationCarrySkillData(skill.kind).throughLegs && skill.phase > 1) return null;
  const elapsed = frame.physicsTime - carry.touchTick * MATCH_SIM_DATA.clock.stepSeconds;
  return elapsed >= 0 && elapsed <= SKILL_DATA.contactSeconds ? { skill, elapsed } : null;
}

function plantCroquetaSupport(runtime, actor, { target, side }) {
  const offset = SKILL_DATA.pose.supportSideOffset * (side === 'Right' ? -1 : 1);
  const support = target.clone().add(new THREE.Vector3(Math.cos(actor.heading) * offset, 0, -Math.sin(actor.heading) * offset));
  support.y = SKILL_DATA.pose.plantHeight;
  runtime.footIK(actor, side === 'Right' ? 'Left' : 'Right', support, 1);
}
