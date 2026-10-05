import { createMatchScene } from './match3d-scene.js';
import { createLivePoseSampler } from './match3d-live-view.js';
const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('./match3d-career.css',import.meta.url);document.head.append(link);
const surface=document.createElement('div');surface.className='career3d';
surface.innerHTML='<canvas class="career3d-scene" aria-label="Canlı 3D saha"></canvas><canvas class="career3d-radar" width="200" height="130" aria-label="Aynı maçın radarı"></canvas><p role="status" hidden></p>';
const canvas=surface.querySelector('.career3d-scene'),radar=surface.querySelector('.career3d-radar'),status=surface.querySelector('[role=status]');
let match=null,view=null,sampler=createLivePoseSampler(),roster='',failed=false;
function dispose(){view?.dispose();view=null;roster='';failed=false;sampler=createLivePoseSampler();}
function paint(snapshot){
 if(failed||!snapshot||!surface.isConnected||!canvas.clientWidth)return;
 try{
  const key=JSON.stringify(snapshot.players.map(p=>[p.side,p.id,p.role]));
  if(key!==roster){
   view?.dispose({loseContext:false});sampler=createLivePoseSampler();
   const {home,away,userHome}=snapshot.teams;
   const players=snapshot.players.map((p,i)=>({...p,position:p.displayPosition||p.enginePosition,number:i%11+1,goalkeeper:p.role==='GK',kit:p.side==='user'?(userHome?home:away):(userHome?away:home)}));
   view=createMatchScene({canvas,home,away,players});roster=key;
  }
  view.resize();const sample=sampler(snapshot);view.applyLiveSample(sample);view.render();
  const c=radar.getContext('2d'),w=200,h=130;c.clearRect(0,0,w,h);c.strokeStyle='#d5e2cd';c.strokeRect(5,5,w-10,h-10);c.beginPath();c.moveTo(w/2,5);c.lineTo(w/2,h-5);c.stroke();
  for(const p of snapshot.players){const xy=p.displayPosition||p.enginePosition;if(!xy)continue;const team=p.side==='user'?(snapshot.teams.userHome?snapshot.teams.home:snapshot.teams.away):(snapshot.teams.userHome?snapshot.teams.away:snapshot.teams.home);c.fillStyle=team.primaryColor;c.beginPath();c.arc(5+xy[0]*1.9,5+xy[1]*1.2,2.5,0,Math.PI*2);c.fill();c.stroke();}
  const xy=snapshot.ball.displayPosition||snapshot.ball.engine.position;c.fillStyle='white';c.beginPath();c.arc(5+xy[0]*1.9,5+xy[1]*1.2,2,0,Math.PI*2);c.fill();status.hidden=true;
 }catch(error){failed=true;status.hidden=false;status.textContent='3D saha açılamadı. 2D görünümü seçerek devam edebilirsiniz.';console.warn('Kariyer 3D sahası',error);}
}
window.ManagerStoryCareer3D={
 detach(){surface.remove();if(!M){dispose();if(match)window.ManagerStoryLive3D.disable();match=null;}},
 mount(){
  if(match!==M){dispose();match=M;}
  if(M?.fieldView==='3d'&&!window.ManagerStoryLive3D.enabled){window.ManagerStoryLive3D.enable();window.ManagerStoryLive3D.setTempo(1);}
  const host=document.querySelector('#career-3d-host');if(!host)return;
  host.append(surface);paint(window.MatchView.read());
 },
 get view(){return view;}
};
window.MatchView.subscribe(paint);
new ResizeObserver(()=>paint(window.MatchView.read())).observe(canvas);
window.addEventListener('pagehide',dispose);
// A module may load after the classic-script render has already restored a match.
window.ManagerStoryCareer3D.mount();
