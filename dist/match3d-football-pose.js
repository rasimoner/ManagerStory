import * as T from './vendor/three/three.module.min.js';
const down=new T.Vector3(0,-1,0);
// Two-bone IK targets are in world metres. Stance feet stay planted while root moves.
function leg(root,bones,hipName,kneeName,ankleName,point){
 const hip=bones[hipName],knee=bones[kneeName],ankle=bones[ankleName];
 root.updateMatrixWorld(true);
 const inv=root.matrixWorld.clone().invert(),target=new T.Vector3(...point).applyMatrix4(inv),origin=hip.getWorldPosition(new T.Vector3()).applyMatrix4(inv);
 const delta=target.clone().sub(origin),dist=T.MathUtils.clamp(delta.length(),.05,.8299),axis=delta.clone().normalize();
 let bend=new T.Vector3(0,0,1).addScaledVector(axis,-axis.z);if(bend.length()<.01)bend=new T.Vector3(1,0,0);bend.normalize();
 const along=(.43*.43-.4*.4+dist*dist)/(2*dist),height=Math.sqrt(Math.max(0,.43*.43-along*along));
 const kneeVector=axis.clone().multiplyScalar(along).addScaledVector(bend,height),endVector=axis.clone().multiplyScalar(dist).sub(kneeVector);
 hip.quaternion.setFromUnitVectors(down,kneeVector.clone().normalize());
 knee.quaternion.setFromUnitVectors(down,endVector.normalize().applyQuaternion(hip.quaternion.clone().invert()));
 ankle.quaternion.copy(hip.quaternion).multiply(knee.quaternion).invert();
}
function arm(root,bones,shoulderName,elbowName,handName,point){
 const shoulder=bones[shoulderName],elbow=bones[elbowName],hand=bones[handName];root.updateMatrixWorld(true);
 const inv=root.matrixWorld.clone().invert(),target=new T.Vector3(...point).applyMatrix4(inv),origin=shoulder.getWorldPosition(new T.Vector3()).applyMatrix4(inv);
 const delta=target.sub(origin),dist=T.MathUtils.clamp(delta.length(),.025,.5799),axis=delta.normalize();
 let bend=new T.Vector3(0,0,1).addScaledVector(axis,-axis.z);if(bend.length()<.01)bend=new T.Vector3(1,0,0);bend.normalize();
 const along=(.30*.30-.28*.28+dist*dist)/(2*dist),height=Math.sqrt(Math.max(0,.30*.30-along*along));
 const upper=axis.clone().multiplyScalar(along).addScaledVector(bend,height),lower=axis.clone().multiplyScalar(dist).sub(upper);
 const parent=shoulder.parent.getWorldQuaternion(new T.Quaternion()),worldRoot=root.getWorldQuaternion(new T.Quaternion());
 const parentLocal=worldRoot.invert().multiply(parent);
 shoulder.quaternion.copy(parentLocal.clone().invert()).multiply(new T.Quaternion().setFromUnitVectors(down,upper.clone().normalize()));
 const combined=parentLocal.clone().multiply(shoulder.quaternion);
 elbow.quaternion.setFromUnitVectors(down,lower.normalize().applyQuaternion(combined.clone().invert()));hand.quaternion.identity();
}
export function poseFootballer(root,pose){
 const b=root.userData.bones;if(!b)return;
 Object.values(b).forEach(bone=>bone.quaternion.identity());b.pelvis.position.y=pose.pelvisHeight??.935;
 root.position.set(...pose.position);root.rotation.set(0,pose.yaw,0);
 b.spine.rotation.x=pose.lean||0;b.leftShoulder.rotation.x=pose.armSwing||0;b.rightShoulder.rotation.x=-(pose.armSwing||0);
 b.leftShoulder.rotation.z=-.07;b.rightShoulder.rotation.z=.07;b.leftElbow.rotation.x=-.32;b.rightElbow.rotation.x=-.32;
 leg(root,b,'leftHip','leftKnee','leftAnkle',pose.leftFoot);leg(root,b,'rightHip','rightKnee','rightAnkle',pose.rightFoot);
 if(pose.leftHand)arm(root,b,'leftShoulder','leftElbow','leftHand',pose.leftHand);
 if(pose.rightHand)arm(root,b,'rightShoulder','rightElbow','rightHand',pose.rightHand);
 root.updateMatrixWorld(true);
 return {leftHand:b.leftHand.getWorldPosition(new T.Vector3()),rightHand:b.rightHand.getWorldPosition(new T.Vector3()),leftAnkle:b.leftAnkle.getWorldPosition(new T.Vector3()),rightAnkle:b.rightAnkle.getWorldPosition(new T.Vector3()),
  rightToe:b.rightAnkle.localToWorld(new T.Vector3(0,-.055,.17))};
}
