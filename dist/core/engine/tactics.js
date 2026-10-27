/* The tactics' vocabulary (refactor E1): the settings a team can play with, how they are said, and the team
   orders (data/tactics.js). Values from the data alone: no game module is imported, so it is ready whichever
   module of an import cycle runs first. */
import { TACTIC_DATA } from '../../data/tactics.js?v=7.11.0';
export const MATCH_TACTICS = TACTIC_DATA.options;
export const TACTIC_LABELS = TACTIC_DATA.labels;
export const TEAM_ORDERS = TACTIC_DATA.orders;
