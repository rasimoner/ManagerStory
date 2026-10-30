import { M } from '../../state.js';
import { changed } from '../../hooks.js';

const notices = new WeakMap();
let loadingFailure = null;

export function simulationViewNotice() { return M ? notices.get(M) ?? '' : ''; }
export function simulationViewFailure() { return loadingFailure; }

export function fallbackSimulationView(error) {
  console.warn('Experimental 3D view unavailable.', error);
  loadingFailure = error;
  if (!M?.experimental) return;
  notices.set(M, '3D saha açılamadı. Aynı maç 2D görünümünde devam ediyor; saat, sonuç ve kayıt korunuyor.');
  M.fieldView = '2d';
  changed();
}
