import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { normalize, canonicalBrand, identity, categorize, validGtin, nutritionProblems } from './lib/belarusPersonalCatalog.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'output/belarus-products-10000');
fs.mkdirSync(out,{recursive:true});
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const off=read('public/nutrition-catalog/sku/foods.full.json');
const gemini=read('output/gemini-products-new/products.json');
const knownBrands=new Set(gemini.map(r=>canonicalBrand(r.brand)));
const rejected=[],merged=[],pool=[];
for(const r of off) {
  const nutrition={basis:'100g',kcal:r.calories,protein:r.protein,fat:r.fat,carbs:r.carbs};
  const issues=nutritionProblems(nutrition);
  if(!validGtin(r.barcode)||/^0000|^009999/.test(r.barcode))issues.push('non_retail_code');
  if(r.name.length<4||r.name.length>160||!/[а-я]/i.test(r.name)||/[іїєґ]|https?:|[<>{}]/i.test(r.name))issues.push('name_quality');
  // A regional registration prefix helps prioritize candidates; it is NOT market evidence.
  if(r.source.marketScope==='localized_other'&&!/^(46[0-9]|481)/.test(r.barcode)&&!knownBrands.has(canonicalBrand(r.brand)))issues.push('no_regional_relevance');
  const category=categorize(r.name,r.category);
  if(category==='Другие продукты')issues.push('unclassified_name');
  if(/корм для|кошек|собак|сигарет|табак|никотин|пиво|водка|коньяк|виски|текила|вино /i.test(r.name))issues.push('outside_food_scope');
  if(issues.length){rejected.push({id:r.id,reasons:issues});continue;}
  pool.push({id:r.id,name:r.name.trim(),brand:r.brand.trim(),category,nutrition,
    aliases:[...new Set(r.aliases.filter(s=>s.length<=160))],barcodes:[r.barcode],
    market:r.source.marketScope==='belarus'?'BY':r.source.marketScope==='russia'?'RU':'unknown',
    availabilityInBelarus:r.source.marketScope==='belarus'?'listed_in_source':'unknown',
    sourceType:'openfoodfacts',quantity:r.quantity,sources:[r.source],reviewStatus:'source_record',
    members:[{id:r.id,name:r.name,brand:r.brand,nutrition,barcode:r.barcode,quantity:r.quantity,source:r.source}],
  });
}
for(const r of gemini) {
  const nutrition={basis:'unknown',kcal:r.cal,protein:r.p,fat:r.f,carbs:r.c};
  const issues=nutritionProblems(nutrition);
  if(issues.length){rejected.push({id:`gemini-${r.id}`,reasons:issues});continue;}
  const source={kind:'Gemini dialogue supplied by user',recordId:String(r.id),file:'../gemini-products-new/products.json'};
  pool.push({id:`gemini-${r.id}`,name:r.name.trim(),brand:r.brand.trim(),category:categorize(r.name,r.category),
    nutrition,aliases:[],barcodes:[],market:'unknown',availabilityInBelarus:'unknown',sourceType:'gemini',
    quantity:'',sources:[source],reviewStatus:'nutrition_basis_needed',
    members:[{id:`gemini-${r.id}`,name:r.name,brand:r.brand,nutrition,source}],
  });
}
// Prefer Belarus records, then preserve the supplied list, then regional source cards.
const priority=r=>r.market==='BY'?400:r.sourceType==='gemini'?300:r.market==='RU'?200:100;
const relevance=r=>(knownBrands.has(canonicalBrand(r.brand))?20:0)+(r.brand?5:0)+(r.aliases.some(s=>/[а-я]/i.test(s))?4:0)-(r.name.length>100?3:0);
pool.sort((a,b)=>priority(b)-priority(a)||relevance(b)-relevance(a)||a.id.localeCompare(b.id));
const byIdentity=new Map();
for(const r of pool) {
  const key=identity(r);
  const existing=byIdentity.get(key);
  if(existing) {
    existing.aliases=[...new Set([...existing.aliases,r.name,...r.aliases])].filter(n=>n!==existing.name);
    existing.barcodes=[...new Set([...existing.barcodes,...r.barcodes])];
    existing.sources.push(...r.sources);existing.members.push(...r.members);
    existing.nutritionConflict=existing.members.some(m=>JSON.stringify(m.nutrition)!==JSON.stringify(existing.nutrition));
    if(existing.nutritionConflict)existing.reviewStatus='conflicting_source_values';
    merged.push({id:r.id,into:existing.id});
  } else byIdentity.set(key,r);
}
const available=[...byIdentity.values()];
if(available.length<10000)throw new Error(`Only ${available.length} eligible distinct cards: quality filters kept intact`);
const rows=available.slice(0,10000);
const tally=key=>Object.fromEntries([...new Set(rows.map(r=>r[key]))].map(k=>[k,rows.filter(r=>r[key]===k).length]));
const manifest={schemaVersion:1,builtAt:new Date().toISOString(),count:rows.length,sourceCounts:tally('sourceType'),marketCounts:tally('market'),categoryCounts:tally('category'),
  nutritionBasisCounts:Object.fromEntries(['100g','unknown'].map(k=>[k,rows.filter(r=>r.nutrition.basis===k).length])),
  conflictingCards:rows.filter(r=>r.nutritionConflict).length,barcodes:rows.reduce((s,r)=>s+r.barcodes.length,0),
  mergedRecords:merged.length,rejectedRecords:rejected.length,eligibleReserve:available.length-rows.length,
  sourceFiles:['public/nutrition-catalog/sku/foods.full.json','output/gemini-products-new/products.json'].map(p=>({path:p,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex')})),
  notes:['BY means Belarus is listed in the source, not live stock. RU and unknown do not confirm Belarus availability.',
    'Gemini values retain unknown nutrition basis; do not calculate portions until clarified.',
    'Deduplication normalizes brand, punctuation and pack sizes. Member records preserve all sizes and values. Semantic paraphrases may remain.',
    'Open Food Facts community records are not independently verified labels. Conflicting values are retained in members.'],
  attribution:{name:'Open Food Facts',url:'https://world.openfoodfacts.org',license:'ODbL-1.0',licenseUrl:'https://opendatacommons.org/licenses/odbl/1-0/'}};
const write=(file,value)=>fs.writeFileSync(path.join(out,file),JSON.stringify(value,null,2)+'\n');
write('products.json',rows);write('manifest.json',manifest);write('quality-report.json',{merged,rejected,notSelected:available.slice(10000).map(r=>r.id)});
const clientRows=rows.map(({members,sources,...r})=>({...r,sourceUrl:sources[0].url??null,sourceUpdatedAt:sources[0].sourceUpdatedAt??null,sourceCount:sources.length}));
fs.writeFileSync(path.join(out,'catalog-data.js'),'window.CATALOG='+JSON.stringify({manifest,products:clientRows}).replaceAll('<','\\u003c')+';\n');
fs.copyFileSync(path.join(root,'scripts/lib/belarusPersonalCatalog.mjs'),path.join(out,'search.mjs'));
const lib=fs.readFileSync(path.join(root,'scripts/lib/belarusPersonalCatalog.mjs'),'utf8').replace(/^export /gm,'');
const workerCode=lib+'\nlet search;onmessage=({data})=>{if(data.type==="init"){search=createSearch(data.rows);postMessage({type:"ready"});return;}const t=performance.now();const result=search(data.query,data.options);postMessage({id:data.id,query:data.query,append:data.append,ids:result.items.map(r=>r.id),total:result.total,corrected:result.corrected,ms:performance.now()-t});};';
const html=fs.readFileSync(path.join(root,'scripts/templates/belarus-catalog.html'),'utf8')
  .replace('/*__CATALOG_DATA__*/',()=>fs.readFileSync(path.join(out,'catalog-data.js'),'utf8'))
  .replace('/*__SEARCH_LIBRARY__*/',()=>lib)
  .replace('/*__WORKER_CODE__*/',()=>JSON.stringify(workerCode).replaceAll('<','\\u003c'));
fs.writeFileSync(path.join(out,'catalog.html'),html);
const runtime=JSON.stringify(clientRows.map(r=>[r.id,r.name,r.brand,r.category,r.nutrition.kcal,r.nutrition.protein,r.nutrition.fat,r.nutrition.carbs,r.nutrition.basis,r.aliases,r.barcodes,r.market,r.sourceType,!!r.nutritionConflict,r.sourceUrl]));
const runtimeFolder=path.join(root,'public/nutrition-catalog/personal');fs.mkdirSync(runtimeFolder,{recursive:true});
fs.writeFileSync(path.join(runtimeFolder,'products.json'),runtime+'\n');
fs.writeFileSync(path.join(runtimeFolder,'attribution.json'),JSON.stringify(manifest.attribution,null,2)+'\n');
fs.writeFileSync(path.join(root,'src/data/nutrition-catalog/personalCatalogManifest.json'),JSON.stringify({count:rows.length,url:'/nutrition-catalog/personal/products.json',hash:crypto.createHash('sha256').update(runtime).digest('hex').slice(0,16)},null,2)+'\n');
console.log(JSON.stringify(manifest,null,2));
