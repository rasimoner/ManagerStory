import MATCH_SIM_DATA from '../../data/match-sim.json';
import { emitSimulationEvent } from './ball-events.js';
import { pointDistance } from './geometry.js';

// Report motion that already happened. No decision, root, ball, statistic or random draw is changed here.
export function observeSimulationDribbleChange(simulation, encounter, { owner, defender }) {
  if (!simulation.clock.pauseHalfPreparation || encounter.beaten || pointDistance(owner.position, defender.position) > MATCH_SIM_DATA.duels.beatEngageDistance) return;
  if (!Number.isFinite(encounter.observedHeading)) { encounter.observedHeading = owner.heading; return; }
  const settings = MATCH_SIM_DATA.dribbling, turn = angleDifference(owner.heading, encounter.observedHeading);
  if (!encounter.observedTurn) {
    if (Math.abs(turn) < settings.observedTurnRadians) return;
    encounter.observedTurn = { heading: owner.heading, turn, reversed: false, turnedAround: false };
    recordObservedMove(simulation, { owner, defender }, { kind: 'cut', turn });
    return;
  }
  observeTurnaround(simulation, encounter, { owner, defender, turn });
  observeBodyFeint(simulation, encounter, { owner, defender });
}

function observeTurnaround(simulation, encounter, { owner, defender, turn }) {
  const observed = encounter.observedTurn;
  if (observed.turnedAround || Math.sign(turn) !== Math.sign(observed.turn) || Math.abs(turn) < MATCH_SIM_DATA.dribbling.observedTurnaroundRadians) return;
  observed.turnedAround = true;
  recordObservedMove(simulation, { owner, defender }, { kind: 'turn', turn });
}

function observeBodyFeint(simulation, encounter, { owner, defender }) {
  const observed = encounter.observedTurn, turn = angleDifference(owner.heading, observed.heading);
  if (observed.reversed || Math.sign(turn) === Math.sign(observed.turn) || Math.abs(turn) < MATCH_SIM_DATA.dribbling.observedTurnRadians) return;
  const committedSpeed = defender.velocity.x * Math.cos(observed.heading) + defender.velocity.y * Math.sin(observed.heading);
  if (committedSpeed < MATCH_SIM_DATA.dribbling.feintCommitSpeed) return;
  observed.reversed = true;
  recordObservedMove(simulation, { owner, defender }, { kind: 'bodyFeint', turn });
}

function recordObservedMove(simulation, { owner, defender }, move) {
  emitSimulationEvent(simulation, { type: 'skill', ...move, fromId: owner.id, toId: defender.id, teamId: owner.teamId,
    fromPos: { ...owner.position }, toPos: { ...defender.position }, observed: true });
}

function angleDifference(to, from) { return Math.atan2(Math.sin(to - from), Math.cos(to - from)); }
