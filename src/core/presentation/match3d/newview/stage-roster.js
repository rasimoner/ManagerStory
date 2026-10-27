// The little stage a special move is shown on outside a match (the star transfer scene, "İzle"): the star,
// one team-mate, one opponent and the keepers, standing where the director's stage() expects them.
const roleOf = pos => { const r = String(pos || '').split('/')[0]; return ['GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST', 'CF'].includes(r) ? r : 'CAM'; };

// the roster of the little stage: who stands where (engine percentages) before the move is set up
export function stageRoster(player, move) {
  const star = { id: player.id, name: player.name, role: player.keeper ? 'GK' : roleOf(player.pos), no: player.no, moves: [move], stars: 5 };
  const user = player.keeper
    ? [star, { id: 990101, name: 'Takım arkadaşı', role: 'CB', no: 4, moves: [] }, { id: 990102, name: 'Takım arkadaşı', role: 'CM', no: 8, moves: [] }]
    : [star, { id: 990101, name: 'Takım arkadaşı', role: 'CM', no: 8, moves: [] }, { id: 990102, name: 'Kaleci', role: 'GK', no: 1, moves: [] }];
  const opp = player.keeper
    ? [{ id: 'st1', name: 'Rakip', role: 'ST', moves: [] }, { id: 'st2', name: 'Rakip', role: 'CB', moves: [] }, { id: 'st3', name: 'Rakip kaleci', role: 'GK', moves: [] }]
    : [{ id: 'st1', name: 'Rakip', role: 'CB', moves: [] }, { id: 'st2', name: 'Rakip', role: 'CM', moves: [] }, { id: 'st3', name: 'Rakip kaleci', role: 'GK', moves: [] }];
  const home = { GK: [5, 50], CB: [30, 45], CM: [44, 38], CAM: [55, 55], ST: [62, 52] };
  const at = (r, side) => {
    if (r.role === 'GK') return side === 'user' ? [4, 50] : [96, 50];
    if (r === star) return [52, 56];
    if (side === 'opp') return r.role === 'CB' ? [72, 50] : [60, 30];
    return home[r.role] || [44, 40];
  };
  const pl = [...user.map(r => [r.id, 'user', at(r, 'user')]), ...opp.map(r => [r.id, 'opp', at(r, 'opp')])];
  return { user, opp, snaps: [{ n: 1, pl, ball: [50, 50] }] };
}
