// Plays a real MatchEngine event log on the pitch runtime.
// The engine decides who does what and where; this file only decides how it looks.
import * as THREE from '../vendor/three/three.module.min.js';
import { V, clamp, toWorld, GOAL_X, BALL_R, MOTIONS } from './runtime.js';
import { ACTIONS } from './actions.js';

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
    const p = rt.addPlayer({ key: key(r.side, r.id), id: r.id, side: r.side, team: r.side, name: r.name, role: r.role, no: r.no, kit, keeper: gk });
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
    let flight = 0;
    if (throwIn) {
      from.heading = Math.atan2(dir.x, dir.z); from.target.copy(from.pos); from.want = 0;
      rt.startAction(from, 'throwIn'); from.loopsWant.throwHold = 0;
      if (!ball.held) ball.held = rt.pickUp(() => rt.handsOf(from));
      yield* until(() => rt.actionAtContact(from), 2);
      ball.held = null;
      rt.kickAir(V(toW.x, 0.4, toW.z), Math.max(0.6, dir.length() / 13));
    } else {
      const name = 'pass';
      dir = yield* approachAim(from, name, toW);
      rt.startAction(from, name); rt.kickWarp(from, name, dir);
      yield* until(() => rt.actionAtContact(from), 2);
      if (travel === 'aerial' || dir.length() > 30) { flight = Math.max(0.7, dir.length() / 17); rt.kickAir(V(toW.x, opts.height ?? 0.25, toW.z), flight); }   // a long ball goes in the air
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
    if (!to) { yield* until(() => ball.v.length() < 2 || ball.p.distanceTo(V(toW.x, BALL_R, toW.z)) < 1.5, 4); return; }
    to.busy = true;
    const ok = yield* chase(to, toW);
    if (!ok) { noteFix(to, 'pass'); ball.owner = to; ball.p.set(to.pos.x + Math.sin(to.heading) * .5, BALL_R, to.pos.z + Math.cos(to.heading) * .5); ball.v.set(0, 0, 0); }
    to.busy = false;
    if (implicit) stats.implicitPasses++;
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
      const dir = yield* approachAim(sh, 'shot', aim);
      rt.startAction(sh, 'shot'); rt.kickWarp(sh, 'shot', dir);
      yield* until(() => rt.actionAtContact(sh), 2);
    }
    // a save happens in the keeper's hands, in front of his line: the shot is aimed at the spot his
    // gloves can reach (within a dive and an arm of where he stands), not at the goal line
    let smother = 0;
    if (outcome === 'save' && gk) {
      const gz = gk.pos.z, front = gk.pos.x - goalSide * 0.3;
      if (Math.abs(ball.p.x) > Math.abs(front) - 0.6) {
        // the shooter is level with or past the keeper: he smothers it on its way to the line
        aim = V(clamp(ball.p.x + goalSide * 0.8, -52, 52), 0.3, ball.p.z + (aim.z - ball.p.z) * 0.15);
        smother = Math.hypot(aim.x - gk.pos.x, aim.z - gk.pos.z) / 5.5;
      } else {
        let z = clamp(aim.z, gz - 2.3, gz + 2.3);
        if (gz - 2.3 < 2.9 && gz + 2.3 > -2.9) z = clamp(z, -2.9, 2.9);       // inside the posts when he can reach there
        aim = V(Math.abs(front) < Math.abs(lineX) ? front : lineX - goalSide * 0.5, aim.y, z);
      }
    }
    // a free kick is bent up over the wall and dips (a slower, higher flight)
    const dist = aim.distanceTo(ball.p), flight = Math.max(0.35, dist / (e.header ? 14 : e.freeKick ? 19 : 24), smother);
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
    if (!SKIP_TEXT.has(e.type) && !handled.has(i)) hooks.say(e.text);
    // as soon as the ball is out, players head for the arrangement of the coming restart
    const ahead = e.type === 'ballOut' || e.type === 'restartPosition' || e.type === 'restartPlayers' ? events.slice(i, i + 3).find(x => x.type === 'restartPlayers' && x.arranged) : null;
    if (ahead) S.restartHomes = ahead.arranged;
    else if (!e.restartType && !['foul', 'yellow', 'red', 'sub', 'offside', 'injury'].includes(e.type)) S.restartHomes = null;
    layout(i, false);
    const from = P(e.fromId, e.fromSide), to = P(e.toId, e.toSide);
    switch (e.type) {
      case 'kickoff': {
        if (S.restartTaker) { S.restartTaker.busy = false; S.restartTaker = null; }
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
        if (e.restartType) { S.dead = false; if (S.restartTaker && S.restartTaker !== from) { S.restartTaker.busy = false; ball.held = null; } S.restartTaker = null; }
        if (e.type === 'corner') hooks.cam('tv');
        const target = toWorld(e.toPos);
        const receiver = to && to !== from ? to : null;
        const popts = { throwIn: e.type === 'throwIn' || e.restartType === 'THROW_IN', restart: !!e.restartType };
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
        if (taker) {
          taker.busy = true;
          // throw-in: taker behind the line; corner/free kick: a short run-up behind the ball
          // a direct free kick: the taker stands a few steps back, in line with the goal, for his run-up
          const directFK = type === 'FREE_KICK' && events.slice(i + 1, i + 5).some(x => x.type === 'shot' && x.freeKick);
          const toGoalDir = V(Math.sign(spot.x || 1) * GOAL_X - spot.x, 0, -spot.z).normalize();
          const outward = type === 'THROW_IN' ? V(0, 0, Math.sign(spot.z) * 0.45) : directFK ? toGoalDir.multiplyScalar(-2.6) : V(spot.x, 0, spot.z).setY(0).normalize().multiplyScalar(0.7);
          taker.target.copy(spot).add(outward).setY(0); taker.want = taker.pos.distanceTo(spot) > 8 ? 7 : 4.5; taker.face = V(0, 0, 0); taker.faceLock = false;
          yield* until(() => taker.pos.distanceTo(taker.target) < 0.6, taker.pos.distanceTo(taker.target) / 5 + 2);
          // the last step onto the spot (at walking pace, no jump)
          const from0 = taker.pos.clone(), t0 = S.t, step = Math.max(0.15, from0.distanceTo(taker.target) / 2.2);
          yield* until(() => { const k = Math.min(1, (S.t - t0) / Math.max(1e-3, step)); taker.pos.lerpVectors(from0, taker.target, k * k * (3 - 2 * k)); taker.vel.multiplyScalar(0.8); return k >= 1; }, step + 0.1);
          taker.heading = Math.atan2(-taker.pos.x * (type === 'THROW_IN' ? 0.3 : 1), -taker.pos.z);
          if (type === 'THROW_IN') { taker.loopsWant.throwHold = 1; taker.loops.throwHold = 1; ball.held = rt.pickUp(() => rt.handsOf(taker), 0.5); }
          ball.owner = taker; S.restartTaker = taker;     // he stays on the ball until the restart is taken
        }
        break;
      }
      case 'restartPlayers': yield* wait(e.restartType === 'FREE_KICK' || e.restartType === 'THROW_IN' ? 0.4 : 0.8); break;
      case 'restartWait': {
        // the restart is taken once the players are (nearly) in place for it — a real pause, short for a throw-in
        const far = () => S.restartHomes ? rt.players.filter(p => { const q = S.restartHomes[p.side + ':' + p.id]; return q && !p.offPitch && !p.busy && toWorld(q).distanceTo(p.pos) > 3; }).length : 0;
        yield* until(() => far() <= 2, e.restartType === 'THROW_IN' ? 1.2 : e.restartType === 'CORNER' ? 4.5 : 3);
        // a direct free kick: the camera goes behind the taker, wall and goal in the picture
        const fkShot = e.restartType === 'FREE_KICK' && events[i + 1]?.type === 'shot' && events[i + 1].freeKick ? events[i + 1] : null;
        if (fkShot) { const tk = P(fkShot.fromId, fkShot.fromSide), gk0 = rt.players.find(q => q.role === 'GK' && q.side !== fkShot.fromSide && !q.offPitch); if (tk) hooks.cam('shot', tk, gk0); hooks.banner('SERBEST VURUŞ', 1500); yield* wait(1.4); break; }
        yield* wait(0.4); if (e.restartType !== 'CORNER') hooks.cam('tv'); break;
      }
      case 'offside': {
        // the pass is played to the man beyond the line; the flag goes up as it is played, the line is shown
        const passer = e.fromId != null ? P(e.fromId, e.fromSide) : ball.owner, rec = P(e.toId, e.toSide);
        if (passer && rec && passer !== rec && ball.owner === passer) {
          const toW = toWorld(e.toPos);
          rec.target.copy(toW); rec.want = 6.5; rec.runUntil = S.t + 2; rec.face = null;
          passer.busy = true;
          const dir = V(toW.x - ball.p.x, 0, toW.z - ball.p.z);
          yield* approachKick(passer, 'pass', dir);
          dir.set(toW.x - ball.p.x, 0, toW.z - ball.p.z);
          rt.startAction(passer, 'pass'); rt.kickWarp(passer, 'pass', dir);
          yield* until(() => rt.actionAtContact(passer), 2);
          rt.kickGround(toW, 4.5, 0.7); passer.busy = false;
        }
        if (e.lineX != null) hooks.offsideLine?.(toWorld([e.lineX, 50]).x);
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
    idx = s; task = null; hooks.slow(1); hooks.cam('tv', null, null, true);
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
    idx = events.length; task = null;
    for (const p of rt.players) { if (!p.offPitch) { p.busy = false; rt.place(p, p.pos); } }
    layout(Math.max(0, idx - 1), true);
    ball.held = null; ball.v.set(0, 0, 0); ball.allowOut = false; S.dead = false;
    if (S.restartTaker) { S.restartTaker.busy = false; S.restartTaker = null; }
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
