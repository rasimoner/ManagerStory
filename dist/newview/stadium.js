// Toon stadium for the new match view: pitch, goals, flags, boards, stands and an animated crowd.
import * as THREE from '../vendor/three/three.module.min.js';

export function buildStadium({ scene, renderer, boardName = 'ANADOLU HİSARI' }) {
  // ---------- lighting ----------
  scene.add(new THREE.HemisphereLight('#e8f1ff', '#3d5a2c', 1.25));
  const sun = new THREE.DirectionalLight('#fff4e0', 2.2);
  sun.position.set(-30, 60, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 160 });
  sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);

  const toonRamp = (() => {
    const t = new THREE.DataTexture(new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]), 3, 1);
    t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
  })();
  const noOutline = m => { m.userData.outlineParameters = { visible: false }; return m; };

  // ---------- pitch (105 x 68, x along length) ----------
  const PL = 105, PW = 68;
  function pitchTexture() {
    const W = 2048, H = 1440, sx = W / 120, sz = H / 84;     // texture covers 120 x 84 m
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    for (let i = 0; i < 24; i++) { g.fillStyle = i % 2 ? '#4a9b3f' : '#3f8f36'; g.fillRect(i * 5 * sx, 0, 5 * sx + 1, H); }
    const X = x => (x + 60) * sx, Z = z => (z + 42) * sz;
    g.strokeStyle = '#f7f7f2'; g.lineWidth = 0.13 * sx; g.fillStyle = '#f7f7f2';
    g.strokeRect(X(-52.5), Z(-34), PL * sx, PW * sz);
    g.beginPath(); g.moveTo(X(0), Z(-34)); g.lineTo(X(0), Z(34)); g.stroke();
    const ell = (x, z, r, a0 = 0, a1 = Math.PI * 2) => { g.beginPath(); g.ellipse(X(x), Z(z), r * sx, r * sz, 0, a0, a1); g.stroke(); };
    ell(0, 0, 9.15);
    for (const s of [-1, 1]) {
      const gx = 52.5 * s;
      g.strokeRect(X(Math.min(gx, gx - s * 16.5)), Z(-20.16), 16.5 * sx, 40.32 * sz);
      g.strokeRect(X(Math.min(gx, gx - s * 5.5)), Z(-9.16), 5.5 * sx, 18.32 * sz);
      g.beginPath(); g.ellipse(X(gx - s * 11), Z(0), 0.22 * sx, 0.22 * sz, 0, 0, 7); g.fill();
      const a = Math.acos(5.5 / 9.15);
      ell(gx - s * 11, 0, 9.15, s > 0 ? Math.PI - a : -a, s > 0 ? Math.PI + a : a);
      g.save(); g.beginPath(); g.rect(X(-52.5), Z(-34), PL * sx, PW * sz); g.clip();
      for (const zs of [-1, 1]) ell(gx, 34 * zs, 1, 0, Math.PI * 2);
      g.restore();
    }
    g.beginPath(); g.ellipse(X(0), Z(0), 0.22 * sx, 0.22 * sz, 0, 0, 7); g.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t;
  }
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(120, 84),
    noOutline(new THREE.MeshToonMaterial({ map: pitchTexture(), gradientMap: toonRamp })));
  pitch.rotation.x = -Math.PI / 2; pitch.receiveShadow = true; scene.add(pitch);
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(260, 220), noOutline(new THREE.MeshBasicMaterial({ color: '#2f6b2a' })));
  apron.rotation.x = -Math.PI / 2; apron.position.y = -0.02; scene.add(apron);

  // corner flags
  for (const xs of [-1, 1]) for (const zs of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 6), new THREE.MeshToonMaterial({ color: '#fafafa', gradientMap: toonRamp }));
    pole.position.set(52.5 * xs, 0.75, 34 * zs); pole.layers.enable(1); scene.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.32), noOutline(new THREE.MeshBasicMaterial({ color: '#ffd400', side: THREE.DoubleSide })));
    flag.position.set(52.5 * xs + 0.22, 1.33, 34 * zs); scene.add(flag);
  }

  // goal at x = +52.5
  const nets = [];
  for (const GS of [1, -1]) {
    const m = new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: toonRamp });
    const post = (w, h, d, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; b.layers.enable(1); scene.add(b); };
    post(0.12, 2.44, 0.12, GS * 52.56, 1.22, -3.66); post(0.12, 2.44, 0.12, GS * 52.56, 1.22, 3.66); post(0.12, 0.12, 7.44, GS * 52.56, 2.44, 0);
    const pts = [], X0 = GS * 52.6, X1 = GS * 54.6;
    for (let z = -3.66; z <= 3.661; z += 0.3) { pts.push(X0, 2.44, z, X1, 1.6, z, X1, 1.6, z, X1, 0, z); }
    for (let y = 0; y <= 1.6; y += 0.3) pts.push(X1, y, -3.66, X1, y, 3.66);
    // a finer mesh than before so a ball can bulge it
    for (let z = -3.66; z <= 3.661; z += 0.3) for (let y = 0; y < 1.6; y += 0.2) pts.push(X1, y, z, X1, y + 0.2, z);
    const net = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)),
      new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: .55 }));
    net.userData = { GS, rest: Float32Array.from(pts) };
    nets.push(net); scene.add(net);
  }

  // ---------- stands, boards, crowd ----------
  const boardCanvas = document.createElement('canvas'); boardCanvas.width = 2048; boardCanvas.height = 64;
  const boardClones = [];
  function drawBoards() {
    const c = boardCanvas, g = c.getContext('2d');
    const blocks = [['#1f5fd6', 'MANAGERSTORY'], ['#7cc4ff', boardName], ['#f39a1e', 'HİSAR ENERJİ'], ['#e8467c', 'KULÜP TV'], ['#0f1830', 'MANAGERSTORY']];
    const w = c.width / blocks.length;
    blocks.forEach(([col, txt], i) => {
      g.fillStyle = col; g.fillRect(i * w, 0, w, 64);
      g.fillStyle = col === '#7cc4ff' ? '#0f1830' : '#ffffff';
      g.font = '800 38px "Arial Narrow", "Helvetica Neue", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(txt, i * w + w / 2, 34);
    });
    for (const t of boardClones) t.needsUpdate = true;
  }
  drawBoards();

  function board(len, x, z, rotY) {
    const tex = new THREE.CanvasTexture(boardCanvas); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.set(len / 40, 1); boardClones.push(tex);
    const b = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.9), noOutline(new THREE.MeshBasicMaterial({ map: tex })));
    b.position.set(x, 0.45, z); b.rotation.y = rotY; scene.add(b);
  }
  board(112, 0, -36.2, 0);              // far touchline, faces pitch
  board(74, 56.5, 0, -Math.PI / 2);      // behind the goals
  board(74, -56.5, 0, Math.PI / 2);

  const standMat = noOutline(new THREE.MeshBasicMaterial({ color: '#232a36', side: THREE.DoubleSide }));
  function slope(w, d, rise, pos, rotY) {
    const geo = new THREE.PlaneGeometry(w, Math.hypot(d, rise));
    const m = new THREE.Mesh(geo, standMat);
    const o = new THREE.Object3D(); o.position.copy(pos); o.rotation.y = rotY; scene.add(o);
    m.rotation.x = -(Math.PI / 2) + Math.atan2(rise, d);
    m.position.set(0, 1.2 + rise / 2, -d / 2); o.add(m);
  }
  // stand geometry is drawn by the crowd itself; a dark backing fills gaps
  // (V7.9.10 the side stands' backing runs out into the corners, under the mitred rows, so no sky shows
  // between the seats there; behind the end stands it meets their own backing along the corner's diagonal)
  slope(196, 38, 30, new THREE.Vector3(0, 0, -38.5), 0);
  slope(160, 36, 28, new THREE.Vector3(59, 0, 0), -Math.PI / 2);
  slope(160, 36, 28, new THREE.Vector3(-59, 0, 0), Math.PI / 2);
  slope(192, 34, 26, new THREE.Vector3(0, 0, 38.5), Math.PI);

  function crowdAtlas() {
    // 4 poses x 64 px. R channel = shirt mask, G = shade, alpha = silhouette.
    const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
    const shirt = s => `rgb(255,${s},0)`, skin = s => `rgb(0,${s},0)`;
    const person = (ox, armL, armR) => {
      g.fillStyle = shirt(225);
      g.beginPath(); g.moveTo(ox + 14, 128); g.lineTo(ox + 16, 70); g.quadraticCurveTo(ox + 32, 58, ox + 48, 70); g.lineTo(ox + 50, 128); g.fill();
      g.fillStyle = shirt(255); g.fillRect(ox + 22, 70, 20, 40);
      const arm = (side, up) => {
        g.strokeStyle = shirt(200); g.lineWidth = 9; g.lineCap = 'round'; g.beginPath();
        const sx = ox + 32 + side * 15; g.moveTo(sx, 74);
        if (up) { g.lineTo(sx + side * 6, 44); g.stroke(); g.fillStyle = skin(230); g.beginPath(); g.arc(sx + side * 7, 38, 5, 0, 7); g.fill(); }
        else { g.lineTo(sx + side * 3, 108); g.stroke(); }
      };
      arm(-1, armL); arm(1, armR);
      g.fillStyle = skin(235); g.beginPath(); g.arc(ox + 32, 54, 11, 0, 7); g.fill();
      g.fillStyle = 'rgb(0,60,0)'; g.beginPath(); g.arc(ox + 32, 50, 11, Math.PI, 0); g.fill();
    };
    person(0, false, false); person(64, true, true); person(128, false, true); person(192, true, false);
    const t = new THREE.CanvasTexture(c); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; return t;
  }
  const crowdMat = new THREE.ShaderMaterial({
    uniforms: { uAtlas: { value: crowdAtlas() }, uTime: { value: 0 }, uExcite: { value: .15 }, uExciteAway: { value: .15 }, uFog: { value: new THREE.Color('#9fb8cf') } },
    vertexShader: `
      attribute vec3 aPos; attribute float aYaw; attribute vec3 aColor; attribute float aSeed; attribute float aWave; attribute float aAway;
      uniform float uTime, uExcite, uExciteAway;
      varying vec2 vUv; varying vec3 vColor; varying float vFrame; varying float vDepth;
      void main(){
        float ph = uTime * (2.4 + aSeed * 2.2) + aSeed * 40.0;
        float wave = pow(sin(uTime * 1.3 - aWave * 0.11) * .5 + .5, 8.0);
        float ex = mix(uExcite, uExciteAway, aAway);          // V7.9.10 the away end has a mood of its own
        float act = clamp(ex + wave * (1.0 - aAway * .6), 0.0, 1.0);
        float jump = max(0.0, sin(ph)) * 0.22 * act;
        float up = step(0.8 - act * 1.5, sin(ph * .5 + aSeed * 9.0));
        vFrame = up > .5 ? (aSeed > .55 ? 1.0 : (aSeed > .25 ? 2.0 : 3.0)) : 0.0;
        float c = cos(aYaw), s = sin(aYaw);
        vec3 p = vec3(position.x * c, position.y + jump, -position.x * s) + aPos;
        vUv = uv; vColor = aColor;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D uAtlas; uniform vec3 uFog;
      varying vec2 vUv; varying vec3 vColor; varying float vFrame; varying float vDepth;
      void main(){
        vec4 t = texture2D(uAtlas, vec2((vUv.x + vFrame) * .25, vUv.y));
        if (t.a < .5) discard;
        vec3 skin = vec3(.86, .66, .52);
        vec3 col = mix(skin, vColor, step(.5, t.r)) * (.45 + .55 * t.g);
        col = mix(col, uFog, smoothstep(90.0, 220.0, vDepth) * .8);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`
  });
  const flagMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uExcite: { value: .15 }, uExciteAway: { value: .15 } },
    vertexShader: `
      attribute vec3 aPos; attribute float aYaw; attribute float aSeed; attribute vec3 aC1; attribute vec3 aC2; attribute float aAway;
      uniform float uTime, uExcite, uExciteAway; varying vec2 vUv; varying float vSeed; varying vec3 vC1; varying vec3 vC2;
      void main(){
        vec3 p = position;
        float ex = mix(uExcite, uExciteAway, aAway);
        float sway = sin(uTime * (1.4 + aSeed) + aSeed * 20.0) * (0.35 + ex * .5);
        p.z += sin(p.x * 3.5 - uTime * 7.0 + aSeed * 9.0) * 0.12 * (p.x + .7);
        float yaw = aYaw + sway;
        float c = cos(yaw), s = sin(yaw);
        vec3 w = vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c) + aPos;
        w.y += max(0.0, sin(uTime * 3.0 + aSeed * 30.0)) * .25 * ex;
        vUv = uv; vSeed = aSeed; vC1 = aC1; vC2 = aC2;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(w, 1.0);
      }`,
    fragmentShader: `
      varying vec2 vUv; varying float vSeed; varying vec3 vC1; varying vec3 vC2;
      void main(){
        // V7.9.10 each flag in its club's two colours: halves, bands or a border (was a fixed red and white)
        vec3 c = vSeed > .62 ? mix(vC1, vC2, step(.5, vUv.y))
               : vSeed > .3 ? mix(vC1, vC2, step(.5, fract(vUv.y * 2.5)))
               : mix(vC2, vC1, step(.14, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y) * 1.5)));
        gl_FragColor = vec4(c * (.8 + .2 * vUv.y), 1.0);
        #include <colorspace_fragment>
      }`
  });

  // V7.9.10 the visiting fans: a block at one end, kept apart from the home end by a strip of empty seats
  const AWAY = { end: -1, from: 15, gap: 3.2 };
  const awaySeat = s => s.end === AWAY.end && s.z > AWAY.from;
  function buildCrowd(homeCol, homeAlt, awayCol, awayAlt) {
    const seats = [];
    // V7.9.10 the corners are mitred: the side stands' rows reach out to the end stands' rows of the same
    // height and the end stands stop where they meet, so no gap (dark backing or sky) shows between them
    const reach = r => 59 + r * .82;
    // far stand: rows climb away from the far touchline (z < -38)
    for (let r = 0; r < 46; r++) { const X = reach(r) - 0.31; for (let x = -X; x <= X - 0.3; x += 0.62)
      seats.push({ x: x + (r % 2) * .31, z: -38.8 - r * .82, y: 1.25 + r * .64, yaw: 0 }); }
    // end stands behind both goals, each row ending where it meets the side stands
    for (let r = 0; r < 44; r++) {
      const zFar = -(38.8 + r * .82) + 0.31, zNear = r < 40 ? 38.8 + r * .82 - 0.31 : 76;
      for (let z = zFar; z <= zNear; z += 0.62) {
        const zz = z + (r % 2) * .31;
        seats.push({ x: 59 + r * .82, z: zz, y: 1.25 + r * .62, yaw: -Math.PI / 2, end: 1 });
        // (the strip of empty seats between the home end and the visiting fans)
        if (zz < AWAY.from - AWAY.gap || zz > AWAY.from) seats.push({ x: -59 - r * .82, z: zz, y: 1.25 + r * .62, yaw: Math.PI / 2, end: -1 });
      }
    }
    // near stand behind the broadcast cameras
    for (let r = 0; r < 40; r++) { const X = reach(r) - 0.31; for (let x = -X; x <= X - 0.3; x += 0.62)
      seats.push({ x: x + (r % 2) * .31, z: 38.8 + r * .82, y: 1.25 + r * .64, yaw: Math.PI }); }
    const n = seats.length;
    const base = new THREE.PlaneGeometry(.62, .98); base.translate(0, .49, 0); base.deleteAttribute('normal');
    const geo = new THREE.InstancedBufferGeometry(); geo.index = base.index;
    geo.setAttribute('position', base.attributes.position); geo.setAttribute('uv', base.attributes.uv);
    const aPos = new Float32Array(n * 3), aYaw = new Float32Array(n), aCol = new Float32Array(n * 3), aSeed = new Float32Array(n), aWave = new Float32Array(n), aAway = new Float32Array(n);
    const red = new THREE.Color(homeCol), dark = new THREE.Color(homeCol).multiplyScalar(.55), white = new THREE.Color(homeAlt), black = new THREE.Color('#1b1b22');
    const aw1 = new THREE.Color(awayCol), aw2 = new THREE.Color(awayAlt);
    let rnd = 7; const rand = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;
    seats.forEach((s, i) => {
      aPos.set([s.x + (rand() - .5) * .12, s.y, s.z], i * 3); aYaw[i] = s.yaw + (rand() - .5) * .3;
      const k = rand();
      const awayEnd = awaySeat(s);   // the visiting fans' block
      const c = (awayEnd ? (k < .6 ? aw1 : k < .92 ? aw2 : black) : (k < .62 ? red : k < .8 ? dark : k < .96 ? white : black)).clone().multiplyScalar(.85 + rand() * .2);
      aCol.set([c.r, c.g, c.b], i * 3); aSeed[i] = rand(); aAway[i] = awayEnd ? 1 : 0;
      aWave[i] = s.yaw === 0 ? s.x : s.end === 1 ? 60 + (s.z + 76) : s.end === -1 ? -60 - (s.z + 76) : 300 - s.x;
    });
    geo.setAttribute('aPos', new THREE.InstancedBufferAttribute(aPos, 3));
    geo.setAttribute('aYaw', new THREE.InstancedBufferAttribute(aYaw, 1));
    geo.setAttribute('aColor', new THREE.InstancedBufferAttribute(aCol, 3));
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(aSeed, 1));
    geo.setAttribute('aWave', new THREE.InstancedBufferAttribute(aWave, 1));
    geo.setAttribute('aAway', new THREE.InstancedBufferAttribute(aAway, 1));
    geo.instanceCount = n;
    const mesh = new THREE.Mesh(geo, crowdMat); mesh.frustumCulled = false; scene.add(mesh);

    // flags held above the crowd
    const flagBase = new THREE.PlaneGeometry(1.3, .85, 8, 2); flagBase.translate(.65, 0, 0); flagBase.deleteAttribute('normal');
    const fg = new THREE.InstancedBufferGeometry(); fg.index = flagBase.index;
    fg.setAttribute('position', flagBase.attributes.position); fg.setAttribute('uv', flagBase.attributes.uv);
    // home flags in the home club's colours all round the ground; the away block waves more, in theirs
    const picks = []; seats.forEach((s, i) => { if (i % (awaySeat(s) ? 17 : 37) === 0) picks.push(s); });
    const fPos = new Float32Array(picks.length * 3), fYaw = new Float32Array(picks.length), fSeed = new Float32Array(picks.length);
    const fC1 = new Float32Array(picks.length * 3), fC2 = new Float32Array(picks.length * 3), fAway = new Float32Array(picks.length);
    const flagCols = (a, b) => [new THREE.Color(a), new THREE.Color(b)];
    const homeFlag = flagCols(homeCol, homeAlt), awayFlag = flagCols(awayCol, awayAlt);
    picks.forEach((s, i) => {
      fPos.set([s.x, s.y + 1.75, s.z], i * 3); fYaw[i] = s.yaw + (rand() - .5); fSeed[i] = rand();
      const away = awaySeat(s), [c1, c2] = away ? awayFlag : homeFlag;
      fC1.set([c1.r, c1.g, c1.b], i * 3); fC2.set([c2.r, c2.g, c2.b], i * 3); fAway[i] = away ? 1 : 0;
    });
    fg.setAttribute('aPos', new THREE.InstancedBufferAttribute(fPos, 3));
    fg.setAttribute('aYaw', new THREE.InstancedBufferAttribute(fYaw, 1));
    fg.setAttribute('aSeed', new THREE.InstancedBufferAttribute(fSeed, 1));
    fg.setAttribute('aC1', new THREE.InstancedBufferAttribute(fC1, 3));
    fg.setAttribute('aC2', new THREE.InstancedBufferAttribute(fC2, 3));
    fg.setAttribute('aAway', new THREE.InstancedBufferAttribute(fAway, 1));
    fg.instanceCount = picks.length;
    const flags = new THREE.Mesh(fg, flagMat); flags.frustumCulled = false; scene.add(flags);
    return [mesh, flags];
  }



  // the net gives where the ball hit it and ripples out for a second (hit = runtime S.netHit)
  let lastHit = null;
  function updateNets(hit, t) {
    for (const net of nets) {
      const { GS, rest } = net.userData, a = net.geometry.attributes.position, mine = hit && Math.sign(hit.x) === GS;
      const age = mine ? t - hit.t : 99;
      if (age > 1.6) { if (net.userData.moved) { a.array.set(rest); a.needsUpdate = true; net.userData.moved = false; } continue; }
      const amp = Math.min(0.55, 0.03 * hit.v) * Math.exp(-age * 3.2), wob = Math.cos(age * 16);
      for (let i = 0; i < a.count; i++) {
        const x = rest[i * 3], y = rest[i * 3 + 1], z = rest[i * 3 + 2];
        const depth = Math.min(1, Math.max(0, (Math.abs(x) - 52.6) / 2));         // the frame never moves
        if (depth <= 0) { a.array[i * 3] = x; continue; }
        const r2 = (y - hit.y) ** 2 + (z - hit.z) ** 2, f = Math.exp(-r2 / 1.1) * depth;
        a.array[i * 3] = x + GS * amp * f * (0.6 + 0.4 * wob);
        a.array[i * 3 + 1] = y - amp * 0.25 * f * Math.max(0, wob);
      }
      a.needsUpdate = true; net.userData.moved = true;
    }
  }
  return { sun, toonRamp, noOutline, crowdMat, flagMat, buildCrowd, updateNets };
}
