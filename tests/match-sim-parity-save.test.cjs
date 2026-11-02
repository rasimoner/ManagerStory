const test=require('node:test');
const assert=require('node:assert/strict');
const {loadGame}=require('./support/game.cjs');
const {labFixture,plain}=require('./support/lab.cjs');

test('format 6 raw and archived checkpoints add optional feature state without changing football',()=>{
  const game=loadGame({quiet:true}),{simulation}=labFixture({seed:73});
  const checkpoint=plain(game.api.snapshotSimulation(simulation));
  for(const archived of [false,true]) {
    const active={experimental:true,simulationCheckpoint:checkpoint,events:[]};
    const career={schemaVersion:6,players:[],activeMatchV71:archived?game.api.packExperimentalMatch(active):active};
    game.api.migrateSave(career);
    assert.equal(career.schemaVersion,game.api.SAVE_SCHEMA);
    const after=game.api.unpackMatchSnapshot(career.activeMatchV71).simulationCheckpoint;
    assert.equal(after.state.offside,null);
    delete after.state.offside;
    assert.equal(after.state.passing.technique,null);
    delete after.state.passing.technique;
    assert.deepEqual(plain(after),checkpoint);
  }
});
