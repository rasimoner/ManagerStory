import { simulationWorldPoint } from './scene-frame.js';

// Interpolate through the observed contact, rather than flattening a high ball before it arrives.
export function sampleSceneBall(previous, current, time) {
  const from = { time: previous.physicsTime, position: previous.ball.position, height: previous.ball.height };
  const to = { time: current.physicsTime, position: current.ball.position, height: current.ball.height };
  const contact = current.contacts.findLast(event => event.type === 'firstTouch' && event.height != null && event.fromPos
    && event.time > from.time && event.time < to.time);
  if (!contact) return interpolateBallPoints(from, to, time);
  const touch = { time: contact.time, position: contact.fromPos, height: contact.height };
  return time <= touch.time ? interpolateBallPoints(from, touch, time) : interpolateBallPoints(touch, to, time);
}

function interpolateBallPoints(from, to, time) {
  const alpha = to.time <= from.time ? 1 : Math.min(1, Math.max(0, (time - from.time) / (to.time - from.time)));
  return simulationWorldPoint({ x: from.position.x + (to.position.x - from.position.x) * alpha,
    y: from.position.y + (to.position.y - from.position.y) * alpha }, from.height + (to.height - from.height) * alpha);
}
