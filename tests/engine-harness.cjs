/* Shared harness for MatchEngine integrity tests, stress runs and the audit tool.
   Loads the real game scripts in one vm context, exactly like the existing tests. */
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const base = path.resolve(__dirname, '../dist');
const FILES = ['match-support.js', 'career-events.js', 'live-match.js', 'opponents-v731.js', 'pitch-v73.js', 'pitch-v731.js', 'app.js'];
const sources = FILES.map(f => fs.readFileSync(path.join(base, f), 'utf8'));

function harness(existing = new Map(), sourceOverride = sources) {
  const app = { innerHTML: '', classList: { toggle() {} }, insertAdjacentHTML(_w, html) { this.innerHTML += html; } };
  const ctx = {
    console, structuredClone, AbortController, URL, Blob, setTimeout, clearTimeout, Math,
    localStorage: { getItem: k => existing.get(k) || null, setItem: (k, v) => existing.set(k, v), removeItem: k => existing.delete(k) },
    document: { body: { classList: { toggle() {} } }, querySelector(q) { if (q === '#app') return app; return null; } },
    alert() {}, confirm: () => true, prompt: () => null,
  };
  ctx.window = ctx; ctx.window.scrollTo = () => {};
  vm.createContext(ctx);
  for (const s of sourceOverride) vm.runInContext(s, ctx);
  return { run: code => vm.runInContext(code, ctx), app, storage: existing };
}

/* Probes evaluated inside the game context. They only READ engine state. */
const PROBES = `(function(){
 const pool=side=>side==='user'?M.active:M.oppIds;
 const P=(id,side)=>eventPoint(id,side);
 const all=[...M.active.map(id=>[id,'user']),...M.oppIds.map(id=>[id,'opp'])];
 const problems=[];
 const bs=M.ballState||{};
 if(M.ballOwner!=null){
   if(M.ballSide!=='user'&&M.ballSide!=='opp')problems.push('owner-without-side');
   else if(!pool(M.ballSide).includes(M.ballOwner))problems.push('owner-not-in-team');
   if(bs.state==='LIVE'&&bs.ownerId!==M.ballOwner)problems.push('ballstate-owner-mismatch');
 }else if(M.ballSide!=='none'&&!M.finished)problems.push('side-without-owner');
 if(typeof M.ballOwner==='number'&&M.ballSide==='opp')problems.push('user-id-on-opp-side');
 if(typeof M.ballOwner==='string'&&M.ballSide==='user')problems.push('opp-id-on-user-side');
 const pts=[...all.map(([id,s])=>P(id,s)),bs.position||[50,50]];
 if(pts.some(p=>!Array.isArray(p)||!Number.isFinite(p[0])||!Number.isFinite(p[1])))problems.push('non-finite-position');
 else if(pts.slice(0,-1).some(p=>p[0]<0||p[0]>100||p[1]<0||p[1]>100))problems.push('player-out-of-bounds');
 let minPair=99;
 for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){
   const a=P(...all[i]),b=P(...all[j]);minPair=Math.min(minPair,Math.hypot(a[0]-b[0],a[1]-b[1]));
 }
 const ball=bs.position||[50,50];
 const near=(side,r)=>pool(side).filter(id=>{
   const role=side==='user'?M.matchRoles[id]:null;
   if(role==='GK'||id==='o0')return false;
   const p=P(id,side);return Math.hypot(p[0]-ball[0],p[1]-ball[1])<r}).length;
 const dir=userDirection();
 const meanX=side=>{const ids=pool(side).filter(id=>!(side==='user'?M.matchRoles[id]==='GK':id==='o0'));
   return ids.reduce((n,id)=>n+P(id,side)[0],0)/Math.max(1,ids.length)};
 // corners and penalties deliberately put many players in the box; shape/crowding checks skip that window
 const setPiece=M.events.some(e=>(e.restartType==='CORNER'||e.restartType==='PENALTY')&&M.min-e.minute<=1);
 return {problems,minPair,setPiece,nearUser:near('user',14),nearOpp:near('opp',14),meanXUser:meanX('user'),meanXOpp:meanX('opp'),dir,
   state:bs.state,owner:M.ballOwner,side:M.ballSide,events:M.events.length};
})()`;

/* Drives one match to full time through the real loop, handling half-time and injury stops. */
// like a real manager: a well-suited substitute if there is one, otherwise any fit bench player (position warning accepted)
const SUBSTITUTE = '(function(){window.OUT=M.active.find(id=>S.players.find(p=>p.id===id)?.injury>0);const outP=S.players.find(p=>p.id===window.OUT);const subP=S.players.find(p=>!M.active.includes(p.id)&&!M.out.includes(p.id)&&!M.sentOff.includes(p.id)&&p.injury===0&&positionPenaltyV61(p,M.matchRoles[window.OUT])>=.7);const anyP=subP||S.players.find(p=>!M.active.includes(p.id)&&!M.out.includes(p.id)&&!M.sentOff.includes(p.id)&&p.injury===0&&!["Kirada","Transfer oldu"].includes(p.status));if(anyP)doSub(anyP.id);else if(outP)outP.injury=0;resumeLive()})()';
function playToEnd(h, onTick) {
  let guard = 0, secondHalfStarted = false;
  while (!h.run('M.finished') && guard++ < 500) {
    h.run('advanceLive(60/90)');
    if (onTick) onTick();
    if (h.run('M.reason') === 'half' && !secondHalfStarted) { secondHalfStarted = true; h.run('startSecondHalf()'); if (onTick) onTick('secondHalf'); }
    else if (h.run('M.reason') === 'injury') h.run(SUBSTITUTE);
    else if (h.run('M.pause') && !h.run('M.finished')) h.run('resumeLive()');
  }
  return guard;
}

module.exports = { harness, PROBES, base, playToEnd };
