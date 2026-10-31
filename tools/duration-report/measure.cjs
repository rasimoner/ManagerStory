const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const { clock } = require('../../src/data/match-sim.json');
const { measureDurationCareer } = require('./career.cjs');
const { mean } = require('./summary.cjs');

function equalDurationInput(api, seed, durationSeconds) {
  const input = structuredClone(api.createLabScenario({ seed }));
  input.teams[1].players.forEach((player, index) => { player.attributes = structuredClone(input.teams[0].players[index].attributes); });
  input.teams.forEach((team, side) => team.players.forEach((player, index) => { player.id = side * 100 + index; }));
  return { ...input, workload: true, durationSeconds };
}

function measureDurationMatch(api, input) {
  const simulation = api.createSimulation(input), started = performance.now();
  while (simulation.match.phase !== 'ended') {
    if (simulation.paused) api.resumeSimulation(simulation);
    api.stepSimulation(simulation);
  }
  const milliseconds = performance.now() - started;
  const statistics = api.readSimulationStatistics(simulation);
  statistics.passesPerPhysicsMinute = statistics.passes / (simulation.physicsTime / 60);
  const career = measureDurationCareer(api, simulation);
  assertRealEvents(simulation, statistics);
  const players = [...simulation.teams.flatMap(team => team.players), ...simulation.departed];
  return { seed: input.seed, durationSeconds: simulation.clock.durationSeconds, milliseconds, score: simulation.match.score, statistics,
    ticks: simulation.tick, stoppedTicks: simulation.clock.stoppedTicks, physicsSeconds: simulation.physicsTime, matchSeconds: simulation.matchTime, rng: simulation.rngState,
    injuries: simulation.events.filter(event => event.type === 'injury').length,
    injuryTimes: simulation.events.filter(event => event.type === 'injury').map(event => ({ cause: event.cause, physicsTime: event.time, matchTime: event.matchTime })),
    movement: { distanceMetres: players.reduce((sum, player) => sum + player.workload.distanceMetres, 0),
      sprintMetres: players.reduce((sum, player) => sum + player.workload.sprintMetres, 0), contacts: players.reduce((sum, player) => sum + player.workload.contacts, 0) },
    fitness: endingFitness(players),
    activitySeconds: Object.fromEntries(Object.entries(simulation.clock.activityTicks).map(([key, ticks]) => [key, ticks * clock.stepSeconds])),
    career, consistency: true };
}

function endingFitness(players) {
  const selected = predicate => mean(players.filter(predicate).map(player => player.attributes.fitness));
  return { all: selected(() => true), keeper: selected(player => player.slot === 'GK'), outfield: selected(player => player.slot !== 'GK') };
}

function assertRealEvents(simulation, statistics) {
  const counts = Object.fromEntries(['goal', 'shot', 'pass', 'foul', 'yellow', 'red'].map(type => [type, simulation.events.filter(event => event.type === type).length]));
  for (const [event, field] of [['goal', 'goals'], ['shot', 'shots'], ['pass', 'passes'], ['foul', 'fouls'], ['yellow', 'yellow'], ['red', 'red']]) assert.equal(counts[event], statistics[field]);
  assert.equal(simulation.matchTime, 5400);
  assert.equal(simulation.tick - simulation.clock.stoppedTicks, simulation.clock.totalTicks);
  assert.equal(Object.values(simulation.clock.activityTicks).reduce((sum, value) => sum + value, 0), simulation.tick);
}

module.exports = { equalDurationInput, measureDurationMatch };
