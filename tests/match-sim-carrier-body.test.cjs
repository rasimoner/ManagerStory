const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLab } = require('./support/lab.cjs');

const wrap = angle => Math.atan2(Math.sin(angle), Math.cos(angle));

function naturalMatch(api, seed) {
  const input = api.createLabScenario({ seed });
  input.durationSeconds = 420;
  return api.createSimulation(input);
}

// Walks a natural-length match and hands every settled tick where a field player has the ball to the observer.
function watchCarriers(api, seed, observe) {
  const simulation = naturalMatch(api, seed);
  let owned = 0, spell = { id: null, ticks: 0 };
  for (let tick = 0; tick < 2400 && simulation.match.phase !== 'ended'; tick++) {
    if (simulation.paused) api.resumeSimulation(simulation);
    api.stepSimulation(simulation);
    const ball = simulation.ball;
    const owner = simulation.teams.flatMap(team => team.players).find(player => player.id === ball.ownerId);
    if (!owner || owner.slot === 'GK') { spell = { id: null, ticks: 0 }; continue; }
    spell = spell.id === owner.id ? { id: owner.id, ticks: spell.ticks + 1 } : { id: owner.id, ticks: 0 };
    owned++;
    // The ball is still arriving at a fresh owner's feet; it settles over the first moments.
    if (spell.ticks >= 8 && !ball.control) observe({ owner, ball, tick });
  }
  assert.ok(owned > 300, `only ${owned} carried ticks`);
}

test('a carrier running at speed keeps the ball on his running line, not beside it', () => {
  const { api } = loadLab();
  for (const seed of [1, 2, 3]) watchCarriers(api, seed, ({ owner, ball, tick }) => {
    const speed = Math.hypot(owner.velocity.x, owner.velocity.y);
    if (speed < 2.5) return;
    const toBall = Math.atan2(ball.position.y - owner.position.y, ball.position.x - owner.position.x);
    const gap = Math.abs(wrap(Math.atan2(owner.velocity.y, owner.velocity.x) - toBall));
    assert.ok(gap <= 0.9, `seed ${seed} tick ${tick}: ${owner.id} runs ${speed.toFixed(1)} m/s with the ball ${gap.toFixed(2)} rad off his path`);
  });
});

test('a carrier who turns on the spot does not make the ball orbit him', () => {
  const { api } = loadLab();
  for (const seed of [1, 2, 3]) {
    const swing = new Map();
    watchCarriers(api, seed, ({ owner, ball, tick }) => {
      if (Math.hypot(owner.velocity.x, owner.velocity.y) >= 0.6) { swing.delete(owner.id); return; }
      const angle = Math.atan2(ball.position.y - owner.position.y, ball.position.x - owner.position.x);
      const before = swing.get(owner.id);
      swing.set(owner.id, { angle, tick });
      if (before?.tick !== tick - 1) return;
      const orbit = Math.abs(wrap(angle - before.angle));
      assert.ok(orbit <= 0.2, `seed ${seed} tick ${tick}: the ball circled ${owner.id} by ${orbit.toFixed(2)} rad in one step`);
    });
  }
});

test('the scene turns a running carrier\'s body toward his path, but leaves a jockeying defender facing the ball', () => {
  const { loadGame } = require('./support/game.cjs'), game = loadGame({ quiet: true });
  const runner = id => ({ id, heading: 0.9, position: { x: 0, y: 0 }, velocity: { x: 5, y: 0 } });
  const frame = physicsTime => ({ tick: 1, half: 1, phase: 'play', physicsTime, matchTime: 10, players: [runner('carrier'), runner('defender')], contacts: [],
    ball: { position: { x: 0.35, y: 0 }, height: 0, velocity: { x: 5, y: 0 }, ownerId: 'carrier' } });
  const scene = game.api.sampleSimulationScene({ previousFrame: frame(0), frame: frame(0.1), accumulatorSeconds: 0.1 });
  const body = id => Math.abs(wrap(Math.PI / 2 - scene.players.find(player => player.id === id).heading));
  assert.ok(body('carrier') <= 0.46, `the carrier's body is ${body('carrier').toFixed(2)} rad off his path`);
  assert.ok(Math.abs(body('defender') - 0.9) < 0.01, 'a player without the ball keeps the simulated heading');
});
