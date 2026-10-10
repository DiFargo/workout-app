import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const base='https://tren-85720.web.app';
const version=JSON.parse(await fs.readFile('package.json','utf8')).version;
const hash=b=>createHash('sha256').update(b).digest('hex');
const names=await fs.readdir('dist/assets');
const workerPath='/assets/'+names.find(n=>n.startsWith('personalNutritionCatalog.worker-')&&n.endsWith('.js'));
const entry=(await fs.readFile('dist/index.html','utf8')).match(/src="(\/assets\/[^\"]+\.js)"/)[1];
const assets=[];
for(const path of [entry,workerPath,'/nutrition-catalog/personal/products.json']) {
 const r=await fetch(base+path,{signal:AbortSignal.timeout(30000)});assert.equal(r.status,200);
 const body=Buffer.from(await r.arrayBuffer());assert.equal(hash(body),hash(await fs.readFile('dist'+path)));
 assets.push({path,matchesBuild:true,bytes:body.length});
}
const sw=await fetch(base+'/sw.js');assert.ok((await sw.text()).includes(version));
const api=await fetch(base+'/api/nutrition/search?q=творог');assert.equal(api.status,401);
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const context=await browser.newContext({viewport:{width:402,height:874},isMobile:true,hasTouch:true});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/?release='+version);
 await page.getByRole('heading',{name:'Вход по приглашению'}).waitFor({timeout:40000});
 await page.screenshot({path:'output/belarus-products-10000/production-login.png'});
 const workerChecks=await page.evaluate(async(workerPath)=>{
   const worker=new Worker(workerPath);let sequence=0;
   const find=query=>new Promise((resolve,reject)=>{const id=++sequence;const t=performance.now();const timer=setTimeout(()=>reject(new Error('Worker timeout')),15000);worker.onmessage=({data})=>{if(data.id!==id)return;clearTimeout(timer);if(data.error)reject(new Error(data.error));else resolve({query,ms:performance.now()-t,count:data.foods.length,first:data.foods[0]?.name,pending:data.foods[0]?.nutritionBasisPending})};worker.postMessage({id,query})});
   const results=[];for(const q of ['4810268031793','теос','ndjhju','Кофейни Раф классический'])results.push(await find(q));worker.terminate();return results;
 },workerPath);
 assert.ok(workerChecks.every(r=>r.count>0));assert.equal(workerChecks[0].count,1);assert.equal(workerChecks.at(-1).pending,true);
 await context.setOffline(true);
 const persisted=await page.evaluate(workerPath=>new Promise((resolve,reject)=>{
   const w=new Worker(workerPath);const t=setTimeout(()=>reject(new Error('Offline timeout')),12000);
   w.onmessage=({data})=>{clearTimeout(t);w.terminate();if(data.error)reject(new Error(data.error));else resolve(data.foods.length)};
   w.onerror=()=>{clearTimeout(t);w.terminate();reject(new Error('Offline worker failed'))};w.postMessage({id:1,query:'теос'});
 }),workerPath);
 assert.ok(persisted>0);assert.deepEqual(errors,[]);
 const report={version,checkedAt:new Date().toISOString(),assets,catalogCount:JSON.parse(await fs.readFile('dist/nutrition-catalog/personal/products.json','utf8')).length,anonymousApiStatus:api.status,loginVisible:true,workerChecks,persistedOfflineResults:persisted,runtimeErrors:errors,userDataWrites:false};
 await fs.writeFile('output/belarus-products-10000/production-check.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
} finally {await browser.close()}
