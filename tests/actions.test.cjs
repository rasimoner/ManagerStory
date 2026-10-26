/* Refactor C2: the page has no inline event handlers. Every button and form control names an action
   (data-action) whose values are in data-* attributes, and one delegated dispatcher (dist/ui/actions.js)
   runs it. These checks:
   - every action any screen draws is registered, so no button does nothing;
   - pressing the drawn buttons (their data-* values, as the browser hands them over) reaches the game;
   - nothing in the page scripts writes an inline on…= handler any more. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, gameSources } = require('./support/game.cjs');

function career() {
  const g = loadGame({ quiet: true });
  g.click('newCareer');
  return g;
}

// screens reached through the game's own buttons, plus a few opened directly (match, season end)
function screens() {
  const g = career(), seen = [];
  const look = name => seen.push([name, g.html()]);
  look('home');
  for (const tab of ['league', 'squad', 'plan', 'transfer', 'academy', 'home']) { g.click('goMain', { section: tab }); look(tab); }
  g.click('goMain', { section: 'squad' }); g.click('showPlayerProfile'); look('player profile');
  g.click('goMain', { section: 'transfer' }); g.click('showMarketProfile'); look('market profile');
  g.click('v6Talk'); look('transfer talk');
  g.click('goMain', { section: 'academy' }); g.click('showAcademyProfile'); look('academy profile');
  g.click('academyMeeting'); look('academy meeting');
  g.click('goMain', { section: 'home' }); g.click('showInbox'); look('inbox');
  g.click('showSettings'); look('settings');
  g.click('back'); g.click('showWorld'); look('world');
  g.click('back');
  g.click('openFormation'); look('formation');
  g.click('lineupPlayer'); look('lineup player');
  g.click('fieldAction'); look('field action');
  g.run('S.event.kind="matchday";startMatch()'); look('match');
  g.run('M.pause=true;render()'); look('match paused');
  g.click('openDecisionSheet'); look('decision sheet');
  g.click('subUI'); look('substitution');
  g.click('closeMatchOverlay');
  g.click('openMatchPlayer'); look('match player');
  g.run('M.reason="half";M.pause=true;render()'); look('half time');
  // the season end, from a saved career at its contract decisions, and the star transfer screens
  const fs = require('node:fs'), path = require('node:path');
  const save = fs.readFileSync(path.join(__dirname, 'fixtures/saves/generated/season-end-contracts.json'), 'utf8');
  const e = loadGame({ quiet: true, storage: new Map([['msv4', save]]) });
  e.run('render()'); seen.push(['season end: contracts', e.html()]);
  const t = career();
  t.run("starTransferTrial('out')"); seen.push(['star: announcement', t.html()]);
  t.click('starSigningScreen'); seen.push(['star: signing', t.html()]);
  return seen;
}

test('every action a screen draws is registered', () => {
  const g = career(), registered = new Set(g.run('Object.keys(ACTIONS)'));
  for (const [name, html] of screens()) {
    const drawn = g.actionsOn(html);
    assert.ok(drawn.length > 0 || name === 'match player', `${name}: has buttons`);
    for (const a of drawn) assert.ok(registered.has(a.action), `${name}: action "${a.action}" is not registered`);
  }
});

test('no inline event handlers: not on any screen, not in any page script', () => {
  for (const [name, html] of screens()) assert.doesNotMatch(html, /\son[a-z]+=/, name);
  for (const { file, code } of gameSources({ layers: ['clock', 'view'] })) {
    assert.doesNotMatch(code, /\bon(click|change|input|submit)=/, file);
  }
});

test('season end: a contract decision and the next step read their values from the buttons', () => {
  const fs = require('node:fs'), path = require('node:path');
  const save = fs.readFileSync(path.join(__dirname, 'fixtures/saves/generated/season-end-contracts.json'), 'utf8');
  const g = loadGame({ quiet: true, storage: new Map([['msv4', save]]) });
  g.run('render()');
  const pick = g.actionsOn(g.html()).find(a => a.action === 'seasonContractPick' && a.data.years === '2' && !('disabled' in a.attrs));
  assert.ok(pick, 'a two-year renewal button');
  g.click('seasonContractPick', { id: pick.data.id, years: 2 });
  assert.match(g.html(), new RegExp(`data-id="${pick.data.id}" data-years="2"`));
  assert.equal(g.json(`S.seasonEnd.data.decisions[${pick.data.id}]`), 2);
  g.click('seasonContractAll', { years: 1 });
  g.click('seasonEndNext', { step: 'contracts' });
  assert.doesNotMatch(g.html(), /data-step="contracts"/, 'past the contracts step');
});

test('buttons drawn on a screen reach the game with their values', () => {
  const g = career();
  // the bottom menu and a back button
  g.click('goMain', { section: 'squad' });
  assert.match(g.html(), /data-tab="squad" aria-current="page"/);
  const id = g.run('S.players[3].id');
  g.click('showPlayerProfile', { id: String(id) });
  assert.match(g.html(), new RegExp(g.run(`S.players[3].name`)));
  g.click('back');
  assert.match(g.html(), /data-tab="squad" aria-current="page"/, 'back to the squad');
  // a value from a data attribute: the training focus of that player
  g.click('showPlayerProfile', { id: String(id) });
  const focus = g.actionsOn(g.html()).find(a => a.action === 'setTrainingFocus' && a.data.focus).data.focus;
  g.click('setTrainingFocus', { focus });
  assert.equal(g.run(`S.players[3].focus`), focus);
  g.click('setTrainingFocus', { id: String(id), focus: undefined });
  assert.equal(g.run(`S.players[3].focus ?? null`), null, 'no focus: the button without data-focus');
  // a select: its value comes from the element
  g.click('goMain', { section: 'transfer' });
  g.click('transferType', {}, { value: 'wingBack' });
  assert.match(g.html(), /<option value="wingBack" selected>/);
  g.click('transferSort', { sort: 'age' });
  assert.match(g.html(), /aria-pressed="true" data-action="transferSort" data-sort="age"/);
  // the day's decision
  g.click('goMain', { section: 'home' });
  const before = g.run('S.event.title');
  g.click('choose');
  assert.notEqual(g.run('S.event.title'), before, 'a choice moves the day on');
});

test('an action runs on the clicked element and on every element around it, innermost first, like the inline handlers did', () => {
  const g = loadGame({ quiet: true });
  g.run(`defineActions({ __inner: () => __order.push('inner'), __outer: () => __order.push('outer') }); var __order = [];`);
  const el = (action, parent, tagName = 'BUTTON') => ({ tagName, dataset: action ? { action } : {}, parent });
  const outer = el('__outer'), middle = el(null, outer, 'DIV'), inner = el('__inner', middle);
  g.ctx.dispatchAction({ type: 'click', composedPath: () => [inner, middle, outer, g.ctx.document] });
  assert.deepEqual(g.json('__order'), ['inner', 'outer']);
  // a form control acts on change, not on the click that opens it
  g.run('__order = []');
  const select = el('__inner', outer, 'SELECT');
  g.ctx.dispatchAction({ type: 'click', composedPath: () => [select, outer, g.ctx.document] });
  assert.deepEqual(g.json('__order'), ['outer']);
  g.run('__order = []');
  g.ctx.dispatchAction({ type: 'change', composedPath: () => [select, outer, g.ctx.document] });
  assert.deepEqual(g.json('__order'), ['inner']);
  assert.throws(() => g.run('defineActions({ __inner: () => 0 })'), /defined twice/);
});
