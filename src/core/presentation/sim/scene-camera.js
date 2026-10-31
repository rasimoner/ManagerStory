import * as THREE from 'three';
import { createBroadcastCamera } from '../match3d/newview/camera.js';
import SIM_VIEW_DATA from '../../../data/match-sim-view.json';
import { observedSimulationGoal } from './scene-atmosphere.js';
import MATCH_SIM_DATA from '../../../data/match-sim.json';

export function createSimulationCamera(camera) {
  const broadcast = createBroadcastCamera(camera, { smoothTransitions: true });
  return {
    update(frame, seconds, view) {
      const { aspect, mode = 'auto' } = typeof view === 'number' ? { aspect: view } : view;
      const shot = simulationCameraShot(frame, mode);
      if (mode === 'auto' && ['shot', 'side', 'pen'].includes(shot.mode)) shot.framePoints = simulationCameraPoints(frame);
      shot.frameMargin = SIM_VIEW_DATA.camera.margin;
      broadcast.update({ ball: { p: new THREE.Vector3().copy(frame.ball.position) } }, shot, seconds, aspect);
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
  return automaticSimulationCameraShot(frame, { actor, owner });
}

function automaticSimulationCameraShot(frame, { actor, owner }) {
  const goal = observedSimulationGoal(frame);
  if (goal) return { mode: 'close', a: actor(frame.players.find(player => player.id === goal.fromId)) };
  const shot = frame.ball.shot;
  const restartShot = penaltyRestartCameraShot(frame, actor);
  if (restartShot) return restartShot;
  if (!shot) return observedCameraCue(frame, actor) ?? { mode: 'tv' };
  const shooter = frame.players.find(player => player.id === shot.fromId) ?? owner;
  const keeper = frame.players.find(player => player.slot === 'GK' && player.teamId !== shot.teamId);
  if (!shooter || !keeper) return { mode: 'tv' };
  const near = new THREE.Vector3().copy(shooter.position).distanceTo(keeper.position) < SIM_VIEW_DATA.camera.shotMinimumSeparationMetres;
  return { mode: shot.penalty ? 'pen' : near ? 'side' : 'shot', a: actor(shooter), b: actor(keeper) };
}

function penaltyRestartCameraShot(frame, actor) {
  const restart = frame.ball.restart;
  if (restart?.kind === 'freeKick' && restart.delivery?.kind === 'direct') return { mode: 'shot',
    a: actor(frame.players.find(player => player.id === restart.takerId)),
    b: actor(frame.players.find(player => player.slot === 'GK' && player.teamId !== restart.teamId)) };
  return restart?.kind === 'penalty' ? { mode: 'pen', a: actor(frame.players.find(player => player.id === restart.takerId)),
    b: actor(frame.players.find(player => player.slot === 'GK' && player.teamId !== restart.teamId)) } : null;
}

function observedCameraCue(frame, actor) {
  const contact = frame.contacts.findLast(event => event.time <= frame.physicsTime && ['tackle', 'skill', 'yellow', 'red'].includes(event.type));
  const elapsed = contact ? frame.physicsTime - contact.time : Infinity;
  if (['tackle', 'skill'].includes(contact?.type)) return challengeCameraCue(frame, { contact, elapsed, actor });
  if (['yellow', 'red'].includes(contact?.type) && elapsed < SIM_VIEW_DATA.camera.cardCloseSeconds) {
    return { mode: 'close', a: actor(frame.players.find(player => player.id === contact.fromId)) };
  }
  return frame.ball.restart?.kind === 'corner' ? { mode: 'stand' } : null;
}

function challengeCameraCue(frame, { contact, elapsed, actor }) {
  if (!contact.closeUp || elapsed >= SIM_VIEW_DATA.camera.challengeCloseSeconds) return null;
  const carrier = frame.players.find(player => player.id === (contact.type === 'skill' ? contact.fromId : contact.toId));
  const defender = frame.players.find(player => player.id === (contact.type === 'skill' ? contact.toId : contact.fromId));
  return carrier && defender ? { mode: 'close', a: actor(carrier), b: actor(defender) } : null;
}

export function simulationCameraPoints(frame) {
  const ball = frame.ball, pitch = MATCH_SIM_DATA.pitch;
  const points = [new THREE.Vector3().copy(ball.position)];
  const attacking = frame.players.find(player => player.teamId === (ball.shot?.teamId ?? ball.teamId));
  if (!attacking) return points;
  const goalX = pitch.length / 2 * attacking.direction;
  if (!ball.shot && !ball.restart?.delivery?.target && Math.abs(goalX - ball.position.x) > SIM_VIEW_DATA.camera.goalApproachMetres) return points;
  points.push(new THREE.Vector3(goalX, pitch.goalHeight, -pitch.goalWidth / 2), new THREE.Vector3(goalX, 0, pitch.goalWidth / 2));
  const keeper = frame.players.find(player => player.slot === 'GK' && player.teamId !== attacking.teamId);
  if (keeper) points.push(new THREE.Vector3().copy(keeper.position).setY(1));
  points.push(...restartCameraParticipants(frame));
  return points;
}

function restartCameraParticipants(frame) {
  if (!frame.ball.restart?.delivery?.target) return [];
  const restart = frame.ball.restart, ball = frame.ball.position;
  return frame.players.filter(player => player.id === restart.takerId || player.teamId !== restart.teamId
    && Math.hypot(player.position.x - ball.x, player.position.z - ball.z) <= MATCH_SIM_DATA.refereeing.restartDistance + MATCH_SIM_DATA.deadBalls.wallSpacing)
    .map(player => new THREE.Vector3().copy(player.position).setY(1));
}
