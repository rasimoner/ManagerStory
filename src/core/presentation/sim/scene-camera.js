import * as THREE from 'three';
import { createBroadcastCamera } from '../match3d/newview/camera.js';
import SIM_VIEW_DATA from '../../../data/match-sim-view.json';
import MATCH_SIM_DATA from '../../../data/match-sim.json';

export function createSimulationCamera(camera) {
  const broadcast = createBroadcastCamera(camera), focus = new THREE.Vector3();
  let initialized = false;
  return {
    update(frame, seconds, aspect) {
      const points = simulationCameraPoints(frame), settings = SIM_VIEW_DATA.camera;
      const target = new THREE.Vector3().copy(points[0]);
      if (points.length > 1) target.lerp(points[1], 0.5);
      if (!initialized) { focus.copy(target); initialized = true; }
      else focus.lerp(target, 1 - Math.exp(-seconds / settings.followSeconds));
      broadcast.update({ ball: { p: focus } }, { mode: 'tv' }, seconds, aspect);
      fitSimulationCamera(camera, points);
      return broadcast.look;
    },
  };
}

export function simulationCameraPoints(frame) {
  const ball = frame.ball, pitch = MATCH_SIM_DATA.pitch;
  const points = [new THREE.Vector3().copy(ball.position)];
  const attacking = frame.players.find(player => player.teamId === (ball.shot?.teamId ?? ball.teamId));
  if (!attacking) return points;
  const goalX = pitch.length / 2 * attacking.direction;
  if (!ball.shot && Math.abs(goalX - ball.position.x) > SIM_VIEW_DATA.camera.goalApproachMetres) return points;
  points.push(new THREE.Vector3(goalX, pitch.goalHeight, -pitch.goalWidth / 2), new THREE.Vector3(goalX, 0, pitch.goalWidth / 2));
  const keeper = frame.players.find(player => player.slot === 'GK' && player.teamId !== attacking.teamId);
  if (keeper) points.push(new THREE.Vector3().copy(keeper.position).setY(1));
  return points;
}

function fitSimulationCamera(camera, points) {
  camera.updateMatrixWorld(true);
  let tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  for (const point of points) {
    const local = point.clone().applyMatrix4(camera.matrixWorldInverse), depth = Math.max(camera.near, -local.z);
    tangent = Math.max(tangent, Math.abs(local.x) / (depth * camera.aspect * SIM_VIEW_DATA.camera.margin),
      Math.abs(local.y) / (depth * SIM_VIEW_DATA.camera.margin));
  }
  camera.fov = THREE.MathUtils.radToDeg(Math.atan(tangent)) * 2;
  camera.updateProjectionMatrix();
}
