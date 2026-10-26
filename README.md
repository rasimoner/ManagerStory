# ManagerStory V7.9.13

Offline-capable football management game for mobile browsers.

## GitHub Pages

Push these project files to the `main` branch of `rasimoner/ManagerStory`.
In repository Settings → Pages, select **GitHub Actions** as the source.
The Publish ManagerStory workflow tests the game and publishes `dist`.
Expected URL: https://rasimoner.github.io/ManagerStory/

No build step is needed: `dist` contains the editable application and assets.

## Tests

Run `npm test` with Node.js 22: every test file, as many at a time as there are cores (it plays complete
matches: about 8 minutes on 2 cores, less on more). `npm run test:fast` is the quick check for each commit
(about a minute): everything but the long whole-match engine, clock and 3D-director files, and the golden
master on four fixtures.
`NV_FIXTURES=0,1,2` and `CLOCK_FIXTURES=...` choose which matches the new-view and clock tests play.
Tests load the game through `tests/support/game.cjs`: the scripts `index.html` loads, in its order
(scripts tagged `data-layer` only when a test asks for them). Moving a script only needs `index.html` updated.

## Career saves

Saves are local to the browser/site. Export your career from the old address
and import it at the new address before continuing play.
