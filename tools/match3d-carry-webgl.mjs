import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';import {createRequire} from 'node:module';import {execFileSync} from 'node:child_process';
const require=createRequire(import.meta.url),{chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const root=path.resolve('dist'),out=path.resolve('docs/qa-stage3e'),tmp=path.resolve('/tmp/ms3d-natural-frames');await fs.mkdir(out,{recursive:true});await fs.mkdir(tmp,{recursive:true});
const mime={'.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.gif':'image/gif'};
const server=http.createServer(async(req,res)=>{try{const p=new URL(req.url,'http://localhost').pathname,file=path.resolve(root,'.'+(p==='/'?'/index.html':p));if(!file.startsWith(root+path.sep))throw Error('path');res.setHeader('Content-Type',mime[path.extname(file)]||'text/html');res.end(await fs.readFile(file));}catch{res.statusCode=404;res.end('Missing');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/`;let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.MS_CHROMIUM_EXECUTABLE||'/tmp/ms-chromium',args:['--no-sandbox','--no-zygote','--single-process','--in-process-gpu','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1}),page=await context.newPage(),errors=[],external=[],measurements=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>{if(!r.url().startsWith(url)&&!r.url().startsWith('data:'))external.push(r.url());});
 async function reset(baseline){await page.goto(url+'?dev3d=1');await page.waitForFunction(()=>!!window.ManagerStory3D?.view);await page.evaluate(()=>{S=fresh();init()});await page.locator('[data-fixture]').selectOption('live');await page.waitForFunction(()=>window.ManagerStory3DDebug?.mode==='live-engine-shared-clock');
  if(baseline){const reference=JSON.parse(await fs.readFile(new URL('./fixtures/stage3c-presentation.json',import.meta.url),'utf8'));await page.evaluate(r=>{(0,eval)(r.enqueue);(0,eval)(r.clock);ManagerStoryLive3D.enable();},reference);}
  await page.evaluate(()=>{if(liveFrame!==null)cancelAnimationFrame(liveFrame);liveFrame=null;M=null;pitchV73=null;S=fresh();init();startMatch();resumeLive();if(liveFrame!==null)cancelAnimationFrame(liveFrame);liveFrame=null;liveLastFrame=0;ManagerStory3D.qaRender=ManagerStory3D.view.render;ManagerStory3D.view.render=()=>({calls:0,triangles:0});M.rand=R(1);window.qaWall=0;});
 }
 async function advance(to){await page.evaluate(to=>{while(qaWall<to-1e-9){qaWall+=Math.min(.01,to-qaWall);liveFrameStep(qaWall*1000);if(liveFrame!==null)cancelAnimationFrame(liveFrame);liveFrame=null;}},to);}
 async function capture(name){await page.evaluate(()=>{ManagerStory3D.qaRender();ManagerStory3D.view.renderer.getContext().finish();});await page.screenshot({path:path.join(out,name+'.jpg'),type:'jpeg',quality:85,timeout:20000});measurements.push(await page.evaluate(name=>({name,wall:qaWall,snapshot:MatchView.read(),view:{ball:ManagerStoryLiveSample.ball,contacts:ManagerStoryLiveSample.contacts,camera:ManagerStoryLiveSample.camera}}),name));}
 await reset(false);
 await advance(43.3);await capture('real-successful-dribble');
 await advance(54.1);await capture('real-lost-dribble');
 const contacts=await page.evaluate(()=>ManagerStoryLiveSample.contacts);
 const metrics={environment:`Chromium ${browser.version()} / Linux SwiftShader / DPR1 /390x844`,errors,external,measurements,contacts,mode:'Controlled existing liveFrameStep; screenshots do not prove smooth motion; no video in this checkpoint'};
 await fs.writeFile(out+'/webgl.json',JSON.stringify(metrics,null,2));console.log(JSON.stringify({environment:metrics.environment,errors,external,events:measurements.map(m=>({name:m.name,eventId:m.snapshot.presentation.activeEvent?.eventId,type:m.snapshot.presentation.activeEvent?.type,progress:m.snapshot.presentation.progress}))}));
 if(errors.length||external.length)throw Error('WebGL errors');
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
