import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const root=path.resolve('dist'),out=path.resolve('docs/qa-stage3c');await fs.mkdir(out,{recursive:true});
const server=http.createServer(async(req,res)=>{try{const p=new URL(req.url,'http://localhost').pathname,file=path.resolve(root,'.'+(p==='/'?'/index.html':p));if(!file.startsWith(root+path.sep))throw Error('path');res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await fs.readFile(file));}catch{res.statusCode=404;res.end('Missing');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/`;let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.MS_CHROMIUM_EXECUTABLE||'/tmp/ms-chromium',args:['--no-sandbox','--no-zygote','--single-process','--in-process-gpu','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1}),page=await context.newPage(),errors=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>{if(!r.url().startsWith(url)&&!r.url().startsWith('data:'))external.push(r.url());});
 const measurements=[];
 for(const baseline of [true,false]){
  await page.goto(url+'?dev3d=1');await page.waitForFunction(()=>!!window.ManagerStory3D?.view);await page.evaluate(()=>{S=fresh();init()});await page.locator('[data-fixture]').selectOption('live');await page.waitForFunction(()=>window.ManagerStory3DDebug?.mode==='live-engine-shared-clock');
  if(baseline)await page.evaluate(code=>{(0,eval)(code);ManagerStoryLive3D.enable();},JSON.parse(await fs.readFile(new URL('./fixtures/stage3b-presentation.json',import.meta.url),'utf8')).clock);
  await page.evaluate(()=>{if(liveFrame!==null)cancelAnimationFrame(liveFrame);liveFrame=null;M=null;pitchV73=null;S=fresh();init();startMatch();resumeLive();if(liveFrame!==null)cancelAnimationFrame(liveFrame);liveFrame=null;liveLastFrame=0;ManagerStory3D.qaRender=ManagerStory3D.view.render;ManagerStory3D.view.render=()=>({calls:0,triangles:0});window.qaWall=0;});
  async function capture(name){await page.evaluate(()=>{ManagerStory3D.qaRender();ManagerStory3D.view.renderer.getContext().finish();});await page.screenshot({path:path.join(out,name+'.jpg'),type:'jpeg',quality:87,timeout:20000});measurements.push(await page.evaluate(name=>{const s=MatchView.read(),x=ManagerStoryLiveSample,e=s.presentation.activeEvent;return {name,eventId:e?.eventId,type:e?.type,progress:s.presentation.progress,ball:x.ball,owner:x.ownerId,rootGaps:x.gaps,contacts:x.contacts,wall:qaWall,context:ManagerStory3D.view.renderer.getContext().getParameter(ManagerStory3D.view.renderer.getContext().VERSION)};},name));}
  await page.evaluate(()=>{for(let n=0;n<9000;n++){qaWall+=.01;liveFrameStep(qaWall*1000);if(liveFrame!==null)cancelAnimationFrame(liveFrame);liveFrame=null;if(pitchV73.active?.eventId===11)break;}});
  await capture(baseline?'before-preparation':'after-preparation');
  if(!baseline){
   for(const [name,phase] of [['after-contact',.19],['after-arrival',.76]]){
    await page.evaluate(phase=>{while(pitchV73.active?.eventId===11&&pitchV73.progress<phase-1e-9){const dt=Math.min(.01,(phase-pitchV73.progress)*pitchV73.activeDuration*4);qaWall+=dt;liveFrameStep(qaWall*1000);if(liveFrame!==null)cancelAnimationFrame(liveFrame);liveFrame=null;}},phase);await capture(name);
   }
  }
 }
 const metrics={environment:`Chromium ${browser.version()} / Linux SwiftShader / DPR1 / 390x844`,method:'Existing liveFrameStep timestamps; only four actual WebGL renders/screenshots. No video or FPS claim.',errors,external,measurements};await fs.writeFile(out+'/webgl.json',JSON.stringify(metrics,null,2));console.log(JSON.stringify(metrics));if(errors.length||external.length)throw Error('WebGL errors or external requests');
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
