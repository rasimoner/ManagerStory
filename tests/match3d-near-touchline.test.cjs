const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('actual near roof occludes bottom touchline despite valid ground frame; live broadcast removes only that occluder',async()=>{
 const T=await import('../dist/vendor/three/three.module.min.js'),{setLiveStadiumVisibility}=await import('../dist/match3d-scene.js'),{createLivePoseSampler}=await import('../dist/match3d-live-view.js');
 const source=fs.readFileSync('dist/match3d-scene.js','utf8'),body=source.slice(source.indexOf('function stadium('),source.indexOf('// The fixed broadcast'));
 const box=(parent,size,pos,mat)=>{const m=new T.Mesh(new T.BoxGeometry(...size),mat);m.position.set(...pos);parent.add(m);return m};
 const build=new Function('T','surface','box','tube','textureCanvas',body+';return stadium;')(T,c=>new T.MeshBasicMaterial({color:c}),box,()=>{},()=>new T.Texture());
 const scene=new T.Scene(),stadium=build(scene,{name:'Test',primaryColor:'#f3c623',secondaryColor:'#b3132b'});scene.updateMatrixWorld(true);
 const roof=stadium.userData.nearCanopy;assert.ok(roof);assert.equal(roof.position.z,49);const original=stadium.children.map(x=>[x,x.visible]);let hits=0;
 for(const aspect of [.55,.75,1,1.5])for(const dir of [-1,1]){
  const s={presentation:{seconds:1,progress:0,activeEvent:null},ball:{displayPosition:[dir>0?70:30,100],displayOwnerId:null},players:[]},v=createLivePoseSampler()(s,{aspect}),f=new T.Vector3(...v.camera.focus),camera=new T.PerspectiveCamera(45,aspect,.1,320);camera.position.set(f.x,24,f.z+38);camera.lookAt(f);camera.fov=T.MathUtils.radToDeg(2*Math.atan(v.camera.span/aspect*.5/camera.position.distanceTo(f)));camera.updateProjectionMatrix();camera.updateMatrixWorld();
  // Sample rays that land within the visible pitch near the bottom touchline.
  for(let z=30;z<=34;z+=.5){const target=new T.Vector3(dir*21,0,z),ndc=target.clone().project(camera);if(Math.abs(ndc.x)>1||Math.abs(ndc.y)>1)continue;const ray=new T.Raycaster(camera.position,target.clone().sub(camera.position).normalize());const contact=ray.intersectObject(roof);if(contact.length&&contact[0].distance<camera.position.distanceTo(target))hits++;}
  setLiveStadiumVisibility(stadium,true);assert.equal(roof.visible,false);for(const [o,visible]of original)if(o!==roof)assert.equal(o.visible,visible);
  setLiveStadiumVisibility(stadium,false);assert.equal(roof.visible,true);
 }
 assert.ok(hits>0,'ray measurement reproduces actual elevated roof in front of pitch');
 assert.ok(source.includes("setLiveStadiumVisibility(stadiumShell,cameraRig.mode==='broadcast')"));
});
test('renderer-only fix preserves two-match engine RNG career and single result',async()=>{
 const {setup,full}=await import('../tools/match3d-round2-audit.mjs');for(const seed of [1,8800]){const a=full(setup(true,'908fafcf612580320424554b9dcc7312bbb967fd'),seed),b=full(setup(),seed);assert.equal(a.raw,b.raw);assert.equal(a.career,b.career);assert.equal(b.singleResult,true);assert.equal(b.pending,false);}
});
