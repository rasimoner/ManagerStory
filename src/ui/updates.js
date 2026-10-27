/* Offline play and new releases (refactor E3). The built game registers its service worker (dist/sw.js, written by
   the build from src/sw.js with the build's own file list). Each release's worker takes over the open page as soon
   as it has cached the release (skipWaiting, clients.claim); the page keeps running the code it opened with until
   it is reloaded. So when a new worker takes over a page that already had one, the page says so: "Yeni sürüm
   hazır" with a button that saves the career and reloads into the new release. The first worker (a first visit)
   brings nothing new and says nothing.
   Only in the build: the dev server serves the sources, and the test harness has no navigator. */
import { defineActions } from './actions.js';
import { S } from '../core/state.js';
import { save } from '../core/save.js';

export function installServiceWorker() {
  if (!import.meta.env?.PROD || typeof navigator === 'undefined' || !navigator.serviceWorker) return;
  const updating = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (updating) showUpdateNotice(); });
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
    .catch(error => console.warn("Çevrimdışı hazırlık tamamlanamadı.", error));
}

// outside #app, so the screens drawn after it keep it
export function showUpdateNotice() {
  if (document.querySelector('.updatenotice')) return;
  document.body.insertAdjacentHTML('beforeend', `<div class=updatenotice role=status><span>Yeni sürüm hazır</span><button data-action="reloadForUpdate">Yenile</button></div>`);
}

defineActions({
  reloadForUpdate: () => { if (S) save(); location.reload(); },
});
