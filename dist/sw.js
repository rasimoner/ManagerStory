const CACHE = "managerstory-v7.9.13-release-20261026b";
const ASSETS = [
  "./match3d-career.css", "./match3d-live-clock.js",
  "./match-view-adapter.js", "./vendor/three/three.module.min.js", "./vendor/three/three.core.min.js",
  "./match3d-newview.js", "./newview/runtime.js", "./newview/director.js", "./newview/actions.js", "./newview/footballer.js", "./newview/stadium.js", "./newview/rig.js", "./newview/camera.js", "./newview/replay.js", "./assets/models/footballer-rig.json", "./vendor/three/addons/effects/OutlineEffect.js",
  "./", "./index.html", "./style.css", "./app.js?v=7.9.13", "./nav.js?v=7.9.13", "./match-support.js?v=7.9.13", "./career-events.js?v=7.9.13", "./live-match.js?v=7.9.13", "./pitch-v73.js?v=7.9.13", "./pitch-v731.js?v=7.9.13", "./player-profiles.js?v=7.9.13", "./opponents-v731.js?v=7.9.13", "./season.js?v=7.9.13", "./manifest.json", "./webmcp.js?v=7.9.13", "./star-transfer.js?v=7.9.13", "./star-transfer-scene.js",
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
