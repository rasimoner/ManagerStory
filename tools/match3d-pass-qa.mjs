import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const { chromium }=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright' : 'playwright');
const root=path.resolve('dist'),out=path.resolve(process.env.MS_QA_OUT||'docs/qa-stage3a');await fs.mkdir(out,{recursive:true});
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.json':'application/json'};
const server=http.createServer(async(req,res)=>{try{let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(pathname.endsWith('/'))pathname+='index.html';const file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep))throw Error('path');res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));}catch{res.statusCode=404;res.end('Missing')}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=`http://127.0.0.1:${server.address().port}/`;
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.MS_CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--no-zygote','--single-process','--in-process-gpu','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1.5});
 const page=await context.newPage(),errors=[],warnings=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text())});page.on('request',r=>{if(!r.url().startsWith(url)&&!r.url().startsWith('data:'))external.push(r.url())});
 const start=performance.now();await page.goto(url+'?dev3d=1');await page.waitForFunction(()=>!!window.ManagerStory3D?.replay,{timeout:30000});
 const metrics={initialRenderReadyMs:performance.now()-start,environment:'Chromium '+browser.version()+' / Linux / ANGLE SwiftShader / DPR 1.5',checks:[],errors,warnings,externalRequests:external};
 for(const size of [{width:390,height:844},{width:320,height:568}]){
  await page.setViewportSize(size);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  for(const kind of ['short','long','intercepted']){
   await page.locator('[data-fixture]').selectOption(kind);
   const r=await page.evaluate(()=>window.ManagerStory3D.replay.record);
   const times=[-.35,0,r.contactAt-1e-5,r.contactAt,r.contactAt+(r.arrivalAt-r.contactAt)*.5,r.arrivalAt,r.duration,r.endAt];
   for(let i=0;i<times.length;i++){
    const check=await page.evaluate(t=>{
     const v=window.ManagerStory3D,p=v.replay.seek(t),cam=v.view.camera,b=v.view.ball.position.clone().project(cam),source=v.view.footballers.get(`${p.s.source.side}:${p.s.source.id}`),receiver=v.view.footballers.get(`${p.s.receiver.side}:${p.s.receiver.id}`),from=source.position.clone().project(cam),to=receiver.position.clone().project(cam);
     return {time:t,phase:p.s.phase,...p.metrics,ball:p.s.ball,camera:cam.position.toArray(),fov:cam.fov,ballClip:b.toArray(),sourceClip:from.toArray(),receiverClip:to.toArray(),displayOwner:p.s.displayOwnerId,resultOwner:p.s.resultOwnerId,controlSuccessful:p.s.controlSuccessful};
    },times[i]);check.kind=kind;check.viewport=[size.width,size.height];metrics.checks.push(check);
    if(size.width===390&&kind!=='intercepted'&&[0,3,4,5].includes(i))await page.screenshot({type:'jpeg',quality:90,path:path.join(out,`${kind}-${['pre','start','before','contact','flight','receive'][i]}.jpg`)});
   }
   if(size.width===390&&kind!=='intercepted'){
    await page.evaluate(t=>{const v=window.ManagerStory3D;v.replay.seek(t);v.view.setCamera('model',`${v.replay.sample.source.side}:${v.replay.sample.source.id}`);v.replay.paint()},r.contactAt);
    await page.locator('[data-camera="model"]').click();
    await page.locator('[data-scene]').screenshot({type:'jpeg',quality:90,path:path.join(out,kind+'-contact-closeup.jpg')});
    await page.locator('[data-camera="broadcast"]').click();
   }
   if(size.width===390){const dense=await page.evaluate(async()=>{
     const {samplePass}=await import('./match3d-pass-timeline.js'),v=window.ManagerStory3D,r=v.replay.record;let support=0,foot=0,ballStep=0,camStep=0,previous=null;
     for(let t=-.35;t<=r.endAt+.35;t+=1/240){const s=samplePass(r,t),m=v.view.applyPassSample(s);support=Math.max(support,m.sourceSupportError);foot=Math.max(foot,...m.receiverFootErrors);if(previous){ballStep=Math.max(ballStep,Math.hypot(...s.ball.map((x,i)=>x-previous.ball[i])));camStep=Math.max(camStep,v.view.camera.position.distanceTo(previous.camera));}previous={ball:s.ball,camera:v.view.camera.position.clone()};}
     v.replay.paint();return {maxSupportError:support,maxReceiverFootError:foot,maxBallStep240Hz:ballStep,maxCameraStep240Hz:camStep};
    });metrics.dense??={};metrics.dense[kind]=dense;if(dense.maxSupportError>.015||dense.maxReceiverFootError>.015||dense.maxBallStep240Hz>.5||dense.maxCameraStep240Hz>.8)throw Error('Contact/continuity dense check failed '+JSON.stringify(dense));}
   // Pause and rate changes hold every component's exact event time/pose.
   await page.evaluate(t=>window.ManagerStory3D.replay.seek(t),r.contactAt*.5);
   const held=await page.evaluate(()=>{const v=window.ManagerStory3D;return JSON.stringify([v.replay.sample,v.view.camera.position.toArray(),v.view.camera.fov])});
   await page.locator('[data-speed="2"]').click();await page.waitForTimeout(120);
   const held2=await page.evaluate(()=>{const v=window.ManagerStory3D;return JSON.stringify([v.replay.sample,v.view.camera.position.toArray(),v.view.camera.fov])});if(held!==held2)throw Error('Paused speed change moved pose');
   const controls=await page.locator('.m3-controls').evaluate(n=>n.getBoundingClientRect().bottom);if(controls>size.height)throw Error('Clipped controls');
  }
 }
 // Actual RAF play/pause/resume: no background jump during a pause.
 await page.locator('[data-fixture]').selectOption('long');await page.locator('[data-speed="0.5"]').click();await page.locator('[data-play]').click();await page.waitForTimeout(180);await page.locator('[data-play]').click();
 const stopped=await page.evaluate(()=>window.ManagerStory3D.replay.clock.time);await page.waitForTimeout(150);if(await page.evaluate(()=>window.ManagerStory3D.replay.clock.time)!==stopped)throw Error('Clock moved while paused');metrics.rafPauseVerified=true;
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 if(process.env.MS_CAPTURE!=='0')for(const kind of ['short','long'].filter(k=>!['short','long'].includes(process.env.MS_CAPTURE)||k===process.env.MS_CAPTURE)){
  await page.locator('[data-fixture]').selectOption(kind);await page.locator('[data-speed="0.5"]').click();
  const r=await page.evaluate(()=>window.ManagerStory3D.replay.record),dir=path.join(out,`${kind}-frames`);await fs.mkdir(dir,{recursive:true});
  const count=Math.ceil((r.endAt+.7)/.5*30);
  for(let i=0;i<count;i++){await page.evaluate(t=>window.ManagerStory3D.replay.seek(t),-.35+i*.5/30);await page.screenshot({type:'jpeg',quality:86,path:path.join(dir,String(i).padStart(4,'0')+'.jpg')});}
  const {execFileSync}=await import('node:child_process');execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','30','-i',path.join(dir,'%04d.jpg'),'-vf','scale=390:844','-c:v','libx264','-threads','2','-crf','23','-preset','fast','-pix_fmt','yuv420p','-movflags','+faststart',path.join(out,kind+'-pass.mp4')]);await fs.rm(dir,{recursive:true});
  console.log('Captured real WebGL frames:',kind,count);
 }
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));});
 await context.setOffline(true);await page.reload();await page.waitForFunction(()=>!!window.ManagerStory3D?.replay,{timeout:30000});metrics.offlineReload=true;await context.setOffline(false);
 await page.locator('[data-close]').click();metrics.closeReturnsToExistingApp=await page.locator('#app').isVisible();await page.goto(url);metrics.defaultEntryKeepsOriginalApp=await page.locator('#app').isVisible()&&!await page.locator('.match3d-shell').count();
 await fs.writeFile(path.join(out,'metrics.json'),JSON.stringify(metrics,null,2));console.log(JSON.stringify({initialRenderReadyMs:metrics.initialRenderReadyMs,checks:metrics.checks.length,errors,warnings,external,offline:metrics.offlineReload}));
 if(errors.length||external.length||metrics.checks.some(c=>Math.abs(c.ballClip[0])>1||Math.abs(c.ballClip[1])>1)||!metrics.offlineReload)process.exitCode=1;
}finally{await browser?.close();server.close();}
