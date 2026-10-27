# ManagerStory V7.12.0

Offline-capable football management game for mobile browsers.
Live: https://rasimoner.github.io/ManagerStory/

## Commands

Node.js 22. No install is needed to play or to test: the game is plain ES modules in `dist`.

| Command | What it does |
|---|---|
| `npx serve dist` (or any static server on `dist`) | Play locally. Service workers need `localhost` or https. |
| `npm run dev` | The same through Vite's dev server (needs `npm install`). |
| `npm test` | Every test file, as many at a time as there are cores. It plays complete matches: about 12 minutes on 2 cores, less on more. Run it at the end of a piece of work and before main. |
| `npm run test:fast` | The quick check for each commit (under a minute): everything but the long whole-match engine, clock and 3D-director files, and the golden master on four fixtures. |
| `node tools/stamp-version.cjs` | After adding a module or an import, and after raising the version: stamps `?v=<version>` on every module address (`--check` only checks). |

Useful test switches:
- `GOLDEN_FIXTURES=3,7`, `NV_FIXTURES=0,1,2`, `CLOCK_FIXTURES=...` choose which matches the golden-master, 3D-director and clock tests play.
- `UPDATE_GOLDEN=1 node --test tests/<file>` rewrites a golden record after an intended change (review the diff).
- One file: `NODE_OPTIONS=--experimental-vm-modules node --test tests/<file>`.

Tests load the game the way the page does (`tests/support/game.cjs`): `index.html`'s module entries and everything
they import, in one VM context, and reach it by name through one access point. See `docs/architecture.md`.

## Build

There is no build step yet: `dist` is the application, published as it is. The move to Vite (sources in `src/`,
content-hashed files, the service-worker list generated from the build, data as `.json`, three.js from npm) is the
remaining part of refactor E (`docs/architecture.md`, "Kalan borçlar").

## Releasing

1. Raise the version in `package.json` and `package-lock.json`, and the labels the version test lists
   (`tests/version-labels.test.cjs`), then run `node tools/stamp-version.cjs`.
2. Write `docs/v<version>-release.md`.
3. `npm test`, then merge to `main`. The Publish ManagerStory workflow tests the game and publishes `dist` to GitHub Pages
   (Settings → Pages → source: GitHub Actions).

## Documents

- `docs/architecture.md`: layers, the dependency rule, hooks, the main flows.
- `docs/game-rules.md`: the match engine and the game's rules, for another engine (Godot).
- `docs/code-layout.md`: which file is where and why.
- `docs/save-format.md`: the save and its migrations.

## Career saves

Saves are local to the browser/site. Export your career from the old address
and import it at the new address before continuing play.
