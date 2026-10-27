/* The page's one entry point (refactor C3): everything that happens when the game opens, in this order.
   The game's modules, in the order they once loaded as scripts. They only declare (and register their
   actions, season-end steps and hooks); nothing in them runs on load. The presentation layers (the
   2D/3D clock, the view adapter, the 3D view) are their own entries in index.html and load after this. */
import './data/clubs.js';
import './data/squad.js';
import './data/names.js';
import './data/players.js';
import './data/tactics.js';
import './data/moves.js';
import './data/balance.js';
import './data/story.js';
import './core/random.js';
import './core/state.js';
import './core/presentation/registry.js';
import './core/save.js';
import './ui/actions.js';
import './core/hooks.js';
import './core/engine/match-support.js';
import './modes/manager/career-events.js';
import './core/engine/live-match.js';
import './core/players/player-profiles.js';
import './core/clubs/clubs.js';
import './core/league/league.js';
import './core/league/opponents-v731.js';
import './core/season/season.js';
import './core/engine/pitch-v73.js';
import './core/engine/pitch-v731.js';
import './modes/manager/app.js';
import './ui/nav.js';
import './modes/manager/star-transfer.js';
import './ui/webmcp.js';
import { setCareer } from './core/state.js';
import { loadCareer } from './core/save.js';
import { installActions } from './ui/actions.js';
import { installBackgroundPause } from './core/engine/live-match.js';
import { render } from './modes/manager/app.js';
import { installNavigation } from './ui/nav.js';
import { installStarTransfer } from './modes/manager/star-transfer.js';
import { installWebMcp } from './ui/webmcp.js';

setCareer(loadCareer());
installActions();
installBackgroundPause();
installStarTransfer();
installNavigation();
render();
installWebMcp();
