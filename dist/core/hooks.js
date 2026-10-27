/* Refactor C3: extension points. A file that adds to what another file does registers a handler here
   instead of replacing that file's function at run time (the old way: star-transfer.js wrapped v6Sign
   and showV6Transfers, nav.js wrapped goMain). The file that owns the behaviour names the moment and
   runs the handlers; they run in the order they were registered, which main.js fixes.
     onHook('afterSigning', (player, from, fee) => …)      runHooks('afterSigning', player, x, fee)
   runHooks returns the handlers' results, so a handler can say it has dealt with something (true). */
export const HOOKS = Object.create(null);

export function onHook(name, handler) {
  if (typeof handler !== 'function') throw new Error(`hook "${name}": not a function`);
  (HOOKS[name] ??= []).push(handler);
}

export function runHooks(name, ...args) {
  return (HOOKS[name] || []).map(handler => handler(...args));
}

/* Refactor D4: what core says to the mode that is playing, instead of calling the mode. main.js connects
   the manager mode to each; a mode that does not care registers nothing.
     changed()        the career or the match has changed: whatever shows it redraws (the manager: render)
     careerOpened()   a career has just been put in place (an imported save): the mode makes it ready (init) */
export function changed() { runHooks('changed'); }
export function careerOpened() { runHooks('careerOpened'); }
