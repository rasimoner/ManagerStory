/* A player's special moves (refactor D5): their names (data/moves.js) and the ones a player has unlocked now,
   as the engine reads them from his attributes and type. Shared by every mode: the season end reports the
   moves a summer unlocked, the manager's screens list them. */
import { skillMoves } from '../engine/pitch-v731.js';
import { MOVE_DATA } from '../../data/moves.js';
// the moves a player has now (for noticing new ones as he grows)
export function movesNow(p){try{return typeof skillMoves==='function'?skillMoves(p.id,'user').moves:[]}catch(e){return []}}
// V7.9: a player's skill stars and the special moves he can show in a match (pitch-v731 skillMoves)
export const SKILL_NAMES=Object.fromEntries(MOVE_DATA.moves.map(m=>[m.id,m.name]));
