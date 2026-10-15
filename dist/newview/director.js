// Plays a real MatchEngine event log on the pitch runtime.
// The engine decides who does what and where; this file only decides how it looks.
import * as THREE from '../vendor/three/three.module.min.js';
import { V, clamp, toWorld, GOAL_X, BALL_R } from './runtime.js';
import { ACTIONS } from './actions.js';

const SKIP_TEXT = new Set(['offBallRun', 'press', 'chance', 'restartPlayers', 'restartWait', 'restartPosition', 'firstTouch', 'looseBall']);
const RESTART_LABEL = { CORNER: 'KORNER', GOAL_KICK: 'KALE VURUŞU', THROW_IN: 'TAÇ', FREE_KICK: 'SERBEST VURUŞ', PENALTY: 'PENALTI' };

export function createDirector(rt, data, hooks, opts = {}) {
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
  function layout(i, teleport) {
    const s = snapFor(i);
    for (const [id, side, pos] of s.pl) {
      const p = P(id, side); if (!p) continue;
      p.home = toWorld(pos);
      if (teleport) { rt.place(p, p.home); faceBall(p); }
    }
  }
  function faceBall(p) { p.heading = Math.atan2(ball.p.x - p.pos.x, ball.p.z - p.pos.z); }

  // ---- off-ball movement: everyone not involved heads for his engine position ----
  function shape() {
    for (const p of rt.players) {
      if (p.busy || p.dive || p.offPitch) continue;
      if (p.runUntil > S.t) continue;
      const h = p.home || p.pos; const d = h.distanceTo(p.pos);
      p.target.copy(h); p.want = S.dead ? (d > 12 ? 4 : 2.2) : d > 9 ? 6 : d > 3 ? 4.6 : 2.6; p.face = ball.p; p.faceLock = false;
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
    const o = ball.owner;
    if (o && o.side === p.side && o !== p && o.pos.distanceTo(p.pos) > 2.5 && !o.dive) {
      yield* pass(o, p, p.pos.clone(), 'ground', true);
      return;
    }
    p.busy = true;
    const ok = yield* until(() => rt.receive(p, ball.p), Math.max(4.5, Math.hypot(ball.p.x - p.pos.x, ball.p.z - p.pos.z) / 6.5 + 1.5));
    const fixWho = () => p;
    if (!ok) { stats.fixes++; stats.fixLog.push(`${events[idx - 1]?.type}${ball.p.y > 1 ? "-air" : ""}:${Math.round(ball.p.distanceTo(new THREE.Vector3(fixWho().pos.x, BALL_R, fixWho().pos.z)))}m`); ball.p.set(p.pos.x + Math.sin(p.heading) * 0.5, BALL_R, p.pos.z + Math.cos(p.heading) * 0.5); ball.v.set(0, 0, 0); ball.owner = p; }
    p.busy = false;
  }

  function* pass(from, to, toW, travel, implicit = false, opts = {}) {
    from.busy = true;
    // settle the ball at the passer's feet first
    if (ball.owner !== from) yield* ensureOwner(from);
    from.busy = true;
    const dir = V(toW.x - ball.p.x, 0, toW.z - ball.p.z);
    const throwIn = opts.throwIn;
    if (throwIn) {
      from.heading = Math.atan2(dir.x, dir.z); from.target.copy(from.pos); from.want = 0;
      rt.startAction(from, 'throwIn'); from.loopsWant.throwHold = 0; from.loops.throwHold = 0;
      ball.held = () => rt.handsOf(from);
      yield* until(() => rt.actionAtContact(from), 2);
      ball.held = null;
      rt.kickAir(V(toW.x, 0.4, toW.z), Math.max(0.6, dir.length() / 13));
    } else {
      const name = 'pass';
      rt.startAction(from, name); rt.kickWarp(from, name, dir);
      yield* until(() => rt.actionAtContact(from), 2);
      if (travel === 'aerial') rt.kickAir(V(toW.x, 0.25, toW.z), Math.max(0.7, dir.length() / 17));
      else rt.kickGround(toW, opts.arrive ?? 3);
    }
    from.lastPass = S.t; from.busy = false;
    if (!to) { yield* until(() => ball.v.length() < 2 || ball.p.distanceTo(V(toW.x, BALL_R, toW.z)) < 1.5, 4); return; }
    to.busy = true;
    let ok = yield* until(() => rt.receive(to, toW), Math.max(4.5, dir.length() / 7));
    if (!ok && !ball.held) {           // still not there: the ball is played on to him
      const d = Math.hypot(to.pos.x - ball.p.x, to.pos.z - ball.p.z);
      if (d < 30) { rt.kickGround(to.pos, 1.5); ok = yield* until(() => rt.receive(to, null), 3); }
    }
    const fixWho = () => to;
    if (!ok) { stats.fixes++; stats.fixLog.push(`${events[idx - 1]?.type}${ball.p.y > 1 ? "-air" : ""}:${Math.round(ball.p.distanceTo(new THREE.Vector3(fixWho().pos.x, BALL_R, fixWho().pos.z)))}m`); ball.owner = to; ball.p.set(to.pos.x + Math.sin(to.heading) * .5, BALL_R, to.pos.z + Math.cos(to.heading) * .5); ball.v.set(0, 0, 0); }
    to.busy = false;
    if (implicit) stats.implicitPasses++;
  }

  function* carry(p, goalW, speed = 5) {
    yield* ensureOwner(p);
    p.busy = true;
    const end = S.t + p.pos.distanceTo(goalW) / Math.max(2, speed - 1) + 2;
    while (S.t < end && ball.owner === p) {
      rt.dribble(p, goalW, speed);
      if (Math.hypot(ball.p.x - goalW.x, ball.p.z - goalW.z) < 1.4) break;
      yield;
    }
    p.busy = false;
  }

  // a defender closes the carrier down and commits; success decides who gets the ball
  function* tackle(def, car, success, closeUp) {
    if (!def || !car) return;
    if (ball.owner !== car) yield* ensureOwner(car);
    def.busy = car.busy = true;
    if (closeUp) hooks.cam('close', car, def);
    // carrier keeps going while the defender arrives goal-side
    const carGoal = car.pos.clone().add(V(Math.sin(car.heading) * 6, 0, Math.cos(car.heading) * 6));
    yield* until(() => {
      rt.dribble(car, carGoal, 2.6);
      def.target.copy(car.pos).add(V(Math.sin(car.heading) * 1.4, 0, Math.cos(car.heading) * 1.4));
      def.want = 6; def.face = car.pos; def.faceLock = def.pos.distanceTo(car.pos) < 4; def.loopsWant.jockey = def.faceLock ? 1 : 0;
      return def.pos.distanceTo(car.pos) < 2.0;
    }, 3.5);
    def.loopsWant.jockey = 0;
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
    else { const z = Math.abs(tz) < 3.9 ? (tz >= 0 ? 4.6 : -4.6) : tz; aim = V(lineX, Math.abs(tz) < 3.9 && rnd > .5 ? 2.9 : 0.5 + rnd, z); }

    if (e.penalty) { rt.place(sh, toWorld(e.fromPos).add(V(-goalSide * 1.2, 0, 0)), goalSide > 0 ? Math.PI / 2 : -Math.PI / 2); ball.p.copy(toWorld(e.fromPos)).setY(BALL_R); ball.v.set(0, 0, 0); ball.owner = sh; }
    yield* ensureOwner(sh);
    sh.busy = true; if (gk) gk.busy = true;
    hooks.cam('shot', sh, gk);
    if (gk) { gk.loopsWant.keeperReady = 1; gk.face = ball.p; gk.target.copy(gk.pos); gk.want = 0; }
    const dir = V(aim.x - ball.p.x, 0, aim.z - ball.p.z);
    rt.startAction(sh, 'shot'); rt.kickWarp(sh, 'shot', dir);
    yield* until(() => rt.actionAtContact(sh), 2);
    const dist = aim.distanceTo(ball.p), flight = Math.max(0.35, dist / (e.header ? 14 : 24));
    // a blocker steps into the line first
    let blocker = null;
    if (outcome === 'block' && block) {
      blocker = P(block.toId, block.toSide || sideOf(block.toId));
      if (blocker && blocker.role !== 'GK') { const bp = ball.p.clone().lerp(aim, Math.min(0.35, 3.5 / dist)); blocker.busy = true; blocker.target.set(bp.x, 0, bp.z); blocker.want = 6; }
    }
    ball.allowOut = true;
    rt.kickAir(aim, flight);
    hooks.slow(0.45);
    const tArrive = flight * Math.max(0.2, (Math.abs(gk ? gk.pos.x : lineX) - Math.abs(ball.p.x)) / Math.max(0.5, Math.abs(lineX - ball.p.x)));
    if (gk && outcome !== 'wide' && outcome !== 'block') {
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
      yield* until(() => rt.handsOf(gk).distanceTo(ball.p) < 0.45 || S.t - t0 > flight + 0.3, flight + 0.6);
      const catchIt = save?.saveType === 'CATCH';
      if (catchIt) { ball.held = () => rt.handsOf(gk); ball.owner = gk; yield* wait(1.4); ball.held = null; ball.p.copy(gk.pos).add(V(0, BALL_R, 0)); }
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
    scorer.target.copy(flag); scorer.want = 6.5; scorer.face = null;
    const mates = rt.players.filter(p => p.side === scorer.side && p !== scorer && p.role !== 'GK').sort((a, b) => a.pos.distanceTo(scorer.pos) - b.pos.distanceTo(scorer.pos)).slice(0, 3);
    for (const m of mates) { m.busy = true; m.target.copy(flag); m.want = 5.5; }
    yield* wait(1.8);
    rt.startAction(scorer, 'celebrate');
    yield* wait(2.2);
    scorer.busy = false; for (const m of mates) m.busy = false;
    hooks.cam('tv');
  }

  // ---- one engine event -> one behaviour ----
  const handled = new Set();
  function* run(e, i) {
    if (e.homeGoals != null) hooks.score(e.homeGoals, e.awayGoals);
    hooks.minute(e.minute);
    if (!SKIP_TEXT.has(e.type) && !handled.has(i)) hooks.say(e.text);
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
        break;
      }
      case 'offBallRun': if (from && !from.busy && ball.owner !== from) { from.target.copy(toWorld(e.toPos)); from.want = 6.2; from.runUntil = S.t + 2.5; from.face = null; } break;
      case 'press': {
        const d = P(e.defenderId, e.toSide || (e.fromSide === 'user' ? 'opp' : 'user'));
        if (d && !d.busy) { d.target.copy(ball.p); d.want = 5.5; d.runUntil = S.t + 1.5; d.face = ball.p; }
        break;
      }
      case 'tackle': {
        const d = P(e.defenderId, e.fromSide === 'user' ? 'opp' : 'user');
        const car = from && ball.owner && ball.owner.side === from.side ? ball.owner : from;
        const won = e.success === true || (e.toId != null && e.toId !== e.fromId);
        const finalThird = Math.abs(ball.p.x) > 26;
        yield* tackle(d, car, won, finalThird && stats.closeUps++ % 2 === 0);
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
        yield* pass(from, receiver, target, e.travelType === 'aerial' || e.type === 'cross' || e.type === 'corner' ? 'aerial' : 'ground', false, { throwIn: e.type === 'throwIn' || e.restartType === 'THROW_IN' });
        if (e.restartType) ball.allowOut = false;
        break;
      }
      case 'firstTouch': if (from && ball.owner !== from) yield* ensureOwner(from); break;
      case 'looseBall': {
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
          // the ball runs out where the engine says it went out
          ball.owner = null; ball.p.y = BALL_R;
          rt.kickGround(outW, Math.max(2.5, Math.min(6, Math.hypot(ball.v.x, ball.v.z) * 0.6)));
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
        ball.p.set(spot.x, BALL_R, spot.z);
        if (taker) {
          taker.busy = true;
          // throw-in: taker behind the line; corner/free kick: a short run-up behind the ball
          const outward = type === 'THROW_IN' ? V(0, 0, Math.sign(spot.z) * 0.45) : V(spot.x, 0, spot.z).setY(0).normalize().multiplyScalar(0.7);
          taker.target.copy(spot).add(outward).setY(0); taker.want = 4.5; taker.face = V(0, 0, 0); taker.faceLock = false;
          yield* until(() => taker.pos.distanceTo(taker.target) < 0.5, 4);
          taker.pos.copy(taker.target); taker.vel.set(0, 0, 0);
          taker.heading = Math.atan2(-taker.pos.x * (type === 'THROW_IN' ? 0.3 : 1), -taker.pos.z);
          if (type === 'THROW_IN') { taker.loopsWant.throwHold = 1; taker.loops.throwHold = 1; ball.held = () => rt.handsOf(taker); }
          ball.owner = taker; S.restartTaker = taker;     // he stays on the ball until the restart is taken
        }
        break;
      }
      case 'restartPlayers': yield* wait(0.8); break;
      case 'restartWait': yield* wait(0.4); if (e.restartType !== 'CORNER') hooks.cam('tv'); break;
      case 'foul': hooks.whistle(); yield* wait(0.7); break;
      case 'yellow': hooks.banner('SARI KART', 1400); yield* wait(1.2); break;
      case 'red': hooks.banner('KIRMIZI KART', 1600); yield* wait(1.4); break;
      case 'half': hooks.banner('DEVRE ARASI', 2600); yield* wait(2.8); break;
      case 'end': hooks.banner('MAÇ SONU', 99999); hooks.finished(); break;
      default: break;
    }
  }

  // ---- driver ----
  const stats = { fixes: 0, implicitPasses: 0, closeUps: 0, stalls: 0, fixLog: [] };
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
        if (S.t - task.started > 14) { stats.stalls++; task = nextTask(); continue; }   // safety: never freeze the match
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
  function syncRoster(list) {
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
