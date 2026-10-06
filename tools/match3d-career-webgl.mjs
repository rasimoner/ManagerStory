import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const root=path.resolve('dist'),mime={'.js':'text/javascript','.css':'text/css','.json':'application/json'};
const server=http.createServer(async(req,res)=>{try{const p=new URL(req.url,'http://localhost').pathname,file=path.resolve(root,'.'+(p==='/'?'/index.html':p));if(!file.startsWith(root+path.sep))throw Error('path');res.setHeader('Content-Type',mime[path.extname(file)]||'text/html');res.end(await fs.readFile(file));}catch{res.statusCode=404;res.end('Missing');}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const results=[];
 for(const [width,height] of [[390,844],[320,568]]){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.waitForFunction(()=>!!window.ManagerStoryCareer3D);
  await page.getByRole('button',{name:'Yeni Kariyer',exact:true}).click();
  // Use the career's existing startMatch entry point and engine, without dev3d or fixtures.
  await page.evaluate(()=>{startMatch();pauseLive();switchMatchTab('pitch');});
  await page.getByRole('button',{name:'3D',exact:true}).click();await page.waitForFunction(()=>!!ManagerStoryCareer3D.view);
  const first=await page.evaluate(()=>{window.qaEngine=M;window.qaView=ManagerStoryCareer3D.view;window.qaBefore=JSON.stringify([M.events,M.rand.state,pitchV73.active,pitchV73.queue,pitchV73.progress]);const view=ManagerStoryCareer3D.view;view.renderer.getContext().finish();const c=document.querySelector('.career3d-scene'),r=c.getBoundingClientRect();return {players:view.footballers.size,canvas:[c.width,c.height],bounds:[r.width,r.height],webgl2:view.renderer.capabilities.isWebGL2,tempo:ManagerStoryLive3D.tempo};});
  for(const name of ['2D','3D'])await page.getByRole('button',{name,exact:true}).click();
  for(const name of ['İstatistik','Detaylar','Saha'])await page.getByRole('tab',{name,exact:true}).click();
  await page.getByRole('button',{name:'0.5×',exact:true}).click();await page.getByRole('button',{name:'2×',exact:true}).click();await page.getByRole('button',{name:'1×',exact:true}).click();
  const checks=await page.evaluate(()=>({engine:M===qaEngine,scene:ManagerStoryCareer3D.view===qaView,unchanged:qaBefore===JSON.stringify([M.events,M.rand.state,pitchV73.active,pitchV73.queue,pitchV73.progress]),technical:!!document.querySelector('[data-fixture],.m3-badge,[data-status]'),overflow:document.documentElement.scrollWidth>innerWidth}));
  const layout=await page.evaluate(()=>{
   const buttons=[...document.querySelectorAll('.match-playback-options button')],bounds=buttons.map(b=>{const r=b.getBoundingClientRect();return {label:b.textContent,x:r.x,y:r.y,width:r.width,height:r.height};});
   const field=document.querySelector('.career3d').getBoundingClientRect(),narrative=document.querySelector('[data-live-commentary]').getBoundingClientRect(),controls=document.querySelector('.matchcontrols').getBoundingClientRect();
   return {bounds,fieldBottom:field.bottom,narrativeBottom:narrative.bottom,controlsTop:controls.top,height:innerHeight,removedCopy:!document.body.textContent.includes('Aksiyonlar tamamlanarak gösterilir')};
  });
  assert.deepEqual(layout.bounds.map(b=>b.label),['0.5×','1×','2×','2D','3D']);assert.ok(layout.bounds.every(b=>b.height>=44&&b.width>=44));assert.ok(layout.bounds.every(b=>Math.abs(b.y-layout.bounds[0].y)<1));assert.ok(layout.narrativeBottom<=layout.controlsTop&&layout.fieldBottom<=layout.narrativeBottom&&layout.controlsTop<layout.height);assert.equal(layout.removedCopy,true);
  assert.equal(first.players,22);assert.equal(first.tempo,1);assert.ok(first.canvas[0]>0&&first.bounds[0]>0);for(const k of ['engine','scene','unchanged'])assert.equal(checks[k],true);assert.equal(checks.technical,false);assert.equal(checks.overflow,false);
  await page.evaluate(()=>{resumeLive();});await page.waitForFunction(()=>ManagerStoryLive3D.time>.02);await page.evaluate(()=>pauseLive());
  const moving=await page.evaluate(()=>({time:ManagerStoryLive3D.time,paused:MatchView.read().paused,radar:document.querySelector('.career3d-radar').getContext('2d').getImageData(0,0,200,130).data.some(x=>x!==0)}));assert.equal(moving.paused,true);assert.equal(moving.radar,true);
  await page.screenshot({path:`/tmp/ms4a-${width}.png`});assert.deepEqual(errors,[]);results.push({width,height,...first,...checks,layout,...moving,errors});await page.close();
 }
 console.log(JSON.stringify({browser:browser.version(),environment:'Linux Chromium SwiftShader DPR1',results},null,2));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
