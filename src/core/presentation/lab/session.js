import { recordLabShotMapEvents } from './shot-map.js';
import { requestSimulationShot } from '../../sim/shot-execution.js';
import MATCH_SIM_DATA from '../../../data/match-sim.json';
import { createSimulation, readSimulation } from '../../sim/simulation-state.js';
import { advanceSimulation } from '../../sim/simulation-step.js';
import { placeSimulationBall } from '../../sim/ball-state.js';
import { readSimulationStatistics } from '../../sim/ball-events.js';
import { requestSimulationPass } from '../../sim/owner-decision.js';
import { setSimulationTactics } from '../../sim/tactic-settings.js';
import { forceSimulationDribble } from '../../sim/dribbling.js';
import { createLabScenario } from './scenario.js';
// The old scripted driver stays reachable by name for the unchanged off-ball regression tests only.
import './automatic-ball.js';
import '../../sim/simulation-checkpoint.js';
import '../../sim/team-commands.js';

export function createLabSession(initial = {}) {
  const context = { options: { seed: MATCH_SIM_DATA.lab.defaultSeed, ...initial }, simulation: null, pendingBall: null };
  const session = { running: true, automatic: true, speed: 1 };
  resetLabSession(context, {});
  return { session,
    snapshot: () => labSessionSnapshot(context, session),
    reset: changes => resetLabSession(context, changes),
    advance: seconds => advanceLabSession(context, session, seconds),
    placeBall: position => queueLabIntervention(context, session, { position }),
    chooseOwner: teamId => queueLabIntervention(context, session, { teamId }),
    setTactics: tactics => { setSimulationTactics(context.simulation, tactics); context.options = { ...context.options, ...tactics }; },
    enableAutomatic: value => { session.automatic = value; context.simulation.automaticPasses = value; },
    passTo: request => { requestSimulationPass(context.simulation, request); session.automatic = false; context.simulation.automaticPasses = false; },
    shoot: () => requestSimulationShot(context.simulation),
    forceDribble: playerId => forceSimulationDribble(context.simulation, playerId),
    completeMatch: () => completeLabMatch(context, session),
  };
}

function completeLabMatch(context, session) {
  const started = performance.now();
  session.automatic = true;
  context.simulation.automaticPasses = true;
  if (context.pendingBall) { placeSimulationBall(context.simulation, context.pendingBall); context.pendingBall = null; }
  advanceSimulation(context.simulation, { seconds: Math.max(0, MATCH_SIM_DATA.lab.matchSeconds - context.simulation.time) });
  session.lastRunSeconds = (performance.now() - started) / 1000;
  session.running = false;
}

function resetLabSession(context, changes) {
  const options = { ...context.options, ...changes };
  const simulation = createSimulation(createLabScenario(options));
  context.options = options;
  context.simulation = simulation;
  context.pendingBall = null;
  context.shotMap = { cursor: 0, shots: [], current: null };
}

function labSessionSnapshot(context, session) {
  const simulation = readSimulation(context.simulation, { includeEvents: false });
  // A paused referee placement is a preview; its physical application happens at the next tick.
  if (context.pendingBall) simulation.ball = structuredClone(context.pendingBall);
  const recentEvents = recentLabEvents(context.simulation);
  recordLabShotMapEvents(context.shotMap, context.simulation.events);
  return { ...session, simulation, recentEvents, shotMap: context.shotMap.shots, metrics: readSimulationStatistics(context.simulation) };
}

function queueLabIntervention(context, session, change) {
  const current = context.pendingBall ?? context.simulation.ball;
  context.pendingBall = { position: { ...(change.position ?? current.position) }, teamId: change.teamId ?? current.teamId };
  session.automatic = false;
  context.simulation.automaticPasses = false;
}

function advanceLabSession(context, session, seconds) {
  if (!session.running) return;
  if (context.pendingBall) { placeSimulationBall(context.simulation, context.pendingBall); context.pendingBall = null; }
  context.simulation.automaticPasses = session.automatic;
  advanceSimulation(context.simulation, { seconds: seconds * session.speed });
}

function recentLabEvents(simulation) {
  const events = [];
  const types = new Set(['dribble', 'tackle', 'duel', 'foul', 'advantage', 'yellow', 'red', 'beat', 'pass', 'shot', 'block', 'save', 'post', 'wide', 'goal', 'keeperClaim', 'keeperDistribution', 'kickoff', 'half', 'end']);
  for (let index = simulation.events.length - 1; index >= 0 && events.length < MATCH_SIM_DATA.lab.recentEventCount; index--) {
    if (types.has(simulation.events[index].type)) events.unshift({ ...simulation.events[index] });
  }
  return structuredClone(events);
}
