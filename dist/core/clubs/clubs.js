/* Club identity (refactor D2): each club's colours and pattern, its crest, its fans' photo, the club the
   career is with, and the identity (name, colours, crest, stadium) a screen or the match view shows for a
   club. From data/clubs.js; nothing here knows a mode. */
import { CLUB_DATA } from '../../data/clubs.js?v=7.11.0';
import { M, S } from '../state.js?v=7.11.0';
import { OPP, currentFixture } from '../league/league.js?v=7.11.0';
// club colours and crest pattern: name → [primary, secondary, pattern] (data/clubs.js)
export const CLUBSTYLE=Object.fromEntries(CLUB_DATA.clubs.map(c=>[c.name,[...c.colors,c.pattern]]));
export function crest(n,s=42){let c=CLUBSTYLE[n]||["#333","#ddd","v"],bg=c[2]=="h"?`linear-gradient(${c[0]} 0 50%,${c[1]} 50%)`:c[2]=="d"?`linear-gradient(135deg,${c[0]} 0 49%,${c[1]} 50%)`:`linear-gradient(90deg,${c[0]} 0 50%,${c[1]} 50%)`;return `<span class=crest style="width:${s}px;height:${s}px;background:${bg}"><i>${n.split(" ").map(x=>x[0]).join("").slice(0,2)}</i></span>`}
// Presentation identity is resolved from the career or event, never from a second color state.
// the club this career manages: the one name every rule about "us" goes through (S.currentClubId; a new career
// starts with data/clubs.js startingClub). The league is built around it, so it must be a club that is not one of
// the rivals: managing a rival needs the league rebuilt around him (the manager-career feature); until then any
// other id, e.g. from an edited save, falls back to the starting club.
export function managedClubName(){const id=S?.currentClubId;return id&&CLUBSTYLE[id]&&!OPP.some(o=>o[0]===id)?id:CLUB_DATA.startingClub}
export function resolveClubIdentity(context='career',data={}){
 const name=context==='goal'?(data.teamId||data.team):context==='stadium'?(data.homeTeam||M?.home||currentFixture()?.game?.home):context==='awaySupporters'?(data.awayTeam||M?.away):managedClubName();
 const colors=CLUBSTYLE[name]||['#55646b','#d8dedc','v'];
 return {id:name||'neutral',name:name||'Kulüp',primaryColor:colors[0],secondaryColor:colors[1],logo:crest(name||'Kulüp',34),shortName:(name||'Kulüp').split(' ').map(word=>word[0]).join('').slice(0,2),stadium:`${name||'Kulüp'} Stadı`};
}
export function fanPhoto(team){const index=Object.keys(CLUBSTYLE).indexOf(team);return index<0?'assets/atmosphere/fans-neutral.webp':`assets/atmosphere/goal-club-${index}.webp`}
