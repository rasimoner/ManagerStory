const { sceneFixture } = require('./simulation-scene.cjs');

async function keeperScene(options = {}) {
  const fixture = await sceneFixture();
  const sample = { id: 91, number: 1, slot: 'GK', teamId: 'opponent', direction: 1, heading: Math.PI / 2,
    position: { x: 48, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, distanceMetres: 0,
    motionMode: 'running', duel: {}, ...options };
  sample.keeper = { mode: 'dive', reactionAt: 1, shotIndex: 0, launchPosition: { x: 48, y: 0 },
    target: { x: 52.61, y: 2.6, height: .4 }, ...options.keeper };
  const frame = { physicsTime: 0, matchTime: 0, half: 1, phase: 'playing', players: [sample], contacts: [],
    ball: { position: { x: 47, y: .51, z: 2.6 }, velocity: { x: 22, y: 0, z: 0 }, ownerId: null, heldBy: null } };
  function draw(time) {
    frame.physicsTime = time;
    fixture.actors.apply(frame);
    return fixture.runtime.players[0];
  }
  function bone(name) { return fixture.runtime.players[0].bones[name].getWorldPosition(new fixture.THREE.Vector3()); }
  function points() { return Object.fromEntries(Object.keys(fixture.runtime.players[0].bones).map(name => [name, bone(name)])); }
  return { ...fixture, sample, frame, draw, bone, points };
}

module.exports = { keeperScene };
