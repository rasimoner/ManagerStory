import * as T from './vendor/three/three.module.min.js';
import { createFootballer } from './match3d-player.js';

export const PITCH = Object.freeze({ length:105, width:68, goalWidth:7.32, goalHeight:2.44 });
export const pitchToWorld = xy => new T.Vector3((xy[0]/100-.5)*105,0,(xy[1]/100-.5)*68);

function textureCanvas(width,height,paint) {
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  paint(canvas.getContext('2d'),width,height);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;return texture;
}
const surface = (color,roughness=.9) => new T.MeshStandardMaterial({color,roughness});
function box(parent,size,position,material) {
  const mesh=new T.Mesh(new T.BoxGeometry(...size),material);mesh.position.set(...position);parent.add(mesh);mesh.receiveShadow=true;return mesh;
}
function tube(parent,a,b,r,material) {
  const from=new T.Vector3(...a),to=new T.Vector3(...b),delta=to.clone().sub(from);
  const m=new T.Mesh(new T.CylinderGeometry(r,r,delta.length(),8),material);
  m.position.copy(from).add(to).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());parent.add(m);return m;
}
function fieldPaint(parent) {
  const white=new T.MeshBasicMaterial({color:'#f0f1dc'});
  const segment=(a,b,width=.12)=>{
    const dx=b[0]-a[0],dz=b[1]-a[1];
    const m=new T.Mesh(new T.PlaneGeometry(Math.hypot(dx,dz),width),white);
    m.rotation.x=-Math.PI/2;m.rotation.z=-Math.atan2(dz,dx);m.position.set((a[0]+b[0])/2,.023,(a[1]+b[1])/2);parent.add(m);
  };
  const line=points=>points.slice(1).forEach((p,i)=>segment(points[i],p));
  const arc=(cx,cz,r,from=0,to=Math.PI*2,filter=()=>true)=>{
    let previous=null;for(let i=0;i<=100;i++){
      const a=from+(to-from)*i/100,p=[cx+Math.cos(a)*r,cz+Math.sin(a)*r];
      if(previous&&filter(p)&&filter(previous))segment(previous,p,.12);previous=p;
    }
  };
  line([[-52.5,-34],[52.5,-34],[52.5,34],[-52.5,34],[-52.5,-34]]);
  segment([0,-34],[0,34]);arc(0,0,9.15);
  for(const dir of [-1,1]) {
    line([[dir*52.5,-20.16],[dir*36,-20.16],[dir*36,20.16],[dir*52.5,20.16]]);
    line([[dir*52.5,-9.16],[dir*47,-9.16],[dir*47,9.16],[dir*52.5,9.16]]);
    arc(dir*41.5,0,9.15,0,Math.PI*2,p=>Math.abs(p[0])<36);
    for(const z of [-34,34])arc(dir*52.5,z,1,0,Math.PI*2,p=>Math.abs(p[0])<=52.5&&Math.abs(p[1])<=34);
  }
  for(const x of [-41.5,0,41.5]){
    const dot=new T.Mesh(new T.CircleGeometry(.12,16),white);dot.rotation.x=-Math.PI/2;dot.position.set(x,.025,0);parent.add(dot);
  }
}
function goal(parent,dir) {
  const group=new T.Group();group.name=dir<0?'left-goal':'right-goal';parent.add(group);
  const white=surface('#ecede5'),x=dir*52.5,back=x+dir*2.3;
  for(const z of [-3.66,3.66]) {
    tube(group,[x,0,z],[x,2.44,z],.065,white);
    tube(group,[x,2.44,z],[back,2.3,z],.035,white);
    tube(group,[back,0,z],[back,2.3,z],.035,white);
  }
  tube(group,[x,2.44,-3.66],[x,2.44,3.66],.065,white);
  tube(group,[back,2.3,-3.66],[back,2.3,3.66],.035,white);
  const vertices=[],seg=(a,b)=>vertices.push(...a,...b);
  for(let z=-3.66;z<=3.67;z+=.22){seg([back,0,z],[back,2.3,z]);seg([x,2.44,z],[back,2.3,z]);}
  for(let y=0;y<=2.31;y+=.22){seg([back,y,-3.66],[back,y,3.66]);for(const z of [-3.66,3.66])seg([x,y,z],[back,y,z]);}
  for(let d=0;d<=2.31;d+=.22){const xx=x+dir*d;seg([xx,2.44-d*.06,-3.66],[xx,2.44-d*.06,3.66]);for(const z of [-3.66,3.66])seg([xx,0,z],[xx,2.44-d*.06,z]);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
  group.add(new T.LineSegments(g,new T.LineBasicMaterial({color:'#d7e0db',transparent:true,opacity:.6})));
}
function stadium(scene,home) {
  const stadium=new T.Group();stadium.name='stadium';scene.add(stadium);
  const concrete=surface('#929894'),dark=surface('#263a34'),roof=surface('#667d76');
  for(const z of [-1,1]) {
    for(let row=0;row<12;row++)box(stadium,[123,.34,1.1],[0,1+row*.48,z*(42+row*1.0)],concrete);
    box(stadium,[124,.18,14],[0,9,z*49],roof);
    for(let x=-59;x<=60;x+=15)tube(stadium,[x,0,z*54],[x,9,z*54],.17,dark);
    tube(stadium,[-61,1.8,z*40],[61,1.8,z*40],.055,surface('#c7d0ca'));
  }
  // Seats and spectators share instanced geometry: no thousands of draw calls.
  const seatCount=12*148*2;
  const seats=new T.InstancedMesh(new T.BoxGeometry(.60,.13,.62),surface('#b59c52'),seatCount);
  const torsos=new T.InstancedMesh(new T.CylinderGeometry(.18,.23,.51,5),surface('#a7a094'),seatCount);
  const heads=new T.InstancedMesh(new T.SphereGeometry(.13,6,5),surface('#bc9274'),seatCount);
  const colors=[home.primaryColor,home.secondaryColor,'#486679','#e2d4b2','#33443e','#847972','#213b51'];
  let seed=1937;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
  const dummy=new T.Object3D();let n=0;
  for(const dir of [-1,1])for(let row=0;row<12;row++)for(let col=0;col<148;col++){
    const x=(col-73.5)*.81, y=1.2+row*.48,z=dir*(42+row);
    dummy.position.set(x,y,z);dummy.rotation.set(0,0,0);dummy.updateMatrix();seats.setMatrixAt(n,dummy.matrix);
    const aisle=col%25<2,occupied=!aisle&&random()>(col>100?.28:.12);
    const height=.86+random()*.26;
    dummy.position.set(x+(random()-.5)*.15,y+.35,z+(random()-.5)*.12);dummy.rotation.set((random()-.5)*.2,(random()-.5)*.65,0);dummy.scale.set(occupied?.90+random()*.2:0,occupied?height:0,occupied?1:0);dummy.updateMatrix();torsos.setMatrixAt(n,dummy.matrix);torsos.setColorAt(n,new T.Color(colors[Math.floor(random()*colors.length)]));
    dummy.position.y=y+.35+.40*height;dummy.scale.setScalar(occupied?.90+random()*.15:0);dummy.updateMatrix();heads.setMatrixAt(n,dummy.matrix);heads.setColorAt(n,new T.Color(['#b3835f','#79553e','#d4b399'][Math.floor(random()*3)]));
    dummy.scale.setScalar(1);n++;
  }
  stadium.add(seats,torsos,heads);
  // Aisles and railings break the repeated seating mass into sections.
  for(const dir of [-1,1])for(let col=0;col<148;col+=25){const x=(col-73)*.81;for(let row=0;row<12;row++)box(stadium,[1.3,.06,1],[x,1.22+row*.48,dir*(42+row)],surface('#aeb3ac'));tube(stadium,[x+.7,1.8,dir*42],[x+.7,7.1,dir*53],.035,dark);}
  for(const dir of [-1,1])box(stadium,[7,2.5,86],[dir*61,1.1,0],concrete);
  const texts=['ManagerStory','DAİMA DAHA İLERİ','OYUN SENİN ELİNDE',home.name.toUpperCase()];
  texts.forEach((text,i)=>{
    const texture=textureCanvas(512,96,c=>{c.fillStyle='#143e31';c.fillRect(0,0,512,96);c.fillStyle=i%2?'#e4e8d9':'#f4cd62';c.font='bold 32px sans-serif';c.textAlign='center';c.fillText(text,256,61)});
    const board=new T.Mesh(new T.PlaneGeometry(29,1.5),new T.MeshStandardMaterial({map:texture,roughness:.9,side:T.DoubleSide}));
    board.position.set((i-1.5)*30,1,-38.1);stadium.add(board);
  });
}
export function createMatchScene({canvas,home,away,players}) {
  const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
  const scene=new T.Scene();scene.background=new T.Color('#b8ced0');scene.fog=new T.Fog('#b8ced0',130,270);
  scene.add(new T.HemisphereLight('#e4f0f5','#6f7750',2.0));
  const sun=new T.DirectionalLight('#fff6df',2.35);sun.position.set(-35,60,35);sun.castShadow=true;
  Object.assign(sun.shadow.camera,{left:-66,right:66,top:60,bottom:-60,near:1,far:160});sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.00025;sun.shadow.normalBias=.04;sun.shadow.radius=3;scene.add(sun);
  const ground=box(scene,[150,.15,110],[0,-.14,0],surface('#54744a'));
  const grassTexture=textureCanvas(1024,664,(c,w,h)=>{
    let seed=3427;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
    c.fillStyle='#54783d';c.fillRect(0,0,w,h);
    // Low-frequency variations are spread over the whole pitch, no tiled cells.
    for(let i=0;i<230;i++){
      const x=random()*w,y=random()*h,r=28+random()*85,g=c.createRadialGradient(x,y,0,x,y,r);
      g.addColorStop(0,i%2?'rgba(143,160,86,.13)':'rgba(24,71,34,.10)');g.addColorStop(1,'rgba(80,117,54,0)');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);
    }
    for(let i=0;i<180000;i++){const v=Math.floor(65+random()*50);c.fillStyle=`rgba(${v},${v+30},${v*.6},.10)`;c.fillRect(random()*w,random()*h,.6,.6+random()*1.8);}
  });
  grassTexture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  const pitch=new T.Mesh(new T.PlaneGeometry(105,68),new T.MeshStandardMaterial({map:grassTexture,roughness:1}));pitch.name='pitch';pitch.rotation.x=-Math.PI/2;pitch.receiveShadow=true;scene.add(pitch);
  // Broad, subtle mowing strips, not a two-dimensional checkerboard.
  const stripe=new T.MeshBasicMaterial({color:'#d4dfb3',opacity:.035,transparent:true,depthWrite:false});
  for(let i=0;i<10;i+=2){const s=new T.Mesh(new T.PlaneGeometry(10.5,68),stripe);s.rotation.x=-Math.PI/2;s.position.set(-47.25+i*10.5,.006,0);scene.add(s);}
  fieldPaint(scene);goal(scene,-1);goal(scene,1);stadium(scene,home);
  for(const x of [-52.5,52.5])for(const z of [-34,34]){
    tube(scene,[x,0,z],[x,1.5,z],.025,surface('#f1f1dc'));
    const flag=new T.Mesh(new T.PlaneGeometry(.38,.24),new T.MeshStandardMaterial({color:home.primaryColor,side:T.DoubleSide}));flag.position.set(x+.18,1.36,z);scene.add(flag);
  }
  const contactTexture=textureCanvas(64,64,(c,w,h)=>{const g=c.createRadialGradient(32,32,2,32,32,31);g.addColorStop(0,'rgba(10,22,9,.28)');g.addColorStop(.5,'rgba(10,22,9,.12)');g.addColorStop(1,'rgba(10,22,9,0)');c.fillStyle=g;c.fillRect(0,0,w,h);});
  const contactMaterial=new T.MeshBasicMaterial({map:contactTexture,transparent:true,depthWrite:false});
  const footballers=new Map();
  players.forEach((p,i)=>{
    const kit=p.kit||(p.side==='user'?home:away);
    const player=createFootballer({id:p.id,side:p.side,number:p.number??i%11+1,kit,goalkeeper:p.goalkeeper,variant:i});
    const contact=new T.Mesh(new T.PlaneGeometry(.62,.48),contactMaterial);contact.rotation.x=-Math.PI/2;contact.position.set(0,.012,.04);player.add(contact);
    player.position.copy(pitchToWorld(p.position));player.rotation.y=p.attackDirection>0?Math.PI/2:-Math.PI/2;scene.add(player);footballers.set(`${p.side}:${p.id}`,player);
  });
  const ballTexture=textureCanvas(128,64,(c,w,h)=>{
    c.fillStyle='#fffbea';c.fillRect(0,0,w,h);c.fillStyle='#243335';
    for(let i=0;i<12;i++){const x=(i*31)%w,y=(i*17)%h;c.beginPath();for(let j=0;j<5;j++){const a=j/5*Math.PI*2;c.lineTo(x+Math.cos(a)*8,y+Math.sin(a)*8)}c.closePath();c.fill();}
  });
  const ball=new T.Mesh(new T.SphereGeometry(.14,20,14),new T.MeshStandardMaterial({map:ballTexture,roughness:.65}));ball.name='match-ball';ball.castShadow=true;scene.add(ball);ball.position.set(7,.15,8);
  const camera=new T.PerspectiveCamera(48,1,.1,320);
  const cameraRig={focus:new T.Vector3(9,0,8),position:new T.Vector3(9,16,36),mode:'broadcast',framePoints:null};
  // Fit source and destination at their true world scale. Manual framing only:
  // no pursuit loop, interpolation, possession or synthetic match events.
  function framePoints(points){
    if(!points.length)return;
    const bounds=new T.Box3().setFromPoints(points),center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());
    const aspect=canvas.clientWidth/Math.max(1,canvas.clientHeight),tan=Math.tan(T.MathUtils.degToRad(42)/2);
    const margin=size.x>20?14:8;
    const distance=Math.max(20,(size.x+margin)/(2*tan*aspect),(size.z*.65+8)/(2*tan));
    cameraRig.focus.copy(center);cameraRig.position.copy(center).add(new T.Vector3(0,distance*.52,distance*.85));cameraRig.framePoints=points.map(p=>p.clone());
  }
  function setCamera(mode='broadcast') {
    cameraRig.mode=mode;
    if(mode==='model') {const p=players.filter(p=>!p.goalkeeper&&p.side==='user')[8]||players.find(p=>!p.goalkeeper&&p.side==='user'),m=footballers.get(`${p.side}:${p.id}`);camera.position.copy(m.position).add(new T.Vector3(3.3,1.5,1.8));camera.lookAt(m.position.clone().add(new T.Vector3(0,.94,0)));camera.fov=35;}
    else if(mode==='overview'){camera.position.set(0,86,98);camera.lookAt(0,0,0);camera.fov=56;}
    else {camera.position.copy(cameraRig.position);camera.lookAt(cameraRig.focus);camera.fov=42;}
    camera.updateProjectionMatrix();
  }
  function resize(){if(cameraRig.mode==='broadcast'&&cameraRig.framePoints){framePoints(cameraRig.framePoints);camera.position.copy(cameraRig.position);camera.lookAt(cameraRig.focus);}const r=canvas.getBoundingClientRect();if(r.width&&r.height){renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();}}
  function apply(snapshot){
    if(!snapshot)return;
    for(const p of snapshot.players){const mesh=footballers.get(`${p.side}:${p.id}`);if(mesh){const xy=p.displayPosition||p.enginePosition;if(xy)mesh.position.copy(pitchToWorld(xy));if(p.facingRadians!=null)mesh.rotation.y=p.facingRadians;}}
    const xy=snapshot.ball.displayPosition||snapshot.ball.engine?.position;
    if(xy){ball.position.copy(pitchToWorld(xy));ball.position.y=.15+(snapshot.ball.heightMeters??0);}
  }
  function projectPoint(xy){const p=pitchToWorld(xy).project(camera);return [(p.x+1)*.5*canvas.clientWidth,(1-p.y)*.5*canvas.clientHeight];}
  function render(){renderer.render(scene,camera);return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};}
  function dispose(){const geometries=new Set(),materials=new Set(),textures=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.skeleton)o.skeleton.dispose();for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());renderer.dispose();renderer.forceContextLoss();}
  setCamera();resize();
  return {scene,camera,cameraRig,renderer,footballers,ball,resize,setCamera,framePoints,projectPoint,apply,render,dispose};
}
