/* The manager's highlight archive on screen: the archive (a detail screen of the squad tab: every highlight of
   the career, newest first, by player, type and season), a player's "Highlight'lar" on his profile, the
   "▶ İzle" on the staff's new-move note, and "İzle" itself (scenes/highlight-scene.js, loaded when first
   watched). The recipes are core's (core/highlights.js). */
import MOVE_DATA from '../../data/moves.json';
import { S } from '../../core/state.js';
import { HIGHLIGHT_RULES, archiveView, stageKindFor } from '../../core/highlights.js';
import { resolveClubIdentity } from '../../core/clubs/clubs.js';
import { escapeHTML } from '../../core/engine/match-support.js';
import { SKILL_NAMES } from '../../core/players/move-names.js';
import { defineActions } from '../../ui/actions.js';
import { $, clubColor, decorateMainScreen, header } from './app.js';

export const HIGHLIGHT_TYPE_LABELS = { starTransfer: 'Yıldız transfer', skillMove: 'Maçta özel hareket', keeperSave: 'Kaleci kurtarışı', newMove: 'Yeni hareket' };
const PROFILE_SHOWS = 3;
const ALL = 'ALL';

export const highlightMoveName = move => SKILL_NAMES[move] || MOVE_DATA.highlightNames[move] || move;
const isKeeperPos = pos => String(pos || '').split('/')[0] === 'GK';
const list = () => (Array.isArray(S?.highlights) ? S.highlights : []);

// when and where: "2025/26 • 12. hafta • Rakip 67'"
export function highlightLine(h) {
  const match = h.opponent ? ` • ${h.opponent}${h.minute != null ? ` ${h.minute}'` : ''}` : '';
  return `${h.season} • ${h.week}. hafta${match}`;
}

export function highlightRow(h) {
  return `<div class="card hlrow"><div class="row between"><div><small class=hltype>${HIGHLIGHT_TYPE_LABELS[h.type]}</small><h3>${escapeHTML(highlightMoveName(h.move))}</h3><small>${escapeHTML(h.playerName)} • ${escapeHTML(highlightLine(h))}</small></div><button class="goldbtn hlwatch" data-action="watchHighlight" data-id="${h.id}">▶ İzle</button></div></div>`;
}

// ---- the archive screen ----
let archiveFilter = { playerId: ALL, type: ALL, season: ALL };

export function highlightOption(value, label, selected) { return `<option value="${escapeHTML(String(value))}" ${String(value) === String(selected) ? 'selected' : ''}>${escapeHTML(label)}</option>`; }

export function highlightFilterBar(all) {
  const players = [...new Map(all.map(h => [h.playerId, h.playerName])).entries()];
  const seasons = [...new Set(all.map(h => h.season))];
  const f = archiveFilter;
  return `<div class="card hlfilters"><label><span>Oyuncu</span><select data-action="highlightFilter" data-key="playerId">${highlightOption(ALL, `Tüm oyuncular (${players.length})`, f.playerId)}${players.map(([id, name]) => highlightOption(id, name, f.playerId)).join('')}</select></label>
<label><span>Tür</span><select data-action="highlightFilter" data-key="type">${highlightOption(ALL, 'Tüm türler', f.type)}${Object.entries(HIGHLIGHT_TYPE_LABELS).map(([k, l]) => highlightOption(k, l, f.type)).join('')}</select></label>
<label><span>Sezon</span><select data-action="highlightFilter" data-key="season">${highlightOption(ALL, 'Tüm sezonlar', f.season)}${seasons.map(s => highlightOption(s, s, f.season)).join('')}</select></label></div>`;
}

export function filteredHighlights() {
  const f = archiveFilter;
  return archiveView(list(), { playerId: f.playerId === ALL ? null : Number(f.playerId), type: f.type === ALL ? null : f.type, season: f.season === ALL ? null : f.season });
}

export function showHighlightArchive(filter) {
  if (filter) archiveFilter = { playerId: ALL, type: ALL, season: ALL, ...filter };
  const all = list(), shown = filteredHighlights();
  const empty = all.length ? 'Bu filtreyle highlight yok.' : 'Arşiv henüz boş. Yıldız transferleri, 3D maçta özel hareketler ve kaleci kurtarışları, yeni açılan hareketler buraya girer.';
  $('#app').innerHTML = `${header(['Kadro', 'openSquad'])}<h1>Highlight arşivi</h1><p class=muted>Kariyerin en iyi anları; her oyuncunun en iyi ${HIGHLIGHT_RULES.perPlayer} anı saklanır.</p>
${all.length ? highlightFilterBar(all) : ''}${shown.length ? shown.map(highlightRow).join('') : `<div class=card><p class=muted>${empty}</p></div>`}`;
  decorateMainScreen('squad');
}

export function setHighlightFilter(key, value) {
  if (!(key in archiveFilter)) return;
  archiveFilter = { ...archiveFilter, [key]: value };
  showHighlightArchive();
}

// the squad tab's way into the archive
export function highlightArchiveEntry() {
  const n = list().length;
  return `<button class="secondary hlentry" data-action="showHighlights">🎬 Highlight arşivi${n ? ` (${n})` : ''}</button>`;
}

// ---- his profile ----
export function profileHighlights(p) {
  const mine = archiveView(list(), { playerId: p.id });
  if (!mine.length) return `<div class="card hlprofile"><h3>Highlight'lar</h3><p class=muted>Henüz highlight yok.</p></div>`;
  const more = mine.length > PROFILE_SHOWS ? `<button class=ghost data-action="showHighlights" data-player="${p.id}">Tümü (${mine.length})</button>` : '';
  return `<div class="card hlprofile"><h3>Highlight'lar</h3>${mine.slice(0, PROFILE_SHOWS).map(h => `<div class="row between hlmini"><div><b>${escapeHTML(highlightMoveName(h.move))}</b><br><small>${HIGHLIGHT_TYPE_LABELS[h.type]} • ${escapeHTML(highlightLine(h))}</small></div><button class=ghost data-action="watchHighlight" data-id="${h.id}">▶ İzle</button></div>`).join('')}${more}</div>`;
}

// ---- the staff's note of a new move ----
export function inboxHighlightButton(message) {
  return message.highlight && list().some(h => h.id === message.highlight) ? `<button class="goldbtn hlwatch" data-action="watchHighlight" data-id="${escapeHTML(message.highlight)}">▶ İzle</button>` : '';
}

// ---- İzle ----
let sceneModule = null;

// what the scene needs to play a recipe: who (with his number now, if he is still ours), which stage, the seed
export function watchOptions(h) {
  const p = S.players.find(x => x.id === h.playerId), club = resolveClubIdentity('career');
  return {
    player: { id: typeof h.playerId === 'number' && h.playerId > 0 ? h.playerId : 990001, name: h.playerName, no: p?.number ?? 10, pos: h.pos, keeper: isKeeperPos(h.pos) },
    kind: stageKindFor(h), seed: h.seed, moveName: highlightMoveName(h.move), line: highlightLine(h), excite: 0.8,
    club: { name: club.name, primaryColor: clubColor(club.primaryColor) || '#c8102e', secondaryColor: clubColor(club.secondaryColor) || '#ffffff', shortName: club.shortName },
  };
}

export function watchHighlight(id) {
  const h = list().find(x => x.id === id);
  if (!h) return Promise.resolve(null);
  return (sceneModule ??= import('../../core/presentation/scenes/highlight-scene.js'))
    .then(m => m.playHighlightScene(watchOptions(h)))
    .then(r => { if (!r) alert('Bu cihazda 3D sahne açılamadı.'); return r; })
    .catch(e => { console.warn('Highlight izlenemedi', e); alert('Bu cihazda 3D sahne açılamadı.'); return null; });
}

defineActions({
  showHighlights: d => showHighlightArchive(d.player != null ? { playerId: d.player } : { playerId: ALL }),
  highlightFilter: (d, el) => setHighlightFilter(d.key, el.value),
  watchHighlight: d => watchHighlight(d.id),
});
