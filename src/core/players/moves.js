/* A player's special moves (refactor D5): the ones a player has unlocked now,
   as the engine reads them from his attributes and type. Shared by every mode: the season end reports the
   moves a summer unlocked, the manager's screens list them. */
import { skillMoves } from '../engine/pitch-v731.js';
// the moves a player has now (for noticing new ones as he grows)
export function movesNow(p){try{return typeof skillMoves==='function'?skillMoves(p.id,'user').moves:[]}catch(e){return []}}
