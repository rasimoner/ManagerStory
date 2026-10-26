/* The page's one entry point (refactor C3): everything that happens when the game opens, in this order.
   Every other script only declares (and registers its actions, season steps and hooks); nothing else
   runs on load. The presentation layers (2D/3D clock, view adapter, 3D view) load after this. */
S = loadCareer();
installActions();
installBackgroundPause();
installStarTransfer();
installNavigation();
render();
installWebMcp();
