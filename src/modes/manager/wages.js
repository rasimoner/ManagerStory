/* Wages: what a player earns a year and how much the club may pay its squad (the wage room).
   One rule for the room, in data/balance.json contracts.wageBudget: the club's level priced like a player of
   that level, times squadSlots. It is never stored: a save keeps the wages, the room follows the club. */
import BALANCE from '../../data/balance.json';
import { S } from '../../core/state.js';
import { managedClubLevel } from '../../core/clubs/clubs.js';
import { seasonActive } from '../../core/season/season.js';

const WAGE = BALANCE.contracts.wage;
const BUDGET = BALANCE.contracts.wageBudget;

// what a player of this overall earns on a new contract
export function baseWage(overall) { return Math.round(overall * overall * WAGE.perOverallSquared); }

export function academyWage() { return WAGE.academy; }

export function wageBudget(level = managedClubLevel()) {
  return Math.round(baseWage(level) * BUDGET.squadSlots / BUDGET.roundTo) * BUDGET.roundTo;
}

// the squad's yearly wages; a player who has left the club is off the payroll
export function wageBill(squad = S.players) { return squad.filter(seasonActive).reduce((sum, p) => sum + (p.wage || 0), 0); }

// what is left for new contracts (negative when the squad already costs more than the club may pay)
export function wageRoom() { return wageBudget() - wageBill(); }

export function wageFits(wage) { return wage <= wageRoom(); }
