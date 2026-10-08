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
export function keeperPose({root,source,target,ball,p,save,catchBall,stance,active=false,collection=null,control=null,distribution=null,handoff=null,dive=null,forwardHint=null}){
 const dx=source[0]-root[0],dz=source[2]-root[2],n=Math.hypot(dx,dz)||1;
 let forward=control?.forward||distribution?.forward||forwardHint||[dx/n,0,dz/n];
 const recovering=!active&&!control&&!distribution&&handoff?.weight>0;
 if(recovering){const a=Math.atan2(handoff.forward[0],handoff.forward[2]),b=Math.atan2(forward[0],forward[2]),turn=Math.atan2(Math.sin(b-a),Math.cos(b-a)),yaw=a+turn*(1-handoff.weight);forward=[Math.sin(yaw),0,Math.cos(yaw)];}
 const side=[forward[2],0,-forward[0]];
 const reach=active?smooth((p-.38)/.38)*smooth((1.5-Math.hypot(target[0]-root[0],target[2]-root[2]))/.9):0,recovery=smooth((p-.76)/.24);
 const kind=target[1]<.65?'low':target[1]>1.55?'high':'body',crouch=kind==='low'?.48:kind==='high'?.88:.68;
 const holding=!!control&&!active,throwing=!!distribution,punt=distribution?.kind==='punt',sec=distribution?.elapsed||0,timing=distribution?.timing;
 const held=punt?sec<timing.releaseAt:p<.19;
 let pelvisHeight=holding||throwing?.935:active?.935+(.82-.935)*smooth((p-.1)/.25)*(1-recovery)+(save?(crouch-.82)*reach*(1-recovery):0):.935;
 let lean=holding||throwing?.06:active?.03+.09*smooth((p-.1)/.25)*(1-recovery)+.14*reach*(1-recovery)+(catchBall?.03*recovery:0):.03;
 const neutral=root.map((v,i)=>v+forward[i]*.07);neutral[1]=.94;
 const ready=root.map((v,i)=>v+forward[i]*.32);ready[1]=1.05;
 let hands=active?mix(neutral,ready,smooth((p-.1)/.25)*(1-recovery)):neutral;
 if(active&&save)hands=mix(hands,ball,reach*(catchBall?1:1-recovery));
 if(holding||throwing&&held)hands=[...ball];
 if(throwing&&!held){const q=punt?smooth((sec-timing.releaseAt)/.18):smooth((p-.19)/.5);hands=mix(distribution.release,neutral,q);}
 if(collection){
  const reach=smooth((p-.58)/.18),rise=smooth((p-.76)/.24),weight=reach*(1-rise);
  pelvisHeight-=.74*weight;lean=.03+.45*weight+.03*rise;
  hands=mix(hands,ball,reach); // contact at .76; then follow the visible lift
 }
 const amount=active&&save?(dive?.amount||0):0,sign=dive?.sign||1;
 // One common clip phase drives the complete body, not a fixed arm target.
 const push=smooth((p-.52)/.12),flight=push*(1-smooth((p-.84)/.16)),landing=smooth((p-.76)/.08)*(1-smooth((p-.88)/.12));
 const diveWeight=amount*flight,pelvisRoll=-sign*1.0*diveWeight;
 const feet=(base,i)=>amount?mix(base,[root[0]+side[0]*(-sign*.18+(i?1:-1)*.12),.09+.28*diveWeight,root[2]+side[2]*(-sign*.18+(i?1:-1)*.12)],diveWeight):base;
 const endReach=recovering?smooth((1.5-Math.hypot(handoff.contact[0]-handoff.root[0],handoff.contact[2]-handoff.root[2]))/.9):0;
 const spread=collection?.24+(.065-.24)*smooth((p-.58)/.18):holding||throwing?.065:active?.22-(.22-.065)*reach:recovering?.24+(.22-(.22-.065)*endReach-.24)*handoff.weight:.24;
 let leftFoot=feet(stance?.[0]||[root[0]-side[0]*.18,.09,root[2]-side[2]*.18],0),rightFoot=feet(stance?.[1]||[root[0]+side[0]*.18,.09,root[2]+side[2]*.18],1);
 if(punt){
  // The striking ankle reaches the falling ball; native seconds end the kick
  // before the real long flight ends. The root and ball remain common-clock data.
  const contact=[distribution.release[0]-forward[0]*.17,.20,distribution.release[2]-forward[2]*.17];
  const neutral=[root[0]+side[0]*.18,.09,root[2]+side[2]*.18];
  const start=timing.contactAt-timing.kickPreparation,q=clamp((sec-start)/timing.kickPreparation);
  leftFoot=mix(leftFoot,[root[0]-side[0]*.13+forward[0]*.05,.09,root[2]-side[2]*.13+forward[2]*.05],smooth(sec/timing.releaseAt));
  if(sec>=start&&sec<=timing.contactAt){rightFoot=mix(neutral,contact,smooth(q));rightFoot=rightFoot.map((v,i)=>v-forward[i]*.28*Math.sin(Math.PI*q));rightFoot[1]+=.10*Math.sin(Math.PI*q);lean=-.09*Math.sin(Math.PI*q);}
  else if(sec>timing.contactAt&&sec<timing.contactAt+timing.kickFollow){const follow=clamp((sec-timing.contactAt)/timing.kickFollow);rightFoot=mix(contact,neutral,smooth(follow));rightFoot=rightFoot.map((v,i)=>v+forward[i]*.25*Math.sin(Math.PI*follow));rightFoot[1]+=.12*Math.sin(Math.PI*follow);lean=.16*Math.sin(Math.PI*follow);}
 }
 return {position:root,yaw:Math.atan2(forward[0],forward[2]),pelvisHeight:pelvisHeight+(.70-pelvisHeight)*diveWeight-.08*amount*landing,pelvisRoll,lean,bodyRoll:active&&save?-.08*reach*(1-recovery)*Math.sign(target[2]-root[2]):0,
 leftFoot,rightFoot,
 leftHand:distribution?.handMotion?.supportHand||hands.map((v,i)=>v-side[i]*spread),rightHand:distribution?.handMotion?.throwHand||hands.map((v,i)=>v+side[i]*spread),rightWristPitch:distribution?.handMotion?.wrist||0,
 keeperMotion:{kind:amount>.1?(kind==='low'?'smother':'lateral-dive'):kind,diveAmount:amount,pelvisRoll,phase:distribution?.handMotion?distribution.handMotion.phase:punt?(sec<timing.releaseAt?'punt-prepare':sec<timing.contactAt?'punt-drop':sec<timing.contactAt+timing.kickFollow?'punt-strike-and-follow':'punt-recovered'):collection?(p<.58?'collection-approach':p<.76?'collection-reach':p<1?'collection-gather':'held-control'):throwing?(p<.19?'distribution-prepare':'distribution-release'):holding?'held-control':!active?'idle':p<.19?'ready':p<.52?'support-step':p<.64?'push':p<.76?'reach':p<.84?'contact-and-land':p<.94?'balance-recovery':catchBall?'gather':'release-and-recover',visualSupportOffset:0,source:'derived-from-common-control-and-ball-path; no engine dive telemetry'}};
}
