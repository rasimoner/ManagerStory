/* What a match means for the manager's career (refactor D4). The engine plays the match and says what
   happens: its event log (each event reaches here as it is made, through the 'matchEvent' hook) and each
   minute a player of the user's team spends on the pitch (minutePlayed). This file writes the career's side
   of it, at that same moment: a player's season minutes, goals and cards, the morale and form a goal brings,
   the morale of a first professional match. The engine keeps what it reads back during the match itself:
   fitness and an injury. main.js connects both. */
import { M } from '../../core/state.js';
import { userSquad } from '../../core/engine/user-team.js';
import { userSide } from '../../core/engine/match-support.js';

const squadPlayer = id => userSquad().find(x => x.id === id);

// one more minute of his season
export function recordMinutePlayed(p) { p.minutes++; }

export function recordMatchEvent(type, _text, data) {
  if (type === 'goal') {
    // the event names the scorer only when he is ours
    const p = data.playerId == null ? null : squadPlayer(data.playerId);
    if (p) { p.goals = (p.goals || 0) + 1; p.morale = Math.min(100, p.morale + 2); p.form = Math.min(100, p.form + 2); }
  } else if (type === 'debut') {
    const p = squadPlayer(data.playerId);
    if (p) { p.debutDone = true; p.morale = Math.min(100, p.morale + 5); }
  } else if (type === 'yellow' || type === 'red') {
    if (data.side !== userSide()) return;
    const p = squadPlayer(data.playerId);
    if (!p) return;
    // a red for a second yellow is a yellow too (the match counts his yellows; a straight red is not one)
    if (type === 'yellow' || M.yellowByPlayer[data.playerId] >= 2) p.yellow++;
    if (type === 'red') p.red++;
  }
}
