/* Refactor C3: extension points. A file that adds to what another file does registers a handler here
   instead of replacing that file's function at run time (the old way: star-transfer.js wrapped the signing
   and the transfer list, nav.js wrapped goMain). The file that owns the behaviour names the moment and
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
     careerOpened()   a career has just been put in place (an imported save): the mode makes it ready (init)
     decisionsRequested()   the 3D view's "Değiştir" button: the mode opens its match decisions (openDecisionSheet)
     opponentsEvolved()     the rival squads grew after a round: the mode updates what it offers for their
                            players (the manager: wonderkid transfer offers, syncWonderOffers)
     seasonStarted(summary) a new season has just been set up (the last step of the season end): what it
                            means for the mode (the manager: the league prize to his budget, the chairman's
                            letter, the board's question, the clock; modes/manager/season-end.js)
     minutePlayed(player)   a player of the user's team has played another minute: the mode counts it
                            (the manager: the season's minutes, modes/manager/match-career.js)
   And every match event is a hook of its own ('matchEvent', run by matchEvent): the mode writes the career's
   side of a goal, a card or a debut from it as it happens (modes/manager/match-career.js). */
export function changed() { runHooks('changed'); }
export function careerOpened() { runHooks('careerOpened'); }
export function decisionsRequested() { runHooks('decisionsRequested'); }
export function opponentsEvolved() { runHooks('opponentsEvolved'); }
export function seasonStarted(summary) { runHooks('seasonStarted', summary); }
export function minutePlayed(player) { runHooks('minutePlayed', player); }
