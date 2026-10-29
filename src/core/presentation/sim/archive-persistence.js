import { presentation } from '../registry.js';

export function installSimulationArchiveWorker() {
  if (typeof Worker !== 'function') return;
  const jobs = new Map();
  const state = { worker: null, sequence: 0 };
  presentation.archivePersistence = { compress: json => compressInArchiveWorker(state, jobs, json) };
}

function compressInArchiveWorker(state, jobs, json) {
  return new Promise((resolve, reject) => {
    const id = ++state.sequence;
    jobs.set(id, { resolve, reject });
    try { archiveWorker(state, jobs).postMessage({ id, json }); }
    catch (error) { jobs.delete(id); reject(error); }
  });
}

function archiveWorker(state, jobs) {
  if (state.worker) return state.worker;
  const worker = new Worker(new URL('./archive-worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = event => finishArchiveJob(jobs, event.data);
  worker.onerror = event => {
    event.preventDefault();
    for (const job of jobs.values()) job.reject(new Error(event.message));
    jobs.clear();
    worker.terminate();
    state.worker = null;
  };
  state.worker = worker;
  return worker;
}

function finishArchiveJob(jobs, result) {
  const job = jobs.get(result.id);
  if (!job) return;
  jobs.delete(result.id);
  if (result.error) job.reject(new Error(result.error));
  else job.resolve(result.data);
}
