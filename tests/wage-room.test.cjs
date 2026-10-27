/* The wage room (V7.13.2): how much a club may pay its squad a year.
   - one rule, in data/balance.json: the club's level, priced like a player of that level (the wage formula),
     times contracts.wageBudget.squadSlots; a new career keeps a sensible margin above the real wage bill
   - the transfer office and the squad show the real room; a signing gets his wage and must fit in it
   - the season end's contracts screen weighs the decisions against it
   - an old save drops the stored 24M figure (save migration) and shows the rule's room */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./support/game.cjs');
const { FAST } = require('./support/career-sim.cjs');

function harness(storage = new Map()) {
  const g = loadGame({ storage, quiet: true });
  g.run(FAST);
  if (!storage.size) g.run('S=fresh();S.matchSalt=424242;init();save();render()');
  return g;
}
const money = n => '₺' + (n / 1e6).toFixed(1) + 'M';

test('the rule: the club level priced like a player of that level, times the squad slots, from balance.json', () => {
  const g = harness();
  const rule = g.json('BALANCE.contracts.wageBudget');
  const perOverallSquared = g.run('BALANCE.contracts.wage.perOverallSquared');
  const level = g.run('managedClubLevel()');
  assert.ok(Number.isInteger(level) && level >= 60 && level <= 80, `our club has a level (${level})`);
  const expected = Math.round(level * level * perOverallSquared * rule.squadSlots / rule.roundTo) * rule.roundTo;
  assert.equal(g.run('wageBudget()'), expected);
  assert.ok(g.run('wageBudget(74)') > g.run('wageBudget(66)'), 'a bigger club may pay more');
  // the rule is the only source: nothing stores a wage budget in the career any more
  assert.equal(g.run('S.v6.wageBudget'), undefined);
});

test('a new career keeps a sensible margin above the real wage bill', () => {
  const g = harness();
  const bill = g.run('wageBill()'), budget = g.run('wageBudget()'), room = g.run('wageRoom()');
  assert.equal(room, budget - bill);
  assert.ok(room / budget >= 0.15 && room / budget <= 0.45, `room ${money(room)} of ${money(budget)}`);
  // the bill is the squad's wages; sold players are off the payroll
  assert.equal(bill, g.run('S.players.reduce((n,p)=>n+p.wage,0)'));
  g.run('S.players[3].status="Transfer oldu"');
  assert.equal(g.run('wageBill()'), bill - g.run('S.players[3].wage'));
});

test('the room holds across five seasons of an unchanged policy', () => {
  let g = harness();
  for (let season = 1; season <= 5; season++) {
    g.run('fastSeason();autoSeasonEnd();save()');
    g = harness(g.storage);
    assert.ok(g.run('wageRoom()') > 0, `season ${season}: bill ${money(g.run('wageBill()'))} of ${money(g.run('wageBudget()'))}`);
  }
});

test('the transfer office and the squad show the real room', () => {
  const g = harness();
  g.run('showTransferList("ST")');
  assert.ok(g.html().includes(`Maaş alanı ${money(g.run('wageRoom()'))}/yıl`));
  assert.ok(g.run('wageRoom()') > 0, 'no longer always zero');
  g.run('modal="squad";render()');
  assert.ok(g.html().includes(`${money(g.run('wageBill()'))} / ${money(g.run('wageBudget()'))}`));
});

test('a signing gets his wage from the day he signs', () => {
  const g = harness();
  g.run('S.budget=9e8');
  const x = g.json('S.v6.transferPool.find(x=>!x.star)');
  const bill = g.run('wageBill()');
  // the negotiation shows what he will earn and what is left
  g.run(`showTransferNegotiation('${x.id}')`);
  assert.ok(g.html().includes(`Maaş ${money(g.run(`baseWage(${x.overall})`))}/yıl`));
  g.run(`signTransfer('${x.id}',1000000)`);
  const p = g.json('S.players.at(-1)');
  assert.equal(p.name, x.name);
  assert.equal(p.wage, g.run(`baseWage(${x.overall})`), 'his wage from the day he signs');
  assert.equal(g.run('wageBill()'), bill + p.wage);
});

test('a signing whose wage does not fit: the deal is off, nothing is paid, nobody joins', () => {
  const g = harness();
  g.run('S.budget=9e8');
  const y = g.json('S.v6.transferPool.find(x=>!x.star)');
  g.run(`S.players[0].wage+=wageRoom()-baseWage(${y.overall})+1`);
  const budget = g.run('S.budget'), squad = g.run('S.players.length');
  g.run(`showTransferNegotiation('${y.id}')`);
  assert.match(g.html(), /Maaş alanı yetersiz/);
  assert.match(g.html(), /aria-disabled="true"[^>]*data-action="v6Sign"|data-action="v6Sign"[^>]*aria-disabled="true"/);
  g.run(`signTransfer('${y.id}',1000000)`);
  assert.equal(g.run('S.budget'), budget);
  assert.equal(g.run('S.players.length'), squad);
  assert.ok(g.alerts.some(a => /Maaş alanı yetersiz/.test(a)));
});

test('the contracts screen weighs the decisions against the room', () => {
  const g = harness();
  g.run('fastSeason()');
  let guard = 0;
  while (g.run('S.seasonEnd.steps[S.seasonEnd.at]') !== 'contracts' && guard++ < 10) g.run('seasonEndNext(S.seasonEnd.steps[S.seasonEnd.at])');
  assert.match(g.html(), /Sözleşmesi bitenler/);
  assert.ok(g.html().includes(`Maaş alanı</span><b>${money(g.run('wageBudget()'))}`));
  assert.ok(!g.html().includes('maaş alanını aşıyor'));
  // a squad far above its means: the screen says so, and new signings will have no room
  g.run('S.players.forEach(p=>p.wage*=3);render()');
  assert.match(g.html(), /maaş alanını aşıyor/);
});

test('an old save drops the stored 24M wage budget and shows the rule’s room', () => {
  const old = fs.readFileSync(path.join(__dirname, 'fixtures/saves/legacy/v7.9.5.json'), 'utf8');
  assert.equal(JSON.parse(old).v6.wageBudget, 24000000, 'the fixture carries the old figure');
  const g = harness(new Map([['msv4', old]]));
  assert.equal(g.run('S.v6.wageBudget'), undefined);
  assert.ok(g.run('wageRoom()') > 0);
  assert.ok(g.json('SAVE_MIGRATIONS').some(s => /wage budget/.test(s.about)), 'a migration step says so');
});
