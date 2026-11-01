import MATCH_SIM_DATA from '../../data/match-sim.json';
import RESTART_DATA from '../../data/match-sim-restarts.json';
import { evaluateSimulationShot } from './shot-evaluation.js';
import { evaluateSimulationPass } from './pass-evaluation.js';

export function chooseSimulationAerial(simulation, player, touching) {
  const kind = aerialStrikeKind(simulation, player, touching);
  if (!kind) return null;
  const shot = evaluateSimulationShot(simulation, player), settings = RESTART_DATA.aerial;
  if (shot.distance <= settings.maximumShotDistance && shot.body.turn <= settings.maximumTurn) {
    return { kind, result: 'shot', option: { ...shot, style: kind, power: shot.power * settings.powerFactors[kind] } };
  }
  const outlet = aerialPassOutlet(simulation, player, touching);
  return { kind, result: outlet ? 'pass' : 'clearance', option: outlet };
}

function aerialStrikeKind(simulation, player, ball) {
  const settings = RESTART_DATA.aerial;
  if (ball.height >= settings.headHeight && ball.height <= MATCH_SIM_DATA.ball.reachableHeight) {
    return 'header';
  }
  return ball.height >= settings.volleyMinimumHeight && ball.height <= settings.volleyMaximumHeight
    && player.attributes.technique >= settings.volleyTechnique ? 'volley' : null;
}

function aerialPassOutlet(simulation, player, touching) {
  const team = simulation.teams.find(team => team.id === player.teamId), settings = RESTART_DATA.aerial;
  let best = null;
  for (const mate of team.players) {
    if (mate.id === player.id || mate.sentOff || mate.slot === 'GK') continue;
    const option = evaluateSimulationPass(simulation, { fromId: player.id, toId: mate.id, target: mate.position, lofted: true, startHeight: touching.height });
    if (!usableAerialOutlet(option, settings)) continue;
    if (option.target.x * team.direction <= player.position.x * team.direction) continue;
    if (!best || option.score > best.score) best = option;
  }
  return best;
}

function usableAerialOutlet(option, settings) {
  return option.visible && option.safe && option.reachable && option.distance <= settings.maximumPassDistance;
}
