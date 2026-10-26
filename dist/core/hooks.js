/* Refactor C3: extension points. A file that adds to what another file does registers a handler here
   instead of replacing that file's function at run time (the old way: star-transfer.js wrapped v6Sign
   and showV6Transfers, nav.js wrapped goMain). The file that owns the behaviour names the moment and
   runs the handlers; they run in the order they were registered, which main.js fixes.
     onHook('afterSigning', (player, from, fee) => …)      runHooks('afterSigning', player, x, fee)
   runHooks returns the handlers' results, so a handler can say it has dealt with something (true). */
const HOOKS = Object.create(null);

function onHook(name, handler) {
  if (typeof handler !== 'function') throw new Error(`hook "${name}": not a function`);
  (HOOKS[name] ??= []).push(handler);
}

function runHooks(name, ...args) {
  return (HOOKS[name] || []).map(handler => handler(...args));
}
