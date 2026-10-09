const CACHE = "managerstory-v7.4.2-team-flow-20261010";
const ASSETS = [
  "./match3d-career.js", "./match3d-career.css", "./match3d-live-clock.js", "./match3d-live-view.js",
  "./match3d-pass-timeline.js", "./match3d-football-pose.js", "./match3d-keeper.js", "./match3d-net.js", "./match3d-pass-replay.js", "./match3d-pass-recordings.json",
  "./match3d-scene.js", "./match3d-player.js", "./match3d-dev.css",
  "./match-view-adapter.js", "./match3d-dev.js", "./vendor/three/three.module.min.js", "./vendor/three/three.core.min.js",
  "./", "./index.html", "./style.css", "./app.js?v=7.4.2", "./match-support.js?v=7.4.2", "./career-events.js?v=7.4.2", "./live-match.js?v=7.4.2", "./pitch-v73.js?v=7.4.2", "./pitch-v731.js?v=7.4.2", "./opponents-v731.js?v=7.4.2", "./manifest.json", "./webmcp.js?v=7.4.2",
  "./apple-touch-icon.png", "./icon-192.png", "./icon-512.png",
  "./assets/stadium.jpg", "./assets/training.jpg", "./assets/office.jpg",
  "./assets/fans.jpg", "./assets/press.jpg",
  "./assets/cinematics/press_room.gif", "./assets/cinematics/academy_training.gif",
  "./assets/cinematics/goal_2.gif", "./assets/cinematics/goal_1.gif",
  "./assets/cinematics/star_welcome.gif", "./assets/cinematics/signing.gif",
  "./assets/cinematics/star_welcome_still.jpg", "./assets/cinematics/signing_still.jpg",
  "./assets/atmosphere/stadium-base.webp", "./assets/atmosphere/press-club-base.webp", "./assets/atmosphere/press-club-a.webp", "./assets/atmosphere/press-club-b.webp", "./assets/atmosphere/press-club-shade.webp", "./assets/atmosphere/locker-club-base.webp", "./assets/atmosphere/locker-club-a.webp", "./assets/atmosphere/locker-club-b.webp", "./assets/atmosphere/locker-club-shade.webp", "./assets/atmosphere/stadium-club-a.webp", "./assets/atmosphere/stadium-club-b.webp", "./assets/atmosphere/stadium-club-shade.webp", "./assets/atmosphere/press-base.webp", "./assets/atmosphere/office-base.webp",
  "./assets/atmosphere/fans-neutral.webp", "./assets/atmosphere/fans-day.webp", "./assets/atmosphere/fans-rain.webp", "./assets/atmosphere/fans-night.webp",
  "./assets/atmosphere/training-base.webp", "./assets/atmosphere/signing-base.webp", "./assets/atmosphere/facilities-base.webp", "./assets/atmosphere/locker-base.webp",
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
