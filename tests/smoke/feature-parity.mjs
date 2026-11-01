import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {chromium} from 'playwright';
import {pagesServer} from './pages-server.mjs';

const require=createRequire(import.meta.url),{parityCareer}=require('../support/feature-parity-careers.cjs');
const directory='test-results/feature-parity';mkdirSync(directory,{recursive:true});
const server=await pagesServer('dist',{port:0});
const browser=await chromium.launch({executablePath:process.env.SMOKE_CHROMIUM||undefined,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const results=[],problems=[];

async function film(kind,viewport,direction) {
 const name=`${kind}-${direction}-${viewport.width>viewport.height?'landscape':'portrait'}`;
 const context=await browser.newContext({viewport,isMobile:true,hasTouch:true,recordVideo:{dir:directory,size:viewport},
  storageState:{cookies:[],origins:[{origin:new URL(server.url).origin,localStorage:[{name:'msv4',value:parityCareer(kind,direction)}]}]}});
 const page=await context.newPage();page.on('pageerror',e=>problems.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto(server.url);await page.waitForFunction(()=>document.querySelector('[data-scene-loading]')?.hidden);
 await page.locator('[data-scene-full]').click();
 await verifyControlSeparation(page);
 await page.screenshot({path:`${directory}/${name}-setup.png`,fullPage:true});
 const start=await page.locator('[data-sim-scene]').getAttribute('data-simTick');
 if(kind==='offside')assert.equal(await page.locator('.sim-scene-caption').textContent(),'OFSAYT');
 else await advanceAndPause(page,{tick:Number(start)+12,kind});
 await page.screenshot({path:`${directory}/${name}.png`,fullPage:true});
 if(kind==='chip')await verifyReplay(page);
 const video=page.video();await context.close();await video.saveAs(`${directory}/${name}.webm`);await video.delete();
 results.push({name,category:'isolated core scenario in real career UI',viewport,direction});console.log('ok   feature parity WebGL: '+name);
}

async function verifyControlSeparation(page) {
 const camera=await page.locator('.sim-scene-cameras').boundingBox(),controls=await page.locator('.sim-scene-controls').boundingBox();
 assert.ok(camera.y+camera.height<=controls.y,'camera buttons must not intercept playback controls');
}

async function advanceAndPause(page,request) {
 await page.locator('[data-scene-pause]').click();
 await page.waitForFunction(target=>{
  const scene=document.querySelector('[data-sim-scene]');
  const reached=['freeKick','panenka'].includes(target.kind)?document.querySelector('.sim-scene-caption')?.textContent==='Şut':Number(scene?.dataset.simTick)>=target.tick;
  if(!reached)return false;
  document.querySelector('[data-scene-pause]').click();return true;
 },request);
}

async function verifyReplay(page) {
 const before=await page.evaluate(()=>localStorage.getItem('msv4'));
 await page.locator('[data-scene-replay]').click();
 await page.waitForFunction(()=>document.querySelector('[data-sim-scene]')?.dataset.simReplaying==='true');
 await page.screenshot({path:`${directory}/real-replay-${page.viewportSize().width}.png`,fullPage:true});
 await page.waitForFunction(()=>document.querySelector('[data-sim-scene]')?.dataset.simReplaying==='false');
 assert.equal(await page.evaluate(()=>localStorage.getItem('msv4')),before,'replaying writes no saved football state');
}

try {
 for(const viewport of [{width:390,height:844},{width:844,height:390}]){
  for(const direction of [-1,1])await film('freeKick',viewport,direction);
  await film('offside',viewport,1);await film('chip',viewport,1);await film('panenka',viewport,1);
 }
 assert.deepEqual(problems,[]);writeFileSync(`${directory}/verification.json`,JSON.stringify({results,problems},null,2)+'\n');
}finally{await browser.close();await server.close();}
