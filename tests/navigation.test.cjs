/* V7.9.5 navigation: tab roots have no back button (the tab bar is the way out); every detail screen has its
   back button in the sticky header, as an icon that says where it leads. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./support/game.cjs');

function harness() {
  const g = loadGame();
  g.run('S=fresh();S.matchSalt=newMatchSalt();init();save();render()');
  return { run: g.run, html: g.html };
}
// where the back button leads: the action it runs (data-to) and its values
const backTarget = html => { const tag = html.match(/<button class="iconbtn navback"[^>]*>/)?.[0] || ''; const to = tag.match(/data-to="([^"]*)"/)?.[1], id = tag.match(/data-id="([^"]*)"/)?.[1]; return id ? `${to}:${id}` : to; };

test('tab roots have no back button', () => {
  const h = harness();
  for (const tab of ['home', 'league', 'squad', 'plan', 'transfer', 'academy']) {
    h.run(`goMain('${tab}')`);
    const html = h.html();
    assert.ok(!html.includes('navback'), `${tab}: no header back button`);
    assert.ok(!/<button class=secondary[^>]*>‹/.test(html), `${tab}: no old in-page back button`);
    assert.match(html, new RegExp(`data-tab="${tab}" aria-current="page"`), `${tab}: its tab is the active one`);
  }
});

test('detail screens carry their back button in the header', () => {
  const h = harness();
  const cases = [
    ['showPlayerProfile(S.players[3].id)', 'openSquad'],
    ['showMarketProfile(S.v6.transferPool[0].id)', 'showV6Transfers'],
    ['showAcademyProfile(S.v6.academy[0].id)', 'showAcademy'],
    ['showInbox()', 'redraw'],
    ['showWorld()', 'redraw'],
    ['showSettings()', 'openHome'],
    ["modal='formation';render()", 'openHome'],
  ];
  for (const [open, target] of cases) {
    h.run(open);
    const html = h.html();
    assert.equal(backTarget(html), target, open);
    assert.match(html, /<header class=hisarhead><div class=hisarbrand><button class="iconbtn navback" aria-label="Geri: /, `${open}: back sits first in the header`);
    assert.ok(!/<button class=secondary[^>]*>‹/.test(html), `${open}: no old in-page back button`);
    h.run('modal=null;render()');
  }
});

test('transfer list: player-type dropdown filters, filters survive a profile visit, every card shows its stars', () => {
  const h = harness();
  h.run("goMain('transfer')");
  assert.match(h.html(), /<select id=transferType/);
  h.run("showTransferList(undefined,undefined,'wingBack')");
  const types = [...h.html().matchAll(/<small class=ptype>([^<]+)<\/small>/g)].map(m => m[1]);
  assert.ok(types.length > 0 && types.every(t => t === 'Bindiren bek'), types.join(','));
  assert.equal((h.html().match(/class=liststars/g) || []).length, types.length, 'stars on every card');
  h.run('showMarketProfile(S.v6.transferPool.find(x=>x.profile?.type==="wingBack").id)');
  h.run('showTransferList()');
  assert.match(h.html(), /<option value="wingBack" selected>/, 'filter kept after the profile');
  h.run("showTransferList('GK')");
  assert.match(h.html(), /Bu filtreyle listede oyuncu yok/);
  h.run("showTransferList('ALL',undefined,'ALL')");
});

test('academy list shows each prospect\'s stars', () => {
  const h = harness();
  h.run("goMain('academy')");
  assert.ok((h.html().match(/class=liststars/g) || []).length >= h.run('S.v6.academy.length'));
});

test('transfer list: "Yıldız ↓" sorts by skill stars, highest first', () => {
  const h = harness();
  h.run("showTransferList('ALL','stars','ALL')");
  assert.match(h.html(), /aria-pressed="true" data-action="transferSort" data-sort="stars">Yıldız ↓/);
  assert.match(h.html(), />POT ↓</);
  const stars = [...h.html().matchAll(/aria-label="Yetenek (\d) yıldız"/g)].map(m => +m[1]);
  assert.ok(stars.length > 5, 'cards rendered');
  assert.deepEqual(stars, [...stars].sort((a, b) => b - a));
  assert.ok(stars[0] > stars[stars.length - 1], 'not all the same');
});
