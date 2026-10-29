import { compressSimulationArchive, decompressSimulationArchive } from './archive-codec.js';

const ARCHIVED_FIELDS = ['simulationCheckpoint', 'simulationPlayback', 'simulationDisplayFrame', 'events', 'story'];

export function packExperimentalMatch(snapshot) {
  const packed = { ...snapshot }, archive = {};
  for (const field of ARCHIVED_FIELDS) { archive[field] = packed[field]; delete packed[field]; }
  packed.simulationArchive = { encoding: 'lzw-varint-base64', data: compressSimulationArchive(JSON.stringify(archive)) };
  return packed;
}

export function unpackMatchSnapshot(snapshot) {
  const unpacked = structuredClone(snapshot);
  if (!unpacked.simulationArchive) return unpacked;
  if (unpacked.simulationArchive.encoding !== 'lzw-varint-base64') throw new TypeError('Unsupported simulation archive.');
  const archive = JSON.parse(decompressSimulationArchive(unpacked.simulationArchive.data));
  for (const field of ARCHIVED_FIELDS) unpacked[field] = archive[field];
  delete unpacked.simulationArchive;
  return unpacked;
}
