const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const data=JSON.parse(fs.readFileSync('dist/match3d-pass-recordings.json'));
const modulePromise=import('../dist/match3d-pass-timeline.js');
const distance=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
test('recorded passes keep exact release/arrival/end boundaries and ownership',async()=>{
 const {samplePass,metres}=await modulePromise;
 for(const {record:r} of Object.values(data.examples)){
  const start=samplePass(r,-.35),before=samplePass(r,r.contactAt-1e-6),contact=samplePass(r,r.contactAt),arrival=samplePass(r,r.arrivalAt),end=samplePass(r,r.duration);
  assert.deepEqual(start.ball,before.ball);assert.deepEqual(contact.ball,start.ball);
  assert.ok(distance(arrival.ball,[metres(r.event.toPos)[0],.15,metres(r.event.toPos)[2]])<1e-9);
  assert.equal(before.displayOwnerId,r.event.fromId);assert.equal(contact.displayOwnerId,null);assert.equal(end.displayOwnerId,r.event.toId);
  assert.equal(r.contactAt,r.duration*.19);assert.equal(r.arrivalAt,r.duration*.76);
 }
});
test('0.5/1/2 speed use one time; speed changes and pause do not restart a pose or camera',async()=>{
 const {createReplayClock,samplePass}=await modulePromise,r=data.examples.long.record;
 for(const speed of [.5,1,2]){const c=createReplayClock(0);c.setSpeed(speed);c.play();c.advance(.2/speed);assert.equal(c.time,.2);}
 const c=createReplayClock(0);c.play();c.advance(.17);const before=samplePass(r,c.time);c.pause();c.advance(12);c.setSpeed(2);assert.deepEqual(samplePass(r,c.time),before);c.play();c.advance(.01);assert.equal(c.time,.19);
});
test('continuous ball and camera paths, failed pass never produces successful control',async()=>{
 const {samplePass}=await modulePromise;
 for(const {record:r}of Object.values(data.examples)){
  for(const t of [0,r.contactAt,r.arrivalAt,r.duration,r.endAt]){const a=samplePass(r,t-1e-7),b=samplePass(r,t+1e-7);assert.ok(distance(a.ball,b.ball)<1e-4);assert.ok(distance(a.camera.focus,b.camera.focus)<1e-4);}
 }
 const r=data.examples.intercepted.record;for(let t=0;t<1;t+=.01)assert.equal(samplePass(r,t).controlSuccessful,false);
});
test('world-space stance targets stay planted; gait phase is travelled distance rather than wall time',async()=>{
 const {samplePass}=await modulePromise,r=data.examples.long.record,previous=new Map();let comparisons=0;
 for(let t=0;t<r.arrivalAt*.60;t+=.001){const s=samplePass(r,t);for(let foot=0;foot<2;foot++)if(s.receiver.planted[foot]){const key=s.receiver.plantKeys[foot],point=foot?s.receiver.rightFoot:s.receiver.leftFoot;if(previous.has(key)){assert.ok(distance(point,previous.get(key))<1e-9);comparisons++;}previous.set(key,point);}}
 assert.ok(comparisons>50);
});
