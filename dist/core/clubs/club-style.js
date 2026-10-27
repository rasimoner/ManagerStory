/* Each club's colours and crest pattern (refactor E1): name → [primary, secondary, pattern] (data/clubs.js).
   Values from the data alone: no game module is imported, so it is ready whichever module of an import cycle
   runs first. */
import { CLUB_DATA } from '../../data/clubs.js?v=7.12.0';
export const CLUBSTYLE=Object.fromEntries(CLUB_DATA.clubs.map(c=>[c.name,[...c.colors,c.pattern]]));
