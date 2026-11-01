import * as THREE from 'three';
import { ACTIONS } from '../match3d/newview/actions.js';

export function poseSimulationPassGaze(actor, sample, frame) {
  const contact = frame.contacts.findLast(event => event.type === 'pass' && event.style === 'nolook' && event.fromId === sample.id
    && event.time <= frame.physicsTime && event.gazeTarget);
  if (!contact || frame.physicsTime - contact.time > ACTIONS.nolook.dur) return;
  const head = actor.bones.Head, position = head.getWorldPosition(new THREE.Vector3());
  head.lookAt(new THREE.Vector3(contact.gazeTarget.x, position.y, contact.gazeTarget.y));
  head.updateMatrixWorld(true);
}
