/* The special moves' names (refactor E1): move id → name (data/moves.js). Values from the data alone: no game
   module is imported, so it is ready whichever module of an import cycle runs first. */
import { MOVE_DATA } from '../../data/moves.js?v=7.12.0';
export const SKILL_NAMES=Object.fromEntries(MOVE_DATA.moves.map(m=>[m.id,m.name]));
