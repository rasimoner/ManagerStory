const test = require('node:test');
const assert = require('node:assert/strict');
const { labFixture, plain } = require('./support/lab.cjs');
const { loadGame } = require('./support/game.cjs');
const { sceneFixture } = require('./support/simulation-scene.cjs');

function freeKick(position, direction = 1, skill = 90) {
  const { api, input } = labFixture({ seed: 73 }); input.match = false;
  input.teams.forEach((team, index) => { team.direction = index ? -direction : direction; });
  const simulation = api.createSimulation(input), owner = simulation.teams[0].players.at(-1);
  owner.position = { ...position }; owner.attributes.technique = owner.attributes.finishing = owner.attributes.composure = skill;
  api.beginSimulationRestart(simulation, { kind: 'freeKick', teamId: 'home', position, taker: owner });
  return { api, simulation, owner };
}

function untilRelease(fixture) {
  let runup = false;
  for (let tick = 0; tick < 1500 && fixture.simulation.ball.restart; tick++) {
    fixture.api.stepSimulation(fixture.simulation);
    runup ||= fixture.simulation.ball.restart?.stage === 'runup';
  }
  assert.equal(fixture.simulation.ball.restart, null);
  return runup;
}

for (const direction of [-1, 1]) {
  test(`a close free kick uses a real run-up, legal wall and physical shot towards ${direction}`, () => {
    const fixture = freeKick({ x: 27 * direction, y: 1 }, direction), { api, simulation, owner } = fixture;
    const spot = { ...simulation.ball.position };
    assert.equal(untilRelease(fixture), true);
    const release = simulation.events.find(e => e.type === 'freeKick'), shot = simulation.events.find(e => e.type === 'shot');
    assert.ok(shot, 'a suitable close free kick is no longer always a short pass');
    assert.equal(release.kind, 'direct'); assert.equal(shot.restartKind, 'freeKick');
    assert.ok(release.nearestOpponentDistance >= 9.15);
    assert.deepEqual(plain(shot.fromPos), spot);
    assert.ok(Math.hypot(owner.position.x - spot.x, owner.position.y - spot.y) < .8);
    const flight = api.predictSimulationBall(simulation.ball, .3);
    assert.ok(flight.height > 1 && flight.position.x * direction > spot.x * direction);
    const keeper = simulation.teams[1].players.find(p => p.slot === 'GK');
    assert.equal(keeper.keeper.shotIndex, simulation.ball.shot.eventIndex);
  });
}

test('long, narrow-angle and low-skill free kicks retain football alternatives', () => {
  for (const [position, skill] of [[{x:-10,y:0},90],[{x:43,y:30},90],[{x:25,y:0},25]]) {
    const fixture = freeKick(position, 1, skill); untilRelease(fixture);
    assert.equal(fixture.simulation.events.some(e => e.type === 'shot'), false);
    assert.ok(fixture.simulation.events.some(e => e.type === 'pass'));
  }
});

test('a save in the run-up resumes the exact same free kick without another random outcome', () => {
  const fixture = freeKick({x:26,y:2});
  for (let i=0;i<1500 && fixture.simulation.ball.restart?.stage!=='runup';i++) fixture.api.stepSimulation(fixture.simulation);
  assert.equal(fixture.simulation.ball.restart?.stage, 'runup');
  const restored = fixture.api.restoreSimulation(fixture.api.snapshotSimulation(fixture.simulation));
  untilRelease(fixture); untilRelease({api:fixture.api,simulation:restored});
  assert.deepEqual(plain(fixture.api.readSimulation(restored)), plain(fixture.api.readSimulation(fixture.simulation)));
});

test('the actual free-kick setup uses the legacy shooter-wall-goal camera in both aspects', async () => {
  const fixture = freeKick({x:27,y:2}), scene = await sceneFixture();
  fixture.api.stepSimulation(fixture.simulation);
  const frame = loadGame({quiet:true}).api.sampleSimulationScene({ frame: loadGame({quiet:true}).api.captureSimulationFrame(fixture.simulation) }, { immediate:true });
  const camera = scene.api.simulationCameraShot(frame, 'auto');
  assert.equal(camera.mode, 'shot');
  assert.ok(camera.a && camera.b);
  for(const aspect of [390/844,844/390]) {
    const perspective = new scene.THREE.PerspectiveCamera();
    scene.api.createSimulationCamera(perspective).update(frame,0,{aspect,mode:'auto'});
    perspective.updateMatrixWorld(true);
    for(const point of scene.api.simulationCameraPoints(frame)) {
      const projected = point.clone().project(perspective);
      assert.ok(Math.abs(projected.x)<1 && Math.abs(projected.y)<1);
    }
  }
});

test('the reacting wall actually blocks a high ball inside its jumping body and leaves a low gap', () => {
  const { api } = labFixture();
  const player = { position:{x:0,y:0}, duel:{wallJump:{start:0}} };
  const motion = { before:{position:{x:-1,y:0},velocity:{x:20,y:0},height:2,verticalVelocity:0},
    after:{position:{x:1,y:0}},seconds:.1,startTime:.25,radius:.72 };
  assert.equal(api.simulationContactFraction({...player,duel:{}},{x:0,y:0},motion),null);
  assert.ok(api.simulationContactFraction(player,{x:0,y:0},motion)!=null);
  const low = {...motion,before:{...motion.before,height:0}};
  assert.equal(api.simulationContactFraction(player,{x:0,y:0},low),null);
});

test('the actual taker boot meets the real released ball without moving the root', async () => {
  const fixture = freeKick({x:27,y:1}), scene = await sceneFixture(), game = loadGame({quiet:true});
  untilRelease(fixture);
  const frame = game.api.sampleSimulationScene({frame:game.api.captureSimulationFrame(fixture.simulation)},{immediate:true});
  scene.actors.apply(frame);
  const actor = scene.runtime.players.find(p=>p.id===fixture.owner.id), target = new scene.THREE.Vector3().copy(frame.ball.position);
  const gaps = ['Left','Right'].map(side=>actor.bones[side+'ToeBase'].getWorldPosition(new scene.THREE.Vector3()).distanceTo(target));
  assert.ok(Math.min(...gaps)<.2);
  assert.equal(actor.pos.x,fixture.owner.position.x);
});
