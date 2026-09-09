import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const dir='artifacts/audit-755-screens'; await fs.mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,deviceScaleFactor:1});
const page=await context.newPage(); page.setDefaultTimeout(6000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.emulateMedia({reducedMotion:'reduce'});
const base='http://127.0.0.1:4194';
const previous=JSON.parse(await fs.readFile('artifacts/audit-755-ui-results.json','utf8').catch(()=> '[]'));
const retry=process.env.AUDIT_RETRY==='1';
const retryIds=new Set(previous.filter(r=>r.error).map(r=>r.id));
const records=retry?previous.filter(r=>!r.error):[];
async function capture(id) {
  await page.locator('#root').waitFor({state:'attached'}); await page.waitForTimeout(250);
  const record=await page.evaluate(()=>{
    const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight&&s.visibility!=='hidden'&&s.display!=='none';};
    const controls=[...document.querySelectorAll('button,input,select,textarea,[role="button"]')].filter(visible);
    const name=e=>e.getAttribute('aria-label')||e.innerText||e.labels?.[0]?.innerText||e.getAttribute('placeholder')||'';
    const short=controls.filter(e=>{const r=e.getBoundingClientRect();return r.height<43||r.width<43;}).map(e=>({name:name(e).slice(0,70),tag:e.tagName,w:Math.round(e.getBoundingClientRect().width),h:Math.round(e.getBoundingClientRect().height)}));
    return {headings:[...document.querySelectorAll('h1,h2,h3')].filter(visible).map(e=>e.innerText),overflow:document.documentElement.scrollWidth-innerWidth,smallControls:short.slice(0,14),smallCount:short.length,unlabelled:controls.filter(e=>!name(e)).length,text:document.body.innerText.slice(0,1600)};
  });
  const screenshot=`${dir}/${id}.png`;await page.screenshot({path:screenshot});
  records.push({id,url:page.url(),width:page.viewportSize().width,screenshot,...record,errors:errors.splice(0)});
  await fs.writeFile('artifacts/audit-755-ui-results.json',JSON.stringify(records,null,2));
}
async function scene(id,query='',action) {
  if(retry&&!retryIds.has(id)) return;
  try {await page.goto(`${base}/v2?clientHarness=1&clientHarnessTheme=warm-light${query}`,{waitUntil:'networkidle',timeout:15000});if(action) await action();await capture(id);}
  catch(e){records.push({id,error:e.message.slice(0,220)});await fs.writeFile('artifacts/audit-755-ui-results.json',JSON.stringify(records,null,2));}
}
for(const tab of ['main','workouts','nutrition','progress','cabinet']) await scene(`client-${tab}`,'&clientWorkoutOverviewState=today',()=>page.getByTestId(`client-nav-${tab}`).click());
for(const route of ['workoutPlan','workoutHistory','workoutMode','basicQuiz','basicWorkoutToday','basicExerciseExplainer','exerciseSets','measurementWizard','measurementPanel','profileRoleActions','profileSettingsTab','avatarCrop','nutritionSearchHistory','nutritionDishIngredients','nutritionPhotoPreview','nutritionMealModal','voiceReview','aiCoach']) await scene(`client-${route}`,`&clientHarnessPage=${route}`);
for(const stage of ['warmup','exercise','finish','saved']) await scene(`client-run-${stage}`,`&clientHarnessPage=workoutRunStage&clientWorkoutRunStage=${stage}`);
for(const type of ['draft','readiness','post','exit','incomplete']) await scene(`client-dialog-${type}`,`&clientHarnessPage=workoutDialogs&clientWorkoutDialog=${type}`);
for(const sheet of ['profile','nutrition','settings','connections']) await scene(`client-sheet-${sheet}`,`&clientHarnessPage=profileSheets&sheet=${sheet}`);
for(const sheet of ['calendar','history','mode']) await scene(`client-workout-sheet-${sheet}`,`&clientHarnessPage=workoutSheets&sheet=${sheet}`);
for(const modal of ['measurements','photos','notifications','telegram']) await scene(`client-cabinet-${modal}`,`&clientCabinetModal=${modal}`,modal==='notifications'?undefined:()=>page.getByTestId('client-nav-cabinet').click());
for(const step of [1,2,3,4,5,6,7,8,9]) await scene(`client-onboarding-${step}`,`&clientHarnessPage=firstSetup&clientFirstSetupStep=${step}`);
await page.setViewportSize({width:1366,height:852});
for(const tab of ['main','workouts','nutrition','progress','cabinet']) await scene(`client-desktop-${tab}`,'&clientWorkoutOverviewState=today',()=>page.getByTestId(`client-nav-${tab}`).click());
await page.setViewportSize({width:393,height:852});
if(!retry) try{
  await page.goto(`${base}/v2?trainerHarness=1&photoCompare=1&programAssignments=1`);
  await page.locator('.trainerNextRoot').waitFor();await capture('trainer-overview');
  await page.getByTestId('trainer-nav-clients').click();await capture('trainer-clients');
  await page.locator('.trainerNextClientTable > button').first().click();
  for(const [id,name] of [['overview','Сводка'],['workouts','Тренировки'],['nutrition','Питание'],['measurements','Фото и замеры']]) {
    await page.locator('.trainerNextClientMobileNav').getByRole('button',{name,exact:true}).click();
    const close=page.getByRole('button',{name:'Закрыть редактор плана',exact:true});if(await close.isVisible())await close.click();await capture(`trainer-client-${id}`);
  }
  await page.getByRole('button',{name:'Назад к списку клиентов',exact:true}).click();
  await page.getByTestId('trainer-nav-workouts').click();await capture('trainer-programs');
  await page.locator('.trainerNextPageTabs button').nth(1).click();await capture('trainer-library');
  await page.getByTestId('trainer-nav-more').click();await capture('trainer-cabinet');
}catch(e){records.push({id:'trainer-traversal',error:e.message.slice(0,300)});}
await fs.writeFile('artifacts/audit-755-ui-results.json',JSON.stringify(records,null,2));
console.log(JSON.stringify({screens:records.length,errors:records.filter(r=>r.error||r.errors?.length),overflow:records.filter(r=>r.overflow>1).map(r=>({id:r.id,overflow:r.overflow})),smallTargets:records.filter(r=>r.smallCount>0).map(r=>({id:r.id,count:r.smallCount}))},null,2));
await browser.close();
