/* Shirt numbers: every player of a squad wears a number of his own (player.number), within
   data/balance.json shirtNumbers. A player who has left the club (status "Transfer oldu", or removed from
   the list) wears none, so his number is free again. Pure: the squad is passed in. */
import BALANCE from '../../data/balance.json';

const RANGE = BALANCE.shirtNumbers;
// the status of a player sold during the season (core/season SEASON_DEPARTED; not imported, so this module
// stays a leaf that the save migration can use)
const LEFT_THE_CLUB = 'Transfer oldu';

export function wearsShirt(player) { return player.status !== LEFT_THE_CLUB; }

export function isValidShirtNumber(n) { return Number.isInteger(n) && n >= RANGE.lowest && n <= RANGE.highest; }

export function numbersTakenIn(squad, exceptId) {
  return new Set(squad.filter(p => wearsShirt(p) && p.id !== exceptId && isValidShirtNumber(p.number)).map(p => p.number));
}

export function numbersFreeIn(squad, exceptId) {
  const taken = numbersTakenIn(squad, exceptId), free = [];
  for (let n = RANGE.lowest; n <= RANGE.highest; n++) if (!taken.has(n)) free.push(n);
  return free;
}

// the first free number of the wishes, else the lowest free one
export function firstFreeShirtNumber(squad, { exceptId, wishes = [] } = {}) {
  const free = numbersFreeIn(squad, exceptId);
  return wishes.find(n => free.includes(n)) ?? free[0];
}

/* Gives a newcomer a number unless he already wears a free one. The squad may or may not list him yet. */
export function giveShirtNumber(player, squad, wishes = []) {
  if (isValidShirtNumber(player.number) && !numbersTakenIn(squad, player.id).has(player.number)) return player.number;
  player.number = firstFreeShirtNumber(squad, { exceptId: player.id, wishes });
  return player.number;
}

/* Numbers a squad that never had them, keeping what each player was seen wearing: a number he chose, else
   his place in the list (that is what the match showed). Chosen numbers keep their owners, then places; a
   place someone else already wears goes to the lowest free number, and nobody else's number moves. */
export function numberSquadKeepingShown(squad) {
  const players = squad.filter(wearsShirt);
  const shown = new Map(players.map(p => [p, isValidShirtNumber(p.number) ? p.number : squad.indexOf(p) + 1]));
  const chosen = players.filter(p => isValidShirtNumber(p.number));
  const byPlace = players.filter(p => !isValidShirtNumber(p.number));
  const worn = new Set(), clashing = [];
  for (const p of [...chosen, ...byPlace]) {
    const n = shown.get(p);
    if (isValidShirtNumber(n) && !worn.has(n)) { p.number = n; worn.add(n); } else clashing.push(p);
  }
  for (const p of clashing) { delete p.number; giveShirtNumber(p, players); }
}
