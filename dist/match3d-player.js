import * as T from './vendor/three/three.module.min.js';

// Original articulated humanoid. Metres; +Z is forward. No downloaded model.
// Each vertex is bound to a named anatomical bone; materials are batched.
export const JOINTS = [
  ['pelvis', -1, 0, .94, 0], ['spine', 0, 0, .04, 0],
  ['neck', 1, 0, .53, 0], ['head', 2, 0, .10, 0],
  ['leftShoulder', 1, -.235, .40, 0], ['leftElbow', 4, 0, -.30, 0], ['leftHand', 5, 0, -.28, 0],
  ['rightShoulder', 1, .235, .40, 0], ['rightElbow', 7, 0, -.30, 0], ['rightHand', 8, 0, -.28, 0],
  ['leftHip', 0, -.102, -.02, 0], ['leftKnee', 10, 0, -.43, 0], ['leftAnkle', 11, 0, -.40, 0],
  ['rightHip', 0, .102, -.02, 0], ['rightKnee', 13, 0, -.43, 0], ['rightAnkle', 14, 0, -.40, 0]
];

function profile(rings, segments = 24) {
  const pos = [], uv = [], indices = [];
  rings.forEach(([y, rx, rz], j) => {
    for (let i = 0; i <= segments; i++) {
      const a = i / segments * Math.PI * 2;
      pos.push(Math.sin(a) * rx, y, Math.cos(a) * rz);
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
  // Shirt follows shoulder/chest/waist contours, not a box or capsule.
  add(profile([[0,.16,.105],[.05,.172,.112],[.14,.179,.116],[.25,.19,.12],[.33,.209,.122],[.39,.232,.114],[.425,.243,.106],[.45,.225,.098],[.48,.175,.087],[.495,.112,.073],[.51,.07,.059]]), 1, 1);
  add(profile([[-.10,.19,.111],[0,.19,.114],[.05,.168,.109]]), 0, 2);
  add(profile([[0,.053,.048],[.08,.048,.043]]), 2, 0);
  add(profile([[.494,.08,.061],[.511,.075,.059]]),1,2); // contrast ribbed collar
  oval(3,0,0,.087,0,.104,.135,.100);
  oval(3,0,0,.07,.099,.025,.027,.037); // nose
  for (const sign of [-1,1]) {
    oval(3,0,sign*.104,.075,0,.019,.034,.02); // ears
    oval(3,5,sign*.039,.109,.101,.008,.005,.003); // visible eyes
    oval(3,4,sign*.039,.123,.098,.018,.003,.004); // eyebrows
  }
  oval(3,4,0,.157,-.007,.108,.080,.105,true);
  for (const shoulder of [4,7]) {
    add(profile([[-.17,.066,.067],[-.06,.083,.080],[.045,.077,.077]]),shoulder,1);
    add(profile([[-.30,.047,.046],[-.22,.055,.053],[-.15,.061,.060]]),shoulder,0);
    const elbow=shoulder+1, hand=shoulder+2;
    add(profile([[-.28,.036,.034],[-.16,.052,.047],[0,.048,.046]]),elbow,0);
    oval(hand,goalkeeper?5:0,0,-.037,.009,.031,.049,.022);
    // Rounded fingers and opposing thumb, rather than a spherical mitten.
    for(let finger=0;finger<4;finger++)oval(hand,goalkeeper?5:0,(finger-1.5)*.014,-.084,.014,.008,.027,.009);
    oval(hand,goalkeeper?5:0,shoulder===4?.032:-.032,-.039,.025,.013,.025,.012);
  }
  for (const hip of [10,13]) {
    add(profile([[-.16,.091,.087],[-.05,.106,.095],[.01,.11,.10]]),hip,2);
    add(profile([[-.43,.061,.061],[-.30,.078,.075],[-.16,.089,.085]]),hip,0);
    const knee=hip+1, ankle=hip+2;
    oval(knee,0,0,-.004,.004,.059,.047,.059);
    add(profile([[-.38,.039,.043],[-.23,.065,.060],[-.08,.064,.057],[-.05,.058,.051]]),knee,3);
    oval(ankle,5,0,-.018,.072,.065,.050,.132);
    // Thin sole and boot accent are smooth curved geometry.
    oval(ankle,2,0,-.046,.076,.066,.018,.129);
  }
  const front = new T.PlaneGeometry(.22,.24); add(front,1,6,0,.29,.122);
  const back = new T.PlaneGeometry(.25,.28); back.rotateY(Math.PI); add(back,1,6,0,.29,-.124);
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
      for(let i=0;i<count;i++){skinIndex.push(part.bone,0,0,0);skinWeight.push(1,0,0,0);}
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
  bones[4].rotation.z=-.12;bones[7].rotation.z=.12;
  bones[5].rotation.x=-.20;bones[8].rotation.x=-.17;
  bones[10].rotation.z=.025;bones[13].rotation.z=-.025;
  root.userData={id,side,number,bones:Object.fromEntries(bones.map(b=>[b.name,b])),model:'original-articulated-human-v1'};
  return root;
}
