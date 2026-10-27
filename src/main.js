/* The page's one entry point (refactor C3): everything that happens when the game opens, in this order.
   Refactor D4: it also connects the mode that is playing to what core says (core/hooks.js): core never
   calls a mode.
   The game's modules, in the order they once loaded as scripts (the data they read comes with them as JSON
   modules, refactor E4). They only declare (and register their
   actions, season-end steps and hooks); nothing in them runs on load. The presentation layers (the
   2D/3D clock, the view adapter, the 3D view) are their own entries in index.html and load after this. */
import './core/random.js';
import './core/state.js';
import './core/presentation/registry.js';
import './core/save.js';
import './ui/actions.js';
import './core/hooks.js';
import './core/inbox.js';
import './core/engine/match-support.js';
import './modes/manager/career-events.js';
import './core/engine/live-match.js';
import './core/players/player-profiles.js';
import './core/players/moves.js';
import './core/clubs/clubs.js';
import './core/league/league.js';
import './core/league/opponents-v731.js';
import './core/season/season.js';
import './core/engine/pitch-v73.js';
import './core/engine/pitch-v731.js';
import './core/engine/match-minute.js';
import './core/engine/user-team.js';
import './modes/manager/match-panel.js';
import './modes/manager/match-career.js';
import './modes/manager/season-end.js';
import './modes/manager/app.js';
import './ui/nav.js';
import './modes/manager/star-transfer.js';
import './modes/manager/highlight-recorder.js';
import './ui/webmcp.js';
import './ui/updates.js';
import { setCareer } from './core/state.js';
import { onHook } from './core/hooks.js';
import { loadCareer } from './core/save.js';
import { installActions } from './ui/actions.js';
import { installBackgroundPause } from './core/engine/live-match.js';
import { init, openDecisionSheet, render, syncWonderOffers } from './modes/manager/app.js';
import { installNavigation } from './ui/nav.js';
import { installStarTransfer } from './modes/manager/star-transfer.js';
import { installHighlightRecorder } from './modes/manager/highlight-recorder.js';
import { recordMatchEvent, recordMinutePlayed } from './modes/manager/match-career.js';
import { managerSeasonStarted } from './modes/manager/season-end.js';
import { installWebMcp } from './ui/webmcp.js';
import { installServiceWorker } from './ui/updates.js';

// the manager mode is the one playing: core tells it when to redraw and when a career has been put in place
onHook('changed', render);
onHook('careerOpened', init);
onHook('decisionsRequested', openDecisionSheet);
onHook('opponentsEvolved', syncWonderOffers);
onHook('matchEvent', recordMatchEvent);
onHook('minutePlayed', recordMinutePlayed);
onHook('seasonStarted', managerSeasonStarted);
setCareer(loadCareer());
installActions();
installBackgroundPause();
installStarTransfer();
installHighlightRecorder();
installNavigation();
render();
installWebMcp();
installServiceWorker();
