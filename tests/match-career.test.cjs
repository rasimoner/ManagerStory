/* Refactor D4: the engine plays the match and says what happens; the manager mode writes the career's side
   of it (modes/manager/match-career.js) from the engine's events and its minutePlayed notice:
   - a player's season goals, yellow and red cards and minutes follow the match exactly (a red for a second
     yellow is a yellow too);
   - a first professional match marks the debut once and lifts morale by 5;
   - with the mode disconnected, the engine leaves those season figures alone. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, playToEnd } = require('./engine-harness.cjs');

const SEASON = 'Object.fromEntries(S.players.map(p=>[p.id,{goals:p.goals||0,yellow:p.yellow||0,red:p.red||0,minutes:p.minutes}]))';

function play(fixture, setup = '') {
  const h = harness();
  h.run(`S=fresh();init();S.fixture=${fixture};${setup}`);
  const before = JSON.parse(h.run(`JSON.stringify(${SEASON})`));
  h.run('startMatch();resumeLive()');
  playToEnd(h);
  const after = JSON.parse(h.run(`JSON.stringify(${SEASON})`));
  const events = JSON.parse(h.run('JSON.stringify(M.events)'));
  const stats = JSON.parse(h.run('JSON.stringify(M.playerStats)'));
  const side = h.run('userSide()');
  return { h, before, after, events, stats, side };
}

test('season goals, cards and minutes follow the match the engine played', () => {
  let cards = 0;
  for (const fixture of [0, 5, 11, 22]) {
    const { before, after, events, stats, side } = play(fixture);
    for (const id of Object.keys(after)) {
      const mine = e => e.playerId === Number(id) && e.side === side;
      const goals = events.filter(e => e.type === 'goal' && mine(e)).length;
      const reds = events.filter(e => e.type === 'red' && mine(e));
      const yellows = events.filter(e => e.type === 'yellow' && mine(e)).length + reds.filter(e => /ikinci sarı/.test(e.text)).length;
      cards += yellows + reds.length;
      assert.equal(after[id].goals - before[id].goals, goals, `fixture ${fixture}, player ${id}: goals`);
      assert.equal(after[id].yellow - before[id].yellow, yellows, `fixture ${fixture}, player ${id}: yellow cards`);
      assert.equal(after[id].red - before[id].red, reds.length, `fixture ${fixture}, player ${id}: red cards`);
      assert.equal(after[id].minutes - before[id].minutes, stats[id]?.minutes || 0, `fixture ${fixture}, player ${id}: minutes`);
    }
  }
  assert.ok(cards > 0, 'some of our players were booked');
});

test('a first professional match: the debut is marked once and lifts morale', () => {
  const h = harness();
  h.run('S=fresh();init()');
  const id = h.run('S.xi[3]');
  h.run(`(()=>{const p=S.players.find(x=>x.id===${id});p.debutDone=false;p.morale=60})()`);
  h.run('startMatch();tick()'); // the first minute: the debut
  assert.equal(h.run(`S.players.find(x=>x.id===${id}).debutDone`), true);
  assert.equal(h.run(`S.players.find(x=>x.id===${id}).morale`), 65);
  h.run('resumeLive()');
  playToEnd(h);
  assert.equal(h.run(`M.events.filter(e=>e.type==='debut'&&e.playerId===${id}).length`), 1, 'once');
});

test('with the mode disconnected the engine leaves the season figures alone', () => {
  const { after, before, events } = play(0, "HOOKS.matchEvent.length=0;HOOKS.minutePlayed.length=0");
  assert.ok(events.some(e => e.type === 'goal'), 'the match still has goals');
  assert.deepEqual(after, before);
});
