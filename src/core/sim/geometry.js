export const vectorLength = vector => Math.hypot(vector.x, vector.y);
export const pointDistance = (left, right) => Math.hypot(left.x - right.x, left.y - right.y);
export const clampSimValue = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
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
