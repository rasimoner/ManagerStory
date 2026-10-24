/* V7.9.5 navigation: tab roots have no back button (the tab bar is the way out); every detail screen has its
   back button in the sticky header, as an icon that says where it leads. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const base = path.resolve(__dirname, '../dist');
const sources = ['match-support.js', 'career-events.js', 'live-match.js', 'player-profiles.js', 'opponents-v731.js', 'pitch-v73.js', 'pitch-v731.js', 'app.js'].map(f => fs.readFileSync(path.join(base, f), 'utf8'));

function harness() {
  const store = new Map();
  const app = { innerHTML: '', classList: { toggle() {} }, insertAdjacentHTML(_w, html) { this.innerHTML += html; } };
  const ctx = { console, structuredClone, AbortController, URL, Blob, setTimeout, clearTimeout, Math,
    localStorage: { getItem: k => store.get(k) || null, setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k) },
    document: { body: { classList: { toggle() {} } }, querySelector(q) { if (q === '#app') return app; if (q === '.bottomnav') return app.innerHTML.includes('class=bottomnav') ? {} : null; return null; } },
    alert() {}, confirm: () => true, prompt: () => null };
  ctx.window = ctx; ctx.window.scrollTo = () => {};
  vm.createContext(ctx);
  for (const s of sources) vm.runInContext(s, ctx);
  const run = code => vm.runInContext(code, ctx);
  run('S=fresh();S.matchSalt=newMatchSalt();init();save();render()');
  return { run, html: () => app.innerHTML };
}
// the attribute is HTML-escaped; the browser hands nav.js the decoded value
const backTarget = html => html.match(/class="iconbtn navback"[^>]*data-target="([^"]*)"/)?.[1].replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');

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
    ['showPlayerProfile(S.players[3].id)', "modal='squad';render()"],
    ['showMarketProfile(S.v6.transferPool[0].id)', 'showV6Transfers()'],
    ['showAcademyProfile(S.v6.academy[0].id)', 'showAcademy()'],
    ['showInbox()', 'render()'],
    ['showWorld()', 'render()'],
    ['showSettings()', 'modal=null;render()'],
    ["modal='formation';render()", 'modal=null;render()'],
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
  h.run("showV6Transfers(undefined,undefined,'wingBack')");
  const types = [...h.html().matchAll(/<small class=ptype>([^<]+)<\/small>/g)].map(m => m[1]);
  assert.ok(types.length > 0 && types.every(t => t === 'Bindiren bek'), types.join(','));
  assert.equal((h.html().match(/class=liststars/g) || []).length, types.length, 'stars on every card');
  h.run('showMarketProfile(S.v6.transferPool.find(x=>x.profile?.type==="wingBack").id)');
  h.run('showV6Transfers()');
  assert.match(h.html(), /<option value="wingBack" selected>/, 'filter kept after the profile');
  h.run("showV6Transfers('GK')");
  assert.match(h.html(), /Bu filtreyle listede oyuncu yok/);
  h.run("showV6Transfers('ALL',undefined,'ALL')");
});

test('academy list shows each prospect\'s stars', () => {
  const h = harness();
  h.run("goMain('academy')");
  assert.ok((h.html().match(/class=liststars/g) || []).length >= h.run('S.v6.academy.length'));
});
