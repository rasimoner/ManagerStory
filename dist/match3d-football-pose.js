import * as T from './vendor/three/three.module.min.js';
const down=new T.Vector3(0,-1,0);
// Two-bone IK targets are in world metres. Stance feet stay planted while root moves.
function leg(root,bones,hipName,kneeName,ankleName,point){
 const hip=bones[hipName],knee=bones[kneeName],ankle=bones[ankleName];
 root.updateMatrixWorld(true);
 const inv=root.matrixWorld.clone().invert(),target=new T.Vector3(...point).applyMatrix4(inv),origin=hip.getWorldPosition(new T.Vector3()).applyMatrix4(inv);
 const L1=Math.abs(knee.position.y),L2=Math.abs(ankle.position.y);
 const delta=target.clone().sub(origin),dist=T.MathUtils.clamp(delta.length(),.05,L1+L2-.0001),axis=delta.clone().normalize();
 let bend=new T.Vector3(0,0,1).addScaledVector(axis,-axis.z);if(bend.length()<.01)bend=new T.Vector3(1,0,0);bend.normalize();
 const along=(L1*L1-L2*L2+dist*dist)/(2*dist),height=Math.sqrt(Math.max(0,L1*L1-along*along));
 const kneeVector=axis.clone().multiplyScalar(along).addScaledVector(bend,height),endVector=axis.clone().multiplyScalar(dist).sub(kneeVector);
 const parent=hip.parent.getWorldQuaternion(new T.Quaternion()),worldRoot=root.getWorldQuaternion(new T.Quaternion()),parentLocal=worldRoot.invert().multiply(parent);
 hip.quaternion.copy(parentLocal.clone().invert()).multiply(new T.Quaternion().setFromUnitVectors(down,kneeVector.clone().normalize()));
 knee.quaternion.setFromUnitVectors(down,endVector.normalize().applyQuaternion(parentLocal.clone().multiply(hip.quaternion).invert()));
 ankle.quaternion.copy(parentLocal).multiply(hip.quaternion).multiply(knee.quaternion).invert();
}
function arm(root,bones,shoulderName,elbowName,handName,point,keeper=false){
 const shoulder=bones[shoulderName],elbow=bones[elbowName],hand=bones[handName];root.updateMatrixWorld(true);
 const inv=root.matrixWorld.clone().invert(),target=new T.Vector3(...point).applyMatrix4(inv),origin=shoulder.getWorldPosition(new T.Vector3()).applyMatrix4(inv);
 const L1=Math.abs(elbow.position.y),L2=Math.abs(hand.position.y);
 const delta=target.sub(origin),dist=T.MathUtils.clamp(delta.length(),.025,L1+L2-.0001),axis=delta.normalize();
 const preferred=keeper?new T.Vector3(shoulderName.startsWith('left')?-.55:.55,-.5,.6).normalize():new T.Vector3(0,0,1);
 let bend=preferred.clone().addScaledVector(axis,-preferred.dot(axis));if(bend.length()<.01)bend=new T.Vector3(1,0,0);bend.normalize();
 const along=(L1*L1-L2*L2+dist*dist)/(2*dist),height=Math.sqrt(Math.max(0,L1*L1-along*along));
 const upper=axis.clone().multiplyScalar(along).addScaledVector(bend,height),lower=axis.clone().multiplyScalar(dist).sub(upper);
 const parent=shoulder.parent.getWorldQuaternion(new T.Quaternion()),worldRoot=root.getWorldQuaternion(new T.Quaternion());
 const parentLocal=worldRoot.invert().multiply(parent);
 shoulder.quaternion.copy(parentLocal.clone().invert()).multiply(new T.Quaternion().setFromUnitVectors(down,upper.clone().normalize()));
 const combined=parentLocal.clone().multiply(shoulder.quaternion);
 elbow.quaternion.setFromUnitVectors(down,lower.normalize().applyQuaternion(combined.clone().invert()));hand.quaternion.identity();
}
export function poseFootballer(root,pose){
 const b=root.userData.bones;if(!b)return;
 Object.values(b).forEach(bone=>bone.quaternion.identity());// Match targets stay in world metres; the longer approved legs raise the pelvis.
 const approved=root.userData.model==='approved-player-33a2cda';
 b.pelvis.position.y=(pose.pelvisHeight??.935)+(approved?.043:0);
 root.position.set(...pose.position);root.rotation.set(0,pose.yaw,0);
 // Lower the hips only when a world-space foot target would overextend a leg.
 // This keeps planted soles above the pitch without changing roots or targets.
 b.pelvis.rotation.z=pose.pelvisRoll||0;
 if(approved&&!pose.pelvisRoll){root.updateMatrixWorld(true);const inv=root.matrixWorld.clone().invert();
  for(const [hip,knee,ankle,target] of [[b.leftHip,b.leftKnee,b.leftAnkle,pose.leftFoot],[b.rightHip,b.rightKnee,b.rightAnkle,pose.rightFoot]]){
   const t=new T.Vector3(...target).applyMatrix4(inv),reach=Math.abs(knee.position.y)+Math.abs(ankle.position.y)-.0001;
   const horizontal=Math.hypot(t.x-hip.position.x,t.z-hip.position.z);
   if(horizontal<reach)b.pelvis.position.y=Math.min(b.pelvis.position.y,t.y-hip.position.y+Math.sqrt(reach*reach-horizontal*horizontal));
  }
 }
 b.head.rotation.x=pose.headPitch||0;
 b.spine.rotation.x=pose.lean||0;b.leftShoulder.rotation.x=pose.armSwing||0;b.rightShoulder.rotation.x=-(pose.armSwing||0);
 b.spine.rotation.z=pose.bodyRoll||0;b.spine.rotation.y=pose.bodyTwist||0;
 b.leftShoulder.rotation.z=-.07;b.rightShoulder.rotation.z=.07;b.leftElbow.rotation.x=-.32;b.rightElbow.rotation.x=-.32;
 leg(root,b,'leftHip','leftKnee','leftAnkle',pose.leftFoot);leg(root,b,'rightHip','rightKnee','rightAnkle',pose.rightFoot);
 if(pose.leftHand)arm(root,b,'leftShoulder','leftElbow','leftHand',pose.leftHand,!!pose.keeperMotion);
 if(pose.rightHand)arm(root,b,'rightShoulder','rightElbow','rightHand',pose.rightHand,!!pose.keeperMotion);
 root.updateMatrixWorld(true);
 return {leftHand:b.leftHand.getWorldPosition(new T.Vector3()),rightHand:b.rightHand.getWorldPosition(new T.Vector3()),leftAnkle:b.leftAnkle.getWorldPosition(new T.Vector3()),rightAnkle:b.rightAnkle.getWorldPosition(new T.Vector3()),
  forehead:b.head.localToWorld(new T.Vector3(...(root.userData.contacts?.forehead||[0,.139,.087]))),rightToe:b.rightAnkle.localToWorld(new T.Vector3(...(root.userData.contacts?.toe||[0,-.055,.17])))};
}
