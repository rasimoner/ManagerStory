/* The heart of the match engine (refactor D1): one minute of a match (tick), the attack it may bring
   (chance: who carries it, how it is built up, the shot), the strength of a side on the pitch, who gets
   the chance, who has the ball, and how well a player fits the role he plays. Moved from app.js with their
   bodies unchanged: the same seeded draws in the same order, so every match is the same match. */
import { M, S } from '../state.js';
import { enforceBallInvariants, matchFatigueDrain, setBallState, settlePlay, settleShape, tacticFatigue } from './pitch-v731.js';
import { actionMinute, chanceV73, eventPoint, playLastAttack } from './pitch-v73.js';
import { clamp, ensureMatchState, finite, matchEvent, orderKey, recordMatchFoul, roleAtSlot, tacticalEffects, userSide } from './match-support.js';
import { finalizeMatch, matchSecond } from './live-match.js';
import { opponentPlayer } from '../league/opponents-v731.js';
import { styleEdge } from '../players/player-profiles.js';
import { userOpponent, userSquad } from './user-team.js';
import { minutePlayed } from '../hooks.js';
export function oppRadarPos(i){let pos=[[50,8],[15,25],[38,25],[62,25],[85,25],[30,45],[70,45],[15,65],[50,62],[85,65],[50,82]][i];return pos}
export function setUserOwner(id){M.ballSide="user";M.ballOwner=id;if(typeof setBallState==="function")setBallState(eventPoint(id,"user"),id);M.playerTouches[id]=(M.playerTouches[id]||0)+1;M.playerStats[id]&&(M.playerStats[id].touches=(M.playerStats[id].touches||0)+1)}
export function setOppOwner(i){M.ballSide="opp";M.ballOwner="o"+i;if(typeof setBallState==="function")setBallState(eventPoint("o"+i,"opp"),"o"+i)}
export function tick(){
 if(!M||M.finished||['FINISHING','FINISHED'].includes(M.lifecycle))return;
 ensureMatchState();M.min=Math.floor(matchSecond()/60);if(M.goalScene&&M.min>M.goalScene.minute+3)M.goalScene=null;
 M.minuteShot=false;
 const effect=tacticalEffects();
 userSquad().forEach(p=>{if(M.active.includes(p.id)){const extra=['press','runBehind','overlap'].includes(orderKey(p))?1.35:1;p.fitness=Math.max(20,p.fitness-matchFatigueDrain(p,extra,effect.fatigue));minutePlayed(p);M.playerStats[p.id].minutes++;}});
 for(const id of M.oppIds){const rival=opponentPlayer(id);if(rival)rival.fitness=Math.max(22,rival.fitness-matchFatigueDrain(rival,1,tacticFatigue('opp')));}
 const r=userOpponent(),u=strength(),opp=(r[3]+r[4]+r[5])/3*(M.oppIds.length/11),userPoss=M.rand()<u/(u+opp);
 actionMinute(userPoss,effect,r);
 for(const id of M.active){const p=userSquad().find(p=>p.id===id);if(p&&!p.debutDone&&!M.debutShown.includes(id)){M.debutShown.push(id);matchEvent('debut',`🌱 ${M.min}' ${p.name} profesyonel futboldaki ilk resmi maçına çıkıyor.`,{playerId:id});}}
 if(!M.minuteShot&&M.ballOwner!=null&&M.rand()<clamp(.34*effect.frequency,.17,.5))chanceV73(M.ballSide==="user");
 enforceBallInvariants();
 if(M.rand()<.42)recordMatchFoul();   // V7.8: a challenge that may be a foul (see recordMatchFoul)
 if(M.min<90&&M.rand()<.0015){const ps=userSquad().filter(p=>M.active.includes(p.id)&&p.pos!=="GK");if(ps.length){const p=ps[Math.floor(M.rand()*ps.length)];p.injury=1;matchEvent('injury',`🩹 ${M.min}' ${p.name} yerde kaldı. Sağlık ekibi değişiklik öneriyor.`,{playerId:p.id});M.requiredSubstitution={playerId:p.id,reason:'injury',state:'SUBSTITUTION_REQUIRED'};M.pause=true;M.reason='injury';M.lifecycle='PAUSED';M.lastStop=M.min}}
 // cards/injuries above may have removed the ball owner or stacked players on a restart spot
 enforceBallInvariants();settleShape();
 if(M.min>=90)playLastAttack();
 if(M.min===45||M.min>=90)settlePlay();
 if(M.min===45){matchEvent('half',"⏸ 45' Devre sona erdi. Oyuncular soyunma odasına yöneliyor.");M.pause=true;M.reason='half';M.lifecycle='HALF_TIME'}
 if(M.min>=90)finalizeMatch();
}
export function positionPenaltyV61(p,role){if(role=="GK")return p.pos=="GK"?1:.12;if(p.pos=="GK")return .22;if(p.pos.split("/").includes(role))return 1;let near={ST:["LW","RW","CAM"],CAM:["CM","LW","RW"],CM:["CAM"],CB:["LB","RB"],LW:["RW","CAM"],RW:["LW","CAM"],LB:["CB"],RB:["CB"]};return (near[p.pos.split("/")[0]]||[]).includes(role)?.72:.45}
export function strength(){
 const players=userSquad().filter(p=>M.active.includes(p.id));if(!players.length)return 30;
 const strength=players.reduce((sum,p)=>{let bonus=1,ins=M.playerOrders[p.id]||S.instructions[p.id]||"";
 if((ins==="Merkeze yaklaş"||ins==="Merkeze yaklaş ve oyunu kur")&&p.passing>=72)bonus+=.04;
 if(ins==="Savunma arkasına koş"&&p.pace>=78)bonus+=.04;
 if(ins==="Topu sakla"&&p.physical>=75)bonus+=.04;
 if(ins==="İçe kat et"&&p.dribbling>=70)bonus+=.035;
 if(ins==="Bindirme yap"&&p.pace>=70)bonus+=.025;
 if((ins==="Pozisyonunu koru"||ins==="Geride kal")&&p.defending>=68)bonus+=.03;
 const role=M.matchRoles[p.id]||roleAtSlot(p,M.matchPositions[p.id]),fit=finite(p.fitness,100),mor=finite(p.morale,70),base=(p.passing+p.dribbling+p.finishing+p.pace)/4;
 return sum+base*(.55+fit/200)*(mor/85)*bonus*positionPenaltyV61(p,role)},0)/players.length;
 return finite(strength,65)*tacticalEffects().control*(players.length/11);
}
export function attacker(){
 const players=userSquad().filter(p=>M.active.includes(p.id)&&M.matchRoles[p.id]!=="GK"),r=userOpponent();
 if(!players.length)return userSquad().find(p=>M.active.includes(p.id));
 const weights=players.map(p=>{const key=orderKey(p);let weight=(p.finishing*2+p.pace+p.physical+(p.pos.includes("ST")?40:0))*styleEdge(p,r[2]);
 if(key==='runBehind')weight*=1.4;if(key==='holdUp')weight*=1.25;if(key==='box'||key==='shoot')weight*=1.35;if(key==='inside'||key==='free')weight*=1.2;if(key==='creator'||key==='riskPass')weight*=1.1;if(key==='stay')weight*=.65;
 if(M.approach==='Kanatlar'&&['LW','RW','LB','RB'].includes(M.matchRoles[p.id]))weight*=1.3;
 if(M.approach==='Merkez'&&['ST','CAM','CM'].includes(M.matchRoles[p.id]))weight*=1.15;
 return weight;});let roll=M.rand()*weights.reduce((a,b)=>a+b,0),sum=0;
 return players[weights.findIndex(v=>(sum+=v)>=roll)]||players[0];
}
export function chance(user){
 const r=userOpponent(),side=user?userSide():1-userSide(),p=user?attacker():{name:r[0].split(" ")[0]+" forvet",finishing:r[3],pace:65+r[8]/5,physical:r[8],dribbling:r[4],fitness:90};if(!p)return;
 const previous=M.ballOwner,previousSide=M.ballSide;
 if(user)setUserOwner(p.id);else setOppOwner(8+Math.floor(M.rand()*3));
 if(previous!==M.ballOwner||previousSide!==M.ballSide)matchEvent('run',`${M.min}' ${p.name} hücum koşusuyla topu aldı.`,{fromId:previous,toId:M.ballOwner,fromSide:previousSide,toSide:M.ballSide,ballSide:M.ballSide,fromPos:eventPoint(previous,previousSide),toPos:eventPoint(M.ballOwner,M.ballSide),playerId:user?p.id:null,side});
 M.shots[side]++;
 const effects=tacticalEffects(),key=user?orderKey(p):'balanced';let q=p.finishing*.5+p.pace*.12+p.physical*.1+p.dribbling*.12+p.fitness*.16;
 if(user){q*=effects.attack;if(key==='runBehind'&&r[2]==='high')q*=1.07;if(key==='holdUp'&&p.physical>=75)q*=1.04;if(key==='shoot')q*=.97;M.playerStats[p.id].shots++;}else q/=effects.defence;
 const gk=userSquad().find(x=>M.active.includes(x.id)&&M.matchRoles[x.id]==='GK');
 const keeper=user?r[6]:gk?gk.overall*(.65+gk.fitness/300):30;
 const onProbability=Math.min(.72,.38+q/360),goalProbability=clamp(.20+(q-keeper)/210,.14,.48),xg=onProbability*goalProbability;
 M.stats.xg[side]+=xg;if(xg>=.20)M.stats.bigChances[side]++;
 const on=M.rand()<onProbability;if(on)M.ont[side]++;
 const goal=on&&M.rand()<goalProbability,seq=user?seqText(p):`${r[0]} paslarla çıkıyor. ${p.name} ceza sahasına yöneldi.`;
 const shooter=M.ballOwner,fromSide=M.ballSide,shotFrom=eventPoint(shooter,fromSide),shotTo=[50,user?3:97];
 matchEvent('shot',`${M.min}' ${p.name} şut çekti.`,{side,playerId:user?p.id:null,fromId:shooter,toId:null,fromSide,ballSide:fromSide,fromPos:shotFrom,toPos:shotTo,xg,onTarget:on});
 if(goal){matchEvent('goal',`⚽ ${M.min}' ${seq} ${p.name} vurdu... GOL!`,{side,playerId:user?p.id:null,scorer:p.name,xg,fromId:shooter,fromSide,ballSide:fromSide,fromPos:shotFrom,toPos:shotTo});M.goalScene={scorer:p.name,minute:M.min};if(user){M.playerStats[p.id].goals++;M.playerStats[p.id].rating=clamp(M.playerStats[p.id].rating+1,1,10);}else if(gk)M.playerStats[gk.id].rating=clamp(M.playerStats[gk.id].rating-.35,1,10);
 }else{if(on)matchEvent('save',`${M.min}' ${user?'Rakip kaleci':gk?.name||'Kaleci'} topu kurtardı.`,{side,playerId:user?null:gk?.id,fromId:shooter,fromSide,ballSide:fromSide,fromPos:shotTo,toPos:[50,user?10:90]});matchEvent('chance',`${M.min}' ${seq} ${on?'Vuruşu kaleci çıkardı!':'Top dışarıda.'}`,{side,playerId:user?p.id:null,xg,onTarget:on});if(!user&&on&&gk){M.playerStats[gk.id].saves++;M.playerStats[gk.id].rating=clamp(M.playerStats[gk.id].rating+.12,1,10);}if(user&&on)M.playerStats[p.id].rating=clamp(M.playerStats[p.id].rating+.06,1,10);if(M.rand()<(on?.42:.12)){M.stats.corners[side]++;matchEvent('corner',`🚩 ${M.min}' ${side===0?M.home:M.away} korner kullanacak.`,{side,ballSide:fromSide,fromId:shooter,toId:shooter,fromPos:shotTo,toPos:[user?95:5,user?5:95]});}}
}
export function seqText(p){if(p.pos.split("/").includes("ST")&&p.pace>=80)return `Orta saha baskıyı kırdı. ${p.name} savunmanın arkasındaki boşluğu gördü ve hızlandı.`;if(p.pos.split("/").includes("ST")&&p.physical>=78)return `${p.name} stoperi sırtına aldı, topu sakladı ve atağın devamını sağladı.`;if(["CAM","CM"].some(x=>p.pos.split("/").includes(x))&&p.passing>=74)return `${p.name} iki hat arasında topu aldı, yüzünü kaleye döndü ve boşluğu değerlendirdi.`;if(["RW","LW"].some(x=>p.pos.split("/").includes(x)))return `${p.name} kanatta bire biri gördü ve içeri kat etti.`;return `${p.name} boşluğu gördü ve hücuma katıldı.`}
