/* Additive V7.3.1 football events. The seeded match engine remains authoritative. */

/* ===== V7.3.6.1 Phase 2: one attribute model =====================================================
   base attribute (unified user/opponent schema)
     -> position-suitability misfit (context-sensitive, reuses positionPenaltyV61)
     -> current fitness (physical > technical > mental sensitivity)
     -> age (small, bounded, match-only)
     = effective attribute.   Base player records are never written to by any of this.            */
function playerRecord(id,side){return side==='user'?S.players.find(x=>x.id===Number(id)):opponentPlayer(id);}
const normalizeAttribute=v=>clamp((finite(v,60)-35)/65,0,1);            // 35→0, 100→1
const attributeEdge=v=>normalizeAttribute(v)-.5;                         // centred: average player ≈ +0.05
const contestProbability=(a,b,scale=16)=>1/(1+Math.exp(-(a-b)/scale));   // smooth, never 0 or 1
function baseAttribute(id,side,name,fallback){
 const p=playerRecord(id,side);if(!p)return fallback;
 const ovr=finite(p.overall,65),pos=String(p.pos||p.position||'CM').split('/')[0];
 const pace=finite(p.pace,fallback??68),drib=finite(p.dribbling,ovr),pass=finite(p.passing,ovr),stam=finite(p.stamina,70);
 const tackling=finite(p.tackling,finite(p.defending,ovr));
 switch(name){
  case 'pace':return pace;
  case 'acceleration':return finite(p.acceleration,pace*.68+drib*.22+stam*.1);
  case 'finishing':return finite(p.finishing,finite(p.shooting,fallback??65));
  case 'passing':return pass;
  case 'dribbling':return finite(p.dribbling,fallback??65);
  case 'technique':return finite(p.technique,(drib+pass)/2);
  case 'tackling':return tackling;
  case 'positioning':return finite(p.positioning,(tackling+ovr)/2);
  case 'vision':return finite(p.vision,ovr*.5+pass*.3+finite(p.technique,drib)*.2);
  case 'offBall':return finite(p.offBall,finite(p.positioning,ovr));
  case 'composure':return finite(p.composure,finite(p.technique,(drib+pass)/2));
  case 'stamina':return stam;
  case 'strength':case 'physical':
   return finite(p.strength,finite(p.physical,ovr*.6+stam*.2+({CB:6,ST:6,GK:6,LW:-5,RW:-5,CAM:-5}[pos]||0)+8));
  default:return finite(p[name],fallback);
 }
}
const ATTR_KIND={pace:'phys',acceleration:'phys',strength:'phys',physical:'phys',stamina:'phys',
 dribbling:'tech',passing:'tech',technique:'tech',finishing:'tech',tackling:'tech',
 composure:'mental',vision:'mental',positioning:'mental',offBall:'mental'};
const FITNESS_SENSITIVITY={phys:.45,tech:.20,mental:.09};
// 100% → 1.0; 85% → ~0.95 (physical); 60% → ~0.84; 40% → ~0.75. Smooth, no cliff.
function fitnessFactor(fitness,kind){
 const loss=Math.pow(clamp(100-finite(fitness,90),0,100)/100,1.15);
 return 1-(FITNESS_SENSITIVITY[kind]??.2)*loss;
}
// Age is a modest match modifier only (bounded 0.93–1.0). It never edits the stored attribute.
function ageFactor(age,name){
 const a=finite(age,26);
 if(name==='pace')return 1-Math.min(.05,Math.max(0,a-30)*.006);
 if(name==='acceleration')return 1-Math.min(.07,Math.max(0,a-29)*.008);
 if(name==='strength'||name==='physical')return 1-Math.min(.05,Math.max(0,21-a)*.012);
 return 1;
}
function ageFatigueFactor(age){return clamp(1+(finite(age,26)-27)*.012,.95,1.12);}
// Suitability of a player in the role he is actually filling right now. Opponents play their natural role.
function positionSuitability(id,side){
 if(side!=='user'||!M?.matchRoles)return 1;
 const p=playerRecord(id,side),role=M.matchRoles[id];
 return p&&role?positionPenaltyV61(p,role):1;
}
const roleGroup=r=>['CB','LB','RB'].includes(r)?'def':r==='GK'?'gk':['LW','RW','ST'].includes(r)?'att':'mid';
// How much of the misfit loss each skill takes, per role being played. Pace/strength/stamina are NOT
// reduced: an out-of-position player is still just as quick, he simply reads the game worse.
const MISFIT_WEIGHT={
 def:{tackling:.6,positioning:.6,composure:.2,vision:.15,offBall:.1,passing:.1},
 mid:{passing:.3,vision:.35,positioning:.3,tackling:.25,technique:.25,offBall:.25,composure:.2},
 att:{finishing:.6,offBall:.55,dribbling:.3,technique:.25,composure:.25,positioning:.15,vision:.1},
 gk:{}
};
function effectiveAttribute(id,side,name,fallback){
 const p=playerRecord(id,side);
 if(!p)return fallback;
 let v=baseAttribute(id,side,name,fallback);
 const suit=positionSuitability(id,side);
 if(suit<1){
  const role=side==='user'?M.matchRoles?.[id]:null,w=MISFIT_WEIGHT[roleGroup(role)]?.[name]||0;
  v*=1-w*(1-suit);
 }
 v*=fitnessFactor(p.fitness,ATTR_KIND[name]||'tech')*ageFactor(p.age,name);
 return clamp(v,1,100);
}
function playerAttribute(id,side,name,fallback){return effectiveAttribute(id,side,name,fallback);}

// Stamina, age and existing on-pitch activity drive in-match fitness loss (per football minute).
function matchFatigueDrain(p,activity=1,tactical=1){
 return (.10+(100-clamp(finite(p.stamina,70),20,100))*.0040)*ageFatigueFactor(p.age)*activity*tactical;
}

// --- physical model: pace = top speed, acceleration = time to reach it, positioning/accel = reaction
const topSpeed=(id,side)=>3.6+(playerAttribute(id,side,'pace',68)-40)*.045;              // pitch units / s
const accelerationTime=(id,side)=>clamp(3.6-(playerAttribute(id,side,'acceleration',68)-40)*.045,1,3.8);
function reactionDelay(id,side){
 const n=normalizeAttribute(playerAttribute(id,side,'acceleration',68)*.5+playerAttribute(id,side,'positioning',65)*.5);
 return (.10+M.rand()*.95)*(1.3-.6*n);
}
// Shoulder-to-shoulder / shielding / contested-ball strength contest (0..1 for player A).
function physicalContest(aId,aSide,bId,bSide){
 const a=playerAttribute(aId,aSide,'strength',68)*.85+playerAttribute(aId,aSide,'composure',65)*.15;
 const b=playerAttribute(bId,bSide,'strength',68)*.85+playerAttribute(bId,bSide,'composure',65)*.15;
 return contestProbability(a,b,14);
}

// --- duels (pure probability functions: the engine and the tests use the same ones)
function dribbleChance(from,side,defenderId,defSide,ctx={}){
 const A=id=>playerAttribute(from,side,id,65);
 const att=A('dribbling')*.42+A('technique')*.15+A('acceleration')*.18+A('strength')*.15+A('composure')*.10;
 const def=defenderId==null?0:playerAttribute(defenderId,defSide,'tackling',65)*.42+playerAttribute(defenderId,defSide,'positioning',65)*.23+
  playerAttribute(defenderId,defSide,'acceleration',65)*.15+playerAttribute(defenderId,defSide,'strength',65)*.20;
 return clamp(.60+(att-def)*.0085-(ctx.pressure||0)*.03,.2,.92);
}
function tackleChance(defenderId,defSide,carrier,side,ctx={}){
 const D=playerAttribute(defenderId,defSide,'tackling',65)*.50+playerAttribute(defenderId,defSide,'positioning',65)*.22+
  playerAttribute(defenderId,defSide,'strength',65)*.14+playerAttribute(defenderId,defSide,'acceleration',65)*.14;
 const A=playerAttribute(carrier,side,'dribbling',65)*.40+playerAttribute(carrier,side,'technique',65)*.15+
  playerAttribute(carrier,side,'strength',65)*.20+playerAttribute(carrier,side,'acceleration',65)*.15+playerAttribute(carrier,side,'composure',65)*.10;
 return clamp(.39+(D-A)*.0075+(13-(ctx.distance??8))*.017+(ctx.press||0),.14,.80);
}
// Execution quality only: decision (vision) is handled in passOptions().
function passSuccessProbability(from,side,sel,ctx={}){
 const passN=normalizeAttribute(playerAttribute(from,side,'passing',65)),techN=normalizeAttribute(playerAttribute(from,side,'technique',65)),
  compN=normalizeAttribute(playerAttribute(from,side,'composure',65)),pressure=ctx.pressure||0;
 const difficulty=clamp(Math.max(0,sel.range-18)/46*.55+sel.lane*.35+(sel.space?.danger||0)*.12+pressure*(.25+.06*(ctx.tempo||0)),0,1.3);
 const p=PASS_BASE-difficulty*(.68-.45*passN)+(techN-.5)*.06+(compN-.5)*.05*(pressure>0?1.4:.6)+
  (ctx.effect?.passing||0)-(ctx.risk?.05:0)-(ctx.tempo>0?.035:ctx.tempo<0?-.02:0);
 return clamp(p,.25,.97);
}
const PASS_BASE=.935; // keeps league-average completion near the Phase 1 level so skill effects are not confounded with a level shift
function keeperRating(id,side){
 const p=playerRecord(id,side);if(!p)return 28;
 const g=p.gk;
 const raw=side==='opp'?(g?g.reflexes*.72+g.handling*.14+g.oneOnOne*.14:28):(positionSuitability(id,side)>=.9?finite(p.overall,60):finite(p.overall,60)*.3);
 return raw*fitnessFactor(p.fitness,'tech')*(1-Math.min(.04,Math.max(0,finite(p.age,26)-33)*.006));
}
function keeperHandling(id,side){
 const p=playerRecord(id,side);if(!p)return 50;
 return side==='opp'?(p.gk?p.gk.handling:40):finite(p.overall,60)*.96;
}
// Shot decision lives in the action chooser; this is execution: placement (on target) and conversion.
function shotProbabilities(shooter,side,ctx={}){
 const A=n=>playerAttribute(shooter,side,n,65);
 const fin=A('finishing');
 const q=(fin*.55+A('composure')*.12+A('technique')*.08+A('pace')*.08+A('strength')*.07+A('dribbling')*.10)*1.05*(ctx.qMod??1);
 const finN=normalizeAttribute(fin),distance=ctx.distance??20,angle=ctx.angle??0,pressure=ctx.pressure??0,keeper=ctx.keeper??60;
 const onTarget=clamp(.46+q/460+(finN-.5)*.12-distance*.0035-angle*.001-pressure*.045,.15,.85);
 const goal=clamp(.27+(q-keeper)/210+(finN-.5)*.06-distance*.003-pressure*.04,.06,.56);
 return {q,onTarget,goal,xg:onTarget*goal};
}

/* ===== V7.3.6.1 Phase 3: team-scoped tactics =================================================
   One tactical configuration per team. 'user' reads the managed-team fields the UI already writes
   (M.mentality, M.press, ...). 'opp' reads M.oppTactics (explicit override) over a default derived
   from the opponent's style and current scoreline. The engine only ever asks teamTactics(side), so a
   setting on one team can never leak into the other.                                              */
function opponentDefaultTactics(){
 const r=currentOpponent()||[],att=opponentAttitude();
 const t={mentality:'Dengeli',press:'Normal',tempo:'Normal',line:'Normal',approach:'Dengeli',passingStyle:'Dengeli',width:'Normal',instr:[]};
 switch(r[2]){
  case 'high':t.press='Yüksek';t.line='Önde';break;
  case 'deep':t.press='Düşük';t.line='Geride';break;
  case 'possession':t.passingStyle='Kısa';break;
  case 'physical':t.passingStyle='Direkt';break;
  case 'attack':t.mentality='Cesur';break;
  case 'youth':t.tempo='Yüksek';break;
 }
 if(att.risk>1)t.mentality='Cesur';else if(att.risk<1)t.mentality='Temkinli';
 if(att.press>1)t.press='Yüksek';else if(att.press<1)t.press='Düşük';
 return t;
}
function teamTactics(side){
 if(side==='user')return {mentality:M.mentality||'Dengeli',press:M.press||'Normal',tempo:M.tempo||'Normal',line:M.line||'Normal',
  approach:M.approach||'Dengeli',passingStyle:M.passingStyle||'Dengeli',width:M.width||'Normal',instr:M.teamInstructions||[]};
 return {...opponentDefaultTactics(),...(M.oppTactics||{}),instr:(M.oppTactics?.instr)||[]};
}
const tacticLevel=(v,low,high)=>v===high?1:v===low?-1:0;
function tacticProfile(side){
 const t=teamTactics(side);
 return {mentality:tacticLevel(t.mentality,'Temkinli','Cesur'),press:tacticLevel(t.press,'Düşük','Yüksek'),tempo:tacticLevel(t.tempo,'Düşük','Yüksek'),
  line:tacticLevel(t.line,'Geride','Önde'),width:tacticLevel(t.width,'Dar','Geniş'),approach:t.approach,passingStyle:t.passingStyle,
  compact:t.instr.includes('compact'),patience:t.instr.includes('patience'),quick:t.instr.includes('quick')};
}
// Physical cost of the team's tactics (same scale the user's tacticalEffects().fatigue uses).
function tacticFatigue(side){
 const T=tacticProfile(side);
 return 1+(T.press>0?.27:T.press<0?-.12:0)+(T.tempo>0?.15:T.tempo<0?-.08:0)+(T.quick?.08:0)+(T.line>0?.05:0);
}
// Individual instructions are keyed by exact side + player id. Opponent instructions live in M.oppOrders.
function orderFor(id,side){
 if(id==null)return 'balanced';
 if(side==='user'){const p=playerRecord(id,'user');return p?orderKey(p):'balanced';}
 return M.oppOrders?.[id]||'balanced';
}
// The moment right after a team regains the ball: fast-transition / counter tactics act here.
function transitionActive(side){return !!M.regain&&M.regain.side===side&&M.min-M.regain.min<=1;}

/* ===== V7.3.6.1 Phase 3: assistant coach =====================================================
   Recommendations come from the REAL current state of the MANAGED team only (read-only: nothing here
   writes to M, to either team's tactics, or to the opponent). Each entry maps to exactly one control
   and is shown next to it; tapping it selects that option. Nothing is ever auto-applied.          */
function assistantAdvice(){
 if(!M||M.finished||M.lifecycle==='FINISHED')return {};
 const u=userSide(),cur=teamTactics('user'),active=S.players.filter(p=>M.active.includes(p.id));
 const avgFit=active.length?active.reduce((n,p)=>n+p.fitness,0)/active.length:100;
 const diff=u===0?M.hg-M.ag:M.ag-M.hg,remaining=90-M.min;
 const passes=M.stats.passes[u],completion=passes>=20?M.stats.completedPasses[u]/passes:null;
 const poss=matchPossession()[u],xgDiff=M.stats.xg[1-u]-M.stats.xg[u],shotDiff=M.shots[1-u]-M.shots[u];
 const oppCrosses=M.events.slice(-40).filter(e=>e.type==='cross'&&e.side!==u).length;
 const adv={};
 const set=(key,value,why)=>{if(cur[key]!==value&&!adv[key])adv[key]={value,reason:why};};
 // pressing: cost vs. need
 if(cur.press==='Yüksek'&&avgFit<72)set('press','Normal',`Takım yoruldu (ort. kondisyon %${Math.round(avgFit)}); baskıyı düşürmek gerekir.`);
 else if(diff<0&&remaining<=30&&avgFit>=76)set('press','Yüksek',`Geridesiniz ve ${remaining} dakika var; takım hâlâ taze (%${Math.round(avgFit)}).`);
 else if(diff>0&&remaining<=15&&cur.press==='Yüksek')set('press','Normal','Öndesiniz; enerjiyi koruyun.');
 // mentality: scoreline and time
 if(diff<0&&remaining<=30)set('mentality','Cesur',`${-diff} gol geridesiniz; risk almak gerekiyor.`);
 else if(diff>0&&remaining<=20)set('mentality','Temkinli',`${diff} gol öndesiniz; skoru koruyun.`);
 // tempo: fatigue and scoreline
 if(avgFit<68)set('tempo','Düşük',`Ortalama kondisyon %${Math.round(avgFit)}; tempoyu düşürün.`);
 else if(diff<0&&remaining<=25)set('tempo','Yüksek','Skora ihtiyaç var; oyunu hızlandırın.');
 else if(diff>0&&remaining<=15)set('tempo','Düşük','Öndesiniz; oyunu yavaşlatın.');
 // defensive line: space behind
 if(cur.line==='Önde'&&(xgDiff>.5||shotDiff>=5))set('line','Normal',`Rakip üstün (xG farkı ${xgDiff.toFixed(1)}, şut farkı ${shotDiff}); hattın arkasındaki boşluğu kapatın.`);
 else if(cur.line==='Geride'&&poss>=58&&diff<=0&&remaining<=40)set('line','Normal','Topa sahipsiniz ama çok geride savunuyorsunuz; takımı sıkıştırın.');
 // passing: completion and possession
 if(completion!=null&&completion<.65&&cur.passingStyle==='Direkt')set('passingStyle','Dengeli',`Pas isabeti %${Math.round(completion*100)}; direkt oyun pas kaybettiriyor.`);
 else if(M.min>=20&&poss<40&&cur.passingStyle!=='Kısa')set('passingStyle','Kısa',`Topa sahip olma %${Math.round(poss)}; kısa paslarla bağlantıyı güçlendirin.`);
 // width: crosses from the flanks against us
 if(oppCrosses>=3)set('width','Dar',`Rakip son pozisyonlarda ${oppCrosses} kez ortaladı; kanat koridorlarını daraltın.`);
 // team instructions (toggles)
 const teamAdv={};
 if(diff>0&&remaining<=20&&!cur.instr.includes('compact'))teamAdv.compact={on:true,reason:'Öndesiniz; hatlar arasını daraltın.'};
 if(diff<0&&remaining<=25&&!cur.instr.includes('quick'))teamAdv.quick={on:true,reason:'Geridesiniz; top kazanınca hızlı geçiş yapın.'};
 if(completion!=null&&completion<.65&&!cur.instr.includes('patience')&&cur.passingStyle!=='Direkt')teamAdv.patience={on:true,reason:'Pas isabeti düşük; topu dolaştırarak oyunu oturtun.'};
 return {tactics:adv,team:teamAdv};
}

const RESTART_TYPES=new Set(['KICK_OFF','GOAL_KICK','CORNER','THROW_IN','FREE_KICK','PENALTY']);
/* V7.3.6.1 engine-integrity helpers. Sides are 'user' (numeric player ids) and 'opp' ('o0'..'o10'). */
// Team names come from the live match state, never a hardcoded club.
function matchTeamName(side){return side==='user'?(M.userHome?M.home:M.away):(M.userHome?M.away:M.home);}
function engineFrozen(){return !M||M.finished===true||['FINISHING','FINISHED'].includes(M.lifecycle);}
// +1 = this side attacks toward x=100, -1 = toward x=0. Flips at half-time via M.secondHalf.
function attackDirection(side){return (side==='user'?1:-1)*(M&&M.secondHalf?-1:1);}
// Team-safe lookup: a player is only returned if it is actually on that side's pitch roster.
function getPlayer(side,id){
 const pool=side==='user'?M.active:M.oppIds;
 if(id==null||!pool.includes(id))return undefined;
 return side==='user'?S.players.find(p=>p.id===id):opponentPlayer(id);
}
function keeperId(side){
 const pool=side==='user'?M.active:M.oppIds;
 const gk=side==='user'?pool.find(id=>M.matchRoles[id]==='GK'):pool.includes('o0')?'o0':undefined;
 if(gk!=null)return gk;
 // sent-off keeper: an outfield player deputises (deepest one), never an id from the other team
 return pool.slice().sort((a,b)=>{const pa=eventPoint(a,side)[0],pb=eventPoint(b,side)[0];
   return attackDirection(side)>0?pa-pb:pb-pa})[0];
}
function isKeeper(side,id){return side==='user'?M.matchRoles[id]==='GK':id==='o0';}
function setBallState(position,ownerId,state='LIVE',target=null,travelType='ground',travelDuration=0){
 M.ballState={position:[...position],ownerId:ownerId??null,state,target:target?[...target]:null,
  travelType,travelDuration,height:0};
}
function playerAtMarker(id,side){return side==='user'?S.players.find(p=>p.id===id):opponentPlayer(id);}
function opponentName(id){return opponentPlayer(id)?.name||'Rakip';}
function occupant(side,preferred){
 const pool=side==='user'?M.active:M.oppIds;
 return pool.includes(preferred)?preferred:pool.find(id=>!isKeeper(side,id))??pool[0];
}
/* A required injury substitution can only be demanded when a fit bench player exists. If nobody can come on,
   the injured player plays on (reduced condition) instead of the match staying paused forever.            */
function eligibleSubstitutes(){
 return S.players.filter(p=>!M.active.includes(p.id)&&!M.out.includes(p.id)&&!M.sentOff.includes(p.id)&&
  !['Kirada','Transfer oldu'].includes(p.status)&&p.injury===0);
}
function resolveUnfillableSubstitution(){
 const req=M?.requiredSubstitution;
 if(!req||!M.active.includes(req.playerId)||eligibleSubstitutes().length)return false;
 const p=S.players.find(x=>x.id===req.playerId);
 if(p){p.fitness=Math.min(p.fitness,55);}
 M.requiredSubstitution=null;
 matchEvent('order',M.min+'’ Yedek oyuncu kalmadı; '+(p?.name||'oyuncu')+' sakatlığına rağmen devam ediyor.',{playerId:req.playerId});
 return true;
}

/* A challenge inside the defender's OWN penalty area can be a foul, and then it is a penalty for the
   attacking side. This is where real penalties come from; the rate follows the two players' quality
   (dribbling draws fouls, clean tackling avoids them). Returns true when a penalty was awarded and taken. */
function boxChallengePenalty(defId,defSide,carrier,carrierSide,point){
 if(engineFrozen()||defSide===carrierSide)return false;
 const ownGoalX=attackDirection(defSide)>0?0:100;
 if(!(Math.abs(point[0]-ownGoalX)<17&&Math.abs(point[1]-50)<30))return false;
 const pFoul=clamp(.05+(normalizeAttribute(playerAttribute(carrier,carrierSide,'dribbling',65))-.5)*.04-
  (normalizeAttribute(playerAttribute(defId,defSide,'tackling',65))-.5)*.05,.02,.09);
 if(M.rand()>=pFoul)return false;
 const idx=defSide==='user'?userSide():1-userSide();
 M.stats.fouls[idx]++;
 matchEvent('foul',M.min+'’ '+(defSide==='user'?(playerRecord(defId,'user')?.name||'Savunmacı'):opponentName(defId))+' ceza sahasında faul yaptı.',
  {side:idx,playerId:defSide==='user'?defId:null,fromId:defId,fromSide:defSide,toId:carrier,toSide:carrierSide,fromPos:point,toPos:point,ballSide:carrierSide});
 matchEvent('penalty',M.min+'’ Penaltı kararı.',{side:1-idx,fromId:defId,fromSide:defSide,ballSide:carrierSide,fromPos:point,
  toPos:[attackDirection(carrierSide)>0?89:11,50]});
 M.stats.penalties=M.stats.penalties||[0,0];M.stats.penalties[1-idx]++;
 startPitchRestart('PENALTY',carrierSide,point);
 return true;
}
const RESTART_PHASES=['BALL_OUT','DETERMINE_RESTART','POSITION_BALL','POSITION_PLAYERS','WAIT_FOR_RESTART','EXECUTE_RESTART','LIVE'];
/* Every restart (kick-off, goal kick, throw-in, corner, free kick, penalty) runs the same ordered machine.
   A transition out of order throws, so a half-finished restart can never be silently left behind.        */
function restartStep(R,phase){
 const from=R.trail.length?R.trail[R.trail.length-1]:null;
 if(RESTART_PHASES.indexOf(phase)!==(from==null?0:RESTART_PHASES.indexOf(from)+1))throw Error('Illegal restart transition '+from+' -> '+phase);
 R.restartPhase=phase;R.trail.push(phase);
}
const roleOf=(id,side)=>side==='user'?M.matchRoles[id]:opponentPlayer(id)?.position;
const outfieldOf=side=>(side==='user'?M.active:M.oppIds).filter(id=>!isKeeper(side,id));
function shooterRecord(id,side){
 const p=playerRecord(id,side);if(side==='user')return p;
 const r=currentOpponent();
 return {...(p||{}),name:p?.name||r[0]+' oyuncusu',finishing:p?.shooting??r[3],physical:p?.overall??r[8],fitness:p?.fitness??90};
}
const aerialRating=(id,side)=>playerAttribute(id,side,'strength',65)*.5+playerAttribute(id,side,'positioning',65)*.3+playerAttribute(id,side,'pace',65)*.2;
// Probability that the attacker wins a high ball against the defender (never certain either way).
const aerialWinProbability=(att,attSide,def,defSide)=>contestProbability(aerialRating(att,attSide),aerialRating(def,defSide),14)*.8+.15;
function penaltyTaker(side){
 return outfieldOf(side).slice().sort((a,b)=>
  (playerAttribute(b,side,'finishing',65)*.6+playerAttribute(b,side,'composure',65)*.4)-
  (playerAttribute(a,side,'finishing',65)*.6+playerAttribute(a,side,'composure',65)*.4))[0];
}
function kickoffTaker(side){
 const pool=outfieldOf(side);
 return pool.find(id=>roleOf(id,side)==='CM')??pool.find(id=>roleOf(id,side)==='CAM')??pool[0];
}
function restartTaker(type,side,position){
 if(type==='GOAL_KICK')return keeperId(side);
 if(type==='PENALTY')return penaltyTaker(side);
 if(type==='KICK_OFF')return kickoffTaker(side);
 return outfieldOf(side).slice().sort((a,b)=>pitchDistance(eventPoint(a,side),position)-pitchDistance(eventPoint(b,side),position))[0];
}
function placeRestartPlayers(type,side,pos,taker){
 M.dynamicPositions??={};M.pitchMotion??={};
 const other=side==='user'?'opp':'user',dir=attackDirection(side),atkGoal=dir>0?100:0;
 const setP=(id,p,exact)=>{
  M.dynamicPositions[String(id)]=exact?[...p]:[limitPitch(p[0],3,97),limitPitch(p[1],4,96)];
  const m=M.pitchMotion[String(id)];if(m){m.vx=0;m.vy=0;m.until=0;m.target=null;}
 };
 if(type==='KICK_OFF'){
  // both teams back in their own half; only the taker stands on the centre spot
  for(const [s,ids] of [['user',M.active],['opp',M.oppIds]]){
   const d=attackDirection(s);
   for(const id of ids){const b=basePitchPosition(id,s);setP(id,[d>0?Math.min(b[0],47):Math.max(b[0],53),b[1]]);}
  }
  setP(taker,[50,50],true);
 }else if(type==='PENALTY'){
  markSetPieceReturn(type);
  setP(taker,pos,true);
  const gk=keeperId(other);if(gk!=null)setP(gk,[atkGoal===100?97:3,50],true);
  const rest=[...outfieldOf(side),...outfieldOf(other)].filter(id=>id!==taker);
  rest.forEach((id,i)=>setP(id,[atkGoal===100?78-(i%2)*3:22+(i%2)*3,14+i*(72/Math.max(1,rest.length-1))]));
 }else if(type==='CORNER'){
  markSetPieceReturn(type);
  setP(taker,pos,true);
  const order=['ST','CAM','CB','CM','LW','RW','LB','RB'];
  const atk=outfieldOf(side).filter(id=>id!==taker).sort((a,b)=>order.indexOf(roleOf(a,side))-order.indexOf(roleOf(b,side))).slice(0,4);
  atk.forEach((id,i)=>setP(id,[atkGoal-dir*(9+(i%2)*5),[42,50,58,46][i]]));
  const dorder=['CB','CM','CAM','LB','RB','ST','LW','RW'];
  const def=outfieldOf(other).sort((a,b)=>dorder.indexOf(roleOf(a,other))-dorder.indexOf(roleOf(b,other))).slice(0,5);
  def.forEach((id,i)=>setP(id,[atkGoal-dir*(5+(i%2)*4),[38,44,50,56,62][i]]));
  const gk=keeperId(other);if(gk!=null)setP(gk,[atkGoal-dir*3.5,50],true);
  // everybody else holds the edge of the box for the second ball
  outfieldOf(side).filter(id=>id!==taker&&!atk.includes(id)).forEach((id,i)=>setP(id,[atkGoal-dir*(25+(i%2)*3),30+i*11]));
  outfieldOf(other).filter(id=>!def.includes(id)).forEach((id,i)=>setP(id,[atkGoal-dir*(31+(i%2)*3),34+i*12]));
 }else if(type==='THROW_IN'){
  setP(taker,pos,true);
  const near=outfieldOf(side).filter(id=>id!==taker).sort((a,b)=>pitchDistance(eventPoint(a,side),pos)-pitchDistance(eventPoint(b,side),pos)).slice(0,3);
  near.forEach((id,i)=>setP(id,[pos[0]+dir*(4+i*5)-(i===0?8:0),pos[1]<50?pos[1]+10+i*7:pos[1]-10-i*7]));
  near.forEach((id,i)=>{const m=nearestMarker(other,eventPoint(id,side));if(m&&i<2)setP(m.id,[eventPoint(id,side)[0]-dir*2.5,eventPoint(id,side)[1]+(pos[1]<50?-2:2)]);});
 }else{
  M.dynamicPositions[String(taker)]=[...pos];
 }
 separatePlayers(M.dynamicPositions,6);
 if(type!=='KICK_OFF'&&type!=='PENALTY'&&type!=='CORNER')M.dynamicPositions[String(taker)]=[...pos];
 // the taker is exactly on the restart spot after spacing
 if(type!=='KICK_OFF')M.dynamicPositions[String(taker)]=[...pos];else M.dynamicPositions[String(taker)]=[50,50];
}
/* Corner / penalty positions are a temporary set-piece arrangement. Once the ball is live again the players
   who were pulled into the box run back to their shape at full running speed (a set-piece recovery run),
   instead of drifting at the normal positional-adjustment rate for several minutes.                    */
function markSetPieceReturn(type){M.setPieceReturn={type,min:M.min};}
function setPieceRecovering(){
 const r=M.setPieceReturn;if(!r)return false;
 if(M.min-r.min>2||(M.restart&&M.restart.restartPhase!=='LIVE')){M.setPieceReturn=null;return false;}
 return M.min>r.min;
}
function goalKickKind(side,taker){
 const order=orderFor(taker,side),T=tacticProfile(side);
 let s=.46,m=.33,l=.21;
 if(order==='shortGK'){s=.78;m=.17;l=.05;}else if(order==='longGK'){s=.12;m=.23;l=.65;}
 if(T.passingStyle==='Kısa'){s+=.12;l-=.08;m-=.04;}
 if(T.passingStyle==='Direkt'){l+=.16;s-=.12;m-=.04;}
 s=Math.max(.02,s);m=Math.max(.02,m);l=Math.max(.02,l);
 const r=M.rand()*(s+m+l);
 return r<s?'short':r<s+m?'medium':'long';
}
function restartReceiver(side,taker,kind,pos){
 const pool=outfieldOf(side).filter(id=>id!==taker);
 const roles=kind==='short'?['CB','LB','RB']:kind==='medium'?['CM','CAM']:['ST','LW','RW'];
 let c=pool.filter(id=>roles.includes(roleOf(id,side)));
 if(!c.length)c=pool;
 c=c.map(id=>({id,d:pitchDistance(eventPoint(id,side),pos)})).sort((a,b)=>a.d-b.d);
 if(kind==='short')c=c.slice(0,2);
 if(!c.length)return null;
 const w=c.map(x=>.5+normalizeAttribute(playerAttribute(x.id,side,kind==='long'?'strength':'offBall',65)));
 let r=M.rand()*w.reduce((n,x)=>n+x,0);
 for(let i=0;i<c.length;i++){r-=w[i];if(r<=0)return c[i].id;}
 return c.at(-1).id;
}
// Hand the ball to a player of `side` or, if the delivery failed, to the nearest opponent / a loose ball.
function restartDelivery(side,taker,receiver,from,target,ok,aerial){
 const other=side==='user'?'opp':'user';
 const index=side==='user'?userSide():1-userSide();
 M.stats.passes[index]++;
 if(ok&&aerial){
  const rival=nearestMarker(other,target);
  if(rival&&rival.d<8&&M.rand()>aerialWinProbability(receiver,side,rival.id,other))ok=false;
 }
 if(ok){M.stats.completedPasses[index]++;switchPitchOwner(receiver,side);setBallState(target,receiver);return true;}
 const icpt=nearestMarker(other,target);
 if(!aerial&&icpt&&icpt.d<14){
  const gain=moveTowards(eventPoint(icpt.id,other),target,Math.min(icpt.d,10));
  M.dynamicPositions[String(icpt.id)]=gain;switchPitchOwner(icpt.id,other);setBallState(gain,icpt.id);
  M.stats.possessionsWon[other==='user'?userSide():1-userSide()]++;
 }else makeLooseBall(from,target,aerial?'aerial':'restart',other);
 return false;
}
function executeRestart(type,side,taker,pos,R){
 const other=side==='user'?'opp':'user',dir=attackDirection(side),atkGoal=dir>0?100:0;
 const idx=side==='user'?userSide():1-userSide();
 const who=side==='user'?matchTeamName('user'):opponentName(taker);
 if(type==='KICK_OFF'){
  if(side==='user')setUserOwner(taker);else setOppOwner(Number(String(taker).slice(1)));
  setBallState([50,50],taker);
  matchEvent('kickoff',M.min+'’ '+matchTeamName(side)+' santra yaptı.',
   {restartType:type,restartPhase:'EXECUTE_RESTART',fromId:taker,toId:taker,fromSide:side,toSide:side,ballSide:side,fromPos:[50,50],toPos:[50+attackDirection(side)*3,50]});
  return;
 }
 if(type==='PENALTY'){
  const p=shooterRecord(taker,side);
  resolveShot(side==='user',taker,p,{penalty:true,source:pos,restartType:type});
  return;
 }
 if(type==='CORNER'){
  const order=['ST','CAM','CB','CM','LW','RW','LB','RB'];
  const atk=outfieldOf(side).filter(id=>id!==taker).sort((a,b)=>order.indexOf(roleOf(a,side))-order.indexOf(roleOf(b,side))).slice(0,4);
  if(!atk.length)return;
  const w=atk.map(id=>.4+normalizeAttribute(aerialRating(id,side)*.6+playerAttribute(id,side,'finishing',65)*.4));
  let r=M.rand()*w.reduce((n,x)=>n+x,0),target_=atk.at(-1);
  for(let i=0;i<atk.length;i++){r-=w[i];if(r<=0){target_=atk[i];break;}}
  const tp=[atkGoal-dir*(9+(atk.indexOf(target_)%2)*5),limitPitch(eventPoint(target_,side)[1],38,62)];
  const dist=pitchDistance(pos,tp);
  const ok=M.rand()<passSuccessProbability(taker,side,{range:dist,lane:.25,space:{danger:.6}},{pressure:.15});
  matchEvent('corner',M.min+'’ '+who+' korneri kullandı.',
   {restartType:type,restartPhase:'EXECUTE_RESTART',side:idx,fromId:taker,toId:target_,fromSide:side,toSide:side,ballSide:side,
    fromPos:pos,toPos:tp,passKind:'cross',travelType:'aerial',distance:dist});
  M.stats.passes[idx]++;
  const def=nearestMarker(other,tp);
  M.ballOwner=null;M.ballSide='none';setBallState(tp,null,'LOOSE_BALL');
  const winAtt=def?aerialWinProbability(target_,side,def.id,other):.9;
  const r2=M.rand();
  if(ok&&r2<winAtt*.55){
   M.stats.completedPasses[idx]++;
   const ph=shooterRecord(target_,side);
   resolveShot(side==='user',target_,ph,{header:true,source:tp,pressure:clamp(1-(def?.d??8)/10,0,1),restartType:type});
  }else if(ok&&r2<winAtt){
   M.stats.completedPasses[idx]++;
   makeLooseBall(tp,[tp[0]-dir*(6+M.rand()*5),limitPitch(tp[1]+(M.rand()-.5)*18,22,78)],'aerial',side);
  }else if(def){
   // defender gets there first: he wins it cleanly or clears it, and the clearance is a real second ball
   if(M.rand()<.4){
    switchPitchOwner(def.id,other);setBallState(eventPoint(def.id,other),def.id);
    M.stats.possessionsWon[other==='user'?userSide():1-userSide()]++;
    matchEvent('interception',M.min+'’ '+(playerAtMarker(def.id,other)?.name||'Rakip')+' korneri kesti.',
     {fromId:taker,toId:def.id,fromSide:side,toSide:other,ballSide:other,fromPos:tp,toPos:eventPoint(def.id,other)});
   }else makeLooseBall(tp,[atkGoal-dir*(24+M.rand()*8),limitPitch(tp[1]+(M.rand()-.5)*34,14,86)],'clearance',null);
  }else makeLooseBall(tp,tp,'aerial',null);
  return;
 }
 let kind,receiver,target;
 if(type==='GOAL_KICK'){
  kind=goalKickKind(side,taker);receiver=restartReceiver(side,taker,kind,pos);
 }else{ // THROW_IN / FREE_KICK: a close, sensible team-mate
  const near=outfieldOf(side).filter(id=>id!==taker).map(id=>({id,d:pitchDistance(eventPoint(id,side),pos)})).sort((a,b)=>a.d-b.d).slice(0,type==='THROW_IN'?3:4);
  receiver=near.length?near[Math.floor(M.rand()*near.length)].id:null;kind='short';
 }
 if(receiver==null)receiver=taker;
 target=eventPoint(receiver,side);
 const range=pitchDistance(pos,target);
 const pressure=(()=>{const m=nearestMarker(other,target);return m?Math.max(0,12-m.d)/12:0;})();
 const aerial=kind==='long';
 let p=passSuccessProbability(taker,side,{range,lane:passLanePressure(pos,target,side),space:pitchSpace(target,side)},{pressure});
 if(type==='THROW_IN')p=Math.min(.97,p+.12);
 const ok=M.rand()<p;
 const typeName={GOAL_KICK:'goalKick',THROW_IN:'throwIn',FREE_KICK:'freeKick'}[type];
 matchEvent(typeName,M.min+'’ '+who+' '+({GOAL_KICK:'kale vuruşunu kullandı.',THROW_IN:'taç atışını kullandı.',FREE_KICK:'serbest vuruşu kullandı.'}[type]),
  {restartType:type,restartPhase:'EXECUTE_RESTART',side:idx,fromId:taker,toId:receiver,fromSide:side,toSide:side,ballSide:side,
   fromPos:pos,toPos:target,passKind:kind,travelType:aerial?'aerial':'ground',distance:range,success:ok});
 restartDelivery(side,taker,receiver,pos,target,ok,aerial);
}
function startPitchRestart(type,side,outPosition){
 if(!RESTART_TYPES.has(type))throw Error('Unknown restart: '+type);
 if(type==='KICK_OFF')throw Error('Kickoff is reserved for match/half/goal');
 return runRestart(type,side,outPosition);
}
function runRestart(type,side,outPosition){
 if(engineFrozen())return null;
 const R={restartType:type,restartTeam:side,restartPosition:null,restartPhase:null,taker:null,trail:[]};
 const dir=attackDirection(side),op=outPosition||[50,50];
 const pos=type==='GOAL_KICK'?[dir>0?4.5:95.5,op[1]<50?44:56]:
  type==='CORNER'?[dir>0?98:2,op[1]<50?2:98]:
  type==='THROW_IN'?[limitPitch(op[0],4,96),op[1]<50?2:98]:
  type==='PENALTY'?[dir>0?89:11,50]:
  type==='KICK_OFF'?[50,50]:
  [limitPitch(op[0],8,92),limitPitch(op[1],8,92)];
 const taker=restartTaker(type,side,pos);
 M.restart=R;M.looseBall=null;
 if(taker==null){R.restartPhase='LIVE';R.trail.push('LIVE');return R;}
 R.taker=taker;R.restartPosition=pos;
 const visible=type!=='KICK_OFF';
 const label={GOAL_KICK:'Kale vuruşu',CORNER:'Korner',THROW_IN:'Taç',FREE_KICK:'Serbest vuruş',PENALTY:'Penaltı'}[type];
 restartStep(R,'BALL_OUT');
 M.ballOwner=null;M.ballSide='none';setBallState(type==='KICK_OFF'?[50,50]:op,null,'BALL_OUT');
 if(visible&&type!=='PENALTY')matchEvent('ballOut',M.min+'’ Top oyun alanının dışında.',{restartType:type,fromPos:op,toPos:op,ballSide:'none'});
 restartStep(R,'DETERMINE_RESTART');
 restartStep(R,'POSITION_BALL');
 if(visible)matchEvent('restartPosition',M.min+'’ '+label+' hazırlanıyor.',{restartType:type,fromPos:op,toPos:pos,fromId:taker,toId:taker,fromSide:side,toSide:side,ballSide:'none'});
 restartStep(R,'POSITION_PLAYERS');
 placeRestartPlayers(type,side,pos,taker);
 if(visible)matchEvent('restartPlayers',M.min+'’ Oyuncular yerlerini aldı.',{restartType:type,restartPosition:pos,fromId:taker,toId:taker,fromSide:side,toSide:side,ballSide:'none',fromPos:pos,toPos:pos});
 restartStep(R,'WAIT_FOR_RESTART');
 if(visible)matchEvent('restartWait',M.min+'’ Oyun yeniden başlayacak.',{restartType:type,fromPos:pos,toPos:pos,ballSide:'none'});
 restartStep(R,'EXECUTE_RESTART');
 executeRestart(type,side,taker,pos,R);
 // a goal or goal kick produced by the restart itself starts its own restart; this one is simply finished
 if(M.restart===R)restartStep(R,'LIVE');else{R.restartPhase='LIVE';R.trail.push('LIVE');}
 return R;
}
function looseCandidates(land){
 const out=[];
 for(const side of ['user','opp']){
  const ownGoalX=attackDirection(side)>0?0:100;
  for(const id of (side==='user'?M.active:M.oppIds)){
   const pos=eventPoint(id,side),d=pitchDistance(pos,land);
   if(isKeeper(side,id)&&Math.abs(land[0]-ownGoalX)>22)continue; // keepers only contest near their own area
   if(d>46)continue;
   out.push({id,side,pos:[...pos],d,d0:d});
  }
 }
 return out;
}
/* The ball is unowned (ballOwner=null, ballSide='none', state LOOSE_BALL) until a player physically
   reaches it. Candidates run toward it at their own speed; ownership changes only on arrival. */
function resolveLooseBall(maxSeconds=8,force=false){
 const lb=M&&M.looseBall;if(!lb||engineFrozen())return null;
 const land=lb.position,step=.4,radius=2.2;
 const chasers=looseCandidates(land);
 if(!chasers.length)for(const side of ['user','opp'])for(const id of (side==='user'?M.active:M.oppIds)){
  const pos=eventPoint(id,side);chasers.push({id,side,pos:[...pos],d:pitchDistance(pos,land),d0:pitchDistance(pos,land)});
 }
 // remember where each chaser started so a chase that spans several ticks reports its true length
 if(!lb.d0){lb.d0={};for(const c of chasers)lb.d0[String(c.id)]=c.d0;}
 for(const c of chasers)c.d0=lb.d0[String(c.id)]??c.d0;
 // Pace = top speed, acceleration = how fast a jog becomes that speed, reaction = short random start delay.
 // Kinematic state persists across ticks so a long chase is one continuous run.
 lb.kin??={};
 for(const c of chasers){
  const key=String(c.id);
  if(!lb.kin[key]){const top=topSpeed(c.id,c.side);lb.kin[key]={top,v:top*.3,acc:(top-top*.3)/accelerationTime(c.id,c.side),wait:reactionDelay(c.id,c.side)};}
 }
 let winner=null,t=0;
 while(!winner&&t<maxSeconds&&lb.elapsed<25){
  t+=step;lb.elapsed+=step;
  const reached=[];
  for(const c of chasers){
   const k=lb.kin[String(c.id)];
   if(k.wait>0)k.wait-=step;
   else{k.v=Math.min(k.top,k.v+k.acc*step);c.pos=moveTowards(c.pos,land,k.v*step);}
   c.d=pitchDistance(c.pos,land);if(c.d<=radius)reached.push(c);
  }
  if(reached.length===1)winner=reached[0];
  else if(reached.length>1){
   // simultaneous arrival: closer, better-positioned and (lightly) the intended side wins; seeded jitter breaks ties
   const scored=reached.map(c=>({c,s:c.d-playerAttribute(c.id,c.side,'positioning',70)*.02-attributeEdge(playerAttribute(c.id,c.side,'strength',68))*.6-(c.side===lb.preferSide?.8:0)+M.rand()*1.3}));
   winner=scored.sort((x,y)=>x.s-y.s)[0].c;
  }
 }
 if(!winner&&(force||lb.elapsed>=25))winner=chasers.slice().sort((x,y)=>x.d-y.d)[0]||null;
 M.dynamicPositions??={};
 for(const c of chasers){
  if(c!==winner&&winner&&c.d<1.8){const ang=(String(c.id).length+c.d0)%6.283;c.pos=[land[0]+Math.cos(ang)*1.8,land[1]+Math.sin(ang)*1.8];}
  M.dynamicPositions[String(c.id)]=[limitPitch(c.pos[0],4,96),limitPitch(c.pos[1],6,94)];
 }
 if(!winner)return null; // still loose: ball stays unowned and the chase continues on the next tick
 M.looseBall=null;
 M.dynamicPositions[String(winner.id)]=[...land];
 matchEvent('recovery',M.min+'’ '+(winner.side==='user'?getPlayer('user',winner.id)?.name:opponentName(winner.id))+' dönen topu aldı.',
  {fromPos:land,toPos:[...land],toId:winner.id,toSide:winner.side,ballSide:winner.side,
   chaseSeconds:+lb.elapsed.toFixed(2),startDistance:+winner.d0.toFixed(2),contested:false});
 switchPitchOwner(winner.id,winner.side);
 return winner;
}
function makeLooseBall(from,to,reason,preferSide){
 if(engineFrozen())return null;
 const raw=to||from,land=[limitPitch(raw[0],4,96),limitPitch(raw[1],6,94)];
 M.ballOwner=null;M.ballSide='none';
 setBallState(land,null,'LOOSE_BALL');
 M.looseBall={position:[...land],reason,preferSide:preferSide||null,elapsed:0};
 matchEvent('looseBall',M.min+'’ Top sahipsiz kaldı.',{fromPos:from,toPos:land,ballSide:'none',reason});
 return resolveLooseBall(8);
}
// Half-time / full-time: no sequence may be left half-resolved.
// End-of-minute shape pass: events above may have moved players onto each other (duels, recoveries).
function settleShape(){
 if(engineFrozen())return;
 M.dynamicPositions??={};separatePlayers(M.dynamicPositions,6); // restarts/duels can stack several players; settle them fully
 if(M.ballOwner!=null&&M.ballSide!=='none'&&M.ballState?.state==='LIVE')M.ballState.position=eventPoint(M.ballOwner,M.ballSide);
}
function settlePlay(){
 if(!M||engineFrozen())return;
 if(M.looseBall)resolveLooseBall(30,true);
 enforceBallInvariants();
}
// Ball owner, side, possession and ballState must agree; repair through the same loose-ball path.
function enforceBallInvariants(){
 if(engineFrozen()||M.looseBall)return;
 const pool=M.ballSide==='user'?M.active:M.ballSide==='opp'?M.oppIds:null;
 const valid=M.ballOwner!=null&&pool&&pool.includes(M.ballOwner)&&((typeof M.ballOwner==='number')===(M.ballSide==='user'));
 if(valid){
  if(M.ballState?.state==='LIVE'&&M.ballState.ownerId!==M.ballOwner)setBallState(M.ballState.position||eventPoint(M.ballOwner,M.ballSide),M.ballOwner);
  return;
 }
 const at=[...(M.ballState?.position||[50,50])];
 makeLooseBall(at,at,'recovery',pool?M.ballSide:null);
}
/* Lightweight spacing on the AUTHORITATIVE positions: gentle push-apart, never a bounce. */
function separatePlayers(positions,passes=2){
 const ids=[...M.active.map(id=>[id,'user']),...M.oppIds.map(id=>[id,'opp'])].filter(([id])=>positions[String(id)]);
 const ball=M.ballState?.position||[50,50];
 // duel code can hand the same array object to two players; separate them before nudging in place
 for(const [id] of ids)positions[String(id)]=[...positions[String(id)]];
 for(let pass=0;pass<passes;pass++)for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
  const A=positions[String(ids[i][0])],B=positions[String(ids[j][0])];
  const same=ids[i][1]===ids[j][1];
  // opponents may close each other down near the ball; team-mates keep a little more room
  const contest=!same&&pitchDistance(A,ball)<9&&pitchDistance(B,ball)<9;
  const min=same?4.2:contest?1.4:2.8;
  let dx=A[0]-B[0],dy=A[1]-B[1],d=Math.hypot(dx,dy);
  if(d>=min)continue;
  if(d<.01){dx=(i%2?-1:1);dy=(j%2?.6:-.6);d=Math.hypot(dx,dy);}
  const push=Math.min(.9,(min-d)*.5),nx=dx/d,ny=dy/d;
  A[0]=limitPitch(A[0]+nx*push,4,96);A[1]=limitPitch(A[1]+ny*push,6,94);
  B[0]=limitPitch(B[0]-nx*push,4,96);B[1]=limitPitch(B[1]-ny*push,6,94);
 }
}
function aerialHeight(event,progress){
 if(!event||!['long','cross','lofted'].includes(event.passKind)&&event.travelType!=='aerial')return 0;
 const flight=limitPitch((progress-.19)/.57,0,1);
 return Math.sin(Math.PI*flight);
}
function softenPlayerOverlap(positions){
 const ids=[...M.active,...M.oppIds].filter(id=>positions[String(id)]);
 // 22² comparisons; keep close marking while separating 24 px markers.
 for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
  const a=positions[String(ids[i])],b=positions[String(ids[j])];
  const dx=a[0]-b[0],dy=(a[1]-b[1])*.68;
  let distance=Math.hypot(dx,dy);
  if(distance>=4.6)continue;
  const sign=distance<.01?(i%2?-1:1):1;
  const nx=distance<.01?sign:dx/distance,ny=distance<.01?((j%2)?.6:-.6):dy/distance;
  const push=Math.min(1.5,(4.6-distance)*.45);
  a[0]=limitPitch(a[0]+nx*push,4,96);a[1]=limitPitch(a[1]+ny*push/.68,5,95);
  b[0]=limitPitch(b[0]-nx*push,4,96);b[1]=limitPitch(b[1]-ny*push/.68,5,95);
  distance=Math.hypot(a[0]-b[0],(a[1]-b[1])*.68);
  if(distance<.7)b[1]=limitPitch(b[1]+1.2,5,95);
 }
}
function openOpponentPlayer(id){
 const p=opponentPlayer(id);if(!M||!p)return;
 beginMatchOverlay();
 document.querySelector('#app').innerHTML=`<section class=playerorderoverlay role=dialog aria-modal=true aria-label="Rakip oyuncu bilgisi"><div class=playerorderhead><button class=ghost onclick="closeMatchOverlay()">‹ Maça dön</button><span>⏸ ${matchClock()}</span></div><div class=playerhero><small>${escapeHTML(M.userHome?M.away:M.home)}</small><h1>${escapeHTML(p.name)}</h1><p>${p.position} • OVR ${p.overall}<br>Yaş ${p.age} • Fitness %${Math.round(p.fitness)}<br>Hız ${p.pace} • Pas ${p.passing} • Top sürme ${p.dribbling}</p></div></section>`;
}
