import KEEPER_ANIMATION_DATA from '../../data/match-sim-keeper-animation.json';
import SIM_VIEW_DATA from '../../data/match-sim-view.json';

// This is a detached drawing copy of observed events, never a new checkpoint or a football decision.
export function captureKeeperPresentation(simulation, player) {
  if (player.slot !== 'GK' || player.keeper.reactionAt == null) return null;
  const recent = simulation.events.slice(-SIM_VIEW_DATA.contacts.maximum)
    .filter(event => simulation.physicsTime - event.time <= KEEPER_ANIMATION_DATA.historySeconds);
  const previous = recent.findLast(event => event.type === 'save' && event.fromId === player.id && event.reactionAt < player.keeper.reactionAt);
  const shot = recent.findLast(event => event.type === 'shot' && event.teamId !== player.teamId && event.time <= player.keeper.reactionAt);
  const stopped = recent.findLast(event => event.time < player.keeper.reactionAt
    && shot && event.time >= shot.time
    && ['save', 'block', 'goal', 'wide', 'ballOut'].includes(event.type));
  return { previousSave: previous ? copyKeeperSave(previous) : null, stoppedAt: stopped?.time ?? null };
}

function copyKeeperSave(event) {
  return { time: event.time, reactionAt: event.reactionAt, height: event.height,
    fromPos: { ...event.fromPos }, toPos: { ...event.toPos } };
}
