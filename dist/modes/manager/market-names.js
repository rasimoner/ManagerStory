/* The transfer market's player names and the positions it offers, in order (refactor E1; data/names.js,
   data/balance.js). Values from the data alone: no game module is imported, so it is ready whichever module of
   the manager's import cycle (app ↔ season-end) runs first. */
import { NAME_DATA } from '../../data/names.js?v=7.11.0';
import { BALANCE } from '../../data/balance.js?v=7.11.0';
export const V6FN=NAME_DATA.market.first,V6LN=NAME_DATA.market.last,V6POS=BALANCE.market.positions;
