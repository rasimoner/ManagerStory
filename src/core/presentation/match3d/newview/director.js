// Plays a real MatchEngine event log on the pitch runtime.
// The engine decides who does what and where; this file only decides how it looks.
import { V, clamp, toWorld, GOAL_X, BALL_R, MOTIONS } from './runtime.js';
import { ACTIONS } from './actions.js';
import { ramp, smooth01, spline } from './motion-curves.js';
import { forwardOf, rightOf } from './facing.js';
import { stepoverBeat, elasticoBeat, croquetaBeat } from './beats/feints.js';

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
    const p = rt.addPlayer({ key: key(r.side, r.id), id: r.id, side: r.side, team: r.side, name: r.name, role: r.role, no: r.no, kit, keeper: gk, moves: r.moves || [], stars: r.stars || 1 });
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
    const before = new Map(prev ? prev.pl.map(([id, side, pos]) => [side + ':' + id, pos]) : []);
    // V7.9.5: the teams change ends at half-time — they come out for the second half already in their new
    // halves (a keeper does not run the length of the pitch to his other goal)
    if (!teleport && prev && S.halfLaid !== s.n && s.pl.some(([id, side, pos]) => { const q = before.get(side + ':' + id); return q && P(id, side)?.role === 'GK' && Math.abs(q[0] - pos[0]) > 50; })) { teleport = true; S.halfLaid = s.n; }
    const u = teleport || !prev || s.n <= prev.n ? 1 : clamp((i - prev.n + 1) / (s.n - prev.n), 0, 1);
    const mix = (a, b) => (a ? [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u] : b);
    if (s.ball) S.snapBall = toWorld(mix(prev?.ball, s.ball));
    for (const [id, side, pos] of s.pl) {
      const p = P(id, side); if (!p) continue;
      p.home = toWorld(mix(before.get(side + ':' + id), pos));
      if (teleport) { rt.place(p, p.home); faceBall(p); }
      // V7.9.5 a keeper is never sent the length of the pitch to his goal (after half-time, a view coming back
      // from 2D): he is simply in it
      else if (p.role === 'GK' && !p.dive && !p.prone && !p.motion && ball.owner !== p && p.pos.distanceTo(p.home) > 45) { rt.place(p, p.home); faceBall(p); }
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
      yield* pass({ from: o, to: p, toW: p.pos.clone(), travel: 'ground', implicit: true });
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
    if (p.dive || p.prone) yield* until(() => !p.dive && !p.prone, 3);          // a keeper gets up before he kicks it out
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

  // V7.9.3 the keeper's volley out of his hands: he turns to his target and takes a couple of steps with the
  // ball held out in front, steps onto the left foot as he lets it go, and the right boot meets it in the air
  // (never off the grass) and sends it high and long
  function* gkVolley(gk, toW, range) {
    const hd = Math.atan2(toW.x - gk.pos.x, toW.z - gk.pos.z);
    gk.busy = true; gk.face = null; gk.faceLock = false; gk.loopsWant.keeperReady = 0;
    const F = () => forwardOf(gk), R = () => rightOf(gk);
    const holdAt = () => gk.pos.clone().addScaledVector(F(), 0.42).setY(1.0);
    ball.held = rt.pickUp(holdAt, 0.3); ball.owner = gk;
    const grip = side => ({ w: () => 1, at: () => ball.p.clone().addScaledVector(R(), side * 0.12).addScaledVector(F(), -0.04) });
    gk.hands = { Left: grip(-1), Right: grip(1) };
    // turn to the target, then a couple of steps forwards
    yield* until(() => { gk.target.copy(gk.pos); gk.want = 0; const d = Math.atan2(Math.sin(hd - gk.heading), Math.cos(hd - gk.heading)); gk.heading += clamp(d, -0.1, 0.1); return Math.abs(d) < 0.05; }, 1);
    gk.heading = hd;
    const run = gk.pos.clone().addScaledVector(F(), 2.4);
    yield* until(() => { gk.target.copy(run); gk.want = 2.6; gk.face = run.clone().addScaledVector(F(), 5); gk.faceLock = true; return gk.pos.distanceTo(run) < 1.2; }, 1.4);
    // the strike: the ball is let go so that it falls to knee height as the boot comes through
    const A = ACTIONS.gkVolley, tc = A.dur * A.contact, hit = 0.48, fall = Math.sqrt(2 * (1.0 - hit) / 9.81);
    rt.startAction(gk, 'gkVolley'); const t0 = S.t;
    gk.target.copy(gk.pos).addScaledVector(F(), 0.5); gk.want = 1.2;
    const audit = { kind: 'gkvolley', low: 9 };
    yield* until(() => S.t - t0 >= tc - fall, 1);
    const drop = ball.p.clone();
    ball.held = null; ball.through = S.t + 1.2; ball.v.copy(gk.vel).setY(0).multiplyScalar(0.9); audit.release = +drop.y.toFixed(2);
    const hw = ramp(S.t, [-1, 0, 0, 0.15]); gk.hands = { Left: { w: hw, at: () => drop.clone().addScaledVector(R(), -0.12) }, Right: { w: hw, at: () => drop.clone().addScaledVector(R(), 0.12) } };
    // the right boot goes to the falling ball
    gk.feet = { Right: { w: ramp(t0 + tc, [-0.2, -0.04, 0.06, 0.25]), at: () => ball.p.clone().addScaledVector(F(), -0.06) } };
    yield* until(() => { audit.low = Math.min(audit.low, ball.p.y); return S.t - t0 >= tc - 0.005 || (S.t - t0 > tc - 0.05 && toeGap(gk, 'Right') < 0.16); }, 1);
    Object.assign(audit, { contact: +toeGap(gk, 'Right').toFixed(3), h: +ball.p.y.toFixed(2), low: +audit.low.toFixed(2), range: +range.toFixed(1) });
    ball.owner = gk;
    rt.kickAir(V(toW.x, 0.3, toW.z), clamp(range / 22, 1.4, 3.2));      // (a long one flies flatter: never a 30 m high balloon)
    gk.lastTouch = S.t;
    (stats.gkVolleys ||= []).push(audit);
    const feet = gk.feet; later(0.4, () => { if (gk.feet === feet) gk.feet = null; gk.hands = null; });
    gk.faceLock = false; gk.target.copy(gk.pos); gk.want = 0;
    yield* wait(0.25);
  }
  function* pass({ from, to, toW, travel, implicit = false }, opts = {}) {
    from.busy = true;
    // V7.9.5: a keeper still down from his dive gets up (with his get-up) before he plays it
    if (from.role === 'GK' && keeperDown(from)) yield* until(() => !keeperDown(from), 3);
    if (DEBUG && from.role === 'GK') (stats.gkPassLog ||= []).push({ t: +S.t.toFixed(1), holding: !!from.holding, held: !!ball.held, own: ball.owner === from, hands: !!opts.ev?.fromHands, kind: opts.ev?.passKind });
    // settle the ball at the passer's feet first
    if (ball.owner !== from) yield* ensureOwner(from);
    from.busy = true;
    let dir = V(toW.x - ball.p.x, 0, toW.z - ball.p.z);
    const throwIn = opts.throwIn;
    let flight = 0, chest = false, trap = false, trapTried = false, kickT = 0, noLook = false, claim = false;
    // V7.9: a keeper with the ball in his hands throws it out overarm to a man close by; a longer one he
    // drops and kicks
    if (from.holding && ball.held && !throwIn) {
      from.holding = false;
      const range = Math.hypot(toW.x - from.pos.x, toW.z - from.pos.z);
      if (range <= 34 && from.A.gkThrow) {
        const hd = Math.atan2(dir.x, dir.z);
        yield* until(() => { from.target.copy(from.pos); from.want = 0; const d = hd - from.heading; from.heading += clamp(Math.atan2(Math.sin(d), Math.cos(d)), -0.12, 0.12); return Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) < 0.05; }, 0.8);
        from.heading = hd;
        const hand = () => from.bones.RightHand.getWorldPosition(V()).addScaledVector(forwardOf(from), 0.08);
        ball.held = rt.pickUp(hand, 0.2);
        rt.startMotion(from, 'gkThrow');
        yield* until(() => rt.motionAtContact(from), 1);
        const audit = { kind: 'gkthrow', hand: +hand().distanceTo(ball.p).toFixed(3), h: +ball.p.y.toFixed(2) };
        ball.held = null; from.lastTouch = S.t;
        rt.kickAir(V(toW.x, 0.3, toW.z), Math.max(0.55, range / 17));
        (stats.gkThrows ||= []).push(audit);
        from.lastPass = S.t; from.busy = false;
        if (!to) { yield* until(() => ball.v.length() < 2 || ball.p.distanceTo(V(toW.x, BALL_R, toW.z)) < 1.5, 4); return; }
        to.busy = true;
        if (!(yield* chase(to, toW))) { noteFix(to, 'pass'); ball.owner = to; ball.p.set(to.pos.x + Math.sin(to.heading) * .5, BALL_R, to.pos.z + Math.cos(to.heading) * .5); ball.v.set(0, 0, 0); }
        to.busy = false;
        return;
      }
      // V7.9.3: a longer one he volleys out of his hands (the ball dropped and struck before it lands)
      yield* gkVolley(from, toW, range);
      from.lastPass = S.t; from.busy = false;
      if (!to) { yield* until(() => ball.v.length() < 2 || ball.p.distanceTo(V(toW.x, BALL_R, toW.z)) < 1.5, 5); return; }
      to.busy = true;
      if (!(yield* chase(to, toW))) { noteFix(to, 'pass'); ball.owner = to; ball.p.set(to.pos.x + Math.sin(to.heading) * .5, BALL_R, to.pos.z + Math.cos(to.heading) * .5); ball.v.set(0, 0, 0); }
      to.busy = false;
      return;
    }
    if (throwIn) {
      from.heading = Math.atan2(dir.x, dir.z); from.target.copy(from.pos); from.want = 0;
      rt.startAction(from, 'throwIn'); from.loopsWant.throwHold = 0;
      if (!ball.held) ball.held = rt.pickUp(() => rt.handsOf(from));
      yield* until(() => rt.actionAtContact(from), 2);
      ball.held = null;
      rt.kickAir(V(toW.x, 0.4, toW.z), Math.max(0.6, dir.length() / 13));
    } else if (!(yield* flairPassTry({ from, to, toW, travel, implicit }, opts))) {
      // V7.9: a no-look pass — only a player who has it, in the opponents' half, not played backwards
      const fwdX = -Math.sign(ownGoalX(from.side)), len0 = Math.hypot(toW.x - from.pos.x, toW.z - from.pos.z);
      // V7.9: a backheel or a rabona — a player who has it, where it fits (or the staged scene)
      const special = passSpecial({ from, to, toW, travel, implicit }, opts);
      let specialDone = false;
      if (special) {
        specialDone = yield* (special.kind === 'backheel' ? backheelKick(from, toW) : rabonaKick(from, toW));
        if (!specialDone && special.tried) tryMove = special.kind;
      }
      const tryNL = !specialDone && tryMove === 'nolook' && from.side === 'user' && from.role !== 'GK';
      noLook = !specialDone && !!to && !opts.restart && !opts.meet && !throwIn && len0 > 5 && len0 < 30 && (tryNL || !implicit && travel === 'ground' && has(from, 'nolook') && zoneOk('nolook', from)
        && (toW.x - from.pos.x) * fwdX > -3 && len0 > 8 && (forced === 'nolook' || pick(opts.ev, 5) < 0.6));
      if (!specialDone) {
        let name = noLook ? 'nolook' : 'pass';
        dir = yield* approachAim(from, name, toW);
        // could not get set for it (the ball ran on, or it is still bouncing): an ordinary pass instead
        if (noLook) { const k = rt.kickNeed(from, name, dir); if (k.dist > k.reach + 0.05 || ball.p.y > BALL_R + 0.05 || Math.abs(ball.v.y) > 0.5 || (!tryNL && !zoneOk('nolook', from))) { noLook = false; name = 'pass'; dir = yield* approachAim(from, name, toW); } }
        rt.startAction(from, name); rt.kickWarp(from, name, dir);
        if (noLook) hooks.slow(0.45);
        yield* until(() => rt.actionAtContact(from), 2);
      } else dir = V(toW.x - ball.p.x, 0, toW.z - ball.p.z);
      kickT = S.t;
      if (noLook && tryNL) tryMove = null;
      if (noLook) {
        const toe = from.toes[1].getWorldPosition(V());
        noteSkill({ kind: 'nolook', contact: +Math.hypot(toe.x - ball.p.x, toe.z - ball.p.z).toFixed(3), len: +len0.toFixed(1), ...(DEBUG ? { dbg: { toe: toe.toArray().map(v => +v.toFixed(2)), ball: ball.p.toArray().map(v => +v.toFixed(2)), bv: ball.v.toArray().map(v => +v.toFixed(2)), pos: from.pos.toArray().map(v => +v.toFixed(2)), warpTo: from.warp?.to?.toArray().map(v => +v.toFixed(2)), owner: ball.owner?.key, el: +(S.t - from.act?.t0).toFixed(3), act: from.act?.name } } : {}) }, from);
      }
      // V7.9: a long ball dropping onto a man standing under it is taken on the chest
      const longBall = !!to && !opts.meet && !opts.restart && (travel === 'aerial' || dir.length() > 30) && to.role !== 'GK' && dir.length() > 22 && dir.length() < 50 && !to.motion && !to.dive;
      const under = longBall && to.pos.distanceTo(toW) < 1 + 4 * Math.max(0, dir.length() / 17 - 0.9);
      // V7.9: or killed dead with the boot by a player who has the touch (or the staged scene)
      const tryTrap = tryMove === 'trap' && to?.side === 'user' && longBall && to.pos.distanceTo(toW) < 1 + 5.5 * Math.max(0, dir.length() / 17 - 0.5);
      trap = tryTrap || (under && has(to, 'trap') && (to.used?.trap || 0) < 2 && pick(opts.ev, 37) < 0.45);
      chest = !trap && under && pick(opts.ev, 3) < 0.3;
      // V7.9: a high ball into his area that the keeper takes is caught at the top of a jump, arms up
      claim = !!to && to.role === 'GK' && to.side !== from.side && !opts.restart && !opts.meet && (travel === 'aerial' || dir.length() > 30)
        && to.pos.distanceTo(toW) < Math.min(6.5, 1 + 4.2 * Math.max(0, dir.length() / 17 - 0.65)) && !to.motion && !to.dive && Math.abs(toW.x) > GOAL_X - 18;   // only one he can get under in time
      if (tryTrap) trapTried = true;
      if (travel === 'aerial' || dir.length() > 30) { const L = dir.length(); flight = Math.max(0.7, L <= 45 ? L / 17 : 45 / 17 + (L - 45) / 35); rt.kickAir(V(toW.x, claim ? CLAIM_H : chest ? CHEST_H : trap ? TRAP_H : (opts.height ?? 0.25), toW.z), flight); }   // a long ball goes in the air
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
    if (claim && flight > 0) { yield* keeperClaim(to, toW, kickT + flight, opts.ev); to.busy = false; return; }
    if (chest) yield* chestControl(to, toW, kickT + flight);
    if (trap) { const done = yield* footTrap(to, toW, kickT + flight); if (trapTried) tryMove = done ? null : 'trap'; }
    // V7.9: Bergkamp's turn — back to goal with a man on him, the first touch sends the ball round one
    // side of the defender while he spins round the other
    const pir = !chest && !trap && flight === 0 ? pirouetteChance(to, toW, opts, implicit) : null;
    const ok = pir ? yield* pirouetteReceive(to, toW, pir) : yield* chase(to, toW);
    if (noLook) hooks.slow(1);
    if (!ok) { noteFix(to, 'pass'); ball.owner = to; ball.p.set(to.pos.x + Math.sin(to.heading) * .5, BALL_R, to.pos.z + Math.cos(to.heading) * .5); ball.v.set(0, 0, 0); }
    to.busy = false;
    if (implicit) stats.implicitPasses++;
  }

  // ---- V7.9 batch 3: passes and touches (boots placed with the foot targets) ----
  // which special pass, if any: a player who has it, where it fits, or the staged scene
  function passSpecial({ from, to, toW, travel, implicit }, opts) {
    if (!to || opts.restart || opts.meet || opts.throwIn || from.role === 'GK' || ball.owner !== from || ball.p.y > BALL_R + 0.05) return null;
    const len = Math.hypot(toW.x - from.pos.x, toW.z - from.pos.z), aim = V(toW.x - from.pos.x, 0, toW.z - from.pos.z).normalize(), fwdX = -Math.sign(ownGoalX(from.side));
    if (from.side === 'user' && tryMove === 'backheel' && len > 3 && len < 25) { tryMove = null; return { kind: 'backheel', tried: true }; }
    if (from.side === 'user' && tryMove === 'rabona' && len > 8 && len < 50) { tryMove = null; return { kind: 'rabona', tried: true }; }
    if (implicit) return null;
    const d = fromOwnGoal(from);
    // a little pass back to a team-mate behind him in the final third (V7.9.5: well inside it — turning his back
    // on the pass he steps back a little before the heel strikes it)
    if (has(from, 'backheel') && travel === 'ground' && len > 4 && len < 18 && d > 72 && aim.x * fwdX < -0.5 && pick(opts.ev, 23) < 0.45) return { kind: 'backheel' };
    if (has(from, 'rabona') && len > 12 && len < 45 && d > GOAL_X && pick(opts.ev, 27) < 0.25) return { kind: 'rabona' };
    return null;
  }

  // backheel: he turns his back on the pass with the ball, steps over it and plays it back with his heel
  function* backheelKick(p, toW) {
    const aim0 = V(toW.x - p.pos.x, 0, toW.z - p.pos.z).normalize(), face = aim0.clone().negate(), hw = Math.atan2(face.x, face.z);
    p.busy = true; ball.through = S.t + 2.5;
    const turned = yield* until(() => { rt.dribble(p, p.pos.clone().addScaledVector(face, 3), 1.4); const d = hw - p.heading; return Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) < 0.15; }, 1.4);
    if (!turned) { stats.lastFail = ['backheel', 'turn', +S.t.toFixed(1)]; return false; }      // not round with his back to the pass: a normal pass
    p.face = p.pos.clone().addScaledVector(face, 30); p.faceLock = true;
    const f = forwardOf(p), r = rightOf(p);
    const set = yield* until(() => {
      const rel = V(ball.p.x - p.pos.x, 0, ball.p.z - p.pos.z), a = rel.dot(f), l = Math.abs(rel.dot(r));
      p.target.copy(ball.p).addScaledVector(f, -0.2).setY(0); p.want = 1.2;          // he stops a little short of where he aims: the ball ends ~0.3 m ahead
      if (Math.hypot(ball.v.x, ball.v.z) > 0.6) ball.v.multiplyScalar(0.9);
      return a > 0.2 && a < 0.42 && l < 0.2;
    }, 1.6);
    if (!set) { p.faceLock = false; stats.lastFail = ['backheel', 'set', +S.t.toFixed(1)]; return false; }
    const t0 = S.t, b0 = ball.p.clone();
    p.vel.multiplyScalar(0.3); p.target.copy(p.pos); p.want = 0.2; ball.v.set(0, 0, 0); ball.through = t0 + 1.2;
    hooks.slow(0.5);
    const plantL = b0.clone().addScaledVector(r, -0.22).addScaledVector(f, -0.06).setY(0.03);
    const side = b0.clone().addScaledVector(r, 0.15).setY(0.05), over = b0.clone().addScaledVector(f, 0.27).addScaledVector(r, 0.03).setY(0.16);
    p.feet = {
      Left: { w: ramp(t0, [0, 0.08, 0.6, 0.8]), at: () => plantL },
      Right: { w: ramp(t0, [0, 0.06, 0.55, 0.75]), at: t => {
        const u = t - t0;
        if (u < 0.2) { const k = smooth01(u / 0.2); return side.clone().lerp(over, k); }               // over the ball
        return ball.p.clone().addScaledVector(f, 0.09 + 0.17).addScaledVector(r, 0.02).setY(0.07);     // the heel onto its far side
      } },
    };
    const audit = { kind: 'backheel', over: 9 };
    yield* until(() => {
      const u = S.t - t0, toe = p.feet.Right.last;
      if (toe && u > 0.06 && u < 0.2) audit.over = Math.min(audit.over, toe.distanceTo(ball.p));
      return u > 0.26 && heelOf(p, 'Right').distanceTo(ball.p) < 0.22;
    }, 0.55);
    audit.heel = +heelOf(p, 'Right').distanceTo(ball.p).toFixed(3); audit.over = +audit.over.toFixed(3);
    const aim = V(toW.x - ball.p.x, 0, toW.z - ball.p.z).normalize();
    audit.back = +Math.acos(clamp(aim.dot(f), -1, 1)).toFixed(2);
    noteSkill(audit, p);
    p.faceLock = false; p.lastTouch = S.t;
    const feet = p.feet; later(0.35, () => { hooks.slow(1); if (p.feet === feet) p.feet = null; });
    return true;
  }

  // rabona: the standing boot is planted on the far side of the ball and the kicking leg wraps round
  // behind it to strike the ball
  function* rabonaKick(p, toW) {
    const aim = V(toW.x - ball.p.x, 0, toW.z - ball.p.z).normalize(), rA = V(-aim.z, 0, aim.x);
    p.busy = true; ball.through = S.t + 4;
    p.face = p.pos.clone().addScaledVector(aim, 30); p.faceLock = true;
    const spot = () => ball.p.clone().addScaledVector(aim, -0.42).addScaledVector(rA, 0.32).setY(0);
    const set = yield* until(() => {
      const s0 = spot(), d = Math.hypot(p.pos.x - s0.x, p.pos.z - s0.z);
      p.target.copy(s0); p.want = d > 1.5 ? 4 : 1.1;
      ball.v.multiplyScalar(0.9);
      const hd = Math.atan2(aim.x, aim.z) - p.heading;
      return d < 0.12 && Math.abs(Math.atan2(Math.sin(hd), Math.cos(hd))) < 0.08 && Math.hypot(ball.v.x, ball.v.z) < 0.3;
    }, 3);
    if (!set) { p.faceLock = false; stats.lastFail = ['rabona', 'set', +S.t.toFixed(1)]; return false; }
    const t0 = S.t, b0 = ball.p.clone();
    hooks.slow(0.4);
    p.vel.multiplyScalar(0.2); p.target.copy(p.pos); p.want = 0.2; ball.v.set(0, 0, 0); ball.through = t0 + 1.2;
    const plantL = b0.clone().addScaledVector(rA, 0.2).addScaledVector(aim, -0.03).setY(0.03);
    const back = plantL.clone().addScaledVector(aim, -0.36).addScaledVector(rA, 0.14).setY(0.3);
    const behind = plantL.clone().addScaledVector(aim, -0.19).addScaledVector(rA, -0.02).setY(0.13);
    const hit = () => ball.p.clone().addScaledVector(aim, -0.12).addScaledVector(rA, -0.03).setY(0.06);
    p.feet = {
      Left: { w: ramp(t0, [0, 0.1, 0.55, 0.75]), at: () => plantL },
      Right: { w: ramp(t0, [0, 0.08, 0.5, 0.7]), at: t => {
        const u = t - t0;
        if (u < 0.22) return back;                                                     // drawn back, outside the standing leg
        if (u < 0.36) { const k = (u - 0.22) / 0.14, h = hit(), [x, z] = spline([[back.x, back.z], [behind.x, behind.z], [h.x, h.z]], k); return V(x, 0.3 - 0.24 * smooth01(k), z); }
        return hit();
      } },
    };
    const audit = { kind: 'rabona', behind: 9 };
    yield* until(() => {
      const u = S.t - t0, toe = p.feet.Right.last;
      if (toe && u > 0.24 && u < 0.36) { const rel = toe.clone().sub(plantL); if (Math.abs(rel.dot(rA)) < 0.1) audit.behind = Math.min(audit.behind, rel.dot(aim)); }
      return u > 0.32 && toeGap(p, 'Right') < 0.24;
    }, 0.55);
    const rt0 = p.feet.Right.last, lt0 = p.feet.Left.last;
    audit.contact = +toeGap(p, 'Right').toFixed(3);
    audit.crossed = !!(rt0 && lt0) && rt0.clone().sub(lt0).dot(rA) < -0.03;
    audit.behind = +audit.behind.toFixed(3);
    noteSkill(audit, p);
    p.faceLock = false; p.lastTouch = S.t;
    const feet = p.feet; later(0.35, () => { hooks.slow(1); if (p.feet === feet) p.feet = null; });
    return true;
  }

  // a ball dropping out of the sky killed dead with the boot: he gets under it, lifts the foot to meet
  // it and lets it settle at his feet
  const TRAP_H = 0.8;
  function* footTrap(p, spot, tArr) {
    let started = false, done = false, f = null;
    yield* until(() => {
      const left = tArr - S.t;
      const bv = V(ball.v.x, 0, ball.v.z), sp = bv.length(); if (sp > 0.1) f = bv.clone().multiplyScalar(-1 / sp);
      const fw = f || forwardOf(p), rr = V(-fw.z, 0, fw.x);
      const arrive = ball.p.clone().addScaledVector(bv, Math.max(0, left)).setY(0);
      if (!started) {
        p.target.copy(arrive).addScaledVector(fw, -0.5).addScaledVector(rr, -0.12);
        const gap = Math.hypot(p.target.x - p.pos.x, p.target.z - p.pos.z);
        p.want = gap > 2 ? 6.5 : gap > 0.08 ? Math.min(3, 1 + gap * 4) : 0; p.face = ball.p; p.faceLock = left < 1.2;
        if (left <= 0.35) {
          if (gap > 0.6 || p.vel.length() > 2.2) return true;               // not under it in time: he plays it as it comes
          started = true; ball.through = tArr + 0.6; hooks.slow(0.5);
          // the boot goes to where the ball will be at shin height and waits for it there
          p.feet = { Right: { w: ramp(S.t, [0, 0.18, 0.55, 0.75]), at: () => {
            const vy = ball.v.y, y = ball.p.y, g = 9.81, hy = 0.62;
            const tt = y <= hy ? 0 : (vy + Math.sqrt(Math.max(0, vy * vy + 2 * g * (y - hy)))) / g;
            return ball.p.clone().add(V(ball.v.x * tt, 0, ball.v.z * tt)).setY(Math.max(0.05, Math.min(y, hy) - 0.1)).addScaledVector(forwardOf(p), 0.04);
          } } };
        }
        return false;
      }
      if (toeGap(p, 'Right') < 0.22 && ball.v.y < 0 && ball.p.y < 0.8) { done = true; return true; }
      return ball.p.y < 0.2 || S.t > tArr + 0.3;
    }, tArr - S.t + 0.8);
    if (!started) { p.faceLock = false; return false; }
    const audit = { kind: 'trap', toe: +toeGap(p, 'Right').toFixed(3), h: +ball.p.y.toFixed(2), done };
    ball.v.copy(forwardOf(p)).multiplyScalar(0.4).setY(-0.6); p.lastTouch = S.t;
    noteSkill(audit, p);
    yield* until(() => ball.p.y < 0.2, 0.6);
    hooks.slow(1); p.feet = null; p.faceLock = false;
    return done;
  }
  // a little job for later (sim time), outside any event
  const laterQ = [];
  function later(dt, fn) { laterQ.push({ at: S.t + dt, fn }); }
  // who turns his man with the first touch: a player who has it, back to goal in the final third with a
  // defender tight behind him (or the staged scene)
  function pirouetteChance(to, toW, opts, implicit) {
    if (!to || to.role === 'GK' || opts.restart || opts.throwIn || opts.meet) return null;
    const tryIt = tryMove === 'pirouette' && to.side === 'user';
    const goal = V(-ownGoalX(to.side), 0, 0), spot = V(toW.x, 0, toW.z);
    const back = V(ball.p.x - spot.x, 0, ball.p.z - spot.z).normalize();            // he faces the ball as it comes
    const toGoal = goal.clone().sub(spot).normalize();
    if (!tryIt) {
      if (implicit || !has(to, 'pirouette') || fromOwnGoal(to) < 70 || back.dot(toGoal) > -0.4 || pick(opts.ev, 41) > 0.5) return null;
      const def = nearestOpp(to, 2.6);
      if (!def || def.pos.clone().sub(spot).dot(toGoal) < 0.3) return null;
      return { def, tried: false };
    }
    const def = nearestOpp(to, 25);
    if (!def) return null;
    tryMove = null;
    return { def, tried: true };
  }
  function* pirouetteReceive(R, toW, pir) {
    const D = pir.def;
    // he comes to the ball, the defender right behind him
    const ok0 = yield* until(() => {
      const f = V(ball.p.x - R.pos.x, 0, ball.p.z - R.pos.z), d = f.length(); f.normalize();
      R.target.copy(toW).setY(0); R.want = Math.hypot(toW.x - R.pos.x, toW.z - R.pos.z) > 1 ? 5 : 1; R.face = ball.p; R.faceLock = true;
      D.busy = true; D.target.copy(R.pos).addScaledVector(f, -1.15); D.want = 6; D.face = R.pos; D.faceLock = true;
      return d < 2.2 && D.pos.distanceTo(R.pos) < 1.6;
    }, 5);
    if (!ok0) { D.busy = false; D.faceLock = false; R.faceLock = false; if (pir.tried) tryMove = 'pirouette'; return yield* chase(R, toW); }
    const f = forwardOf(R), r = rightOf(R), R0 = R.pos.clone(), h0 = R.heading, t0 = S.t;
    hooks.cam('close', R, D); hooks.slow(0.4);
    ball.through = t0 + 2;
    // the left boot meets the ball on its left side and sends it round the defender's left (his right)
    const ballTo = R0.clone().addScaledVector(f, -2.5).addScaledVector(r, 1.25);
    R.feet = { Left: { w: ramp(t0, [0, 0.1, 0.5, 0.65]), at: () => ball.p.clone().addScaledVector(r, -0.12).addScaledVector(f, 0.02).setY(0.06) } };
    const audit = { kind: 'pirouette' };
    const met = yield* until(() => { R.target.copy(R.pos); R.want = 0; return toeGap(R, 'Left') < 0.22 && V(ball.p.x - R.pos.x, 0, ball.p.z - R.pos.z).dot(f) < 0.55; }, 1.2);
    if (!met) {      // the ball never reached his boot: no turn, he just goes and gets it
      R.feet = null; R.faceLock = false; D.busy = false; D.faceLock = false; hooks.slow(1); hooks.cam('tv');
      stats.lastFail = ['pirouette', 'touch', +S.t.toFixed(1)]; if (pir.tried) tryMove = 'pirouette';
      return yield* chase(R, null);
    }
    audit.touch = +toeGap(R, 'Left').toFixed(3);
    const dir = ballTo.clone().sub(ball.p).setY(0), len = dir.length();
    ball.v.copy(dir.normalize()).multiplyScalar(Math.min(4.6, 1.2 + len * 1.3)); ball.owner = null; R.lastTouch = S.t;
    hooks.cam('tv');            // as he spins past, a close-up behind him would swing round onto the defender
    // he spins round the other side: half a turn to his left on an arc past the defender's right
    const path = [[R0.x, R0.z], [R0.x - r.x * 0.75 - f.x * 0.35, R0.z - r.z * 0.75 - f.z * 0.35], [R0.x - r.x * 0.7 - f.x * 1.7, R0.z - r.z * 0.7 - f.z * 1.7], [ballTo.x, ballTo.z]];
    const T = 1.0, t1 = S.t;
    R.drive = { heading: t => h0 + Math.PI * smooth01(clamp((t - t1) / (T * 0.8), 0, 1)), pos: t => { const [x, z] = spline(path, smooth01(clamp((t - t1) / T, 0, 1)) * 0.92); return V(x, 0, z); } };
    rt.startAction(D, 'lungeL'); D.loopsWant.jockey = 0; D.target.copy(D.pos).addScaledVector(r, -0.6); D.want = 2;          // he goes with the man, not the ball
    let minD = 9, ballSide = 0, manSide = 0;
    yield* until(() => {
      minD = Math.min(minD, Math.hypot(ball.p.x - D.pos.x, ball.p.z - D.pos.z));
      const bs = V(ball.p.x - D.pos.x, 0, ball.p.z - D.pos.z), ms = V(R.pos.x - D.pos.x, 0, R.pos.z - D.pos.z);
      if (!ballSide && bs.dot(f) < 0) ballSide = Math.sign(bs.dot(r));
      if (!manSide && ms.dot(f) < 0) manSide = Math.sign(ms.dot(r));
      return S.t - t1 >= T * 0.92;
    }, T + 0.2);
    Object.assign(audit, { aroundBall: +minD.toFixed(2), sides: ballSide * manSide });
    noteSkill(audit, R);
    R.drive = null; R.feet = null; R.faceLock = false; R.heading = h0 + Math.PI;
    hooks.slow(1); hooks.cam('tv');
    rt.startAction(D, 'stumble'); D.want = 0.5;
    later(0.6, () => { D.busy = false; D.faceLock = false; });
    return yield* chase(R, null);
  }
  // V7.9: the keeper claims a high ball: he gets under it, goes up and takes it in both hands above his
  // head (the gloves reach for the ball), lands with it, and keeps it in his hands if his next touch is a pass
  const CLAIM_H = 2.2;
  // V7.9.3 a high ball into his box with a man challenging: the keeper comes, goes up and punches it clear
  // with both fists (arms driven out through the ball at the top of the jump); it flies out to where the
  // engine says it lands
  const PUNCH_H = 2.2;
  function* keeperPunch(gk, spot, tArr, land, rival) {
    gk.busy = true; gk.loopsWant.keeperReady = 0;
    const lead = MOTIONS.header.contact;
    let jumped = false;
    const trace = DEBUG ? [[+S.t.toFixed(2), ...ball.p.toArray().map(v => +v.toFixed(2)), ...ball.v.toArray().map(v => +v.toFixed(1))]] : null;
    if (rival && !rival.busy) jumpFor(rival, { spot: spot.clone().setY(rt.headHeight).add(V(-Math.sign(spot.x) * 0.6, 0, 0.3)), heading: headingOf(V(spot.x - rival.pos.x, 0, spot.z - rival.pos.z).normalize(), V(0, 0, 0)), tArr, late: 0.12, short: 0.35 });
    const out = V(land.x - spot.x, 0, land.z - spot.z).normalize();
    let best = Infinity;
    yield* until(() => {
      const left = tArr - S.t, toward = V(ball.p.x - gk.pos.x, 0, ball.p.z - gk.pos.z).normalize();
      gk.face = ball.p; gk.faceLock = true;
      if (!jumped) {
        // he stands just past the spot along the ball's line, facing it, so the punch meets it in front of him
        const fly = V(ball.v.x, 0, ball.v.z), down = fly.lengthSq() > 1 ? fly.normalize() : toward.clone().negate();
        gk.target.copy(spot).addScaledVector(down, 0.3).setY(0);
        const gap = Math.hypot(gk.target.x - gk.pos.x, gk.target.z - gk.pos.z);
        gk.want = gap > 2 ? 7.5 : gap > 0.05 ? Math.max(2.2, 1.5 + gap * 3) : 0;
      }
      if (!jumped && left <= lead) {
        rt.startMotion(gk, 'header'); jumped = true; gk.want = 0;
        // fists cocked by his face, then driven out through the ball and on (the punch), then down
        const t0 = S.t, R = () => rightOf(gk), hw = ramp(t0, [0, 0.12, lead + 0.18, lead + 0.45]);
        const face = () => gk.bones.Head.getWorldPosition(V()).addScaledVector(forwardOf(gk), 0.22).add(V(0, -0.05, 0));
        let hit = null;
        // V7.9.5: the fists go for the ball itself once it is close to the spot (a steep, dropping cross passes
        // the spot a little early or low; a keeper punches the ball, not the place he expected it)
        const aim = () => (ball.p.distanceTo(spot) < 1.6 ? ball.p.clone() : spot.clone());
        const fist = side => t => {
          const k = smooth01(clamp((t - (t0 + lead - 0.16)) / 0.16, 0, 1));
          if (t >= t0 + lead + 0.1 && !hit) hit = aim();     // (tracks the ball through the planned contact frame)
          const at = face().lerp(hit || aim(), k);          // (the ball reaches the spot on the contact frame)
          if (t > t0 + lead) at.addScaledVector(out, Math.min(0.3, (t - t0 - lead) * 2.5)).add(V(0, Math.min(0.15, (t - t0 - lead) * 1.2), 0));
          return at.addScaledVector(R(), side * 0.045);
        };
        gk.hands = { Left: { w: hw, at: fist(-1) }, Right: { w: hw, at: fist(1) } };
      }
      // the contact is the frame the ball is closest to his fists (it passes the spot on about the planned frame)
      if (trace && trace.length < 400) trace.push([+S.t.toFixed(2), ...ball.p.toArray().map(v => +v.toFixed(2)), ...ball.v.toArray().map(v => +v.toFixed(1))]);
      if (!jumped) return false;
      const d = rt.handsOf(gk).distanceTo(ball.p);
      if (d < 0.2) return true;
      if (S.t >= tArr - 0.08) { if (d > best + 0.02 || S.t > tArr + 0.1) return true; best = Math.min(best, d); }
      return false;
    }, Math.max(0.2, tArr - S.t) + 1);
    const reach = Math.min(best, rt.handsOf(gk).distanceTo(ball.p));
    const audit = { kind: 'punch', fists: +reach.toFixed(3), h: +ball.p.y.toFixed(2), out: +Math.hypot(land.x - ball.p.x, land.z - ball.p.z).toFixed(1), ...(DEBUG ? { t: +S.t.toFixed(2), late: +(S.t - tArr).toFixed(2), jumped, kick: stats.crossLog?.at(-1), trace: trace?.filter((x, i, a) => i % 10 === 0 || i === a.length - 1), bv: ball.v.toArray().map(v => +v.toFixed(1)), via: gk.punchVia, gk: gk.pos.toArray().map(v => +v.toFixed(2)), spot: spot.toArray().map(v => +v.toFixed(2)), ball: ball.p.toArray().map(v => +v.toFixed(2)) } : {}) };
    (stats.punches ||= []).push(audit);
    if (reach < 0.45) {
      (stats.contacts.punch ||= []).push(+reach.toFixed(2));
      ball.owner = null; gk.lastTouch = S.t;
      rt.kickAir(V(land.x, BALL_R, land.z), Math.max(0.9, Math.hypot(land.x - ball.p.x, land.z - ball.p.z) / 16));
    } else stats.misses = (stats.misses || 0) + 1;
    const hands = gk.hands;
    later(0.6, () => { if (gk.hands === hands) gk.hands = null; gk.faceLock = false; gk.busy = false; });
  }
  function* keeperClaim(gk, spot, tArr, ev) {
    gk.busy = true; gk.loopsWant.keeperReady = 0;
    const lead = MOTIONS.header.contact;
    let jumped = false;
    yield* until(() => {
      const left = tArr - S.t, toward = V(ball.p.x - gk.pos.x, 0, ball.p.z - gk.pos.z).normalize();
      gk.face = ball.p; gk.faceLock = true;
      if (!jumped) {
        gk.target.copy(spot).addScaledVector(toward, -0.3).setY(0);
        const gap = Math.hypot(gk.target.x - gk.pos.x, gk.target.z - gk.pos.z);
        gk.want = gap > 2 ? 7 : gap > 0.1 ? 1.5 + gap * 3 : 0;
      }
      if (!jumped && left <= lead) {
        rt.startMotion(gk, 'header'); jumped = true; gk.want = 0;
        const hw = ramp(S.t, [0, 0.2, lead + 0.12, lead + 0.4]), R = () => rightOf(gk);
        gk.hands = { Left: { w: hw, at: () => ball.p.clone().addScaledVector(R(), -0.1) }, Right: { w: hw, at: () => ball.p.clone().addScaledVector(R(), 0.1) } };
      }
      return jumped && (rt.handsOf(gk).distanceTo(ball.p) < 0.22 || S.t > tArr + 0.1);
    }, Math.max(0.2, tArr - S.t) + 1);
    const reach = rt.handsOf(gk).distanceTo(ball.p);
    if (reach > 0.4 || ball.p.y < 1.6) {      // he did not get there (or it had dropped below his reach up): he gathers it as it comes instead: no catch out of thin air, he gathers it as it comes
      gk.hands = null; gk.faceLock = false; stats.lastFail = ['claim', 'reach', +S.t.toFixed(1)];
      const ok = yield* chase(gk, null);
      if (!ok) { noteFix(gk, 'pass'); ball.owner = gk; ball.p.set(gk.pos.x + Math.sin(gk.heading) * .5, BALL_R, gk.pos.z + Math.cos(gk.heading) * .5); ball.v.set(0, 0, 0); }
      gk.busy = false; return false;
    }
    const audit = { kind: 'claim', hands: +reach.toFixed(3), h: +ball.p.y.toFixed(2), ...(DEBUG ? { t: +S.t.toFixed(2), tArr: +tArr.toFixed(2), gk: gk.pos.toArray().map(v => +v.toFixed(2)), spot: spot.toArray().map(v => +v.toFixed(2)) } : {}) };
    (stats.claims ||= []).push(audit);
    ball.held = rt.pickUp(() => rt.handsOf(gk), 0.06); ball.owner = gk; ball.v.set(0, 0, 0); gk.lastTouch = S.t;
    // he gathers it into his chest as he comes down
    const tc = S.t, chest = () => gk.bones.Spine2.getWorldPosition(V()).addScaledVector(forwardOf(gk), 0.26).add(V(0, -0.05, 0)), R = () => rightOf(gk);
    const gather = t => smooth01(clamp((t - tc) / 0.35, 0, 1)), hold = ramp(tc, [0, 0.001, 1.5, 1.9]);
    const at = side => t => ball.p && chest().lerp(gk.hands?.[side]?.last || chest(), 1 - gather(t)).addScaledVector(R(), side === 'Left' ? -0.12 : 0.12);
    gk.hands = { Left: { w: hold, at: at('Left') }, Right: { w: hold, at: at('Right') } };
    const hands = gk.hands; later(2, () => { if (gk.hands === hands) gk.hands = null; });
    yield* until(() => !gk.motion, 1.4);
    gk.faceLock = false;
    yield* wait(0.6);
    const i = events.indexOf(ev), next = i >= 0 ? events.slice(i + 1, i + 5).find(x => ['pass', 'cross', 'press', 'tackle', 'hold', 'dribble', 'ballCarry', 'interception', 'shot'].includes(x.type)) : null;
    if (next && next.type === 'pass' && next.fromId === gk.id && next.fromSide === gk.side) gk.holding = true;
    else { const f = forwardOf(gk); ball.held = null; ball.v.set(f.x * 0.9, 0, f.z * 0.9); }
    gk.busy = false;
    return true;
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
        const yAt = ball.p.y + ball.v.y * left - 4.905 * left * left, vyAt = ball.v.y - 9.81 * left;
        if (yAt < 1.15 || yAt > 1.65 || vyAt < -5) return true;           // not at chest height when it gets to him, or dropping too steeply to cushion
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
    const fw = forwardOf(p);
    ball.v.set(fw.x * 1.0, -0.4, fw.z * 1.0); p.lastTouch = S.t;
    noteSkill(audit, p);
    yield* until(() => ball.p.y < 0.3, 0.8);
    hooks.slow(1); p.faceLock = false;
  }

  // the pass in the middle of a step-over: a player who has it, in the opponents' half, a defender
  // right in front of him and a short pass on (or the staged scene); true when the pass has been played
  function nearestOpp(p, maxD) {
    return rt.players.filter(q => !q.offPitch && !q.busy && !q.dive && q.side !== p.side && q.role !== 'GK' && q.pos.distanceTo(p.pos) < maxD)
      .reduce((m, q) => (!m || q.pos.distanceTo(p.pos) < m.pos.distanceTo(p.pos) ? q : m), null);
  }
  function* flairPassTry({ from, to, toW, travel, implicit }, opts) {
    if (!to || opts.restart || opts.meet || opts.throwIn || from.role === 'GK') return false;
    const len = Math.hypot(toW.x - from.pos.x, toW.z - from.pos.z);
    const tryIt = tryMove === 'flairpass' && from.side === 'user' && len > 4 && len < 30;
    let def = nearestOpp(from, tryIt ? 16 : 3.2);
    if (!def) return false;
    if (!tryIt) {
      const ahead = def.pos.clone().sub(from.pos).dot(V(toW.x - from.pos.x, 0, toW.z - from.pos.z).normalize());
      if (implicit || travel !== 'ground' || !has(from, 'flairpass') || !zoneOk('flairpass', from) || len < 8 || len > 28 || ahead < 0.5 || pick(opts.ev, 21) >= 0.5) return false;
    }
    if (ball.owner !== from) return false;
    if (tryIt) tryMove = null;
    def.busy = true; from.busy = true; def.lastEvent ||= opts.ev || { eventId: 0 };
    // he faces the pass, the defender comes to block it
    const aim = V(toW.x - from.pos.x, 0, toW.z - from.pos.z).normalize();
    yield* until(() => {
      from.target.copy(from.pos); from.want = 0.3; from.face = toW; from.faceLock = true;
      def.target.copy(from.pos).addScaledVector(aim, 1.9); def.want = 5; def.face = from.pos; def.faceLock = true; def.loopsWant.jockey = 1;
      return def.pos.distanceTo(from.pos) < 2.6;
    }, tryIt ? 4 : 1);
    let ok = false;
    for (let k = 0; k < (tryIt ? 3 : 1) && !ok; k++) {
      if (k) yield* until(() => { from.target.copy(from.pos); from.want = 0.4; def.target.copy(from.pos).addScaledVector(aim, 1.9); def.want = 3; def.face = from.pos; def.faceLock = true; return def.pos.distanceTo(from.pos) < 2.4; }, 1);
      ok = (yield* stepoverBeat(beatContext, { car: from, def, closeUp: true, passTo: toW })) !== false;
      if (ball.owner !== from && !ok) break;
    }
    if (!ok) { def.busy = false; def.faceLock = false; def.loopsWant.jockey = 0; from.faceLock = false; if (tryIt) tryMove = 'flairpass'; return false; }
    return true;
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

  // settle the ball just in front of his boots (it is not put there: he steadies and lets it come back)
  function* gather(car, def, maxT = 0.9) {
    const f = forwardOf(car);
    const ok = () => { const rel = V(ball.p.x - car.pos.x, 0, ball.p.z - car.pos.z), a = rel.dot(forwardOf(car)), l = Math.abs(rel.dot(rightOf(car))); return a > 0.3 && a < 0.56 && l < 0.22; };
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
    if (move === 'flairnutmeg') return d > GOAL_X && Math.abs(p.pos.z) < 31;         // (V7.9.4 not against the touchline: the ball is held in by the line)
    if (move === 'flairpass' || SHOWBOAT.has(move)) return d > GOAL_X;
    if (move === 'nolook') return d > GOAL_X;
    return true;
  }
  const has = (p, move) => !!p?.moves?.includes(move);
  // the special move a beaten defender falls for, if the carrier has one that fits here (stable per event)
  const DUEL_MOVES = ['elastico', 'stepover', 'nutmeg', 'cruyff', 'croqueta', 'roulette', 'flairnutmeg', 'rainbow', 'sombrero', 'juggle'];
  const SHOWBOAT = new Set(['rainbow', 'sombrero', 'juggle']);
  const MOVE_WEIGHT = { cruyff: 1, nutmeg: 1, stepover: 1.5, croqueta: 1.5, roulette: 2, elastico: 2, flairnutmeg: 2, rainbow: 1.5, sombrero: 1.5, juggle: 1.5 };
  function duelMove(car, def) {
    // at most twice a match each: a third time it would look like the only thing he can do
    const ok = DUEL_MOVES.filter(m => has(car, m) && zoneOk(m, car) && !(SHOWBOAT.has(m) && losing(car.side)) && (car.used?.[m] || 0) < 2);
    if (forced && ok.includes(forced)) return forced;
    // the better the dribbler, the more often a beaten man falls for one of his moves
    const chance = car.stars >= 5 ? 0.75 : car.stars >= 4 ? 0.6 : 0.3;
    if (!ok.length || pick(def.lastEvent, 13) > chance) return null;
    // variety: a move he has already shown in this match waits until his others have had their turn;
    // the showier moves of a player who has them come up a little more than the everyday ones
    const least = Math.min(...ok.map(m => car.used?.[m] || 0)), pool = ok.filter(m => (car.used?.[m] || 0) === least);
    const w = m => MOVE_WEIGHT[m] || 1, total = pool.reduce((a, m) => a + w(m), 0);
    let x = pick(def.lastEvent, 17) * total;
    for (const m of pool) { x -= w(m); if (x < 0) return m; }
    return pool.at(-1);
  }
  // ---- stage a special move now (the star transfer scene's show) ----
  // the match waits while it plays; the player who has the move is put in the opponents' half with
  // the ball, a defender comes to him, and the move is made exactly as in a match
  let forced = null, staged = null;
  function stage(kind) {
    if (staged) return false;
    const star = rt.players.filter(p => !p.offPitch && has(p, kind)).sort((a, b) => (a.side === 'user' ? 0 : 1) - (b.side === 'user' ? 0 : 1))[0]
      || rt.players.find(p => !p.offPitch && p.side === 'user' && p.role === 'CAM') || rt.players.find(p => !p.offPitch && p.side === 'user' && p.role !== 'GK');
    if (!star) return false;
    staged = (function* () {
      const fx = -Math.sign(ownGoalX(star.side)), at = V(fx * 22, 0, 6);
      const opp = rt.players.filter(q => !q.offPitch && q.side !== star.side && q.role !== 'GK').sort((a, b) => a.pos.distanceTo(at) - b.pos.distanceTo(at));
      const def = opp[0];
      for (const p of rt.players) p.busy = false;
      rt.place(star, at); star.heading = Math.atan2(fx, 0);
      ball.owner = star; ball.held = null; ball.v.set(0, 0, 0); ball.p.set(at.x + fx * 0.5, BALL_R, at.z);
      rt.place(def, V(at.x + fx * 9, 0, at.z + 1)); def.heading = Math.atan2(-fx, 0);
      forced = kind;
      const pctOf = w => [(w.x / 105 + 0.5) * 100, (w.z / 68 + 0.5) * 100];
      const mateOf = () => rt.players.filter(q => !q.offPitch && q.side === star.side && q !== star && q.role !== 'GK').sort((a, b) => a.pos.distanceTo(at) - b.pos.distanceTo(at))[0];
      if (kind === 'backheel' || kind === 'rabona') {
        const mate = mateOf();
        const spot = kind === 'backheel' ? V(at.x - fx * 9, 0, at.z - 3) : V(at.x + fx * 16, 0, at.z - 14);
        rt.place(mate, spot.clone().addScaledVector(V(fx, 0, 0), kind === 'backheel' ? -1 : 2));
        yield* carry(star, V(at.x + fx * 4, 0, at.z), 3.5);
        tryMove = kind;
        yield* pass({ from: star, to: mate, toW: spot, travel: kind === 'rabona' ? 'aerial' : 'ground', implicit: false }, { ev: { eventId: -1 } });
      } else if (kind === 'pirouette') {
        const mate = mateOf();
        rt.place(mate, V(at.x - fx * 18, 0, at.z - 4)); ball.owner = mate; ball.p.copy(mate.pos).addScaledVector(V(fx, 0, 0), 0.5).setY(BALL_R); ball.v.set(0, 0, 0);
        rt.place(star, V(at.x, 0, at.z), Math.atan2(-fx, 0)); tryMove = 'pirouette';
        yield* pass({ from: mate, to: star, toW: V(at.x - fx * 0.6, 0, at.z), travel: 'ground', implicit: false }, { ev: { eventId: -1 } });
      } else if (kind === 'trap') {
        const mate = mateOf();
        rt.place(mate, V(at.x - fx * 30, 0, at.z - 6));
        ball.owner = mate; ball.p.copy(mate.pos).addScaledVector(V(fx, 0, 0), 0.5).setY(BALL_R);
        rt.place(star, V(at.x, 0, at.z)); tryMove = 'trap';
        yield* pass({ from: mate, to: star, toW: V(at.x + fx * 0.5, 0, at.z), travel: 'aerial', implicit: false }, { ev: { eventId: -1 } });
      } else if (kind === 'panenka' || kind === 'chip') {
        const gs = fx, line = gs * GOAL_X;
        const from = kind === 'panenka' ? V(line - gs * 11, 0, 0) : V(line - gs * 17, 0, 4);
        rt.place(star, from.clone().addScaledVector(V(gs, 0, 0), -1)); ball.owner = star; ball.p.copy(from).setY(BALL_R); ball.v.set(0, 0, 0);
        const gk = rt.players.find(q => q.side !== star.side && q.role === 'GK' && !q.offPitch);
        if (gk) rt.place(gk, V(line - gs * 0.5, 0, 0));
        tryMove = kind;
        yield* shot({ eventId: -1, type: 'shot', fromId: star.id, fromSide: star.side, penalty: kind === 'panenka', outcome: 'goal', fromPos: pctOf(from), toPos: gs > 0 ? [100, 50] : [0, 50] }, events.length + 10);
      } else if (kind === 'gkthrow' || kind === 'gkvolley') {
        // (keeper review) our keeper with the ball in his hands throws it out to a full-back (or volleys it
        // up to a man near halfway)
        const gk = rt.players.find(q => q.side === star.side && q.role === 'GK' && !q.offPitch), own = Math.sign(ownGoalX(star.side));
        rt.place(gk, V(own * 45, 0, 2), Math.atan2(-own, 0)); ball.owner = gk; ball.v.set(0, 0, 0); ball.p.copy(rt.handsOf(gk));
        ball.held = rt.pickUp(() => rt.handsOf(gk), 0.01); gk.holding = true;
        const mate = rt.players.filter(q => !q.offPitch && q.side === star.side && q !== gk && q.role !== 'GK').sort((a, b) => a.pos.distanceTo(gk.pos) - b.pos.distanceTo(gk.pos))[0];
        rt.place(mate, kind === 'gkvolley' ? V(own * 2, 0, -10) : V(own * 30, 0, 16));
        yield* wait(0.8);
        yield* pass({ from: gk, to: mate, toW: mate.pos.clone(), travel: 'ground', implicit: false }, { ev: { eventId: -1 } });
        yield* wait(1.5);
      } else if (kind === 'gkclaim') {
        // (keeper review) a cross into the box that the keeper comes and takes in the air
        const gs = fx, line = gs * GOAL_X, gk = rt.players.find(q => q.side !== star.side && q.role === 'GK' && !q.offPitch);
        const from = V(line - gs * 14, 0, 27);
        rt.place(star, from.clone().add(V(-gs * 1, 0, 0)), Math.atan2(gs, 0)); ball.owner = star; ball.p.copy(from).setY(BALL_R); ball.v.set(0, 0, 0);
        if (gk) rt.place(gk, V(line - gs * 1.5, 0, 0), Math.atan2(-gs, 0));
        yield* pass({ from: star, to: gk, toW: V(line - gs * 5.5, 0, 2.5), travel: 'aerial', implicit: false }, { ev: { eventId: -1 } });
        yield* wait(1.5);
      } else if (kind === 'gkcarry') {
        // (keeper review) our keeper runs out with the ball at his feet, then plays it
        const gk = rt.players.find(q => q.side === star.side && q.role === 'GK' && !q.offPitch), own = Math.sign(ownGoalX(star.side));
        const from = V(own * 46, 0, -4);
        rt.place(gk, from, Math.atan2(-own, 0)); ball.owner = gk; ball.held = null; ball.p.copy(from).addScaledVector(V(-own, 0, 0), 0.5).setY(BALL_R); ball.v.set(0, 0, 0);
        yield* carry(gk, V(own * 26, 0, 6), 5);
        const mate = rt.players.filter(q => !q.offPitch && q.side === star.side && q !== gk && q.role !== 'GK').sort((a, b) => a.pos.distanceTo(gk.pos) - b.pos.distanceTo(gk.pos))[0];
        yield* pass({ from: gk, to: mate, toW: mate.pos.clone(), travel: 'ground', implicit: false }, { ev: { eventId: -1 } });
        yield* wait(1.5);
      } else if (kind === 'gkfoot') {
        // (keeper review) a low shot just beside him, kept out with the foot
        const gs = fx, line = gs * GOAL_X, gk = rt.players.find(q => q.side !== star.side && q.role === 'GK' && !q.offPitch);
        const from = V(line - gs * 15, 0, 3);
        rt.place(star, from.clone().addScaledVector(V(gs, 0, 0), -1), Math.atan2(gs, 0)); ball.owner = star; ball.p.copy(from).setY(BALL_R); ball.v.set(0, 0, 0);
        if (gk) rt.place(gk, V(line - gs * 2.5, 0, 0), Math.atan2(-gs, 0));
        yield* shot({ eventId: -6, type: 'shot', fromId: star.id, fromSide: star.side, outcome: 'save', fromPos: pctOf(from), toPos: [gs > 0 ? 100 : 0, 51], devSave: { saveType: 'PARRY', toPos: [gs > 0 ? 88 : 12, 70] }, devFoot: true }, events.length + 10);
        yield* wait(2);
      } else if (kind === 'gkpunch') {
        // (keeper review) a cross into our box with their man going for it: our keeper comes and punches it clear
        const gs = Math.sign(ownGoalX('user')), line = gs * GOAL_X, gk = rt.players.find(q => q.side === 'user' && q.role === 'GK' && !q.offPitch);
        const crosser = rt.players.find(q => q.side === 'opp' && q.role !== 'GK' && !q.offPitch), striker = rt.players.filter(q => q.side === 'opp' && q.role !== 'GK' && !q.offPitch && q !== crosser)[0];
        const from = V(line - gs * 20, 0, 28), spot = V(line - gs * 6.5, 0, 1.5);
        rt.place(crosser, from.clone().add(V(0, 0, 1)), Math.atan2(0, -1)); ball.owner = crosser; ball.p.copy(from).setY(BALL_R); ball.v.set(0, 0, 0);
        rt.place(striker, V(line - gs * 11, 0, 3));
        if (gk) rt.place(gk, V(line - gs * 1.5, 0, 0), Math.atan2(-gs, 0));
        yield* wait(0.5);
        let meet = null;
        gk.busy = true; gk.loopsWant.keeperReady = 0;
        yield* pass({ from: crosser, to: null, toW: spot, travel: 'aerial', implicit: false }, { height: PUNCH_H, meet: tArr => { meet = tArr; }, ev: { eventId: -31 } });
        yield* keeperPunch(gk, spot.clone().setY(PUNCH_H), meet, V(line - gs * 26, 0, 12), striker);
        yield* wait(2.5);
      } else if (kind === 'gkrush' || kind === 'gkrushgoal') {
        // (keeper review) a man through on our goal: our keeper comes out; saved at his feet, or beaten
        const gs = Math.sign(ownGoalX('user')), line = gs * GOAL_X, gk = rt.players.find(q => q.side === 'user' && q.role === 'GK' && !q.offPitch);
        const shooter = rt.players.find(q => q.side === 'opp' && q.role !== 'GK' && !q.offPitch);
        const from = V(line - gs * 13, 0, -4);
        for (const q of rt.players) if (!q.offPitch && q.side === 'user' && q.role !== 'GK' && Math.abs(q.pos.x - line) < 30) rt.place(q, V(line - gs * 34, 0, q.pos.z * 0.5));
        rt.place(shooter, from.clone().addScaledVector(V(gs, 0, 0), -1), Math.atan2(gs, 0)); ball.owner = shooter; ball.p.copy(from).setY(BALL_R); ball.v.set(0, 0, 0);
        if (gk) rt.place(gk, V(line - gs * 1.5, 0, 0), Math.atan2(-gs, 0));
        yield* shot({ eventId: kind === 'gkrush' ? -21 : -22, type: 'shot', devRush: true, fromId: shooter.id, fromSide: 'opp', outcome: kind === 'gkrush' ? 'save' : 'goal', fromPos: pctOf(from), toPos: [gs > 0 ? 100 : 0, 46], devSave: { saveType: kind === 'gkrush' ? 'CATCH' : 'PARRY' } }, events.length + 10);
        yield* wait(2.5);
      } else if (kind === 'gkpen' || kind === 'gkpengoal') {
        // (keeper review) a penalty against us: our keeper on his line saves it, or is beaten
        const gs = Math.sign(ownGoalX('user')), line = gs * GOAL_X, gk = rt.players.find(q => q.side === 'user' && q.role === 'GK' && !q.offPitch);
        const shooter = rt.players.find(q => q.side === 'opp' && q.role !== 'GK' && !q.offPitch);
        const spot = V(line - gs * 11, 0, 0);
        rt.place(shooter, spot.clone().add(V(-gs * 1.8, 0, 0)), Math.atan2(gs, 0)); ball.owner = shooter; ball.p.copy(spot).setY(BALL_R); ball.v.set(0, 0, 0);
        if (gk) rt.place(gk, V(line - gs * 1.5, 0, 1), Math.atan2(-gs, 0));
        yield* shot({ eventId: kind === 'gkpen' ? -11 : -12, type: 'shot', penalty: true, fromId: shooter.id, fromSide: 'opp', outcome: kind === 'gkpen' ? 'save' : 'goal', fromPos: pctOf(spot), toPos: [gs > 0 ? 100 : 0, 58], devSave: { saveType: 'PARRY', toPos: [gs > 0 ? 92 : 8, 80] } }, events.length + 10);
        yield* wait(2.5);
      } else if (kind === 'scorpion') {
        // our keeper, a looping shot from distance dropping onto him
        const gs = Math.sign(ownGoalX('user')), line = gs * GOAL_X, gk = rt.players.find(q => q.side === 'user' && q.role === 'GK' && !q.offPitch);
        const shooter = rt.players.find(q => q.side === 'opp' && q.role !== 'GK' && !q.offPitch);
        const from = V(line - gs * 26, 0, 4);
        rt.place(shooter, from.clone().addScaledVector(V(gs, 0, 0), -1), Math.atan2(gs, 0)); ball.owner = shooter; ball.p.copy(from).setY(BALL_R); ball.v.set(0, 0, 0);
        if (gk) rt.place(gk, V(line - gs * 3, 0, 0.5), Math.atan2(-gs, 0));
        tryMove = 'scorpion';
        yield* shot({ eventId: -1, type: 'shot', fromId: shooter.id, fromSide: 'opp', outcome: 'save', fromPos: pctOf(from), toPos: [gs > 0 ? 100 : 0, 50], devSave: { saveType: 'PARRY', toPos: [gs > 0 ? 80 : 20, 40] } }, events.length + 10);
        yield* wait(2.5);
      } else if (kind === 'gksave' || kind === 'gkcatch' || kind === 'gkmove' || kind === 'gkstar' || kind === 'gkcorner') {
        // (keeper review) a shot saved: a dive and a parry, one straight at him and caught, or the
        // keeper shuffling across his goal as the man carries it across the box first
        const gs = fx, line = gs * GOAL_X, gk = rt.players.find(q => q.side !== star.side && q.role === 'GK' && !q.offPitch);
        const from = V(line - gs * 21, 0, kind === 'gkmove' ? -12 : 5);
        rt.place(star, from.clone().addScaledVector(V(gs, 0, 0), -1), Math.atan2(gs, 0)); ball.owner = star; ball.p.copy(from).setY(BALL_R); ball.v.set(0, 0, 0);
        if (gk) rt.place(gk, V(line - gs * 2.5, 0, 0), Math.atan2(-gs, 0));
        if (kind === 'gkmove') yield* carry(star, V(line - gs * 19, 0, 9), 3.2);
        yield* shot({ eventId: kind === 'gkstar' ? 16 : -1, type: 'shot', fromId: star.id, fromSide: star.side, outcome: 'save', fromPos: pctOf(star.pos), toPos: [gs > 0 ? 100 : 0, kind === 'gkcatch' ? 50 : kind === 'gkmove' ? 42 : 60], devSave: { saveType: kind === 'gkcatch' ? 'CATCH' : kind === 'gkcorner' ? 'DEFLECT_CORNER' : 'PARRY' } }, events.length + 10);
        if (kind === 'gkcorner') { ball.allowOut = true; yield* until(() => ball.out, 3); stats.cornerOut = ball.p.toArray().map(v => +v.toFixed(2)); }
        yield* wait(2.5);
      } else if (kind === 'crosshead') {
        // (review) an open-play cross from out wide met with a header at the near post
        const mate = mateOf(), gs = fx, line = gs * GOAL_X;
        const spot = V(line - gs * 7, rt.headHeight, 3);
        rt.place(mate, V(line - gs * 16, 0, 27)); ball.owner = mate; ball.p.copy(mate.pos).add(V(gs * 0.5, 0, 0)).setY(BALL_R); ball.v.set(0, 0, 0);
        rt.place(star, V(spot.x - gs * 6, 0, spot.z - 4));
        yield* pass({ from: mate, to: star, toW: spot.clone().setY(0), travel: 'aerial', implicit: false }, { height: rt.headHeight, meet: tArr => { S.headerCross = { p: star, spot, tArr }; star.busy = true; star.target.copy(spot).setY(0); star.want = 6.5; } });
        yield* shot({ eventId: -41, type: 'shot', header: true, fromId: star.id, fromSide: star.side, outcome: 'goal', fromPos: pctOf(spot), toPos: gs > 0 ? [100, 47] : [0, 53] }, events.length + 10);
        yield* wait(1.5);
      } else if (kind === 'bicycle') {
        const mate = mateOf(), gs = fx, line = gs * GOAL_X;
        const spot = V(line - gs * 9, rt.headHeight, 1.5);
        rt.place(mate, V(line - gs * 14, 0, 26)); ball.owner = mate; ball.p.copy(mate.pos).add(V(gs * 0.5, 0, 0)).setY(BALL_R); ball.v.set(0, 0, 0);
        rt.place(star, V(spot.x - gs * 1.5, 0, spot.z + 2)); tryMove = 'bicycle';
        yield* pass({ from: mate, to: star, toW: spot.clone().setY(0), travel: 'aerial', implicit: false }, { height: rt.headHeight, meet: tArr => { S.headerCross = { p: star, spot, tArr }; star.busy = true; star.target.copy(spot).setY(0); star.want = 6; } });
        yield* shot({ eventId: -1, type: 'shot', header: true, fromId: star.id, fromSide: star.side, outcome: 'goal', fromPos: pctOf(spot), toPos: gs > 0 ? [100, 47] : [0, 53] }, events.length + 10);
      } else if (kind === 'flairpass') {
        const mate = rt.players.filter(q => !q.offPitch && q.side === star.side && q !== star && q.role !== 'GK').sort((a, b) => a.pos.distanceTo(at) - b.pos.distanceTo(at))[0];
        const spot = V(at.x + fx * 14, 0, at.z - 7);
        rt.place(mate, spot.clone().addScaledVector(V(fx, 0, 0), 2));
        yield* carry(star, V(at.x + fx * 5, 0, at.z), 3.5);
        tryMove = 'flairpass';
        if (!(yield* flairPassTry({ from: star, to: mate, toW: spot, travel: 'ground', implicit: false }, { ev: { eventId: -1 } }))) { tryMove = null; forced = null; return true; }
        star.busy = false; mate.busy = true; yield* chase(mate, spot); mate.busy = false;
      } else if (kind === 'nolook') {
        const mate = rt.players.filter(q => !q.offPitch && q.side === star.side && q !== star && q.role !== 'GK').sort((a, b) => a.pos.distanceTo(at) - b.pos.distanceTo(at))[0];
        rt.place(mate, V(at.x + fx * 16, 0, at.z - 8));
        yield* carry(star, V(at.x + fx * 6, 0, at.z), 4.2);
        yield* pass({ from: star, to: mate, toW: V(at.x + fx * 20, 0, at.z - 6), travel: 'ground', implicit: false }, { ev: { eventId: -1 } });
      } else {
        // he runs at the defender, who comes out to meet him; then the move (again if he could not set it up)
        def.lastEvent = { eventId: -1 }; def.busy = star.busy = true;
        hooks.cam('close', star, def);
        yield* until(() => {
          rt.dribble(star, V(at.x + fx * 12, 0, at.z), 3);
          def.target.copy(star.pos).addScaledVector(forwardOf(star), 1.9); def.want = 4; def.face = star.pos; def.faceLock = true; def.loopsWant.jockey = 1;
          return def.pos.distanceTo(star.pos) < 2.6;
        }, 4);
        for (let k = 0; k < 4; k++) {
          if ((yield* SKILL_BEAT[kind](star, def, true)) !== false) break;
          def.target.copy(star.pos).addScaledVector(forwardOf(star), 2); def.want = 3;
          yield* wait(0.2);
        }
        def.busy = star.busy = false; def.faceLock = false; def.loopsWant.jockey = 0;
        hooks.cam('tv');
      }
      forced = null;
      return true;
    })();
    return star.name;
  }
  // a special pass or shot the staged scene asks for: the next chance to play it plays it
  let tryMove = null;
  // every special move is logged with who did it and where, for the checks and the replay
  function noteSkill(audit, p, extra) {
    Object.assign(audit, { who: p.key, side: p.side, moves: [...(p.moves || [])], fromOwn: +fromOwnGoal(p).toFixed(1), z: +p.pos.z.toFixed(1), t: +S.t.toFixed(2), losing: losing(p.side) }, extra);
    (stats.skills ||= []).push(audit);
    (p.used ||= {})[audit.kind] = (p.used[audit.kind] || 0) + 1;
    hooks.star?.(audit, p);
  }
  // through his legs: the defender squares up with his feet apart, a stab with the right boot sends
  // the ball through the gap and the attacker goes round him
  function* nutmegBeat(car, def, closeUp) {
    if (!(yield* gather(car, def, 0.7)) || def.pos.distanceTo(car.pos) > 3.2) return false;
    const fc = forwardOf(car);
    yield* until(() => { def.target.copy(ball.p).addScaledVector(fc, 1.45); def.want = 3; def.face = car.pos; def.faceLock = true; car.target.copy(car.pos); car.want = 0.3; ball.v.multiplyScalar(0.9); return def.pos.distanceTo(ball.p.clone().setY(0)) < 1.75; }, 0.6);
    const t0 = S.t;
    if (closeUp) hooks.cam('close', car, def);
    hooks.slow(0.4);
    def.heading = Math.atan2(car.pos.x - def.pos.x, car.pos.z - def.pos.z); def.face = car.pos; def.faceLock = true;
    def.loopsWant.jockey = 0; def.target.copy(def.pos); def.want = 0; def.vel.multiplyScalar(0.2);
    const dr = rightOf(def), df = forwardOf(def);
    const fl = def.pos.clone().addScaledVector(dr, -0.44).addScaledVector(df, 0.06).setY(0.03), fr = def.pos.clone().addScaledVector(dr, 0.44).addScaledVector(df, 0.06).setY(0.03);
    def.feet = { Left: { at: () => fl, w: ramp(t0, [0, 0.16, 1.0, 1.25]) }, Right: { at: () => fr, w: ramp(t0, [0, 0.16, 1.0, 1.25]) } };
    rt.startAction(def, 'spread');
    car.target.copy(car.pos); car.want = 0.4; ball.v.multiplyScalar(0.15); ball.through = t0 + 0.5;      // he steadies it
    const gap = def.pos.clone().addScaledVector(df, 0.06).setY(0), f = V(gap.x - ball.p.x, 0, gap.z - ball.p.z).normalize();
    car.heading = Math.atan2(f.x, f.z);
    rt.startAction(car, 'poke', 0.06);
    const tc = 0.06 + ACTIONS.poke.dur * ACTIONS.poke.contact;
    car.feet = { Right: { w: ramp(t0, [0.02, 0.12, tc, tc + 0.12]), at: () => ball.p.clone().addScaledVector(f, -0.13).setY(0.06) } };
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
    if (closeUp) hooks.cam('tv');          // he is away: back to the wide picture while he runs on
    yield* chase(car, null);
  }

  // ---- V7.9 more special moves (boots placed with the foot targets) ----
  const toeGap = (p, side) => { const t = p.feet?.[side]?.last; return t ? t.distanceTo(ball.p) : 9; };
  const heelOf = (p, side) => p.bones[side + 'Foot'].getWorldPosition(V());
  const slipWatch = (p, side, after, t0) => { let p0 = null, max = 0; return () => { const s = p.feet?.[side]?.last; if (s && S.t - t0 > after) { p0 ||= s.clone(); max = Math.max(max, Math.hypot(s.x - p0.x, s.z - p0.z)); } return max; }; };
  function* squareUp(car) {
    car.face = ball.p; car.faceLock = true;
    yield* until(() => { const want = Math.atan2(ball.p.x - car.pos.x, ball.p.z - car.pos.z), d = Math.atan2(Math.sin(want - car.heading), Math.cos(want - car.heading)); return Math.abs(d) < 0.06; }, 0.25);
  }
  function* afterBeat(car, def, closeUp) {
    hooks.slow(1);
    rt.startAction(def, 'stumble'); def.want = 0.5; def.face = car.pos; def.faceLock = true;
    yield* wait(0.3); car.feet = null; car.faceLock = false; car.drive = null;
    def.busy = car.busy = false; def.faceLock = false; def.loopsWant.jockey = 0; def.feet = null;
    if (closeUp) hooks.cam('tv');          // he is away: back to the wide picture while he runs on
    yield* chase(car, null);
  }

  // Cruyff turn: he shapes to strike it (the boot goes back and comes through), but the inside of the
  // boot drags the ball back behind his standing leg instead and he turns away with it
  function* cruyffBeat(car, def, closeUp) {
    if (!(yield* gather(car, def)) || def.pos.distanceTo(car.pos) > 3.4) return false;
    yield* squareUp(car);
    const f = forwardOf(car), r = rightOf(car), t0 = S.t, b0 = ball.p.clone();
    if (closeUp) hooks.cam('close', car, def);
    hooks.slow(0.4);
    car.target.copy(car.pos); car.want = 0.3; car.vel.multiplyScalar(0.3); ball.v.copy(f).multiplyScalar(0.08);
    car.face = car.pos.clone().addScaledVector(f, 30); car.faceLock = true;
    ball.through = t0 + 1.2; def.target.copy(def.pos); def.want = 0.5;
    const rel = (a, l, y) => ball.p.clone().addScaledVector(f, a).addScaledVector(r, l).setY(y);
    const plantL = b0.clone().addScaledVector(f, 0.16).addScaledVector(r, -0.26).setY(0.03);
    const back = b0.clone().addScaledVector(f, -0.34).addScaledVector(r, 0.12).setY(0.3);
    car.feet = {
      Left: { w: ramp(t0, [0, 0.1, 0.9, 1.05]), at: () => plantL },
      Right: { w: ramp(t0, [0, 0.08, 0.9, 1.05]), at: t => {
        const u = t - t0;
        if (u < 0.28) return back;                                                    // the shot is shaped: boot back and up
        if (u < 0.42) { const k = (u - 0.28) / 0.14; return back.clone().lerp(rel(0.17, 0.11, 0.06), k * k * (3 - 2 * k)); }   // through, beside the ball
        if (u < 0.5) { const k = (u - 0.42) / 0.08; return rel(0.17, 0.11, 0.06).lerp(rel(0.12, 0.02, 0.05), k); }            // the inside of the boot onto its front
        return rel(-0.12, -0.12, 0.05);
      } },
    };
    const audit = { kind: 'cruyff', fake: 0, swingGap: 9 }, slip = slipWatch(car, 'Left', 0.12, t0);
    yield* until(() => {
      const u = S.t - t0, toe = car.feet.Right.last;
      if (toe && u < 0.3) audit.fake = Math.max(audit.fake, toe.y);
      if (toe && u > 0.3 && u < 0.41) audit.swingGap = Math.min(audit.swingGap, toe.distanceTo(ball.p));
      if (u > 0.22 && !def.act) { rt.startAction(def, 'lunge'); def.loopsWant.jockey = 0; def.target.copy(car.pos).addScaledVector(f, 1.15); def.want = 3; }      // he goes for the shot, not through the man
      slip();
      return u >= 0.5 && toeGap(car, 'Right') < 0.24;
    }, 0.68);
    audit.contact = +toeGap(car, 'Right').toFixed(3);
    const dir = f.clone().multiplyScalar(-0.75).addScaledVector(r, -0.65).normalize();
    ball.v.copy(dir).multiplyScalar(3.0); car.lastTouch = S.t;
    // the ball goes behind the standing boot
    audit.plantSlip = +slip().toFixed(3);          // the standing boot matters through the swing and the take
    const pl = (plantL.clone().sub(b0)).dot(r);
    yield* until(() => { const d = ball.p.clone().sub(b0); if (d.dot(r) <= pl) { audit.behind = d.dot(f) < plantL.clone().sub(b0).dot(f) - 0.12; return true; } return S.t - t0 > 1.2; }, 0.6);
    noteSkill(audit, car);
    car.feet = null; car.face = ball.p; car.faceLock = true; car.target.copy(ball.p).addScaledVector(dir, 0.6); car.want = 4.5;
    yield* wait(0.25);
    yield* afterBeat(car, def, closeUp);
  }

  // Marseille turn: the right sole drags the ball back as he spins round on it, the left sole takes it
  // on round the other side and he comes out of the spin past his man
  function* rouletteBeat(car, def, closeUp) {
    if (!(yield* gather(car, def)) || def.pos.distanceTo(car.pos) > 3.4) return false;
    yield* squareUp(car);
    const f = forwardOf(car), r = rightOf(car), t0 = S.t, h0 = car.heading, T = 0.9;
    if (closeUp) hooks.cam('close', car, def);
    hooks.slow(0.4);
    ball.through = t0 + 1.4; ball.v.set(0, 0, 0); def.target.copy(car.pos).addScaledVector(f, 2.3); def.want = 1.5; def.face = car.pos; def.faceLock = true;
    const hd = t => h0 - 2 * Math.PI * smooth01(clamp((t - t0) / T, 0, 1));          // a full turn to his right
    const fw = h => V(Math.sin(h), 0, Math.cos(h));
    // (V7.9.5: he eases from where he stands onto the ball in the first tenth of a second — the drive used to
    //  start 0.38 m behind the ball wherever he was, a jump of a few tenths in one frame)
    const p0 = car.pos.clone();
    car.drive = { heading: hd, pos: t => p0.clone().lerp(ball.p.clone().addScaledVector(fw(hd(t)), -0.38).setY(0), smooth01(clamp((t - t0) / 0.12, 0, 1))) };
    const onTop = (side) => () => ball.p.clone().addScaledVector(rightOf(car), side === 'Right' ? 0.04 : -0.04).setY(0.2);
    car.feet = {
      Right: { w: t => { const u = t - t0; return u < 0.05 ? u / 0.05 : u < 0.36 ? 1 : u < 0.46 ? (0.46 - u) / 0.1 : u > 0.72 && u < 0.86 ? 1 : 0; }, at: t => (t - t0) < 0.5 ? onTop('Right')() : ball.p.clone().addScaledVector(forwardOf(car), -0.13).setY(0.05) },
      Left: { w: t => { const u = t - t0; return u > 0.38 && u < 0.7 ? Math.min(1, (u - 0.38) / 0.06, (0.7 - u) / 0.06) : 0; }, at: onTop('Left') },
    };
    const audit = { kind: 'roulette', soleA: 9, soleB: 9, wander: 0 }, c0 = car.pos.clone();
    let phase = 0;
    yield* until(() => {
      const u = S.t - t0;
      if (phase === 0 && u > 0.05) { phase = 1; ball.v.copy(f).multiplyScalar(-0.45).addScaledVector(r, 0.9); }              // dragged back and across
      if (phase === 1 && u > 0.42) { phase = 2; ball.v.copy(r).multiplyScalar(1.1).addScaledVector(f, 0.45); }               // the other sole takes it on round
      if (u > 0.08 && u < 0.34) audit.soleA = Math.min(audit.soleA, toeGap(car, 'Right'));
      if (u > 0.44 && u < 0.66) audit.soleB = Math.min(audit.soleB, toeGap(car, 'Left'));
      audit.wander = Math.max(audit.wander, Math.hypot(ball.p.x - car.pos.x, ball.p.z - car.pos.z));
      ball.v.y = 0; ball.p.y = BALL_R;
      if (u > 0.2 && !def.act) { rt.startAction(def, 'lunge'); def.loopsWant.jockey = 0; def.target.copy(c0).addScaledVector(f, 1.7).addScaledVector(r, -0.6); def.want = 3; }      // he goes the other way
      return u >= 0.76;
    }, 1.2);
    audit.spin = +Math.abs(hd(S.t) - h0).toFixed(2);
    audit.contact = +toeGap(car, 'Right').toFixed(3);
    const out = f.clone().multiplyScalar(3.4).addScaledVector(r, 0.8);
    if (Math.abs(car.pos.z) > 28 && out.z * Math.sign(car.pos.z) > 0) out.z *= -0.4;
    ball.v.copy(out); car.lastTouch = S.t;
    for (const k of ['soleA', 'soleB', 'wander']) audit[k] = +audit[k].toFixed(3);
    noteSkill(audit, car);
    yield* until(() => S.t - t0 >= T, 0.3);
    car.drive = null; car.heading = h0; car.target.copy(ball.p).addScaledVector(out, 0.4); car.want = 6;
    yield* wait(0.25);
    yield* afterBeat(car, def, closeUp);
  }

  // flair nutmeg: he turns his back on the defender as if to shield it, then the heel sends the ball back
  // through the defender's legs and he spins round him to collect
  function* flairNutmegBeat(car, def, closeUp) {
    if (!(yield* gather(car, def, 0.9)) || def.pos.distanceTo(car.pos) > 3.4) return false;
    const fc = forwardOf(car);
    yield* until(() => { def.target.copy(ball.p).addScaledVector(fc, 1.5); def.want = 3; def.face = car.pos; def.faceLock = true; car.target.copy(car.pos); car.want = 0.3; ball.v.multiplyScalar(0.85); return def.pos.distanceTo(ball.p.clone().setY(0)) < 1.8; }, 0.6);
    const t0 = S.t, h0 = car.heading, p0 = car.pos.clone();
    if (closeUp) hooks.cam('close', car, def);
    hooks.slow(0.4);
    def.heading = Math.atan2(car.pos.x - def.pos.x, car.pos.z - def.pos.z); def.face = car.pos; def.faceLock = true;
    def.loopsWant.jockey = 0; def.target.copy(def.pos); def.want = 0; def.vel.multiplyScalar(0.2);
    const dr = rightOf(def), df = forwardOf(def);
    const fl = def.pos.clone().addScaledVector(dr, -0.44).addScaledVector(df, 0.06).setY(0.03), fr = def.pos.clone().addScaledVector(dr, 0.44).addScaledVector(df, 0.06).setY(0.03);
    def.feet = { Left: { at: () => fl, w: ramp(t0, [0, 0.16, 1.2, 1.45]) }, Right: { at: () => fr, w: ramp(t0, [0, 0.16, 1.2, 1.45]) } };
    rt.startAction(def, 'spread');
    ball.v.set(0, 0, 0); ball.through = t0 + 0.8;
    // turn his back (to his left, half a turn) on the spot, the ball now behind him
    const TT = 0.36, hd = t => h0 + Math.PI * smooth01(clamp((t - t0) / TT, 0, 1));
    car.drive = { heading: hd, pos: () => p0 };
    const gap = def.pos.clone().addScaledVector(df, 0.06).setY(0);
    // the heel goes onto the near face of the ball (the boot points the way he now faces)
    car.feet = { Right: { w: t => { const u = t - t0; return u < TT - 0.1 ? 0 : Math.min(1, (u - TT + 0.1) / 0.08); }, at: t => { const fnow = V(Math.sin(hd(t)), 0, Math.cos(hd(t))); return ball.p.clone().addScaledVector(fnow, 0.1 + 0.17).setY(0.07); } } };
    const audit = { kind: 'flairnutmeg' };
    yield* until(() => S.t - t0 >= TT + 0.06 && heelOf(car, 'Right').distanceTo(ball.p) < 0.24, TT + 0.3);
    audit.heel = +heelOf(car, 'Right').distanceTo(ball.p).toFixed(3); audit.turn = +(hd(S.t) - h0).toFixed(2);
    const f = V(gap.x - ball.p.x, 0, gap.z - ball.p.z).normalize();
    ball.v.copy(f).multiplyScalar(5.0); ball.through = S.t + 1.1; car.lastTouch = S.t;
    car.drive = null; car.feet = null; car.heading = hd(S.t);
    const side = V(-f.z, 0, f.x).multiplyScalar(pick(def.lastEvent, 11) < 0.5 ? 1 : -1);
    car.target.copy(gap).addScaledVector(side, 1.3).addScaledVector(f, 0.2); car.want = 6.4; car.faceLock = false;
    yield* until(() => { const g = betweenFeet(def, gap, f); if (g) Object.assign(audit, g); return !!g || S.t - t0 > TT + 1.2; }, 1.4);
    noteSkill(audit, car);
    yield* wait(0.2);
    def.face = ball.p; def.want = 1.5;
    yield* afterBeat(car, def, closeUp);
  }
  // the ball crossing the line between the defender's planted boots: was it between them, and how far from each
  function betweenFeet(def, gap, f) {
    const l = def.feet?.Left?.last, rr = def.feet?.Right?.last;
    if (!l || !rr || (ball.p.x - gap.x) * f.x + (ball.p.z - gap.z) * f.z <= 0) return null;
    const seg = V(rr.x - l.x, 0, rr.z - l.z), len = seg.length(), q = V(ball.p.x - l.x, 0, ball.p.z - l.z).dot(seg) / Math.max(1e-3, len * len);
    return { between: q > 0 && q < 1, gapL: +Math.hypot(ball.p.x - l.x, ball.p.z - l.z).toFixed(3), gapR: +Math.hypot(ball.p.x - rr.x, ball.p.z - rr.z).toFixed(3) };
  }
  // ---- V7.9 showboating: the ball goes up and over (rare, the very best, never when losing) ----
  function losing(side) {
    const sc = S.score || [0, 0], mine = (side === 'user') === !!meta.userHome ? sc[0] : sc[1], theirs = (side === 'user') === !!meta.userHome ? sc[1] : sc[0];
    return mine < theirs;
  }
  // how high the ball is as it goes past a point (the defender), watched while it flies
  function overWatch(at, f) {
    let best = null;
    return () => { const d = ball.p.clone().sub(at).dot(f); if (best == null && d >= 0) best = +ball.p.y.toFixed(2); return best; };
  }
  function* collectAir(car, def, closeUp, land) {
    car.feet = null; car.faceLock = false; car.drive = null;
    car.target.copy(land).setY(0); car.want = 6.5;
    yield* until(() => ball.p.y < 0.5, 1.8);
    hooks.slow(1);
    def.busy = car.busy = false; def.faceLock = false; def.loopsWant.jockey = 0; def.feet = null;
    if (closeUp) hooks.cam('tv');          // he is away: back to the wide picture while he runs on
    yield* chase(car, null);
  }
  const landing = (vx, vy, vz, from) => { const t = (vy + Math.sqrt(vy * vy + 2 * 9.81 * Math.max(0, from.y - BALL_R))) / 9.81; return from.clone().add(V(vx * t * 0.95, 0, vz * t * 0.95)).setY(0); };

  // rainbow flick: the right sole rolls the ball back between his feet, the instep pops it up behind
  // him and the left heel flicks it up over his own head and the defender's, and he runs on to it
  function* rainbowBeat(car, def, closeUp) {
    if (!(yield* gather(car, def)) || def.pos.distanceTo(car.pos) > 5) return false;
    yield* squareUp(car);
    const f = forwardOf(car), r = rightOf(car), t0 = S.t;
    if (closeUp) hooks.cam('close', car, def);
    hooks.slow(0.4);
    // the defender stands off a couple of metres, he takes it towards him at walking pace
    def.target.copy(car.pos).addScaledVector(f, 2.6); def.want = 2; def.face = car.pos; def.faceLock = true; def.loopsWant.jockey = 1;
    car.target.copy(car.pos).addScaledVector(f, 0.3); car.want = 0.5; car.vel.multiplyScalar(0.3);
    car.face = car.pos.clone().addScaledVector(f, 30); car.faceLock = true;
    ball.through = t0 + 2.5; ball.v.set(0, 0, 0);
    const rel = (a, l, y) => car.pos.clone().addScaledVector(f, a).addScaledVector(r, l).setY(y);
    car.feet = {
      Right: { w: t => { const u = t - t0; return u < 0.05 ? u / 0.05 : u < 0.42 ? 1 : 0; }, at: t => (t - t0) < 0.26 ? ball.p.clone().setY(0.2) : ball.p.clone().addScaledVector(f, 0.12).setY(Math.max(0.05, ball.p.y - 0.06)) },
      Left: { w: t => { const u = t - t0; return u < 0.3 ? Math.min(1, u / 0.1) : u < 0.62 ? 1 : Math.max(0, 1 - (u - 0.62) / 0.12); }, at: t => (t - t0) < 0.34 ? rel(-0.02, -0.14, 0.03) : ball.p.clone().addScaledVector(f, 0.17 - 0.1).setY(ball.p.y) },
    };
    const audit = { kind: 'rainbow', roll: 9 };
    // 1: rolled back under the sole to between his feet
    ball.v.copy(f).multiplyScalar(-1.5);
    yield* until(() => { audit.roll = Math.min(audit.roll, toeGap(car, 'Right')); const back = ball.p.clone().sub(car.pos).dot(f); if (back < 0.06) { ball.v.set(0, 0, 0); return true; } return false; }, 0.34);
    // 2: the instep pops it up behind the left calf
    ball.p.y = BALL_R + 0.01; ball.v.set(0, 2.3, 0).addScaledVector(f, -0.25);
    yield* until(() => ball.v.y <= 0.2, 0.3);
    // 3: the left heel flicks it up and over
    yield* until(() => heelOf(car, 'Left').distanceTo(ball.p) < 0.22, 0.12);
    audit.heel = +heelOf(car, 'Left').distanceTo(ball.p).toFixed(3);
    const vf = 3.9, vy = 6.1;
    ball.v.copy(f).multiplyScalar(vf).setY(vy); car.lastTouch = S.t;
    if (closeUp) hooks.cam('tv');          // the ball is up: the wide picture shows it go over him (the replay shows it close)
    const over = overWatch(def.pos.clone(), f);
    let apex = 0;
    def.target.copy(def.pos); def.want = 0.3; def.loopsWant.jockey = 0; def.face = ball.p; def.faceLock = true;
    // he goes round the defender's side to meet it
    const land = landing(ball.v.x, vy, ball.v.z, ball.p);
    car.feet = null; car.faceLock = false; car.target.copy(land); car.want = 6.5;
    yield* until(() => { apex = Math.max(apex, ball.p.y); over(); return ball.v.y < 0 && ball.p.y < 1.0; }, 1.6);
    Object.assign(audit, { apex: +apex.toFixed(2), overDef: over() });
    noteSkill(audit, car);
    yield* collectAir(car, def, closeUp, land);
  }

  // sombrero: face to face with the defender, the toe scoops the ball up over his head; round him and
  // collect it behind him
  function* sombreroBeat(car, def, closeUp) {
    if (!(yield* gather(car, def)) || def.pos.distanceTo(car.pos) > 4) return false;
    yield* squareUp(car);
    const f = forwardOf(car), r = rightOf(car);
    // the defender closes to just over a metre and a half
    yield* until(() => { def.target.copy(car.pos).addScaledVector(f, 1.7); def.want = 3; def.face = car.pos; def.faceLock = true; def.loopsWant.jockey = 1; car.target.copy(car.pos); car.want = 0.3; return def.pos.distanceTo(car.pos) < 1.95; }, 0.7);
    if (closeUp) hooks.cam('close', car, def);
    hooks.slow(0.4);
    ball.through = S.t + 2.5; ball.v.set(0, 0, 0);
    const plantL = ball.p.clone().addScaledVector(r, -0.25).addScaledVector(f, -0.08).setY(0.03);
    car.feet = {
      Left: { w: ramp(S.t, [0, 0.08, 0.45, 0.6]), at: () => plantL },
      Right: { w: ramp(S.t, [0, 0.06, 0.4, 0.55]), at: () => ball.p.clone().addScaledVector(f, -0.1).setY(0.03) },
    };
    const t1 = S.t;
    yield* until(() => S.t - t1 > 0.16 && toeGap(car, 'Right') < 0.2, 0.32);
    const audit = { kind: 'sombrero', toe: +toeGap(car, 'Right').toFixed(3) };
    const vf = 2.7, vy = 6.4;
    ball.v.copy(f).multiplyScalar(vf).setY(vy); car.lastTouch = S.t;
    if (closeUp) hooks.cam('tv');          // the ball is up: the wide picture shows it go over him (the replay shows it close)
    const over = overWatch(def.pos.clone(), f);
    def.loopsWant.jockey = 0; def.face = ball.p; def.faceLock = true; def.want = 0.3; def.target.copy(def.pos);
    const land = landing(ball.v.x, vy, ball.v.z, ball.p);
    const side = r.clone().multiplyScalar(pick(def.lastEvent, 11) < 0.5 ? 1 : -1);
    car.feet = null; car.faceLock = false;
    car.target.copy(def.pos).addScaledVector(side, 1.2); car.want = 6;
    let apex = 0, rounded = false;
    yield* until(() => { apex = Math.max(apex, ball.p.y); over(); if (!rounded && car.pos.distanceTo(def.pos) < 1.5) { rounded = true; car.target.copy(land); } return ball.v.y < 0 && ball.p.y < 1.0; }, 1.6);
    Object.assign(audit, { apex: +apex.toFixed(2), overDef: over() });
    noteSkill(audit, car);
    yield* collectAir(car, def, closeUp, land);
  }

  // keep it up and go: the toe flicks the ball up, a second touch in the air lifts it over the
  // defender's lunging leg, and he skips past
  function* juggleBeat(car, def, closeUp) {
    if (!(yield* gather(car, def)) || def.pos.distanceTo(car.pos) > 4) return false;
    yield* squareUp(car);
    const f = forwardOf(car), r = rightOf(car), t0 = S.t;
    if (closeUp) hooks.cam('close', car, def);
    hooks.slow(0.4);
    def.target.copy(car.pos).addScaledVector(f, 2.1); def.want = 2.5; def.face = car.pos; def.faceLock = true; def.loopsWant.jockey = 1;
    car.target.copy(car.pos); car.want = 0.3; car.vel.multiplyScalar(0.3);
    car.face = car.pos.clone().addScaledVector(f, 30); car.faceLock = true;
    ball.through = t0 + 2.5; ball.v.set(0, 0, 0);
    const plantL = car.pos.clone().addScaledVector(r, -0.14).addScaledVector(f, 0.12).setY(0.03);
    let stage = 0;
    car.feet = {
      Left: { w: ramp(t0, [0, 0.08, 0.8, 0.95]), at: () => plantL },
      Right: { w: ramp(t0, [0, 0.06, 0.82, 0.95]), at: () => stage === 0 ? ball.p.clone().addScaledVector(f, -0.12).setY(0.03) : ball.p.clone().addScaledVector(f, -0.05).setY(Math.max(0.05, ball.p.y - 0.12)) },
    };
    const audit = { kind: 'juggle', low: 9 };
    // 1: a flick up off the toe
    yield* until(() => S.t - t0 > 0.12 && toeGap(car, 'Right') < 0.2, 0.3);
    audit.touch1 = +toeGap(car, 'Right').toFixed(3);
    ball.p.y = BALL_R + 0.01; ball.v.copy(f).multiplyScalar(0.25).setY(3.0); car.lastTouch = S.t; stage = 1;
    // 2: met on the way down at knee height, up and over the leg
    yield* until(() => { if (ball.v.y < 0) audit.low = Math.min(audit.low, ball.p.y); return ball.v.y < 0 && ball.p.y < 0.55 && toeGap(car, 'Right') < 0.25; }, 0.8);
    audit.touch2 = +toeGap(car, 'Right').toFixed(3); audit.low = +audit.low.toFixed(2);
    rt.startAction(def, 'lunge'); def.loopsWant.jockey = 0; def.target.copy(ball.p).setY(0); def.want = 3;
    const vf = 3.4, vy = 4.4;
    ball.v.copy(f).multiplyScalar(vf).setY(vy); car.lastTouch = S.t;
    if (closeUp) hooks.cam('tv');          // the ball is up: the wide picture shows it go over him (the replay shows it close)
    const over = overWatch(def.pos.clone(), f);
    const land = landing(ball.v.x, vy, ball.v.z, ball.p);
    car.feet = null; car.faceLock = false;
    car.target.copy(def.pos).addScaledVector(r, pick(def.lastEvent, 11) < 0.5 ? 1.1 : -1.1); car.want = 5.5;
    let rounded = false;
    yield* until(() => { over(); if (!rounded && car.pos.distanceTo(def.pos) < 1.4) { rounded = true; car.target.copy(land); } return ball.v.y < 0 && ball.p.y < 0.7; }, 1.4);
    audit.overDef = over();
    noteSkill(audit, car);
    yield* collectAir(car, def, closeUp, land);
  }
  const SKILL_BEAT = { stepover: (car, def, closeUp) => stepoverBeat(beatContext, { car, def, closeUp }), nutmeg: nutmegBeat, elastico: (car, def, closeUp) => elasticoBeat(beatContext, { car, def, closeUp }), cruyff: cruyffBeat, croqueta: (car, def, closeUp) => croquetaBeat(beatContext, { car, def, closeUp }), roulette: rouletteBeat, flairnutmeg: flairNutmegBeat, rainbow: rainbowBeat, sombrero: sombreroBeat, juggle: juggleBeat };
  // a defender closes the carrier down and commits; success decides who gets the ball
  function* tackle(def, car, success, closeUp, slide) {
    if (!def || !car) return;
    if (keeperDown(car)) yield* until(() => !keeperDown(car), 3);          // (a keeper gets up before he is challenged)
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
      if (closeUp) hooks.cam('tv');
      yield* chase(car, null);
      return;
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
      if (rt.contactDistance(def, ball.p) > 0.44) {
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
  function jumpFor(p, { spot, heading, tArr, late = 0, short = 0 }) {
    const H = MOTIONS.header;
    // a beaten jumper arrives a touch late and a little short of the ball
    const at = spot.clone().add(V(Math.sin(heading) * -short, 0, Math.cos(heading) * -short));
    p.runUntil = tArr + 1.2; p.target.copy(at).setY(0); p.want = 7.4;
    // only a player who can get there in time goes up for it; the others just run in
    const lead = tArr - H.contact - S.t + late;
    if (Math.hypot(at.x - p.pos.x, at.z - p.pos.z) <= 4.2 * Math.max(0, lead) + 1.2) rt.headerAt(p, at, heading, Math.max(0, lead));
    return !!p.motion;
  }
  function planAerial(e, { receiver, target, tArr, hs, lb, jumper }) {
    const spot = V(target.x, rt.headHeight, target.z);
    const rival = rivalFor(receiver, spot);
    const inc = V(-ball.v.x, 0, -ball.v.z).normalize();
    if (hs) {
      S.headerCross = { p: receiver, spot, tArr };
      receiver.busy = true; receiver.target.copy(spot).setY(0); receiver.want = 7.4; receiver.runUntil = tArr + 1;
      // V7.9.5 he times his jump from the moment the cross is struck (the shot that follows may start a beat
      // later; jumping only then he met the ball on the way up, short of it)
      if (!receiver.motion) { const aimW = toWorld(hs.toPos || [spot.x > 0 ? 100 : 0, 50]), out = V(aimW.x - spot.x, 0, aimW.z - spot.z).normalize();
        rt.headerAt(receiver, spot, headingOf(out.multiplyScalar(1.6), inc), Math.max(0, tArr - MOTIONS.header.contact - S.t)); }
      if (rival) jumpFor(rival, { spot: spot.clone().add(V(-Math.sign(spot.x) * 0.7, 0, 0.35)), heading: headingOf(inc, V(0, 0, 0)), tArr, late: 0.1, short: 0.25 });
      return;
    }
    // won by the marker (a clearance) or flicked on by whoever got the faintest touch (a scramble)
    const to = toWorld(lb.toPos || lb.fromPos || [50, 50]);
    // the cross was aimed at the man expected to win it (see the corner): the marker for a clearance,
    // the target for a flick-on
    const winner = jumper || (lb.reason === 'clearance' ? rival : receiver), loser = winner === receiver ? rival : receiver;
    if (!winner) return;
    const out = V(to.x - spot.x, 0, to.z - spot.z).normalize();
    jumpFor(winner, { spot, heading: headingOf(inc, out), tArr });
    if (loser) jumpFor(loser, { spot: spot.clone().add(V(0.45, 0, -0.45)), heading: headingOf(inc, V(0, 0, 0)), tArr, late: 0.08, short: 0.3 });
    S.aerial = { at: tArr, to, winner };
  }

  // V7.9.3 a save turned behind for a corner: tipped over the bar, or round the post, on the side the corner is
  // given from (the engine puts the ball out at the corner flag: it does not fly there from the keeper's gloves)
  function cornerSide(i) {
    const out = events.slice(i + 1, i + 6).find(x => x.type === 'ballOut' && x.restartType === 'CORNER');
    const z = out ? toWorld(out.fromPos || out.toPos).z : ball.p.z;
    return Math.sign(z || 1);
  }
  function deflectBehind(goalSide, side) {
    const lineX = goalSide * GOAL_X, z0 = ball.p.z;
    if (Math.abs(z0) < 3.0) {
      // inside the posts: up over the bar, dropping behind the net, drifting to the corner's side
      const to = V(lineX + goalSide * 4.6, BALL_R, clamp(z0 + side * 1.6, -3.4, 3.4));
      for (let t = 0.7; t < 2.4; t += 0.05) {
        rt.kickAir(to, t);
        const tl = (lineX - ball.p.x) / ball.v.x, tb = (lineX + goalSide * 2 - ball.p.x) / ball.v.x;
        const y = tt => ball.p.y + ball.v.y * tt - 4.905 * tt * tt;
        if (tl > 0 && y(tl) > 2.8 && y(tb) > 1.9) break;
      }
    } else {
      // beside a post: round it and out over the line, away from the goal
      rt.kickAir(V(lineX + goalSide * 2.5, BALL_R, side * Math.max(Math.abs(z0) + 2.2, 5.5)), 0.7);
    }
    S.deflected = side;
  }
  // (V7.9.5: and the save itself — the engine logs it after the shot the catch was made in; it used to put the ball down)
  const HOLD_THROUGH = new Set(['offBallRun', 'chance', 'save', 'sub', 'yellow', 'red', 'injury', 'half', 'end', 'firstTouch']);
  function* dropFromHands(gk, why) {
    if (DEBUG) (stats.gkDrops ||= []).push({ t: +S.t.toFixed(1), why });
    gk.holding = false;
    if (gk.dive || gk.prone) yield* until(() => !gk.dive && !gk.prone, 3);
    const f = forwardOf(gk); ball.held = null; ball.v.set(f.x * 0.9, 0, f.z * 0.9);
    yield* until(() => ball.p.y < BALL_R + 0.02, 1);
  }
  const keeperDown = gk => !!(gk.prone || gk.dive || (gk.motion?.name === 'gkGetUp' && S.t - gk.motion.t0 < gk.motion.dur - 0.35));
  // ---- shot: aim from the engine outcome, keeper dives, outcome plays out physically ----
  function* shot(e, i) {
    const sh = P(e.fromId, e.fromSide); if (!sh) return;
    const defSide = sh.side === 'user' ? 'opp' : 'user';
    const gk = P(e.goalkeeperId, defSide) || keeperOf(defSide);
    // look ahead for the outcome details the engine logged after the shot
    const after = events.slice(i + 1, i + 6);
    const save = e.devSave || after.find(x => x.type === 'save'), post = after.find(x => x.type === 'post'), block = after.find(x => x.type === 'block');
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
    // V7.9: a Panenka (a penalty chipped softly down the middle as the keeper dives — goals only), a
    // chip over a keeper who has come out (a goal, or just over the bar) and the bicycle kick (from a cross)
    const tryShot = sh.side === 'user' && ['panenka', 'chip', 'bicycle'].includes(tryMove) ? tryMove : null;
    const fromGoal = Math.hypot(toWorld(e.fromPos || [50, 50]).x - lineX, toWorld(e.fromPos || [50, 50]).z);
    const panenka = !!e.penalty && outcome === 'goal' && (tryShot === 'panenka' || (has(sh, 'panenka') && pick(e, 29) < 0.35));
    let chip = !panenka && !e.penalty && !e.freeKick && !e.header && !!gk && (outcome === 'goal' || outcome === 'wide') && fromGoal < 24
      && (tryShot === 'chip' || (has(sh, 'chip') && fromGoal < 20 && pick(e, 33) < 0.35));
    const bicycle = !!hc && (tryShot === 'bicycle' || (has(sh, 'bicycle') && pick(e, 35) < 0.5));
    // V7.9: Higuita's scorpion — a looping ball dropping onto a keeper who has it; never when his team is losing
    // (the staged scene: the next saved shot at our goal of any kind but a penalty or a header)
    const tryScorp = gk?.side === 'user' && tryMove === 'scorpion' && outcome === 'save' && !hc && !e.penalty && !e.header;
    // (V7.9.4 only a keeper set and facing the shot: running back towards his goal he cannot throw himself at it)
    const gkFacing = !!gk && gk.vel.length() < 2.5 && Math.abs(Math.atan2(Math.sin(Math.atan2(ball.p.x - gk.pos.x, ball.p.z - gk.pos.z) - gk.heading), Math.cos(Math.atan2(ball.p.x - gk.pos.x, ball.p.z - gk.pos.z) - gk.heading))) < 0.6;
    const scorpion = !!gk && gkFacing && (tryScorp || (outcome === 'save' && !hc && !e.penalty && !e.freeKick && !e.header && save?.saveType !== 'CATCH' && fromGoal > 16
      && has(gk, 'scorpion') && !losing(gk.side) && (gk.used?.scorpion || 0) < 1 && pick(e, 47) < 0.08));
    if (scorpion && tryMove === 'scorpion') tryMove = null;
    if ((panenka && tryShot === 'panenka') || (chip && tryShot === 'chip') || (bicycle && tryShot === 'bicycle')) tryMove = null;
    if (panenka) aim = V(lineX + goalSide * 0.25, 1.05, clamp(tz * 0.15, -0.5, 0.5));
    const aim0 = aim.clone();
    // the flight time of a chip that clears the keeper's reach where he stands by 2.45 m (0: none does)
    const chipArc = () => {
      // (where along the flight it passes him: his position projected onto the line of the chip)
      const along = V(aim.x - ball.p.x, 0, aim.z - ball.p.z), L = along.length();
      const dk = gk ? clamp(V(gk.pos.x - ball.p.x, 0, gk.pos.z - ball.p.z).dot(along) / L, 1, L - 1) : L * 0.5;
      for (let t = L / 16; t < L / 7; t += 0.02) { const vy = (aim.y - ball.p.y + 4.905 * t * t) / t, tk = t * dk / L; if (ball.p.y + vy * tk - 4.905 * tk * tk >= 2.45) return t; }
      return 0;
    };
    if (chip) aim = outcome === 'goal' ? V(lineX + goalSide * 0.3, 1.35, clamp(tz, -2.4, 2.4)) : V(lineX, 2.75, clamp(tz, -2.6, 2.6));
    if (e.penalty) {
      const spot = toWorld(e.fromPos);
      if (sh.pos.distanceTo(spot) > 3.5) rt.place(sh, spot.clone().add(V(-goalSide * 1.2, 0, 0)), goalSide > 0 ? Math.PI / 2 : -Math.PI / 2);
      ball.p.copy(spot).setY(BALL_R); ball.v.set(0, 0, 0); ball.owner = sh;
    }
    // V7.9.3 a penalty: the keeper on his line, centred, in his set position; the taker walks back for a
    // short run-up from a little to one side (not a Panenka, which keeps its own build-up)
    const pen = !!e.penalty && !!gk && !panenka ? { lineX } : null;
    if (pen) {
      const spot = ball.p.clone().setY(0), mark = V(lineX - goalSide * 0.2, 0, 0);
      hooks.cam('pen', sh, gk, true);
      gk.busy = true; gk.face = spot; gk.faceLock = false; gk.target.copy(mark); gk.want = 4; gk.loopsWant.keeperReady = 1;
      const side = pick(e, 53) < 0.5 ? 1 : -1, back = spot.clone().add(V(-goalSide * 3.4, 0, side * 1.6));
      sh.busy = true; sh.target.copy(back); sh.want = 2.2; sh.face = spot; sh.faceLock = true;
      yield* until(() => { gk.target.copy(mark); return gk.pos.distanceTo(mark) < 0.3 && sh.pos.distanceTo(back) < 0.4; }, 4.5);
      sh.faceLock = false; sh.want = 0; gk.target.copy(gk.pos); gk.want = 0;
      yield* wait(0.7);                          // a moment's stillness before the run-up
    }
    if (!hc) yield* ensureOwner(sh);
    sh.busy = true; if (gk) gk.busy = true;
    hooks.cam(pen ? 'pen' : 'shot', sh, gk);
    let scoopAudit = null, rush = null;
    if (gk) {
      // the keeper sets himself on the line between the ball and the middle of his goal, a few
      // metres off it (further out for a shot from close in, to narrow the angle)
      const centre = V(lineX, 0, 0), toBall = V(ball.p.x - lineX, 0, ball.p.z), dist = toBall.length();
      const set = pen ? V(lineX - goalSide * 0.2, 0, 0) : chip ? V(ball.p.x, 0, ball.p.z).addScaledVector(toBall.clone().normalize(), -Math.min(4.5, dist * 0.5)) : centre.clone().addScaledVector(toBall.normalize(), clamp(dist * 0.12, 1.2, 4));
      gk.loopsWant.keeperReady = chip ? 0 : 1; gk.face = ball.p; gk.target.copy(set); gk.want = chip ? 7 : 5;
    }
    if (hc && bicycle) {
      yield* bicycleKick(sh, hc, aim);
      ball.owner = null; sh.lastTouch = S.t;
    } else if (hc) {
      // header: he times his jump so the forehead meets the cross, and nods it towards the aim
      const out = V(aim.x - hc.spot.x, 0, aim.z - hc.spot.z).normalize(), inc = V(-ball.v.x, 0, -ball.v.z).normalize();
      if (!sh.motion) rt.headerAt(sh, hc.spot, headingOf(out.clone().multiplyScalar(1.6), inc), Math.max(0, hc.tArr - MOTIONS.header.contact - S.t));
      // the contact is the frame the ball is closest to his forehead (the ball reaches it on about the planned frame)
      let bestH = Infinity;
      yield* until(() => {
        if (S.t < hc.tArr - 0.1) return false;
        const d = sh.motion ? rt.contactDistance(sh, ball.p) : Infinity;
        if (d < 0.12 || S.t > hc.tArr + 0.1 || (d > bestH + 0.02 && S.t >= hc.tArr)) return true;
        bestH = Math.min(bestH, d); return false;
      }, hc.tArr - S.t + 0.5);
      if (DEBUG) S.headerT = hc.tArr;
      noteContact('header', sh);
      ball.owner = null; sh.lastTouch = S.t;
    } else {
      // V7.9.3 one on one: through on goal with nobody left to beat, the keeper comes off his line to narrow
      // the angle while the man runs at him; close in, a save is made by going down at his feet
      const goalC = V(lineX, 0, 0);
      const clearRun = () => {
        const b = V(ball.p.x, 0, ball.p.z), seg = goalC.clone().sub(b), L = seg.length(); seg.normalize();
        return !rt.players.some(q => !q.offPitch && q.side !== sh.side && q.role !== 'GK' && (() => { const r = V(q.pos.x - b.x, 0, q.pos.z - b.z), a = r.dot(seg); return a > 0.5 && a < L && Math.abs(r.x * seg.z - r.z * seg.x) < 2.6; })());
      };
      if (gk && !pen && !panenka && !chip && !scorpion && !e.penalty && !e.freeKick && ['save', 'goal', 'wide'].includes(outcome)
        && !e.devFoot && !gk.dive && !gk.prone && !gk.motion && Math.abs(gk.pos.x - lineX) < Math.abs(ball.p.x - lineX) - 4
        && Math.abs(gk.pos.x - lineX) < 14          // (V7.9.5: a keeper caught far upfield races back instead: he does not come out from out there)
        && (e.devRush || (fromGoal < 19 && Math.abs(ball.p.z) < 13 && Math.abs(ball.p.x - lineX) > 7 && clearRun()))) {
        rush = { line0: +Math.abs(gk.pos.x - lineX).toFixed(2) };
        const spotFor = () => { const b = V(ball.p.x, 0, ball.p.z), toB = b.clone().sub(goalC), L = toB.length(); return goalC.clone().addScaledVector(toB.normalize(), clamp(L - clamp(L * 0.2, 2.2, 3.2), 1.2, 11)); };     // (never out of his box)
        gk.face = ball.p; gk.faceLock = false;
        // the two of them from the side as the keeper closes in (when they are close enough to share a side-on
        // picture; further apart, from behind the man, the goal and the keeper ahead of him)
        hooks.cam(Math.hypot(gk.pos.x - ball.p.x, gk.pos.z - ball.p.z) < 9 ? 'side' : 'shot', sh, gk);
        // the man steadies himself with the ball at his feet while the keeper races out to meet him
        yield* ensureOwner(sh); sh.busy = true;
        const s = spotFor(); gk.target.copy(s);
        yield* until(() => {
          const far = gk.pos.distanceTo(s);
          gk.want = far > 1.2 ? 7.5 : 2.5; gk.loopsWant.keeperReady = far > 2 ? 0 : 1;
          sh.target.copy(sh.pos); sh.want = 0; sh.face = ball.p;
          const g = Math.hypot(gk.pos.x - ball.p.x, gk.pos.z - ball.p.z);
          if (g < 9 && !rush.sideCam) { rush.sideCam = true; hooks.cam('side', sh, gk); }
          // (he stops about 4.5 m off: still coming at full speed he needs room to pull up)
          return g - gk.vel.lengthSq() / 18 < 4.5 || far < 0.5;
        }, 2.4);
        gk.target.copy(gk.pos); gk.want = 0; gk.loopsWant.keeperReady = 1;
        yield* until(() => gk.vel.length() < 1.2, 0.8);            // he pulls up and sets himself
      }
      // a save needs a keeper in front of the shot: caught out of position, he races back while the
      // shooter steadies himself (never a save by a keeper standing behind the shooter)
      if (gk && !rush && outcome === 'save' && !e.penalty && !e.freeKick && gk.pos.distanceTo(gk.target) > 3) {
        gk.want = 7.5;
        yield* until(() => gk.pos.distanceTo(gk.target) < 1.2, Math.min(2.5, gk.pos.distanceTo(gk.target) / 6.5 + 0.4));
        gk.want = 5;
      }
      if (chip && gk) yield* until(() => gk.pos.distanceTo(gk.target) < 1.2 || Math.hypot(gk.pos.x - ball.p.x, gk.pos.z - ball.p.z) < 6.5, 2.4);        // he waits for the keeper to commit
      // no chip that cannot get over him (a tight angle, the keeper right on top of him): he just shoots
      if (chip && !chipArc()) { chip = false; aim.copy(aim0); if (tryShot === 'chip') tryMove = 'chip'; }
      // V7.9.3 a keeper still down (or getting up) from the last save cannot dive for this one: a shot he saves
      // waits until he is up (the man takes a touch); a shot that beats him beats him on the ground
      if (gk && outcome === 'save' && !pen && !scorpion && keeperDown(gk)) yield* until(() => !keeperDown(gk), 2.2);
      const kname = panenka || chip ? 'pass' : 'shot';
      const dir = yield* approachAim(sh, kname, aim);
      if (rush) {
        rush.gap = Math.hypot(gk.pos.x - ball.p.x, gk.pos.z - ball.p.z); if (DEBUG) rush.gap0 = +rush.gap.toFixed(2);
        // close in and saved: he goes down sideways across the ball's path, hands first at the man's feet
        if (outcome === 'save' && rush.gap < 6.5) {
          rush.smother = pick(e, 59) < 0.5 ? 1 : -1;
          const toB = V(ball.p.x - gk.pos.x, 0, ball.p.z - gk.pos.z).normalize(), a = rush.smother * 1.25;
          const f = toB.clone().applyAxisAngle(V(0, 1, 0), -a);         // turned side-on: he goes down hands first towards the ball
          gk.face = gk.pos.clone().addScaledVector(f, 10); gk.faceLock = true; gk.loopsWant.keeperReady = 0;
        }
      }
      rt.startAction(sh, kname); rt.kickWarp(sh, kname, dir);
      if (panenka || chip) hooks.slow(0.4);
      yield* until(() => rt.actionAtContact(sh), 2);
      if (pen) { pen.strike = S.t; pen.onLine = +Math.abs(gk.pos.x - lineX).toFixed(2); }
      if (rush) { rush.out = +Math.abs(gk.pos.x - lineX).toFixed(2); rush.gap = +Math.hypot(gk.pos.x - ball.p.x, gk.pos.z - ball.p.z).toFixed(2); }
      if (panenka || chip) { const toe = sh.toes[1].getWorldPosition(V()); scoopAudit = { kind: panenka ? 'panenka' : 'chip', contact: +Math.hypot(toe.x - ball.p.x, toe.z - ball.p.z).toFixed(3) }; }
    }
    // a save happens in the keeper's hands, in front of his line: the shot is aimed at the spot his
    // gloves can reach (within a dive and an arm of where he stands), not at the goal line
    let smother = 0;
    if (outcome === 'save' && gk && rush?.smother) {
      const toK = V(gk.pos.x - ball.p.x, 0, gk.pos.z - ball.p.z), d = toK.length();
      aim = ball.p.clone().addScaledVector(toK.normalize(), Math.max(0.6, d - 1.3)).setY(0.22);
      smother = Math.min(1, Math.max(0.45, d / 6));
    } else if (outcome === 'save' && gk) {
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
    const dist = aim.distanceTo(ball.p);
    // a chip is given just enough air to clear the keeper's reach where he stands (no higher)
    const chipT = chip ? chipArc() : 0;
    const flight = scorpion ? 1.3 : panenka ? 1.1 : chip ? chipT : Math.max(0.35, dist / ((e.header ? 14 : e.freeKick ? 19 : 24) * (S.tune?.ball ?? 1)), smother);
    // a blocker steps into the line first
    let blocker = null;
    if (outcome === 'block' && block) {
      blocker = P(block.toId, block.toSide || sideOf(block.toId));
      if (blocker && blocker.role !== 'GK') { const bp = ball.p.clone().lerp(aim, Math.min(0.35, 3.5 / dist)); blocker.busy = true; blocker.target.set(bp.x, 0, bp.z); blocker.want = 6; }
    }
    ball.allowOut = true;
    // V7.9: a low shot just beside him is kept out with the foot — the leg goes out, he stays on his feet
    let footSide = null, starReach = false;
    let scorp = null;
    if (scorpion) {       // he stands his ground; the ball drops onto the spot above his back where his heels will be
      gk.vel.set(0, 0, 0); gk.target.copy(gk.pos); gk.want = 0;
      scorp = scorpionBody(gk, S.t + flight); aim.copy(scorpionSpot(gk, S.t + flight, scorp));
    }
    else if (gk && outcome === 'save') {
      const R = rightOf(gk), F = forwardOf(gk), lat = aim.clone().sub(gk.pos).dot(R);
      if (e.devFoot || !e.penalty && save?.saveType !== 'CATCH' && !smother && aim.y < 0.75 && Math.abs(lat) > 0.2 && Math.abs(lat) < 1.0 && gk.vel.length() < 1.5 && !gk.dive && !gk.motion && pick(e, 43) < 0.7) {
        footSide = lat > 0 ? 'Right' : 'Left';
        const spot = gk.pos.clone().addScaledVector(R, clamp(lat, -0.75, 0.75)).addScaledVector(F, 0.3).setY(0.13);
        aim.copy(spot);
        gk.feet = { [footSide]: { w: ramp(S.t, [Math.max(0, flight - 0.38), Math.max(0.06, flight - 0.12), flight + 0.3, flight + 0.6]), at: () => spot } };
        gk.loopsWant.keeperReady = 1; gk.target.copy(gk.pos); gk.want = 0;            // he stays where he is set and puts the leg out
      } else {
        // plan the dive first, then send the ball exactly to where his gloves will be on the save frame
        { const ah = +aim.y.toFixed(2), la = +Math.abs(lat).toFixed(2);      // (V7.9.5: decided on the same rounded numbers it reports)
          starReach = ah > 1.3 && la > 1.9 && (e.eventId === 16 || pick(e, 45) < 0.3) && { aimH: ah, lat: la }; }          // high and far into a corner (about a third of them)
        rt.planDive(gk, aim.clone(), flight, true, pen ? 0.02 : rush?.smother ? 0.03 : 0.12);
        const g = rt.diveHands(gk);
        aim.set(g.x, Math.max(0.2, g.y), g.z);
      }
    }
    const savePoint = () => footSide ? (gk.feet?.[footSide]?.last || rt.handsOf(gk)) : rt.handsOf(gk);
    rt.kickAir(aim, flight);
    if (gk && outcome === 'save') ball.through = S.t + flight + 0.05;
    if (panenka || chip) ball.through = S.t + flight + 0.3;
    if (scoopAudit) {
      // the chip's arc: the highest point, and how high it is as it goes over the keeper
      const vy = ball.v.y, apex = ball.p.y + vy * vy / (2 * 9.81);
      Object.assign(scoopAudit, { speed: +Math.hypot(ball.v.x, ball.v.z).toFixed(1), apex: +apex.toFixed(2) });
      if (gk) { const along = V(aim.x - ball.p.x, 0, aim.z - ball.p.z), L = along.length(), k = clamp(V(gk.pos.x - ball.p.x, 0, gk.pos.z - ball.p.z).dot(along) / (L * L), 0, 1), tk = k * flight; scoopAudit.overKeeper = +(ball.p.y + vy * tk - 4.905 * tk * tk).toFixed(2); }
      noteSkill(scoopAudit, sh);
    }
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
    else if (gk && pen) {
      const r = pick(e, 55), z = aim.z || 0.01, side = r < 0.6 ? -Math.sign(z) : Math.sign(z);
      if (r < 0.88) rt.planDive(gk, V(lineX - goalSide * 0.4, r < 0.6 ? 0.5 + pick(e, 57) * 0.9 : aim.y, r < 0.6 ? side * 2.6 : z), Math.max(0.3, flight), false, 0.02);
      pen.guess = r < 0.6 ? 'wrong' : r < 0.88 ? 'beaten' : 'stood';
    } else if (gk && panenka) {
      // he guesses a corner and goes early
      const side = pick(e, 31) < 0.5 ? 1 : -1;
      rt.planDive(gk, V(lineX - goalSide * 0.4, 0.6, side * 2.5), 0.5, false);
    } else if (gk && chip) {
      // caught off his line: he stretches up, the ball is already over him
      const at = ball.p.clone().addScaledVector(ball.v, tArrive); at.y = Math.min(1.9, ball.p.y + ball.v.y * tArrive - 0.5 * 9.81 * tArrive * tArrive - 0.8);
      rt.planDive(gk, at, Math.max(0.3, tArrive), false);
    } else if (gk && keeperDown(gk)) {
      /* still on the ground: no dive from there */
    } else if (gk && outcome !== 'wide' && outcome !== 'block') {
      const at = ball.p.clone().addScaledVector(ball.v, tArrive); at.y = ball.p.y + ball.v.y * tArrive - 0.5 * 9.81 * tArrive * tArrive;
      rt.planDive(gk, at, tArrive, outcome === 'save');
    } else if (gk && outcome === 'wide' && Math.abs(aim.z) < 6) {
      const at = ball.p.clone().addScaledVector(ball.v, tArrive); at.y = 0.8;
      rt.planDive(gk, at, tArrive, false);
    }
    if (pen && gk.dive) pen.early = +(gk.dive.start - pen.strike).toFixed(2);
    sh.busy = false;
    // flight
    const t0 = S.t;
    if (outcome === 'save' && gk && scorpion) {
      yield* scorpionSave(gk, t0 + flight, scorp);
      if (save?.saveType === 'CATCH') { ball.v.set(-goalSide * 1.2, 4.5, 0); ball.owner = null; }       // it loops up off his heels and he gathers it
      else if (save?.saveType === 'DEFLECT_CORNER') { ball.owner = null; deflectBehind(goalSide, cornerSide(i)); }
      else { const r = toWorld(save?.toPos || [goalSide > 0 ? 88 : 12, 50]); ball.v.set((r.x - ball.p.x) * 0.55, 6.5, (r.z - ball.p.z) * 0.55); ball.owner = null; }
    } else if (outcome === 'save' && gk) {
      yield* until(() => (savePoint().distanceTo(ball.p) < 0.3 && S.t - t0 > flight * 0.6) || S.t - t0 >= flight, flight + 0.2);
      (stats.contacts.save ||= []).push(+savePoint().distanceTo(ball.p).toFixed(2));
      if (rush) Object.assign(rush, { contact: +savePoint().distanceTo(ball.p).toFixed(2), hips: +gk.bones.Hips.getWorldPosition(V()).y.toFixed(2) });
      if (footSide) { (stats.footSaves ||= []).push(+savePoint().distanceTo(ball.p).toFixed(2)); const fe = gk.feet; later(0.6, () => { if (gk.feet === fe) gk.feet = null; }); }
      // V7.9.3: a penalty saved — on his line at the strike, gone the right way as it was struck: its replay follows
      else if (pen) noteSkill({ kind: 'pensave', hands: +savePoint().distanceTo(ball.p).toFixed(3), onLine: pen.onLine, early: pen.early ?? null, h: +ball.p.y.toFixed(2), bz: +ball.p.z.toFixed(2) }, gk);
      // V7.9: a full-stretch save into the top of the goal is a star moment: its replay follows (once a match for him)
      else if (starReach && gk.dive && (gk.used?.starsave || 0) < 1 && savePoint().distanceTo(ball.p) < 0.35)
        noteSkill({ kind: 'starsave', hands: +savePoint().distanceTo(ball.p).toFixed(3), h: +ball.p.y.toFixed(2), ...starReach }, gk);
      if (DEBUG) (stats.saveLog ||= []).push({ t: +S.t.toFixed(2), el: +(S.t - t0).toFixed(2), flight: +flight.toFixed(2), aim: aim.toArray().map(v => +v.toFixed(2)), ball: ball.p.toArray().map(v => +v.toFixed(2)), hands: rt.handsOf(gk).toArray().map(v => +v.toFixed(2)), gk: gk.pos.toArray().map(v => +v.toFixed(2)), h: +gk.heading.toFixed(2), dive: gk.dive && { roll: +gk.dive.roll.toFixed(2), slide: +gk.dive.slide.toFixed(2), lift: +gk.dive.lift.toFixed(2), tc: +gk.dive.tc.toFixed(2), cur: gk.dive.cur && { roll: +gk.dive.cur.roll.toFixed(2), slide: +gk.dive.cur.slide.toFixed(2) } } });
      const catchIt = save?.saveType === 'CATCH';
      if (catchIt) {      // held — on the ground and while he gets up — then dropped to his feet
        ball.held = rt.pickUp(() => rt.handsOf(gk), 0.12); ball.owner = gk;
        yield* wait(1.4); yield* until(() => !gk.dive && (!gk.motion || S.t - gk.motion.t0 > gk.motion.dur - 0.3), 3);
        // V7.9.3: he keeps it in his hands (getting up and after) until his next action with it: a pass is thrown
        // or volleyed from the hands; anything else and he drops it to his feet then (see run)
        gk.holding = true; ball.owner = gk;
      }
      else if (save?.saveType === 'DEFLECT_CORNER') { ball.owner = null; stats.deflects = (stats.deflects || 0) + 1; deflectBehind(goalSide, cornerSide(i)); }
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
    if (rush) { (stats.rushes ||= []).push({ ...rush, outcome }); gk.faceLock = false; }
    if (pen) (stats.pens ||= []).push({ outcome, onLine: pen.onLine, guess: pen.guess || 'save', early: pen.early ?? null });
    // a parry, rebound or block stays in play; a goal or a ball over the line does not
    const leaves = outcome === 'goal' || outcome === 'wide' || (outcome === 'save' && save?.saveType === 'DEFLECT_CORNER');
    if (!leaves) { yield* wait(0.25); ball.allowOut = false; }
    hooks.slow(1);
    yield* wait(0.5);
    if (gk) gk.busy = false;
    hooks.cam('tv');
  }

  // bicycle kick: back to goal under the cross, he throws himself up and over backwards and the right
  // boot meets the ball above his head; he lands on his back and gets up
  function* bicycleKick(p, hc, aim) {
    const toGoal = V(aim.x - hc.spot.x, 0, aim.z - hc.spot.z).normalize(), face = toGoal.clone().negate();
    const stand = hc.spot.clone().setY(0).addScaledVector(toGoal, -0.55), h = Math.atan2(face.x, face.z), tArr = hc.tArr;
    p.busy = true; p.face = stand.clone().addScaledVector(face, 20); p.faceLock = true;
    yield* until(() => { p.target.copy(stand); const d = Math.hypot(stand.x - p.pos.x, stand.z - p.pos.z); p.want = d > 2 ? 7 : d > 0.1 ? 2 + d * 3 : 0; return S.t >= tArr - 0.5; }, Math.max(0.1, tArr - S.t));
    const t0 = S.t, at = p.pos.clone();
    hooks.slow(0.4);
    ball.through = tArr + 1;
    p.drive = { pos: () => at, heading: () => h };
    const T = tArr;
    // over backwards: up to just past horizontal at the strike, down onto his back, then up again
    p.flip = t => {
      const u = t - t0, c = T - t0;
      if (u < c) { const k = smooth01(u / c); return { pitch: 1.75 * k, lift: 0.8 * k }; }
      const v = u - c;
      if (v < 0.35) { const k = smooth01(v / 0.35); return { pitch: 1.75 + 0.2 * k, lift: 0.8 - 0.62 * k }; }
      if (v < 0.95) return { pitch: 1.95, lift: 0.18 };
      if (v < 1.45) { const k = smooth01((v - 0.95) / 0.5); return { pitch: 1.95 * (1 - k), lift: 0.18 * (1 - k) }; }
      return null;
    };
    rt.startAction(p, 'bicycle');
    p.feet = { Right: { w: t => clamp((t - (T - 0.3)) / 0.25, 0, 1) * (t < T + 0.15 ? 1 : Math.max(0, 1 - (t - T - 0.15) / 0.2)), at: () => ball.p.clone() } };
    const audit = { kind: 'bicycle' };
    yield* until(() => S.t >= T || toeGap(p, 'Right') < 0.18, T - S.t + 0.3);
    const fl = p.flip(S.t);
    Object.assign(audit, { contact: +toeGap(p, 'Right').toFixed(3), pitch: +(fl?.pitch ?? 0).toFixed(2), h: +ball.p.y.toFixed(2) });
    noteSkill(audit, p);
    const feet = p.feet;
    later(1.6, () => { p.drive = null; p.flip = null; if (p.feet === feet) p.feet = null; p.faceLock = false; p.busy = false; });
  }
  // V7.9: Higuita's scorpion kick (Colombia v England, Wembley 1995) — our own version: the ball loops down
  // onto him, he throws himself forward face down, the legs fold up over his back and the heels send it
  // back out; he lands on his hands and chest and gets up
  const SCORP_LEAD = 0.55;
  function scorpionBody(gk, T) {
    const F = forwardOf(gk), h = gk.heading, at0 = gk.pos.clone();
    return {
      pos: t => { const k = smooth01(clamp((t - (T - SCORP_LEAD)) / 0.9, 0, 1)); return at0.clone().addScaledVector(F, 1.2 * k); },
      heading: () => h,
      flip: t => {
        const u = t - (T - SCORP_LEAD);
        if (u < 0) return { pitch: 0, lift: 0 };
        // flat in the air at about hip height (he flies, not a nose-dive), then down onto his hands and chest
        if (u < SCORP_LEAD) { const k = smooth01(u / SCORP_LEAD); return { pitch: -1.45 * k, lift: 0.16 * Math.sin(Math.PI * k) }; }
        const v = u - SCORP_LEAD;
        if (v < 0.4) { const k = smooth01(v / 0.4); return { pitch: -1.45 - 0.11 * k, lift: -0.82 * k }; }
        return { pitch: -1.56, lift: -0.82 };          // he lies there until he rolls over to get up (runtime)
      },
    };
  }
  // where the heels meet the ball: above his back as he lies flat in the air
  function scorpionSpot(gk, T, b) {
    const fl = b.flip(T), hips = b.pos(T).setY(0.95 + fl.lift);
    return hips.addScaledVector(forwardOf(gk), 0.18).add(V(0, 0.58, 0));          // over his back, behind his head (the heels never come past it)
  }
  function* scorpionSave(gk, T, body) {
    const F = forwardOf(gk);
    gk.busy = true; gk.faceLock = true; gk.loopsWant.keeperReady = 0; gk.act = null; gk.motion = null;
    yield* until(() => { gk.target.copy(gk.pos); gk.want = 0; gk.vel.set(0, 0, 0); return S.t >= T - SCORP_LEAD; }, Math.max(0, T - SCORP_LEAD - S.t) + 0.1);
    hooks.slow(0.4); ball.through = T + 1; hooks.cam('close', gk);         // the live picture goes to him
    gk.drive = { pos: body.pos, heading: body.heading }; gk.flip = body.flip;
    rt.startAction(gk, 'scorpion'); gk.act.t0 = T - ACTIONS.scorpion.dur * ACTIONS.scorpion.contact;
    // the heels reach the ball with the knees folding up behind him (not forwards)
    const w = ramp(T - 0.32, [0, 0.26, 0.38, 0.52]), R = () => rightOf(gk), behind = () => F.clone().negate().add(V(0, 1.2, 0));
    // the heels go to where the ball will be at the strike (above his back), not chasing it forwards early
    const spot = scorpionSpot(gk, T, body);
    gk.feet = { Left: { w, at: () => spot.clone().addScaledVector(R(), -0.09), pole: behind }, Right: { w, at: () => spot.clone().addScaledVector(R(), 0.09), pole: behind } };
    // arms out in front in flight (Superman), then down to the grass to land on
    const hw = ramp(T - SCORP_LEAD + 0.05, [0, 0.2, 1.6, 2.0]), hips = () => gk.bones.Hips.getWorldPosition(V());
    const hand = side => t => {
      const fly = hips().addScaledVector(F, 1.15).addScaledVector(R(), side * 0.22).add(V(0, 0.2, 0));
      const land = gk.pos.clone().addScaledVector(F, 0.7).addScaledVector(R(), side * 0.28).setY(0.06);
      return fly.lerp(land, smooth01(clamp((t - T - 0.05) / 0.3, 0, 1)));
    };
    gk.hands = { Left: { w: hw, at: hand(-1) }, Right: { w: hw, at: hand(1) } };
    const near = () => Math.min(toeGap(gk, 'Left'), toeGap(gk, 'Right'));
    yield* until(() => S.t >= T - 0.02 && near() < 0.22 || S.t >= T + 0.06, T - S.t + 0.3);
    const fl = gk.flip(S.t), audit = { kind: 'scorpion', contact: +near().toFixed(3), pitch: +(fl?.pitch ?? 0).toFixed(2), h: +ball.p.y.toFixed(2) };
    // how far the boots are behind his head along his line of flight (they must not come out past it)
    const head = gk.bones.Head.getWorldPosition(V()), toes = gk.toes.map(t => t.getWorldPosition(V()).sub(head).dot(F));
    audit.behindHead = +(-Math.max(...toes)).toFixed(2);
    if (DEBUG) { const hp = gk.bones.Hips.getWorldPosition(V()), d = q => +q.clone().sub(hp).dot(F).toFixed(2) + '/' + q.y.toFixed(2); audit.dbg = { head: d(head), toeL: d(gk.toes[0].getWorldPosition(V())), toeR: d(gk.toes[1].getWorldPosition(V())), ball: d(ball.p), heel: d(gk.bones.LeftFoot.getWorldPosition(V())) }; }
    (stats.contacts.save ||= []).push(+near().toFixed(2));
    noteSkill(audit, gk);
    const feet = gk.feet, hands = gk.hands;
    // down on his hands and chest, he lies a moment, pushes himself up into a crouch and stands up from it
    // (V7.9.8: he no longer rolls over onto his back first)
    later(0.9, () => {
      if (gk.feet === feet) gk.feet = null; if (gk.hands === hands) gk.hands = null;
      rt.riseFromFront(gk);
      if (DEBUG) audit.rise = { t0: S.t };
    });
    later(0.9 + 0.25 + 0.7 + 0.7 + 0.6, () => { gk.faceLock = false; gk.busy = false; hooks.slow(1); });
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
    if (e.homeGoals != null) { hooks.score(e.homeGoals, e.awayGoals); S.score = [e.homeGoals, e.awayGoals]; }
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
    // (never during a restart before it: nobody is offside from a throw-in, a goal kick or a corner, and a
    // runner heading off early could meet the thrown ball himself and look like he was flagged from it)
    const offK = events.slice(i + 1, i + 4).findIndex(x => x.type === 'offside'), offAhead = offK >= 0 ? events[i + 1 + offK] : null;
    const restartFirst = offAhead && events.slice(i, i + 1 + offK).some(x => x.restartType || ['throwIn', 'goalKick', 'corner', 'ballOut'].includes(x.type));
    if (offAhead && !restartFirst && S.offRun !== offAhead.eventId) {
      const r = P(offAhead.toId, offAhead.toSide);
      if (r && !r.busy && ball.owner !== r) { S.offRun = offAhead.eventId; r.target.copy(toWorld(offAhead.toPos)); r.want = 6.8; r.runUntil = S.t + 8; r.face = null; }
    }
    // V7.9.3 a keeper holding the ball after a catch keeps it in his hands through moments without the ball;
    // when the play needs it on the grass (he runs with it, he is closed down, …) he drops it to his feet
    const hk = rt.players.find(p => p.holding);
    if (hk && (!ball.held || ball.owner !== hk)) { if (DEBUG) (stats.gkDrops ||= []).push({ t: +S.t.toFixed(1), lost: e.type, held: !!ball.held, own: ball.owner === hk }); hk.holding = false; }
    else if (hk && !HOLD_THROUGH.has(e.type) && !(e.type === 'pass' && e.fromId === hk.id && e.fromSide === hk.side)) yield* dropFromHands(hk, e.type);
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
            yield* pass({ from, to: mate, toW: mate.pos.clone(), travel: 'ground' });
            yield* wait(0.3);
            yield* pass({ from: mate, to: from, toW: from.pos.clone(), travel: 'ground' });
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
        const pk = events[i + 1]?.type === 'looseBall' && events[i + 1].reason === 'punch' ? events[i + 1] : null, pgk = pk && P(pk.punchBy, pk.punchSide);
        if (pgk && (e.type === 'corner' || e.type === 'cross' || e.travelType === 'aerial')) {
          // V7.9.3 the keeper punches it: the ball is aimed where he can get to it in time
          // he meets it around his six-yard box (where a keeper comes for a ball), never further than he can run to in time
          const gx = ownGoalX(pgk.side), sg = Math.sign(gx);
          target.set(gx - sg * clamp(Math.abs(target.x - gx), 3.5, 8.5), 0, clamp(target.z, -8, 8));
          const flight = Math.max(0.7, Math.hypot(target.x - ball.p.x, target.z - ball.p.z) / 17);
          const gap = V(target.x - pgk.pos.x, 0, target.z - pgk.pos.z), reach = 4.3 * Math.max(0, flight - MOTIONS.header.contact - 0.35) + 0.4;
          if (gap.length() > reach) target.copy(pgk.pos).addScaledVector(gap.normalize(), reach).setY(0);
          pgk.busy = true; pgk.target.copy(target).setY(0); pgk.want = 7.5; pgk.loopsWant.keeperReady = 0;
          if (DEBUG) pgk.punchVia = [e.type, e.restartType || '', +flight.toFixed(2), +gap.length().toFixed(1), +reach.toFixed(1), +Math.hypot(target.x - ball.p.x, target.z - ball.p.z).toFixed(1)];
          const rival = receiver && receiver.side !== pgk.side ? receiver : null;
          popts.height = PUNCH_H; popts.meet = tArr => { S.punch = { gk: pgk, spot: target.clone().setY(PUNCH_H), tArr, land: toWorld(pk.toPos), rival }; };
        } else if (receiver && (e.type === 'corner' || e.type === 'cross')) {
          const nx = events[i + 1];
          const hs = nx?.type === 'shot' && nx.header && nx.fromId === e.toId ? nx : null;
          const lb = !hs && (e.type === 'corner' || e.type === 'cross') && nx?.type === 'looseBall' && (nx.reason === 'clearance' || nx.reason === 'aerial') ? nx : null;   // (V7.9.4 open-play crosses are contested the same way)
          if (hs || lb) {
            // the cross is aimed where the man who meets it can actually get to (a header taker runs onto it)
            const jumper = hs || lb.reason !== 'clearance' ? receiver : rivalFor(receiver, target) || receiver;
            let flight = Math.max(0.7, Math.hypot(target.x - ball.p.x, target.z - ball.p.z) / 17);
            // V7.9.4 an open-play cross: the man on the ball waits (a touch, a look up) while the runner gets into
            // the box, so the cross is put where the engine says it goes, not wherever the runner happens to be
            if (e.type === 'cross' && jumper && ball.owner === from) {
              // he crosses from where the engine has him (out wide in the attacking third): if the picture has him
              // further back, he runs it up there first
              const fp = toWorld(e.fromPos || [50, 50]);
              if (Math.hypot(fp.x - from.pos.x, fp.z - from.pos.z) > 6) {
                from.busy = true;
                yield* until(() => { rt.dribble(from, fp, 6.5); return ball.owner !== from || Math.hypot(ball.p.x - fp.x, ball.p.z - fp.z) < 4; }, 3);   // (a few seconds at most)
              }
              if (ball.owner !== from) yield* ensureOwner(from);
              from.busy = true; jumper.target.copy(target).setY(0); jumper.want = 7.4; jumper.runUntil = S.t + 6; jumper.face = null;
              yield* until(() => { from.target.copy(from.pos); from.want = 0; return Math.hypot(target.x - jumper.pos.x, target.z - jumper.pos.z) < 3.7 * Math.max(0, flight - MOTIONS.header.contact - 0.1) + 1.0; }, 3.5);
              flight = Math.max(0.7, Math.hypot(target.x - ball.p.x, target.z - ball.p.z) / 17);
            }
            // he sprints from a standing start while the ball is in the air, then steps into the jump
            const gap = V(target.x - jumper.pos.x, 0, target.z - jumper.pos.z);
            // time lost turning round if he is running the other way
            const lost = Math.max(0, jumper.vel.length() - jumper.vel.dot(gap.clone().normalize())) / 9;
            const reach = 3.7 * Math.max(0, flight - MOTIONS.header.contact - lost - 0.1) + 1.0;
            if (gap.length() > reach) target.copy(jumper.pos).addScaledVector(gap.normalize(), reach).setY(0);
            // he sets off as the kick is struck, not when the ball is already in the air
            // (V7.9.5: and he holds that spot until the ball is struck — the cross can take a few seconds to come)
            jumper.target.copy(target).setY(0); jumper.want = 7.4; jumper.runUntil = S.t + flight + 8; jumper.face = null;
            if (DEBUG) (stats.jumpLog ||= []).push({ t: +S.t.toFixed(2), id: jumper.id, side: jumper.side, gap: +gap.length().toFixed(2), reach: +reach.toFixed(2), pos: jumper.pos.toArray().map(v => +v.toFixed(2)), busy: jumper.busy, motion: jumper.motion?.name });
            popts.height = rt.headHeight; popts.meet = tArr => planAerial(e, { receiver, target, tArr, hs, lb, jumper });
          }
        }
        yield* pass({ from, to: receiver, toW: target, travel: e.travelType === 'aerial' || e.type === 'cross' || e.type === 'corner' ? 'aerial' : 'ground', implicit: false }, popts);
        if (e.restartType) ball.allowOut = false;
        break;
      }
      case 'firstTouch': if (from && ball.owner !== from) yield* ensureOwner(from); break;
      case 'looseBall': {
        if (S.punch) { const k = S.punch; S.punch = null; yield* keeperPunch(k.gk, k.spot, k.tArr, k.land, k.rival); break; }
        if (S.aerial) {
          // headed away (or flicked on) at the top of the jump
          const a = S.aerial; S.aerial = null;
          { let bestA = Infinity;       // (the frame the ball is closest to his forehead)
            yield* until(() => {
              if (S.t < a.at - 0.1) return false;
              const d = a.winner.motion ? rt.contactDistance(a.winner, ball.p) : Infinity;
              if (d < 0.12 || S.t > a.at + 0.1 || (d > bestA + 0.02 && S.t >= a.at)) return true;
              bestA = Math.min(bestA, d); return false;
            }, a.at - S.t + 0.5); }
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
        // (V7.9.10 the scorers' fans go up, the other end falls silent)
        hooks.banner('GOL', 2600); hooks.excite(1, (e.fromSide === 'user') === !!meta.userHome ? 'home' : 'away');
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
        // a corner: it goes out over the goal line (beside the goal), not at the flag the engine marks
        if (e.restartType === 'CORNER') { outW.x = Math.sign(outW.x || 1) * (GOAL_X + 0.6); outW.z = Math.sign(outW.z || 1) * clamp(Math.abs(ball.p.z) + 3, 5.5, 32); }
        const out0 = ball.p.clone();
        S.deflected = null;
        if (!ball.out && !ball.held) {
          // the ball runs out where the engine says it went out (a ball in the air carries on and drops)
          ball.owner = null;
          const far = Math.hypot(outW.x - ball.p.x, outW.z - ball.p.z);
          const corner = e.restartType === 'CORNER';
          if (corner && far > 30) { /* the picture is elsewhere: no 80 m flight, the ball is placed at the flag for the corner */ }
          else if (corner && Math.abs(ball.p.z) < 4.2 && Math.abs(ball.p.x) > GOAL_X - 14) deflectBehind(Math.sign(outW.x), Math.sign(outW.z || 1));   // in front of goal: over the bar
          else if (corner) { rt.kickAir(V(outW.x, BALL_R, outW.z), Math.max(0.9, far / 15)); ball.through = S.t + Math.max(0.9, far / 15); }
          else if (ball.p.y > 0.3 || far > 12) rt.kickAir(V(outW.x, BALL_R, outW.z), Math.max(0.6, far / 15));
          else rt.kickGround(outW, Math.max(2.5, Math.min(6, Math.hypot(ball.v.x, ball.v.z) * 0.6)));
        }
        yield* until(() => ball.out || (e.restartType === 'CORNER' && Math.hypot(outW.x - out0.x, outW.z - out0.z) > 30), 3);
        if (e.restartType === 'CORNER' && ball.out) (stats.cornerOuts ||= []).push([...ball.p.toArray().map(v => +v.toFixed(2)), +ball.p.distanceTo(out0).toFixed(1), +out0.z.toFixed(1), +out0.x.toFixed(1), events[i - 1]?.type]);
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
        if (type === 'CORNER') hooks.cam('stand', null, null, true);     // (V7.9.3 a cut to the corner picture once the ball is at the flag)
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
  // what a special move's beat (newview/beats/) may use of the director: the pitch, its ball and clock, the
  // page's hooks, the record of the match's special moves, and the director's own steps (wait a while, wait
  // until, chase the ball down, settle it at the boots, do something a moment later)
  const beatContext = { rt, ball, S, hooks, stats, debug: DEBUG, until, wait, chase, gather, later, noteSkill, pick, losing };
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
    if (opts.debug) (stats.contactLog ||= []).push({ kind, t: +S.t.toFixed(2), m: p.motion && { name: p.motion.name, el: +(S.t - p.motion.t0).toFixed(3), to: p.motion.to?.toArray().map(v => +v.toFixed(2)), spot: p.motion.spot?.toArray().map(v => +v.toFixed(2)), from: p.motion.from?.toArray().map(v => +v.toFixed(2)), capped: !!p.motion.capped, tArr: +(S.headerT ?? -1).toFixed(2) }, pos: p.pos.toArray().map(v => +v.toFixed(2)), c: c?.toArray().map(v => +v.toFixed(2)), ball: ball.p.toArray().map(v => +v.toFixed(2)), h: +p.heading.toFixed(2) });
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
    for (let k = laterQ.length - 1; k >= 0; k--) if (S.t >= laterQ[k].at) laterQ.splice(k, 1)[0].fn();
    if (staged) {
      const r = staged.next();
      // a move played between two events (the staged scene): the event it interrupted is not
      // resumed — it would put the ball back where the engine had it — the next one starts from the pitch as it is
      if (r.done) { staged = null; if (r.value) { task = null; for (const p of rt.players) { p.busy = false; p.faceLock = false; } } }
      for (const p of rt.players) { if (p.dive) rt.updateDive(p); if (p.prone) rt.updateProne(p); }          // (a keeper's dive goes on during a staged move too)
      return;
    }
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
    for (const p of rt.players) { if (p.dive) rt.updateDive(p); if (p.prone) rt.updateProne(p); }
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
    update, skipTo, stats, syncRoster, resync, stage,
    get staging() { return !!staged; },     // a staged move is still playing (the star transfer scene waits for it)
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
