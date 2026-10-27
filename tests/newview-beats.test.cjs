// Characterization of the 3D view's special-move beats: every move and keeper scenario the director can
// stage outside a match (the star transfer scene's show, "İzle") is played on the little stage at the
// view's fixed step, and what the picture would show is recorded: every player's place, heading and
// posed bones, and the ball, frame by frame. The record is compared with tests/golden/beats.json, so a beat
// moved between files or a director function given an object parameter must play exactly as before.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { hash, matchJSON } = require('./support/golden.cjs');

const SRC = path.join(__dirname, '..', 'src');
const NEWVIEW = path.join(SRC, 'core/presentation/match3d/newview');
const MOVES = JSON.parse(fs.readFileSync(path.join(SRC, 'data/moves.json'), 'utf8')).moves.map(m => m.id);
// the keeper review scenarios stage() knows besides the moves
const KEEPER_SCENES = ['gkthrow', 'gkvolley', 'gkclaim', 'gkcarry', 'gkfoot', 'gkpunch', 'gkrush', 'gkrushgoal', 'gkpen', 'gkpengoal', 'gksave', 'gkcatch', 'gkmove', 'gkstar', 'gkcorner', 'gkstarown', 'crosshead'];
const OWN_KEEPER = new Set(['scorpion', 'gkthrow', 'gkvolley', 'gkcarry', 'gkpunch', 'gkrush', 'gkrushgoal', 'gkpen', 'gkpengoal', 'gkstarown']);
const FRAME = 1 / 60, STEPS = 2, MAX_SECONDS = 14;
const club = { name: 'Ev', primaryColor: '#c8102e', secondaryColor: '#ffffff', shortName: 'EV' };
const away = { name: 'Rakip', primaryColor: '#55646b', secondaryColor: '#d8dedc', shortName: 'RK' };

let kit = null;
async function load() {
  if (kit) return kit;
  const THREE = await import('three');
  const { loadRig } = await import(path.join(NEWVIEW, 'rig.js'));
  const { createRuntime, analyseGait } = await import(path.join(NEWVIEW, 'runtime.js'));
  const { createDirector } = await import(path.join(NEWVIEW, 'director.js'));
  const { stageRoster } = await import(path.join(NEWVIEW, 'stage-roster.js'));
  const rig = loadRig(JSON.parse(fs.readFileSync(path.join(SRC, 'assets/models/footballer-rig.json'), 'utf8')));
  const gait = {}; for (const k of ['walk', 'run', 'sprint']) gait[k] = analyseGait(rig.newInstance().group, rig.clips[k]);
  kit = { THREE, rig, gait, createRuntime, createDirector, stageRoster };
  return kit;
}

const r4 = v => Math.round(v * 1e4) / 1e4;
function frameOf(rt) {
  return [rt.players.map(p => [p.key, r4(p.pos.x), r4(p.pos.z), r4(p.heading), Object.values(p.bones).map(b => [r4(b.quaternion.x), r4(b.quaternion.y), r4(b.quaternion.z), r4(b.quaternion.w)])]),
    [r4(rt.ball.p.x), r4(rt.ball.p.y), r4(rt.ball.p.z)]];
}

function stagedDirector(kind, rt, said) {
  const { createDirector, stageRoster } = kit;
  const player = { id: 7, name: 'Yıldız', no: 10, pos: OWN_KEEPER.has(kind) ? 'GK' : 'CAM', keeper: OWN_KEEPER.has(kind) };
  const { user, opp, snaps } = stageRoster(player, kind);
  return createDirector(rt, { events: [], snaps, meta: { user, opp, teams: { home: club, away }, userHome: true } }, {
    say() {}, banner() {}, flash() {}, offsideLine() {}, score() {}, minute() {}, whistle() {}, finished() {},
    excite: v => said.push(['excite', v]), cam: (mode, a) => said.push(['cam', mode, a?.key ?? null]), slow: s => said.push(['slow', s]),
    star: (a, p) => said.push(['star', a.kind, p.key]),
  }, { startIndex: 0 });
}

// one frame as the scenes play it: two simulation steps, then the bodies posed
function playFrame(rt, director) {
  for (let i = 0; i < STEPS; i++) {
    rt.S.t += FRAME / STEPS; director.update();
    for (const p of rt.players) if (!p.offPitch) rt.move(p, FRAME / STEPS);
    rt.stepBall(FRAME / STEPS); rt.contacts();
  }
  for (const p of rt.players) if (!p.offPitch) rt.pose(p, FRAME);
}

async function playStaged(kind, seed) {
  const { THREE, rig, gait, createRuntime } = await load();
  const rt = createRuntime({ scene: new THREE.Scene(), rig, gait, ramp: null, numberTexture: null, cadence: 1, stride: 0.75 });
  const said = [], frames = [];
  const director = stagedDirector(kind, rt, said);
  const staged = director.stage(kind, seed == null ? undefined : { seed });
  for (let t = 0; director.staging && t < MAX_SECONDS; t += FRAME) { playFrame(rt, director); frames.push(frameOf(rt)); }
  const skills = (director.stats.skills || []).map(a => a.kind);
  return { staged, frames: frames.length, finished: !director.staging, skills, said: hash(said), poses: hash(frames), end: frames.at(-1)?.[1] ?? null };
}

for (const kind of [...MOVES, ...KEEPER_SCENES]) {
  test(`staged beat plays exactly as recorded: ${kind}`, async () => {
    const record = await playStaged(kind);
    assert.ok(record.frames > 0, 'the move plays');
    matchJSON(`beats/${kind}`, record);
  });
}

test('a staged move\'s seed decides its variant: the same seed plays the same, another can go the other way', async () => {
  const a = await playStaged('nutmeg', 20), b = await playStaged('nutmeg', 20), base = await playStaged('nutmeg');
  assert.deepEqual(a, b);
  assert.notEqual(a.poses, base.poses, 'seed 20 sends him round the other side of the defender than the default');
  assert.deepEqual(a.skills, ['nutmeg']);
});

test('our keeper\'s star save is staged with our keeper making it', async () => {
  const record = await playStaged('gkstarown');
  assert.deepEqual(record.skills, ['starsave']);
});
