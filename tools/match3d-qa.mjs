import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const { chromium }=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright' : 'playwright');
const root=path.resolve('dist'),out=path.resolve('docs/qa-stage2');await fs.mkdir(out,{recursive:true});
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
 const start=performance.now();await page.goto(url+'?dev3d=1');await page.waitForFunction(()=>!!window.ManagerStory3D,{timeout:30000});
 const initialRenderReadyMs=performance.now()-start;
 await page.evaluate(()=>document.fonts.ready);await page.screenshot({type:'jpeg',quality:92,path:path.join(out,'mobile-broadcast.jpg')});
 const metrics=await page.evaluate(async()=>{
  const v=window.ManagerStory3D.view,gl=v.renderer.getContext(),samples=[],loopStart=performance.now();
  for(let i=0;i<12;i++){await new Promise(r=>requestAnimationFrame(r));const t=performance.now();v.render();gl.finish();samples.push(performance.now()-t);}
  const mean=samples.reduce((a,b)=>a+b)/samples.length;
  const debug=gl.getExtension('WEBGL_debug_renderer_info');
  return {...window.ManagerStory3DDebug,meanRenderCompletedMs:mean,staticBenchmarkFrames:12,staticBenchmarkFps:12/(performance.now()-loopStart)*1000,rendererUnmasked:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):null,controls:[...document.querySelectorAll('.m3-controls button')].map(b=>({disabled:b.disabled,bottom:b.getBoundingClientRect().bottom})),viewport:[innerWidth,innerHeight],sceneGoals:v.scene.children.filter(o=>o.name.endsWith('-goal')).length,skeletons:[...v.footballers.values()].map(p=>p.children.find(o=>o.isSkinnedMesh)?.skeleton.bones.length)};
 });metrics.initialRenderReadyMs=initialRenderReadyMs;metrics.navigationThroughScreenshotAndBenchmarkMs=performance.now()-start;metrics.browserVersion=browser.version();metrics.environment='Linux headless Chromium / SwiftShader software renderer / 390x844 CSS / DPR 1.5';
 await page.locator('[data-camera="model"]').click();await page.locator('[data-scene]').screenshot({type:'jpeg',quality:92,path:path.join(out,'player-closeup.jpg')});
 await page.locator('[data-camera="overview"]').click();await page.setViewportSize({width:1280,height:900});await page.screenshot({type:'jpeg',quality:92,path:path.join(out,'stadium-overview.jpg')});
 await page.setViewportSize({width:320,height:568});
 await page.locator('[data-camera="broadcast"]').click();
 metrics.compactControls=await page.locator('.m3-controls button').evaluateAll(bs=>bs.map(b=>({bottom:b.getBoundingClientRect().bottom,right:b.getBoundingClientRect().right})));
 // Service worker warm cache followed by genuine offline reload.
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));});
 await context.setOffline(true);await page.reload();await page.waitForFunction(()=>!!window.ManagerStory3D,{timeout:30000});metrics.offlineReload=true;await context.setOffline(false);
 await page.locator('[data-close]').click();metrics.closeReturnsToExistingApp=await page.locator('#app').isVisible();
 await page.goto(url);metrics.defaultEntryKeepsOriginalApp=await page.locator('#app').isVisible()&&!await page.locator('.match3d-shell').count();
 metrics.errors=errors;metrics.warnings=warnings;metrics.externalRequests=external;
 await fs.writeFile(path.join(out,'metrics.json'),JSON.stringify(metrics,null,2));console.log(JSON.stringify(metrics,null,2));
 if(errors.length||external.length||metrics.players!==22||metrics.balls!==1||!metrics.offlineReload||!metrics.defaultEntryKeepsOriginalApp||metrics.compactControls.some(b=>b.bottom>568||b.right>320)||metrics.controls.some(b=>!b.disabled||b.bottom>844))process.exitCode=1;
}finally{await browser?.close();server.close();}
