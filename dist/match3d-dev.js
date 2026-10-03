import { createMatchScene, pitchToWorld } from './match3d-scene.js';
// Stage 2: no simulation, football animations or automatic camera chase.
const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('./match3d-dev.css',import.meta.url);document.head.append(link);
const shell=document.createElement('section');shell.className='match3d-shell';shell.setAttribute('aria-label','3D geliştirme görünümü');
shell.innerHTML=`<header class="m3-brand"><span>☰</span><strong>ManagerStory</strong><small>3D · Aşama 2</small><button data-close aria-label="Mevcut oyuna dön">×</button></header>
<section class="m3-score"><div data-home></div><div><strong data-score>— : —</strong><small data-clock>GÖRSEL TEST</small></div><div data-away></div></section>
<div class="m3-viewbar"><span data-mode>Görsel test sahnesi · maç simülasyonu yok</span><button data-camera="broadcast" aria-pressed="true">Yayın</button><button data-camera="overview">Saha</button><button data-camera="model">Model</button></div>
<div class="m3-stage"><canvas data-scene aria-label="Gerçek 3D futbol sahası"></canvas><div class="m3-badge">GELİŞTİRME</div><select data-fixture aria-label="Görsel test yerleşimi" style="position:absolute;right:10px;top:10px;background:#082e25d9;color:#f8edc9;border:1px solid #9baf8c;border-radius:4px;padding:4px;font-size:10px"><option value="short">Test: Yakın pas</option><option value="long">Test: Uzun pas</option></select><span data-endpoint="0" class="m3-testpoint">Başlangıç</span><span data-endpoint="1" class="m3-testpoint">Hedef</span><div class="m3-radar"><canvas width="240" height="156" data-radar></canvas><small>Aynı veriden test radarı · Aşama 5 bekliyor</small></div></div>
<div class="m3-commentary" data-commentary>Görsel test yerleşimi. Futbol animasyonları Aşama 3’te.</div>
<div class="m3-stats"><div>ŞUT<strong data-shots>—</strong></div><div>TOPLA<strong data-possession>—</strong></div><div>xG<strong data-xg>—</strong></div></div>
<footer class="m3-controls"><button disabled>⏸ Duraklat</button><button disabled>0.5× · 1× · 2×</button><button disabled>Taktik</button></footer><output data-status></output>`;
document.body.append(shell);
const $=q=>shell.querySelector(q),canvas=$('[data-scene]');
const initial=window.MatchView.read(),identities=window.MatchView.previewIdentity();
const home=initial?.teams.home||identities.user,away=initial?.teams.away||identities.rival;
function team(node,identity){const mark=document.createElement('span');mark.className='m3-crest';mark.style.background=`linear-gradient(90deg,${identity.primaryColor} 50%,${identity.secondaryColor} 50%)`;node.append(mark,document.createTextNode(identity.name));}
team($('[data-home]'),home);team($('[data-away]'),away);
const layout=[[5,50],[22,20],[25,40],[25,64],[22,83],[57,62],[65,59],[50,51],[62,77],[70,50],[78,43]];
const previewPlayers=['user','opp'].flatMap(side=>layout.map((position,i)=>({id:`test-${side}-${i}`,side,number:i+1,goalkeeper:i===0,position:side==='user'?position:[100-position[0],100-position[1]],attackDirection:side==='user'?1:-1})));
const players=initial?initial.players.map((p,i)=>({...p,position:p.displayPosition||p.enginePosition,number:i%11+1,goalkeeper:p.role==='GK',kit:p.side==='user'?(initial.teams.userHome?home:away):(initial.teams.userHome?away:home)})):previewPlayers;
if(!initial){previewPlayers[16].position=[61,57];previewPlayers[17].position=[63,67];previewPlayers[18].position=[53,60];}
let testBall=[57.2,62],testEndpoints=[[57.2,62],[65,59]],testFixture='short';
$('[data-fixture]').hidden=!!initial;
let view,unsubscribe=()=>{},observer,closed=false,lastSnapshot=initial;
const initStart=performance.now();
function radar(snapshot){
 const c=$('[data-radar]').getContext('2d'),w=240,h=156;c.clearRect(0,0,w,h);c.strokeStyle='#d5e2cd';c.lineWidth=1;c.strokeRect(8,8,w-16,h-16);c.beginPath();c.moveTo(w/2,8);c.lineTo(w/2,h-8);c.stroke();c.beginPath();c.arc(w/2,h/2,18,0,Math.PI*2);c.stroke();
 for(const x of [8,w-38])c.strokeRect(x,h/2-27,30,54);
 const list=snapshot?snapshot.players.map(p=>({...p,position:p.displayPosition||p.enginePosition})):players;
 for(const p of list){if(!p.position)continue;c.fillStyle=p.side==='user'?(initial?.teams.userHome===false?away:home).primaryColor:(initial?.teams.userHome===false?home:away).primaryColor;c.beginPath();c.arc(8+p.position[0]/100*(w-16),8+p.position[1]/100*(h-16),3,0,Math.PI*2);c.fill();c.strokeStyle='#e5eadf';c.stroke();}
 const xy=snapshot?(snapshot.ball.displayPosition||snapshot.ball.engine?.position):testBall;if(xy){c.fillStyle='white';c.beginPath();c.arc(8+xy[0]/100*(w-16),8+xy[1]/100*(h-16),2,0,Math.PI*2);c.fill();}
}
function paint(snapshot){
 if(closed||!view)return;
 if(snapshot){lastSnapshot=snapshot;view.apply(snapshot);$('[data-score]').textContent=snapshot.score.join(' – ');const sec=Math.floor(snapshot.matchSeconds);$('[data-clock]').textContent=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')} · ${snapshot.paused?'DURAKLADI':'CANLI'}`;
 $('[data-mode]').textContent='Salt okunur maç görünümü · temas animasyonu bekliyor';$('[data-commentary]').textContent=snapshot.lastEvent?.text||'Maç verisi okunuyor.';
 $('[data-shots]').textContent=snapshot.statistics.shots?.join(' – ')||'—';$('[data-xg]').textContent=snapshot.statistics.xg?.map(v=>v.toFixed(2)).join(' – ')||'—';$('[data-possession]').textContent=snapshot.statistics.possession?.map(v=>`%${v}`).join(' – ')||'—';}
 const t=performance.now(),info=view.render();radar(lastSnapshot);
 shell.querySelectorAll('[data-endpoint]').forEach((node,i)=>{node.hidden=!!initial||view.cameraRig.mode!=='broadcast';const [x,y]=view.projectPoint(testEndpoints[i]);const half=node.offsetWidth/2;node.style.left=`${Math.max(half+4,Math.min(canvas.clientWidth-half-4,x))}px`;node.style.top=`${y-(testFixture==='short'?48:20)}px`;});
 window.ManagerStory3DDebug={mode:initial?'match-readonly':'visual-test',fixture:initial?null:testFixture,testEndpoints:initial?null:testEndpoints,players:view.footballers.size,balls:1,bones:16,initMs:window.ManagerStory3DDebug?.initMs??performance.now()-initStart,renderSubmissionMs:performance.now()-t,...info,canvas:[canvas.width,canvas.height],renderer:view.renderer.getContext().getParameter(view.renderer.getContext().RENDERER)};
 $('[data-status]').textContent=`WebGL2 · ${view.footballers.size} futbolcu · ${info.calls} çizim · geliştirme görünümü`;
}
function dispose(){if(closed)return;closed=true;unsubscribe();observer?.disconnect();view?.dispose();shell.remove();link.remove();window.removeEventListener('pagehide',dispose);delete window.ManagerStory3D;}
$('[data-close]').addEventListener('click',dispose);window.addEventListener('pagehide',dispose,{once:true});
try {
 view=createMatchScene({canvas,home,away,players});
 function setFixture(kind){
   testFixture=kind;players.forEach((p,i)=>{view.footballers.get(`${p.side}:${p.id}`).position.copy(pitchToWorld(p.position));});
   if(kind==='long'){
     testBall=[40.2,60];testEndpoints=[testBall,[78,32]];
     const source=players[5],target=players[10];source.position=[40,60];target.position=[78,32];
     view.footballers.get(`${source.side}:${source.id}`).position.copy(pitchToWorld(source.position));view.footballers.get(`${target.side}:${target.id}`).position.copy(pitchToWorld(target.position));
   }else{players[5].position=[57,62];players[10].position=[78,43];view.footballers.get(`${players[5].side}:${players[5].id}`).position.copy(pitchToWorld(players[5].position));view.footballers.get(`${players[10].side}:${players[10].id}`).position.copy(pitchToWorld(players[10].position));testBall=[57.2,62];testEndpoints=[testBall,[65,59]];}
   view.ball.position.copy(pitchToWorld(testBall));view.ball.position.y=.15;
   view.framePoints(testEndpoints.map(pitchToWorld));view.setCamera('broadcast');
   const carrier=view.footballers.get(`${players[5].side}:${players[5].id}`),a=pitchToWorld(testEndpoints[0]),b=pitchToWorld(testEndpoints[1]);carrier.rotation.y=Math.atan2(b.x-a.x,b.z-a.z);
   $('[data-commentary]').textContent=`${kind==='long'?'Uzun':'Yakın'} pas görsel testi · sabit yerleşim; maç olayı yok.`;
   shell.querySelectorAll('[data-camera]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.camera==='broadcast')));$('.m3-radar').hidden=false;paint(null);
 }
 if(!initial){setFixture('short');$('[data-fixture]').addEventListener('change',e=>setFixture(e.target.value));}
 else {const xy=initial.ball.displayPosition||initial.ball.engine?.position;if(xy){view.framePoints([pitchToWorld(xy)]);view.setCamera('broadcast');}}
 observer=new ResizeObserver(()=>{view.resize();paint(lastSnapshot)});observer.observe(canvas);
 shell.querySelectorAll('[data-camera]').forEach(button=>button.addEventListener('click',()=>{shell.querySelectorAll('[data-camera]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));$('.m3-radar').hidden=button.dataset.camera==='model';view.setCamera(button.dataset.camera);paint(lastSnapshot)}));
 unsubscribe=window.MatchView.subscribe(paint);paint(initial);
 window.ManagerStory3D={view,paint:()=>paint(lastSnapshot),dispose};
} catch(error){console.error('3D geliştirme sahnesi açılamadı',error);$('[data-status]').textContent='WebGL açılamadı. × ile mevcut oyuna dön.';}
