import CAREER_SIM_DATA from '../../data/match-sim-career.json';
import MATCH_SIM_DATA from '../../data/match-sim.json';
import { createSimulation } from '../sim/simulation-state.js';

export function createCareerSimulation(input) {
  const user = createCareerSimulationTeam({ ...input.user, id: 'user', direction: 1 });
  const opponent = createCareerSimulationTeam({ ...input.opponent, id: 'opponent', direction: -1 });
  const teams = input.userHome ? [user, opponent] : [opponent, user];
  return createSimulation({ seed: input.seed, teams, workload: true, match: true, ball: { position: { x: 0, y: 0 }, teamId: teams[0].id } });
}

function createCareerSimulationTeam(input) {
  const formation = CAREER_SIM_DATA.formationMap[input.formation ?? 'free'];
  if (!formation) throw new TypeError('Unsupported career formation.');
  const remaining = [...input.players];
  const players = MATCH_SIM_DATA.formations[formation].map(anchor => {
    const player = takeCareerSlotPlayer(remaining, anchor.slot);
    return { ...careerSimulationPlayer(player), slot: anchor.slot, anchor: careerSimulationAnchor(player, anchor), line: anchor.line };
  });
  return { id: input.id, direction: input.direction, formation, tactics: mapCareerSimulationTactics(input.tactics), players };
}

function takeCareerSlotPlayer(players, slot) {
  const candidates = players.map(player => ({ player, score: careerSlotDistance(player, slot) }));
  candidates.sort((left, right) => left.score - right.score);
  const chosen = candidates[0]?.player;
  if (!chosen) throw new TypeError('A career match requires eleven players.');
  players.splice(players.indexOf(chosen), 1);
  return chosen;
}

function careerSlotDistance(player, slot) {
  const position = player.lineupPosition ?? CAREER_SIM_DATA.slotPositions[slot];
  const reference = CAREER_SIM_DATA.slotPositions[slot];
  const role = player.role ?? player.pos?.split('/')[0] ?? player.position;
  const mismatch = CAREER_SIM_DATA.slotRoles[slot].includes(role) ? 0 : CAREER_SIM_DATA.roleMismatchCost;
  return mismatch + (position[0] - reference[0]) ** 2 + (position[1] - reference[1]) ** 2;
}

function careerSimulationAnchor(player, anchor) {
  const reference = CAREER_SIM_DATA.slotPositions[anchor.slot];
  const position = player.lineupPosition ?? reference;
  const limit = CAREER_SIM_DATA.anchorMaximum, scale = CAREER_SIM_DATA.positionScale;
  return { x: Math.max(-limit, Math.min(limit, anchor.x + (reference[1] - position[1]) / scale)),
    y: Math.max(-limit, Math.min(limit, anchor.y + (position[0] - reference[0]) / scale)) };
}

export function careerSimulationPlayer(player) {
  const attributes = Object.fromEntries(Object.entries(CAREER_SIM_DATA.attributes).map(([name, fields]) => [name, readCareerAttribute(player, fields)]));
  const gk = Object.fromEntries(['reflexes', 'handling', 'oneOnOne'].map(name => [name, readCareerAttribute(player.gk ?? {}, [name])]));
  return { id: player.id, number: player.number ?? 1, attributes, gk };
}

function readCareerAttribute(player, fields) {
  const value = fields.map(field => player[field]).find(Number.isFinite) ?? CAREER_SIM_DATA.defaultAttribute;
  return Math.max(0, Math.min(CAREER_SIM_DATA.attributeMaximum, value));
}

export function mapCareerSimulationTactics(plan = {}) {
  const tactics = Object.fromEntries(Object.entries(CAREER_SIM_DATA.defaultTactics).map(([key, value]) => [key, plan[key] ?? value]));
  for (const order of plan.teamInstructions ?? []) Object.assign(tactics, CAREER_SIM_DATA.teamOrders[order]);
  return tactics;
}
