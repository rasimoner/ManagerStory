/* Phase 2 — player attributes, fitness and football intelligence inside the existing authoritative engine.
   Probabilistic systems are tested as distributions over seeded repeated trials, never as single events. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, PROBES, playToEnd } = require('./engine-harness.cjs');

const fresh = (fixture = 0) => { const h = harness(); h.run(`S=fresh();init();S.fixture=${fixture};startMatch();resumeLive()`); return h; };
const same = (a, b, msg) => assert.equal(JSON.stringify(a), JSON.stringify(b), msg);

/* Neutral baseline for a user outfielder: everything 65, fully fit, prime age, playing his natural role. */
const NEUTRAL = { pace: 65, acceleration: 65, finishing: 65, passing: 65, dribbling: 65, technique: 65, tackling: 65, positioning: 65,
  vision: 65, offBall: 65, composure: 65, strength: 65, physical: 65, stamina: 70, fitness: 100, age: 26 };
function userPlayer(h, slot, role, attrs = {}) {
  // slot picks a distinct user outfielder; he is made a natural fit for `role` so suitability is 1
  const id = h.run(`M.active.filter(id=>M.matchRoles[id]!=='GK')[${slot}]`);
  h.run(`(function(){const p=S.players.find(x=>x.id===${id});Object.assign(p,${JSON.stringify({ ...NEUTRAL, ...attrs })});p.pos=${JSON.stringify(role)};M.matchRoles[${id}]=${JSON.stringify(role)}})()`);
  return id;
}
const oppPlayer = (h, idx, attrs = {}) => {
  const id = 'o' + idx;
  h.run(`(function(){const p=opponentPlayer(${JSON.stringify(id)});Object.assign(p,${JSON.stringify({ ...NEUTRAL, shooting: attrs.finishing ?? 65, ...attrs })})})()`);
  return id;
};
const park = h => h.run("for(const id of M.active)M.dynamicPositions[String(id)]=[5,8];for(const id of M.oppIds)M.dynamicPositions[String(id)]=[95,92];");

/* Generic seeded race: two chasers, equal or chosen distances from the ball, N trials. */
function race(h, a, b, distA, distB, trials = 300, seed = 4100) {
  return h.run(`(function(){let aWins=0,bWins=0;
   for(let t=0;t<${trials};t++){
     M.rand=R(${seed}+t);M.looseBall=null;M.ballOwner=null;M.ballSide='none';
     for(const id of M.active)M.dynamicPositions[String(id)]=[5,8];for(const id of M.oppIds)M.dynamicPositions[String(id)]=[95,92];
     M.dynamicPositions[String(${JSON.stringify(a.id)})]=[${50 - distA},50];M.dynamicPositions[String(${JSON.stringify(b.id)})]=[${50 + distB},50];
     makeLooseBall([50,50],[50,50],'race',null);
     for(let g=0;M.ballOwner==null&&g<6;g++)resolveLooseBall(8); // long chases continue on following ticks
     const w=M.ballOwner;if(w===${JSON.stringify(a.id)})aWins++;else if(w===${JSON.stringify(b.id)})bWins++;
   }return {a:aWins,b:bWins,n:${trials}}})()`);
}
const setup = (attrsA, attrsB, fixture = 0) => {
  const h = fresh(fixture);
  const a = { id: userPlayer(h, 4, 'CM', attrsA), side: 'user' };
  const b = { id: oppPlayer(h, 6, attrsB), side: 'opp' };
  return { h, a, b };
};

test('1. pace decides a long-distance race, but close paces stay close', () => {
  const { h, a, b } = setup({ pace: 90 }, { pace: 50 });
  const r = race(h, a, b, 30, 30);
  assert.ok(r.a / r.n >= .85, `pace 90 vs 50 wins ${r.a}/${r.n}`);
  const c = setup({ pace: 71 }, { pace: 69 });
  const close = race(c.h, c.a, c.b, 30, 30);
  assert.ok(close.a / close.n > .3 && close.a / close.n < .7, `near-equal paces are not decided: ${close.a}/${close.n}`);
  const mid = setup({ pace: 80 }, { pace: 65 }), m = race(mid.h, mid.a, mid.b, 30, 30);
  assert.ok(m.a / m.n > .7 && m.a / m.n < 1, `a 15-point gap is a strong but not absolute edge: ${m.a}/${m.n}`);
});

test('2. acceleration decides a short race; pace and acceleration are distinct', () => {
  const quick = setup({ acceleration: 92, pace: 60 }, { acceleration: 45, pace: 60 });
  const s = race(quick.h, quick.a, quick.b, 5, 5);
  assert.ok(s.a / s.n >= .7, `acc 92 vs 45 over 5 units: ${s.a}/${s.n}`);
  // first steps vs top speed: high-acceleration/average-pace beats average-acceleration/high-pace short, loses long
  const x = setup({ acceleration: 92, pace: 62 }, { acceleration: 50, pace: 92 });
  const short = race(x.h, x.a, x.b, 5, 5), long = race(x.h, x.a, x.b, 40, 40);
  assert.ok(short.a / short.n > .55, `short: burst wins ${short.a}/${short.n}`);
  assert.ok(long.b / long.n > .65, `long: top speed wins ${long.b}/${long.n}`);
  assert.ok(short.a / short.n - long.a / long.n > .2, 'the ordering flips with distance');
});

test('3. passing quality changes execution success but never guarantees it', () => {
  const h = fresh();
  const hi = userPlayer(h, 2, 'CM', { passing: 90 }), lo = userPlayer(h, 3, 'CM', { passing: 50 });
  const easy = '{range:12,lane:0,space:{danger:.1}}', hard = '{range:48,lane:.6,space:{danger:.8}}';
  const p = (id, sel, pr) => h.run(`passSuccessProbability(${id},'user',${sel},{pressure:${pr}})`);
  assert.ok(p(hi, hard, .5) - p(lo, hard, .5) >= .15, 'difficult passes separate the passers');
  assert.ok(p(lo, easy, .1) >= .85, 'a weak passer still completes simple passes');
  assert.ok(p(hi, hard, .5) < .95 && p(hi, easy, 0) < .99, 'an elite passer still fails sometimes');
  const rate = (id, sel, pr) => h.run(`(function(){M.rand=R(77);let ok=0;for(let i=0;i<3000;i++)if(M.rand()<passSuccessProbability(${id},'user',${sel},{pressure:${pr}}))ok++;return ok/3000})()`);
  assert.ok(rate(hi, hard, .5) - rate(lo, hard, .5) > .12, 'seeded completion gap on hard passes');
  assert.ok(rate(lo, easy, .1) > .85 && rate(hi, easy, .1) < .995 && rate(hi, easy, .1) > rate(lo, easy, .1));
});

test('4. vision changes which option is chosen (progressive vs safe), not passing execution', () => {
  const scenario = vision => {
    const h = fresh(1);
    const carrier = userPlayer(h, 3, 'CM', { vision });
    const mates = h.run('M.active.filter(id=>M.matchRoles[id]!=="GK")');
    const others = mates.filter(id => id !== carrier);
    // two safe short options beside/behind the carrier, three progressive runners ahead, the rest parked wide/back
    const spots = [[40, 56], [41, 44], [70, 35], [72, 52], [68, 65], [30, 50], [32, 30], [32, 70], [20, 50]];
    h.run(`for(const id of M.oppIds)M.dynamicPositions[String(id)]=[92,50];M.dynamicPositions[String(${carrier})]=[46,50];`);
    others.forEach((id, i) => h.run(`M.dynamicPositions[String(${id})]=${JSON.stringify(spots[i % spots.length])}`));
    return h.run(`(function(){M.rand=R(2024);let prog=0,n=2000;
      for(let i=0;i<n;i++){const o=weightedPitchChoice(passOptions('user',${carrier},'Normal'));if(o.progress>12)prog++}
      return prog/n})()`);
  };
  const hi = scenario(92), lo = scenario(42);
  assert.ok(hi - lo >= .08, `progressive share: vision 92 ${hi.toFixed(3)} vs 42 ${lo.toFixed(3)}`);
  assert.ok(lo > .05, 'low vision is simpler/safer, not random stupidity: it still finds forward options sometimes');
  assert.ok(hi < .98, 'high vision does not make the choice deterministic');
});

test('5. finishing changes conversion of identical chances; poor finishers still score easy ones', () => {
  const h = fresh();
  const hi = userPlayer(h, 7, 'ST', { finishing: 92 }), lo = userPlayer(h, 8, 'ST', { finishing: 48 });
  const conv = (id, ctx) => h.run(`(function(){M.rand=R(314);let g=0,n=6000,c=${JSON.stringify(ctx)};
    for(let i=0;i<n;i++){const s=shotProbabilities(${id},'user',c);if(M.rand()<s.onTarget&&M.rand()<s.goal)g++}return g/n})()`);
  const typical = { distance: 18, angle: 8, pressure: .5, keeper: 70 }, easy = { distance: 6, angle: 0, pressure: 0, keeper: 70 };
  const [ht, lt, he, le] = [conv(hi, typical), conv(lo, typical), conv(hi, easy), conv(lo, easy)];
  assert.ok(ht > lt * 1.6, `typical chance: ${ht.toFixed(3)} vs ${lt.toFixed(3)}`);
  assert.ok(le >= .08, `poor finisher still scores easy chances (${le.toFixed(3)})`);
  assert.ok(he < .5, `elite finisher still misses (${he.toFixed(3)})`);
  // execution inputs that are not finishing also matter
  const far = conv(hi, { distance: 32, angle: 18, pressure: 1, keeper: 70 });
  assert.ok(far < ht && he > ht, 'distance, angle and pressure still dominate');
  // shot decision uses vision/composure too, so finishing alone does not create absurd shooters
  const decisionWeight = id => h.run(`(playerAttribute(${id},'user','vision',65)*.5+playerAttribute(${id},'user','composure',65)*.5-65)`);
  assert.ok(Math.abs(decisionWeight(hi) - decisionWeight(lo)) < 1e-9, 'decision inputs are independent of finishing');
});

test('6. dribbling changes carry success against the same defender', () => {
  const h = fresh();
  const hi = userPlayer(h, 5, 'LW', { dribbling: 90, technique: 85 }), lo = userPlayer(h, 6, 'LW', { dribbling: 48, technique: 50 });
  const def = oppPlayer(h, 5);
  const p = id => h.run(`dribbleChance(${id},'user',${JSON.stringify(def)},'opp',{pressure:.5})`);
  assert.ok(p(hi) - p(lo) >= .15 && p(hi) < .93 && p(lo) > .2);
  // a great defender neutralises a good dribbler: pressure and opponent quality matter (no arcade 1v5)
  const wall = oppPlayer(h, 4, { tackling: 92, positioning: 90, strength: 85, acceleration: 80 });
  const vsWall = h.run(`dribbleChance(${hi},'user',${JSON.stringify(wall)},'opp',{pressure:.5})`);
  assert.ok(vsWall < p(hi) - .12, 'opponent quality matters');
  // ball retention over a full seeded sample through the engine's own function
  const rate = id => h.run(`(function(){M.rand=R(55);let ok=0;for(let i=0;i<3000;i++)if(M.rand()<dribbleChance(${id},'user',${JSON.stringify(def)},'opp',{pressure:.5}))ok++;return ok/3000})()`);
  assert.ok(rate(hi) - rate(lo) > .15);
});

test('7. tackling changes duel success against identical attackers', () => {
  const h = fresh();
  const carrier = userPlayer(h, 5, 'LW', { dribbling: 70 });
  const great = oppPlayer(h, 3, { tackling: 90, positioning: 80 }), poor = oppPlayer(h, 4, { tackling: 45, positioning: 50 });
  const p = id => h.run(`tackleChance(${JSON.stringify(id)},'opp',${carrier},'user',{distance:6})`);
  assert.ok(p(great) - p(poor) >= .15);
  assert.ok(p(poor) > .15 && p(great) < .8, 'bounded, never certain');
  const close = id => h.run(`tackleChance(${JSON.stringify(id)},'opp',${carrier},'user',{distance:2})`);
  assert.ok(close(great) > p(great), 'closer defender wins more often');
});

test('8. strength decides physical contests without dominating technical actions', () => {
  const h = fresh();
  const strong = userPlayer(h, 5, 'ST', { strength: 92 }), weak = oppPlayer(h, 9, { strength: 45 });
  const pc = h.run(`physicalContest(${strong},'user',${JSON.stringify(weak)},'opp')`);
  assert.ok(pc > .75 && pc < .97, 'strong player usually wins the contest but not always: ' + pc);
  const even = oppPlayer(h, 8, { strength: 92 });
  assert.ok(Math.abs(h.run(`physicalContest(${strong},'user',${JSON.stringify(even)},'opp')`) - .5) < .02);
  // contested loose ball between equals in distance/speed: strength shifts the tie-break
  const a = { id: userPlayer(h, 4, 'CM', { strength: 92 }), side: 'user' }, b = { id: oppPlayer(h, 6, { strength: 45 }), side: 'opp' };
  const r = race(h, a, b, 1.2, 1.2, 600, 900);
  assert.ok(r.a / r.n > .6 && r.a / r.n < .97, `strength edge in a dead-heat is an edge, not a guarantee: ${r.a}/${r.n}`);
  // and it barely touches technical execution
  const hi = userPlayer(h, 2, 'CM', { strength: 95, passing: 65 }), lo = userPlayer(h, 3, 'CM', { strength: 40, passing: 65 });
  const sel = '{range:30,lane:.3,space:{danger:.3}}';
  assert.ok(Math.abs(h.run(`passSuccessProbability(${hi},'user',${sel},{pressure:.3})`) - h.run(`passSuccessProbability(${lo},'user',${sel},{pressure:.3})`)) < 1e-9);
});

test('9. stamina sets the fatigue curve over a real match', () => {
  const h = fresh(2);
  const fit = userPlayer(h, 4, 'CM', { stamina: 92, fitness: 100 }), tired = userPlayer(h, 5, 'CM', { stamina: 40, fitness: 100 });
  const drain = id => h.run(`matchFatigueDrain(S.players.find(p=>p.id===${id}),1,1)`);
  assert.ok(drain(tired) > drain(fit) * 1.7, 'low stamina fatigues much faster');
  playToEnd(h);
  const end = id => h.run(`S.players.find(p=>p.id===${id}).fitness`);
  const played = id => h.run(`S.players.find(p=>p.id===${id}).minutes`);
  if (played(fit) >= 80 && played(tired) >= 80) assert.ok(end(fit) - end(tired) >= 6, `end fitness ${end(fit)} vs ${end(tired)}`);
  // ninety-minute curve from the same function the tick uses is monotonic and floor-safe
  const curve = h.run(`(function(s){let f=100;const p={stamina:s,age:26};const out=[];for(let m=0;m<90;m++){f=Math.max(20,f-matchFatigueDrain(p,1,1));out.push(f)}return out})(40)`);
  assert.ok(curve.every((v, i) => i === 0 || v <= curve[i - 1]) && curve.at(-1) >= 20 && curve.at(-1) < 85);
});

test('10. fitness is a real but smooth modifier, physical more than mental', () => {
  const h = fresh();
  const id = userPlayer(h, 4, 'CM', {});
  const eff = (n, fitness) => h.run(`(function(){S.players.find(p=>p.id===${id}).fitness=${fitness};return effectiveAttribute(${id},'user','${n}',65)})()`);
  const pace100 = eff('pace', 100), pace85 = eff('pace', 85), pace50 = eff('pace', 50);
  assert.equal(pace100, 65);
  assert.ok(pace85 > 65 * .93, '85% fitness does not make a player useless');
  assert.ok(pace50 < pace85 && pace50 > 65 * .7, 'low fitness hurts without a cliff');
  const lossPhys = 1 - eff('acceleration', 50) / 65, lossTech = 1 - eff('passing', 50) / 65, lossMental = 1 - eff('vision', 50) / 65;
  assert.ok(lossPhys > lossTech && lossTech > lossMental && lossMental > 0, 'physical > technical > mental sensitivity');
  const steps = [100, 90, 80, 70, 60, 50, 40, 30].map(f => eff('pace', f));
  assert.ok(steps.every((v, i) => i === 0 || v < steps[i - 1]) && steps.every((v, i) => i === 0 || steps[i - 1] - v < 4.5), 'monotone and smooth');
});

test('11. a fresh substitute has a real physical edge over a player who started', () => {
  const h = fresh(3);
  h.run('advanceLive(45)'); // play to about the 70th minute, handling stops
  let guard = 0;
  while (h.run('M.min') < 70 && !h.run('M.finished') && guard++ < 60) {
    if (h.run('M.reason') === 'half') h.run('startSecondHalf()');
    else if (h.run('M.pause')) { if (h.run('M.reason') === 'injury') { h.run("(function(){const out=M.active.find(id=>S.players.find(p=>p.id===id)?.injury>0);if(out)S.players.find(p=>p.id===out).injury=0;resumeLive()})()"); } else h.run('resumeLive()'); }
    h.run('advanceLive(5)');
  }
  assert.ok(h.run('M.min') >= 60, 'reached the later part of the match: ' + h.run('M.min'));
  const starter = h.run(`M.active.find(id=>M.matchRoles[id]==='CM'&&S.players.find(p=>p.id===id).minutes>=55)`);
  const bench = h.run(`S.players.find(p=>!M.active.includes(p.id)&&!M.out.includes(p.id)&&p.injury===0&&p.pos.split('/')[0]!=='GK')`).id;
  h.run(`S.players.find(p=>p.id===${bench}).fitness=100;S.players.find(p=>p.id===${bench}).age=26;S.players.find(p=>p.id===${starter}).age=26;`);
  const [ps, pb] = h.run(`[S.players.find(p=>p.id===${starter}).fitness,S.players.find(p=>p.id===${bench}).fitness]`);
  assert.ok(pb - ps >= 8, `fitness gap at ~70': starter ${ps.toFixed(1)} vs fresh sub ${pb}`);
  // same base attributes, same position: the fresher player is physically better
  h.run(`(function(){const s=S.players.find(p=>p.id===${starter}),b=S.players.find(p=>p.id===${bench});for(const k of ['pace','acceleration','strength','physical','stamina'])b[k]=s[k];b.pos=s.pos;M.matchRoles[${bench}]=M.matchRoles[${starter}]})()`);
  const tired = h.run(`effectiveAttribute(${starter},'user','pace',65)`), fresh_ = h.run(`effectiveAttribute(${bench},'user','pace',65)`);
  assert.ok(fresh_ > tired, `fresh ${fresh_.toFixed(2)} > tired ${tired.toFixed(2)}`);
});

test('12. age is a bounded match modifier only', () => {
  const h = fresh();
  const id = userPlayer(h, 4, 'CM', {});
  const at = (age, n) => h.run(`(function(){S.players.find(p=>p.id===${id}).age=${age};return effectiveAttribute(${id},'user','${n}',65)})()`);
  for (const n of ['pace', 'acceleration', 'strength']) for (let age = 16; age <= 40; age++) {
    const v = at(age, n);
    assert.ok(v >= 65 * .92 && v <= 65.0001, `${n} at ${age}: ${v}`);
  }
  assert.equal(at(26, 'pace'), 65);
  assert.ok(at(37, 'acceleration') < at(24, 'acceleration'));
  assert.ok(at(17, 'strength') < at(26, 'strength'));
  assert.equal(at(37, 'passing'), 65, 'technique is not age-penalised here');
  for (let age = 16; age <= 42; age++) { const f = h.run(`ageFatigueFactor(${age})`); assert.ok(f >= .95 && f <= 1.12); }
  assert.ok(h.run('ageFatigueFactor(36)') > h.run('ageFatigueFactor(22)'));
  // stored base values are untouched by age (effective only)
  assert.equal(h.run(`S.players.find(p=>p.id===${id}).pace`), 65);
});

test('13. position suitability hits role-relevant skills, not everything', () => {
  const h = fresh();
  const natural = userPlayer(h, 4, 'CB', { tackling: 80, positioning: 80, finishing: 80, pace: 80 });
  const striker = userPlayer(h, 5, 'ST', { tackling: 80, positioning: 80, finishing: 80, pace: 80 });
  // the same striker is now asked to play centre-back
  h.run(`M.matchRoles[${striker}]='CB'`);
  const e = (id, n) => h.run(`effectiveAttribute(${id},'user','${n}',65)`);
  const suit = h.run(`positionSuitability(${striker},'user')`);
  assert.ok(suit < 1 && h.run(`positionSuitability(${natural},'user')`) === 1);
  assert.ok(e(striker, 'tackling') < e(natural, 'tackling') - 8, 'defensive skill drops out of position');
  assert.ok(e(striker, 'positioning') < e(natural, 'positioning') - 8);
  assert.equal(e(striker, 'pace'), e(natural, 'pace'), 'pace is physical, not a positional skill');
  assert.ok(e(striker, 'finishing') >= e(natural, 'finishing') - .001, 'finishing is irrelevant at centre-back');
  // a centre-back pushed up front loses attacking, not defending
  const cb = userPlayer(h, 6, 'CB', { finishing: 80, tackling: 80, positioning: 80 });
  h.run(`M.matchRoles[${cb}]='ST'`);
  const st2 = userPlayer(h, 7, 'ST', { finishing: 80, tackling: 80, positioning: 80 });
  assert.ok(e(cb, 'finishing') < e(st2, 'finishing') - 8);
  assert.ok(Math.abs(e(cb, 'tackling') - e(st2, 'tackling')) < .001);
  // the existing suitability table is reused, not duplicated
  assert.equal(h.run(`positionSuitability(${striker},'user')`), h.run(`positionPenaltyV61(S.players.find(p=>p.id===${striker}),'CB')`));
});

test('14. base attributes are never mutated by effective calculations or by a full match', () => {
  const h = fresh(6);
  const snap = () => JSON.stringify(h.run(`S.players.map(p=>[p.id,p.pace,p.finishing,p.passing,p.dribbling,p.defending,p.physical,p.stamina,p.age,p.overall,p.potential])`));
  const oppSnap = () => JSON.stringify(h.run(`Object.values(S.opponentSquads).map(t=>t.map(p=>[p.id,p.pace,p.acceleration,p.passing,p.technique,p.dribbling,p.shooting,p.tackling,p.positioning,p.stamina,p.age,JSON.stringify(p.gk)]))`));
  const before = snap(), oppBefore = oppSnap();
  h.run("for(const id of M.active)for(const n of ['pace','acceleration','finishing','passing','vision','tackling','strength'])effectiveAttribute(id,'user',n,60)");
  assert.equal(snap(), before);
  playToEnd(h);
  assert.equal(snap(), before, 'user base attributes unchanged after 90 minutes');
  assert.equal(oppSnap(), oppBefore, 'opponent base attributes unchanged after 90 minutes');
});

test('15. determinism: same seed, same lineups, same ratings give the same match', () => {
  const sig = fixture => { const h = fresh(fixture); playToEnd(h); return JSON.stringify(h.run("[M.hg,M.ag,M.events.map(e=>[e.type,e.fromId,e.toId,e.gameSecond,e.success]),S.players.map(p=>p.fitness.toFixed(4))]")); };
  assert.equal(sig(5), sig(5));
  assert.notEqual(sig(5), sig(6));
  const src = require('node:fs').readFileSync(require('node:path').resolve(__dirname, '../dist/pitch-v731.js'), 'utf8') + require('node:fs').readFileSync(require('node:path').resolve(__dirname, '../dist/pitch-v73.js'), 'utf8');
  assert.doesNotMatch(src, /Math\.random/);
});

test('16/17. Phase 1 invariants hold under extreme attribute spreads', { timeout: 300000 }, () => {
  const issues = [], counts = { loose: 0, recoveries: 0 };
  for (const [fixture, spread] of [[0, 'stars'], [1, 'scrubs'], [2, 'mixed'], [3, 'tired'], [4, 'mixed'], [5, 'stars']]) {
    const h = fresh(fixture);
    h.run(`(function(){const v=${JSON.stringify(spread)};let i=0;for(const p of S.players){i++;
      const hi=v==='stars'||(v==='mixed'&&i%2);const lo=v==='scrubs'||(v==='mixed'&&!(i%2));
      for(const k of ['pace','finishing','passing','dribbling','defending','physical','stamina'])p[k]=hi?96:lo?30:p[k];
      if(v==='tired')p.fitness=35;}
      for(const team of Object.values(S.opponentSquads))for(const p of team){for(const k of ['pace','acceleration','passing','technique','dribbling','shooting','tackling','positioning','stamina'])p[k]=v==='stars'?30:v==='scrubs'?96:p[k];}
    })()`);
    playToEnd(h, kind => { if (!kind) issues.push(...h.run(PROBES).problems); });
    assert.equal(h.run('M.finished'), true);
    assert.equal(h.run("M.events.filter(e=>e.type==='end').length"), 1);
    counts.loose += h.run("M.events.filter(e=>e.type==='looseBall').length");
    counts.recoveries += h.run("M.events.filter(e=>e.type==='recovery').length");
  }
  same(issues, []);
  assert.ok(counts.loose > 0 && counts.recoveries > 0);
});

test('keeper identity: the active keeper decides saves, never a hardcoded id', () => {
  const h = fresh(0);
  const strong = oppPlayer(h, 0, {}), backup = 'o5';
  h.run(`opponentPlayer('o0').gk={reflexes:95,handling:95,oneOnOne:95};opponentPlayer('o5').gk=null`);
  const rating = () => h.run(`keeperRating(keeperId('opp'),'opp')`);
  assert.ok(rating() > 80, 'o0 is the active keeper');
  h.run("M.oppIds=M.oppIds.filter(id=>id!=='o0')");
  assert.notEqual(h.run("keeperId('opp')"), 'o0');
  assert.ok(rating() < 40, 'an outfield stand-in keeper is weak; the sent-off keeper\'s rating no longer applies');
  assert.equal(h.run("M.oppIds.includes(keeperId('opp'))"), true);
  void strong; void backup;
  // user side: a striker in goal is nowhere near the keeper he replaced
  const gk = h.run("M.active.find(id=>M.matchRoles[id]==='GK')");
  const nat = h.run(`keeperRating(${gk},'user')`);
  h.run(`M.matchRoles[${gk}]='CB'`);
  assert.ok(h.run(`keeperRating(${gk},'user')`) < nat * .6);
});
