/* ManagerStory: shared match state, match events and the in-match panel. (Saves: save.js.) */
import { TACTIC_DATA } from '../../data/tactics.js';
import { R, newMatchSalt } from '../random.js';
import { M, S, setMatch } from '../state.js';
import { presentation } from '../presentation/registry.js';
import { defineActions } from '../../ui/actions.js';
import { changed, runHooks } from '../hooks.js';
import { ensureLiveState, livePresentationPending, matchSecond, resetLiveFrame } from './live-match.js';
import { opponentLineup } from '../league/opponents-v731.js';
import { currentPitchState, enqueuePitchEvent, eventPoint, nearestMarker } from './pitch-v73.js';
import { assistantAdvice, attackDirection, isKeeper, matchTeamName, playerAtMarker, startPitchRestart } from './pitch-v731.js';
import { currentOpponent } from '../league/league.js';
import { save } from '../save.js';
export const GAME_VERSION = "7.10.0";
// tactic settings, their labels and the team orders (data/tactics.js)
export const MATCH_TACTICS = TACTIC_DATA.options;
export const TACTIC_LABELS = TACTIC_DATA.labels;
export const TEAM_ORDERS = TACTIC_DATA.orders;
export const FORM_TR = { W: "G", D: "B", L: "M", G: "G", B: "B", M: "M" };
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export const finite = (n, fallback = 0) => Number.isFinite(n) ? n : fallback;
export const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
// V7.8: every match gets its own dice. A career made in the app carries a salt that is drawn anew at
// each kickoff, so a new career's first match (or a fixture replayed from an older save) is a new
// match, not a rerun. Without a salt (automated checks) the seed is the fixture's, as before.
// (the salt itself is drawn by newMatchSalt in random.js, outside the engine)
export function matchSeed() { return 8800 + S.fixture * 97 + (S.matchSalt || 0); }
export function kickoffSeed() { if (S.matchSalt != null) S.matchSalt = newMatchSalt(); return matchSeed(); }
export function restoreActiveMatch() {
  if (M || !S?.activeMatchV71) return;
  setMatch(structuredClone(S.activeMatchV71));
  M.rand = R(M.rngState ?? matchSeed());
  delete M.uiOverlay;
  ensureMatchState();
  ensureLiveState();
}
export function ensureMatchState() {
  if (!M) return;
  M.activeTab ??= "pitch";
  M.events ??= [];
  M.stats ??= {};
  for (const key of ["xg", "corners", "fouls", "passes", "completedPasses", "bigChances", "yellow", "red", "possessionsWon", "tackles"]) M.stats[key] ??= [0, 0];
  // Old saves may include a delayed presentation score; the score is now M.hg/M.ag only.
  delete M.visualScore;
  M.secondHalf ??= M.min>45;
  M.dynamicPositions ??= {};
  M.oppLineup ??= opponentLineup(M.userHome?M.away:M.home);
  M.restart ??= {restartType:null,restartTeam:null,restartPosition:null,restartPhase:'LIVE'};
  M.ballState ??= {position:eventPoint(M.ballOwner,M.ballSide),ownerId:M.ballOwner??null,
    state:M.ballOwner==null?'LOOSE_BALL':'LIVE',target:null,travelType:'ground',travelDuration:0,height:0};
  M.playerStats ??= {};
  M.orderKeys ??= {};
  M.yellowByPlayer ??= {};
  M.sentOff ??= [];
  M.substitutions ??= [];
  M.tacticChanges ??= [];
  M.lifecycle ??= M.finished ? 'FINISHED' : M.reason === 'half' ? 'HALF_TIME' : M.pause ? 'PAUSED' : M.secondHalf ? 'RUNNING_SECOND_HALF' : 'RUNNING';
  M.requiredSubstitution ??= null;
  M.positionSuitability ??= {};
  M.teamInstructions ??= [...(S.plan.teamInstructions || [])];
  M.tempo ??= S.plan.tempo;
  M.line ??= S.plan.line;
  M.approach ??= S.plan.approach;
  M.passingStyle ??= S.plan.passingStyle;
  M.width ??= S.plan.width;
  M.matchRoles ??= {};
  for (const id of M.active) {
    const p = S.players.find(x => x.id === id);
    if (!p) continue;
    M.playerStats[id] ??= { rating: 6.5, goals: 0, shots: 0, minutes: 0, saves: 0 };
    M.playerStats[id].touches ??= 0;
    for (const field of ["passesAttempted","passesCompleted","keyPasses","dribblesAttempted","dribbles","tacklesAttempted","tackles","runs","distanceKm"])
      M.playerStats[id][field] ??= 0;
    M.matchRoles[id] ??= roleAtSlot(p, M.matchPositions?.[id] || S.positions[id]);
  }
}
export function roleAtSlot(p, slot) {
  if (!slot) return p.pos.split("/")[0];
  const [x, y] = slot;
  if (y > 82) return "GK";
  if (y >= 63) return x < 26 ? "LB" : x > 74 ? "RB" : "CB";
  if (y >= 44) return "CM";
  if (x < 28) return "LW";
  if (x > 72) return "RW";
  return y < 25 ? "ST" : "CAM";
}
export function userSide() { return M.userHome ? 0 : 1; }
export function matchEvent(type, text, data = {}) {
  runHooks('matchEvent', type, text, data); // observers (tests, tools) see every event as it is made
  if (!M || M.finished || M.lifecycle === 'FINISHING' || M.lifecycle === 'FINISHED') return null;
  const gameSecond=Math.floor(matchSecond()),minute=Math.floor(gameSecond/60);
  if(type==='goal'){
    if(data.side===0)M.hg++;else if(data.side===1)M.ag++;else throw new Error('GOAL event requires a valid scoring side');
  }
  const event = { ...data,type,eventId:(M.nextEventId=(M.nextEventId||0)+1),minute,second:gameSecond,gameSecond,
    text,homeGoals:M.hg,awayGoals:M.ag };
  M.events.push(event);
  if (M.minuteEvents && ['kickoff','pass','interception','run','dribble','ballCarry','offBallRun','counterAttack','press','tackle','cross','shot','save','block','post','wide','goal','throwIn','goalKick','corner','ballOut','restartPosition','restartPlayers','restartWait','firstTouch','looseBall','recovery','foul','freeKick','penalty','offside'].includes(type)) M.minuteEvents.push(event);
  M.story.push(text);
  if (typeof enqueuePitchEvent === 'function') enqueuePitchEvent(event);
  return event;
}
// Read-only actor classification. Generic engine blocks can be keeper contacts.
export function shotInterventionActor(e){
 if(!e||!['block','save'].includes(e.type))return {kind:'unknown',id:null,side:null};
 const id=e.toId,side=e.toSide,player=id==null||!['user','opp'].includes(side)?null:playerAtMarker(id,side);
 const role=side==='user'?M?.matchRoles?.[id]:player?.position;
 return {kind:player&&role?(role==='GK'?'keeper':'field'):'unknown',id,side,name:player?.name||null,role:role||null};
}
// V7.8: commentary variety. The sentence is picked from the event's own number (no dice), so the same
// match always reads the same, but a match no longer repeats one sentence per event type.
export function lineVariant(seed, lines) { return lines[((Math.imul((seed | 0) + 7, 2654435761) >>> 0) >>> 3) % lines.length]; }   // (unsigned shift: a negative index read "undefined")
export function presentationEvent(e){
 if(!e)return e;
 if(['press','tackle','interception'].includes(e.type)){
  const id=e.type==='interception'?e.toId:e.defenderId,side=e.type==='tackle'?(e.fromSide==='user'?'opp':e.fromSide==='opp'?'user':null):e.toSide;
  const player=id==null||!['user','opp'].includes(side)?null:playerAtMarker(id,side),role=side==='user'?M?.matchRoles?.[id]:player?.position;
  const actor={id,side,name:player?.name||null,role:role||null,kind:player&&role?(role==='GK'?'keeper':'field'):'unknown'};
  const name=player?(role==='GK'?'Kaleci ':'')+player.name:'Oyuncu',k=e.eventId??0;
  const action=e.type==='press'?lineVariant(k,[' topa baskıya çıktı.',' rakibinin üstüne gitti.',' pres yaptı.',' adamını sıkıştırdı.'])
   :e.type==='interception'?lineVariant(k,[' topu kazandı.',' pası kesti.',' araya girip topu aldı.'])
   :e.success?lineVariant(k,[' topu kazandı.',' temiz bir müdahaleyle topu aldı.',' topu kaptı.']):lineVariant(k,[' müdahaleyi kaçırdı.',' geçildi.',' topa yetişemedi.']);
  return {...e,text:(e.minute??M.min)+'’ '+name+action,presentationActor:actor};
 }
 if(e.type==='chance'&&e.outcome==='block'){
  const result=M.events.find(x=>x.type==='block'&&x.gameSecond===e.gameSecond&&x.side===e.side);
  const actor=shotInterventionActor(result);
  return {...e,text:(e.minute??M.min)+'’ Şutun sonucu: '+(actor.kind==='keeper'?'kaleci müdahalesi':actor.kind==='field'?'oyuncu bloğu':'engellendi')+'.'};
 }
 if(e.type!=='block'&&!(e.type==='save'&&e.saveType==='DEFLECT_CORNER'))return e;
 const actor=shotInterventionActor(e),corner=e.saveType==='DEFLECT_CORNER'||M.events.some(x=>x.gameSecond===e.gameSecond&&x.restartType==='CORNER');
 const text=actor.kind==='keeper'?(actor.name||'Kaleci')+(corner?' şutu çelerek kornere gönderdi.':' şutu çeldi.'):actor.kind==='field'?(actor.name||'Oyuncu')+' şutu engelledi.':'Şut engellendi.';
 return {...e,text:(e.minute??M.min)+'’ '+text,presentationActor:actor,presentationLabel:actor.kind==='keeper'?'KURTARIŞ':actor.kind==='field'?'BLOK':'MÜDAHALE'};
}
export function liveCommentaryLines(){
  if(presentation.live3d?.enabled&&!(!livePresentationPending()&&M.finished)){
    const s=currentPitchState(),e=s.controlMotion?.event||s.shotMotion?.event||s.contestMotion?.event||s.looseMotion?.event||s.holdMotion?.event||s.active;
    const text=e&&!['enginePositionGap','presentationSync'].includes(e.type)?presentationEvent(e).text:null;
    if(M.commentaryOpen){const boundary=e?.eventId??s.queue.find(x=>x.eventId!=null)?.eventId;const lines=M.events.filter(x=>x.eventId!=null&&(boundary==null||x.eventId<boundary)).slice(-79).reverse().map(x=>presentationEvent(x).text);return [text||'Sahada oyun sürüyor.',...lines];}
    return [text||(livePresentationPending()?"Son aksiyonların sunumu tamamlanıyor.":"Sahada oyun sürüyor.")];
  }
  if(M.commentaryOpen){const events=M.events.slice();return M.story.slice(-80).reverse().map(text=>{const i=events.findLastIndex(e=>e.text===text);if(i<0)return text;const event=events[i];events.length=i;return presentationEvent(event).text;});}
  const now=matchSecond();
  const recent=M.events.filter(e=>e.gameSecond!=null&&now-e.gameSecond>=0&&now-e.gameSecond<=90).slice(-2).reverse();
  return recent.length?recent.map(e=>presentationEvent(e).text):['Sahada oyun sürüyor.'];
}
// V7.8: a foul is a real challenge. It is committed by the team without the ball, by the player
// closest to the man on the ball, where the ball is; the fouled team gets the free kick (or plays on
// when it keeps a promising attack: advantage). The card follows the foul: a tactical foul that stops
// an attack, a late foul from behind or a persistent offender is booked; denying a clear goal-scoring
// chance as the last man is a red card. Before, the side, the player and the card were drawn at random,
// anywhere on the pitch, and play carried on.
export function recordMatchFoul() {
  const carrier = M.ballOwner, victimSide = M.ballSide;
  if (carrier == null || (victimSide !== 'user' && victimSide !== 'opp') || M.minuteShot) return;
  if (M.restart && M.restart.restartPhase && M.restart.restartPhase !== 'LIVE') return;
  if (isKeeper(victimSide, carrier)) return;
  const foulSide = victimSide === 'user' ? 'opp' : 'user';
  const ball = M.ballState?.position || eventPoint(carrier, victimSide);
  const near = nearestMarker(foulSide, ball);
  if (!near || near.d > 13 || isKeeper(foulSide, near.id)) return;     // nobody close enough to foul him
  // defenders are careful in their own box: most challenges there are clean
  const ownGoalX = attackDirection(foulSide) > 0 ? 0 : 100;
  const inBox = Math.abs(ball[0] - ownGoalX) < 17 && Math.abs(ball[1] - 50) < 30;
  if (inBox && M.rand() < .82) return;
  const id = near.id, side = foulSide === 'user' ? userSide() : 1 - userSide(), own = foulSide === 'user';
  const booked = (M.yellowByPlayer?.[id] || 0) > 0;
  if (booked && M.rand() < .7) return;                                   // a booked player holds back
  if (own && M.matchRoles[id] === 'GK') return;
  M.stats.fouls[side]++;
  const dir = attackDirection(victimSide), goalX = dir > 0 ? 100 : 0, toGoal = Math.abs(goalX - ball[0]);
  const fouler = eventPoint(id, foulSide);
  const fromBehind = (fouler[0] - ball[0]) * dir < -1;                   // he was beaten and caught the man from behind
  // last man: no other outfield defender between the ball and the goal
  const covering = (foulSide === 'user' ? M.active : M.oppIds).filter(x => x !== id && !isKeeper(foulSide, x))
    .filter(x => (goalX - eventPoint(x, foulSide)[0]) * dir < toGoal - 1).length;
  const clearChance = covering === 0 && toGoal < 28 && Math.abs(ball[1] - 50) < 22 && fromBehind;
  const attacking = toGoal < 40;                                           // stopping an attack in our half
  const victimName = victimSide === 'user' ? (S.players.find(p => p.id === carrier)?.name || 'Oyuncumuz') : (playerAtMarker(carrier, 'opp')?.name || 'rakip oyuncu');
  const name = own ? (S.players.find(p => p.id === id)?.name || 'Oyuncumuz') : (playerAtMarker(id, 'opp')?.name || `${side === 0 ? M.home : M.away} oyuncusu`);
  // advantage: the fouled team keeps the ball in the final third and the attack goes on
  const advantage = !clearChance && toGoal < 35 && M.rand() < .35;
  matchEvent('foul', `${M.min}' ${name}, ${victimName} karşısında faul yaptı.${advantage ? ' Hakem avantaj verdi.' : ''}`,
    { side, playerId: own ? id : null, fromId: id, fromSide: foulSide, toId: carrier, toSide: victimSide, fromPos: [...fouler], toPos: [...ball], ballSide: victimSide, advantage, tactical: attacking && fromBehind, lastMan: clearChance });
  const persistent = (M.foulsByPlayer = M.foulsByPlayer || {})[id] = (M.foulsByPlayer[id] || 0) + 1;
  const pYellow = clamp(.08 + (fromBehind ? .1 : 0) + (attacking && fromBehind ? .16 : 0) + (persistent >= 3 ? .25 : 0), .05, .7);
  if (clearChance && M.rand() < .3) recordMatchCard(side, id, true);
  else if (M.rand() < pYellow * (booked ? .4 : 1)) recordMatchCard(side, id, false);
  if (advantage) return;
  if (inBox) {
    matchEvent('penalty', `${M.min}' Penaltı kararı.`, { side: 1 - side, fromId: id, fromSide: foulSide,
      ballSide: victimSide, fromPos: ball, toPos: [attackDirection(victimSide) > 0 ? 89 : 11, 50] });
    M.stats.penalties = M.stats.penalties || [0, 0];
    M.stats.penalties[victimSide === 'user' ? userSide() : 1 - userSide()]++;
    startPitchRestart('PENALTY', victimSide, ball);
  } else startPitchRestart('FREE_KICK', victimSide, ball);
}
export function recordMatchCard(side, id, directRed = false) {
  const own = side === userSide(), p = own ? S.players.find(x => x.id === id) : null;
  if (own ? !M.active.includes(id) : !M.oppIds.includes(id)) return;
  const name = p?.name || `${side === 0 ? M.home : M.away} oyuncusu`;
  if (!directRed) { M.stats.yellow[side]++; M.yellowByPlayer[id] = (M.yellowByPlayer[id] || 0) + 1; if (p) p.yellow++; }
  const red = directRed || M.yellowByPlayer[id] >= 2;
  if (p) M.playerStats[id].rating = clamp(M.playerStats[id].rating - (red ? 1 : .25), 1, 10);
  if (red) {
    M.stats.red[side]++;
    if (p) { p.red++; M.active = M.active.filter(x => x !== id); M.sentOff.push(id); }
    else M.oppIds = M.oppIds.filter(x => x !== id);
    matchEvent('red', `🟥 ${M.min}' ${name}, ${directRed ? 'doğrudan' : 'ikinci sarıdan'} kırmızı kart gördü.`, { side, playerId: id });
  } else matchEvent('yellow', `🟨 ${M.min}' ${name} sarı kart gördü.`, { side, playerId: id });
}
export function matchSummary(match = M) {
  const side = match.userHome ? 0 : 1;
  // Keep replayable chains around chances without multiplying every routine pass across 34 saved rounds.
  const replayEvents = match.events.filter((event, index, all) => event.type !== 'pass' ||
    all.slice(index + 1, index + 4).some(next => ['shot','goal','chance'].includes(next.type)));
  return {
    home: match.home, away: match.away, hg: match.hg, ag: match.ag, userHome: match.userHome,
    week: S.week, fixture: S.fixture, shots: [...match.shots], onTarget: [...match.ont],
    stats: structuredClone(match.stats), events: structuredClone(replayEvents), highlights: structuredClone(match.events.filter(e => ['goal','chance','save','red','injury'].includes(e.type))),
    players: Object.entries(match.playerStats).map(([id, stats]) => ({ id: +id, name: S.players.find(p => p.id === +id)?.name || 'Oyuncu', ...stats })),
    substitutions: structuredClone(match.substitutions), tactics: structuredClone(match.tacticChanges),
    press: match.press, tempo: match.tempo, mentality: match.mentality,
    userGoals: side === 0 ? match.hg : match.ag, opponentGoals: side === 0 ? match.ag : match.hg
  };
}
export function orderKey(p) {
  if (M.orderKeys[p.id]) return M.orderKeys[p.id];
  const label = M.playerOrders[p.id] || S.instructions[p.id] || "Dengeli";
  return matchOrderOptions(p, M.matchRoles[p.id] || p.pos.split("/")[0]).find(x => x.label === label)?.key || "balanced";
}
export function tacticalEffects() {
  const players = S.players.filter(p => M.active.includes(p.id));
  let control = 1, attack = 1, defence = 1, fatigue = 1, frequency = 1, passing = 0, passDistance = 0;
  if (M.mentality === "Cesur") { attack += .09; defence -= .07; frequency += .09; passing -= .015; }
  if (M.mentality === "Temkinli") { attack -= .08; defence += .07; frequency -= .09; passing += .018; }
  if (M.press === "Yüksek") { control += .065; fatigue += .27; defence -= .018; }
  if (M.press === "Düşük") { control -= .025; fatigue -= .12; defence += .02; }
  if (M.tempo === "Yüksek") { frequency += .2; fatigue += .15; passing -= .04; }
  if (M.tempo === "Düşük") { frequency -= .15; fatigue -= .08; passing += .04; }
  if (M.line === "Önde") { control += .035; defence -= currentOpponent()[8] >= 78 ? .10 : .05; }
  if (M.line === "Geride") { defence += .05; control -= .045; }
  if (M.approach === "Kanatlar") { attack += .025; passing -= .015; }
  if (M.approach === "Merkez") { control += .025; passing += .02; }
  if (M.approach === "Kontra") { attack += currentOpponent()[2] === "high" ? .08 : .02; control -= .035; }
  if (M.passingStyle === "Kısa") { control += .025; passing += .025; passDistance -= .28; frequency -= .035; }
  if (M.passingStyle === "Direkt") { attack += .025; passing -= .035; passDistance += .34; frequency += .04; }
  if (M.width === "Dar") { control += .018; defence += .012; attack -= .008; }
  if (M.width === "Geniş") { attack += .018; defence -= .012; passing -= .008; }
  if (M.teamInstructions.includes("compact")) { defence += .035; attack -= .02; }
  if (M.teamInstructions.includes("patience")) { control += .03; passing += .03; frequency -= .1; }
  if (M.teamInstructions.includes("quick")) { frequency += .12; passing -= .025; fatigue += .08; }
  for (const p of players) {
    switch (orderKey(p)) {
      case "creator": control += .013; passing += .012; break;
      case "riskPass": attack += .02; passing -= .012; break;
      case "free": attack += .018; defence -= .008; break;
      case "press": control += .008; break;
      case "stay": defence += .016; attack -= .006; break;
      case "step": control += .012; defence -= .008; break;
      case "overlap": attack += .017; defence -= .011; break;
      case "shortGK": passing += .025; control += .015; break;
      case "longGK": frequency += .07; passing -= .025; break;
      case "sweeper": defence += M.line === "Önde" ? .025 : .005; break;
    }
  }
  if(players.length){
    const readiness=players.reduce((sum,p)=>sum+
      (finite(p.morale,70)-70)*.00035+(finite(p.confidence,50)-50)*.00045+
      (finite(p.motivation,50)-50)*.0004-(finite(p.pressure,50)-50)*.00035,0)/players.length;
    const modifier=clamp(readiness,-.035,.035);
    control+=modifier;attack+=modifier;defence+=modifier;passing+=modifier*.45;
  }
  return { control, attack, defence, fatigue, frequency, passing, passDistance };
}
export function applyConversationEffect(context,choice,participants){
  if(!S)return null;
  S.v732 ??={schema:1,conversationHistory:[],feedback:null};
  const players=(participants||S.players.filter(p=>p.status!=='Transfer oldu'&&p.status!=='Kirada'));
  const supportive=['pressTrust','pressCalm','postTeam','belief','calm','support','dynManager','arasFree'].includes(choice);
  const demanding=['pressDemand','postDemand','demand','angry','challenge','earn'].includes(choice);
  const bold=['pressBold','ambitious','brave'].includes(choice);
  if(!supportive&&!demanding&&!bold)return null;
  let positive=0,negative=0;
  for(const p of players){
    p.managerTrust ??= finite(p.relation,65);
    const character=p.personality||'Profesyonel';
    const tough=['Lider','Hırslı','Rekabetçi','Profesyonel','Determined','Ambitious','Professional'].includes(character);
    const receptive=supportive?1:demanding?(tough?1:-1):(tough?1:0);
    p.confidence ??=50;p.pressure ??=50;p.motivation ??=50;
    if(receptive>0){p.managerTrust=clamp(p.managerTrust+1,20,100);p.confidence=clamp(p.confidence+(supportive?2:1),20,100);p.motivation=clamp(p.motivation+1,20,100);if(p.morale<58)p.morale=clamp(p.morale+1,20,100);positive++;}
    if(receptive<0){p.managerTrust=clamp(p.managerTrust-1,20,100);p.pressure=clamp(p.pressure+2,0,100);p.happiness=clamp(finite(p.happiness,70)-1,20,100);negative++;}
    if(demanding&&tough)p.motivation=clamp(p.motivation+2,20,100);
    if(demanding&&p.age<=19){p.morale=clamp(finite(p.morale,70)-1,20,100);p.pressure=clamp(p.pressure+1,0,100);negative++;}
  }
  const single=players.length===1?players[0]:null;
  const feedback=negative>positive?'Bazı oyuncular üzerindeki baskı arttı.':positive?(single?`${single.name}'ın özgüveni arttı.`:'Oyuncular mesajını olumlu karşıladı. Moral ve özgüven arttı.'):'Takım mesajı sakin karşıladı.';
  const result={week:S.week,context,choice,positive,negative,text:feedback};
  S.v732.conversationHistory.push(result);
  S.v732.conversationHistory=S.v732.conversationHistory.slice(-40);
  S.v732.feedback=result;
  return result;
}
export function matchPossession() {
  const total = M.userPossTicks + M.oppPossTicks;
  const user = total ? Math.round(M.userPossTicks * 100 / total) : 50;
  return M.userHome ? [user, 100 - user] : [100 - user, user];
}
export function matchFitnessUI() {
  const ps = S.players.filter(p => M.active.includes(p.id)).sort((a, b) => a.fitness - b.fitness);
  return `<div class="fitnessstrip" aria-label="Sahadaki oyuncuların fitness durumu">${ps.map(p => `<button class="fitnessmini ${p.fitness < 45 ? "critical" : p.fitness < 60 ? "warning" : ""}" data-action="openMatchPlayer" data-id="${p.id}" aria-label="${escapeHTML(p.name)}, fitness yüzde ${Math.round(p.fitness)}${p.fitness < 45 ? ', kritik' : p.fitness < 60 ? ', yorgun' : ''}"><b>${escapeHTML(p.name)}</b><span>%${Math.round(p.fitness)} ${p.fitness < 45 ? "‼" : p.fitness < 60 ? "!" : ""}</span><i style="--fitness:${clamp(p.fitness, 0, 100)}%"></i></button>`).join("")}</div>`;
}
export function matchStatsUI() {
  const st = M.stats, poss = matchPossession();
  const percent = side => st.passes[side] ? Math.round(st.completedPasses[side] * 100 / st.passes[side]) + "%" : "—";
  const rows = [
    ["Şut", ...M.shots], ["İsabetli şut", ...M.ont], ["Topa sahip olma", ...poss.map(x => x + "%")],
    ["xG", ...st.xg.map(x => x.toFixed(2))], ["Korner", ...st.corners], ["Faul", ...st.fouls],
    ["Pas yüzdesi", percent(0), percent(1)], ["İsabetli / toplam pas", `${st.completedPasses[0]} / ${st.passes[0]}`, `${st.completedPasses[1]} / ${st.passes[1]}`],
    ["Büyük fırsatlar", ...st.bigChances], ["Top kazanma", ...st.possessionsWon], ["Başarılı müdahale", ...st.tackles], ["Sarı kart", ...st.yellow], ["Kırmızı kart", ...st.red]
  ];
  return `<section class="matchstats"><h2>Maç İstatistikleri</h2><div class="statteamnames"><b>${M.home}</b><b>${M.away}</b></div>${rows.map(([label, a, b]) => `<div class="statrow"><b>${a}</b><span>${label}</span><b>${b}</b></div>`).join("")}</section>`;
}
export function matchDetailsUI() {
  const labels = { goal: "Gol", yellow: "Sarı kart", red: "Kırmızı kart", sub: "Değişiklik", chance: "Pozisyon", injury: "Sakatlık", half: "Devre arası", end: "Son düdük", tactic: "Taktik", order: "Talimat", corner: "Korner", penalty: "Penaltı", freeKick: "Serbest vuruş", offside:"Ofsayt",save: "Kurtarış", block: "Blok", post: "Direk", wide: "Aut", throwIn: "Taç", goalKick: "Kale vuruşu", tackle: "Müdahale" };
  const events = M.events.filter(e => labels[e.type]).slice().reverse();
  return `<section class="matchdetails"><h2>${M.min}' • ${M.home} ${M.hg}–${M.ag} ${M.away}</h2><ol>${events.map(e => `<li class="event-${e.type}"><span>${e.minute}' · ${presentationEvent(e).presentationLabel||labels[e.type]}</span><p>${escapeHTML(presentationEvent(e).text)}</p></li>`).join("") || "<li>Henüz önemli bir olay yaşanmadı.</li>"}</ol></section>`;
}
export function assistHint(target, key) {
  if (target !== "match" || typeof assistantAdvice !== "function") return "";
  const a = assistantAdvice().tactics?.[key];
  return a ? `<button type="button" class="assist" data-assist="${key}" title="${escapeHTML(a.reason)}" data-action="applyAssistantAdvice" data-value="${escapeHTML(a.value)}">💡 ${a.value}<small>${escapeHTML(a.reason)}</small></button>` : "";
}
export function assistTeamHint(target, key) {
  if (target !== "match" || typeof assistantAdvice !== "function") return "";
  const a = assistantAdvice().team?.[key];
  return a ? `<button type="button" class="assist" data-assist="${key}" title="${escapeHTML(a.reason)}" data-action="applyAssistantAdvice">💡<small>${escapeHTML(a.reason)}</small></button>` : "";
}
// Tapping a recommendation is the user's own action: it selects exactly that control's option.
export function applyAssistantAdvice(key, value) {
  if (!M || M.finished) return;
  if (MATCH_TACTICS[key]) { setMatchTactic(key, value); return; }
  if (TEAM_ORDERS[key] && value === true && !M.teamInstructions?.includes(key)) toggleTeamOrder(key, "match");
}
export function tacticsControls(target = "match") {
  const plan = target === "match" ? M : S.plan;
  return `<div class="tacticfields">${Object.entries(MATCH_TACTICS).map(([key, values]) => `<label>${TACTIC_LABELS[key]}<select aria-label="${TACTIC_LABELS[key]}" data-action="${target === 'match' ? 'setMatchTactic' : 'setCareerTactic'}" data-key="${key}">${values.map(value => `<option${plan[key] === value ? ' selected' : ''}>${value}</option>`).join("")}</select>${assistHint(target, key)}</label>`).join("")}</div><h3>Takım Talimatları</h3><div class="teamorders">${Object.entries(TEAM_ORDERS).map(([key, label]) => `<button class="${plan.teamInstructions?.includes(key) ? 'selected' : 'secondary'}" aria-pressed="${!!plan.teamInstructions?.includes(key)}" data-action="toggleTeamOrder" data-key="${key}" data-scope="${target}">${label}</button>${assistTeamHint(target, key)}`).join("")}</div>`;
}
export function setCareerTactic(key, value) {
  if (!MATCH_TACTICS[key]?.includes(value)) return;
  S.plan[key] = value; S.v71.lastTacticWeek = S.week; save(); changed();
}
export function setMatchTactic(key, value) {
  if (!M || M.finished || !MATCH_TACTICS[key]?.includes(value)) return;
  if (M[key] === value) return;
  if (!M.pause) { M.pause = true; M.reason = 'manual'; }
  M[key] = value;
  M.tacticChanges.push({ minute: M.min, key, value });
  const descriptions={mentality:{Cesur:'bütün hatlarıyla ileri çıkıyor',Temkinli:'daha kompakt savunmaya yerleşiyor'},press:{Yüksek:'önde baskıya geçti',Düşük:'presi düşürüp blok halinde bekliyor'},tempo:{Yüksek:'oyunu hızlandırıyor',Düşük:'pas temposunu düşürüyor'},line:{Önde:'savunma çizgisini ileri taşıyor',Geride:'savunmayı geriye çekiyor'}};
  matchEvent("tactic", `🧠 ${M.min}' ${matchTeamName('user')} ${descriptions[key]?.[value] || `${TACTIC_LABELS[key]}: ${value}`}.`,{key,value});
  save(); changed();
}
export function toggleTeamOrder(key, target) {
  if (!TEAM_ORDERS[key]) return;
  const plan = target === "match" ? M : S.plan;
  if (!plan || (target === "match" && M.finished)) return;
  if (target === "match" && !M.pause) { M.pause = true; M.reason = 'manual'; }
  plan.teamInstructions ??= [];
  plan.teamInstructions = plan.teamInstructions.includes(key) ? plan.teamInstructions.filter(x => x !== key) : [...plan.teamInstructions, key];
  if (target === "match") matchEvent("tactic", `🧠 ${M.min}' ${TEAM_ORDERS[key]}: ${plan.teamInstructions.includes(key) ? 'açık' : 'kapalı'}.`);
  else S.v71.lastTacticWeek = S.week;
  save(); changed();
}
export function switchMatchTab(tab) {
  if (!M || !["details", "pitch", "stats", "tactics"].includes(tab)) return;
  M.activeTab = tab;
  if (tab === 'tactics' && !M.pause && !M.finished) { M.pause = true; M.reason = 'manual'; }
  changed();
}
export function beginMatchOverlay() { if (M && !M.finished) { if(livePresentationPending())presentation.live3d.setTerminalPaused(true);else{M.pause = true; M.reason ||= 'manual';} resetLiveFrame(); save(); } }
export function closeMatchOverlay() {
  if (M) delete M.uiOverlay;
  changed();
}
/* Refactor C2: the match controls this file draws */
defineActions({
  applyAssistantAdvice: d => applyAssistantAdvice(d.assist, d.value ?? true),
  setMatchTactic: (d, el) => setMatchTactic(d.key, el.value),
  setCareerTactic: (d, el) => setCareerTactic(d.key, el.value),
  toggleTeamOrder: d => toggleTeamOrder(d.key, d.scope),
  switchMatchTab: d => switchMatchTab(d.key),
  closeMatchOverlay: () => closeMatchOverlay(),
});
export function matchOrderOptions(p,role){
 const items={balanced:["Dengeli","Mevcut rolünü koru."],runBehind:["Savunma arkasına koş","Hızına göre boşluğa koş; yorgunluk artar."],holdUp:["Topu sakla","Fiziğinle pas bağlantısını koru."],box:["Ceza sahasında kal","Bitiriş pozisyonlarını daha sık ara."],shoot:["Daha fazla şut","Şut tercihini artır."],press:["Presi artır","Top kazanma isteği ve yorgunluk artar."],creator:["Merkeze yaklaş","Pas bağlantılarını güçlendir."],riskPass:["Daha riskli pas","Fırsat kalitesini artır; pas kaybı riski yükselir."],free:["Serbest rol","Hatlar arasında boşluk ara."],wide:["Geniş oyna","Kanatta bire bir ara."],inside:["İçe kat et","Bitiriş bölgesine yaklaş."],overlap:["Bindirme yap","Hücuma destek ver; arkanda alan bırakabilirsin."],stay:["Geride kal","Savunma güvenliğini koru."],step:["Öne çık","Rakibi erken karşıla."],shortGK:["Kısa kullan","Pasla çıkışı artır."],longGK:["Uzun kullan","Hızlı hücuma çık; pas isabeti azalabilir."],sweeper:["Süpürücü kaleci","Öndeki savunmanın arkasını kapat."]};
 const keys=role==='GK'?['shortGK','longGK','sweeper']:role==='ST'?['runBehind','holdUp','shoot','press']:role==='CAM'?['creator','riskPass','free','shoot']:role==='CM'?['creator','riskPass','stay','press']:['LW','RW'].includes(role)?['wide','inside','runBehind','press']:['LB','RB'].includes(role)?['overlap','stay','press']:['stay','step','press'];
 return ['balanced',...keys].map(key=>({key,label:items[key][0],desc:items[key][1]}));
}
