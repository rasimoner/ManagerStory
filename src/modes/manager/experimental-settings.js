import { M, S } from '../../core/state.js';
import { save } from '../../core/save.js';
import { render } from './app.js';
import { defineActions } from '../../ui/actions.js';
import MATCH_DURATION_DATA from '../../data/match-duration.json';
import { validMatchDurationMinutes } from '../../core/match/duration-setting.js';

export function experimentalMatchSetting() {
  const locked = !!(M && !M.finished);
  const options = MATCH_DURATION_DATA.minutes.map(minutes => `<option value="${minutes}" ${S.matchDurationMinutes === minutes ? 'selected' : ''}>${minutes} dakika</option>`).join('');
  return `<section class=card data-experimental-setting><h2>Maç motoru</h2><label><input type=checkbox role=switch data-action="setExperimentalMatchEngine" ${S.experimentalMatchEngine ? 'checked' : ''} ${locked ? 'disabled' : ''}> Deneysel maç motoru (yeni, 2D)</label><p class=muted>${locked ? 'Maç sürerken değiştirilemez.' : 'Bir sonraki maçtan itibaren geçerlidir.'} Yeni motorda 3D yakında.</p><label for=match-duration>Maç süresi</label><select id=match-duration data-action="setMatchDurationMinutes">${options}</select><p class=muted>İki devrenin toplamı, normal 1× izleme içindir. 0,5× süreyi uzatır; 2× kısaltır. Duraklatma, devre arası ve taktik ekranında bekleme dahil değildir. Yalnız yeni motorla başlayan sonraki maçlarda geçerlidir; devam eden maçın süresi korunur.</p></section>`;
}

export function setExperimentalMatchEngine(enabled) {
  if (!S || (M && !M.finished)) return false;
  S.experimentalMatchEngine = !!enabled;
  save();
  render();
  return true;
}

export function setMatchDurationMinutes(minutes) {
  if (!S || !validMatchDurationMinutes(minutes)) return false;
  S.matchDurationMinutes = minutes;
  save();
  render();
  return true;
}

defineActions({ setExperimentalMatchEngine: (_data, element) => setExperimentalMatchEngine(element.checked),
  setMatchDurationMinutes: (_data, element) => setMatchDurationMinutes(Number(element.value)) });
