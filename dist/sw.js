const CACHE = "managerstory-v7.9.13-refactor-c3";
const ASSETS = [
  "./core/presentation/match3d/match3d-career.css", "./core/presentation/match3d/match3d-live-clock.js",
  "./core/presentation/match3d/match-view-adapter.js", "./vendor/three/three.module.min.js", "./vendor/three/three.core.min.js",
  "./core/presentation/match3d/match3d-newview.js", "./core/presentation/match3d/newview/runtime.js", "./core/presentation/match3d/newview/director.js", "./core/presentation/match3d/newview/actions.js", "./core/presentation/match3d/newview/footballer.js", "./core/presentation/match3d/newview/stadium.js", "./core/presentation/match3d/newview/rig.js", "./core/presentation/match3d/newview/camera.js", "./core/presentation/match3d/newview/replay.js", "./assets/models/footballer-rig.json", "./vendor/three/addons/effects/OutlineEffect.js",
  "./", "./index.html", "./style.css", "./data/clubs.js?v=7.9.13", "./data/squad.js?v=7.9.13", "./data/names.js?v=7.9.13", "./data/players.js?v=7.9.13", "./data/tactics.js?v=7.9.13", "./data/moves.js?v=7.9.13", "./data/balance.js?v=7.9.13", "./data/story.js?v=7.9.13", "./core/random.js?v=7.9.13", "./core/save.js?v=7.9.13", "./ui/actions.js?v=7.9.13", "./core/hooks.js?v=7.9.13", "./modes/manager/app.js?v=7.9.13", "./ui/nav.js?v=7.9.13", "./core/engine/match-support.js?v=7.9.13", "./modes/manager/career-events.js?v=7.9.13", "./core/engine/live-match.js?v=7.9.13", "./core/engine/pitch-v73.js?v=7.9.13", "./core/engine/pitch-v731.js?v=7.9.13", "./core/players/player-profiles.js?v=7.9.13", "./core/league/opponents-v731.js?v=7.9.13", "./core/season/season.js?v=7.9.13", "./manifest.json", "./ui/webmcp.js?v=7.9.13", "./main.js?v=7.9.13", "./modes/manager/star-transfer.js?v=7.9.13", "./core/presentation/scenes/star-transfer-scene.js",
  "./apple-touch-icon.png", "./icon-192.png", "./icon-512.png",
  "./assets/atmosphere/stadium-base.webp", "./assets/atmosphere/press-club-base.webp", "./assets/atmosphere/press-club-a.webp", "./assets/atmosphere/press-club-b.webp", "./assets/atmosphere/press-club-shade.webp", "./assets/atmosphere/locker-club-base.webp", "./assets/atmosphere/locker-club-a.webp", "./assets/atmosphere/locker-club-b.webp", "./assets/atmosphere/locker-club-shade.webp", "./assets/atmosphere/stadium-club-a.webp", "./assets/atmosphere/stadium-club-b.webp", "./assets/atmosphere/stadium-club-shade.webp", "./assets/atmosphere/office-base.webp",
  "./assets/atmosphere/fans-neutral.webp",
  "./assets/atmosphere/training-base.webp", "./assets/atmosphere/signing-base.webp", "./assets/atmosphere/facilities-base.webp",
  ...Array.from({length:18},(_,i)=>`./assets/atmosphere/goal-club-${i}.webp`),
  ...Array.from({length:18},(_,i)=>`./assets/atmosphere/office-club-${i}.webp`)
];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith("managerstory-") && key !== CACHE).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
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
