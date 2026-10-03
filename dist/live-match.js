/* V7.2 live clock and event renderer. Simulation time is never derived from frame count. */
const MATCH_MINUTE_MS = 30000 / 45;
let liveFrame = null, liveLastFrame = null, liveLastPaint = 0, liveTickBusy = false;
const matchSecond = () => Math.min(5400,Math.max(0,Number.isFinite(M?.matchElapsedSeconds)?M.matchElapsedSeconds:0));
const clockFromSeconds = seconds => {
  const total=Math.floor(Math.min(5400,Math.max(0,seconds)));
  return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
};
const matchClock = () => {
  return clockFromSeconds(matchSecond());
};
function ensureLiveState() {
  if (!M) return;
  const legacy=Object.getOwnPropertyDescriptor(M,'clockSeconds');
  if(!Number.isFinite(M.matchElapsedSeconds))M.matchElapsedSeconds=Number.isFinite(legacy?.value)?legacy.value:(Number.isFinite(M.min)?M.min*60:0);
  M.matchElapsedSeconds=Math.min(5400,Math.max(0,M.matchElapsedSeconds));
  // Old save/API compatibility without keeping a second serialized clock.
  if(!legacy||'value' in legacy){delete M.clockSeconds;Object.defineProperty(M,'clockSeconds',{
    configurable:true,get(){return this.matchElapsedSeconds},set(value){this.matchElapsedSeconds=value}
  });}
  M.min=Math.floor(M.matchElapsedSeconds/60);
  M.speed = [0.5, 1, 2].includes(M.speed) ? M.speed : 1;
  M.minuteEvents ??= [];
  M.assistantNote ??= '';
  M.shoutLast ??= {};
  M.playerTouches ??= {};
  M.stats ??= {};
  M.stats.possessionsWon ??= [0, 0];
}
function advanceLive(realSeconds) {
  if (!M || M.pause || M.finished || ['FINISHING','FINISHED'].includes(M.lifecycle) || !Number.isFinite(realSeconds) || realSeconds <= 0) return 0;
  if (liveTickBusy) return 0; // one football minute is processed exactly once, never re-entrantly
  ensureLiveState();
  const next = Math.min(5400, matchSecond() + realSeconds * 90 * M.speed);
  let elapsed = 0;
  liveTickBusy = true;
  try {
  while (!M.pause && !M.finished && matchSecond()<5400 && (Math.floor(matchSecond()/60)+1) * 60 <= next + 1e-7) {
    M.matchElapsedSeconds=(Math.floor(matchSecond()/60)+1)*60;
    M.min=Math.floor(matchSecond()/60);
    M.minuteEvents = [];
    tick();
    liveAssistantNote();
    save();
    elapsed++;
  }
  } finally { liveTickBusy = false; }
  if (!M.pause && !M.finished) {M.matchElapsedSeconds=next;M.min=Math.floor(matchSecond()/60);}
  return elapsed;
}
function setMatchSpeed(speed) {
  if (!M || ![0.5, 1, 2].includes(Number(speed))) return;
  M.speed = Number(speed); save(); render();
}
function pauseLive(reason = 'manual') {
  if (!M || M.finished || M.reason === 'half') return;
  M.pause = true; M.reason = reason; M.lifecycle=reason==='half'?'HALF_TIME':'PAUSED';liveLastFrame = null;
  if(typeof pitchV73!=='undefined'&&pitchV73)pitchV73.lastTime=null;
  save(); render();
}
function resumeLive() {
  if (!M || M.finished || M.reason === 'half') return;
  if (M.requiredSubstitution) resolveUnfillableSubstitution();
  if (M.requiredSubstitution && M.active.includes(M.requiredSubstitution.playerId)) {
    alert('Sakatlanan oyuncu devam edemiyor. Önce oyuncu değişikliği yapın.'); return;
  }
  if(M.requiredSubstitution&&!M.active.includes(M.requiredSubstitution.playerId))M.requiredSubstitution=null;
  M.pause = false; M.reason = ''; M.uiOverlay = null; M.injuryFeedback=null;
  M.lifecycle=M.secondHalf?'RUNNING_SECOND_HALF':'RUNNING';
  liveLastFrame = null;if(typeof pitchV73!=='undefined'&&pitchV73)pitchV73.lastTime=null;save(); render();
}
function liveFrameStep(now) {
  liveFrame = null;
  if (!M || M.finished || M.lifecycle==='FINISHED' || M.pause) { liveLastFrame = null; return; }
  if(typeof document!=='undefined'&&document.hidden){pauseLive('background');return;}
  // Catch up clock time when Safari throttles frames; presentation retains its own .12s cap.
  const dt = liveLastFrame == null ? 0 : Math.min(2, Math.max(0, (now - liveLastFrame) / 1000));
  liveLastFrame = now;
  const oldMin = M.min;
  if(window.ManagerStoryLive3D?.enabled){window.ManagerStoryLive3D.step(dt,now);}
  else if (!M.finished) advanceLive(dt);
  if (M.min !== oldMin || (M.pause && !M.finished)) render();
  else if (now - liveLastPaint >= 45) { paintLivePitch(); liveLastPaint = now; }
  if (M && !M.pause && !M.finished && liveFrame === null)
    liveFrame = requestAnimationFrame(liveFrameStep);
}
function ensureLiveLoop() {
  if (typeof requestAnimationFrame !== 'function' || !M || M.pause || M.finished || M.lifecycle==='FINISHED' || liveFrame !== null) return;
  liveLastFrame = null;
  liveFrame = requestAnimationFrame(liveFrameStep);
}
if(typeof document!=='undefined'&&typeof document.addEventListener==='function'){
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden&&M&&!M.pause&&!M.finished){pauseLive('background');}
    else if(!document.hidden&&M&&M.reason==='background')render();
  });
}
function finalizeMatch(){
  if(!M||M.lifecycle==='FINISHED'||M.lifecycle==='FINISHING')return false;
  M.lifecycle='FINISHING';M.matchElapsedSeconds=5400;M.min=90;M.pause=true;M.reason='end';
  if(liveFrame!==null&&typeof cancelAnimationFrame==='function')cancelAnimationFrame(liveFrame);
  liveFrame=null;liveLastFrame=null;
  if(typeof pitchV73!=='undefined'&&pitchV73){pitchV73.active=null;pitchV73.queue.length=0;pitchV73.progress=0;pitchV73.goalUntil=0;}
  M.finished=true;M.lifecycle='FINISHED';
  M.events.push({type:'end',minute:90,second:5400,gameSecond:5400,text:"🏁 90' Son düdük.",homeGoals:M.hg,awayGoals:M.ag});
  M.story.push("🏁 90' Son düdük.");save();return true;
}
function matchSyncDebug(){
  if(!M)return null;
  const last=M.events?.at(-1),next=typeof pitchV73!=='undefined'?pitchV73?.queue?.[0]:null;
  const goals=M.events?.filter(e=>e.type==='goal')||[];
  const scoreFromGoals=[goals.filter(e=>e.side===0).length,goals.filter(e=>e.side===1).length];
  return {matchState:M.lifecycle,matchElapsedSeconds:matchSecond(),displayClock:matchClock(),
    lastProcessedEvent:last?.gameSecond??null,nextEvent:next?.gameSecond??null,score:[M.hg,M.ag],
    scoreFromGoals,animationEventId:pitchV73?.active?.eventId??null,playbackSpeed:M.speed,
    invariant:matchClock()===clockFromSeconds(matchSecond())&&(!last||last.gameSecond<=matchSecond())&&
      M.hg===scoreFromGoals[0]&&M.ag===scoreFromGoals[1]};
}
/* Legacy style-distribution helper kept for the passing-style test; the live loop uses passOptions() in pitch-v73.js. */
function choosePassTarget(side, owner) {
  const pool = side === 'user' ? M.active.filter(id => id !== owner) : M.oppIds.filter(id => id !== owner);
  if (!pool.length) return owner;
  if (side === 'user') {
    const origin=eventPoint(owner,'user');
    const byDistance=pool.slice().sort((a,b)=>{
      const pa=eventPoint(a,'user'),pb=eventPoint(b,'user');
      return Math.hypot(pa[0]-origin[0],pa[1]-origin[1])-Math.hypot(pb[0]-origin[0],pb[1]-origin[1]);
    });
    if(M.passingStyle==='Kısa'){
      const nearby=byDistance.slice(0,Math.min(3,byDistance.length));
      return nearby[Math.floor(M.rand()*nearby.length)];
    }
    if(M.passingStyle==='Direkt'){
      const direct=pool.filter(id=>['ST','LW','RW'].includes(M.matchRoles[id]));
      const options=direct.length?direct:byDistance.slice(-Math.min(3,byDistance.length));
      return options[Math.floor(M.rand()*options.length)];
    }
    if(M.width==='Geniş'){
      const wide=pool.filter(id=>['LW','RW','LB','RB'].includes(M.matchRoles[id]));
      if(wide.length&&M.rand()<.52)return wide[Math.floor(M.rand()*wide.length)];
    }else if(M.width==='Dar'){
      const central=pool.filter(id=>['CM','CAM','ST'].includes(M.matchRoles[id]));
      if(central.length&&M.rand()<.52)return central[Math.floor(M.rand()*central.length)];
    }
    const creative = pool.filter(id => ['CM','CAM'].includes(M.matchRoles[id]));
    const front = pool.filter(id => ['ST','LW','RW'].includes(M.matchRoles[id]));
    const roll = M.rand();
    if (creative.length && roll < (M.mentality==='Temkinli'?.48:.34)) return creative[Math.floor(M.rand() * creative.length)];
    const forwardThreshold=M.mentality==='Cesur'?.49:M.mentality==='Temkinli'?.82:.66;
    if (front.length && roll > forwardThreshold-(M.tempo==='Yüksek'?.06:0)) return front[Math.floor(M.rand() * front.length)];
  }
  return pool[Math.floor(M.rand() * pool.length)];
}
function liveAssistantNote() {
  if (!M || M.min % 5 || M.min === 0) return;
  M.assistantCooldown ??={};
  const players = S.players.filter(p => M.active.includes(p.id));
  const low = players.slice().sort((a,b) => a.fitness - b.fitness)[0];
  const last = M.events.slice(-40);
  const oppWing = last.filter(e => e.side !== userSide() && e.type === 'cross').length;
  const messages = [];
  if (low?.fitness < 63) messages.push(['fatigue',`${low.name} yoruluyor: fitness %${Math.round(low.fitness)}. Mesafeleri takip edin.`]);
  if (oppWing >= 2) messages.push(['wing',`Rakip son pozisyonlarda ${oppWing} kez kanattan orta yaptı.`]);
  if (M.stats.xg[1-userSide()] - M.stats.xg[userSide()] > .4) messages.push(['xg','Rakibin xG üstünlüğü artıyor; savunma dengesini gözden geçirebilirsiniz.']);
  if(M.shots[1-userSide()] - M.shots[userSide()] >=4)messages.push(['shots','Rakip şutlarda öne geçti; ceza sahası çevresindeki boşlukları kapatabiliriz.']);
  const ownPoss=matchPossession()[userSide()];
  if(M.min>=20&&ownPoss<40)messages.push(['possession','Rakip topu daha fazla kullanıyor. Pas bağlantılarını güçlendirebiliriz.']);
  if(typeof pitchSpace==='function'&&M.dynamicPositions){
    const userDir=userDirection(),rightBack=M.active.find(id=>M.matchRoles[id]==='RB');
    const back=rightBack==null?null:eventPoint(rightBack,'user');
    const base=rightBack==null?null:basePitchPosition(rightBack,'user');
    if(back&&base&&(back[0]-base[0])*userDir>15&&
       M.oppIds.some(id=>{const q=eventPoint(id,'opp');return Math.abs(q[1]-base[1])<19&&Math.abs(q[0]-base[0])<31;}))
      messages.unshift(['rightSpace','Sağ bekimiz ileride kaldı; arkasındaki koridorda rakip oyuncu var.']);
    const middle=[37,63],ours=M.active.filter(id=>{const q=eventPoint(id,'user');return q[1]>middle[0]&&q[1]<middle[1]&&q[0]>35&&q[0]<65;}).length;
    const theirs=M.oppIds.filter(id=>{const q=eventPoint(id,'opp');return q[1]>middle[0]&&q[1]<middle[1]&&q[0]>35&&q[0]<65;}).length;
    if(theirs>=ours+2)messages.unshift(['middle','Rakip orta sahada sayısal üstünlük kuruyor.']);
    const forwardPositions=M.active.map(id=>eventPoint(id,'user')[0]*userDir);
    if(forwardPositions.length>6&&Math.max(...forwardPositions)-Math.min(...forwardPositions)>67)
      messages.push(['shape','Hatlarımız arasındaki mesafe açıldı.']);
    const recentPress=last.filter(e=>e.type==='press'&&e.toSide==='user'&&e.minute>=M.min-8);
    const recentWins=last.filter(e=>e.type==='tackle'&&e.toSide==='user'&&e.success&&e.minute>=M.min-8);
    if(recentPress.length>=3&&recentWins.length===0&&low?.fitness<72)
      messages.unshift(['pressFade','Son bölümde presimiz top kazandırmıyor; oyuncular yorulmuş görünüyor.']);
    const rivalDefenders=M.oppIds.filter(id=>['CB','LB','RB'].includes(opponentPlayer(id)?.position))
      .map(id=>eventPoint(id,'opp')[0]*userDir);
    if(rivalDefenders.length>=3&&M.ballSide==='user'&&
       rivalDefenders.reduce((a,b)=>a+b,0)/rivalDefenders.length>0&&
       M.active.some(id=>M.matchRoles[id]==='ST'&&playerAttribute(id,'user','pace',65)>77))
      messages.push(['lineSpace','Rakip savunmanın arkasında koşu alanı bırakıyor.']);
  }
  const fresh=messages.find(([key])=>M.min-(M.assistantCooldown[key]??-20)>=12);
  if(fresh){M.assistantNote=fresh[1];M.assistantCooldown[fresh[0]]=M.min;}
}
function halfAnalysisV72() {
  const own=userSide(),rival=1-own,ours=M.stats.xg[own],theirs=M.stats.xg[rival];
  const low=S.players.filter(p=>M.active.includes(p.id)).sort((a,b)=>a.fitness-b.fitness)[0];
  if(low?.fitness<75)return `${low.name} fitness %${Math.round(low.fitness)}. İkinci yarıda temposunu izleyin.`;
  if(theirs>ours+.2)return `Rakibin xG'si ${theirs.toFixed(2)}, bizimki ${ours.toFixed(2)}. Tehlikeli bölgelere daha sık giriyorlar.`;
  if(ours>theirs+.2)return `${M.shots[own]} şut ve ${ours.toFixed(2)} xG ürettik; rakip ${M.shots[rival]} şutta kaldı.`;
  const passes=M.stats.passes[own],accuracy=passes?Math.round(100*M.stats.completedPasses[own]/passes):0;
  return `İlk yarı ${passes} pas yaptık; pas isabeti %${accuracy}. Skor ${M.hg}–${M.ag}.`;
}
function shoutLive(type, id = null) {
  if (!M || M.finished || !M.pause) return;
  const labels = { calm:'Sakin olun!', forward:'Öne çıkın!', press:'Presi artırın!', hold:'Topu tutun!', brave:'Daha cesur!', fight:'Sonuna kadar!' };
  if (!labels[type]) return;
  const key = `${type}:${id ?? 'team'}`;
  if (M.min - (M.shoutLast[key] ?? -100) < 10) { alert('Bu seslenişin etkisi için yaklaşık 10 oyun dakikası bekle.'); return; }
  M.shoutLast[key] = M.min;
  const targets = id == null ? S.players.filter(p => M.active.includes(p.id)) : S.players.filter(p => p.id === id && M.active.includes(id));
  for (const p of targets) {
    const temperament = p.age >= 29 || p.personality === 'Lider' ? 1 : p.age < 21 ? .5 : .8;
    const response = (p.form || 70) >= 55 ? 1 : -1;
    const delta = Math.round((type === 'calm' || type === 'hold' ? 1 : 2) * temperament * response);
    p.morale = clamp(p.morale + delta, 25, 100);
  }
  matchEvent('shout', `📣 ${M.min}' ${id == null ? 'Takıma' : targets[0]?.name + ' oyuncusuna'}: ${labels[type]}`, { playerId:id });
  save(); render();
}
