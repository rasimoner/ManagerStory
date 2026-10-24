/* V7.9.5 player profiles — one generator for every player in the game: our squad, the league's squads,
   the transfer market, the academy and the wonderkids.

   A player = his position's shape + his playing type + a little personal noise (+ for hand-made players,
   their own hand-set numbers kept as a fixed offset), anchored so that the position's key attributes
   average his overall. Growth re-derives the profile at the new overall, so a dribbler grows into a
   better dribbler and his new skill moves unlock by themselves; training focus adds a capped bonus on
   top. Nothing here draws match randomness: every profile comes from its own seed. */
const PROFILE_ATTRS = ['pace', 'acceleration', 'finishing', 'passing', 'dribbling', 'technique', 'vision',
  'composure', 'tackling', 'positioning', 'offBall', 'strength', 'stamina'];
// a typical player of the position, as offsets from his overall
const POSITION_SHAPE = {
  GK: { pace: -18, acceleration: -12, finishing: -45, passing: -12, dribbling: -30, technique: -20, vision: -10, composure: 4, tackling: -35, positioning: 6, offBall: -35, strength: 2, stamina: -6 },
  CB: { pace: -6, acceleration: -8, finishing: -28, passing: -8, dribbling: -16, technique: -12, vision: -10, composure: 0, tackling: 8, positioning: 7, offBall: -18, strength: 8, stamina: -2 },
  FB: { pace: 5, acceleration: 4, finishing: -24, passing: -3, dribbling: -4, technique: -5, vision: -6, composure: -3, tackling: 4, positioning: 2, offBall: -6, strength: -2, stamina: 6 },
  CM: { pace: -3, acceleration: -2, finishing: -10, passing: 5, dribbling: 0, technique: 2, vision: 4, composure: 2, tackling: -2, positioning: 1, offBall: -2, strength: -1, stamina: 6 },
  CAM: { pace: 0, acceleration: 2, finishing: -2, passing: 5, dribbling: 5, technique: 6, vision: 7, composure: 2, tackling: -18, positioning: -6, offBall: 4, strength: -7, stamina: 0 },
  W: { pace: 9, acceleration: 8, finishing: -3, passing: -2, dribbling: 6, technique: 2, vision: -2, composure: -3, tackling: -24, positioning: -10, offBall: 5, strength: -8, stamina: 2 },
  ST: { pace: 3, acceleration: 3, finishing: 8, passing: -8, dribbling: 0, technique: -1, vision: -6, composure: 3, tackling: -28, positioning: -10, offBall: 8, strength: 3, stamina: -1 },
};
// the attributes a position is judged by: their average is the player's overall (plus the shape's own lean)
const POSITION_KEYS = {
  GK: ['positioning', 'composure'],
  CB: ['tackling', 'positioning', 'strength', 'composure'],
  FB: ['tackling', 'pace', 'stamina', 'positioning', 'passing'],
  CM: ['passing', 'vision', 'technique', 'stamina', 'tackling'],
  CAM: ['passing', 'vision', 'technique', 'dribbling', 'finishing'],
  W: ['pace', 'dribbling', 'technique', 'finishing', 'offBall'],
  ST: ['finishing', 'offBall', 'composure', 'strength', 'pace'],
};
const PLAYER_TYPES = {
  dribbler: { label: 'Çalımcı', d: { dribbling: 10, technique: 8, acceleration: 5, pace: 2, composure: 2, strength: -8, tackling: -4, finishing: -2 } },
  speedster: { label: 'Hızlı', d: { pace: 10, acceleration: 9, dribbling: 3, technique: -3, strength: -4, composure: -4 } },
  finisher: { label: 'Golcü', d: { finishing: 10, offBall: 7, composure: 6, dribbling: -4, passing: -5, vision: -4 } },
  target: { label: 'Hedef forvet', d: { strength: 12, finishing: 4, pace: -8, acceleration: -8, dribbling: -7, technique: -3 } },
  playmaker: { label: 'Oyun kurucu', d: { vision: 10, passing: 9, technique: 6, composure: 3, tackling: -6, strength: -5, pace: -3 } },
  boxToBox: { label: 'Box-to-box', d: { stamina: 10, tackling: 5, strength: 4, offBall: 3, technique: -4, vision: -3 } },
  destroyer: { label: 'Top kesici', d: { tackling: 10, positioning: 7, strength: 5, dribbling: -7, technique: -5, vision: -4 } },
  stopper: { label: 'Stoper', d: { strength: 8, tackling: 5, positioning: 3, pace: -5, passing: -5, dribbling: -4 } },
  ballPlayer: { label: 'Oyun kuran stoper', d: { passing: 8, composure: 7, vision: 5, strength: -3, tackling: -2 } },
  wingBack: { label: 'Bindiren bek', d: { pace: 6, stamina: 7, dribbling: 5, passing: 3, tackling: -4, positioning: -4 } },
  keeper: { label: 'Kaleci', d: {} },
  sweeperKeeper: { label: 'Libero kaleci', d: { passing: 10, acceleration: 6, composure: 4 } },
};
// which types a position can have, with weights
const POSITION_TYPES = {
  GK: [['keeper', 3], ['sweeperKeeper', 1]],
  CB: [['stopper', 3], ['ballPlayer', 2], ['destroyer', 1]],
  FB: [['wingBack', 3], ['speedster', 1], ['destroyer', 1]],
  CM: [['playmaker', 2], ['boxToBox', 3], ['destroyer', 2]],
  CAM: [['playmaker', 2], ['dribbler', 2]],
  W: [['dribbler', 3], ['speedster', 3], ['finisher', 1]],
  ST: [['finisher', 3], ['target', 2], ['speedster', 1], ['dribbler', 1]],
};
// a wonderkid is one of three: the Ronaldinho/Neymar dribbler, the playmaker, the goalscorer
const WONDER_TYPES = { W: 'dribbler', CAM: 'dribbler', ST: 'finisher', CM: 'playmaker', FB: 'wingBack', CB: 'ballPlayer', GK: 'sweeperKeeper' };
// training focus: what a player works on, and which attributes it builds (capped, on top of his profile)
const TRAINING_FOCUS = {
  dribbling: { label: 'Çalım', attrs: ['dribbling', 'technique'] },
  passing: { label: 'Pas ve oyun görüşü', attrs: ['passing', 'vision'] },
  finishing: { label: 'Bitiricilik', attrs: ['finishing', 'composure'] },
  physical: { label: 'Fizik ve hız', attrs: ['pace', 'acceleration', 'strength'] },
  defending: { label: 'Savunma', attrs: ['tackling', 'positioning'] },
};
const TRAINING_CAP = 8;

function profilePositionGroup(pos) {
  const p = String(pos || 'CM').split('/')[0].toUpperCase();
  if (p === 'GK') return 'GK';
  if (p === 'CB') return 'CB';
  if (['LB', 'RB', 'LWB', 'RWB'].includes(p)) return 'FB';
  if (p === 'CAM') return 'CAM';
  if (['LW', 'RW', 'LM', 'RM'].includes(p)) return 'W';
  if (['ST', 'CF'].includes(p)) return 'ST';
  return 'CM';
}
function pickPlayerType(pos, rnd) {
  const list = POSITION_TYPES[profilePositionGroup(pos)];
  const total = list.reduce((n, x) => n + x[1], 0);
  let r = rnd() * total;
  for (const [type, w] of list) { if ((r -= w) < 0) return type; }
  return list[0][0];
}
// the profile itself: pure, from the player's position, overall, age, type and seed
function playerProfile({ pos, overall, age = 24, type, seed = 1, special = false }) {
  const group = profilePositionGroup(pos), shape = POSITION_SHAPE[group], keys = POSITION_KEYS[group];
  const kind = PLAYER_TYPES[type] ? type : POSITION_TYPES[group][0][0];
  const rnd = R(0x51ed + (seed >>> 0) * 2654435761);
  const ovr = Number.isFinite(overall) ? overall : 65, a = {};
  for (const n of PROFILE_ATTRS) {
    let v = ovr + shape[n] + (PLAYER_TYPES[kind].d[n] || 0) + (rnd() + rnd() - 1) * 8;
    // age: a teenager is still light and raw, a veteran has lost a yard but reads the game
    if (age <= 19) v += { strength: -6, composure: -4, stamina: -2, technique: -3, dribbling: -2, positioning: -3 }[n] || 0;
    else if (age <= 21) v += { strength: -3, composure: -2, positioning: -1 }[n] || 0;
    if (age >= 30) v += { pace: -(age - 29) * 1.6, acceleration: -(age - 29) * 1.8, stamina: -(age - 29), composure: 3, positioning: 3, vision: 2 }[n] || 0;
    if (special && kind === 'dribbler') v += { dribbling: 4, technique: 4, acceleration: 2 }[n] || 0;
    if (special && kind === 'playmaker') v += { vision: 4, passing: 3, technique: 3 }[n] || 0;
    if (special && kind === 'finisher') v += { finishing: 4, composure: 3, offBall: 3 }[n] || 0;
    a[n] = v;
  }
  // anchor: the key attributes average the overall plus the position's own lean
  const lean = keys.reduce((s, n) => s + shape[n], 0) / keys.length;
  const now = keys.reduce((s, n) => s + a[n], 0) / keys.length;
  const shift = ovr + lean - now;
  for (const n of PROFILE_ATTRS) a[n] = Math.round(Math.max(20, Math.min(97, a[n] + shift)));
  const gk = group === 'GK' ? {
    reflexes: Math.round(Math.max(30, Math.min(97, ovr + 3 + (rnd() - .5) * 8))),
    handling: Math.round(Math.max(30, Math.min(97, ovr + (rnd() - .5) * 8))),
    oneOnOne: Math.round(Math.max(30, Math.min(97, ovr + (kind === 'sweeperKeeper' ? 3 : 0) + (rnd() - .5) * 8))),
  } : null;
  return { type: kind, attrs: a, gk };
}
// write a profile's numbers onto a player record, under the field names every part of the game reads
function writeProfileAttributes(p, attrs, gk) {
  for (const n of PROFILE_ATTRS) p[n] = attrs[n];
  p.defending = attrs.tackling; p.physical = attrs.strength; p.shooting = attrs.finishing;
  p.gk = gk || null;
}
function profileOf(p) {
  const pos = p.pos || p.position, prof = p.profile;
  const base = playerProfile({ pos, overall: p.overall, age: p.age, type: prof.type, seed: prof.seed, special: !!prof.special });
  for (const n of PROFILE_ATTRS) {
    base.attrs[n] += (prof.adj?.[n] || 0) + Math.round(prof.trained?.[n] || 0);
    base.attrs[n] = Math.max(20, Math.min(99, Math.round(base.attrs[n])));
  }
  return base;
}
// re-derive a player's numbers from his profile (after his overall, age or training changed)
function refreshPlayerProfile(p) {
  if (!p?.profile) return p;
  const { attrs, gk } = profileOf(p);
  writeProfileAttributes(p, attrs, gk);
  return p;
}
// give a player a profile. `keep`: his hand-set numbers stay exactly as they are, as a fixed offset
// (our own squad, the hand-picked market); without it everything is generated (league, academy, market)
function assignPlayerProfile(p, { seed, type, special = false, keep = false } = {}) {
  const pos = p.pos || p.position, s = (seed ?? hashProfileSeed(`${p.id}|${p.name}|${pos}`)) >>> 0;
  const rnd = R(s ^ 0x9e3779b9);
  const kind = type || (keep ? bestProfileType(p, s) : pickPlayerType(pos, rnd));
  p.profile = { v: 1, type: kind, seed: s, special: !!special, adj: {}, trained: {} };
  if (keep) {
    const gen = playerProfile({ pos, overall: p.overall, age: p.age, type: kind, seed: s, special }).attrs;
    const own = handSetAttributes(p);
    for (const n in own) p.profile.adj[n] = own[n] - gen[n];
  }
  return refreshPlayerProfile(p);
}
function handSetAttributes(p) {
  const own = {}, num = v => Number.isFinite(+v) && v !== null && v !== '' ? +v : null;
  const map = { pace: 'pace', finishing: p.finishing != null ? 'finishing' : 'shooting', passing: 'passing', dribbling: 'dribbling',
    tackling: p.tackling != null ? 'tackling' : 'defending', strength: p.strength != null ? 'strength' : 'physical', stamina: 'stamina',
    acceleration: 'acceleration', technique: 'technique', vision: 'vision', composure: 'composure', positioning: 'positioning', offBall: 'offBall' };
  for (const [n, field] of Object.entries(map)) { const v = num(p[field]); if (v != null) own[n] = v; }
  return own;
}
// the type whose shape is closest to a hand-made player's own numbers
function bestProfileType(p, seed) {
  const pos = p.pos || p.position, own = handSetAttributes(p);
  let best = null, err = Infinity;
  for (const [type] of POSITION_TYPES[profilePositionGroup(pos)]) {
    const gen = playerProfile({ pos, overall: p.overall, age: p.age, type, seed }).attrs;
    const e = Object.keys(own).reduce((s, n) => s + (own[n] - gen[n]) ** 2, 0);
    if (e < err) { err = e; best = type; }
  }
  return best;
}
function hashProfileSeed(text) {
  let h = 2166136261;
  for (const ch of String(text)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
// one week of training focus: young players learn fastest; returns true if anything changed
function trainFocusWeek(p) {
  const f = TRAINING_FOCUS[p?.focus];
  if (!f || !p.profile) return false;
  const rate = p.age <= 21 ? .45 : p.age <= 25 ? .3 : p.age <= 29 ? .18 : .1;
  let changed = false;
  for (const n of f.attrs) {
    const was = p.profile.trained[n] || 0, now = Math.min(TRAINING_CAP, was + rate);
    if (now !== was) { p.profile.trained[n] = +now.toFixed(2); changed = true; }
  }
  if (changed) refreshPlayerProfile(p);
  return changed;
}
function playerTypeLabel(p) { return PLAYER_TYPES[p?.profile?.type]?.label || ''; }
