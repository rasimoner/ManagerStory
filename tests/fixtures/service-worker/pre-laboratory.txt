/* The service worker: the game plays offline (refactor E3). This is a template, not a module of the page: the
   build (vite.config.js, the serviceWorker plugin) writes dist/sw.js as three constants and then this file:
     RELEASE  package.json's version
     BUILD    a short hash of the build's file list (every hashed file name changes with its content)
     ASSETS   every file the build published, but the worker itself and the few on purpose not cached
              (vite.config.js NOT_CACHED), as addresses relative to the worker; "./" first (the page)
   So the list is never written by hand (V7.9.13: newview/replay.js was missing from it, and the 3D match could
   not load offline), and every build has its own cache (managerstory-v<RELEASE>-<BUILD>). */
/* global RELEASE, BUILD, ASSETS */
const CACHE = `managerstory-v${RELEASE}-${BUILD}`;

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

/* Only this build's scripts are ever served. A script outside its list can only be asked for by an older
   release's page still open in a tab: it loads the 3D match view and the star transfer scene on demand. Since the
   build every script's name carries a hash of its content, so another release's script is never one of these
   names: a V7.10.0 page's plain main.js or core/…, a V7.11.0 or V7.12.0 page's ?v=<its release> (V7.11.0 and
   V7.12.0 rules), an older build's app/…-<hash>.js. Serving the file now at that path (if any) would load a newer
   copy of the game next to the old one, with its own state; fail it instead, and the old page falls back (2D
   match, photo scene) until it is reopened as this release. */
const SCOPE = new URL(self.registration.scope).pathname;
const OWN_SCRIPTS = new Set(ASSETS.filter(url => url.endsWith(".js")).map(url => new URL(url, self.location).pathname));
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith(SCOPE) && url.pathname.endsWith(".js") && !OWN_SCRIPTS.has(url.pathname)) {
    event.respondWith(Response.error());
    return;
  }
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
