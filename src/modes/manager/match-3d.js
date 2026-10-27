/* The match screen's 3D view (refactor C3; was an inline script in index.html). Loads after the game;
   if the 3D view cannot load (no WebGL, a failed download), the match goes on in 2D. */
import { M } from '../../core/state.js';
import { render } from './app.js';

import('../../core/presentation/match3d/match3d-newview.js').catch(error => {
  console.warn('3D saha yüklenemedi.', error);
  if (M) { M.fieldView = '2d'; render(); }
});
