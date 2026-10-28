
// Bind once: hot steps also run in an isolated VM for deterministic acceptance tests.
const { hypot } = Math;
export const vectorLength = vector => hypot(vector.x, vector.y);
export const pointDistance = (left, right) => hypot(left.x - right.x, left.y - right.y);
// Planning uses bounded pitch coordinates, so a direct square root needs no general hypot overflow scaling.
export const planningDistance = (left, right) => Math.sqrt((left.x - right.x) ** 2 + (left.y - right.y) ** 2);
export const pointSquaredDistance = (left, right) => (left.x - right.x) ** 2 + (left.y - right.y) ** 2;
export const clampSimValue = (value, minimum, maximum) => value < minimum ? minimum : value > maximum ? maximum : value;
export const subtractPoints = (left, right) => ({ x: left.x - right.x, y: left.y - right.y });

export function limitVector(vector, maximum) {
  const length = vectorLength(vector);
  const factor = length > maximum ? maximum / length : 1;
  return { x: vector.x * factor, y: vector.y * factor };
}

export function projectOntoSegment(point, start, end) {
  const line = subtractPoints(end, start);
  const squared = line.x * line.x + line.y * line.y;
  const offset = subtractPoints(point, start);
  const fraction = squared ? clampSimValue((offset.x * line.x + offset.y * line.y) / squared, 0, 1) : 0;
  return { x: start.x + line.x * fraction, y: start.y + line.y * fraction };
}
