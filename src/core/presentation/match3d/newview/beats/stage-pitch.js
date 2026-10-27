// The staged pitch of a special move shown outside a match: engine percentages for a place on it, who keeps
// goal for a side, a side's outfield players, and the event a staged pass or shot stands for (none: -1).
export const noEvent = () => ({ eventId: -1 });
export const pitchPercent = w => [(w.x / 105 + 0.5) * 100, (w.z / 68 + 0.5) * 100];
export const keeperOf = (rt, side) => rt.players.find(q => q.side === side && q.role === 'GK' && !q.offPitch);
export const outfieldOf = (rt, side) => rt.players.filter(q => q.side === side && q.role !== 'GK' && !q.offPitch);
export const otherSide = side => (side === 'user' ? 'opp' : 'user');
