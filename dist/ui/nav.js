/* V7.9.5 navigation: one behaviour for every menu screen.
   - Detail screens put their back button in the sticky header (header(['Kadro', 'openSquad']), an action name),
     so going back is one tap wherever you are on the page. Tab roots have no back button: the tab bar is the way out.
   - Going back returns to where you were on the list; opening a new screen starts at the top.
   - Tapping the active tab: on its root it scrolls to the top, on one of its detail screens it returns to the root.
   - After a short scroll (360px at most) an "up" button appears bottom right, above the tab bar and the decision tray.
   Browser only: without a document (the test harness) it installs nothing. main.js installs it.
   It works through extension points (core/hooks.js): goMain, navBack and screenDrawn. */
import { S } from '../core/state.js?v=7.10.0';
import { onHook } from '../core/hooks.js?v=7.10.0';
export function installNavigation() {
  if (typeof document === 'undefined' || !document.addEventListener) return;
  const NAV = { key: null, y: 0, saved: {}, back: false, queued: false };
  const inMatch = () => document.body.classList.contains('in-match');
  const careerOpen = () => typeof S !== 'undefined' && !!S;
  const activeTab = () => document.querySelector('.bottomnav button.active')?.dataset.tab || 'none';
  const backButton = () => document.querySelector('.hisarhead .navback');

  const top = document.createElement('button');
  top.type = 'button';
  top.className = 'navtop';
  top.setAttribute('aria-label', 'En üste çık');
  top.innerHTML = '<span aria-hidden="true">↑</span>';
  top.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  document.body.appendChild(top);

  function placeTop() {
    const show = careerOpen() && !inMatch() && window.scrollY > Math.min(360, window.innerHeight * 0.45);
    top.classList.toggle('show', show);
    if (!show) return;
    // sit just above whatever is fixed at the bottom: the decision tray on the home screen, otherwise the tab bar
    const edges = ['.decisiontray', '.bottomnav'].map(q => document.querySelector(q)?.getBoundingClientRect().top).filter(Number.isFinite);
    const edge = edges.length ? Math.min(...edges) : window.innerHeight;
    top.style.bottom = Math.max(16, window.innerHeight - edge + 12) + 'px';
  }

  // a screen is a tab root, or a detail screen identified by where its back button leads and its title
  function screenKey() {
    const back = backButton();
    if (!back) return 'root:' + activeTab();
    const title = document.querySelector('#app h1')?.textContent.trim() || '';
    return 'detail:' + back.dataset.to + ':' + (back.dataset.id ?? '') + '|' + title;
  }

  function settle() {
    NAV.queued = false;
    if (inMatch() || !careerOpen()) { NAV.key = null; NAV.back = false; placeTop(); return; }
    const key = screenKey();
    if (key !== NAV.key) {
      if (NAV.key) NAV.saved[NAV.key] = NAV.y;
      const y = NAV.back && NAV.saved[key] != null ? NAV.saved[key] : 0;
      NAV.key = key;
      window.scrollTo(0, y);
      NAV.y = y;
    }
    // the same screen drawn again (a choice, a training focus) keeps its scroll position
    NAV.back = false;
    placeTop();
  }

  // a screen is being drawn (header() says so); settle once it is on the page
  function queue() {
    if (NAV.queued) return;
    NAV.queued = true;
    queueMicrotask(settle);
  }

  onHook('navBack', () => { NAV.back = true; });

  // tapping a tab: true when it is dealt with here (its root is already on screen: scroll to the top)
  onHook('goMain', section => {
    if (careerOpen() && !inMatch() && section === activeTab()) {
      if (backButton()) { NAV.back = false; NAV.saved['root:' + section] = 0; return false; }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return true;
    }
    NAV.back = false;
    return false;
  });

  window.addEventListener('scroll', () => { NAV.y = window.scrollY; placeTop(); }, { passive: true });
  window.addEventListener('resize', placeTop, { passive: true });
  onHook('screenDrawn', queue);
  queue();
}
