import { compressSimulationArchive } from '../../match/archive-codec.js';

self.onmessage = event => {
  const { id, json } = event.data;
  try { self.postMessage({ id, data: compressSimulationArchive(json) }); }
  catch (error) { self.postMessage({ id, error: error.message }); }
};
