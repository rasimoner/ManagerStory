/* V7.9.5 player profiles: every player in the game has a real, position-shaped attribute set; growth follows
   the profile (new skill moves unlock by themselves); training focus builds on top; old saves migrate. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./engine-harness.cjs');

const ATTRS = ['pace', 'acceleration', 'finishing', 'passing', 'dribbling', 'technique', 'vision', 'composure', 'tackling', 'positioning', 'offBall', 'strength', 'stamina'];
const career = () => { const h = harness(); h.run('S=fresh();init()'); return h; };
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;

test('every source gives real, varied players: no two academy graduates or signings share a flat attribute set', () => {
  const h = career();
  // promote 12 academy candidates, sign 12 market players
  h.run('for(let i=0;i<12;i++){const a=S.v6.academy[0];promoteAcademyPlayer(a.id,"warm")}');
  // wages cleared first, so the wage room (V7.13.2) does not stop the twelfth signing
  h.run('S.budget=1e10;S.players.forEach(p=>p.wage=0);for(const x of S.v6.transferPool.slice(0,12))signTransfer(x.id,1)');
  const grads = h.run('S.players.filter(p=>p.status==="Altyapıdan A takım")'), signed = h.run('S.players.filter(p=>p.status==="Yeni transfer")');
  assert.equal(grads.length, 12); assert.equal(signed.length, 12);
  for (const group of [grads, signed]) {
    const sets = new Set(group.map(p => ATTRS.map(n => p[n]).join(',')));
    assert.equal(sets.size, group.length, 'every player his own numbers');
    for (const n of ATTRS) assert.ok(new Set(group.map(p => p[n])).size >= 5, `${n} varies: ${group.map(p => p[n])}`);
    assert.ok(group.every(p => p.profile && PROFILE_OK(p)), 'each has a profile and every attribute');
  }
  // the old flat numbers are gone: signed players' dribbling is not all 70, stamina not all 76
  assert.ok(signed.some(p => p.dribbling !== 70) && signed.some(p => p.stamina !== 76));
});
const PROFILE_OK = p => ATTRS.every(n => Number.isFinite(p[n]) && p[n] >= 20 && p[n] <= 99) && p.defending === p.tackling && p.physical === p.strength;

test('the league plays its positions: strikers finish, centre-backs tackle, wingers are quick; keepers keep', () => {
  const h = career();
  const all = h.run('Object.values(S.opponentSquads).flat()');
  const of = (pos, n) => mean(all.filter(p => p.position === pos).map(p => p[n]));
  assert.ok(of('ST', 'finishing') > of('CB', 'finishing') + 25, `finishing ST ${of('ST', 'finishing')} CB ${of('CB', 'finishing')}`);
  assert.ok(of('CB', 'tackling') > of('LW', 'tackling') + 25, `tackling CB ${of('CB', 'tackling')} LW ${of('LW', 'tackling')}`);
  assert.ok(of('LW', 'pace') > of('CB', 'pace') + 10 && of('RW', 'dribbling') > of('CB', 'dribbling') + 15);
  assert.ok(of('CM', 'passing') > of('ST', 'passing') + 6 && of('CAM', 'vision') > of('CB', 'vision') + 10);
  assert.ok(all.filter(p => p.position === 'GK').every(p => p.gk && p.gk.reflexes > 30) && all.filter(p => p.position !== 'GK').every(p => p.gk === null));
  // a position's key attributes average the player's overall (plus the position's own lean), for every player
  const off = h.run(`Object.values(S.opponentSquads).flat().map(p=>{const g=profilePositionGroup(p.position),k=POSITION_KEYS[g],sh=POSITION_SHAPE[g];
    const lean=k.reduce((s,n)=>s+sh[n],0)/k.length;return k.reduce((s,n)=>s+p[n],0)/k.length-(p.overall+lean)})`);
  assert.ok(off.every(x => Math.abs(x) <= 3), 'key attributes anchored to the overall: ' + off.filter(x => Math.abs(x) > 3).map(x => x.toFixed(1)));
  // and the types are a mix, not one per position
  assert.ok(new Set(all.filter(p => p.position === 'ST').map(p => p.profile.type)).size >= 3);
});

test('profiles are stable: the same player is the same player in every new career, and the league keeps its people', () => {
  const a = career(), b = career();
  assert.equal(JSON.stringify(a.run('S.opponentSquads')), JSON.stringify(b.run('S.opponentSquads')));
  assert.equal(JSON.stringify(a.run('S.v6.transferPool')), JSON.stringify(b.run('S.v6.transferPool')));
  // league ages and fitness as before V7.9.5; overall and potential the same players' plus the league lift (+5)
  const first = a.run('S.opponentSquads[OPP[0][0]].slice(0,5).map(p=>[p.age,p.overall,p.potential,p.fitness])');
  assert.deepEqual(JSON.parse(JSON.stringify(first)), [[30, 79, 83, 93], [31, 79, 79, 90], [20, 76, 84, 92], [25, 69, 72, 97], [27, 70, 70, 95]]);
});

test('our hand-made squad keeps every number it was given; what it lacked now comes from its profile', () => {
  const h = career();
  const P = h.run('P0');
  for (const p0 of P) {
    const p = h.run(`S.players.find(p=>p.id===${p0.id})`);
    for (const n of ['pace', 'finishing', 'passing', 'dribbling', 'stamina']) assert.equal(p[n], p0[n], `${p0.name} ${n}`);
    assert.equal(p.tackling, p0.defending); assert.equal(p.strength, p0.physical);
    assert.ok(Number.isFinite(p.offBall) && Number.isFinite(p.vision) && Number.isFinite(p.technique));
  }
  // a striker now makes a striker's runs (offBall used to fall back to his defending)
  const mensah = h.run('S.players.find(p=>p.name==="Mensah")');
  assert.ok(mensah.offBall >= 75, 'Mensah off-ball ' + mensah.offBall);
});

test('growth follows the profile: a wonderkid dribbler gains stars and unlocks moves as his overall rises, with a note from the staff', () => {
  const h = career();
  h.run(`S.players.push({id:99,name:"Test Çocuk",age:17,pos:"LW",overall:62,potential:92,fitness:100,morale:80,form:70,minutes:0,status:"Altyapıdan A takım",growth:0,happiness:80});
    assignPlayerProfile(S.players.at(-1),{seed:4242,type:"dribbler",special:true})`);
  const start = h.run('skillMoves(99,"user")');
  const seen = [start.stars]; let moves = start.moves.length;
  for (let ovr = 64; ovr <= 88; ovr += 4) {
    h.run(`(function(){const p=S.players.find(x=>x.id===99);p.overall=${ovr};refreshPlayerProfile(p)})()`);
    const k = h.run('skillMoves(99,"user")'); seen.push(k.stars);
    assert.ok(k.moves.length >= moves, 'moves are never lost while he grows'); moves = k.moves.length;
  }
  assert.ok(seen[0] <= 3 && seen.at(-1) === 5, 'stars ' + seen);
  assert.ok(moves >= start.moves.length + 6, `moves ${start.moves.length} → ${moves}`);
  // through the weekly evolution: an overall step that brings a move puts a note in the inbox and in history
  h.run(`(function(){const p=S.players.find(x=>x.id===99);p.overall=69;refreshPlayerProfile(p);p.growth=.99;p.minutes=900;p.form=90})()`);
  const before = h.run('skillMoves(99,"user").moves');
  let learned = null;
  for (let w = 0; w < 30 && !learned; w++) {
    h.run('evolvePlayers()');
    const now = h.run('skillMoves(99,"user").moves');
    if (now.length > before.length) learned = now.filter(m => !before.includes(m));
  }
  assert.ok(learned?.length, 'a move was learned');
  assert.ok(h.run('S.inbox.some(m=>m.title.includes("yeni hareket öğrendi"))'));
  assert.deepEqual(h.run('S.players.find(x=>x.id===99).newMoves').filter(m => learned.includes(m)).length, learned.length);
});

test('training focus builds its attributes week by week, faster when young, capped, and is saved with the career', () => {
  const h = career();
  const id = h.run('S.players.find(p=>p.name==="Aras").id'), vet = h.run('S.players.find(p=>p.name==="Serkan").id');
  const d0 = h.run(`S.players.find(p=>p.id===${id}).dribbling`), t0 = h.run(`S.players.find(p=>p.id===${vet}).tackling`);
  h.run(`setTrainingFocus(${id},"dribbling");setTrainingFocus(${vet},"defending")`);
  for (let w = 0; w < 4; w++) h.run(`trainFocusWeek(S.players.find(p=>p.id===${id}));trainFocusWeek(S.players.find(p=>p.id===${vet}))`);
  const young = h.run(`S.players.find(p=>p.id===${id})`), old = h.run(`S.players.find(p=>p.id===${vet})`);
  assert.ok(young.dribbling >= d0 + 2 && young.technique > 0, `young dribbling ${d0} → ${young.dribbling}`);
  assert.ok(young.profile.trained.dribbling > old.profile.trained.tackling, 'the 19-year-old learns faster than the 34-year-old');
  assert.ok(old.tackling >= t0);
  for (let w = 0; w < 60; w++) h.run(`trainFocusWeek(S.players.find(p=>p.id===${id}))`);
  assert.equal(h.run(`S.players.find(p=>p.id===${id}).profile.trained.dribbling`), 8, 'capped at +8');
  h.run('save()');
  const re = harness(h.storage); re.run('init()');
  const back = re.run(`S.players.find(p=>p.id===${id})`);
  assert.equal(back.focus, 'dribbling'); assert.equal(back.profile.trained.dribbling, 8); assert.equal(back.dribbling, h.run(`S.players.find(p=>p.id===${id}).dribbling`));
  // the profile screen shows it and offers every focus
  re.run(`showPlayerProfile(${id})`);
  const html = re.app.innerHTML;
  assert.match(html, /Bireysel antrenman odağı/); assert.match(html, /Çalımcı|Oyun kurucu|Hızlı|Golcü/);
  for (const label of ['Çalım', 'Pas ve oyun görüşü', 'Bitiricilik', 'Fizik ve hız', 'Savunma']) assert.ok(html.includes(label), label);
});

test('an old save migrates: flat academy graduates and signings are generated properly, everyone else keeps his numbers', () => {
  const h = career();
  // a pre-V7.9.5 career: no profiles anywhere, a flat graduate and a flat signing
  h.run(`S.players.push({id:50,name:"Eski Genç",age:17,pos:"RW",overall:63,potential:91,pace:60,finishing:55,passing:58,dribbling:58,defending:55,physical:55,stamina:70,status:"Altyapıdan A takım",personality:"Özel yetenek"});
    S.players.push({id:51,name:"Eski Transfer",age:25,pos:"CB",overall:74,potential:78,pace:70,finishing:66,passing:70,dribbling:70,defending:74,physical:70,stamina:76,status:"Yeni transfer"});
    for(const p of S.players){delete p.profile}for(const t of Object.values(S.opponentSquads))for(const p of t)delete p.profile;for(const x of S.v6.transferPool)delete x.profile;save()`);
  const re = harness(h.storage); re.run('init()');
  const kid = re.run('S.players.find(p=>p.id===50)'), cb = re.run('S.players.find(p=>p.id===51)'), burak = re.run('S.players.find(p=>p.name==="Burak")');
  assert.equal(kid.profile.type, 'dribbler'); assert.equal(kid.profile.special, true); assert.ok(kid.dribbling > 58 && kid.tackling < 55);
  assert.ok(cb.tackling > cb.dribbling + 10 && cb.finishing < 55, 'a centre-back now: ' + JSON.stringify([cb.tackling, cb.dribbling, cb.finishing]));
  assert.equal(burak.passing, 78); assert.equal(burak.stamina, 80);
  assert.ok(re.run('Object.values(S.opponentSquads).flat().every(p=>p.profile)') && re.run('S.v6.transferPool.every(x=>x.profile)'));
});

/* V7.9.5 the season's wonderkid */
const withSalt = salt => { const h = harness(); h.run(`S=fresh();S.matchSalt=${salt};init()`); return h; };
test('every season brings a wonderkid: one, between weeks 3 and 12, in our academy about one season in three, otherwise at a club', () => {
  let ours = 0; const clubs = new Set();
  for (let salt = 1; salt <= 60; salt++) {
    const h = withSalt(salt * 7919);
    const plan = h.run('ensureSeasonWonder()');
    assert.ok(plan.week >= 3 && plan.week <= 12, 'week ' + plan.week);
    h.run(`S.fixture=${plan.week - 1};seasonWonderTick()`); assert.equal(h.run('S.v795.wonderkids.length'), 0, 'not before his week');
    h.run(`S.fixture=${plan.week};seasonWonderTick();seasonWonderTick();S.fixture=33;seasonWonderTick()`);
    const kids = h.run('S.v795.wonderkids');
    assert.equal(kids.length, 1, 'exactly one this season');
    const k = kids[0];
    assert.ok(k.age <= 17 && ['dribbler', 'finisher', 'playmaker'].includes(k.type));
    if (k.where === 'academy') { ours++; assert.ok(h.run(`S.v6.academy.some(a=>a.id==="${k.academyId}"&&a.special&&a.pinned)`)); }
    else clubs.add(k.club);
    assert.ok(h.run('S.inbox[0].title').includes('💎'));
  }
  assert.ok(ours >= 9 && ours <= 27, 'ours ' + ours + ' of 60');
  assert.ok(clubs.size >= 8, 'clubs ' + clubs.size);
});

test("a club's wonderkid plays for them, grows fast, can be bought in a window and then plays for us", () => {
  const h = career();
  h.run('S.fixture=ensureSeasonWonder().week;seasonWonderTick()');
  const k = h.run('S.v795.wonderkids[0]');
  assert.equal(k.where, 'club');
  const squad = h.run(`S.opponentSquads[${JSON.stringify(k.club)}]`);
  const idx = squad.findIndex(p => p.id === k.squadId);
  assert.ok(idx >= 0 && idx < 11, 'in their first eleven'); assert.equal(squad[idx].position, k.pos);
  assert.ok(squad.some(p => p.id === k.replacedId) && squad.length === 17);
  // he plays when we meet them
  const fx = h.run(`S.schedule.findIndex(f=>f.home===${JSON.stringify(k.club)}||f.away===${JSON.stringify(k.club)})`);
  if (fx >= 0) { h.run(`S.fixture=${fx};startMatch()`); assert.ok(h.run(`Object.values(M.oppLineup).includes(${JSON.stringify(k.squadId)})`)); h.run('M=null'); }
  // he grows faster than an ordinary youngster, and his market entry follows him
  const o0 = h.run('wonderSquadPlayer(S.v795.wonderkids[0]).overall');
  for (let f = 1; f <= 20; f++) h.run(`evolveOpponentSquads(${f})`);
  const o1 = h.run('wonderSquadPlayer(S.v795.wonderkids[0]).overall');
  assert.ok(o1 >= o0 + 6, `wonderkid ${o0} → ${o1}`);
  assert.equal(h.run(`S.v6.transferPool.find(x=>x.id===${JSON.stringify(k.poolId)}).overall`), o1);
  // the academy screen follows him; outside a window the offer button waits
  h.run('S.week=10;showAcademy()'); assert.match(h.app.innerHTML, /Ligdeki harika çocuklar/); assert.match(h.app.innerHTML, /Transfer dönemi kapalı/);
  h.run('S.week=19;showAcademy()'); assert.match(h.app.innerHTML, /Transfer görüşmesi/);
  // bought: same player, same profile, gone from their squad (the man he replaced is back in their eleven)
  h.run(`S.budget=1e9;signTransfer(${JSON.stringify(k.poolId)},1)`);
  const me = h.run('S.players.at(-1)');
  assert.equal(me.name, k.name); assert.equal(me.overall, o1); assert.equal(me.profile.special, true); assert.equal(me.profile.type, k.type);
  const after = h.run(`S.opponentSquads[${JSON.stringify(k.club)}]`);
  assert.ok(!after.some(p => p.id === k.squadId) && after.length === 16 && after[idx].id === k.replacedId);
  assert.equal(h.run('S.v795.wonderkids[0].where'), 'squad');
  h.run('showAcademy()'); assert.match(h.app.innerHTML, /Bizim kadromuzda/);
});

test('our own wonderkid waits in the academy report through new reports, joins as a special talent, and it all survives a reload', () => {
  let h, salt = 1;
  for (; salt < 200; salt++) { h = withSalt(salt * 104729); if (h.run('ensureSeasonWonder().ours')) break; }
  h.run('S.fixture=ensureSeasonWonder().week;seasonWonderTick()');
  const k = h.run('S.v795.wonderkids[0]');
  assert.equal(k.where, 'academy');
  h.run('refreshAcademy();refreshAcademy()');
  assert.ok(h.run(`S.v6.academy.some(a=>a.id===${JSON.stringify(k.academyId)})`), 'still in the report');
  h.run('save()'); const re = harness(h.storage); re.run('init()');
  assert.equal(re.run('S.v795.wonderkids.length'), 1); assert.equal(re.run('ensureSeasonWonder().done'), true);
  re.run(`promoteAcademyPlayer(${JSON.stringify(k.academyId)},"warm")`);
  const p = re.run('S.players.at(-1)');
  assert.equal(p.name, k.name); assert.equal(p.profile.special, true); assert.equal(p.personality, 'Özel yetenek');
  assert.equal(re.run('S.v795.wonderkids[0].where'), 'squad');
});
