import {clamp,smooth} from './match3d-pass-timeline.js';
const mix=(a,b,u)=>a.map((v,i)=>v+(b[i]-v)*u);
// Derived clothing/pose only: never consumes RNG or changes engine identities.
export function keeperKit(kit,opponent={},side='user'){
 const explicit=kit.goalkeeperKit||kit.keeperKit;
 if(explicit?.primaryColor)return {...kit,...explicit};
 if(kit.goalkeeperColor||kit.keeperColor)return {...kit,primaryColor:kit.goalkeeperColor||kit.keeperColor,secondaryColor:kit.goalkeeperSecondaryColor||'#172534'};
 const rgb=c=>{const s=String(c||'#000000').replace('#','');const n=parseInt(s.length===3?s.split('').map(x=>x+x).join(''):s,16);return [n>>16&255,n>>8&255,n&255];};
 const colors=[kit.primaryColor,kit.secondaryColor,opponent.primaryColor,opponent.secondaryColor].map(rgb);
 const palette=['#20db9c','#ab79ff','#ff8f32','#59c9ff','#ef6ec7'];
 const ordered=side==='user'?palette:[...palette.slice(2),...palette.slice(0,2)];
 const primaryColor=ordered.reduce((best,c)=>{const score=x=>Math.min(...colors.map(v=>Math.hypot(...rgb(x).map((n,i)=>n-v[i]))));return score(c)>score(best)?c:best;});
 return {...kit,primaryColor,secondaryColor:'#172534',gloveColor:'#f5f6ed',source:'deterministic-contrast-palette'};
}
export function keeperPose({root,source,target,ball,p,save,catchBall,stance}){
 const dx=source[0]-root[0],dz=source[2]-root[2],n=Math.hypot(dx,dz)||1,forward=[dx/n,0,dz/n],side=[forward[2],0,-forward[0]];
 const reach=smooth((p-.38)/.38)*smooth((1.5-Math.hypot(target[0]-root[0],target[2]-root[2]))/.9),recovery=smooth((p-.76)/.24);
 // Existing common roots stop .55m IN FRONT of the save. A continuous visual
 // support step puts the body behind the contact; no engine/root/ball write.
 const weight=save?reach*(1-recovery):0,position=root.map((v,i)=>v-forward[i]*.95*weight);
 const contactHeight=target[1],kind=contactHeight<.65?'low':contactHeight>1.55?'high':'body';
 const crouch=kind==='low'?.48:kind==='high'?.88:.68;
 const pelvisHeight=save?(.82+(crouch-.82)*reach)*(1-recovery)+.30*recovery:.82;
 const lean=save?(.12+.14*reach)*(1-recovery)+1.05*recovery:.12;
 const ready=position.map((v,i)=>v+forward[i]*.32);ready[1]=1.02;
 const hands=save?mix(ready,ball,reach*(catchBall?1:1-recovery)):ready;
 return {position,yaw:Math.atan2(forward[0],forward[2]),pelvisHeight,lean,bodyRoll:save?-.08*reach*(1-recovery)*Math.sign(target[2]-root[2]):0,
 leftFoot:stance&&p>.19&&p<.76?mix(stance[0],[position[0]-side[0]*.18,.09,position[2]-side[2]*.18],reach):[position[0]-side[0]*.18,.09,position[2]-side[2]*.18],rightFoot:stance&&p>.19&&p<.76?mix(stance[1],[position[0]+side[0]*.18,.09,position[2]+side[2]*.18],reach):[position[0]+side[0]*.18,.09,position[2]+side[2]*.18],
 leftHand:hands.map((v,i)=>v-side[i]*.065),rightHand:hands.map((v,i)=>v+side[i]*.065),
 keeperMotion:{kind,phase:p<.19?'ready':p<.38?'set':p<.76?'push-and-reach':catchBall?'control-and-lower':'landing-and-release',visualSupportOffset:.95*weight,source:'derived-from-common-ball-path; no engine height/dive telemetry'}};
}
