import { M, S } from '../../core/state.js';
import { save } from '../../core/save.js';
import { render } from './app.js';
import { defineActions } from '../../ui/actions.js';

export function experimentalMatchSetting() {
  const locked = !!(M && !M.finished);
  return `<section class=card data-experimental-setting><h2>Maç motoru</h2><label><input type=checkbox role=switch data-action="setExperimentalMatchEngine" ${S.experimentalMatchEngine ? 'checked' : ''} ${locked ? 'disabled' : ''}> Deneysel maç motoru (yeni, 2D)</label><p class=muted>${locked ? 'Maç sürerken değiştirilemez.' : 'Bir sonraki maçtan itibaren geçerlidir.'} Yeni motorda 3D yakında.</p></section>`;
}

export function setExperimentalMatchEngine(enabled) {
  if (!S || (M && !M.finished)) return false;
  S.experimentalMatchEngine = !!enabled;
  save();
  render();
  return true;
}

defineActions({ setExperimentalMatchEngine: (_data, element) => setExperimentalMatchEngine(element.checked) });
