import * as THREE from 'three';
import { createBroadcastCamera } from '../match3d/newview/camera.js';
import SIM_VIEW_DATA from '../../../data/match-sim-view.json';
import { observedSimulationGoal } from './scene-atmosphere.js';
import MATCH_SIM_DATA from '../../../data/match-sim.json';

export function createSimulationCamera(camera) {
  const broadcast = createBroadcastCamera(camera);
  return {
    update(frame, seconds, view) {
      const { aspect, mode = 'auto' } = typeof view === 'number' ? { aspect: view } : view;
      const shot = simulationCameraShot(frame, mode);
      broadcast.update({ ball: { p: new THREE.Vector3().copy(frame.ball.position) } }, shot, seconds, aspect);
      if (mode === 'auto' && ['shot', 'side'].includes(shot.mode)) fitSimulationCamera(camera, simulationCameraPoints(frame), broadcast.look);
      return broadcast.look;
    },
  };
}

export function simulationCameraShot(frame, mode) {
  const actor = player => player ? { pos: new THREE.Vector3().copy(player.position) } : null;
  const owner = frame.players.find(player => player.id === frame.ball.ownerId)
    ?? frame.players.reduce((nearest, player) => !nearest || new THREE.Vector3().copy(player.position).distanceTo(frame.ball.position)
      < new THREE.Vector3().copy(nearest.position).distanceTo(frame.ball.position) ? player : nearest, null);
  if (mode !== 'auto') return { mode, a: actor(owner) };
  const goal = observedSimulationGoal(frame);
  if (goal) return { mode: 'close', a: actor(frame.players.find(player => player.id === goal.fromId)) };
  const shot = frame.ball.shot;
  if (!shot) return { mode: 'tv' };
  const shooter = frame.players.find(player => player.id === shot.fromId) ?? owner;
  const keeper = frame.players.find(player => player.slot === 'GK' && player.teamId !== shot.teamId);
  if (!shooter || !keeper) return { mode: 'tv' };
  const near = new THREE.Vector3().copy(shooter.position).distanceTo(keeper.position) < SIM_VIEW_DATA.camera.shotMinimumSeparationMetres;
  return { mode: near ? 'side' : 'shot', a: actor(shooter), b: actor(keeper) };
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

function fitSimulationCamera(camera, points, look) {
  camera.updateMatrixWorld(true);
  let scale = 1;
  const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), distance = camera.position.distanceTo(look);
  for (const point of points) {
    const local = point.clone().applyMatrix4(camera.matrixWorldInverse);
    const needed = Math.max(Math.abs(local.x) / (tangent * camera.aspect * SIM_VIEW_DATA.camera.margin),
      Math.abs(local.y) / (tangent * SIM_VIEW_DATA.camera.margin));
    scale = Math.max(scale, 1 + (needed + local.z) / distance);
  }
  camera.position.sub(look).multiplyScalar(scale).add(look);
  camera.lookAt(look);
  camera.updateMatrixWorld(true);
}
