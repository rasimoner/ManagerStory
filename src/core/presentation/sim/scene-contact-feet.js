import * as THREE from 'three';
import SIM_VIEW_DATA from '../../../data/match-sim-view.json';
import MATCH_SIM_DATA from '../../../data/match-sim.json';

export function poseSimulationContactFoot(runtime, actor, { sample, frame }) {
  if (actor.keeper || actor.motion) return;
  const time = observedFootContact(sample, frame);
  const elapsed = frame.physicsTime - time, settings = SIM_VIEW_DATA.pose;
  if (elapsed < 0 || elapsed >= settings.ballContactSeconds || frame.ball.position.y > settings.chestControlHeight) return;
  const target = new THREE.Vector3().copy(frame.ball.position);
  if (target.clone().setY(0).distanceTo(actor.pos) > settings.maximumFootReachMetres) return;
  if (actor.sceneTouchTime !== time) {
    actor.sceneTouchTime = time;
    actor.sceneTouchFoot = nearestBoot(actor, target);
  }
  delete actor.scenePlants?.[actor.sceneTouchFoot];
  target.y = Math.max(settings.plantHeight, target.y - MATCH_SIM_DATA.ball.radius);
  runtime.footIK(actor, actor.sceneTouchFoot, target, 1 - elapsed / settings.ballContactSeconds);
}

function observedFootContact(sample, frame) {
  const carry = frame.ball.carry;
  if (carry?.playerId === sample.id) return carry.touchTick * MATCH_SIM_DATA.clock.stepSeconds;
  const contact = frame.contacts.findLast(event => event.type === 'firstTouch' && event.toId === sample.id
    && event.time <= frame.physicsTime && event.height < SIM_VIEW_DATA.pose.chestControlHeight);
  return contact?.time ?? -Infinity;
}

function nearestBoot(actor, target) {
  const distance = side => actor.bones[`${side}ToeBase`].getWorldPosition(new THREE.Vector3()).distanceTo(target);
  return distance('Left') < distance('Right') ? 'Left' : 'Right';
}
