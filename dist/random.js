/* Randomness. Every random number in the game comes from a seeded generator made by R(seed); nothing in
   the game calls the browser's own random number function (tests/random.test.cjs checks every script).
   Same seed, same numbers.
   - A match draws from its own generator, M.rand = R(matchSeed()); its state is saved with the match,
     so a match resumed from a save carries on with the same dice.
   - Profiles, academy prospects, wonderkids and rival squads draw from R(seed) with a seed of their own.
   - Draws outside a match that have no seed of their own (a sale offer, the board's answer to a budget
     request) come from sessionRandom(): one generator per opened game, seeded once from the device.
   The only entropy is the device's, through newMatchSalt(): a new career's salt, each kickoff's salt and
   the session generator's seed. (V7.9.13: R and newMatchSalt moved here from app.js unchanged.) */

// mulberry32; random.state is the generator's position (R(random.state) carries on where it stopped)
function R(seed){let x=seed>>>0;const random=()=>{x=(x+0x6D2B79F5)|0;random.state=x;let t=x;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296};random.state=x;return random;}

// a new salt for a career's match dice (see matchSeed): drawn from the device, never inside the engine
function newMatchSalt(){try{if(globalThis.crypto?.getRandomValues)return(globalThis.crypto.getRandomValues(new Uint32Array(1))[0]%2147483646)+1;}catch(e){}return((Date.now()^Math.floor((globalThis.performance?.now?.()||0)*1000))>>>1)%2147483646+1;}

// career draws that have no seed of their own; seeded from the device the first time it is used
let sessionRng = null;
function sessionRandom() { sessionRng ??= R(newMatchSalt()); return sessionRng(); }
