/* What goes into the manager's highlight archive (core/highlights.js keeps the recipes and the rule for the best
   ones; this file says when a moment is one): a big signing's show (star-transfer.js), a special move or a star
   save of one of ours in a 3D match (core says so through the starMoment hook), and a move a player has just
   learnt, in the week (evolvePlayers) or over the summer (the movesLearned hook). main.js installs it. */
import { S, M } from '../../core/state.js';
import { onHook } from '../../core/hooks.js';
import { pushInbox } from '../../core/inbox.js';
import { addHighlight, isKeeperSave } from '../../core/highlights.js';
import { SKILL_NAMES } from '../../core/players/move-names.js';
import { ensureHighlights, starShowRating } from './star-transfer.js';

// a moment outside a match is staged with the scene's own default
const NO_EVENT = -1;

const when = () => ({ season: S.season || '2025/26', week: S.week });
const opponentName = () => (M ? (M.userHome ? M.away : M.home) : undefined);
export function playerPart(p) { return { playerId: p.id, playerName: p.name, pos: p.pos, stars: starShowRating(p).stars }; }

// a special move or a star save of one of ours, as the 3D match showed it
export function recordStarMoment({ move, playerId, seed, minute }) {
  const p = S?.players.find(x => x.id === playerId);
  if (!p) return null;
  const type = isKeeperSave(move) ? 'keeperSave' : 'skillMove';
  return addHighlight(ensureHighlights(), { type, ...playerPart(p), move, ...when(), opponent: opponentName(), minute, seed: seed ?? NO_EVENT });
}

// the moves he has just learnt; returns the first one the archive keeps (or null)
export function recordNewMoves(p, moves) {
  const kept = moves.map(move => addHighlight(ensureHighlights(), { type: 'newMove', ...playerPart(p), move, ...when(), seed: NO_EVENT }));
  return kept.find(Boolean) || null;
}

const moveList = moves => moves.map(m => SKILL_NAMES[m] || m).join(', ');

// a move learnt in training: the staff's note in the inbox carries "▶ İzle" for it
export function announceNewMoves(p, moves) {
  p.newMoves = [...new Set([...(p.newMoves || []), ...moves])];
  const hl = recordNewMoves(p, moves);
  const note = pushInbox('Teknik Ekip', `${p.name} yeni hareket öğrendi`, `${p.name} antrenmanda artık ${moveList(moves)} deniyor. Maçlarda bunu görebiliriz.`, 'player');
  if (hl) note.highlight = hl.id;
  S.history.push(`${p.name} yeni hareket açtı: ${moveList(moves)}.`);
}

export function installHighlightRecorder() {
  onHook('starMoment', recordStarMoment);
  onHook('movesLearned', recordNewMoves);
}
