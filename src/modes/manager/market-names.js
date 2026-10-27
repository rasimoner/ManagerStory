/* The transfer market's player names and the positions it offers, in order (refactor E1; data/names.json,
   data/balance.json). Values from the data alone: no game module is imported, so it is ready whichever module of
   the manager's import cycle (app ↔ season-end) runs first. */
import NAME_DATA from '../../data/names.json';
import BALANCE from '../../data/balance.json';
export const MARKET_FIRST_NAMES=NAME_DATA.market.first,MARKET_LAST_NAMES=NAME_DATA.market.last,MARKET_POSITIONS=BALANCE.market.positions;
