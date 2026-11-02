// Diagnostic only: existing career fixture failures stay visible without changing the default CI gates.
const { recordedSceneCareers } = require('../support/scene-careers.cjs');
const { restorationCareers } = require('../support/restoration-careers.cjs');

const gates = [['camera-scenes', recordedSceneCareers], ['restoration-skill', restorationCareers]];
const results = [];
for (const [name, prepare] of gates) {
  try { prepare(); results.push({ name, status: 'passed' }); }
  catch (error) { results.push({ name, status: 'failed', message: error.message }); }
}
console.log(JSON.stringify({ node: process.version, source: 'unchanged career fixtures; no browser needed', results }, null, 2));
process.exitCode = results.some(result => result.status === 'failed') ? 1 : 0;
