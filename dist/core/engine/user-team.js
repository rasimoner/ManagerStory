/* Which team in a match is the user's (refactor D4). The engine never assumes it is the club the career
   manages: it asks here, for the club (whose fixture and opponent this is) and for the players it puts on
   the pitch for that side. A mode says which team is the user's with setUserTeam; until one does, it is
   what the game has always played: the managed club (managedClubName) with the career's squad (S.players).
   A player-career mode would point it at the club its player plays for. */
import { S } from '../state.js?v=7.11.0';
import { managedClubName } from '../clubs/clubs.js?v=7.11.0';
import { currentOpponent } from '../league/league.js?v=7.11.0';

const MANAGED = { club: () => managedClubName(), squad: () => S.players };
let team = MANAGED;

// setUserTeam({ club: () => name, squad: () => players }); either may be left out; setUserTeam() resets
export function setUserTeam(next = {}) { team = { ...MANAGED, ...next }; }
export function userClub() { return team.club(); }
export function userSquad() { return team.squad(); }
// the rival the user's team plays in this round
export function userOpponent() { return currentOpponent(userClub()); }
