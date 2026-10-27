// The special moves a carrier can beat his man with, by move id (data/moves.json): each a beat
// (beat context, { car, def, closeUp }) that returns false when it could not be set up.
import { stepoverBeat, elasticoBeat, croquetaBeat } from './feints.js';
import { cruyffBeat, rouletteBeat } from './turns.js';
import { nutmegBeat, flairNutmegBeat } from './through-the-legs.js';
import { rainbowBeat, sombreroBeat, juggleBeat } from './over-the-top.js';

export const SKILL_BEATS = Object.freeze({
  stepover: stepoverBeat, nutmeg: nutmegBeat, elastico: elasticoBeat, cruyff: cruyffBeat, croqueta: croquetaBeat,
  roulette: rouletteBeat, flairnutmeg: flairNutmegBeat, rainbow: rainbowBeat, sombrero: sombreroBeat, juggle: juggleBeat,
});
