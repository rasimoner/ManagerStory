import { compressSimulationArchive, decompressSimulationArchive, SIMULATION_ARCHIVE_ENCODING } from './archive-codec.js';

const ARCHIVED_FIELDS = ['simulationCheckpoint', 'simulationPlayback', 'simulationDisplayFrame', 'events', 'story', 'minuteEvents'];

export function packExperimentalMatch(snapshot) {
  const { packed, json } = prepareExperimentalMatchArchive(snapshot);
  return completeExperimentalMatchArchive(packed, compressSimulationArchive(json));
}

export function prepareExperimentalMatchArchive(snapshot) {
  const packed = { ...snapshot }, archive = {};
  for (const field of ARCHIVED_FIELDS) { archive[field] = packed[field]; delete packed[field]; }
  const events = new Set(archive.events);
  if (archive.minuteEvents?.every(event => events.has(event))) {
    archive.minuteEventIds = archive.minuteEvents.map(event => event.eventId);
    delete archive.minuteEvents;
  }
  return { packed, json: JSON.stringify(archive) };
}

export function completeExperimentalMatchArchive(packed, data) {
  return { ...packed, simulationArchive: { encoding: SIMULATION_ARCHIVE_ENCODING, data } };
}

export function unpackMatchSnapshot(snapshot) {
  const unpacked = structuredClone(snapshot);
  if (!unpacked.simulationArchive) return unpacked;
  const archive = JSON.parse(decompressSimulationArchive(unpacked.simulationArchive.data, unpacked.simulationArchive.encoding));
  for (const field of ARCHIVED_FIELDS) if (Object.hasOwn(archive, field)) unpacked[field] = archive[field];
  if (archive.minuteEventIds) {
    const events = new Map(unpacked.events.map(event => [event.eventId, event]));
    unpacked.minuteEvents = archive.minuteEventIds.map(id => events.get(id));
  }
  delete unpacked.simulationArchive;
  return unpacked;
}
