// Plays a real MatchEngine event log on the pitch runtime.
// The engine decides who does what and where; this file only decides how it looks.
import * as THREE from '../vendor/three/three.module.min.js';
import { V, clamp, toWorld, GOAL_X, BALL_R, MOTIONS } from './runtime.js';
import { ACTIONS } from './actions.js';

const SAY_AT_START = new Set(['ballCarry', 'dribble', 'run', 'kickoff', 'foul', 'yellow', 'red', 'sub', 'injury', 'half', 'end', 'goal']);
const SKIP_TEXT = new Set(['offBallRun', 'press', 'chance', 'restartPlayers', 'restartWait', 'restartPosition', 'firstTouch', 'looseBall']);
const RESTART_LABEL = { CORNER: 'KORNER', GOAL_KICK: 'KALE VURUŞU', THROW_IN: 'TAÇ', FREE_KICK: 'SERBEST VURUŞ', PENALTY: 'PENALTI' };

export function createDirector(rt, data, hooks, opts = {}) {
  const DEBUG = !!opts.debug;
  const { events, snaps, meta } = data;
  const { ball, S } = rt;
  const by = new Map();
  const key = (side, id) => `${side}:${id}`;
  const sideOf = id => typeof id === 'number' ? 'user' : 'opp';
  const P = (id, side) => (id == null ? null : by.get(key(side || sideOf(id), id)));

  // ---- squads from the engine roster ----
  const userClub = meta.teams[meta.userHome ? 'home' : 'away'], oppClub = meta.teams[meta.userHome ? 'away' : 'home'];
  const kitFrom = (club, alt) => ({
    shirt: club.primaryColor, stripe: club.secondaryColor, trim: club.secondaryColor, shorts: alt ? club.primaryColor : club.secondaryColor,
    socks: club.primaryColor, sockTrim: club.secondaryColor, boot: '#15171c', sole: '#f2f2f2', stripes: 0,
    number: '#ffffff', numberEdge: '#111111',
  });
  const userKit = kitFrom(userClub), oppKit = kitFrom(oppClub);
  oppKit.stripes = 1;
  const keeperKit = (shirt, glove) => ({ shirt, stripe: shirt, trim: '#111111', shorts: '#111111', socks: shirt, sockTrim: '#111111', boot: '#15171c', sole: '#f2f2f2', stripes: 0, number: '#111111', numberEdge: '#ffffff', glove });
  const roster = [...meta.user.map((p, i) => ({ ...p, side: 'user', no: p.no ?? i + 1 })), ...meta.opp.map((p, i) => ({ ...p, side: 'opp', no: i + 1 }))];
  function addFromRoster(r) {
    const gk = r.role === 'GK';
    const kit = gk ? (r.side === 'user' ? keeperKit('#ff7a1a', '#f2f2f2') : keeperKit('#7c4dff', '#2a7de1')) : (r.side === 'user' ? userKit : oppKit);
    const p = rt.addPlayer({ key: key(r.side, r.id), id: r.id, side: r.side, team: r.side, name: r.name, role: r.role, no: r.no, kit, keeper: gk, moves: r.moves || [] });
    by.set(key(r.side, r.id), p);
    return p;
  }
  for (const r of roster) addFromRoster(r);
  rt.calibrate();
  const keeperOf = side => rt.players.find(p => p.side === side && p.role === 'GK');

  // ---- engine positions: the snapshot taken right after the tick that produced event i ----
  function snapFor(i) { for (const s of snaps) if (s.n > i) return s; return snaps.at(-1); }
  // the engine gives where everyone stands at the end of each minute; within the minute the shape
  // moves from the last keyframe to the next one as the minute's events are played, instead of
  // everybody heading for where they will be a minute later
  function layout(i, teleport) {
    const s = snapFor(i), k = snaps.indexOf(s), prev = k > 0 ? snaps[k - 1] : null;
    const u = teleport || !prev || s.n <= prev.n ? 1 : clamp((i - prev.n + 1) / (s.n - prev.n), 0, 1);
    const before = new Map(prev ? prev.pl.map(([id, side, pos]) => [side + ':' + id, pos]) : []);
    const mix = (a, b) => (a ? [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u] : b);
    if (s.ball) S.snapBall = toWorld(mix(prev?.ball, s.ball));
    for (const [id, side, pos] of s.pl) {
      const p = P(id, side); if (!p) continue;
      p.home = toWorld(mix(before.get(side + ':' + id), pos));
      if (teleport) { rt.place(p, p.home); faceBall(p); }
    }
    // a restart in progress: players take up the engine's arrangement for it until it is taken
    if (S.restartHomes) for (const p of rt.players) { const q = S.restartHomes[p.side + ':' + p.id]; if (q) p.home = toWorld(q); }
    // a direct free kick: the wall stands shoulder to shoulder and the taker's team-mates keep off the ball (view only)
    if (S.restartHomes && S.fkHomes) for (const p of rt.players) { const w = S.fkHomes[p.side + ':' + p.id]; if (w) p.home = w.clone(); }
  }
  function faceBall(p) { p.heading = Math.atan2(ball.p.x - p.pos.x, ball.p.z - p.pos.z); }
  // stable per-event choice in [0,1): the same match always looks the same
  const pick = (e, salt = 0) => (((e?.eventId ?? 0) * 9301 + 49297 + salt * 7919) % 233280) / 233280;
  const headingOf = (a, b) => Math.atan2(a.x + b.x, a.z + b.z);

  // ---- off-ball movement ----
  // The engine gives positions once a minute (where everyone stands after it, for the ball's
  // position then). In between, the block slides with the ball as it actually moves, so players
  // keep drifting at a walk instead of standing and then all jogging to new spots at once.
  // Speed comes from how far a player has to go: stand, walk, jog, run, sprint, with hysteresis.
  const GAIT = [0, 1.5, 3.3, 5.2, 7.4], GAIT_AT = [0.8, 5, 13, 24];
  const flow = V();
  function gaitFor(p, d, cap = 4) {
    let lvl = 0; while (lvl < 4 && d > GAIT_AT[lvl]) lvl++;
    const cur = p.gait ?? 0;
    if (lvl < cur && d > GAIT_AT[lvl] * 0.7) lvl = cur;          // keep going until clearly there
    p.gait = Math.min(lvl, cap);
    return GAIT[p.gait];
  }
  // The engine spaces every player at least ~3 m from his team-mates, which spreads its wall over
  // 8 m and leaves the fouled player standing by the ball. For the picture: the defenders the engine
  // put in the wall line up shoulder to shoulder 9.15 m out, covering the near post; the taker's
  // team-mates near the ball step out of the line to goal.
  function freeKickHomes(spot, toGoal, taker, arranged) {
    if (!arranged) return null;
    const out = {}, across = V(toGoal.z, 0, -toGoal.x), wall = [];
    for (const p of rt.players) {
      if (p.offPitch || p.role === 'GK' || p === taker) continue;
      const q = arranged[p.side + ':' + p.id]; if (!q) continue;
      const w = toWorld(q), rel = V(w.x - spot.x, 0, w.z - spot.z), al = rel.dot(toGoal), ac = rel.dot(across);
      if (p.side !== taker.side && al > 7 && al < 11.5 && Math.abs(ac) < 6.5) wall.push({ p, ac });
      else if (p.side === taker.side && rel.length() < 6 && al > -2) {
        const side = ac >= 0 ? 1 : -1;
        out[p.side + ':' + p.id] = spot.clone().addScaledVector(toGoal, Math.max(1, al)).addScaledVector(across, side * 5).setY(0);
      }
    }
    wall.sort((a, b) => a.ac - b.ac);
    // the wall covers the near post's side of the goal; the keeper the other half
    const near = Math.sign(spot.z || 1), nearSide = Math.sign(across.z || 1) * near, n = wall.length;
    wall.forEach(({ p }, k) => { out[p.side + ':' + p.id] = spot.clone().addScaledVector(toGoal, 9.4).addScaledVector(across, (k - (n - 1) / 2) * 0.7 + nearSide * 0.5).setY(0); });
    return out;
  }
  function shape() {
    // smoothed ball offset from where it was when the engine took the positions
    if (S.snapBall) {
      const dx = clamp(ball.p.x - S.snapBall.x, -20, 20), dz = clamp(ball.p.z - S.snapBall.z, -16, 16);
      flow.x += (dx - flow.x) * 0.012; flow.z += (dz - flow.z) * 0.012;
    }
    for (const p of rt.players) {
      if (p.busy || p.dive || p.offPitch) continue;
      if (p.runUntil > S.t) continue;
      const gk = p.role === 'GK';
      const fl = S.restartHomes ? 0 : 1;      // a restart arrangement is exact
      const h = (p.home || p.pos).clone().add(V(flow.x * (gk ? 0.12 : 0.45) * fl, 0, flow.z * (gk ? 0.08 : 0.3) * fl));
      // around the ball: the side without it squeezes towards the ball (more across, a little along),
      // the side with it offers short options; the engine's shape stays the base
      if (!gk && !S.restartHomes && !S.dead) {
        const defending = ball.owner ? ball.owner.side !== p.side : false, k = defending ? 0.3 : 0.12;
        h.z += (ball.p.z - h.z) * k; h.x += (ball.p.x - h.x) * k * 0.5;
      }
      // the keeper: when the ball comes within shooting range he leaves the engine's spot and takes
      // up his position on the line between the ball and the middle of his goal, a few metres out
      if (gk && !S.restartHomes && !S.dead && ball.owner !== p) {
        const own = Math.sign(p.home?.x || p.pos.x) * GOAL_X, toBall = V(ball.p.x - own, 0, ball.p.z), dist = toBall.length();
        const w = clamp((42 - dist) / 14, 0, 1);
        if (w > 0 && dist > 0.1) h.lerp(V(own, 0, 0).addScaledVector(toBall.normalize(), clamp(dist * 0.14, 1.2, 5.5)), w);
      }
      // a free kick or corner: the other side keeps 9.15 m from the ball until it is taken
      const R = S.restartSpot;
      if (R && p.side !== R.side && !gk) {
        const off = V(h.x - R.spot.x, 0, h.z - R.spot.z);
        if (off.length() < 9.15) {
          if (off.length() < 0.5) off.set(Math.sign(R.spot.x || 1) * GOAL_X - R.spot.x, 0, -R.spot.z);
          h.copy(R.spot).setY(0).addScaledVector(off.normalize(), 9.4);
        }
      }
      h.x = clamp(h.x, -51, 51); h.z = clamp(h.z, -33, 33);
      const d = h.distanceTo(p.pos);
      p.target.copy(h); p.want = gaitFor(p, d, S.dead ? (S.restartHomes && d > 10 ? 3 : 2) : gk ? 3 : 4); p.face = ball.p; p.faceLock = false;
      if (p.role === 'GK') {
        const own = Math.sign(p.home?.x || p.pos.x) * GOAL_X;
        p.loopsWant.keeperReady = Math.abs(ball.p.x - own) < 30 ? 1 : 0;
      } else p.loopsWant.jockey = 0;
    }
  }

  // ---- small reusable behaviours (generators: one step per frame) ----
  function* wait(sec) { const end = S.t + sec; while (S.t < end) yield; }
  function* until(cond, timeout = 5) { const end = S.t + timeout; while (!cond() && S.t < end) yield; return cond(); }

  // give the ball to p, the way football would: a teammate passes it, otherwise he goes and gets it
  function* ensureOwner(p) {
    if (ball.owner === p) return;
    if (p.motion) yield* until(() => !p.motion, 2.2);      // back on his feet first
    const o = ball.owner;
    if (o && o.side === p.side && o !== p && o.pos.distanceTo(p.pos) > 2.5 && !o.dive) {
      yield* pass(o, p, p.pos.clone(), 'ground', true);
      return;
    }
    p.busy = true;
    const ok = yield* chase(p, null);
    if (!ok) { noteFix(p, 'own'); ball.p.set(p.pos.x + Math.sin(p.heading) * 0.5, BALL_R, p.pos.z + Math.cos(p.heading) * 0.5); ball.v.set(0, 0, 0); ball.owner = p; }
    p.busy = false;
  }

  // go and get the ball for as long as he is still closing in on it (a ball rolling away is chased
  // down, not handed over); gives up only when he has stopped gaining for a while
  function* chase(p, spot) {
    // "stuck" means the gap has not changed for a while (a ball flying on away is still being chased)
    let ref = Infinity, since = S.t, got = false;
    yield* until(() => {
      if (rt.receive(p, spot)) return (got = true);
      const d = Math.hypot(ball.p.x - p.pos.x, ball.p.z - p.pos.z);
      if (d < ref - 0.3 || d > ref + 0.5 || ref === Infinity) { ref = d; since = S.t; }
      return !!ball.held || S.t - since > 2.5;
    }, 12);
    return got;
  }

  // step up to the ball before the kick, so the wind-up only has a short step left to take
  function* approachKick(p, name, dir) {
    if (p.dive) yield* until(() => !p.dive, 3);          // a keeper gets up before he kicks it out
    // however far he is, he gets there (the time it takes is the time it takes): he keeps going
    // while he is still closing in on his plant spot, a little quicker than a rolling ball
    let ref = Infinity, since = S.t;
    yield* until(() => {
      const k = rt.kickNeed(p, name, dir);
      if (k.dist <= k.reach && p.vel.length() < 5.5) return true;     // close enough, and not still flying in
      if (k.dist < ref - 0.2) { ref = k.dist; since = S.t; }
      p.target.copy(k.to); p.want = k.dist > 5 ? 6 : Math.max(3.5, Math.hypot(ball.v.x, ball.v.z) + 2); p.face = null; p.faceLock = false;
      return S.t - since > 2;
    }, 10);
  }

  // approach, then aim from where the ball is now; if the new aim moves the plant spot out of reach
  // (the ball rolled on, or it was played to a spot right next to it), approach again
  function* approachAim(p, name, at) {
    const dir = V();
    for (let i = 0; i < 3; i++) {
      dir.set(at.x - ball.p.x, 0, at.z - ball.p.z);
      yield* approachKick(p, name, dir);
      dir.set(at.x - ball.p.x, 0, at.z - ball.p.z);
      const k = rt.kickNeed(p, name, dir);
      if (k.dist <= k.reach + 0.05) break;
    }
    return dir;
  }

  function* pass(from, to, toW, travel, implicit = false, opts = {}) {
    from.busy = true;
    // settle the ball at the passer's feet first
    if (ball.owner !== from) yield* ensureOwner(from);
    from.busy = true;
    let dir = V(toW.x - ball.p.x, 0, toW.z - ball.p.z);
    const throwIn = opts.throwIn;
    let flight = 0, chest = false, kickT = 0, noLook = false;
    if (throwIn) {
      from.heading = Math.atan2(dir.x, dir.z); from.target.copy(from.pos); from.want = 0;
      rt.startAction(from, 'throwIn'); from.loopsWant.throwHold = 0;
      if (!ball.held) ball.held = rt.pickUp(() => rt.handsOf(from));
      yield* until(() => rt.actionAtContact(from), 2);
      ball.held = null;
      rt.kickAir(V(toW.x, 0.4, toW.z), Math.max(0.6, dir.length() / 13));
    } else {
      // V7.9: a no-look pass — only a player who has it, in the opponents' half, not played backwards
      const fwdX = -Math.sign(ownGoalX(from.side)), len0 = Math.hypot(toW.x - from.pos.x, toW.z - from.pos.z);
      noLook = !!to && !implicit && !opts.restart && !opts.meet && travel === 'ground' && has(from, 'nolook') && zoneOk('nolook', from)
        && (toW.x - from.pos.x) * fwdX > -3 && len0 > 8 && len0 < 30 && pick(opts.ev, 5) < 0.6;
      let name = noLook ? 'nolook' : 'pass';
      dir = yield* approachAim(from, name, toW);
      // could not get set for it (the ball ran on, or it is still bouncing): an ordinary pass instead
      if (noLook) { const k = rt.kickNeed(from, name, dir); if (k.dist > k.reach + 0.05 || ball.p.y > BALL_R + 0.05 || Math.abs(ball.v.y) > 0.5) { noLook = false; name = 'pass'; dir = yield* approachAim(from, name, toW); } }
      rt.startAction(from, name); rt.kickWarp(from, name, dir);
      if (noLook) hooks.slow(0.45);
      yield* until(() => rt.actionAtContact(from), 2);
      kickT = S.t;
      if (noLook) {
        const toe = from.toes[1].getWorldPosition(V());
        noteSkill({ kind: 'nolook', contact: +Math.hypot(toe.x - ball.p.x, toe.z - ball.p.z).toFixed(3), len: +len0.toFixed(1), ...(DEBUG ? { dbg: { toe: toe.toArray().map(v => +v.toFixed(2)), ball: ball.p.toArray().map(v => +v.toFixed(2)), bv: ball.v.toArray().map(v => +v.toFixed(2)), pos: from.pos.toArray().map(v => +v.toFixed(2)), warpTo: from.warp?.to?.toArray().map(v => +v.toFixed(2)), owner: ball.owner?.key, el: +(S.t - from.act?.t0).toFixed(3), act: from.act?.name } } : {}) }, from);
      }
      // V7.9: a long ball dropping onto a man standing under it is taken on the chest
      chest = !!to && !opts.meet && !opts.restart && travel === 'aerial' && to.role !== 'GK' && dir.length() > 22 && dir.length() < 50 && pick(opts.ev, 3) < 0.3
        && to.pos.distanceTo(toW) < 1 + 4 * Math.max(0, dir.length() / 17 - 0.9) && !to.motion && !to.dive;
      if (travel === 'aerial' || dir.length() > 30) { flight = Math.max(0.7, dir.length() / 17); rt.kickAir(V(toW.x, chest ? CHEST_H : (opts.height ?? 0.25), toW.z), flight); }   // a long ball goes in the air
      else rt.kickGround(toW, opts.arrive ?? 4.5, 0.7);     // a played pass reaches its man at a receivable pace
    }
    if (opts.restart) { const outside = () => Math.abs(ball.p.z) > 34 + BALL_R || Math.abs(ball.p.x) > GOAL_X + BALL_R; if (outside()) yield* until(() => !outside(), 0.6); ball.allowOut = false; }      // once the restart is taken (and back over the line) the ball is in play
    from.lastPass = S.t; from.busy = false;
    if (opts.meet) { if (DEBUG) (stats.crossLog ||= []).push({ t: +S.t.toFixed(2), toW: toW.toArray().map(v => +v.toFixed(2)), flight: +flight.toFixed(2), v: ball.v.toArray().map(v => +v.toFixed(2)), p: ball.p.toArray().map(v => +v.toFixed(2)) }); opts.meet(S.t + flight); return; }      // met in the air: the next event plays the contact
    // a ball played into space is contested: the nearest opponent to where it is going sets off after it too
    // (he arrives late — the engine has decided who gets it — but nobody jogs past a ball in play)
    if (to && !opts.throwIn && !opts.meet) {
      const gap = Math.hypot(toW.x - to.pos.x, toW.z - to.pos.z), len = Math.hypot(toW.x - from.pos.x, toW.z - from.pos.z);
      if (gap > 4 || len > 18) {
        const rival = rt.players.filter(q => !q.offPitch && !q.busy && !q.dive && q.side !== from.side && q.role !== 'GK')
          .reduce((m, q) => (!m || q.pos.distanceTo(toW) < m.pos.distanceTo(toW) ? q : m), null);
        if (rival && rival.pos.distanceTo(toW) < 22) { rival.target.copy(toW).setY(0); rival.want = 6.8; rival.gait = 4; rival.runUntil = S.t + Math.min(3, 0.6 + len / 14); rival.face = null; }
      }
    }
    if (!to) { if (noLook) hooks.slow(1); yield* until(() => ball.v.length() < 2 || ball.p.distanceTo(V(toW.x, BALL_R, toW.z)) < 1.5, 4); return; }
    to.busy = true;
    if (chest) yield* chestControl(to, toW, kickT + flight);
    const ok = yield* chase(to, toW);
    if (noLook) hooks.slow(1);
    if (!ok) { noteFix(to, 'pass'); ball.owner = to; ball.p.set(to.pos.x + Math.sin(to.heading) * .5, BALL_R, to.pos.z + Math.cos(to.heading) * .5); ball.v.set(0, 0, 0); }
    to.busy = false;
    if (implicit) stats.implicitPasses++;
  }

  // chest control: he gets under the dropping ball, leans back and lets it come off his chest to his feet
  const CHEST_H = 1.42;
  function* chestControl(p, spot, tArr) {
    const ca = ACTIONS.chest, lead = ca.dur * ca.contact;
    let started = false, best = 9;
    yield* until(() => {
      const left = tArr - S.t;
      // his chest goes where the ball will arrive (a step back from it, so it meets the chest, not the man)
      const bv = V(ball.v.x, 0, ball.v.z), arrive = ball.p.clone().addScaledVector(bv, Math.max(0, left)).setY(0);
      const chestOff = p.bones.Spine2.getWorldPosition(V()).sub(p.pos).setY(0);
      p.target.copy(arrive).sub(chestOff).addScaledVector(bv.normalize(), 0.1);
      const gap = Math.hypot(p.target.x - p.pos.x, p.target.z - p.pos.z);
      p.want = gap > 2 ? 6.5 : gap > 0.08 ? Math.min(3, 1 + gap * 4) : 0; p.face = ball.p; p.faceLock = left < 1.2;
      if (!started && left <= lead) {
        if (gap > 0.6 || p.vel.length() > 2.2) return true;              // not under it in time: he plays it as it comes
        rt.startAction(p, 'chest'); started = true; hooks.slow(0.5); ball.through = tArr + 0.4;    // only the chest plays it
      }
      // the touch: when the ball is at its closest to his chest
      if (started) { const d = p.bones.Spine2.getWorldPosition(V()).distanceTo(ball.p); if (d < best) best = d; else if (S.t > tArr - 0.2 && d > best + 0.02) return true; }
      return started && ball.p.y < 0.6;
    }, tArr - S.t + 0.5);
    if (!started) { p.faceLock = false; return false; }
    const c = p.bones.Spine2.getWorldPosition(V()), audit = { kind: 'chest', contact: +c.distanceTo(ball.p).toFixed(3), h: +ball.p.y.toFixed(2) };
    if (DEBUG) audit.dbg = { c: c.toArray().map(v => +v.toFixed(2)), b: ball.p.toArray().map(v => +v.toFixed(2)), p: p.pos.toArray().map(v => +v.toFixed(2)), spot: spot.toArray().map(v => +v.toFixed(2)), dt: +(S.t - tArr).toFixed(2), v: +p.vel.length().toFixed(2) };
    // cushioned: the ball drops in front of him
    const fw = fwdOf(p);
    ball.v.set(fw.x * 1.0, -0.4, fw.z * 1.0); p.lastTouch = S.t;
    noteSkill(audit, p);
    yield* until(() => ball.p.y < 0.3, 0.8);
    hooks.slow(1); p.faceLock = false;
  }

  // with the ball: drive into open grass, slow down and keep it close with a man nearby
  function carrySpeed(p, base) {
    const other = p.side === 'user' ? 'opp' : 'user';
    let near = Infinity; for (const q of rt.players) if (q.side === other && !q.offPitch) near = Math.min(near, q.pos.distanceTo(p.pos));
    return near > 12 ? Math.max(base, 6.4) : near < 5 ? Math.min(base, 3.8) : base;
  }
  function* carry(p, goalW, speed = 5) {
    yield* ensureOwner(p);
    p.busy = true;
    // he slows down only while a man is near him; a long run with the ball ends after ~11 s wherever he is
    const end = S.t + Math.min(11, p.pos.distanceTo(goalW) / Math.max(2, carrySpeed(p, speed) - 1) + 2);
    while (S.t < end && ball.owner === p) {
      rt.dribble(p, goalW, carrySpeed(p, speed));
      if (Math.hypot(ball.p.x - goalW.x, ball.p.z - goalW.z) < 1.4) break;
      yield;
    }
    p.busy = false;
  }

  // ---- V7.9 skill moves: the boots are placed on and around the ball (runtime footIK) ----
  const fwdOf = p => V(Math.sin(p.heading), 0, Math.cos(p.heading));
  const rightOf = p => V(-Math.cos(p.heading), 0, Math.sin(p.heading));
  const ramp = (t0, a, b, c, d) => t => { const u = t - t0; return u < a ? 0 : u < b ? (u - a) / (b - a) : u < c ? 1 : u < d ? 1 - (u - c) / (d - c) : 0; };
  // Catmull-Rom through points, u in 0..1
  function spline(pts, u) {
    const n = pts.length - 1, x = clamp(u, 0, 1) * n, i = Math.min(n - 1, Math.floor(x)), t = x - i;
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n, i + 2)];
    const c = (a, b, c2, d) => 0.5 * (2 * b + (-a + c2) * t + (2 * a - 5 * b + 4 * c2 - d) * t * t + (-a + 3 * b - 3 * c2 + d) * t * t * t);
    return [c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])];
  }
  // settle the ball just in front of his boots (it is not put there: he steadies and lets it come back)
  function* gather(car, def, maxT = 0.9) {
    const f = fwdOf(car);
    const ok = () => { const rel = V(ball.p.x - car.pos.x, 0, ball.p.z - car.pos.z), a = rel.dot(fwdOf(car)), l = Math.abs(rel.dot(rightOf(car))); return a > 0.3 && a < 0.56 && l < 0.22; };
    yield* until(() => {
      car.target.copy(ball.p).addScaledVector(f, -0.42); car.want = 2.4; car.face = null;
      def.target.copy(car.pos).addScaledVector(f, 1.9); def.want = 1.4; def.face = car.pos; def.faceLock = true; def.loopsWant.jockey = 1;
      if (Math.hypot(ball.v.x, ball.v.z) > 1.5) ball.v.multiplyScalar(0.94);
      return ok();
    }, maxT);
    return ok();
  }
  // ---- V7.9 who may try what, and where ----
  // only a player who has the move in his repertoire (pitch-v731 skillMoves) tries it, and only where it
  // makes sense: nothing fancy in his own third, the elastico and the no-look pass only in the
  // opponents' half, the elastico not hard against the touchline
  function ownGoalX(side) {
    const gk = rt.players.find(q => q.side === side && q.role === 'GK' && !q.offPitch);
    if (gk) return Math.sign(gk.home?.x || gk.pos.x || 1) * GOAL_X;
    let sx = 0; for (const q of rt.players) if (q.side === side && !q.offPitch) sx += q.home?.x ?? q.pos.x;
    return Math.sign(sx || 1) * GOAL_X;
  }
  const fromOwnGoal = p => Math.abs(p.pos.x - ownGoalX(p.side));
  function zoneOk(move, p) {
    const d = fromOwnGoal(p);
    if (d < 35) return false;                                         // his own third (and his own box)
    if (move === 'elastico') return d > GOAL_X && Math.abs(p.pos.z) < 31;
    if (move === 'nolook') return d > GOAL_X;
    return true;
  }
  const has = (p, move) => !!p?.moves?.includes(move);
  // the special move a beaten defender falls for, if the carrier has one that fits here (stable per event)
  function duelMove(car, def) {
    const ok = ['elastico', 'stepover', 'nutmeg'].filter(m => has(car, m) && zoneOk(m, car));
    if (!ok.length || pick(def.lastEvent, 13) > 0.65) return null;
    return ok[Math.floor(pick(def.lastEvent, 17) * ok.length)];
  }
  // every special move is logged with who did it and where, for the checks and the replay
  function noteSkill(audit, p, extra) {
    Object.assign(audit, { who: p.key, side: p.side, moves: [...(p.moves || [])], fromOwn: +fromOwnGoal(p).toFixed(1), z: +p.pos.z.toFixed(1), t: +S.t.toFixed(2) }, extra);
    (stats.skills ||= []).push(audit);
    hooks.star?.(audit, p);
  }
  // step-over: the right boot circles round the front of the ball from inside to out without touching
  // it, the left stays planted; the defender buys it and goes that way; the same boot then takes the
  // ball back across the other way
  function* stepoverBeat(car, def, closeUp) {
    if (!(yield* gather(car, def)) || def.pos.distanceTo(car.pos) > 3.2) return false;
    // square up to the ball (turned, not snapped): his line is from him to the ball
    car.face = ball.p; car.faceLock = true;
    yield* until(() => { const want = Math.atan2(ball.p.x - car.pos.x, ball.p.z - car.pos.z), d = Math.atan2(Math.sin(want - car.heading), Math.cos(want - car.heading)); return Math.abs(d) < 0.06; }, 0.25);
    const f = fwdOf(car), r = rightOf(car), t0 = S.t, b0 = ball.p.clone();
    if (closeUp) hooks.cam('close', car, def);
    hooks.slow(0.4);
    car.target.copy(car.pos).addScaledVector(f, 0.15); car.want = 0.4; car.vel.multiplyScalar(0.35); ball.v.copy(f).multiplyScalar(0.12);
    car.face = car.pos.clone().addScaledVector(f, 30); car.faceLock = true;            // square to the ball through the move
    ball.through = t0 + 1.0;          // his body does not nudge the ball on: only the boots play it during the move
    def.target.copy(def.pos); def.want = 0.5;
    const at = (a, l, y = 0.03) => ball.p.clone().addScaledVector(f, a).addScaledVector(r, l).setY(y);
    const plantL = b0.clone().addScaledVector(r, -0.27).addScaledVector(f, -0.12).setY(0.03); let plantL2 = null;
    const path = [[-0.2, -0.1], [0.04, -0.22], [0.27, 0.0], [0.13, 0.3]];
    car.feet = {
      Left: { w: ramp(t0, 0, 0.1, 0.95, 1.1), at: t => {
        if (t - t0 < 0.52) return plantL;
        // re-planted beside the ball for the take: a short low step, not a slide
        plantL2 ||= ball.p.clone().addScaledVector(r, -0.26).addScaledVector(f, -0.1).setY(0.03);
        const k = clamp((t - t0 - 0.52) / 0.14, 0, 1);
        return plantL.clone().lerp(plantL2, k * k * (3 - 2 * k)).setY(0.03 + 0.07 * Math.sin(Math.PI * k));
      } },
      Right: { w: ramp(t0, 0, 0.08, 0.95, 1.1), at: t => {
        const u = (t - t0) / 0.5;
        if (u <= 1) { const [a, l] = spline(path, u); return at(a, l, 0.03 + 0.28 * Math.sin(Math.PI * clamp((u - 0.08) / 0.84, 0, 1))); }
        const k = clamp((t - t0 - 0.5) / 0.12, 0, 1);                      // lands outside, then comes back to the ball's right side
        return at(0.13 - 0.13 * k, 0.3 - 0.17 * k, 0.03 + 0.03 * Math.sin(Math.PI * k));
      } },
    };
    rt.startAction(car, 'stepover');
    const audit = { kind: 'stepover', minGap: 9, peak: 0, plantSlip: 0 };
    let plant0 = null;
    yield* until(() => {
      const u = (S.t - t0) / 0.5, toe = car.feet.Right.last, sup = car.feet.Left.last;
      if (DEBUG && toe && u > 0.15 && u < 0.85 && toe.distanceTo(ball.p) < 0.12 && !audit.close) audit.close = { u: +u.toFixed(2), toe: toe.toArray().map(v => +v.toFixed(2)), target: car.feet.Right.at(S.t).toArray().map(v => +v.toFixed(2)), ball: ball.p.toArray().map(v => +v.toFixed(2)), hip: car.bones.RightUpLeg.getWorldPosition(V()).toArray().map(v => +v.toFixed(2)), car: car.pos.toArray().map(v => +v.toFixed(2)), h: +car.heading.toFixed(2) };
      if (toe && u > 0.15 && u < 0.85) { audit.minGap = Math.min(audit.minGap, toe.distanceTo(ball.p)); audit.peak = Math.max(audit.peak, toe.y); }
      if (sup && S.t - t0 > 0.12 && S.t - t0 < 0.5) { plant0 ||= sup.clone(); audit.plantSlip = Math.max(audit.plantSlip, Math.hypot(sup.x - plant0.x, sup.z - plant0.z)); }
      if (S.t - t0 > 0.45) { car.target.copy(ball.p).addScaledVector(f, -0.28); car.want = 1.0; }      // a half step to the ball for the take
      if (S.t - t0 > 0.24 && !def.act) { rt.startAction(def, 'lungeL'); def.loopsWant.jockey = 0; def.target.copy(def.pos).addScaledVector(r, 1.3); def.want = 3; }
      return S.t - t0 >= 0.62;
    }, 1.2);
    // the take: inside of the right boot, back across to his left (a half step more if the ball ran on)
    yield* until(() => { const t = car.feet.Right.last; car.target.copy(ball.p).addScaledVector(f, -0.24); car.want = 1.4; return t && t.distanceTo(ball.p) < 0.24; }, 0.3);
    const toe = car.feet.Right.last; audit.contact = toe ? +toe.distanceTo(ball.p).toFixed(3) : null;
    if (DEBUG) { const hip = car.bones.RightUpLeg.getWorldPosition(V()), tg = car.feet.Right.at(S.t); audit.dbg = { car: car.pos.toArray().map(v => +v.toFixed(2)), ball: ball.p.toArray().map(v => +v.toFixed(2)), toe: toe?.toArray().map(v => +v.toFixed(2)), target: tg.toArray().map(v => +v.toFixed(2)), hip: hip.toArray().map(v => +v.toFixed(2)), w: +car.feet.Right.w(S.t).toFixed(2), bv: +Math.hypot(ball.v.x, ball.v.z).toFixed(2), cv: +car.vel.length().toFixed(2), el: +(S.t - t0).toFixed(2) }; }
    const out = f.clone().multiplyScalar(3.1).addScaledVector(r, -2.7);
    if (Math.abs(car.pos.z) > 28 && out.z * Math.sign(car.pos.z) > 0) out.z *= -0.4;
    ball.v.copy(out); car.lastTouch = S.t; rt.startAction(car, 'cut');
    noteSkill(audit, car);
    car.target.copy(ball.p).addScaledVector(out, 0.5); car.want = 6;
    yield* wait(0.3); hooks.slow(1);
    rt.startAction(def, 'stumble'); def.want = 0.5; def.face = car.pos; def.faceLock = true;
    yield* wait(0.35); car.feet = null; car.faceLock = false;
    def.busy = car.busy = false; def.faceLock = false; def.loopsWant.jockey = 0;
    yield* chase(car, null);
    if (closeUp) hooks.cam('tv');
  }
  // through his legs: the defender squares up with his feet apart, a stab with the right boot sends
  // the ball through the gap and the attacker goes round him
  function* nutmegBeat(car, def, closeUp) {
    if (!(yield* gather(car, def, 0.7)) || def.pos.distanceTo(car.pos) > 3.2) return false;
    const fc = fwdOf(car);
    yield* until(() => { def.target.copy(ball.p).addScaledVector(fc, 1.45); def.want = 3; def.face = car.pos; def.faceLock = true; car.target.copy(car.pos); car.want = 0.3; ball.v.multiplyScalar(0.9); return def.pos.distanceTo(ball.p.clone().setY(0)) < 1.75; }, 0.6);
    const t0 = S.t;
    if (closeUp) hooks.cam('close', car, def);
    hooks.slow(0.4);
    def.heading = Math.atan2(car.pos.x - def.pos.x, car.pos.z - def.pos.z); def.face = car.pos; def.faceLock = true;
    def.loopsWant.jockey = 0; def.target.copy(def.pos); def.want = 0; def.vel.multiplyScalar(0.2);
    const dr = rightOf(def), df = fwdOf(def);
    const fl = def.pos.clone().addScaledVector(dr, -0.44).addScaledVector(df, 0.06).setY(0.03), fr = def.pos.clone().addScaledVector(dr, 0.44).addScaledVector(df, 0.06).setY(0.03);
    def.feet = { Left: { at: () => fl, w: ramp(t0, 0, 0.16, 1.0, 1.25) }, Right: { at: () => fr, w: ramp(t0, 0, 0.16, 1.0, 1.25) } };
    rt.startAction(def, 'spread');
    car.target.copy(car.pos); car.want = 0.4; ball.v.multiplyScalar(0.15); ball.through = t0 + 0.5;      // he steadies it
    const gap = def.pos.clone().addScaledVector(df, 0.06).setY(0), f = V(gap.x - ball.p.x, 0, gap.z - ball.p.z).normalize();
    car.heading = Math.atan2(f.x, f.z);
    rt.startAction(car, 'poke', 0.06);
    const tc = 0.06 + ACTIONS.poke.dur * ACTIONS.poke.contact;
    car.feet = { Right: { w: ramp(t0, 0.02, 0.12, tc, tc + 0.12), at: () => ball.p.clone().addScaledVector(f, -0.13).setY(0.06) } };
    yield* until(() => S.t - t0 >= tc, 1);
    const toe = car.feet.Right.last, audit = { kind: 'nutmeg', contact: toe ? +toe.distanceTo(ball.p).toFixed(3) : null };
    f.set(gap.x - ball.p.x, 0, gap.z - ball.p.z).normalize();                    // aimed at the gap from where the ball is now
    if (DEBUG) audit.dbg = { ball: ball.p.toArray().map(v => +v.toFixed(2)), gap: gap.toArray().map(v => +v.toFixed(2)), def: def.pos.toArray().map(v => +v.toFixed(2)) };
    ball.v.copy(f).multiplyScalar(5.2); ball.through = S.t + 1.1; car.lastTouch = S.t;
    // round him on the open side, then onto the ball
    const side = V(-f.z, 0, f.x).multiplyScalar(pick(def.lastEvent, 11) < 0.5 ? 1 : -1);
    car.target.copy(gap).addScaledVector(side, 1.3).addScaledVector(f, 0.2); car.want = 6.4;
    let crossed = false;
    yield* until(() => {
      const l = def.feet?.Left?.last, rr = def.feet?.Right?.last;
      if (!crossed && l && rr && (ball.p.x - gap.x) * f.x + (ball.p.z - gap.z) * f.z > 0) {
        crossed = true;
        const seg = V(rr.x - l.x, 0, rr.z - l.z), len = seg.length(), q = V(ball.p.x - l.x, 0, ball.p.z - l.z).dot(seg) / Math.max(1e-3, len * len);
        Object.assign(audit, { between: q > 0 && q < 1, gapL: +Math.hypot(ball.p.x - l.x, ball.p.z - l.z).toFixed(3), gapR: +Math.hypot(ball.p.x - rr.x, ball.p.z - rr.z).toFixed(3) });
      }
      return crossed || S.t - t0 > tc + 1.1;
    }, 1.6);
    yield* until(() => S.t - t0 > tc + 0.45, 0.6);
    if (DEBUG && !crossed) audit.end = { ball: ball.p.toArray().map(v => +v.toFixed(2)), v: ball.v.toArray().map(v => +v.toFixed(2)), feet: !!def.feet, l: !!def.feet?.Left?.last };
    noteSkill(audit, car);
    hooks.slow(1); car.feet = null;
    def.face = ball.p; def.faceLock = true; def.want = 1.5; def.target.copy(def.pos).addScaledVector(f, 0.8);
    yield* until(() => !def.feet || S.t - t0 > 1.3, 0.8); def.feet = null;
    def.busy = car.busy = false; def.faceLock = false;
    yield* chase(car, null);
    if (closeUp) hooks.cam('tv');
  }

  // elastico: the outside of the right boot pushes the ball out to his right, the same boot wraps
  // round it and the inside snaps it back to his left before the defender can turn; the left stays planted
  function* elasticoBeat(car, def, closeUp) {
    if (!(yield* gather(car, def)) || def.pos.distanceTo(car.pos) > 3.2) return false;
    car.face = ball.p; car.faceLock = true;
    yield* until(() => { const want = Math.atan2(ball.p.x - car.pos.x, ball.p.z - car.pos.z), d = Math.atan2(Math.sin(want - car.heading), Math.cos(want - car.heading)); return Math.abs(d) < 0.06; }, 0.25);
    const f = fwdOf(car), r = rightOf(car), t0 = S.t, b0 = ball.p.clone();
    if (closeUp) hooks.cam('close', car, def);
    hooks.slow(0.35);
    car.target.copy(car.pos).addScaledVector(r, 0.12); car.want = 0.4; car.vel.multiplyScalar(0.3); ball.v.copy(f).multiplyScalar(0.1);
    car.face = car.pos.clone().addScaledVector(f, 30); car.faceLock = true;
    ball.through = t0 + 1.1;
    def.target.copy(def.pos); def.want = 0.5;
    const T1 = 0.2, T2 = 0.44;                          // push out, snap back in
    const rel = (a, l, y) => ball.p.clone().addScaledVector(f, a).addScaledVector(r, l).setY(y);
    const plantL = b0.clone().addScaledVector(r, -0.27).addScaledVector(f, -0.14).setY(0.03);
    // the boot round the ball: from its left side, round the front, to its right side (lifted a touch)
    const wrap = [[-0.02, -0.13], [0.16, -0.06], [0.17, 0.08], [0.0, 0.15]];
    car.feet = {
      Left: { w: ramp(t0, 0, 0.1, 0.9, 1.05), at: () => plantL },
      Right: { w: ramp(t0, 0, 0.08, 0.9, 1.05), at: t => {
        const u = t - t0;
        if (u < T1) { const k = clamp(u / T1, 0, 1); return rel(-0.08 + 0.06 * k, -0.2 + 0.07 * k, 0.04); }       // onto the ball's inside
        if (u < T2 - 0.04) { const k = (u - T1) / (T2 - 0.04 - T1), [a, l] = spline(wrap, k); return rel(a, l, 0.05 + 0.08 * Math.sin(Math.PI * k)); }
        return rel(-0.01, 0.13, 0.04);                                                                          // inside of the boot on the ball's right
      } },
    };
    rt.startAction(car, 'elastico');
    const audit = { kind: 'elastico', plantSlip: 0, out: 0 };
    let plant0 = null;
    const near = () => { const t = car.feet.Right.last; return t ? t.distanceTo(ball.p) : 9; };
    const watch = () => {
      const sup = car.feet.Left.last;
      if (sup && S.t - t0 > 0.12) { plant0 ||= sup.clone(); audit.plantSlip = Math.max(audit.plantSlip, Math.hypot(sup.x - plant0.x, sup.z - plant0.z)); }
      audit.out = Math.max(audit.out, V(ball.p.x - b0.x, 0, ball.p.z - b0.z).dot(r));
    };
    // 1: out with the outside of the boot
    yield* until(() => { watch(); return S.t - t0 >= T1 && near() < 0.24; }, T1 + 0.12);
    audit.touch1 = +near().toFixed(3);
    ball.v.copy(r).multiplyScalar(1.7).addScaledVector(f, 0.35); car.lastTouch = S.t;
    rt.startAction(def, 'lungeL'); def.loopsWant.jockey = 0; def.target.copy(def.pos).addScaledVector(r, 1.4); def.want = 3;
    // 2: round it and back in with the inside
    yield* until(() => { watch(); return S.t - t0 >= T2 && near() < 0.24; }, T2 - T1 + 0.14);
    audit.touch2 = +near().toFixed(3);
    const back = r.clone().multiplyScalar(-4.2).addScaledVector(f, 2.6);
    if (Math.abs(car.pos.z) > 28 && back.z * Math.sign(car.pos.z) > 0) back.z *= -0.4;
    ball.v.copy(back); car.lastTouch = S.t;
    noteSkill(audit, car);
    car.target.copy(ball.p).addScaledVector(back, 0.5); car.want = 6;
    yield* until(() => { watch(); return S.t - t0 > T2 + 0.3; }, 0.4); hooks.slow(1);
    rt.startAction(def, 'stumble'); def.want = 0.5; def.face = car.pos; def.faceLock = true;
    yield* wait(0.3); car.feet = null; car.faceLock = false;
    def.busy = car.busy = false; def.faceLock = false; def.loopsWant.jockey = 0;
    yield* chase(car, null);
    if (closeUp) hooks.cam('tv');
  }

  const SKILL_BEAT = { stepover: stepoverBeat, nutmeg: nutmegBeat, elastico: elasticoBeat };
  // a defender closes the carrier down and commits; success decides who gets the ball
  function* tackle(def, car, success, closeUp, slide) {
    if (!def || !car) return;
    if (ball.owner !== car) yield* ensureOwner(car);
    if (def.motion) yield* until(() => !def.motion, 2);
    def.busy = car.busy = true;
    if (closeUp) hooks.cam('close', car, def);
    if (slide && (yield* slideTackle(def, car, success)) !== false) { if (closeUp) hooks.cam('tv'); return; }
    // carrier keeps going while the defender arrives goal-side
    const carGoal = car.pos.clone().add(V(Math.sin(car.heading) * 6, 0, Math.cos(car.heading) * 6));
    carGoal.x = clamp(carGoal.x, -49, 49); carGoal.z = clamp(carGoal.z, -31, 31);
    yield* until(() => {
      rt.dribble(car, carGoal, 2.6);
      def.target.copy(car.pos).add(V(Math.sin(car.heading) * 1.4, 0, Math.cos(car.heading) * 1.4));
      def.want = 6; def.face = car.pos; def.faceLock = def.pos.distanceTo(car.pos) < 4; def.loopsWant.jockey = def.faceLock ? 1 : 0;
      return def.pos.distanceTo(car.pos) < 2.0;
    }, 3.5);
    def.loopsWant.jockey = 0;
    // several ways to win and lose a duel (stable per event): poke, shoulder, stepping in /
    // feint and cut, knock it past and run, drag-back and turn
    const style = Math.floor(pick(def.lastEvent, 7) * 3);
    // V7.9: beaten by a special move — only a carrier who has it, only where it fits (feet placed on the ball)
    const move = success ? null : duelMove(car, def);
    if (move && (yield* SKILL_BEAT[move](car, def, closeUp)) !== false) return;
    if (success && style === 1) {
      // shoulder to shoulder: he leans in and takes the ball away with his body between man and ball
      rt.startAction(def, 'shoulder');
      yield* until(() => { def.target.copy(car.pos).add(V(-Math.cos(car.heading) * 0.6, 0, Math.sin(car.heading) * 0.6)); def.want = 4.5; if (ball.owner === car) rt.dribble(car, carGoal, 2.2); return S.t - def.act.t0 > 0.3; }, 0.8);
      ball.owner = def; def.lastTouch = S.t; ball.v.set(Math.sin(def.heading), 0, Math.cos(def.heading)).multiplyScalar(1.6);
      car.vel.multiplyScalar(0.4); rt.startAction(car, 'feint');
      yield* wait(0.45); def.busy = car.busy = false; def.faceLock = false; if (closeUp) hooks.cam('tv'); return;
    }
    if (success && style === 2) {
      // reads the touch and steps across the ball's path: no lunge, he simply takes it in stride
      const ahead = ball.p.clone().addScaledVector(V(ball.v.x, 0, ball.v.z), 0.35);
      yield* until(() => { def.target.copy(ahead); def.want = 5.5; return def.pos.distanceTo(ahead) < 0.7; }, 0.9);
      ball.owner = def; def.lastTouch = S.t; ball.v.multiplyScalar(0.3);
      yield* wait(0.35); def.busy = car.busy = false; def.faceLock = false; if (closeUp) hooks.cam('tv'); return;
    }
    if (!success && style === 1) {
      // knocks it past the defender's side and races onto it
      const fwd = V(Math.sin(car.heading), 0, Math.cos(car.heading)), away = V(car.pos.x - def.pos.x, 0, car.pos.z - def.pos.z).normalize();
      const out = fwd.clone().multiplyScalar(1.3).add(away.multiplyScalar(-0.5)).normalize();
      if (Math.abs(car.pos.z) > 26 && out.z * Math.sign(car.pos.z) > 0) out.z *= -0.4;
      if (Math.abs(car.pos.x) > 44 && out.x * Math.sign(car.pos.x) > 0) out.x *= -0.4;
      rt.startAction(car, 'cut'); ball.owner = null; ball.v.copy(out.normalize()).multiplyScalar(7.5); car.lastTouch = S.t;
      rt.startAction(def, 'lunge', 0.12);
      car.target.copy(ball.p).addScaledVector(out, 6); car.want = 7.6;
      yield* wait(0.5); def.busy = car.busy = false; def.faceLock = false;
      yield* chase(car, null);
      if (closeUp) hooks.cam('tv'); return;
    }
    if (!success && style === 2) {
      // drag-back: rolls it back under his sole and turns away from the challenge
      rt.startAction(car, 'dragBack'); car.vel.multiplyScalar(0.3);
      rt.startAction(def, 'lunge', 0.2);
      yield* wait(0.3);
      const back = V(-Math.sin(car.heading), 0, -Math.cos(car.heading)), side = V(Math.cos(car.heading), 0, -Math.sin(car.heading)).multiplyScalar(pick(def.lastEvent, 9) < 0.5 ? 1 : -1);
      const out = back.multiplyScalar(0.3).add(side).normalize();
      if (Math.abs(car.pos.z) > 26 && out.z * Math.sign(car.pos.z) > 0) out.negate();
      ball.v.copy(out).multiplyScalar(3.2); car.lastTouch = S.t; car.heading = Math.atan2(out.x, out.z);
      yield* wait(0.4); def.busy = car.busy = false; def.faceLock = false; if (closeUp) hooks.cam('tv'); return;
    }
    if (!success) { rt.startAction(car, 'feint'); }
    rt.startAction(def, 'lunge', success ? 0 : 0.18);
    // side of the lunge: towards the ball
    def.target.copy(ball.p); def.want = success ? 3.5 : 2.4;
    yield* until(() => def.act && S.t - def.act.t0 > ACTIONS.lunge.dur * 0.35, 1.5);
    if (success) {
      ball.v.set(def.pos.x - ball.p.x, 0, def.pos.z - ball.p.z).normalize().multiplyScalar(2.2);
      ball.owner = def; def.lastTouch = S.t;
    } else {
      // beaten: the attacker cuts away from the lunge
      const away = V(car.pos.x - def.pos.x, 0, car.pos.z - def.pos.z).normalize();
      const fwd = V(Math.sin(car.heading), 0, Math.cos(car.heading));
      const out = fwd.add(away.multiplyScalar(0.8)).normalize();
      if (Math.abs(car.pos.z) > 28 && out.z * Math.sign(car.pos.z) > 0) out.z *= -0.4;
      if (Math.abs(car.pos.x) > 46 && out.x * Math.sign(car.pos.x) > 0) out.x *= -0.4;
      out.normalize();
      ball.v.copy(out).multiplyScalar(5); car.lastTouch = S.t;
      rt.startAction(car, 'cut');
    }
    yield* wait(0.45);
    def.busy = car.busy = false; def.faceLock = false;
    if (closeUp) hooks.cam('tv');
  }

  // a sliding tackle: the defender goes to ground from a few metres; the boot arrives on the contact frame
  function* slideTackle(def, car, success) {
    const c = MOTIONS.tackle.contact;
    const carGoal = car.pos.clone().add(V(Math.sin(car.heading) * 8, 0, Math.cos(car.heading) * 8));
    carGoal.x = clamp(carGoal.x, -49, 49); carGoal.z = clamp(carGoal.z, -31, 31);
    yield* until(() => {
      rt.dribble(car, carGoal, 3);
      def.target.copy(car.pos).add(V(Math.sin(car.heading) * 2, 0, Math.cos(car.heading) * 2));
      def.want = 6.5; def.face = car.pos; def.faceLock = false;
      // go to ground when the boot can reach where the ball will be, at about running pace
      return def.pos.distanceTo(ball.p.clone().addScaledVector(V(car.vel.x, 0, car.vel.z), c)) < rt.slideReach + 4.5 * 0.33;
    }, 3.5);
    if (def.pos.distanceTo(ball.p) > 4.5) return false;     // never got close enough to go to ground
    // on a won tackle he steers onto the ball as the carrier runs on; a beaten one goes where it was
    const fixed = ball.p.clone().addScaledVector(V(car.vel.x, 0, car.vel.z), c * 0.6);
    rt.slideAt(def, success ? t => ball.p.clone().addScaledVector(V(car.vel.x, 0, car.vel.z), t) : fixed);
    if (success) {
      yield* until(() => { rt.dribble(car, carGoal, 2.4); return rt.motionAtContact(def); }, 1.2);
      // the leg stays out as he slides on: the poke comes where the boot passes closest to the ball
      let best = Infinity;
      yield* until(() => {
        const d = rt.contactDistance(def, ball.p);
        if (d < 0.15 || d > best + 0.01) return true;
        best = Math.min(best, d); return false;
      }, 0.45);
      // the boot pokes it away from the carrier; the defender collects it when he is back up.
      // Only a leg that really reaches the ball plays it: otherwise the carrier is just checked
      // (he stops) and the defender wins it with his next effort.
      const m = def.motion?.dir || V(Math.sin(def.heading), 0, Math.cos(def.heading));
      const side = V(-m.z, 0, m.x).multiplyScalar((pick(def.lastEvent, 3) - 0.5) * 0.8);
      if (rt.contactDistance(def, ball.p) > 0.45) {
        stats.misses = (stats.misses || 0) + 1;
        car.vel.multiplyScalar(0.3); car.want = 0; car.target.copy(car.pos); ball.v.multiplyScalar(0.3); ball.owner = null;
        rt.startAction(car, 'feint');
        yield* wait(0.5); def.busy = car.busy = false; def.faceLock = false;
        return true;
      }
      noteContact('slide', def);
      ball.owner = null; ball.p.y = BALL_R; ball.v.copy(m).add(side).normalize().multiplyScalar(2.6);
      def.lastTouch = S.t; car.vel.multiplyScalar(0.3); car.want = 0; car.target.copy(car.pos);
      rt.startAction(car, 'feint');
    } else {
      // the carrier sees him coming and knocks it past the sliding leg
      yield* until(() => { rt.dribble(car, carGoal, 2.8); return S.t - def.motion?.t0 > c * 0.45; }, 1);
      const m = def.motion?.dir || V(Math.sin(def.heading), 0, Math.cos(def.heading));
      const fwd = V(Math.sin(car.heading), 0, Math.cos(car.heading));
      let out = V(-m.z, 0, m.x); if (out.dot(V(car.pos.x - def.pos.x, 0, car.pos.z - def.pos.z)) < 0) out.negate();
      out = fwd.multiplyScalar(0.8).add(out.multiplyScalar(0.6));
      if (Math.abs(car.pos.z) > 28 && out.z * Math.sign(car.pos.z) > 0) out.z *= -0.4;
      if (Math.abs(car.pos.x) > 46 && out.x * Math.sign(car.pos.x) > 0) out.x *= -0.4;
      out.normalize();
      ball.owner = car; ball.v.copy(out).multiplyScalar(5.2); car.lastTouch = S.t;
      rt.startAction(car, 'cut');
    }
    yield* wait(0.5);
    def.busy = car.busy = false; def.faceLock = false;
    return true;
  }

  // a cross met in the air (corners): the target and the nearest marker both go up for it
  function rivalFor(p, spot) {
    const other = p.side === 'user' ? 'opp' : 'user';
    return rt.players.filter(q => q.side === other && q.role !== 'GK' && !q.offPitch).sort((a, b) => a.pos.distanceTo(spot) - b.pos.distanceTo(spot))[0];
  }
  function jumpFor(p, spot, heading, tArr, late = 0, short = 0) {
    const H = MOTIONS.header;
    // a beaten jumper arrives a touch late and a little short of the ball
    const at = spot.clone().add(V(Math.sin(heading) * -short, 0, Math.cos(heading) * -short));
    p.runUntil = tArr + 1.2; p.target.copy(at).setY(0); p.want = 7.4;
    // only a player who can get there in time goes up for it; the others just run in
    const lead = tArr - H.contact - S.t + late;
    if (Math.hypot(at.x - p.pos.x, at.z - p.pos.z) <= 4.2 * Math.max(0, lead) + 1.2) rt.headerAt(p, at, heading, Math.max(0, lead));
    return !!p.motion;
  }
  function planAerial(e, receiver, target, tArr, hs, lb, jumper) {
    const spot = V(target.x, rt.headHeight, target.z);
    const rival = rivalFor(receiver, spot);
    const inc = V(-ball.v.x, 0, -ball.v.z).normalize();
    if (hs) {
      S.headerCross = { p: receiver, spot, tArr };
      receiver.busy = true; receiver.target.copy(spot).setY(0); receiver.want = 7.4; receiver.runUntil = tArr + 1;
      if (rival) jumpFor(rival, spot.clone().add(V(-Math.sign(spot.x) * 0.7, 0, 0.35)), headingOf(inc, V(0, 0, 0)), tArr, 0.1, 0.25);
      return;
    }
    // won by the marker (a clearance) or flicked on by whoever got the faintest touch (a scramble)
    const to = toWorld(lb.toPos || lb.fromPos || [50, 50]);
    // the cross was aimed at the man expected to win it (see the corner): the marker for a clearance,
    // the target for a flick-on
    const winner = jumper || (lb.reason === 'clearance' ? rival : receiver), loser = winner === receiver ? rival : receiver;
    if (!winner) return;
    const out = V(to.x - spot.x, 0, to.z - spot.z).normalize();
    jumpFor(winner, spot, headingOf(inc, out), tArr);
    if (loser) jumpFor(loser, spot.clone().add(V(0.45, 0, -0.45)), headingOf(inc, V(0, 0, 0)), tArr, 0.08, 0.3);
    S.aerial = { at: tArr, to, winner };
  }

  // ---- shot: aim from the engine outcome, keeper dives, outcome plays out physically ----
  function* shot(e, i) {
    const sh = P(e.fromId, e.fromSide); if (!sh) return;
    const defSide = sh.side === 'user' ? 'opp' : 'user';
    const gk = P(e.goalkeeperId, defSide) || keeperOf(defSide);
    // look ahead for the outcome details the engine logged after the shot
    const after = events.slice(i + 1, i + 6);
    const save = after.find(x => x.type === 'save'), post = after.find(x => x.type === 'post'), block = after.find(x => x.type === 'block');
    const goalSide = toWorld(e.toPos || [100, 50]).x >= 0 ? 1 : -1, lineX = goalSide * GOAL_X;
    const tz = toWorld(e.toPos || [100, 50]).z;
    const rnd = ((e.eventId * 9301 + 49297) % 233280) / 233280;
    let aim, outcome = e.outcome || 'wide';
    if (block && P(block.toId, block.toSide || sideOf(block.toId))?.role === 'GK') outcome = 'save';
    if (outcome === 'goal') aim = V(lineX + goalSide * 0.3, 0.4 + rnd * 1.5, clamp(tz, -3.1, 3.1));
    else if (outcome === 'save') aim = V(lineX, 0.5 + rnd * 1.2, clamp(tz, -2.9, 2.9));
    else if (outcome === 'post') aim = V(lineX, 0.9 + rnd * 0.8, tz >= 0 ? 3.62 : -3.62);
    else if (outcome === 'block') aim = V(lineX, 0.6, clamp(tz, -3, 3));
    else { const sz = tz >= 0 ? 1 : -1, z = sz * clamp(Math.abs(tz) < 3.9 ? 4.6 : Math.abs(tz), 4.3, 6.8); aim = V(lineX, Math.abs(tz) < 3.9 && rnd > .5 ? 2.9 : 0.5 + rnd, z); }   // a miss goes just wide, never off towards the corner flag

    const hc = e.header && S.headerCross?.p === sh ? S.headerCross : null;
    S.headerCross = null;
    if (e.penalty) { rt.place(sh, toWorld(e.fromPos).add(V(-goalSide * 1.2, 0, 0)), goalSide > 0 ? Math.PI / 2 : -Math.PI / 2); ball.p.copy(toWorld(e.fromPos)).setY(BALL_R); ball.v.set(0, 0, 0); ball.owner = sh; }
    if (!hc) yield* ensureOwner(sh);
    sh.busy = true; if (gk) gk.busy = true;
    hooks.cam('shot', sh, gk);
    if (gk) {
      // the keeper sets himself on the line between the ball and the middle of his goal, a few
      // metres off it (further out for a shot from close in, to narrow the angle)
      const centre = V(lineX, 0, 0), toBall = V(ball.p.x - lineX, 0, ball.p.z), dist = toBall.length();
      const set = centre.clone().addScaledVector(toBall.normalize(), clamp(dist * 0.12, 1.2, 4));
      gk.loopsWant.keeperReady = 1; gk.face = ball.p; gk.target.copy(set); gk.want = 5;
    }
    if (hc) {
      // header: he times his jump so the forehead meets the cross, and nods it towards the aim
      const out = V(aim.x - hc.spot.x, 0, aim.z - hc.spot.z).normalize(), inc = V(-ball.v.x, 0, -ball.v.z).normalize();
      if (!sh.motion) rt.headerAt(sh, hc.spot, headingOf(out.clone().multiplyScalar(1.6), inc), Math.max(0, hc.tArr - MOTIONS.header.contact - S.t));
      yield* until(() => S.t >= hc.tArr, hc.tArr - S.t + 0.5);
      noteContact('header', sh);
      ball.owner = null; sh.lastTouch = S.t;
    } else {
      // a save needs a keeper in front of the shot: caught out of position, he races back while the
      // shooter steadies himself (never a save by a keeper standing behind the shooter)
      if (gk && outcome === 'save' && !e.penalty && !e.freeKick && gk.pos.distanceTo(gk.target) > 3) {
        gk.want = 7.5;
        yield* until(() => gk.pos.distanceTo(gk.target) < 1.2, Math.min(2.5, gk.pos.distanceTo(gk.target) / 6.5 + 0.4));
        gk.want = 5;
      }
      const dir = yield* approachAim(sh, 'shot', aim);
      rt.startAction(sh, 'shot'); rt.kickWarp(sh, 'shot', dir);
      yield* until(() => rt.actionAtContact(sh), 2);
    }
    // a save happens in the keeper's hands, in front of his line: the shot is aimed at the spot his
    // gloves can reach (within a dive and an arm of where he stands), not at the goal line
    let smother = 0;
    if (outcome === 'save' && gk) {
      const gz = gk.pos.z, front = gk.pos.x - goalSide * 0.3;
      if (Math.abs(ball.p.x) > Math.abs(front) - 0.6 && Math.hypot(ball.p.x - gk.pos.x, ball.p.z - gk.pos.z) < 7) {
        // the shooter is level with or past the keeper: he smothers it on its way to the line
        aim = V(clamp(ball.p.x + goalSide * 0.8, -52, 52), 0.3, ball.p.z + (aim.z - ball.p.z) * 0.15);
        smother = Math.min(1, Math.hypot(aim.x - gk.pos.x, aim.z - gk.pos.z) / 5.5);
      } else {
        let z = clamp(aim.z, gz - 2.3, gz + 2.3);
        if (gz - 2.3 < 2.9 && gz + 2.3 > -2.9) z = clamp(z, -2.9, 2.9);       // inside the posts when he can reach there
        aim = V(Math.abs(front) < Math.abs(lineX) ? front : lineX - goalSide * 0.5, aim.y, z);
      }
    }
    // a free kick is bent up over the wall and dips (a slower, higher flight)
    const dist = aim.distanceTo(ball.p), flight = Math.max(0.35, dist / ((e.header ? 14 : e.freeKick ? 19 : 24) * (S.tune?.ball ?? 1)), smother);
    // a blocker steps into the line first
    let blocker = null;
    if (outcome === 'block' && block) {
      blocker = P(block.toId, block.toSide || sideOf(block.toId));
      if (blocker && blocker.role !== 'GK') { const bp = ball.p.clone().lerp(aim, Math.min(0.35, 3.5 / dist)); blocker.busy = true; blocker.target.set(bp.x, 0, bp.z); blocker.want = 6; }
    }
    ball.allowOut = true;
    if (gk && outcome === 'save') {
      // plan the dive first, then send the ball exactly to where his gloves will be on the save frame
      rt.planDive(gk, aim.clone(), flight, true);
      const g = rt.diveHands(gk);
      aim.set(g.x, Math.max(0.2, g.y), g.z);
    }
    rt.kickAir(aim, flight);
    if (gk && outcome === 'save') ball.through = S.t + flight + 0.05;
    if (e.freeKick) {
      // the wall jumps as the kick is struck (a ball that is blocked hits it on the way)
      const toGoalDir = V(aim.x - ball.p.x, 0, aim.z - ball.p.z).normalize();
      for (const q of rt.players) if (!q.offPitch && q.side !== sh.side && q.role !== 'GK' && !q.busy) {
        const rel = V(q.pos.x - ball.p.x, 0, q.pos.z - ball.p.z), along = rel.dot(toGoalDir), across = Math.abs(rel.x * toGoalDir.z - rel.z * toGoalDir.x);
        if (along > 7.5 && along < 11 && across < 2.2) rt.startMotion(q, 'header');
      }
    }
    hooks.slow(0.45);
    const tArrive = outcome === 'save' ? flight : flight * Math.max(0.2, (Math.abs(gk ? gk.pos.x : lineX) - Math.abs(ball.p.x)) / Math.max(0.5, Math.abs(lineX - ball.p.x)));
    if (gk && outcome === 'save') { /* planned above */ }
    else if (gk && outcome !== 'wide' && outcome !== 'block') {
      const at = ball.p.clone().addScaledVector(ball.v, tArrive); at.y = ball.p.y + ball.v.y * tArrive - 0.5 * 9.81 * tArrive * tArrive;
      rt.planDive(gk, at, tArrive, outcome === 'save');
    } else if (gk && outcome === 'wide' && Math.abs(aim.z) < 6) {
      const at = ball.p.clone().addScaledVector(ball.v, tArrive); at.y = 0.8;
      rt.planDive(gk, at, tArrive, false);
    }
    sh.busy = false;
    // flight
    const t0 = S.t;
    if (outcome === 'save' && gk) {
      yield* until(() => rt.handsOf(gk).distanceTo(ball.p) < 0.3 || S.t - t0 >= flight, flight + 0.2);
      (stats.contacts.save ||= []).push(+rt.handsOf(gk).distanceTo(ball.p).toFixed(2));
      if (DEBUG) (stats.saveLog ||= []).push({ t: +S.t.toFixed(2), el: +(S.t - t0).toFixed(2), flight: +flight.toFixed(2), aim: aim.toArray().map(v => +v.toFixed(2)), ball: ball.p.toArray().map(v => +v.toFixed(2)), hands: rt.handsOf(gk).toArray().map(v => +v.toFixed(2)), gk: gk.pos.toArray().map(v => +v.toFixed(2)), h: +gk.heading.toFixed(2), dive: gk.dive && { roll: +gk.dive.roll.toFixed(2), slide: +gk.dive.slide.toFixed(2), lift: +gk.dive.lift.toFixed(2), tc: +gk.dive.tc.toFixed(2), cur: gk.dive.cur && { roll: +gk.dive.cur.roll.toFixed(2), slide: +gk.dive.cur.slide.toFixed(2) } } });
      const catchIt = save?.saveType === 'CATCH';
      if (catchIt) { ball.held = rt.pickUp(() => rt.handsOf(gk), 0.12); ball.owner = gk; yield* wait(1.4); ball.held = null; ball.v.set(0, 0, 0); }   // held, then dropped to his feet
      else if (save?.saveType === 'DEFLECT_CORNER') { ball.v.set(goalSide * 2.5, 2.2, Math.sign(ball.p.z || -1) * 6); ball.owner = null; }
      else { const r = toWorld(save?.toPos || [goalSide > 0 ? 90 : 10, 50]); ball.v.set((r.x - ball.p.x) * 0.9, 2.5, (r.z - ball.p.z) * 0.9); ball.owner = null; }
    } else if (outcome === 'post') {
      yield* until(() => Math.abs(ball.p.x) >= GOAL_X - 0.15, flight + 0.5);
      const r = toWorld(post?.toPos || [goalSide > 0 ? 90 : 10, 50]);
      ball.v.set((r.x - ball.p.x) * 0.8, 1.5, (r.z - ball.p.z) * 0.8); hooks.flash('DİREK');
    } else if (outcome === 'block' && blocker && blocker.role !== 'GK') {
      yield* until(() => ball.p.distanceTo(blocker.pos.clone().setY(0.9)) < 0.9 || S.t - t0 > flight, flight + 0.4);
      const r = toWorld(block.toPos || block.fromPos);
      ball.v.set((r.x - ball.p.x) * 0.7, 2, (r.z - ball.p.z) * 0.7); blocker.busy = false;
    } else if (outcome === 'goal') {
      yield* until(() => Math.abs(ball.p.x) > GOAL_X + 0.4, flight + 1);
      ball.v.multiplyScalar(0.25); ball.v.y = Math.min(ball.v.y, 0);
    } else {
      yield* until(() => Math.abs(ball.p.x) > GOAL_X + 0.5, flight + 1);
    }
    // a parry, rebound or block stays in play; a goal or a ball over the line does not
    const leaves = outcome === 'goal' || outcome === 'wide' || (outcome === 'save' && save?.saveType === 'DEFLECT_CORNER');
    if (!leaves) { yield* wait(0.25); ball.allowOut = false; }
    hooks.slow(1);
    yield* wait(0.5);
    if (gk) gk.busy = false;
    hooks.cam('tv');
  }

  function* celebrate(scorer) {
    if (!scorer) return;
    hooks.cam('close', scorer);
    scorer.busy = true;
    const flag = V(Math.sign(scorer.pos.x) * 44, 0, Math.sign(scorer.pos.z || 1) * 30);
    scorer.target.copy(flag); scorer.want = GAIT[4]; scorer.face = null;
    const mates = rt.players.filter(p => p.side === scorer.side && p !== scorer && p.role !== 'GK').sort((a, b) => a.pos.distanceTo(scorer.pos) - b.pos.distanceTo(scorer.pos)).slice(0, 3);
    for (const m of mates) { m.busy = true; m.target.copy(flag); m.want = 5.5; }
    yield* wait(1.8);
    scorer.target.copy(scorer.pos); scorer.want = 0;
    if (!rt.startMotion(scorer, 'cheer')) rt.startAction(scorer, 'celebrate');
    yield* wait(2.2);
    scorer.busy = false; for (const m of mates) m.busy = false;
    hooks.cam('tv');
  }

  // ---- one engine event -> one behaviour ----
  const handled = new Set();
  function* run(e, i) {
    if ((e.type === 'red' || e.type === 'sub') && pendingRoster) applyRoster(pendingRoster);
    if (e.homeGoals != null) hooks.score(e.homeGoals, e.awayGoals);
    hooks.minute(e.minute);
    // the subtitle follows the picture: a kick is described when the ball is struck, a duel or a
    // save when it has been decided (the end of its play); a run with the ball or a whistle at once
    if (!SKIP_TEXT.has(e.type) && !handled.has(i)) {
      flushSay();
      if (SAY_AT_START.has(e.type)) hooks.say(e.text, e); else sayQ = { e, i, kicks: S.kicks || 0 };
    }
    // as soon as the ball is out, players head for the arrangement of the coming restart
    const ahead = e.type === 'ballOut' || e.type === 'restartPosition' || e.type === 'restartPlayers' ? events.slice(i, i + 3).find(x => x.type === 'restartPlayers' && x.arranged) : null;
    if (ahead) S.restartHomes = ahead.arranged;
    else if (!e.restartType && !['foul', 'yellow', 'red', 'sub', 'offside', 'injury'].includes(e.type)) S.restartHomes = null;
    layout(i, false);
    // an offside call is coming: the receiver is already making his (early) run
    const offAhead = events.slice(i + 1, i + 4).find(x => x.type === 'offside');
    if (offAhead && S.offRun !== offAhead.eventId) {
      const r = P(offAhead.toId, offAhead.toSide);
      if (r && !r.busy && ball.owner !== r) { S.offRun = offAhead.eventId; r.target.copy(toWorld(offAhead.toPos)); r.want = 6.8; r.runUntil = S.t + 8; r.face = null; }
    }
    const from = P(e.fromId, e.fromSide), to = P(e.toId, e.toSide);
    switch (e.type) {
      case 'kickoff': {
        if (S.restartTaker) { S.restartTaker.busy = false; S.restartTaker = null; } S.restartSpot = null; S.fkHomes = null;
        layout(i, true); S.dead = false; ball.allowOut = false; ball.held = null;
        ball.p.set(0, BALL_R, 0); ball.v.set(0, 0, 0); ball.owner = from;
        hooks.cam('tv', null, null, true);
        if (from) { from.pos.set(-Math.sign(toWorld(e.toPos).x || 1) * 0.4, 0, 0); faceBall(from); }
        yield* wait(0.8);
        // the kickoff is a pass: a short exchange with the nearest team-mate, as the 2D pitch shows it
        // (the engine keeps the ball with the taker)
        if (from) {
          const mate = rt.players.filter(q => !q.offPitch && q.side === from.side && q !== from && q.role !== 'GK').sort((a, b) => a.pos.distanceTo(from.pos) - b.pos.distanceTo(from.pos))[0];
          if (mate && mate.pos.distanceTo(from.pos) < 20) {
            yield* pass(from, mate, mate.pos.clone(), 'ground');
            yield* wait(0.3);
            yield* pass(mate, from, from.pos.clone(), 'ground');
          }
        }
        break;
      }
      case 'offBallRun': if (from && !from.busy && ball.owner !== from) { from.target.copy(toWorld(e.toPos)); from.want = GAIT[4]; from.gait = 4; from.runUntil = S.t + 2.5; from.face = null; } break;
      case 'press': {
        const d = P(e.defenderId, e.toSide || (e.fromSide === 'user' ? 'opp' : 'user'));
        if (d && !d.busy) { d.target.copy(ball.p); d.want = d.pos.distanceTo(ball.p) > 10 ? GAIT[4] : 6; d.gait = 3; d.runUntil = S.t + 1.5; d.face = ball.p; }
        break;
      }
      case 'tackle': {
        const d = P(e.defenderId, e.fromSide === 'user' ? 'opp' : 'user');
        const car = from && ball.owner && ball.owner.side === from.side ? ball.owner : from;
        const won = e.success === true || (e.toId != null && e.toId !== e.fromId);
        const finalThird = Math.abs(ball.p.x) > 26;
        // about two in five challenges go to ground; a challenge that ends in a foul usually does
        const fouled = events.slice(i + 1, i + 3).some(x => x.type === 'foul');
        const slide = !!d && d.role !== 'GK' && pick(e, 1) < (fouled ? 0.7 : 0.38);
        if (d) d.lastEvent = e;
        yield* tackle(d, car, won, finalThird && stats.closeUps++ % 2 === 0, slide);
        break;
      }
      case 'interception': {
        if (to && ball.owner !== to) { yield* ensureOwner(to); }
        break;
      }
      case 'ballCarry': case 'dribble': case 'run':
        if (from) yield* carry(from, toWorld(e.toPos), e.type === 'dribble' ? 5.4 : 4.8);
        break;
      case 'pass': case 'cross': case 'goalKick': case 'freeKick': case 'corner': case 'throwIn': {
        if (!from) break;
        if (e.restartType) { S.dead = false; if (S.restartTaker && S.restartTaker !== from) { S.restartTaker.busy = false; ball.held = null; } S.restartTaker = null; S.restartSpot = null; S.fkHomes = null; }
        if (e.type === 'corner') hooks.cam('tv');
        const target = toWorld(e.toPos);
        const receiver = to && to !== from ? to : null;
        const popts = { throwIn: e.type === 'throwIn' || e.restartType === 'THROW_IN', restart: !!e.restartType, ev: e };
        if (receiver && (e.type === 'corner' || e.type === 'cross')) {
          const nx = events[i + 1];
          const hs = nx?.type === 'shot' && nx.header && nx.fromId === e.toId ? nx : null;
          const lb = !hs && e.type === 'corner' && nx?.type === 'looseBall' && (nx.reason === 'clearance' || nx.reason === 'aerial') ? nx : null;
          if (hs || lb) {
            // the cross is aimed where the man who meets it can actually get to (a header taker runs onto it)
            const jumper = hs || lb.reason !== 'clearance' ? receiver : rivalFor(receiver, target) || receiver;
            const flight = Math.max(0.7, Math.hypot(target.x - ball.p.x, target.z - ball.p.z) / 17);
            // he sprints from a standing start while the ball is in the air, then steps into the jump
            const gap = V(target.x - jumper.pos.x, 0, target.z - jumper.pos.z);
            // time lost turning round if he is running the other way
            const lost = Math.max(0, jumper.vel.length() - jumper.vel.dot(gap.clone().normalize())) / 9;
            const reach = 4.2 * Math.max(0, flight - MOTIONS.header.contact - lost) + 1.2;
            if (gap.length() > reach) target.copy(jumper.pos).addScaledVector(gap.normalize(), reach).setY(0);
            // he sets off as the kick is struck, not when the ball is already in the air
            jumper.target.copy(target).setY(0); jumper.want = 7.4; jumper.runUntil = S.t + flight + 2; jumper.face = null;
            if (DEBUG) (stats.jumpLog ||= []).push({ t: +S.t.toFixed(2), id: jumper.id, side: jumper.side, gap: +gap.length().toFixed(2), reach: +reach.toFixed(2), pos: jumper.pos.toArray().map(v => +v.toFixed(2)), busy: jumper.busy, motion: jumper.motion?.name });
            popts.height = rt.headHeight; popts.meet = tArr => planAerial(e, receiver, target, tArr, hs, lb, jumper);
          }
        }
        yield* pass(from, receiver, target, e.travelType === 'aerial' || e.type === 'cross' || e.type === 'corner' ? 'aerial' : 'ground', false, popts);
        if (e.restartType) ball.allowOut = false;
        break;
      }
      case 'firstTouch': if (from && ball.owner !== from) yield* ensureOwner(from); break;
      case 'looseBall': {
        if (S.aerial) {
          // headed away (or flicked on) at the top of the jump
          const a = S.aerial; S.aerial = null;
          yield* until(() => S.t >= a.at, a.at - S.t + 0.5);
          // nobody got his head to it: it drops and runs loose
          if (!a.winner.motion || rt.contactDistance(a.winner, ball.p) > 0.45) { stats.misses = (stats.misses || 0) + 1; break; }
          noteContact('aerial', a.winner);
          ball.owner = null; a.winner.lastTouch = S.t;
          rt.kickAir(V(a.to.x, BALL_R, a.to.z), Math.max(0.7, ball.p.distanceTo(a.to) / 15));
          break;
        }
        if (!ball.owner && ball.v.length() > 1) break;     // already loose from the previous action
        const tgt = toWorld(e.toPos);
        if (ball.owner) { ball.owner = null; }
        if (e.reason === 'aerial') rt.kickAir(V(tgt.x, BALL_R, tgt.z), Math.max(0.6, ball.p.distanceTo(tgt) / 15));
        else rt.kickGround(tgt, 0.8);
        break;
      }
      case 'recovery': if (to) yield* ensureOwner(to); break;
      case 'shot': yield* shot(e, i); break;
      case 'goal': {
        hooks.banner('GOL', 2600); hooks.excite(1);
        const scorer = P(e.fromId, e.fromSide) || P(e.playerId);
        yield* celebrate(scorer);
        hooks.excite(0.2);
        break;
      }
      case 'ballOut': {
        if (e.restartType === 'FREE_KICK' || e.restartType === 'PENALTY') {
          // a whistle (foul, offside), not the ball leaving the pitch: play stops where it is
          ball.owner = null; ball.v.multiplyScalar(0.3); S.dead = true; hooks.whistle();
          if (RESTART_LABEL[e.restartType]) hooks.banner(e.restartType === 'FREE_KICK' && events[i - 1]?.type === 'offside' ? 'OFSAYT' : RESTART_LABEL[e.restartType], 1500);
          yield* wait(0.7);
          break;
        }
        ball.allowOut = true;
        const outW = toWorld(e.fromPos || e.toPos || [50, 50]);
        if (!ball.out && !ball.held) {
          // the ball runs out where the engine says it went out (a ball in the air carries on and drops)
          ball.owner = null;
          const far = Math.hypot(outW.x - ball.p.x, outW.z - ball.p.z);
          if (ball.p.y > 0.3 || far > 12) rt.kickAir(V(outW.x, BALL_R, outW.z), Math.max(0.6, far / 15));
          else rt.kickGround(outW, Math.max(2.5, Math.min(6, Math.hypot(ball.v.x, ball.v.z) * 0.6)));
        }
        yield* until(() => ball.out, 3);
        S.dead = true;
        if (RESTART_LABEL[e.restartType]) hooks.banner(RESTART_LABEL[e.restartType], 1500);
        if (e.restartType === 'CORNER') { hooks.excite(0.7); hooks.cam('stand'); }
        break;
      }
      case 'restartPosition': {
        S.dead = true; ball.allowOut = true;
        const spot = toWorld(e.toPos);
        const taker = to || from;
        const type = e.restartType;
        yield* wait(0.6);
        ball.held = null; ball.owner = null; ball.v.set(0, 0, 0);
        if (type === 'THROW_IN') spot.z = Math.sign(spot.z || 1) * 34.05;
        if (type === 'CORNER') { spot.x = Math.sign(spot.x || 1) * 52.2; spot.z = Math.sign(spot.z || 1) * 33.7; }
        if (type === 'GOAL_KICK' && taker) {
          // opponents leave the penalty area until the goal kick is taken
          const gs = Math.sign(spot.x || 1), edge = gs * (GOAL_X - 16.5 - 1.5);
          for (const q of rt.players) if (!q.offPitch && q.side !== taker.side && q.role !== 'GK' && Math.abs(q.pos.x) > GOAL_X - 17 && Math.sign(q.pos.x) === gs && Math.abs(q.pos.z) < 21) {
            q.target.set(edge, 0, q.pos.z); q.want = 4.5; q.runUntil = S.t + 4; q.face = ball.p;
          }
        }
        ball.p.set(spot.x, BALL_R, spot.z);
        S.restartSpot = taker && (type === 'FREE_KICK' || type === 'CORNER') ? { spot: spot.clone(), side: taker.side } : null;
        if (taker) {
          taker.busy = true;
          // throw-in: taker behind the line; corner/free kick: a short run-up behind the ball
          // a direct free kick: the taker stands a few steps back, in line with the goal, for his run-up
          const directFK = type === 'FREE_KICK' && events.slice(i + 1, i + 5).some(x => x.type === 'shot' && x.freeKick);
          const toGoalDir = V(Math.sign(spot.x || 1) * GOAL_X - spot.x, 0, -spot.z).normalize();
          const atGoal = directFK || type === 'PENALTY';      // a shot at goal: he stands behind the ball, facing the goal
          S.fkHomes = directFK ? freeKickHomes(spot, toGoalDir, taker, events.slice(i, i + 3).find(x => x.type === 'restartPlayers')?.arranged) : null;
          if (S.fkHomes) layout(i, false);
          const outward = type === 'THROW_IN' ? V(0, 0, Math.sign(spot.z) * 0.45) : atGoal ? toGoalDir.clone().multiplyScalar(type === 'PENALTY' ? -1.8 : -2.6) : V(spot.x, 0, spot.z).setY(0).normalize().multiplyScalar(0.7);
          taker.target.copy(spot).add(outward).setY(0); taker.want = taker.pos.distanceTo(spot) > 8 ? 7 : 4.5; taker.face = atGoal ? V(Math.sign(spot.x || 1) * GOAL_X, 0, 0) : V(0, 0, 0); taker.faceLock = false;
          yield* until(() => taker.pos.distanceTo(taker.target) < 0.6, taker.pos.distanceTo(taker.target) / 5 + 2);
          // the last step onto the spot (at walking pace, no jump)
          const from0 = taker.pos.clone(), t0 = S.t, step = Math.max(0.15, from0.distanceTo(taker.target) / 2.2);
          yield* until(() => { const k = Math.min(1, (S.t - t0) / Math.max(1e-3, step)); taker.pos.lerpVectors(from0, taker.target, k * k * (3 - 2 * k)); taker.vel.multiplyScalar(0.8); return k >= 1; }, step + 0.1);
          taker.heading = atGoal ? Math.atan2(toGoalDir.x, toGoalDir.z) : Math.atan2(-taker.pos.x * (type === 'THROW_IN' ? 0.3 : 1), -taker.pos.z);
          if (type === 'THROW_IN') { taker.loopsWant.throwHold = 1; taker.loops.throwHold = 1; ball.held = rt.pickUp(() => rt.handsOf(taker), 0.5); }
          ball.owner = taker; S.restartTaker = taker;     // he stays on the ball until the restart is taken
        }
        break;
      }
      case 'restartPlayers': yield* wait(e.restartType === 'FREE_KICK' || e.restartType === 'THROW_IN' ? 0.4 : 0.8); break;
      case 'restartWait': {
        // the restart is taken once the players are (nearly) in place for it — a real pause, short for a throw-in
        const R = S.restartSpot, close = p => R && p.side !== R.side && p.role !== 'GK' && p.pos.distanceTo(R.spot.clone().setY(0)) < 8.5;
        const far = () => rt.players.filter(p => { const k = p.side + ':' + p.id, q = S.restartHomes?.[k]; return q && !p.offPitch && !p.busy && (S.fkHomes?.[k] || toWorld(q)).distanceTo(p.pos) > (S.fkHomes?.[k] ? 1.2 : 3); }).length;
        const near = () => rt.players.some(p => !p.offPitch && !p.busy && close(p));
        yield* until(() => far() <= 2 && !near(), e.restartType === 'THROW_IN' ? 1.2 : e.restartType === 'CORNER' ? 4.5 : 4);
        // a direct free kick: the camera goes behind the taker, wall and goal in the picture
        const fkShot = e.restartType === 'FREE_KICK' && events[i + 1]?.type === 'shot' && events[i + 1].freeKick ? events[i + 1] : null;
        if (fkShot) { const tk = P(fkShot.fromId, fkShot.fromSide), gk0 = rt.players.find(q => q.role === 'GK' && q.side !== fkShot.fromSide && !q.offPitch); if (tk) hooks.cam('shot', tk, gk0, true); hooks.banner('SERBEST VURUŞ', 1500); yield* wait(1.4); break; }
        yield* wait(0.4); if (e.restartType !== 'CORNER') hooks.cam('tv'); break;
      }
      case 'offside': {
        // the pass is played to the man beyond the line; the flag goes up as it is played, the line is shown
        const passer = e.fromId != null ? P(e.fromId, e.fromSide) : ball.owner, rec = P(e.toId, e.toSide);
        if (passer && rec && passer !== rec && ball.owner !== passer && (!ball.owner || ball.owner.side === passer.side)) yield* ensureOwner(passer);
        // the line the viewer can see: the second-last defender on the pitch now (keeper included),
        // never inside the attackers' own half; the receiver is beyond it when the ball is played
        const keeper = keeperOf(rec ? (rec.side === 'user' ? 'opp' : 'user') : 'opp'), g = Math.sign(keeper?.pos.x || toWorld(e.toPos).x || 1);
        const lineNow = () => Math.max(rt.players.filter(q => !q.offPitch && rec && q.side !== rec.side).map(q => q.pos.x * g).sort((a, b) => b - a)[1] ?? 0, 0) * g;
        let line3D = lineNow();
        if (passer && rec && passer !== rec && ball.owner === passer) {
          // the passer waits for the run: the ball is played once the receiver is beyond the line
          // (a run that starts too far back takes a moment, the passer holds the ball meanwhile)
          if ((rec.pos.x - line3D) * g < 0.6) {
            passer.busy = true; rec.busy = true; rec.want = 7;
            yield* until(() => { line3D = lineNow(); rec.target.set(line3D + g * 3, 0, toWorld(e.toPos).z); return (rec.pos.x - line3D) * g > 0.6; }, 3.5);
            rec.busy = false;
          }
          line3D = lineNow();
          const toW = toWorld(e.toPos);
          if (toW.x * g < line3D * g + 1.2) toW.x = line3D + g * Math.max(1.5, Math.min(4, rec.pos.x * g - line3D * g + 1));
          rec.target.copy(toW); rec.want = 6.5; rec.runUntil = S.t + 2; rec.face = null;
          passer.busy = true;
          const dir = V(toW.x - ball.p.x, 0, toW.z - ball.p.z);
          yield* approachKick(passer, 'pass', dir);
          dir.set(toW.x - ball.p.x, 0, toW.z - ball.p.z);
          rt.startAction(passer, 'pass'); rt.kickWarp(passer, 'pass', dir);
          yield* until(() => rt.actionAtContact(passer), 2);
          rt.kickGround(toW, 4.5, 0.7); passer.busy = false;
        }
        hooks.offsideLine?.(line3D);
        hooks.whistle(); hooks.banner('OFSAYT', 1500);
        yield* wait(1.0);
        break;
      }
      case 'foul': {
        // the foul is a challenge you can see: the fouler goes in on the man with the ball, who is
        // stopped (or plays on when the referee gives advantage), then the whistle
        const def = P(e.fromId, e.fromSide), car = P(e.toId, e.toSide) || ball.owner;
        if (def && car && def !== car && !def.offPitch && def.pos.distanceTo(car.pos) < 25) {
          def.busy = car.busy = true;
          const goal = car.pos.clone().add(V(Math.sin(car.heading) * 6, 0, Math.cos(car.heading) * 6));
          goal.x = clamp(goal.x, -49, 49); goal.z = clamp(goal.z, -31, 31);
          yield* until(() => {
            if (ball.owner === car) rt.dribble(car, goal, 3.2); else { car.target.copy(goal); car.want = 3.2; }
            def.target.copy(car.pos).add(V(Math.sin(car.heading) * 0.8, 0, Math.cos(car.heading) * 0.8)); def.want = 7; def.face = car.pos; def.faceLock = false;
            return def.pos.distanceTo(car.pos) < 1.3;
          }, 1.6);
          rt.startAction(def, 'lunge');
          if (!e.advantage) { rt.startAction(car, 'feint'); car.vel.multiplyScalar(0.2); car.want = 0; car.target.copy(car.pos); if (ball.owner === car) { ball.owner = null; ball.v.multiplyScalar(0.25); } }
          yield* wait(0.35);
          def.busy = car.busy = false;
        }
        if (e.advantage) hooks.banner('AVANTAJ', 1300); else hooks.whistle();
        yield* wait(0.5); break;
      }
      case 'yellow': { const who = P(e.playerId, e.side === (meta.userHome ? 0 : 1) ? 'user' : 'opp'); hooks.banner('SARI KART' + (who?.name ? ' · ' + who.name : ''), 1600); if (who) hooks.cam('close', who, null); yield* wait(1.3); hooks.cam('tv'); break; }
      case 'red': { const who = P(e.playerId, e.side === (meta.userHome ? 0 : 1) ? 'user' : 'opp'); hooks.banner('KIRMIZI KART' + (who?.name ? ' · ' + who.name : ''), 1800); if (who) hooks.cam('close', who, null); yield* wait(1.5); hooks.cam('tv'); break; }
      case 'half': hooks.banner('DEVRE ARASI', 2600); yield* wait(2.8); break;
      case 'end': {
        // final whistle: play stops where it is, everyone eases up instead of freezing mid-stride
        hooks.whistle(); hooks.banner('MAÇ SONU', 99999); hooks.cam('tv');
        S.dead = true; ball.owner = null; ball.held = null; ball.v.multiplyScalar(0.25);
        for (const p of rt.players) {
          if (p.offPitch || p.dive) continue;
          p.busy = true; p.runUntil = 0; p.loopsWant.jockey = 0;
          p.target.copy(p.pos).addScaledVector(p.vel, 0.5); p.want = 1.2; p.face = null; p.faceLock = false;
        }
        yield* wait(2.4);
        hooks.finished();
        break;
      }
      default: break;
    }
  }

  // ---- driver ----
  const stats = { fixes: 0, implicitPasses: 0, closeUps: 0, stalls: 0, fixLog: [], stallLog: [], contacts: {} };
  // the ball had to be put at a player's feet because he could not reach it (diagnostics; should not happen)
  function noteFix(p, where) {
    stats.fixes++;
    const d = Math.hypot(ball.p.x - p.pos.x, ball.p.z - p.pos.z);
    stats.fixLog.push(`${events[idx - 1]?.type}${ball.p.y > 1 ? '-air' : ''}:${Math.round(d)}m`);
    if (opts.debug) (stats.fixDetail ||= []).push({ where, event: events[idx - 1]?.type, t: +S.t.toFixed(2), d: +d.toFixed(2), ballV: +Math.hypot(ball.v.x, ball.v.z).toFixed(2), ballY: +ball.p.y.toFixed(2), owner: ball.owner && (ball.owner.side + ':' + ball.owner.id), who: p.side + ':' + p.id, motion: p.motion?.name, act: p.act?.name, dive: !!p.dive, held: !!ball.held, dead: !!S.dead, out: ball.out, pos: p.pos.toArray().map(v => +v.toFixed(1)), ball: ball.p.toArray().map(v => +v.toFixed(1)) });
  }
  // how far the boot / forehead was from the ball when the recorded motion met it (diagnostics)
  function noteContact(kind, p) {
    const c = rt.contactPoint(p), list = (stats.contacts[kind] ||= []);
    list.push(c ? +rt.contactDistance(p, ball.p).toFixed(2) : -1);
    if (opts.debug) (stats.contactLog ||= []).push({ kind, t: +S.t.toFixed(2), m: p.motion && { name: p.motion.name, el: +(S.t - p.motion.t0).toFixed(3), to: p.motion.to?.toArray().map(v => +v.toFixed(2)) }, pos: p.pos.toArray().map(v => +v.toFixed(2)), c: c?.toArray().map(v => +v.toFixed(2)), ball: ball.p.toArray().map(v => +v.toFixed(2)), h: +p.heading.toFixed(2) });
  }
  let idx = opts.startIndex ?? 0, task = null;
  function nextTask() {
    while (idx < events.length) {
      const i = idx++, gen = run(events[i], i);
      const r = gen.next();
      if (!r.done) return { gen, i, started: S.t };
    }
    return null;
  }
  let sayQ = null;
  function flushSay() { if (sayQ) { const q = sayQ; sayQ = null; hooks.say(q.e.text, q.e); } }
  function update() {
    shape();
    if (!task) task = nextTask();
    let guard = 0;
    while (task && guard++ < 40) {
      const r = task.gen.next();
      if (!r.done) {
        if (S.t - task.started > 14) {     // safety: never freeze the match
          stats.stalls++; stats.stallLog.push(events[task.i]?.type);
          if (DEBUG) { const e = events[task.i], p = P(e.fromId, e.fromSide); (stats.stallDetail ||= []).push({ t: +S.t.toFixed(2), type: e.type, id: e.eventId, from: p && [p.id, p.pos.toArray().map(v => +v.toFixed(1)), p.busy, p.motion?.name, p.act?.name], owner: ball.owner?.id, ball: ball.p.toArray().map(v => +v.toFixed(1)), bv: +ball.v.length().toFixed(2), to: e.toPos && toWorld(e.toPos).toArray().map(v => +v.toFixed(1)) }); }
          task = nextTask(); continue;
        }
        break;
      }
      task = nextTask();
    }
    if (sayQ && ((S.kicks || 0) > sayQ.kicks || !task || task.i !== sayQ.i)) flushSay();
    for (const p of rt.players) if (p.dive) rt.updateDive(p);
  }

  // jump straight to the next shot: everybody to the engine positions of that moment
  function skipTo(type = 'shot') {
    let j = events.findIndex((e, k) => k >= idx && e.type === type);
    if (j < 0) return false;
    // start a few events earlier so the move leading to it is visible
    let s = j; for (let k = j - 1; k >= Math.max(idx, j - 6); k--) { if (['pass', 'cross', 'ballCarry', 'dribble'].includes(events[k].type)) s = k; else if (['kickoff', 'restartWait', 'goal', 'half'].includes(events[k].type)) break; }
    for (const p of rt.players) { p.busy = false; rt.place(p, p.pos); }
    layout(s, true);
    const e = events[s], owner = P(e.fromId, e.fromSide);
    for (let k = 0; k < s; k++) if (events[k].homeGoals != null) hooks.score(events[k].homeGoals, events[k].awayGoals);
    ball.held = null; ball.v.set(0, 0, 0);
    if (owner) { const w = toWorld(e.fromPos || [50, 50]); owner.pos.copy(w); ball.p.set(w.x + 0.5, BALL_R, w.z); ball.owner = owner; }
    idx = s; task = null; sayQ = null; hooks.slow(1); hooks.cam('tv', null, null, true);
    return true;
  }

  // live play: substitutions and red cards change who is on the pitch
  // The engine changes the line-up when it generates a minute, but the view plays that minute
  // afterwards: a player sent off or substituted must stay on until his red card / substitution
  // is reached, or he would vanish while his last actions are still being played.
  let pendingRoster = null;
  function syncRoster(list) {
    const changeAhead = events.slice(idx).some(e => e.type === 'red' || e.type === 'sub');
    if (changeAhead) { pendingRoster = list; return; }
    applyRoster(list);
  }
  function applyRoster(list) {
    pendingRoster = null;
    const want = new Set(list.map(r => key(r.side, r.id)));
    for (const r of list) {
      if (!by.has(key(r.side, r.id))) {
        const p = addFromRoster(r);
        const s = snaps.at(-1)?.pl.find(([id, side]) => id === r.id && side === r.side);
        rt.place(p, s ? toWorld(s[2]) : V(Math.sign(p.side === 'user' ? -1 : 1) * 20, 0, 36));
      }
    }
    for (const [k, p] of by) {
      const on = want.has(k), was = !p.offPitch;
      if (on === was) continue;
      p.model.visible = on; p.offPitch = !on;
      if (!on) { p.busy = true; if (ball.owner === p) ball.owner = null; }
      else p.busy = false;
    }
  }
  // jump to "now": used when the view becomes visible again in the middle of a match
  function resync(ownerId, ownerSide, ballPct) {
    idx = events.length; task = null; sayQ = null;
    for (const p of rt.players) { if (!p.offPitch) { p.busy = false; rt.place(p, p.pos); } }
    layout(Math.max(0, idx - 1), true);
    ball.held = null; ball.v.set(0, 0, 0); ball.allowOut = false; S.dead = false;
    if (S.restartTaker) { S.restartTaker.busy = false; S.restartTaker = null; } S.restartSpot = null; S.fkHomes = null;
    const w = toWorld(ballPct || [50, 50]); ball.p.set(w.x, BALL_R, w.z);
    ball.owner = ownerId != null ? P(ownerId, ownerSide) : null;
    if (ball.owner) { ball.owner.pos.set(w.x - 0.45, 0, w.z); }
  }
  if (idx === 0) { layout(0, true); ball.p.set(0, BALL_R, 0); }
  return {
    update, skipTo, stats, syncRoster, resync,
    get index() { return idx; }, get current() { return task ? events[task.i] : null; }, get total() { return events.length; },
    // the live presentation clock may show an engine event once the new view has started it;
    // a shot is held back until its outcome has played out, so the goal graphic never spoils it
    get progressId() {
      if (task) { const e = events[task.i]; return e.type === 'shot' ? e.eventId - 1 : e.eventId; }
      return idx < events.length ? (events[idx].eventId ?? Infinity) - 1 : Infinity;
    },
    get busy() { return !!task || idx < events.length; },
    players: rt.players,
  };
}
