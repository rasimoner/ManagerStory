/* The league (refactor D2-D3): the clubs a season is played between, the double round-robin fixture list,
   this round's fixture and opponent, the other games of a round and the table they make. Every mode plays
   the same league; which club is the player's is managedClubName() (core/clubs). */
import { CLUB_DATA } from '../../data/clubs.js';
import { managedClubName } from '../clubs/clubs.js';
import { S } from '../state.js';
// the clubs we play against, as rows the engine reads by position: [name, level, style, attack, midfield, defence,
// keeper, pressing, physical, description] (data/clubs.js)
export const OPP=CLUB_DATA.clubs.filter(c=>c.team).map(({name,team:t})=>[name,t.level,t.style,t.attack,t.midfield,t.defence,t.keeper,t.pressing,t.physical,t.description]);
export function allTeams(club=managedClubName()){return [club,...OPP.map(x=>x[0])]}
export function makeLeagueSchedule(){let teams=allTeams(),arr=[...teams],rounds=[];for(let r=0;r<17;r++){let games=[];for(let i=0;i<9;i++){let a=arr[i],b=arr[17-i],flip=(r+i)%2==1;games.push({home:flip?b:a,away:flip?a:b,played:false,hg:null,ag:null})}rounds.push(games);arr=[arr[0],arr[17],...arr.slice(1,17)]}let second=rounds.map(g=>g.map(x=>({home:x.away,away:x.home,played:false,hg:null,ag:null})));return rounds.concat(second)}
export function ensureLeague(){if(!S.leagueSchedule||S.leagueSchedule.length!=34)S.leagueSchedule=makeLeagueSchedule();if(!S.form)S.form={};allTeams().forEach(n=>{if(!S.form[n])S.form[n]=[]})}
export function currentFixture(){ensureLeague();let g=S.leagueSchedule[S.fixture%34],x=g.find(m=>m.home==managedClubName()||m.away==managedClubName());return {opp:OPP.findIndex(o=>o[0]==(x.home==managedClubName()?x.away:x.home)),home:x.home==managedClubName(),game:x}}
