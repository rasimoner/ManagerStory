import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';import {createRequire} from 'node:module';import {execFileSync} from 'node:child_process';
const require=createRequire(import.meta.url),{chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const root=path.resolve('dist'),out=path.resolve('docs/qa-stage3g'),tmp=path.resolve('/tmp/ms3d-natural-frames');await fs.mkdir(out,{recursive:true});await fs.mkdir(tmp,{recursive:true});
const mime={'.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.gif':'image/gif'};
const server=http.createServer(async(req,res)=>{try{const p=new URL(req.url,'http://localhost').pathname,file=path.resolve(root,'.'+(p==='/'?'/index.html':p));if(!file.startsWith(root+path.sep))throw Error('path');res.setHeader('Content-Type',mime[path.extname(file)]||'text/html');res.end(await fs.readFile(file));}catch{res.statusCode=404;res.end('Missing');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/`;let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.MS_CHROMIUM_EXECUTABLE||chromium.executablePath(),args:['--no-sandbox','--no-zygote','--single-process','--in-process-gpu','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1}),page=await context.newPage(),errors=[],external=[],measurements=[];
 page.on('pageerror',e=>{errors.push(e.message);console.error('PAGEERROR',e.message)});page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.error('CONSOLE',m.text());}});page.on('request',r=>{if(!r.url().startsWith(url)&&!r.url().startsWith('data:'))external.push(r.url());});
 async function reset(baseline){await page.goto(url+'?dev3d=1');await page.waitForFunction(()=>!!window.ManagerStory3D?.view);await page.evaluate(()=>{S=fresh();init()});await page.locator('[data-fixture]').selectOption('live');await page.waitForFunction(()=>window.ManagerStory3DDebug?.mode==='live-engine-shared-clock');
  if(baseline){const reference=JSON.parse(await fs.readFile(new URL('./fixtures/stage3c-presentation.json',import.meta.url),'utf8'));await page.evaluate(r=>{(0,eval)(r.enqueue);(0,eval)(r.clock);ManagerStoryLive3D.enable();},reference);}
  await page.evaluate(()=>{if(liveFrame!==null)cancelAnimationFrame(liveFrame);liveFrame=null;M=null;pitchV73=null;S=fresh();init();startMatch();resumeLive();if(liveFrame!==null)cancelAnimationFrame(liveFrame);liveFrame=null;liveLastFrame=0;ManagerStory3D.qaRender=ManagerStory3D.view.render;ManagerStory3D.view.render=()=>({calls:0,triangles:0});M.rand=R(4);window.qaWall=0;});
 }
 async function advance(to){await page.evaluate(to=>{while(qaWall<to-1e-9){qaWall+=Math.min(.01,to-qaWall);liveFrameStep(qaWall*1000);if(liveFrame!==null)cancelAnimationFrame(liveFrame);liveFrame=null;}},to);}
 async function capture(name){await page.evaluate(()=>{ManagerStory3D.qaRender();ManagerStory3D.view.renderer.getContext().finish();});await page.screenshot({path:path.join(out,name+'.jpg'),type:'jpeg',quality:85,timeout:20000});measurements.push(await page.evaluate(name=>({name,wall:qaWall,eventId:pitchV73.active?.eventId,progress:pitchV73.progress,owner:pitchV73.carrier,view:{ball:ManagerStoryLiveSample.ball,contacts:ManagerStoryLiveSample.contacts,camera:ManagerStoryLiveSample.camera}}),name));}
 async function eventPhase(id,target){await page.evaluate(({id,target})=>{let guard=0;while(guard++<60000){const e=pitchV73.active,p=pitchV73.progress;let dt=.01;if(e?.eventId===id){if(p>=target-1e-8)break;dt=Math.min(dt,(target-p)*pitchV73.activeDuration*4+1e-10);}qaWall+=dt;liveFrameStep(qaWall*1000);if(liveFrame!==null)cancelAnimationFrame(liveFrame);liveFrame=null;}if(guard>=60000)throw Error('Missing shot phase');ManagerStory3D.qaRender();ManagerStory3D.view.renderer.getContext().finish();},{id,target});}
 for(const [width,height] of [[390,844],[320,568]]){
  await page.setViewportSize({width,height});await reset(false);
  for(const id of (process.env.MS_CHAIN_IDS?process.env.MS_CHAIN_IDS.split(',').map(Number):[38,75,76,77]))for(const phase of [.19,.65,.76,.91]){
   await eventPhase(id,phase);await capture(`${width}-chain-${id}-${phase}`);
   measurements.at(-1).screen=await page.evaluate(async()=>{const T=await import('./vendor/three/three.module.min.js'),s=ManagerStoryLiveSample,e=pitchV73.active,view=ManagerStory3D.view;
    const points={ball:s.ball};for(const id of [e.fromId,e.toId]){const pose=s.poses.find(p=>p.id===id);if(pose)points[String(id)]=pose.position;}
    return Object.fromEntries(Object.entries(points).map(([key,p])=>{const v=new T.Vector3(...p).project(view.camera);return [key,[(v.x+1)/2,(1-v.y)/2]];}));
   });
  }
 }
 await page.evaluate(async()=>{await navigator.serviceWorker.ready});await page.reload();await page.waitForFunction(()=>!!window.ManagerStory3D?.view);await context.setOffline(true);await page.reload();await page.waitForFunction(()=>!!window.ManagerStory3D?.view);const offlineReopen=await page.evaluate(()=>({controlled:!!navigator.serviceWorker.controller,webgl:!!ManagerStory3D.view.renderer.getContext()}));await context.setOffline(false);
 const metrics={offlineReopen,environment:`Chromium ${browser.version()} / Linux SwiftShader / DPR1 /390x844 and320x568`,errors,external,measurements,mode:'Controlled existing liveFrameStep, actual WebGL critical frames; static evidence is not fluidity proof'};
 await fs.writeFile(out+(process.env.MS_CHAIN_IDS?'/webgl-cut-final.json':'/webgl.json'),JSON.stringify(metrics,null,2));console.log(JSON.stringify({environment:metrics.environment,errors,external,samples:measurements.length}));
 if(errors.length||external.length)throw Error('WebGL errors');
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
