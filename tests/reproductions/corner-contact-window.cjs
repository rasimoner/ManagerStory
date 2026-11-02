// Replay one actual corner without changing players, the ball, decisions or RNG.
const assert = require('node:assert/strict');
const { inflateSync } = require('node:zlib');
const { loadNativeLab } = require('../support/lab.cjs');
const archive = require('./corner-before-delivery.json');

async function reproduce() {
  const api = await loadNativeLab(['restoreSimulation', 'stepSimulation']);
  const simulation = api.restoreSimulation(JSON.parse(inflateSync(Buffer.from(archive.data, 'base64')).toString()));
  const start = simulation.events.length;
  for (let tick = 0; tick < 100 && !simulation.events.slice(start).some(event => event.type === 'goal'); tick++) api.stepSimulation(simulation);
  const events = simulation.events.slice(start), goals = events.filter(event => event.type === 'goal');
  assert.equal(goals.length, 1);
  assert.ok(Math.abs(goals[0].time - 335.5987380052179) < 1e-9);
  assert.equal(events.find(event => event.type === 'firstTouch').toId, 'home-ST');
  assert.equal(events.find(event => event.type === 'shot').fromId, 'home-ST');
  console.log(JSON.stringify({ node: process.version, goalTime: goals[0].time, events: events.map(event => ({ type: event.type, time: event.time })) }));
}
reproduce().catch(error => { console.error(error.message); process.exitCode = 1; });
