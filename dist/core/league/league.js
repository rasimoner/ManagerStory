/* The league (refactor D2-D3): the clubs a season is played between, the double round-robin fixture list,
   this round's fixture and opponent, the other games of a round and the table they make. Every mode plays
   the same league; which club is the player's is managedClubName() (core/clubs). */
import { CLUB_DATA } from '../../data/clubs.js';
import { managedClubName } from '../clubs/clubs.js';
import { S } from '../state.js';
import { R } from '../random.js';
import { seasonSeedOffset } from '../season/season.js';
// the clubs we play against, as rows the engine reads by position: [name, level, style, attack, midfield, defence,
// keeper, pressing, physical, description] (data/clubs.js)
export const OPP=CLUB_DATA.clubs.filter(c=>c.team).map(({name,team:t})=>[name,t.level,t.style,t.attack,t.midfield,t.defence,t.keeper,t.pressing,t.physical,t.description]);
export function allTeams(club=managedClubName()){return [club,...OPP.map(x=>x[0])]}
export function makeLeagueSchedule(){let teams=allTeams(),arr=[...teams],rounds=[];for(let r=0;r<17;r++){let games=[];for(let i=0;i<9;i++){let a=arr[i],b=arr[17-i],flip=(r+i)%2==1;games.push({home:flip?b:a,away:flip?a:b,played:false,hg:null,ag:null})}rounds.push(games);arr=[arr[0],arr[17],...arr.slice(1,17)]}let second=rounds.map(g=>g.map(x=>({home:x.away,away:x.home,played:false,hg:null,ag:null})));return rounds.concat(second)}
export function ensureLeague(){if(!S.leagueSchedule||S.leagueSchedule.length!=34)S.leagueSchedule=makeLeagueSchedule();if(!S.form)S.form={};allTeams().forEach(n=>{if(!S.form[n])S.form[n]=[]})}
export function currentFixture(){ensureLeague();let g=S.leagueSchedule[S.fixture%34],x=g.find(m=>m.home==managedClubName()||m.away==managedClubName());return {opp:OPP.findIndex(o=>o[0]==(x.home==managedClubName()?x.away:x.home)),home:x.home==managedClubName(),game:x}}
export function makeSchedule(club=managedClubName()){return makeLeagueSchedule().map(g=>{let x=g.find(m=>m.home==club||m.away==club);return {opp:OPP.findIndex(o=>o[0]==(x.home==club?x.away:x.home)),home:x.home==club}})}
export function teamProfile(name){if(name==managedClubName())return {atk:72,mid:72,def:70,gk:70,home:3};let r=OPP.find(x=>x[0]==name);return {atk:r[3],mid:r[4],def:r[5],gk:r[6],home:3}}
export function poisson(lambda,rnd){let L=Math.exp(-lambda),k=0,p=1;do{k++;p*=rnd()}while(p>L&&k<8);return k-1}
export function simAIGame(g,week,index){let h=teamProfile(g.home),a=teamProfile(g.away),rnd=R(41000+week*211+index*17+(typeof seasonSeedOffset==='function'?seasonSeedOffset():0)),hf=(S.form[g.home]||[]).slice(-5).reduce((x,y)=>x+(y=="G"?1:y=="M"?-.7:0),0),af=(S.form[g.away]||[]).slice(-5).reduce((x,y)=>x+(y=="G"?1:y=="M"?-.7:0),0);let lh=Math.max(.35,1.22+(h.atk+a.mid-h.def*.15-a.def*.55)/55+h.home/20+hf*.04),la=Math.max(.3,1.08+(a.atk+h.mid-a.def*.15-h.def*.55)/55+af*.04);g.hg=Math.min(6,poisson(lh,rnd));g.ag=Math.min(6,poisson(la,rnd));g.played=true;applyTableGame(g);recordForm(g)}
export function applyTableGame(g){let h=S.table.find(x=>x.n==g.home),a=S.table.find(x=>x.n==g.away);if(!h||!a)return;h.p++;a.p++;h.gf+=g.hg;h.ga+=g.ag;a.gf+=g.ag;a.ga+=g.hg;if(g.hg>g.ag)h.pts+=3;else if(g.ag>g.hg)a.pts+=3;else{h.pts++;a.pts++}}
export function recordForm(g){let hf=g.hg>g.ag?"G":g.hg==g.ag?"B":"M",af=g.ag>g.hg?"G":g.ag==g.hg?"B":"M";S.form[g.home].push(hf);S.form[g.away].push(af)}
export function simulateRoundOthers(){ensureLeague();let games=S.leagueSchedule[S.fixture];games.forEach((g,i)=>{if(!g.played&&g.home!=managedClubName()&&g.away!=managedClubName())simAIGame(g,S.fixture,i)})}
