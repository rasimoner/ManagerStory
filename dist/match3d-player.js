import * as T from './vendor/three/three.module.min.js';

// Original articulated humanoid. Metres; +Z is forward. No downloaded model.
// Each vertex is bound to a named anatomical bone; materials are batched.
export const JOINTS = [
  ['pelvis', -1, 0, .94, 0], ['spine', 0, 0, .04, 0],
  ['neck', 1, 0, .52, 0], ['head', 2, 0, .07, 0],
  ['leftShoulder', 1, -.235, .40, 0], ['leftElbow', 4, 0, -.30, 0], ['leftHand', 5, 0, -.28, 0],
  ['rightShoulder', 1, .235, .40, 0], ['rightElbow', 7, 0, -.30, 0], ['rightHand', 8, 0, -.28, 0],
  ['leftHip', 0, -.102, -.02, 0], ['leftKnee', 10, 0, -.43, 0], ['leftAnkle', 11, 0, -.40, 0],
  ['rightHip', 0, .102, -.02, 0], ['rightKnee', 13, 0, -.43, 0], ['rightAnkle', 14, 0, -.40, 0]
];

function profile(control, segments = 20) {
  // Cubic loft with rounded anatomical contours, in metres. Tangents are
  // interpolated between rings; radii never overshoot the neighbouring extrema.
  const rings=[];
  for(let j=0;j<control.length-1;j++)for(let k=0;k<4;k++){
    const t=k/4,a=control[j],b=control[j+1],before=control[Math.max(0,j-1)],after=control[Math.min(control.length-1,j+2)];
    const ring=[a[0]+(b[0]-a[0])*t];
    for(let d=1;d<=3;d++){
      const av=a[d]||0,bv=b[d]||0,ma=(bv-(before[d]||0))*.5,mb=((after[d]||0)-av)*.5;
      const value=(2*t*t*t-3*t*t+1)*av+(t*t*t-2*t*t+t)*ma+(-2*t*t*t+3*t*t)*bv+(t*t*t-t*t)*mb;
      ring.push(Math.max(Math.min(av,bv),Math.min(Math.max(av,bv),value)));
    }rings.push(ring);
  }rings.push(control[control.length-1]);
  const pos = [], uv = [], indices = [];
  rings.forEach(([y, rx, rz, centerZ = 0], j) => {
    for (let i = 0; i <= segments; i++) {
      const a = i / segments * Math.PI * 2;
      pos.push(Math.sin(a) * rx, y, centerZ + Math.cos(a) * rz);
      uv.push(i / segments, j / (rings.length - 1));
      if (j && i < segments) {
        const n = j * (segments + 1) + i, p = n - segments - 1;
        indices.push(p, p + 1, n, n, p + 1, n + 1);
      }
    }
  });
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setIndex(indices); g.computeVertexNormals();
  return g;
}

function numberTexture(number, kit) {
  const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
  const c = canvas.getContext('2d');
  c.fillStyle = kit.primaryColor; c.fillRect(0, 0, 128, 128);
  c.fillStyle = kit.secondaryColor; c.fillRect(0, 0, 8, 128); c.fillRect(120, 0, 8, 128);
  const color = new T.Color(kit.primaryColor);
  c.fillStyle = color.r * .21 + color.g * .72 + color.b * .07 > .42 ? '#172620' : '#fff8df';
  c.textAlign = 'center'; c.font = 'bold 18px sans-serif'; c.fillText((kit.shortName || kit.name || '').toUpperCase().slice(0,10), 64, 25);
  c.font = 'bold 66px sans-serif'; c.fillText(String(number), 64, 94);
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace;
  return texture;
}

export function createFootballer({ id, side, number, kit, goalkeeper = false, variant = 0 }) {
  const root = new T.Group(); root.name = `footballer:${side}:${id}`;
  const bones = JOINTS.map(([name, , x, y, z]) => {
    const b = new T.Bone(); b.name = name; b.position.set(x, y, z); return b;
  });
  JOINTS.forEach(([, parent], i) => (parent < 0 ? root : bones[parent]).add(bones[i]));
  root.updateMatrixWorld(true);
  const skin = ['#d1a078', '#a36e48', '#77492f', '#e2b896', '#bd8a60'][variant % 5];
  const hair = ['#231c18', '#382a20', '#6c5036', '#151b1c'][variant % 4];
  const primary = goalkeeper ? '#' + new T.Color(kit.secondaryColor).lerp(new T.Color(kit.primaryColor),.35).getHexString() : kit.primaryColor;
  const actualKit = { ...kit, primaryColor: primary };
  const materials = [skin, primary, kit.secondaryColor, primary, hair, '#172022'].map(color =>
    new T.MeshStandardMaterial({ color, roughness: .86 }));
  materials.push(new T.MeshStandardMaterial({ map: numberTexture(number, actualKit), roughness: .9, side: T.DoubleSide }));
  const parts = [];
  const add = (geometry, bone, material, x = 0, y = 0, z = 0) => {
    geometry.translate(x, y, z); geometry.applyMatrix4(bones[bone].matrixWorld);
    parts.push({ geometry: geometry.toNonIndexed(), bone, material });
    geometry.dispose();
  };
  const oval = (bone, material, x, y, z, sx, sy, sz, topOnly = false) => {
    const g = new T.SphereGeometry(1, 16, 12, 0, Math.PI * 2, 0, topOnly ? Math.PI * .52 : Math.PI);
    g.scale(sx, sy, sz); add(g, bone, material, x, y, z);
  };
  // Athletic shirt: waist, rib cage, rounded deltoids and sloping neckline.
  add(profile([[0,.146,.090],[.08,.151,.096],[.19,.164,.110,.006],[.30,.190,.118,.009],[.38,.220,.110],[.42,.226,.098],[.45,.209,.086],[.48,.164,.072],[.505,.071,.053]]),1,1);
  add(profile([[-.11,.177,.103],[-.04,.180,.109],[.035,.152,.090]]),0,2);
  add(profile([[-.015,.050,.043],[.022,.046,.041],[.071,.042,.039]]),2,0);
  add(profile([[.492,.074,.055],[.508,.065,.052]]),1,2);
  // Jaw, cheekbones and skull are a shaped loft instead of one oversized sphere.
  add(profile([[-.022,.035,.045,.013],[.005,.060,.064,.010],[.040,.080,.076,.006],[.085,.088,.085],[.139,.087,.087],[.181,.068,.070],[.207,.010,.013]]),3,0);
  oval(3,0,0,.077,.080,.016,.024,.020);
  for(const sign of [-1,1]){
    oval(3,0,sign*.088,.082,0,.011,.023,.015);
    oval(3,5,sign*.032,.111,.082,.006,.004,.002);
    oval(3,4,sign*.032,.126,.079,.014,.002,.003);
  }
  oval(3,4,0,.156,-.005,.090,.058,.090,true);
  for(const shoulder of [4,7]){
    // Sleeve cap flows into the torso. Forearm narrows to wrist, upper arm
    // has biceps/triceps volume; no straight cylindrical limb segments.
    add(profile([[-.145,.058,.057],[-.10,.066,.064],[-.030,.074,.072],[.020,.070,.066],[.046,.046,.043],[.069,.006,.008]]),shoulder,1);
    add(profile([[-.313,.037,.039],[-.27,.039,.040],[-.22,.050,.047,-.007],[-.17,.056,.052],[-.136,.057,.054]]),shoulder,0);
    const elbow=shoulder+1,hand=shoulder+2;
    add(profile([[-.29,.025,.024],[-.245,.029,.028],[-.18,.039,.036],[-.09,.044,.041,-.004],[.015,.037,.039]]),elbow,0);
    oval(hand,goalkeeper?5:0,0,-.028,.005,.028,.038,.017);
    for(let finger=0;finger<4;finger++)oval(hand,goalkeeper?5:0,(finger-1.5)*.012,-.064,.010,.006,.019,.007);
    oval(hand,goalkeeper?5:0,shoulder===4?.027:-.027,-.028,.022,.010,.019,.009);
  }
  for(const hip of [10,13]){
    add(profile([[-.18,.078,.078],[-.13,.087,.085],[-.055,.093,.090],[.035,.097,.091]]),hip,2);
    add(profile([[-.45,.047,.051],[-.40,.052,.056],[-.33,.062,.061,.007],[-.23,.075,.071],[-.17,.079,.075]]),hip,0);
    const knee=hip+1,ankle=hip+2;
    add(profile([[-.41,.030,.034],[-.33,.037,.039],[-.23,.052,.053,-.009],[-.15,.055,.051,-.010],[-.065,.046,.046],[.015,.047,.051]]),knee,3);
    // Contoured low-profile boot: rounded heel, instep and toe, thin sole.
    add(profile([[-.088,.018,.067,.046],[-.081,.046,.119,.047],[-.064,.053,.123,.050],[-.043,.050,.109,.046],[-.011,.041,.075,.012],[.022,.032,.038]]),ankle,5);
    add(profile([[-.092,.041,.113,.049],[-.086,.049,.123,.049],[-.078,.048,.120,.049]]),ankle,2);
  }
  const front = new T.PlaneGeometry(.17,.21); add(front,1,6,0,.27,.130);
  const back = new T.PlaneGeometry(.20,.24); back.rotateY(Math.PI); add(back,1,6,0,.28,-.120);
  // One SkinnedMesh with material batches and real bone hierarchy.
  const position=[], normal=[], uv=[], skinIndex=[], skinWeight=[];
  const geometry = new T.BufferGeometry();
  for(let material=0;material<materials.length;material++) {
    const start=position.length/3;
    for(const part of parts.filter(p=>p.material===material)) {
      position.push(...part.geometry.attributes.position.array);
      normal.push(...part.geometry.attributes.normal.array);
      uv.push(...part.geometry.attributes.uv.array);
      const count=part.geometry.attributes.position.count;
      for(let i=0;i<count;i++){
        let other=part.bone,weight=0;
        const y=part.geometry.attributes.position.getY(i),joint=bones[part.bone].matrixWorld.elements[13];
        if([5,8,11,14].includes(part.bone)){other=JOINTS[part.bone][1];weight=T.MathUtils.clamp((y-joint+.055)/.11,0,1)*.5;}
        if([4,7,10,13].includes(part.bone)){const child=part.bone+1,cy=bones[child].matrixWorld.elements[13];other=child;weight=T.MathUtils.clamp((cy+.055-y)/.11,0,1)*.5;}
        skinIndex.push(part.bone,other,0,0);skinWeight.push(1-weight,weight,0,0);
      }
      part.geometry.dispose();
    }
    geometry.addGroup(start,position.length/3-start,material);
  }
  geometry.setAttribute('position',new T.Float32BufferAttribute(position,3));
  geometry.setAttribute('normal',new T.Float32BufferAttribute(normal,3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(skinIndex,4));
  geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(skinWeight,4));
  const mesh=new T.SkinnedMesh(geometry,materials);root.add(mesh);
  mesh.bind(new T.Skeleton(bones));mesh.castShadow=true;mesh.receiveShadow=true;
  // Static relaxed stance, not football animation or a simulated running action.
  bones[4].rotation.z=-.07;bones[7].rotation.z=.07;
  bones[5].rotation.x=-.08;bones[8].rotation.x=-.06;
  bones[10].rotation.z=.025;bones[13].rotation.z=-.025;
  root.userData={id,side,number,bones:Object.fromEntries(bones.map(b=>[b.name,b])),model:'original-articulated-human-v2'};
  return root;
}
