import { M } from '../../core/state.js';
import { skipExperimentalMatch } from '../../core/engine/experimental-match.js';
import { resumeLive } from '../../core/engine/live-match.js';
import { save } from '../../core/save.js';
import { changed } from '../../core/hooks.js';
import { defineActions } from '../../ui/actions.js';

export function experimentalSkipControl() {
  if (!M.experimental || M.finished) return '';
  return '<button class=secondary data-action="skipExperimentalMatch">⏩ Maçı sonuna geç</button>';
}

function requestExperimentalSkip() {
  if (!skipExperimentalMatch()) return;
  if (M.pause && M.reason !== 'half') resumeLive();
  save();
  changed();
}

defineActions({ skipExperimentalMatch: requestExperimentalSkip });
