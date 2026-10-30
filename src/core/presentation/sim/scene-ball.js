import * as THREE from 'three';
import { BALL_R } from '../match3d/newview/runtime.js';
import SIM_VIEW_DATA from '../../../data/match-sim-view.json';

export function createSimulationBallView(ball, shadow) {
  let previous = null;
  const axis = new THREE.Vector3();
  return {
    apply(frame) {
      const point = frame.ball.position, elapsed = frame.physicsTime - (previous?.time ?? frame.physicsTime);
      if (previous && elapsed > 0 && elapsed <= SIM_VIEW_DATA.pose.maximumAnimationGapSeconds && !previous.held && frame.ball.heldBy == null) {
        axis.set(point.z - previous.position.z, 0, previous.position.x - point.x);
        const distance = axis.length();
        if (distance > 0) ball.rotateOnWorldAxis(axis.normalize(), distance / BALL_R);
      }
      ball.position.copy(point);
      const height = Math.max(0, point.y - BALL_R);
      shadow.position.set(point.x, .012, point.z);
      shadow.scale.setScalar(1 + height * .35);
      shadow.material.opacity = .45 / (1 + height * 1.4);
      previous = { time: frame.physicsTime, position: { ...point }, held: frame.ball.heldBy != null };
    },
  };
}
