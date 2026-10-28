import MATCH_SIM_DATA from '../../../data/match-sim.json';
import { createSimulation, readSimulation } from '../../sim/simulation-state.js';
import { advanceSimulation } from '../../sim/simulation-step.js';
import { setSimulationTactics } from '../../sim/tactic-settings.js';
import { createLabScenario } from './scenario.js';
import { createLabBallDriver, advanceLabBall } from './automatic-ball.js';

export function createLabSession(initial = {}) {
  let options = { seed: MATCH_SIM_DATA.lab.defaultSeed, ...initial };
  let simulation = createSimulation(createLabScenario(options));
  let driver = createLabBallDriver(options.seed);
  let manualBall = structuredClone(simulation.ball);
  let accumulator = 0;
  const session = { running: true, automatic: true, speed: 1 };
  const snapshot = () => {
    const copy = readSimulation(simulation);
    if (!session.automatic) copy.ball = structuredClone(manualBall);
    return { ...session, simulation: copy };
  };
  const reset = changes => {
    const candidate = { ...options, ...changes };
    const next = createSimulation(createLabScenario(candidate));
    options = candidate;
    simulation = next;
    driver = createLabBallDriver(options.seed);
    manualBall = structuredClone(simulation.ball);
    accumulator = 0;
  };
  const advance = seconds => {
    if (!session.running) return;
    accumulator = consumeLabTime({ simulation, driver, manualBall, session, accumulator, seconds });
  };
  const placeBall = position => {
    manualBall = { teamId: session.automatic ? simulation.ball.teamId : manualBall.teamId, position: { ...position } };
    session.automatic = false;
  };
  const chooseOwner = teamId => {
    manualBall = { position: { ...(session.automatic ? simulation.ball.position : manualBall.position) }, teamId };
    session.automatic = false;
  };
  const setTactics = tactics => { setSimulationTactics(simulation, tactics); options = { ...options, ...tactics }; };
  return { session, snapshot, reset, advance, placeBall, chooseOwner, setTactics,
    enableAutomatic(value) { session.automatic = value; driver = createLabBallDriver(options.seed); },
  };
}

function consumeLabTime(context) {
  const { stepSeconds, epsilon } = MATCH_SIM_DATA.clock;
  let remaining = context.accumulator + context.seconds * context.session.speed;
  while (remaining + epsilon >= stepSeconds) {
    const ball = context.session.automatic ? advanceLabBall(context.driver, context.simulation) : context.manualBall;
    advanceSimulation(context.simulation, { seconds: stepSeconds, ball });
    remaining = Math.max(0, remaining - stepSeconds);
  }
  return remaining;
}
