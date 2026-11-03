/** iPhone Chrome : vraie ouverture du match local + reprise, preload d'un SEUL WebP. */
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createLabSession} from '../penalty-lab-core.mjs';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BINARY,
 args:['--no-sandbox','--disable-dev-shm-usage']});
const teams=createLabSession().teams.map(t=>({
 ...t,identityId:t.club,ready:true,budget:0,refusals:0,hakis:{kings:false,observation:false}
}));
const stats=()=>({sequences:0,shots:0,onTarget:0,saves:0});
const sample=(stadiumId)=>({
 version:1,phase:'match',competition:'league',stadiumId,
 playerStatsVersion:2,prematchSeen:true,matchRecordId:'ci-'+stadiumId,
 recruitmentMode:'random',teams:structuredClone(teams),dice:[2,4],
 match:{
  index:0,minute:35,score:{PSG:0,OM:0},
  statistics:{PSG:stats(),OM:stats()},
  schedule:[{minute:35,period:1,attacker:'PSG',type:'penalty'}],
  goals:[],history:[],lastResult:null,winner:null,victory:null,shootout:null,competition:'league'
 }
});
try{
 for(const id of ['erbaf','whole-cake']){
  const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const page=await ctx.newPage(),fail=[],imageCalls=[];
  page.on('pageerror',e=>fail.push(String(e)));
  page.on('request',r=>{
   if(/supabase\.co/i.test(r.url()))fail.push('Remote request '+r.url());
   if(r.url().includes('/opfc/assets/penalty-backgrounds/'))imageCalls.push(r.url());
  });
  await page.addInitScript(state=>{
   localStorage.setItem('opfc-v08-local-dev',JSON.stringify({
    game:state,firstClub:'PSG',beforeForm:{PSG:'2-2-2',OM:'2-2-2'},teamsVisible:false
   }));
  },sample(id));
  await page.goto('http://127.0.0.1:8765/opfc.html',{waitUntil:'domcontentloaded'});
  await page.locator('button[data-action="open-local"]').waitFor({state:'visible'});
  assert.equal(imageCalls.length,0,'Aucun décor penalty téléchargé sur le simple menu');
  await page.locator('button[data-action="open-local"]').click();
  await page.locator('button[data-action="resume-local"]').waitFor({state:'visible'});
  await page.locator('button[data-action="resume-local"]').click();
  await page.waitForFunction(id=>performance.getEntriesByType('resource').some(r=>
   r.name.endsWith('/opfc/assets/penalty-backgrounds/'+id+'.webp')),id,{timeout:12000});
  await page.waitForTimeout(250);
  assert.deepEqual(imageCalls.map(x=>new URL(x).pathname),
   ['/opfc/assets/penalty-backgrounds/'+id+'.webp'],'Exactement un fichier choisi au démarrage');
  const size=await page.evaluate(async id=>{
   const url='./opfc/assets/penalty-backgrounds/'+id+'.webp';
   const img=new Image();
   img.src=url;
   await img.decode();
   return {w:img.naturalWidth,h:img.naturalHeight};
  },id);
  assert.equal(size.w,1536);
  assert.equal(size.h,id==='erbaf'?480:512);
  assert.deepEqual(fail,[]);
  console.log('OK preload match local iPhone',id,imageCalls.length,size);
  await ctx.close();
 }
}finally{await browser.close();}
