/* The page's one entry point (refactor C3): everything that happens when the game opens, in this order.
   Refactor D4: it also connects the mode that is playing to what core says (core/hooks.js): core never
   calls a mode.
   The game's modules, in the order they once loaded as scripts. They only declare (and register their
   actions, season-end steps and hooks); nothing in them runs on load. The presentation layers (the
   2D/3D clock, the view adapter, the 3D view) are their own entries in index.html and load after this. */
import './data/clubs.js?v=7.11.0';
import './data/squad.js?v=7.11.0';
import './data/names.js?v=7.11.0';
import './data/players.js?v=7.11.0';
import './data/tactics.js?v=7.11.0';
import './data/moves.js?v=7.11.0';
import './data/balance.js?v=7.11.0';
import './data/story.js?v=7.11.0';
import './core/random.js?v=7.11.0';
import './core/state.js?v=7.11.0';
import './core/presentation/registry.js?v=7.11.0';
import './core/save.js?v=7.11.0';
import './ui/actions.js?v=7.11.0';
import './core/hooks.js?v=7.11.0';
import './core/inbox.js?v=7.11.0';
import './core/engine/match-support.js?v=7.11.0';
import './modes/manager/career-events.js?v=7.11.0';
import './core/engine/live-match.js?v=7.11.0';
import './core/players/player-profiles.js?v=7.11.0';
import './core/players/moves.js?v=7.11.0';
import './core/clubs/clubs.js?v=7.11.0';
import './core/league/league.js?v=7.11.0';
import './core/league/opponents-v731.js?v=7.11.0';
import './core/season/season.js?v=7.11.0';
import './core/engine/pitch-v73.js?v=7.11.0';
import './core/engine/pitch-v731.js?v=7.11.0';
import './core/engine/match-minute.js?v=7.11.0';
import './core/engine/user-team.js?v=7.11.0';
import './modes/manager/match-panel.js?v=7.11.0';
import './modes/manager/match-career.js?v=7.11.0';
import './modes/manager/season-end.js?v=7.11.0';
import './modes/manager/app.js?v=7.11.0';
import './ui/nav.js?v=7.11.0';
import './modes/manager/star-transfer.js?v=7.11.0';
import './ui/webmcp.js?v=7.11.0';
import { setCareer } from './core/state.js?v=7.11.0';
import { onHook } from './core/hooks.js?v=7.11.0';
import { loadCareer } from './core/save.js?v=7.11.0';
import { installActions } from './ui/actions.js?v=7.11.0';
import { installBackgroundPause } from './core/engine/live-match.js?v=7.11.0';
import { init, openDecisionSheet, render, syncWonderOffers } from './modes/manager/app.js?v=7.11.0';
import { installNavigation } from './ui/nav.js?v=7.11.0';
import { installStarTransfer } from './modes/manager/star-transfer.js?v=7.11.0';
import { recordMatchEvent, recordMinutePlayed } from './modes/manager/match-career.js?v=7.11.0';
import { managerSeasonStarted } from './modes/manager/season-end.js?v=7.11.0';
import { installWebMcp } from './ui/webmcp.js?v=7.11.0';

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
installNavigation();
render();
installWebMcp();
