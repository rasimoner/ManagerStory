// A checkpoint must survive JSON, including shared position targets and non-finite decision scores.
export function encodeSimulationCheckpoint(value) {
  const payload = structuredClone(value);
  const metadata = { references: [], scalars: [] };
  visitCheckpointValue({ seen: new WeakMap(), metadata }, payload, []);
  return { ...payload, ...metadata };
}

function visitCheckpointValue(context, value, path) {
  context.seen.set(value, path);
  for (const key of Object.keys(value)) visitCheckpointChild(context, { parent: value, key, path: [...path, key] });
}

function visitCheckpointChild(context, { parent, key, path }) {
  const value = parent[key];
  if (value && typeof value === 'object') {
    const original = context.seen.get(value);
    if (original) { context.metadata.references.push([path, original]); return; }
    visitCheckpointValue(context, value, path);
    return;
  }
  if (value === undefined || (typeof value === 'number' && (!Number.isFinite(value) || Object.is(value, -0)))) {
    context.metadata.scalars.push([path, Object.is(value, -0) ? '-0' : String(value)]);
    parent[key] = null;
  }
}

export function decodeSimulationCheckpoint(snapshot) {
  const { references, scalars, ...payload } = structuredClone(snapshot);
  for (const [path, original] of references) setCheckpointPath(payload, path, readCheckpointPath(payload, original));
  for (const [path, value] of scalars) setCheckpointPath(payload, path, value === 'undefined' ? undefined : Number(value));
  return payload;
}

function readCheckpointPath(value, path) {
  return path.reduce((parent, key) => parent[key], value);
}

function setCheckpointPath(value, path, replacement) {
  const parent = readCheckpointPath(value, path.slice(0, -1));
  parent[path.at(-1)] = replacement;
}
