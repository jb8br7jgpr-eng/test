import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({executablePath:process.env.CHROME_BINARY,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
const errors=[],writes=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('request',r=>{if(/supabase\.co/i.test(r.url())||r.method()!=='GET')writes.push(r.method()+' '+r.url());});
const visible=selector=>page.locator(selector).waitFor({state:'visible',timeout:12000});
const clickDir=direction=>page.locator('button[data-action="plab-choose"][data-choice="'+direction+'"]').click();
async function setup(mode,type='penalty'){
 await page.goto('http://127.0.0.1:8765/opfc-labo-penaltys.html',{waitUntil:'networkidle'});
 await visible('button[data-action="start"]');
 await page.locator('select[data-role="mode"]').selectOption(mode);
 if(type==='shootout')await page.locator('button[data-action="type-shootout"]').click();
 await page.locator('button[data-action="start"]').click();
 await visible('.plab-v52-net');
 assert.equal(await page.locator('.plab-v52-net path[data-net-line]').count(),33);
 assert.equal(await page.locator('.plab-v4-net-left').count(),0);
 assert.equal(await page.locator('.plab-v4-net-center').count(),0);
 assert.equal(await page.locator('.plab-v4-net-right').count(),0);
 assert.equal(await page.locator('.plab-v52-net [clip-path]').count(),0);
 assert.equal(await page.locator('.match-scoreboard').count(),1);
 assert.equal(await page.locator('.match-tactical-choices .match-choice').count(),3);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'iPhone horizontal overflow');
}
async function shot(shot,keeper,expectNet=true,label=''){
 const first=await page.locator('.plab-v52-net path[data-net-line="8"]').getAttribute('d');
 await clickDir(shot);
 await visible('button[data-action="keeper-ready"]');
 await page.locator('button[data-action="keeper-ready"]').click();
 await clickDir(keeper);
 if(expectNet){
  await page.waitForFunction(()=>document.querySelector('.plab-v52-net')?.classList.contains('plab-v52-net-active'),null,{timeout:4000});
  await page.waitForFunction(d=>{
   const group=document.querySelector('.plab-v52-net');
   return group?.querySelector('path[data-net-line="8"]')?.getAttribute('d')!==d;
  },first,{timeout:2400});
  assert.equal(await page.locator('.plab-v52-net path[data-net-line]').count(),33);
  await page.locator('.plab-pitch').screenshot({path:'/tmp/opfc-v52-net-'+label+'.png'});
 }
 await visible('.shot-result-unified');
 assert.equal(await page.locator('.plab-v52-net-active').count(),0);
 assert.equal(await page.locator('.shot-result-unified').count(),1);
}
try{
 for(const [dir,keeper] of [['GAUCHE','DROITE'],['CENTRE','GAUCHE'],['DROITE','CENTRE']]){
  await setup('goal');
  await shot(dir,keeper,true,dir.toLowerCase());
  assert.match(await page.locator('.shot-result-unified').innerText(),/BUUUUT/);
  console.log('OK — filet d un seul tenant, impact '+dir);
 }
 for(const mode of ['save','miss']){
  await setup(mode);
  await shot(mode==='save'?'CENTRE':'DROITE',mode==='save'?'CENTRE':'GAUCHE',false,mode);
  console.log('OK — '+mode+' : pas d onde dans les filets');
 }
 await setup('goal','shootout');
 assert.equal(await page.locator('.shootout-mark').count(),10);
 await shot('GAUCHE','DROITE',true,'tab');
 assert.deepEqual(await page.locator('.shootout-tracker-goals').allTextContents(),['0','0']);
 await page.locator('button[data-action="plab-next"]').click();
 assert.deepEqual(await page.locator('.shootout-tracker-goals').allTextContents(),['1','0']);
 assert.deepEqual(writes,[],'No network or server writes');
 assert.deepEqual(errors,[],'No JavaScript errors');
 console.log('OK — V5.2 mobile: 3 goal net ripples, 2 non-goals, TAB and identical OPFC screens');
}finally{await browser.close();}
