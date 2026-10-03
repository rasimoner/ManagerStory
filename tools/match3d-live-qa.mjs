import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const { chromium }=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright' : 'playwright');
const root=path.resolve('dist'),out=path.resolve(process.env.MS_QA_OUT||'docs/qa-stage3b');await fs.mkdir(out,{recursive:true});
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.json':'application/json'};
const server=http.createServer(async(req,res)=>{try{let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(pathname.endsWith('/'))pathname+='index.html';const file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep))throw Error('path');res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));}catch{res.statusCode=404;res.end('Missing')}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=`http://127.0.0.1:${server.address().port}/`;
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.MS_CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--no-zygote','--single-process','--in-process-gpu','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1});
 const page=await context.newPage(),errors=[],warnings=[],external=[];
 page.on('pageerror',e=>{errors.push(e.message);console.log('PAGEERROR',e.message)});page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.log('CONSOLE',m.text())}if(m.type()==='warning')warnings.push(m.text())});page.on('request',r=>{if(!r.url().startsWith(url)&&!r.url().startsWith('data:'))external.push(r.url())});

 const start=performance.now();await page.goto(url+'?dev3d=1');await page.waitForFunction(()=>!!window.ManagerStory3D?.replay);
 await page.evaluate(()=>{S=fresh();init()});await page.locator('[data-fixture]').selectOption('live');await page.waitForFunction(()=>window.ManagerStory3DDebug?.mode==='live-engine-shared-clock');
 if(await page.evaluate(()=>MatchView.read().paused))await page.locator('[data-play]').click();
 await page.waitForTimeout(300);
 const t1=await page.evaluate(()=>ManagerStoryLive3D.time);await page.waitForFunction(t=>ManagerStoryLive3D.time>t,t1,{timeout:20000,polling:100});
 await page.locator('[data-play]').click();const held=await page.evaluate(()=>JSON.stringify([MatchView.read().matchSeconds,ManagerStoryLive3D.time,ManagerStoryLiveSample,ManagerStory3D.view.camera.position.toArray()]));await page.waitForTimeout(300);if(await page.evaluate(()=>JSON.stringify([MatchView.read().matchSeconds,ManagerStoryLive3D.time,ManagerStoryLiveSample,ManagerStory3D.view.camera.position.toArray()]))!==held)throw Error('Pause changed state');
 const metrics={environment:'Chromium '+browser.version()+' / Linux / SwiftShader / DPR 1',sceneReadyMs:performance.now()-start,actualRAFVerified:true,pauseVerified:true,errors,warnings,externalRequests:external,checks:[],boundary:[]};
 // Fresh isolated QA profile/input, same engine; manual timestamps drive its existing RAF callback.
 async function reset(){await page.evaluate(()=>{if(liveFrame!==null)cancelAnimationFrame(liveFrame);liveFrame=null;M=null;pitchV73=null;S=fresh();init();startMatch();resumeLive();if(liveFrame!==null)cancelAnimationFrame(liveFrame);liveFrame=null;liveLastFrame=0;});}
 async function advance(seconds,from=0){return page.evaluate(({seconds,from})=>{for(let t=from+.1;t<=from+seconds+1e-7;t+=.1){liveFrameStep(t*1000);if(liveFrame!==null)cancelAnimationFrame(liveFrame);liveFrame=null;}return MatchView.read();},{seconds,from});}
 await page.evaluate(()=>{ManagerStory3D.qaRender=ManagerStory3D.view.render;ManagerStory3D.view.render=()=>({calls:0,triangles:0})});
 async function flush(){await page.evaluate(()=>{ManagerStory3D.qaRender();ManagerStory3D.view.renderer.getContext().finish()});}
 for(const size of [{width:390,height:844},{width:320,height:568}]){
  await page.setViewportSize(size);await reset();
  let previous=null;
  for(let n=0;n<480;n++){
   await advance(.1,n*.1);if(n%120===0)console.log('CHECK',size.width,n);
   const m=await page.evaluate(()=>{const s=MatchView.read(),v=ManagerStory3D.view,x=ManagerStoryLiveSample,b=v.ball.position.clone().project(v.camera);return {clock:s.matchSeconds,presentationTime:s.presentation.seconds,eventId:x.eventId,type:x.type,progress:s.presentation.progress,ball:x.ball,clip:b.toArray(),camera:v.camera.position.toArray(),owner:x.ownerId,engineOwner:s.ball.engine.ownerId,queue:s.presentation.queuedEventIds.length,gaps:x.gaps,contacts:x.contacts.filter(c=>c.id===s.presentation.activeEvent?.fromId||c.id===s.presentation.activeEvent?.toId),players:x.poses.length};});
   if(m.type==='pass'&&m.progress<.19&&previous?.eventId===m.eventId&&previous.progress<.19&&Math.hypot(...m.ball.map((x,i)=>x-previous.ball[i]))>.001)throw Error('Ball moved before contact');
   if(previous){m.ballStep=Math.hypot(...m.ball.map((x,i)=>x-previous.ball[i]));m.cameraStep=Math.hypot(...m.camera.map((x,i)=>x-previous.camera[i]));}
   if(m.type==='pass')metrics.checks.push({...m,viewport:[size.width,size.height]});
   if(!previous||previous.eventId!==m.eventId)metrics.boundary.push({...m,viewport:[size.width,size.height]});previous=m;
   if(n===290){await flush();await page.screenshot({path:path.join(out,'live-'+size.width+'.jpg'),type:'jpeg',quality:90,timeout:60000});}
  }
  if(await page.locator('.m3-controls').evaluate(n=>n.getBoundingClientRect().bottom)>size.height)throw Error('Clipped controls');
 }
 metrics.offscreenPassFrames=metrics.checks.filter(x=>Math.abs(x.clip[0])>1||Math.abs(x.clip[1])>1).length;if(metrics.offscreenPassFrames)throw Error('Ball outside frame '+metrics.offscreenPassFrames);
 metrics.passLog=await page.evaluate(()=>ManagerStoryLive3D.logs);await fs.writeFile(path.join(out,'metrics.json'),JSON.stringify(metrics,null,2));
 if(process.env.MS_CAPTURE!=='0'){
  await page.setViewportSize({width:390,height:844});await reset();await advance(16);const frames=path.join(out,'frames');await fs.mkdir(frames,{recursive:true});
  for(let i=0;i<300;i++){await advance(.1,16+i*.1);await flush();if(i%50===0)console.log('VIDEO',i);await page.screenshot({path:path.join(frames,String(i).padStart(4,'0')+'.jpg'),type:'jpeg',quality:85,timeout:60000});}
  const {execFileSync}=await import('node:child_process');execFileSync('ffmpeg',['-y','-framerate','10','-i',path.join(frames,'%04d.jpg'),'-threads','2','-c:v','libx264','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart',path.join(out,'live-passes-1x.mp4')],{stdio:'ignore'});await fs.rm(frames,{recursive:true,force:true});
 }
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.reload();await page.waitForFunction(()=>!!window.ManagerStory3D);await context.setOffline(true);await page.reload();await page.waitForFunction(()=>!!window.ManagerStory3D);await page.locator('[data-fixture]').selectOption('live');await page.waitForFunction(()=>window.ManagerStory3DDebug?.mode==='live-engine-shared-clock');metrics.offlineReload=true;await context.setOffline(false);
 await fs.writeFile(path.join(out,'metrics.json'),JSON.stringify(metrics,null,2));if(errors.length||external.length)throw Error(JSON.stringify({errors,external}));console.log(JSON.stringify({passes:metrics.passLog.length,checks:metrics.checks.length,errors,external,offline:metrics.offlineReload}));
}finally{await browser?.close();server.close();}
