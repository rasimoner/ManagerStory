# ManagerStory V7.14.0

Offline-capable football management game for mobile browsers.
Live: https://rasimoner.github.io/ManagerStory/

Katkı kuralları: [AGENTS.md](AGENTS.md)

## Commands

Node.js 22. `npm ci` once (Vite, three.js, Playwright for the smoke test).

| Command | What it does |
|---|---|
| `npm run dev` | Play the sources through Vite's dev server (no service worker there). |
| `npm run build` | Build `dist/` (what GitHub Pages serves): content-hashed files under `dist/app/`, the service worker with this build's file list. `dist/` is not in the repository. |
| `npm run preview` | Serve the build at `/ManagerStory/`, as GitHub Pages does. |
| `npm run lint` | ESLint (`eslint.config.js`) held to `lint-baseline.json`: a new violation fails; fewer violations tighten the baseline (commit it). In CI a baseline that could be tighter fails. |
| `npm test` | Every test file, as many at a time as there are cores. It plays complete matches: about 12 minutes on 2 cores, less on more. Run it at the end of a piece of work and before main. |
| `npm run test:fast` | The quick check for each commit (under a minute): everything but the long whole-match engine, clock and 3D-director files, and the golden master on four fixtures. |
| `npm run smoke` | After `npm run build`: the build in Chromium, served like GitHub Pages (opens, main screens, old and new saves, season end, 3D match, new-release notice, offline). `SMOKE_CHROMIUM=<path>` uses another Chromium; `npx playwright install chromium` gets Playwright's. |

Useful test switches:
- `GOLDEN_FIXTURES=3,7`, `NV_FIXTURES=0,1,2`, `CLOCK_FIXTURES=...` choose which matches the golden-master, 3D-director and clock tests play.
- `UPDATE_GOLDEN=1 node --test tests/<file>` rewrites a golden record after an intended change (review the diff).
- One file: `NODE_OPTIONS=--experimental-vm-modules node --test tests/<file>`.

Tests load the game from the sources the way the page does (`tests/support/game.cjs`): `src/index.html`'s module entries and
everything they import (the JSON data too), in one VM context, and reach it by name through one access point. The tests
about what is published (the service worker's list, the page title, the manifest) build into a temporary folder
(`tests/support/build.cjs`). See `docs/architecture.md`.

## Layout

- `src/`: the page, the game's ES modules, the data (`src/data/*.json`, described in `src/data/README.md`), the style sheet, the service-worker template.
- `public/`: published as they are: the pictures the screens name by path, icons, the web manifest.
- `vite.config.js`: the build (base `/ManagerStory/`, hashed files, the version, the service worker and its list).
- `tests/`: the tests; `tests/smoke/` the browser smoke test and a GitHub-Pages-like server.

## Releasing

1. `npm version <x.y.z> --no-git-tag-version` (package.json and the lock file; the game, page title, manifest and service
   worker take the version from package.json), and the README title.
2. Write `docs/v<version>-release.md`.
3. `npm run lint`, `npm test`, `npm run build`, `npm run smoke`, then merge to `main`. The Publish ManagerStory workflow lints
   and tests the sources, builds, smoke-tests the build and publishes `dist` to GitHub Pages (Settings → Pages → source: GitHub Actions).

## Documents

- `docs/architecture.md`: layers, the dependency rule, hooks, the main flows.
- `docs/game-rules.md`: the match engine and the game's rules, for another engine (Godot).
- `docs/code-layout.md`: which file is where and why.
- `docs/save-format.md`: the save and its migrations.

## Career saves

Saves are local to the browser/site. Export your career from the old address
and import it at the new address before continuing play.
