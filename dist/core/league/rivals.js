/* Who the league's other clubs are (refactor E1): the rows the engine reads each club by, in league order,
   [name, level, style, attack, midfield, defence, keeper, pressing, physical, description] (data/clubs.js); how
   far above its listed level the league plays (difficulty, data/balance.js); the roles a rival squad is built
   from and the names its players get (data/names.js).
   Values from the data alone: this module imports no game module, so it is ready before any module of the
   league ↔ clubs ↔ season import cycle runs, whichever of them a bundle evaluates first. */
import { CLUB_DATA } from '../../data/clubs.js?v=7.12.0';
import { BALANCE } from '../../data/balance.js?v=7.12.0';
import { NAME_DATA } from '../../data/names.js?v=7.12.0';
export const OPP=CLUB_DATA.clubs.filter(c=>c.team).map(({name,team:t})=>[name,t.level,t.style,t.attack,t.midfield,t.defence,t.keeper,t.pressing,t.physical,t.description]);
export const LEAGUE_LIFT=BALANCE.league.lift;
export const OPPONENT_ROLES=['GK','LB','CB','CB','RB','CM','CM','LW','CAM','RW','ST','GK','CB','CM','RW','ST'];
export const OPPONENT_FIRST=NAME_DATA.rivals.first;
export const OPPONENT_LAST=NAME_DATA.rivals.last;
