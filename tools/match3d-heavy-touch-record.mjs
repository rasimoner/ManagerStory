import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';import {createRequire} from 'node:module';import {execFileSync} from 'node:child_process';
const require=createRequire(import.meta.url),{chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const id=Number(process.env.MS_CHAIN_ID||75),last=id===38?38:77,winner=id===38?9:10;
const root=path.resolve('dist'),out=path.resolve('docs/qa-stage3g-touch'),tmp=path.resolve('/tmp/ms3g-touch-chain-'+id+'-frames');await fs.mkdir(out,{recursive:true});await fs.mkdir(tmp,{recursive:true});
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
 async function capture(name){await page.evaluate(()=>{ManagerStory3D.qaRender();ManagerStory3D.view.renderer.getContext().finish();});await page.screenshot({path:path.join(out,name+'.jpg'),type:'jpeg',quality:85,timeout:20000});measurements.push(await page.evaluate(name=>({name,wall:qaWall,snapshot:MatchView.read(),view:{ball:ManagerStoryLiveSample.ball,contacts:ManagerStoryLiveSample.contacts,camera:ManagerStoryLiveSample.camera}}),name));}
 await reset(false);await page.evaluate(()=>{document.querySelector('[data-commentary]').style.visibility='hidden'});
 await page.evaluate(id=>{let guard=0;while(guard++<60000){const e=pitchV73.active;if(e?.eventId===id&&pitchV73.progress>=.65)break;qaWall+=.01;liveFrameStep(qaWall*1000);if(liveFrame!==null)cancelAnimationFrame(liveFrame);liveFrame=null;}if(guard>=60000)throw Error('No real chain');},id);
 const client=await context.newCDPSession(page),frames=[],pending=[];
 client.on('Page.screencastFrame',e=>{const file=path.join(tmp,String(frames.length).padStart(4,'0')+'.jpg');frames.push({file,timestamp:e.metadata.timestamp});pending.push(fs.writeFile(file,Buffer.from(e.data,'base64')));client.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});});
 const start=await page.evaluate(({id,last,winner})=>{
  window.qaId=0;window.qaNaturalHistory=[];window.qaComplete=false;window.qaContact=false;
  window.qaNaturalUnsubscribe=MatchView.subscribe(s=>{
   const e=s.presentation.activeEvent,c=e&&e.eventId>=id&&e.eventId<=last?{phase:s.presentation.progress<.19?'preparation':s.presentation.progress<.76?'flight/approach':'control'}:null;
   if(c){const key=e.eventId+':'+c.phase;if(qaNaturalHistory.at(-1)?.key!==key)qaNaturalHistory.push({key,realMilliseconds:performance.now(),canonical:s.presentation.seconds,progress:s.presentation.progress,owner:s.ball.displayOwnerId});if(e.eventId===last&&s.presentation.progress>=.76)qaContact=true;}
   if(qaContact&&e?.eventId!==last&&s.ball.displayOwnerId===winner){M.pause=true;qaComplete=true;window.qaTerminal=structuredClone(s);}
  });ManagerStory3D.view.render=ManagerStory3D.qaRender;liveLastFrame=null;ensureLiveLoop();return {canonical:ManagerStoryLive3D.time,eventId:pitchV73.active?.eventId,progress:pitchV73.progress,speed:M.speed,tempo:ManagerStoryLive3D.tempo};
 },{id,last,winner});
 await page.evaluate(()=>{ManagerStory3D.qaRender();ManagerStory3D.view.renderer.getContext().finish();});
 await client.send('Page.startScreencast',{format:'jpeg',quality:80,maxWidth:390,maxHeight:844,everyNthFrame:1});
 // Finish by the real event state, never solely by a duration estimate.
 await page.waitForFunction(()=>window.qaComplete,{},{timeout:30000});
 if(frames.length<2)throw Error('No real recording');
 // Freeze at completed control, render it and capture one actual browser surface
 // after completion. This final screenshot is a held real frame, not natural FPS.
 await page.evaluate(()=>{ManagerStory3D.qaRender();ManagerStory3D.view.renderer.getContext().finish();});
 const terminal=await page.screenshot({path:path.join(out,`chain-${id}-terminal.jpg`),type:'jpeg',quality:85,timeout:20000});
 frames.push({file:path.join(tmp,'terminal.jpg'),timestamp:frames.at(-1).timestamp+.08,terminal:true});
 await fs.writeFile(frames.at(-1).file,terminal);
 frames.push({file:path.join(tmp,'terminal.jpg'),timestamp:frames.at(-1).timestamp+1,terminal:true});
 await client.send('Page.stopScreencast');await Promise.all(pending);

 const end=await page.evaluate(()=>{M.pause=true;if(liveFrame!==null)cancelAnimationFrame(liveFrame);liveFrame=null;qaNaturalUnsubscribe();return {canonical:ManagerStoryLive3D.time,eventId:pitchV73.active?.eventId,progress:pitchV73.progress,history:qaNaturalHistory,terminal:qaTerminal};});
 if(frames.length<2)throw Error('Not enough real screencast frames');
 const lines=[];for(let i=0;i<frames.length-1;i++)lines.push(`file '${frames[i].file}'`,`duration ${Math.max(.001,frames[i+1].timestamp-frames[i].timestamp)}`);lines.push(`file '${frames.at(-1).file}'`);await fs.writeFile(path.join(tmp,'frames.txt'),lines.join('\n'));
 execFileSync('ffmpeg',['-y','-loglevel','error','-f','concat','-safe','0','-i',path.join(tmp,'frames.txt'),'-vf','pad=ceil(iw/2)*2:ceil(ih/2)*2','-vsync','vfr','-c:v','libx264','-profile:v','baseline','-level','3.1','-tag:v','avc1','-preset','veryfast','-crf','28','-pix_fmt','yuv420p','-movflags','+faststart',path.join(out,`chain-${id}-1x.mp4`)],{timeout:30000});
 execFileSync('ffmpeg',['-v','error','-i',path.join(out,`chain-${id}-1x.mp4`),'-f','null','-'],{timeout:30000});
 const metrics={environment:`Chromium ${browser.version()} / Linux SwiftShader /DPR1 /390x844`,errors,external,start,end,frames:frames.length,captureSeconds:frames.at(-1).timestamp-frames[0].timestamp,bytes:(await fs.stat(out+`/chain-${id}-1x.mp4`)).size,terminalFrameMethod:'Real frozen WebGL surface captured after actual last chain event completion and real winner ownership and held1s; this added endpoint is not a natural screencast frame or FPS evidence',method:'Actual CDP screencast JPEGs encoded with actual capture timestamp differences; existing natural RAF during recording. Controlled seed4 engine seek before recording only. QA hides only commentary, preserving layout and product camera. Not a mobile FPS benchmark or iPhone recording.'};
 await fs.writeFile(out+`/recording-${id}.json`,JSON.stringify(metrics,null,2));console.log(JSON.stringify({id,frames:metrics.frames,captureSeconds:metrics.captureSeconds,bytes:metrics.bytes,errors,external,history:end.history}));await client.detach();
 if(errors.length||external.length)throw Error('Recording errors');
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
