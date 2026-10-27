/* The career's highlight archive (S.highlights). A highlight is not the scene but the small recipe that plays it
   again outside the match (the 3D view stages the same beat: newview/beats/staging.js):
     { id, type, playerId, playerName, pos, move, stars, season, week, opponent?, minute?, seed, fee?, fromClub? }
   type: starTransfer (a big signing's show), skillMove (a special move in a match), keeperSave (a star save,
   a penalty save or the scorpion in a match), newMove (a move he has just learnt). seed: the event the move
   stands for, which decides what a match decides with it (which way he goes round his man).
   Each player keeps his best moments only: the rule is data (balance.json highlights) and lives in
   bestHighlights. Pure: the mode that records a moment passes the list (core does not know who records). */
import BALANCE from '../data/balance.json';
import MOVE_DATA from '../data/moves.json';

export const HIGHLIGHT_RULES = BALANCE.highlights;
export const HIGHLIGHT_TYPES = Object.keys(HIGHLIGHT_RULES.typeRank);
const FIELDS = ['type', 'playerId', 'playerName', 'pos', 'move', 'stars', 'season', 'week', 'opponent', 'minute', 'seed', 'fee', 'fromClub'];

export const highlightNumber = h => Number(String(h.id).replace(/\D/g, '')) || 0;

// the same moment twice: a move once a match (a week has one), a new move and a big signing once a player
export function sameMoment(a, b) {
  if (a.type !== b.type || a.playerId !== b.playerId) return false;
  if (a.type === 'starTransfer') return true;
  if (a.type === 'newMove') return a.move === b.move;
  return a.move === b.move && a.season === b.season && a.week === b.week;
}

// best first: the type's rank, then his stars, then the newest
export function byRank(a, b) {
  const rank = HIGHLIGHT_RULES.typeRank;
  return (rank[b.type] - rank[a.type]) || (b.stars - a.stars) || (highlightNumber(b) - highlightNumber(a));
}

/* A player's moments worth keeping, best first: by rank, but a move he has not shown yet comes before
   another of one he has (his archive shows his different tricks), up to perPlayer. */
export function bestHighlights(moments) {
  const ranked = [...moments].sort(byRank), shown = new Set(), first = [], rest = [];
  for (const h of ranked) {
    if (shown.has(h.move)) rest.push(h);
    else { shown.add(h.move); first.push(h); }
  }
  return [...first, ...rest].slice(0, HIGHLIGHT_RULES.perPlayer);
}

// only the player's best stay in the list (in place: the list is the career's)
export function keepBestOf(list, playerId) {
  const keep = new Set(bestHighlights(list.filter(h => h.playerId === playerId)));
  for (let i = list.length - 1; i >= 0; i--) if (list[i].playerId === playerId && !keep.has(list[i])) list.splice(i, 1);
}

export function recipeOf(moment, id) {
  const rec = { id };
  for (const key of FIELDS) if (moment[key] !== undefined) rec[key] = moment[key];
  return rec;
}

/* Record a moment in the list; returns what the archive holds for it (the earlier record of the same moment,
   or the new one). It may not be kept: past his best perPlayer it is let go (then: null). */
export function addHighlight(list, moment) {
  if (!HIGHLIGHT_TYPES.includes(moment.type)) throw new Error(`highlight type: ${moment.type}`);
  const old = list.find(h => sameMoment(h, moment));
  if (old) return old;
  const next = list.reduce((m, h) => Math.max(m, highlightNumber(h)), 0) + 1;
  const rec = recipeOf(moment, 'hl' + next);
  list.push(rec);
  keepBestOf(list, rec.playerId);
  return list.includes(rec) ? rec : null;
}

// the archive as shown: newest first, of one player, one type or one season when asked
export function archiveView(list, { playerId, type, season } = {}) {
  return (list || [])
    .filter(h => (playerId == null || h.playerId === playerId) && (!type || h.type === type) && (!season || h.season === season))
    .sort((a, b) => highlightNumber(b) - highlightNumber(a));
}

// a recorded move that is a keeper's save, and the scene that plays a recipe again (data/moves.json)
export const isKeeperSave = move => MOVE_DATA.keeperSaves.includes(move);
export const stageKindFor = h => MOVE_DATA.highlightStage[h.move] ?? h.move;
