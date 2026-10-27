const RELEASE = "7.12.0";
const CACHE = "managerstory-v7.12.0-refactor";
const ASSETS = [
  // the page's module entries (with the release cache-buster) and every module they import
  "./main.js?v=7.12.0", "./core/presentation/match3d/match3d-live-clock.js?v=7.12.0", "./core/presentation/match3d/match-view-adapter.js?v=7.12.0", "./modes/manager/match-3d.js?v=7.12.0", "./core/engine/live-match.js?v=7.12.0", "./core/engine/match-minute.js?v=7.12.0", "./core/engine/match-support.js?v=7.12.0", "./core/engine/pitch-v73.js?v=7.12.0", "./core/engine/pitch-v731.js?v=7.12.0", "./core/engine/user-team.js?v=7.12.0", "./core/clubs/clubs.js?v=7.12.0", "./core/hooks.js?v=7.12.0", "./core/inbox.js?v=7.12.0", "./core/league/league.js?v=7.12.0", "./core/league/opponents-v731.js?v=7.12.0", "./core/players/moves.js?v=7.12.0", "./core/players/player-profiles.js?v=7.12.0", "./core/presentation/match3d/match3d-newview.js?v=7.12.0", "./core/presentation/match3d/newview/actions.js?v=7.12.0", "./core/presentation/match3d/newview/camera.js?v=7.12.0", "./core/presentation/match3d/newview/director.js?v=7.12.0", "./core/presentation/match3d/newview/footballer.js?v=7.12.0", "./core/presentation/match3d/newview/replay.js?v=7.12.0", "./core/presentation/match3d/newview/rig.js?v=7.12.0", "./core/presentation/match3d/newview/runtime.js?v=7.12.0", "./core/presentation/match3d/newview/stadium.js?v=7.12.0", "./core/presentation/registry.js?v=7.12.0", "./core/presentation/scenes/star-transfer-scene.js?v=7.12.0", "./core/clubs/club-style.js?v=7.12.0", "./core/engine/tactics.js?v=7.12.0", "./core/league/rivals.js?v=7.12.0", "./core/players/move-names.js?v=7.12.0", "./core/version.js?v=7.12.0", "./modes/manager/lineup-slots.js?v=7.12.0", "./modes/manager/market-names.js?v=7.12.0", "./core/random.js?v=7.12.0", "./core/save.js?v=7.12.0", "./core/season/season.js?v=7.12.0", "./core/state.js?v=7.12.0", "./data/balance.js?v=7.12.0", "./data/clubs.js?v=7.12.0", "./data/moves.js?v=7.12.0", "./data/names.js?v=7.12.0", "./data/players.js?v=7.12.0", "./data/squad.js?v=7.12.0", "./data/story.js?v=7.12.0", "./data/tactics.js?v=7.12.0", "./modes/manager/app.js?v=7.12.0", "./modes/manager/career-events.js?v=7.12.0", "./modes/manager/match-career.js?v=7.12.0", "./modes/manager/match-panel.js?v=7.12.0", "./modes/manager/season-end.js?v=7.12.0", "./modes/manager/star-transfer.js?v=7.12.0", "./ui/actions.js?v=7.12.0", "./ui/nav.js?v=7.12.0", "./ui/webmcp.js?v=7.12.0",
  "./core/presentation/match3d/match3d-career.css", "./vendor/three/three.module.min.js", "./vendor/three/three.core.min.js", "./assets/models/footballer-rig.json", "./vendor/three/addons/effects/OutlineEffect.js", "./", "./index.html", "./style.css", "./manifest.json", "./apple-touch-icon.png", "./icon-192.png", "./icon-512.png", "./assets/atmosphere/stadium-base.webp", "./assets/atmosphere/press-club-base.webp", "./assets/atmosphere/press-club-a.webp", "./assets/atmosphere/press-club-b.webp", "./assets/atmosphere/press-club-shade.webp", "./assets/atmosphere/locker-club-base.webp", "./assets/atmosphere/locker-club-a.webp", "./assets/atmosphere/locker-club-b.webp", "./assets/atmosphere/locker-club-shade.webp", "./assets/atmosphere/stadium-club-a.webp", "./assets/atmosphere/stadium-club-b.webp", "./assets/atmosphere/stadium-club-shade.webp", "./assets/atmosphere/office-base.webp", "./assets/atmosphere/fans-neutral.webp", "./assets/atmosphere/training-base.webp", "./assets/atmosphere/signing-base.webp", "./assets/atmosphere/facilities-base.webp",
  ...Array.from({length:18},(_,i)=>`./assets/atmosphere/goal-club-${i}.webp`),
  ...Array.from({length:18},(_,i)=>`./assets/atmosphere/office-club-${i}.webp`)
];
// V7.10.0: fetch the list past the browser's HTTP cache. GitHub Pages lets the browser keep a file ~10 minutes,
// so right after a release a plain addAll could store the old index.html (or another old file) under the new
// cache key, and the new page would then ask for files that are gone or mix old and new code.
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS.map(url => new Request(url, { cache: "reload" }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith("managerstory-") && key !== CACHE).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});
// V7.11.0: every game module is asked for with ?v=<release> (tools/stamp-version.cjs). One asked for by its plain path
// (a V7.10.0 page) or with another release's ?v= (a V7.11.0 page, from V7.12.0 on) comes from an older release's page
// still open in a tab: it loads the 3D match view and the star transfer scene on demand. The file at that path is now
// this release's, and so are the modules it imports: serving it would load a second, newer copy of the game (its own
// state, save, data) next to the old one. Fail it instead; the old page falls back (2D match, photo scene) until it is
// reopened as this release. (Content-hashed file names, once there is a build, replace the stamp and this rule.)
const OLD_PAGE_MODULE = /^(?:main\.js|(?:core|modes|ui|data)\/.+\.js)$/;
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  const local = url.pathname.slice(new URL(self.registration.scope).pathname.length);
  if (OLD_PAGE_MODULE.test(local) && url.searchParams.get("v") !== RELEASE) { event.respondWith(Response.error()); return; }
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(event.request);
    if (cached) return cached;
    try {
      return await fetch(event.request);
    } catch (error) {
      if (event.request.mode === "navigate") {
        const index = await cache.match("./index.html");
        if (index) return index;
      }
      throw error;
    }
  }));
});
