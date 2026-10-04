import { createMatchScene, pitchToWorld } from './match3d-scene.js';
import { createPassReplay } from './match3d-pass-replay.js';
import { createLivePoseSampler } from './match3d-live-view.js';
// Stage 3B: opt-in existing live engine; unsupported animations remain explicit.
const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('./match3d-dev.css',import.meta.url);document.head.append(link);
const shell=document.createElement('section');shell.className='match3d-shell';shell.setAttribute('aria-label','3D geliştirme görünümü');
shell.innerHTML=`<header class="m3-brand"><span>☰</span><strong>ManagerStory</strong><small>3D · Aşama 3G</small><button data-close aria-label="Mevcut oyuna dön">×</button></header>
<section class="m3-score"><div data-home></div><div><strong data-score>— : —</strong><small data-clock>GÖRSEL TEST</small></div><div data-away></div></section>
<div class="m3-viewbar"><span data-mode>Görsel test sahnesi · maç simülasyonu yok</span><button data-camera="broadcast" aria-pressed="true">Yayın</button><button data-camera="overview">Saha</button><button data-camera="model">Model</button></div>
<div class="m3-stage"><canvas data-scene aria-label="Gerçek 3D futbol sahası"></canvas><div class="m3-badge">ANİMASYON TESTİ</div><select data-fixture aria-label="Görsel test yerleşimi" style="position:absolute;right:10px;top:10px;background:#082e25d9;color:#f8edc9;border:1px solid #9baf8c;border-radius:4px;padding:4px;font-size:10px"><option value="live">Gerçek maç · okunabilir tempo</option><option value="short">Kayıt: Kısa pas</option><option value="long">Kayıt: Uzun pas</option><option value="intercepted">Kayıt: Kesilen pas</option></select><span data-endpoint="0" class="m3-testpoint">Başlangıç</span><span data-endpoint="1" class="m3-testpoint">Hedef</span><div class="m3-radar"><canvas width="240" height="156" data-radar></canvas><small>Aynı veriden test radarı · Aşama 5 bekliyor</small></div></div>
<div class="m3-commentary" data-commentary>Görsel test yerleşimi. Futbol animasyonları Aşama 3’te.</div>
<div class="m3-stats"><div>ŞUT<strong data-shots>—</strong></div><div>TOPLA<strong data-possession>—</strong></div><div>xG<strong data-xg>—</strong></div></div>
<footer class="m3-controls"><button data-play>▶ Oynat</button><button data-speed="0.5">0.5×</button><button data-speed="1" aria-pressed="true">1×</button><button data-speed="2">2×</button><button data-tempo disabled title="Tüm maçı ortak saatten yavaşlatır">Tempo /4</button></footer><output data-status></output>`;
document.body.append(shell);
const $=q=>shell.querySelector(q),canvas=$('[data-scene]');
const initial=window.MatchView.read(),identities=window.MatchView.previewIdentity();
const recordings=!initial?await fetch(new URL('./match3d-pass-recordings.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('Kayıt yüklenemedi');return r.json()}):null;
let home=initial?.teams.home||recordings?.examples.short.teams.home||identities.user,away=initial?.teams.away||recordings?.examples.short.teams.away||identities.rival;
function team(node,identity){const mark=document.createElement('span');mark.className='m3-crest';mark.style.background=`linear-gradient(90deg,${identity.primaryColor} 50%,${identity.secondaryColor} 50%)`;node.append(mark,document.createTextNode(identity.name));}
team($('[data-home]'),home);team($('[data-away]'),away);
const layout=[[5,50],[22,20],[25,40],[25,64],[22,83],[57,62],[65,59],[50,51],[62,77],[70,50],[78,43]];
const previewPlayers=['user','opp'].flatMap(side=>layout.map((position,i)=>({id:`test-${side}-${i}`,side,number:i+1,goalkeeper:i===0,position:side==='user'?position:[100-position[0],100-position[1]],attackDirection:side==='user'?1:-1})));
let players=initial?initial.players.map((p,i)=>({...p,position:p.displayPosition||p.enginePosition,number:i%11+1,goalkeeper:p.role==='GK',kit:p.side==='user'?(initial.teams.userHome?home:away):(initial.teams.userHome?away:home)})):recordings.examples.short.players.map((p,i)=>({...p,position:p.enginePosition,number:i%11+1,goalkeeper:p.role==='GK',kit:p.side==='user'?(recordings.examples.short.teams.userHome?home:away):(recordings.examples.short.teams.userHome?away:home)}));
if(!initial){previewPlayers[16].position=[61,57];previewPlayers[17].position=[63,67];previewPlayers[18].position=[53,60];}
let testBall=[57.2,62],testEndpoints=[[57.2,62],[65,59]],testFixture='short';
$('[data-fixture]').hidden=false;$('[data-fixture]').value='short';
let liveMode=!!initial,liveSampler=createLivePoseSampler();
let replay=null;let view,unsubscribe=()=>{},observer,closed=false,lastSnapshot=initial;
const initStart=performance.now();
function radar(snapshot,renderedPlayers=null,ballPosition=null){
 const c=$('[data-radar]').getContext('2d'),w=240,h=156;c.clearRect(0,0,w,h);c.strokeStyle='#d5e2cd';c.lineWidth=1;c.strokeRect(8,8,w-16,h-16);c.beginPath();c.moveTo(w/2,8);c.lineTo(w/2,h-8);c.stroke();c.beginPath();c.arc(w/2,h/2,18,0,Math.PI*2);c.stroke();
 for(const x of [8,w-38])c.strokeRect(x,h/2-27,30,54);
 const list=renderedPlayers||(snapshot?snapshot.players.map(p=>({...p,position:p.displayPosition||p.enginePosition})):players);
 for(const p of list){if(!p.position)continue;c.fillStyle=p.side==='user'?(initial?.teams.userHome===false?away:home).primaryColor:(initial?.teams.userHome===false?home:away).primaryColor;c.beginPath();c.arc(8+p.position[0]/100*(w-16),8+p.position[1]/100*(h-16),3,0,Math.PI*2);c.fill();c.strokeStyle='#e5eadf';c.stroke();}
 const xy=ballPosition||(snapshot?(snapshot.ball.displayPosition||snapshot.ball.engine?.position):testBall);if(xy){c.fillStyle='white';c.beginPath();c.arc(8+xy[0]/100*(w-16),8+xy[1]/100*(h-16),2,0,Math.PI*2);c.fill();}
}
function paint(snapshot){
 if(closed||!view)return;
 if(snapshot){lastSnapshot=snapshot;const sample=liveSampler(snapshot);const contacts=view.applyLiveSample(sample);window.ManagerStoryLiveSample={...sample,contacts};$('[data-score]').textContent=(!snapshot.finished&&snapshot.presentation?.eventScore||snapshot.score).join(' – ');const sec=Math.floor(snapshot.presentation?.matchSeconds??snapshot.matchSeconds);$('[data-clock]').textContent=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')} · ${snapshot.paused?'DURAKLADI':'CANLI'}`;
 const event=snapshot.presentation?.looseMotion?.event||snapshot.presentation?.shotMotion?.event||snapshot.presentation?.contestMotion?.event||snapshot.presentation?.activeEvent;
 $('[data-mode]').textContent=`Gerçek MatchEngine · ${window.ManagerStoryLive3D.tempo===4?'okunabilir tempo /4':'standart tempo'} · ${snapshot.speed}×`;
 $('.m3-badge').textContent='CANLI MOTOR · DAKİKA ADIMI';
 const contest=snapshot.presentation?.contestMotion;
 $('[data-commentary]').textContent=contest?.phase==='approach'?'Top sürme · rakip yaklaşıyor':event?(event.type==='kickoff'?snapshot.presentation.progress<.19?'Santra hazır · ilk temas bekleniyor':event.text:snapshot.presentation?.looseMotion||snapshot.presentation?.shotMotion||snapshot.presentation?.contestMotion||sample.pass||event.type==='firstTouch'||['dribble','ballCarry','run'].includes(event.type)?event.text:event.type==='enginePositionGap'?event.sampleInterval?.phase==='restart-placement'?'Santra yerleşimi · oyun henüz başlamadı · türetilmiş geçiş':event.sampleInterval?.phase==='after-position-update-before-action-decisions'?`Dakika ${event.sampleInterval.fromGameSecond/60} → ${event.sampleInterval.toGameSecond/60} · motor örnekleri arasında sunum hareketi`:`Motor konum örnekleri · ${event.gapMetres.toFixed(1)} m · türetilmiş ara hareket; gerçek olay değil`:`Desteklenmeyen animasyon: ${event.type} · ${event.text||'motor konum geçişi'}`):'Motorun sonraki dakika adımı bekleniyor.';
 if(sample.pass&&event.success===false&&snapshot.presentation.progress<.76)$('[data-commentary]').textContent='Pas · top yolda · kazanım teması bekleniyor';
 if(event?.heavyTouch&&snapshot.presentation.progress<.76)$('[data-commentary]').textContent='Top sürme · gerçek kötü kontrol olayına ilerliyor';
 $('[data-play]').textContent=snapshot.paused?'▶ Devam':'⏸ Duraklat';
 $('.m3-radar small').textContent='Aynı maç / aynı sunum zamanı';
 $('[data-tempo]').disabled=false;$('[data-tempo]').textContent=`Tempo /${window.ManagerStoryLive3D.tempo}`;
 shell.querySelectorAll('[data-speed]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.speed)===snapshot.speed)));
 const statistics=!snapshot.finished&&snapshot.presentation?.eventStatistics||snapshot.statistics;
 $('[data-shots]').textContent=statistics.shots?.join(' – ')||'—';$('[data-xg]').textContent=statistics.xg?.map(v=>v.toFixed(2)).join(' – ')||'—';$('[data-possession]').textContent=statistics.possession?.map(v=>`%${v}`).join(' – ')||'—';}
 const t=performance.now(),info=view.render();radar(lastSnapshot);
 shell.querySelectorAll('[data-endpoint]').forEach((node,i)=>{node.hidden=liveMode||view.cameraRig.mode!=='broadcast';const [x,y]=view.projectPoint(testEndpoints[i]);const half=node.offsetWidth/2;node.style.left=`${Math.max(half+4,Math.min(canvas.clientWidth-half-4,x))}px`;node.style.top=`${y-(testFixture==='short'?48:20)}px`;});
 window.ManagerStory3DDebug={mode:liveMode?'live-engine-shared-clock':'visual-test',fixture:liveMode?null:testFixture,testEndpoints:liveMode?null:testEndpoints,players:view.footballers.size,balls:1,bones:16,initMs:window.ManagerStory3DDebug?.initMs??performance.now()-initStart,renderSubmissionMs:performance.now()-t,...info,canvas:[canvas.width,canvas.height],renderer:view.renderer.getContext().getParameter(view.renderer.getContext().RENDERER)};
 const sp=snapshot?.presentation;
 $('[data-status]').textContent=liveMode?`Ortak saat ${window.ManagerStoryLive3D.time.toFixed(2)} s · kuyruk ${sp?.queuedEventIds.length||0} · motor ${snapshot?.matchSeconds??0} s · tempo /${window.ManagerStoryLive3D.tempo}`:`WebGL2 · ${view.footballers.size} futbolcu · ${info.calls} çizim`;
 if(liveMode&&snapshot){const e=sp?.activeEvent;const names=e&&(['pass','cross','firstTouch'].includes(e.type))?[snapshot.players.find(p=>p.id===e.fromId&&p.side===e.fromSide),snapshot.players.find(p=>p.id===e.toId&&p.side===e.toSide)]:[];shell.querySelectorAll('[data-endpoint]').forEach((node,i)=>{const p=names[i];node.hidden=!p||(i===1&&names[0]?.id===p?.id&&names[0]?.side===p?.side); if(p){node.textContent=p.name;const [x,y]=view.projectPoint(p.displayPosition||p.enginePosition);node.style.left=`${Math.max(38,Math.min(canvas.clientWidth-38,x))}px`;node.style.top=`${y-25}px`;}})}
}
function dispose(){if(closed)return;closed=true;replay?.dispose();window.ManagerStoryLive3D.disable();unsubscribe();observer?.disconnect();view?.dispose();shell.remove();link.remove();window.removeEventListener('pagehide',dispose);delete window.ManagerStory3D;}
$('[data-tempo]').addEventListener('click',()=>{if(!liveMode)return;window.ManagerStoryLive3D.setTempo(window.ManagerStoryLive3D.tempo===4?1:4);$('[data-tempo]').textContent=`Tempo /${window.ManagerStoryLive3D.tempo}`;paint(window.MatchView.read())});
$('[data-close]').addEventListener('click',dispose);window.addEventListener('pagehide',dispose,{once:true});
function connectLive(){
 if(liveMode)return;
 if(!S){$('[data-fixture]').value='short';$('[data-status]').textContent='Önce × ile mevcut oyundan kariyer oluştur veya kaydını aç.';return;}
 window.ManagerStoryLive3D.enable();
 if(!window.MatchView.read())startMatch();
 const snapshot=window.MatchView.read();if(!snapshot)return;
 replay?.dispose();replay=null;view.dispose({loseContext:false});liveMode=true;lastSnapshot=snapshot;liveSampler=createLivePoseSampler();
 home=snapshot.teams.home;away=snapshot.teams.away;
 for(const q of ['[data-home]','[data-away]'])$(q).replaceChildren();team($('[data-home]'),home);team($('[data-away]'),away);
 players=snapshot.players.map((p,i)=>({...p,position:p.displayPosition||p.enginePosition,number:i%11+1,goalkeeper:p.role==='GK',kit:p.side==='user'?(snapshot.teams.userHome?home:away):(snapshot.teams.userHome?away:home)}));
 view=createMatchScene({canvas,home,away,players});
 window.ManagerStory3D={view,replay:null,paint:()=>paint(window.MatchView.read()),dispose};
 paint(snapshot);ensureLiveLoop();
}
try {
 view=createMatchScene({canvas,home,away,players});
 if(!initial){
   shell.querySelectorAll('[data-endpoint]').forEach(n=>n.hidden=true);
   replay=createPassReplay({view,recordings,players,onFrame:({sample,metrics,entry,kind,clock,players:rendered})=>{
     testBall=sample.ballPercent;radar(null,rendered,sample.ballPercent);
     $('[data-mode]').textContent='Kayıtlı motor olayı · animasyon testi';
     $('[data-clock]').textContent=`OLAY #${sample.eventId} · ${entry.record.event.minute}′`;
     $('[data-commentary]').textContent=`${sample.phase} · ${entry.record.event.text} · canlı maç değil`;
     $('[data-play]').textContent=clock.paused?'▶ Oynat':'⏸ Duraklat';
     window.ManagerStory3DDebug={mode:'recorded-event-animation-test',fixture:kind,players:view.footballers.size,balls:1,eventId:sample.eventId,eventTime:sample.time,phase:sample.phase,...metrics};
     $('[data-status]').textContent=`Olay zamanı ${clock.time.toFixed(2)} s · ${clock.speed}× · aynı motor kaydı`;
   }});

   $('[data-play]').addEventListener('click',()=>{if(liveMode){window.ManagerStoryLive3D.togglePause();paint(window.MatchView.read());return}if(replay.clock.paused)replay.play();else replay.pause();replay.paint()});
   shell.querySelectorAll('[data-speed]').forEach(b=>b.addEventListener('click',()=>{if(liveMode){window.ManagerStoryLive3D.setSpeed(Number(b.dataset.speed));paint(window.MatchView.read())}else replay.clock.setSpeed(Number(b.dataset.speed));shell.querySelectorAll('[data-speed]').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));if(replay)replay.paint()}));
 }else{window.ManagerStoryLive3D.enable();$('[data-fixture]').value='live';$('[data-play]').addEventListener('click',()=>window.ManagerStoryLive3D.togglePause());shell.querySelectorAll('[data-speed]').forEach(b=>b.addEventListener('click',()=>window.ManagerStoryLive3D.setSpeed(Number(b.dataset.speed))));const xy=initial.ball.displayPosition||initial.ball.engine?.position;if(xy){view.framePoints([pitchToWorld(xy)]);view.setCamera('broadcast');}}
 observer=new ResizeObserver(()=>{view.resize();if(replay)replay.paint();else paint(lastSnapshot)});observer.observe(canvas);
 shell.querySelectorAll('[data-camera]').forEach(button=>button.addEventListener('click',()=>{shell.querySelectorAll('[data-camera]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));$('.m3-radar').hidden=button.dataset.camera==='model';view.setCamera(button.dataset.camera,replay?`${(replay.clock.time>=replay.record.arrivalAt?replay.sample.receiver:replay.sample.source).side}:${(replay.clock.time>=replay.record.arrivalAt?replay.sample.receiver:replay.sample.source).id}`:null);if(replay)replay.paint();else paint(lastSnapshot)}));
 unsubscribe=window.MatchView.subscribe(paint);if(!replay)paint(initial);
 $('[data-fixture]').addEventListener('change',e=>{if(e.target.value==='live')connectLive();else if(liveMode){$('[data-fixture]').value='live';$('[data-status]').textContent='Kayıt testine dönmek için × ile kapat; devam eden maç korunur.';}else replay.select(e.target.value)});
 window.ManagerStory3D={view,replay,paint:()=>replay?replay.paint():paint(lastSnapshot),dispose};
} catch(error){console.error('3D geliştirme sahnesi açılamadı',error);$('[data-status]').textContent='WebGL açılamadı. × ile mevcut oyuna dön.';}
