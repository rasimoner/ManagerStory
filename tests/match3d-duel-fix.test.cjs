const test=require('node:test'),assert=require('node:assert/strict');let result;
async function audit(){return result??=(await import('../tools/match3d-duel-fix-audit.mjs')).audit();}
test('real 8800/72 and 1/48 coincident duels start continuously and use bounded continuous paths',async()=>{
 const a=await audit();for(const seed of [8800,1]){const pair=a.examples.find(x=>x.after.seed===seed&&x.before.D>20),r=pair.after;
  assert.ok(r.D>2&&r.D<6);assert.ok(r.startBoundaryAttacker<1e-9&&r.startBoundaryDefender<1e-9);assert.ok(r.infinitesimalDefenderStep<1e-6);
  assert.ok(pair.before.startBoundaryDefender>.69&&pair.before.infinitesimalDefenderStep>1);
  for(const phase of r.phases){assert.ok(phase.maxAttacker<=6.001&&phase.maxDefender<=6.001);assert.ok(Number.isFinite(phase.maxBall));}
  assert.ok(r.boundary.ball<.01&&r.boundary.roots<.01);assert.ok(r.phases.find(x=>x.name==='contact/ownership').seconds<.25);
 }
});
test('same real chain in both views preserves selected rates, pause/switch state and next pass without frame debt',async()=>{
 const a=await audit();for(const r of a.controls){assert.ok(r.frozen);assert.ok(r.peakRoot<=6.001*r.speed);assert.deepEqual(Array.from(r.seen),[72,76]);assert.ok(Math.abs(r.passDuration-.7902079312164844)<1e-9);
  for(const f of r.frames)assert.ok(Math.abs(f.advance-Math.min(f.dt,.12)*r.speed)<1e-9);
  const other=a.controls.find(x=>x.view!==r.view&&x.speed===r.speed);assert.equal(r.peakRoot,other.peakRoot);assert.deepEqual(r.frames,other.frames);
 }
});
test('two full real matches change only duel budgets, preserve engine/RNG/career and drain exactly once',async()=>{
 const a=await audit();for(const r of a.matches){assert.ok(r.changed.length>0&&r.changed.every(x=>x.contest));assert.ok(r.clipDelta<0);assert.ok(Math.abs(r.clipDelta-r.changed.reduce((n,x)=>n+x.after-x.before,0))<1e-8);
  assert.equal(r.before.clipCount,r.after.clipCount);assert.ok(Math.abs(r.wallDelta-r.clipDelta)<.5,'only atomic frame boundary rounding besides duel budgets');
  for(const m of [r.before,r.after]){assert.ok(m.finished&&!m.pending&&m.engineEqual&&m.careerEqual&&m.singleCareerApply);assert.equal(m.endCount,1);}
 }
});
