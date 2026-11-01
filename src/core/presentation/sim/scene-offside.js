import * as THREE from 'three';
import MATCH_SIM_DATA from '../../../data/match-sim.json';
import SIM_VIEW_DATA from '../../../data/match-sim-view.json';

export function createSimulationOffsideLine(scene) {
  const settings = SIM_VIEW_DATA.offside;
  const line = new THREE.Mesh(new THREE.PlaneGeometry(settings.width, MATCH_SIM_DATA.pitch.width),
    new THREE.MeshBasicMaterial({ color: settings.color, transparent: true, opacity: settings.opacity, depthWrite: false }));
  line.rotation.x = -Math.PI / 2;
  line.position.y = settings.height;
  line.visible = false;
  scene.add(line);
  return { paint(frame) {
    const event = frame.contacts.findLast(contact => contact.type === 'offside' && contact.time <= frame.physicsTime);
    line.visible = !!event && frame.physicsTime - event.time < settings.seconds;
    if (line.visible) line.position.x = event.lineX;
  } };
}
