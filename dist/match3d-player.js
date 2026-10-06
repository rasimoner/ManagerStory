import * as T from './vendor/three/three.module.min.js';
// Geometry copied from approved study commit 33a2cda1cde1adda7f0a6027786921b2d8183faa.
// Only model construction is adapted; study RAF, ball and animation are excluded.
export const JOINTS=[
 ['pelvis',-1,0,.97,0],['spine',0,0,0,0],['neck',1,0,.58,0],['head',2,0,.155,.007],
 ['leftShoulder',1,-.203,.46,0],['leftElbow',4,0,-.285,0],['leftHand',5,0,-.285,0],
 ['rightShoulder',1,.203,.46,0],['rightElbow',7,0,-.285,0],['rightHand',8,0,-.285,0],
 ['leftHip',0,-.10,-.012,0],['leftKnee',10,0,-.445,0],['leftAnkle',11,0,-.435,0],
 ['rightHip',0,.10,-.012,0],['rightKnee',13,0,-.445,0],['rightAnkle',14,0,-.435,0]
];
export const MODEL_CONTACTS=Object.freeze({forehead:[0,.045,.095],toe:[0,-.055,.17],soleY:-.09});
let sharedGeometry;
const materialCache=new Map(),toonCache=new Map(),labelCache=new Map();let sharedOutline;
const toon=color=>{if(!toonCache.has(color))toonCache.set(color,new T.MeshToonMaterial({color}));return toonCache.get(color);};
const label=(text,large)=>{const key=JSON.stringify([text,large]);if(!labelCache.has(key))labelCache.set(key,new T.MeshBasicMaterial({map:labelTexture(text,large),transparent:true,depthWrite:false}));return labelCache.get(key);};
// Scene disposal owns GPU resources. Drop cache references after its disposal.
export function releaseFootballerResources(){sharedGeometry=undefined;sharedOutline=undefined;materialCache.clear();toonCache.clear();labelCache.clear();}
function buildGeometry(){
 const root=new T.Group(),slots=Array.from({length:13},()=>new T.MeshBasicMaterial());
 const [yellow,red,skin,hair,sock,boot,dark,white,outlineMat,glove]=slots;
 outlineMat.side=T.BackSide;
 const decalMaterials=[slots[10],slots[11],slots[10]];let decalIndex=0;
 const number=7,kit={name:''};
 const mesh=(g,m,parent,x=0,y=0,z=0,outline=true)=>{const o=new T.Mesh(g,m);o.position.set(x,y,z);parent.add(o);if(outline){const edge=new T.Mesh(g,outlineMat);edge.scale.setScalar(1.045);o.add(edge)}return o;};
 function form(profile,depth=1,segments=24){const g=new T.LatheGeometry(profile.map(([r,y])=>new T.Vector2(r,y)),segments);g.scale(1,1,depth);return g;}
 function ellipsoid(parent,mat,pos,scale,outline=true){const m=mesh(new T.SphereGeometry(1,24,18),mat,parent,...pos,outline);m.scale.set(...scale);return m;}
const hips=new T.Group();hips.position.y=.97;root.add(hips);const torso=new T.Group();hips.add(torso);
const shirtGeo=form([[.15,-.035],[.164,.04],[.162,.13],[.181,.29],[.225,.43],[.21,.50],[.102,.55]],.67,32);
const shirt=mesh(shirtGeo,yellow,torso);
// Contrasting half-shirt follows the same surface, rather than a floating panel.
const panelGeo=form([[.15,-.035],[.164,.04],[.162,.13],[.181,.29],[.225,.43],[.21,.50],[.102,.55]],.672,32);
const panelPos=panelGeo.getAttribute('position');const ids=panelGeo.index.array;const keep=[];for(let i=0;i<ids.length;i+=3){if((panelPos.getX(ids[i])+panelPos.getX(ids[i+1])+panelPos.getX(ids[i+2]))/3>0)keep.push(ids[i],ids[i+1],ids[i+2])}panelGeo.setIndex(keep);mesh(panelGeo,red,torso,0,0,.0004,false);
mesh(new T.TorusGeometry(.086,.016,6,28),red,torso,0,.55,0).rotation.x=Math.PI/2;
ellipsoid(torso,skin,[0,.58,0],[.065,.075,.063]);
const head=new T.Group();head.position.set(0,.735,.007);torso.add(head);
const faceGeo=form([[.025,-.147],[.065,-.13],[.09,-.09],[.109,-.035],[.108,.045],[.101,.11],[.06,.145],[.005,.16]],.92,28);mesh(faceGeo,skin,head);
for(const x of [-.111,.111])ellipsoid(head,skin,[x,-.012,-.005],[.021,.040,.022]);
const crown=ellipsoid(head,hair,[0,.095,-.023],[.113,.086,.101]);
for(let i=0;i<5;i++){const tuft=ellipsoid(head,hair,[-.075+i*.035,.147+i*.002,.004],[.035,.028,.080],false);tuft.rotation.z=-.3;}
const nose=ellipsoid(head,skin,[0,-.023,.103],[.018,.029,.024]);
for(const x of [-.042,.042]){ellipsoid(head,white,[x,.021,.096],[.021,.009,.006],false);ellipsoid(head,dark,[x,.021,.102],[.007,.007,.003],false);const brow=mesh(new T.CapsuleGeometry(.004,.034,3,8),hair,head,x,.045,.099,false);brow.rotation.z=Math.PI/2+(x<0?-.1:.1);}
const mouth=mesh(new T.CapsuleGeometry(.003,.035,3,8),slots[12],head,0,-.084,.084,false);mouth.rotation.z=Math.PI/2;
const legs=[];
for(const sign of [-1,1]){const thigh=new T.Group();thigh.position.set(sign*.10,-.012,0);hips.add(thigh);
mesh(form([[.063,-.45],[.072,-.38],[.080,-.28],[.092,-.17],[.095,-.06],[.080,.008]],.87),skin,thigh);
const shorts=mesh(form([[.092,-.24],[.104,-.19],[.102,-.08],[.088,.015]],.92),red,thigh);shorts.rotation.z=sign*.035;
mesh(new T.TorusGeometry(.092,.007,4,20),yellow,thigh,0,-.235,0).rotation.x=Math.PI/2;
const knee=new T.Group();knee.position.y=-.445;thigh.add(knee);
ellipsoid(knee,skin,[0,-.01,.012],[.059,.066,.056],false);
mesh(form([[.025,-.435],[.033,-.35],[.053,-.19],[.058,-.10],[.047,-.023]],.86),skin,knee);
mesh(form([[.026,-.438],[.034,-.36],[.050,-.23],[.055,-.15]],.89),sock,knee);
for(const y of [-.157,-.181]){const trim=mesh(new T.TorusGeometry(.053,.004,4,20),red,knee,0,y,0,false);trim.rotation.x=Math.PI/2;trim.scale.z=.89;}
const ankle=new T.Group();ankle.position.y=-.435;knee.add(ankle);
ellipsoid(ankle,boot,[0,-.032,.046],[.057,.047,.118]);ellipsoid(ankle,dark,[0,-.067,.052],[.060,.015,.124],false);
for(let i=0;i<3;i++){const lace=mesh(new T.CapsuleGeometry(.002,.038,2,6),white,ankle,0,.006,.04+i*.013,false);lace.rotation.z=Math.PI/2;lace.rotation.x=-.15;}
for(const z of [-.025,.12])for(const x of [-.032,.032])mesh(new T.CylinderGeometry(.009,.009,.016,6),dark,ankle,x,-.082,z,false);
legs.push({thigh,knee,ankle,sign});}
const arms=[];
for(const sign of [-1,1]){const upper=new T.Group();upper.position.set(sign*.203,.46,0);torso.add(upper);
ellipsoid(upper,yellow,[sign*.007,-.05,0],[.079,.115,.076]);
mesh(form([[.038,-.29],[.043,-.24],[.061,-.14],[.063,-.08]],.91),skin,upper);
const elbow=new T.Group();elbow.position.y=-.285;upper.add(elbow);ellipsoid(elbow,skin,[0,0,0],[.04,.045,.038],false);
mesh(form([[.023,-.25],[.028,-.20],[.038,-.08],[.039,-.015]],.90),skin,elbow);
const hand=new T.Group();hand.position.set(0,-.285,0);elbow.add(hand);ellipsoid(hand,glove,[0,0,.007],[.030,.052,.027]);ellipsoid(hand,glove,[.024*sign,.011,.024],[.012,.025,.015],false);
arms.push({upper,elbow,hand,sign});}
function decal(text,w,h,parent,x,y,z,back=false){const o=new T.Mesh(new T.PlaneGeometry(w,h),decalMaterials[decalIndex++]);o.position.set(x,y,z);if(back)o.rotation.y=Math.PI;parent.add(o);return o}
decal(number,.13,.18,torso,0,.26,-.132,true);decal(kit.shortName||kit.name||'',.25,.065,torso,0,.36,.133);decal(number,.045,.06,legs[0].thigh,-.025,-.17,.09);
// Small stitched crest and collar details.
const crest=mesh(new T.CircleGeometry(.021,5),red,torso,-.095,.43,.129,false);crest.rotation.z=Math.PI;

 const joints=[hips,torso,null,head,arms[0].upper,arms[0].elbow,arms[0].hand,arms[1].upper,arms[1].elbow,arms[1].hand,legs[0].thigh,legs[0].knee,legs[0].ankle,legs[1].thigh,legs[1].knee,legs[1].ankle];
 root.updateMatrixWorld(true);
 const parts=Array.from({length:13},()=>[]),originals=new Set();
 root.traverse(o=>{if(!o.isMesh)return;let node=o.parent;while(node&&!joints.includes(node))node=node.parent;const bone=joints.indexOf(node);if(bone<0)throw Error('Unbound study surface');originals.add(o.geometry);const g=(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone());g.applyMatrix4(o.matrixWorld);parts[slots.indexOf(o.material)].push({g,bone});});
 const geometry=new T.BufferGeometry(),positions=[],normals=[],uv=[],indices=[],weights=[];
 parts.forEach((batch,material)=>{const start=positions.length/3;for(const {g,bone} of batch){positions.push(...g.attributes.position.array);normals.push(...g.attributes.normal.array);uv.push(...g.attributes.uv.array);for(let i=0;i<g.attributes.position.count;i++){indices.push(bone,0,0,0);weights.push(1,0,0,0);}g.dispose();}geometry.addGroup(start,positions.length/3-start,material);});
 geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
 originals.forEach(g=>g.dispose());slots.forEach(m=>m.dispose());return geometry;
}
function labelTexture(text,large){const c=document.createElement('canvas');c.width=256;c.height=256;const ctx=c.getContext('2d');ctx.fillStyle='#f9eed3';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`bold ${large?190:42}px Arial`;ctx.fillText(String(text),128,128);return new T.CanvasTexture(c);}
export function createFootballer({id,side,number,kit,goalkeeper=false,variant=0}){
 const root=new T.Group();root.name=`footballer:${side}:${id}`;
 const bones=JOINTS.map(([name,,x,y,z])=>{const b=new T.Bone();b.name=name;b.position.set(x,y,z);return b;});
 JOINTS.forEach(([,parent],i)=>(parent<0?root:bones[parent]).add(bones[i]));root.updateMatrixWorld(true);
 const primary=goalkeeper?'#'+new T.Color(kit.secondaryColor).lerp(new T.Color(kit.primaryColor),.35).getHexString():kit.primaryColor;
 const skin=['#bd805a','#a36e48','#77492f','#e2b896','#bd8a60'][variant%5],hair=['#271c18','#382a20','#6c5036','#151b1c'][variant%4];
 const key=JSON.stringify([primary,kit.secondaryColor,skin,hair,goalkeeper,number,kit.shortName||kit.name]);
 let materials=materialCache.get(key);if(!materials){materials=[primary,kit.secondaryColor,skin,hair,'#f1e8d5','#152224','#101b19','#f6f0df'].map(toon);materials.push(sharedOutline??=new T.MeshBasicMaterial({color:0x172020,side:T.BackSide}),toon(goalkeeper?'#f6f0df':skin),label(number,true),label(kit.shortName||kit.name||'',false));materials.push(toon(0x704134));materialCache.set(key,materials);}
 sharedGeometry??=buildGeometry();const mesh=new T.SkinnedMesh(sharedGeometry,materials);root.add(mesh);mesh.bind(new T.Skeleton(bones));mesh.castShadow=true;mesh.receiveShadow=true;
 root.userData={id,side,number,bones:Object.fromEntries(bones.map(b=>[b.name,b])),model:'approved-player-33a2cda',contacts:MODEL_CONTACTS};return root;
}
