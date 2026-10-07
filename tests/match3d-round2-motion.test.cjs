const test=require('node:test'),assert=require('node:assert/strict');
test('real keeper routes on both goals include whole-body dive/landing/recovery, preserve bones, and distinguish catch from corner',async()=>{
 const {motionExamples}=await import('../tools/match3d-round2-audit.mjs'),a=await motionExamples();
 for(const id of [49,99,427]){const rows=a.filter(x=>x.seed===8800&&x.id===id);assert.equal(rows.length,8);const airborne=rows.find(x=>x.p===.72),contact=rows.find(x=>x.p===.76),recover=rows.find(x=>x.p===.99);assert.ok(Math.abs(airborne.roll)>.8);assert.ok(airborne.feet.every(x=>x[1]>.2));assert.ok(Math.abs(recover.roll)<.03);assert.equal(contact.phase,'contact-and-land');assert.equal(recover.phase,id===427?'release-and-recover':'gather');assert.equal(contact.owner,id===49?0:id===99?'o0':null);assert.ok(contact.contactGap<.2);
  for(const row of rows)row.lengths.forEach((v,i)=>assert.ok(Math.abs(v-rows[0].lengths[i])<1e-8,'approved limb lengths remain constant'));
 }assert.deepEqual([...new Set(a.filter(x=>x.id===49||x.id===99).map(x=>x.direction))].sort(),[-1,1]);
 const body=a.find(x=>x.seed===2&&x.p===.76);assert.equal(body.kind,'body');assert.equal(body.roll,0);assert.equal(body.owner,null);
 const field=a.find(x=>x.seed===24&&x.p===.76);assert.equal(field.kind,'field-block');assert.equal(field.actor,'o2');
});
