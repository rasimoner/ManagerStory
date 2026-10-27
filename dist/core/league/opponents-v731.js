/* Stable, locally generated league squads. No match RNG or external data is involved.
   V7.9.5: each player's attributes come from player-profiles.js. */
// V7.9.5: with real profiles a league player is a specialist like ours (before, every attribute sat at his
// overall, which made him artificially strong); the league's level is set by its players' overall instead
import { NAME_DATA } from '../../data/names.js';
import { BALANCE } from '../../data/balance.js';
import { R } from '../random.js';
import { M, S } from '../state.js';
import { assignPlayerProfile, refreshPlayerProfile } from '../players/player-profiles.js';
import { seasonSeedOffset } from '../season/season.js';
import { OPP } from './league.js';
import { opponentsEvolved } from '../hooks.js';
export const LEAGUE_LIFT=BALANCE.league.lift;
export const OPPONENT_ROLES=['GK','LB','CB','CB','RB','CM','CM','LW','CAM','RW','ST','GK','CB','CM','RW','ST'];
export const OPPONENT_FIRST=NAME_DATA.rivals.first;
export const OPPONENT_LAST=NAME_DATA.rivals.last;
export function makeOpponentSquads(){
 const squads={};
 OPP.forEach((team,teamIndex)=>{
  const rng=R(731000+teamIndex*1301),base=team[1];
  squads[team[0]]=OPPONENT_ROLES.map((position,index)=>{
   const age=18+Math.floor(rng()*17),star=index===10&&rng()<.18?5:0;
   const overall=Math.round(Math.max(54,Math.min(84,base+(rng()-.5)*12+star+(index>=11?-4:0))));
   // (the old per-attribute noise draws are still drawn and dropped, so every club keeps the same players:
   //  ages, overalls, potentials and fitness exactly as before V7.9.5)
   const skip=n=>{for(let k=0;k<n;k++)rng()};
   skip(4);const potential=Math.min(90,overall+Math.max(0,27-age)+Math.floor(rng()*5));
   skip(5);const fitness=90+Math.floor(rng()*11);if(position==='GK')skip(3);
   // V7.9.5: every league player has a real profile (position shape + playing type), not noise around his overall
   const p={id:`opp-${teamIndex}-${index}`,name:`${OPPONENT_FIRST[(teamIndex*7+index*3)%24]} ${OPPONENT_LAST[(teamIndex*5+index*7)%24]}`,
    age,position,overall:overall+LEAGUE_LIFT,potential:Math.min(92,potential+LEAGUE_LIFT),fitness,form:68};
   assignPlayerProfile(p,{seed:731000+teamIndex*1301+index*17});
   return p;
  });
 });
 return squads;
}
export function ensureOpponentSquads(){
 S.opponentSquads ??=makeOpponentSquads();
 for(const team of OPP)if(!Array.isArray(S.opponentSquads[team[0]])||S.opponentSquads[team[0]].length<11)
  S.opponentSquads[team[0]]=makeOpponentSquads()[team[0]];
 S.v731 ??={schema:1,lastEvolvedFixture:-1};
 // V7.9.5: a saved league from before profiles keeps its players (age, overall, form) and gets their profiles
 for(const [teamIndex,team] of OPP.entries())for(const [index,p] of S.opponentSquads[team[0]].entries())
  if(!p.profile){p.overall+=LEAGUE_LIFT;p.potential=Math.min(92,(p.potential||p.overall)+LEAGUE_LIFT);assignPlayerProfile(p,{seed:731000+teamIndex*1301+index*17});}
}
export function opponentPlayer(id){
 if(!M||typeof id!=='string'||!/^o\d+$/.test(id))return null;
 const team=M.userHome?M.away:M.home;
 const identity=M.oppLineup?.[id];
 return S.opponentSquads?.[team]?.find(p=>p.id===identity)||S.opponentSquads?.[team]?.[Number(id.slice(1))]||null;
}
export function opponentLineup(name){
 const players=S.opponentSquads[name]||[];
 return Object.fromEntries(Array.from({length:11},(_,index)=>['o'+index,players[index]?.id]));
}
export function evolveOpponentSquads(fixture){
 ensureOpponentSquads();if(S.v731.lastEvolvedFixture>=fixture)return;
 for(const [teamIndex,team] of OPP.entries()){
  for(const [index,p] of S.opponentSquads[team[0]].entries()){
   const rng=R(731700+fixture*721+teamIndex*43+index*7+(typeof seasonSeedOffset==='function'?seasonSeedOffset():0));
   let change=p.age<=23&&rng()<.14?1:p.age>=(p.position==='GK'?34:31)&&rng()<.13?-1:0;
   // V7.9.5: a wonderkid grows like one (his own draw, so nobody else's development changes)
   if(p.profile?.special&&R(731900+fixture*37+index+(typeof seasonSeedOffset==='function'?seasonSeedOffset():0))()<.5)change=1;
   p.overall=Math.max(50,Math.min(p.potential,p.overall+change));
   if(change)refreshPlayerProfile(p);
   p.form=Math.max(40,Math.min(95,p.form+Math.round((rng()-.5)*5)));
   p.fitness=Math.max(60,Math.min(100,p.fitness+(fixture<17?5:7)-Math.floor(rng()*7)));
  }
 }
 S.v731.lastEvolvedFixture=fixture;
 opponentsEvolved();
}
