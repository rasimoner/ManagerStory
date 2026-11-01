# ManagerStory V7.19.5

Offline-capable football management game for mobile browsers.
Live: https://rasimoner.github.io/ManagerStory/

V7.19.5 (candidate, not published): box marking stays available during crosses; keepers reject unreachable cross interceptions. Fifty-seed goals decreased from 10.30 to 8.62, while short-match goals increased. Balance verification remains open. [Continuation report](docs/goal-regression-continuation-report.md).

V7.19.4 (candidate, not published): crosses prioritize central receivers for box marking. Fifty-seed goals decreased from 16.92 to 10.30, but balance verification still fails. [Goal regression report](docs/goal-regression-report.md).

V7.19.3 (unpublished candidate): physical crosses, aerial contacts, distinct skills, special passes and recorded automatic replays. [Remaining parity report](docs/3d-remaining-parity-report.md).

V7.19.2: second-half preparation pauses the match clock; aerial first controls preserve ball height, physical restarts wait for placement, and observed dribble moves use the restored 3D actions. [Release notes](docs/v7.19.2-release.md).

V7.19.0: the experimental career 3D view now animates goalkeeper push-off, full-body extension, landing, hand/knee support and standing. Both views share the same match, physical clock and unchanged football. Opt in through Ayarlar → **Deneysel maç motoru**, then Saha → **3D**. The switch defaults off. [Release notes](docs/v7.19.0-release.md) · [Keeper animation report and phone checklist](docs/match-sim-keeper-animation-report.md).

Katkı kuralları: [AGENTS.md](AGENTS.md)

## Commands

Node.js 22. `npm ci` once (Vite, three.js, Playwright for the smoke test).

| Command | What it does |
|---|---|
| `npm run smoke:keeper-animation` | Real WebGL goalkeeper videos and frame sequences in both phone orientations; isolated engine scenarios and ordinary career evidence |
| `npm run dev` | Play the sources through Vite's dev server (no service worker there). |
| `npm run build` | Build `dist/` (what GitHub Pages serves): content-hashed files under `dist/app/`, the service worker with this build's file list. `dist/` is not in the repository. |
| `npm run preview` | Serve the build at `/ManagerStory/`, as GitHub Pages does. |
| `npm run lint` | ESLint (`eslint.config.js`) held to `lint-baseline.json`: a new violation fails; fewer violations tighten the baseline (commit it). In CI a baseline that could be tighter fails. |
| `npm test` | Every test file, as many at a time as there are cores. It plays complete matches: about 12 minutes on 2 cores, less on more. Run it at the end of a piece of work and before main. |
| `npm run test:fast` | The quick check for each commit (under a minute): everything but the long whole-match engine, clock and 3D-director files, and the golden master on four fixtures. |
| `npm run smoke` | After `npm run build`: 12 legacy checks, laboratory checks, experimental career decisions/reload/skip and a complete real-time 1× mobile watch (6–10 minute target). `CAREER_CONTROLS_ONLY=1` omits the complete watch when another CI job already verifies it. `SMOKE_CHROMIUM=<path>` uses another Chromium; `npx playwright install chromium` gets Playwright's. |
| `npm run sim:report` | Replay 50 laboratory seeds, including the high-score tail diagnosis; `-- --strength` also runs the attribute experiments. |
| `npm run sim:career-report` | Play all 34 user fixtures through the actual career, repeat with +10 attributes, and record season outcomes, fitness, ratings and storage size. |

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
