/* V7.9.5 player profiles — one generator for every player in the game: our squad, the league's squads,
   the transfer market, the academy and the wonderkids.

   A player = his position's shape + his playing type + a little personal noise (+ for hand-made players,
   their own hand-set numbers kept as a fixed offset), anchored so that the position's key attributes
   average his overall. Growth re-derives the profile at the new overall, so a dribbler grows into a
   better dribbler and his new skill moves unlock by themselves; training focus adds a capped bonus on
   top. Nothing here draws match randomness: every profile comes from its own seed. */
// the tables a profile is built from live in data/players.js; the training cap in data/balance.js
const PROFILE_ATTRS = PLAYER_DATA.attributes;
const POSITION_SHAPE = PLAYER_DATA.positionShape;   // a typical player of the position, as offsets from his overall
const POSITION_KEYS = PLAYER_DATA.positionKeys;     // the attributes a position is judged by
const PLAYER_TYPES = PLAYER_DATA.types;
const POSITION_TYPES = PLAYER_DATA.positionTypes;   // which types a position can have, with weights
const WONDER_TYPES = PLAYER_DATA.wonderTypes;       // a wonderkid: the dribbler, the playmaker or the goalscorer
const TRAINING_FOCUS = PLAYER_DATA.trainingFocus;   // what a player works on, and which attributes it builds
const TRAINING_CAP = BALANCE.training.cap;

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
