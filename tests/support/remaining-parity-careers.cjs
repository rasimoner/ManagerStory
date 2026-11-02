const { loadGame } = require('./game.cjs');
const groundMoves = new Set(['stepover', 'nutmeg', 'elastico', 'cruyff', 'croqueta', 'roulette', 'dragBack', 'sombrero', 'automaticReplay']);

function remainingParityCareer(kind, direction = 1, { contact = false } = {}) {
  const game = loadGame({ quiet: true });
  game.run('S=fresh();init();S.matchSalt=73;setExperimentalMatchEngine(true);startMatch();setMatchView("3d")');
  const api = game.api, sim = api.M.simulation, attack = sim.teams.find(t => t.id === 'user'), defense = sim.teams.find(t => t.id !== 'user');
  const context = { api, sim, attack, defense, direction, kind };
  if (kind === 'normalCareer') api.advanceExperimentalSeconds(60); else prepareRemainingCase(context);
  const current = api.M.simulation; api.M.speed = kind === 'normalCareer' ? 1 : 2;
  api.synchronizeExperimentalMatch({ time: current.time, frame: api.captureSimulationFrame(current), forcePlayers: true });
  const observed = verifyRemainingNative(api, current, kind);
  if (contact && kind !== 'normalCareer') api.advanceExperimentalSeconds(Math.max(.1, observed.time - current.time + .01));
  api.pauseLive(); api.save();
  return { save: game.storage.get('msv4'), kind, direction: current.teams.find(t => t.id === 'user').direction,
    seed: current.seed, matchSalt: 73, observed, startTick: current.tick, startPhysicsTime: current.time,
    category: kind === 'normalCareer' ? 'unforced normal career checkpoint' : 'isolated core scenario in real career UI',
    capture: contact ? 'paused core contact; does not verify live sequence or replay completion' : 'live sequence fixture' };
}

function prepareRemainingCase(context) {
  const { sim, attack, defense, direction, kind } = context;
  attack.direction = direction; defense.direction = -direction; sim.match.phase = 'playing'; sim.match.restart = null;
  for (const team of sim.teams) for (const p of team.players) p.heading = team.direction > 0 ? 0 : Math.PI;
  if (['corner', 'shortCorner', 'freeKickService'].includes(kind)) { prepareRemainingRestart(context); return; }
  parkRemainingPlayers(context);
  if (groundMoves.has(kind) || kind === 'turnRelease') prepareRemainingCarry(context);
  else if (kind === 'trap') prepareRemainingTrap(context);
  else if (['header', 'headpass', 'clearance', 'volley'].includes(kind)) prepareRemainingAerial(context);
  else prepareRemainingPass(context);
}

function parkRemainingPlayers({ sim, attack, defense, direction }) {
  sim.ball.restart = null; sim.ball.heldBy = null;
  for (const [teamIndex, team] of sim.teams.entries()) for (const [index, p] of team.players.entries()) {
    p.position = { x: (-26 + index % 3 * 5 + teamIndex * 2) * direction, y: -24 + Math.floor(index / 3) * 8 + teamIndex * 2 };
    if (p.slot === 'GK') p.position = { x: (team === attack ? -48 : 48) * direction, y: 0 };
    p.target = { ...p.position }; p.velocity = { x: 0, y: 0 };
  }
  defense.players.find(p => p.slot === 'GK').attributes.gk.reflexes = 90;
}

function remainingOwner(context) {
  const player = context.attack.players.find(p => p.slot === 'ST');
  Object.assign(player.attributes, { dribbling: 95, technique: 95, firstTouch: 95, passing: 95, vision: 95 });
  player.position = { x: 30 * context.direction, y: 0 }; player.heading = context.direction > 0 ? 0 : Math.PI;
  return player;
}

function prepareRemainingCarry(context) {
  const { api, sim, defense, direction, kind } = context, owner = remainingOwner(context), defender = defense.players.find(p => p.slot === 'ST');
  defender.position = { x: 32.8 * direction, y: kind === 'nutmeg' ? 0 : .4 }; defender.target = { ...defender.position };
  defender.heading = direction > 0 ? Math.PI : 0; defender.duel.nextTackleTick = 10000;
  defender.duel.nextPlanTick = 10; defender.duel.state = 'jockey'; defender.motionMode = 'jockey';
  if (kind === 'turnRelease') { owner.heading += Math.PI; owner.attributes.technique = owner.attributes.dribbling = 60; }
  api.placeSimulationBall(sim, { teamId: owner.teamId, ownerId: owner.id,
    position: { x: owner.position.x + Math.cos(owner.heading) * .35, y: Math.sin(owner.heading) * .35 } });
  api.forceSimulationDribble(sim, owner.id); sim.ownerDecision.dribble = { target: { x: 40 * direction, y: 0 }, score: 100 };
  if (kind === 'turnRelease') return;
  const move = kind === 'automaticReplay' ? 'stepover' : kind;
  const started = move === 'sombrero' ? api.beginSimulationAirSkill(sim, owner, { kind: move, defenderId: defender.id })
    : api.beginSimulationGroundSkill(sim, owner, { kind: move, defenderId: defender.id });
  if (!started) throw Error(`Unable to prepare ${kind}`);
}

function prepareRemainingRestart(context) {
  const { api, sim, attack, direction, kind } = context, taker = attack.players.find(p => p.slot === 'LW');
  taker.attributes.technique = taker.attributes.passing = kind === 'shortCorner' ? 25 : 90;
  const freeKick = kind === 'freeKickService';
  const position = freeKick ? { x: 25 * direction, y: -25 } : { x: 52.5 * direction, y: -34 };
  api.beginSimulationRestart(sim, { kind: freeKick ? 'freeKick' : 'corner', teamId: attack.id, position, taker, indirect: freeKick });
  for (let tick = 0; tick < 1500 && sim.ball.restart; tick++) {
    const previous = api.snapshotSimulation(sim); api.stepSimulation(sim);
    if (!sim.ball.restart) { context.sim = api.restoreSimulation(previous); api.M.simulation = context.sim; return; }
    if (sim.ball.restart.stage === 'runup') return;
  }
  throw Error(`No physical release preparation for ${kind}`);
}

function prepareRemainingPass(context) {
  const { api, sim, attack, defense, direction, kind } = context, owner = remainingOwner(context), receiver = attack.players.find(p => p.slot === 'CAM');
  receiver.position = { x: 43 * direction, y: 1 }; receiver.target = { ...receiver.position };
  if (kind === 'backheel') owner.heading += Math.PI;
  if (kind === 'nolook') {
    owner.attributes.dribbling = 50;
    defense.players.find(p => p.slot === 'ST').position = { x: 32.8 * direction, y: .4 };
    attack.players.find(p => p.slot === 'LW').position = { x: 35 * direction, y: 7 };
  }
  if (kind === 'flairpass') defense.players.find(p => p.slot === 'ST').position = { x: 32.8 * direction, y: .4 };
  if (kind === 'openCross') { owner.position = { x: 30 * direction, y: -25 }; receiver.position = { x: 41 * direction, y: 0 }; }
  api.placeSimulationBall(sim, { teamId: owner.teamId, ownerId: owner.id,
    position: { x: owner.position.x + Math.cos(owner.heading) * .35, y: owner.position.y + Math.sin(owner.heading) * .35 } });
  api.requestSimulationPass(sim, { toId: receiver.id, target: { ...receiver.position }, lofted: kind === 'rabona' || kind === 'openCross' });
}

function prepareRemainingTrap(context) {
  const { api, sim, attack, direction } = context, receiver = remainingOwner(context), passer = attack.players.find(p => p.slot === 'LW');
  const eventIndex = api.emitSimulationEvent(sim, { type: 'pass', fromId: passer.id, toId: receiver.id, teamId: attack.id,
    fromPos: { x: 20 * direction, y: 0 }, toPos: { ...receiver.position }, success: null });
  Object.assign(sim.ball, { ownerId: null, carry: null, control: null, excludedId: null, position: { x: 30.35 * direction, y: 0 },
    velocity: { x: .15 * direction, y: 0 }, height: 1.4, verticalVelocity: -1, teamId: attack.id,
    flight: { eventIndex, teamId: attack.id, fromId: passer.id, toId: receiver.id, fromPos: { x: 20 * direction, y: 0 }, target: { ...receiver.position }, launchTick: sim.tick } });
}

function prepareRemainingAerial(context) {
  const { api, sim, attack, defense, direction, kind } = context;
  const team = kind === 'clearance' ? defense : attack, player = team.players.find(p => p.slot === 'ST'), x = kind === 'headpass' ? 20 : 42;
  Object.assign(player.attributes, { technique: 95, firstTouch: 95, finishing: 95, passing: 95, vision: 95 });
  player.position = { x: x * direction, y: 1 }; player.heading = kind === 'clearance' ? Math.PI : direction > 0 ? 0 : Math.PI;
  if (kind === 'headpass') team.players.find(p => p.slot === 'CAM').position = { x: 28 * direction, y: 3 };
  const passer = attack.players.find(p => p.slot === 'LW');
  const eventIndex = api.emitSimulationEvent(sim, { type: 'pass', fromId: passer.id, toId: player.id, teamId: attack.id,
    fromPos: { x: 30 * direction, y: -25 }, toPos: { ...player.position }, success: null });
  Object.assign(sim.ball, { ownerId: null, carry: null, control: null, excludedId: null,
    position: { x: (x - .05) * direction, y: 1 }, velocity: { x: 8 * direction, y: 0 }, height: kind === 'volley' ? .65 : 1.65, verticalVelocity: -1,
    teamId: attack.id, lastTouchTeamId: attack.id,
    flight: { eventIndex, teamId: attack.id, fromId: passer.id, toId: player.id, fromPos: { x: 30 * direction, y: -25 }, target: { ...player.position }, launchTick: sim.tick, cross: true } });
}

module.exports = { remainingParityCareer };

function verifyRemainingNative(api, simulation, kind) {
  const before = api.snapshotSimulation(simulation), next = api.restoreSimulation(before), start = next.events.length;
  if (next.paused) api.resumeSimulation(next);
  for (let tick = 0; tick < 60; tick++) api.stepSimulation(next);
  const events = next.events.slice(start), expected = expectedRemainingEvent(kind);
  const event = events.find(event => expected(event));
  if (!event && kind !== 'normalCareer') throw Error(`No actual ${kind} event in prepared core scenario`);
  if (JSON.stringify(api.snapshotSimulation(simulation)) !== JSON.stringify(before)) throw Error('Fixture verification changed its live state');
  return event ? { type: event.type, kind: event.kind, style: event.style, restartKind: event.restartKind, time: event.time } : { type: 'normalCareer' };
}

function expectedRemainingEvent(kind) {
  if (groundMoves.has(kind)) return event => event.type === 'skill' && !event.observed && event.kind === (kind === 'automaticReplay' ? 'stepover' : kind);
  if (['corner', 'shortCorner', 'freeKickService'].includes(kind)) return event => event.type === 'pass' && event.restartKind === (kind === 'freeKickService' ? 'freeKick' : 'corner');
  if (kind === 'openCross') return event => event.type === 'cross';
  if (kind === 'clearance') return event => event.type === 'clearance';
  if (kind === 'turnRelease') return event => event.type === 'dribble' && event.touches > 0;
  if (kind === 'trap') return event => event.type === 'firstTouch' && event.style === 'trap';
  if (kind === 'header' || kind === 'headpass') return event => event.type === (kind === 'header' ? 'shot' : 'pass') && event.style === 'header';
  if (kind === 'volley') return event => event.type === 'shot' && event.style === 'volley';
  return event => event.type === 'pass' && event.style === kind;
}
