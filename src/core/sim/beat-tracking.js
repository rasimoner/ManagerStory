import MATCH_SIM_DATA from '../../data/match-sim.json';
import { simulationRuntime } from './simulation-runtime.js';
import { pointSquaredDistance } from './geometry.js';
import { emitSimulationEvent } from './ball-events.js';
import { simulationDurationTicks } from './duel-state.js';

export function trackSimulationBeats(simulation) {
  const owner = simulationRuntime(simulation).byId.get(simulation.ball.ownerId ?? simulation.ball.carry?.playerId);
  if (!owner) { simulation.defending.engagements = []; return; }
  if (!simulation.ball.carry && simulation.ownerDecision.selected !== 'dribble') return;
  const settings = MATCH_SIM_DATA.duels;
  const team = simulation.teams.find(candidate => candidate.id === owner.teamId);
  const opponents = simulation.teams.find(candidate => candidate.id !== owner.teamId).players;
  for (const defender of opponents) trackDefenderEncounter({ simulation, owner, team, settings }, defender);
  simulation.defending.engagements = simulation.defending.engagements.filter(encounter => encounter.ownerId === owner.id
    && simulation.tick - encounter.tick <= simulationDurationTicks(settings.beatWindowSeconds));
}

function trackDefenderEncounter({ simulation, owner, team, settings }, defender) {
  const engagements = simulation.defending.engagements;
  const existing = engagements.find(encounter => encounter.ownerId === owner.id && encounter.defenderId === defender.id);
  const squared = pointSquaredDistance(owner.position, defender.position);
  if (!existing) {
    if (squared > settings.beatEngageDistance ** 2 || !['jockey', 'ready', 'tackling'].includes(defender.duel.state)) return;
    engagements.push({ ownerId: owner.id, defenderId: defender.id, position: { ...owner.position }, defenderState: defender.duel.state, tick: simulation.tick, beaten: false });
    return;
  }
  if (existing.beaten || squared < settings.beatEscapeDistance ** 2) return;
  if ((owner.position.x - existing.position.x) * team.direction < settings.beatMinimumProgress || (owner.position.x - defender.position.x) * team.direction <= 0) return;
  if (!simulation.ball.carry && simulation.ownerDecision.selected !== 'dribble') return;
  existing.beaten = true;
  emitSimulationEvent(simulation, { type: 'beat', fromId: owner.id, toId: defender.id, fromPos: { ...owner.position }, toPos: { ...defender.position },
    speed: Math.hypot(owner.velocity.x, owner.velocity.y), defenderState: existing.defenderState, success: true });
  simulation.statistics.teams[owner.teamId].beats++;
}
