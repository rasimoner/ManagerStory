import { compressSimulationArchive, decompressSimulationArchive, SIMULATION_ARCHIVE_ENCODING } from './archive-codec.js';

// A committed summary is immutable; repeated autosaves reuse its compressed representation.
const packedSummaries = new WeakMap();

export function packSimulationHistory(state) {
  if (!hasSimulationHistory(state)) return state;
  return { ...state, results: state.results.map(result => ({ ...result, matchSummary: packSimulationSummary(result.matchSummary) })),
    v71: { ...state.v71, lastMatch: packSimulationSummary(state.v71?.lastMatch) } };
}

function hasSimulationHistory(state) {
  return state.results?.some(result => result.matchSummary?.engine === 'continuous') || state.v71?.lastMatch?.engine === 'continuous';
}

function packSimulationSummary(summary) {
  if (summary?.engine !== 'continuous') return summary;
  if (!packedSummaries.has(summary)) packedSummaries.set(summary, { engine: 'continuous',
    archive: { encoding: SIMULATION_ARCHIVE_ENCODING, data: compressSimulationArchive(JSON.stringify(summary)) } });
  return packedSummaries.get(summary);
}

export function restoreSimulationHistory(state) {
  for (const result of state.results ?? []) result.matchSummary = unpackSimulationSummary(result.matchSummary);
  if (state.v71?.lastMatch) state.v71.lastMatch = unpackSimulationSummary(state.v71.lastMatch);
  return state;
}

function unpackSimulationSummary(summary) {
  if (!summary?.archive) return summary;
  const restored = JSON.parse(decompressSimulationArchive(summary.archive.data, summary.archive.encoding));
  packedSummaries.set(restored, summary);
  return restored;
}
