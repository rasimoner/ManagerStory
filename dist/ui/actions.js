/* Refactor C2: every button, link and form control on the page is wired through one delegated dispatcher.
   A screen writes what an element does as a named action and the values it needs as data-* attributes:
     <button data-action="showPlayerProfile" data-id="12">
   and the file that draws the screen registers what that name does:
     defineActions({ showPlayerProfile: d => showPlayerProfile(+d.id) });
   An action gets (data, element, event): data is the element's dataset (strings; the action converts them).
   Buttons and other elements act on click; form controls (select, input, textarea) act on change.
   Like the inline handlers this replaces, an action runs on every element with one between the clicked
   element and the page, innermost first, along the path the click took (composedPath). No inline on*
   handlers: nothing on the page needs a function to be global for an attribute to reach it.
   In the test harness there is no real document: tests call runAction (or loadGame().click) directly. */
const ACTIONS = Object.create(null);
const FORM_CONTROLS = new Set(['SELECT', 'INPUT', 'TEXTAREA']);

function defineActions(table) {
  for (const [name, run] of Object.entries(table)) {
    if (name in ACTIONS) throw new Error(`action "${name}" is defined twice`);
    if (typeof run !== 'function') throw new Error(`action "${name}" is not a function`);
    ACTIONS[name] = run;
  }
}

/* Values as data-* attributes, for a screen that passes them on as an object: { id: 12, outId: 3 }
   → ' data-id="12" data-out-id="3"'. */
function actionData(values) {
  if (!values) return '';
  const attr = key => key.replace(/[A-Z]/g, c => '-' + c.toLowerCase());
  const text = value => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  return Object.entries(values).filter(([, v]) => v != null).map(([k, v]) => ` data-${attr(k)}="${text(v)}"`).join('');
}

function runAction(name, element, event) {
  const run = ACTIONS[name];
  if (!run) { console.warn(`Tanımsız eylem: ${name}`); return; }
  return run(element.dataset || {}, element, event);
}

function dispatchAction(event) {
  const onChange = event.type === 'change';
  const path = event.composedPath ? event.composedPath() : [];
  for (const element of path) {
    if (element === document) break;
    const name = element.dataset?.action;
    if (!name || FORM_CONTROLS.has(element.tagName) !== onChange) continue;
    runAction(name, element, event);
  }
}

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('click', dispatchAction);
  document.addEventListener('change', dispatchAction);
}
