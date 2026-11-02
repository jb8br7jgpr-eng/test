import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BINARY,args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const issues=[],writes=[];
page.on('pageerror',e=>issues.push(String(e)));
page.on('request',r=>{if(/supabase\.co/i.test(r.url())||r.method()!=='GET')writes.push(r.method()+' '+r.url());});
const url='http://127.0.0.1:8765/opfc-labo-penaltys.html';
try{
 for(const stadium of ['mugiwara','erbaf','whole-cake']){
  await page.goto(url,{waitUntil:'networkidle'});
  await page.locator('button[data-action="start"]').waitFor({state:'visible'});
  await page.locator('select[data-role="stadium"]').selectOption(stadium);
  await page.locator('select[data-role="mode"]').selectOption('goal');
  await page.locator('button[data-action="start"]').click();
  await page.locator('.plab-v55-turf').waitFor({state:'visible'});
  const data=await page.evaluate(()=>{
   const p=document.querySelector('.plab-pitch');
   const grass=document.querySelector('.plab-v55-turf');
   const pitch=p.querySelector('svg.plab-lines');
   const back=p.querySelector('.plab-v5-backdrop');
   const gb=grass.getBoundingClientRect(),pb=p.getBoundingClientRect();
   return {
    classes:[...document.querySelector('#opfc-app').classList],
    zTurf:getComputedStyle(grass).zIndex,zGoal:getComputedStyle(pitch).zIndex,
    zBack:getComputedStyle(back).zIndex,
    turfTop:gb.top-pb.top,
    turfHeight:gb.height/pb.height,
    grassClip:!!grass.querySelector('#plab-v55-grass-clip'),
    stripeRects:[...grass.querySelectorAll('rect')].filter(r=>r.getAttribute('height')==='245').length,
    microPaths:[...grass.querySelectorAll('path')].filter(r=>r.getAttribute('stroke-opacity')&&r.getAttribute('d')?.match(/M/g)?.length>100).length,
    blades:[...grass.querySelectorAll('path')].filter(r=>r.getAttribute('stroke-opacity')&&r.getAttribute('d')?.match(/M/g)?.length>100).reduce((acc,r)=>acc+(r.getAttribute('d').match(/M/g)||[]).length,0),
    oldBladeTiles:pitch.querySelectorAll('rect[fill="url(#plab-blades)"]').length,
    netLines:p.querySelectorAll('.plab-v52-net path[data-net-line]').length,
    mark:pitch.querySelector('path[d*="M43 145 L7 297"]')?.getAttribute('d')??null,
    goal:!!p.querySelector('.plab-v51-front-frame'),
    keeper:!!p.querySelector('.plab-keeper'),
    shooter:!!p.querySelector('.plab-shooter'),
    ball:!!p.querySelector('.plab-ball'),
    stadium:back.dataset.stadium,
    backdrop:getComputedStyle(back).backgroundImage,
    overflow:document.documentElement.scrollWidth-innerWidth
   }
  });
  assert.ok(data.classes.includes('plab-v55'));
  assert.equal(data.zBack,'1');
  assert.equal(data.zTurf,'2');
  assert.equal(data.zGoal,'3');
  assert.equal(data.oldBladeTiles,0);
  assert.equal(data.netLines,33);
  assert.ok(data.mark?.includes('M43 145 L7 297'));
  assert.ok(data.goal&&data.keeper&&data.shooter&&data.ball);
  assert.equal(data.blades,2400);
  assert.equal(data.microPaths,4);
  assert.ok(data.turfHeight>.99&&data.turfHeight<1.01);
  assert.ok(data.backdrop.includes('/'+stadium+'.webp'));
  assert.ok(data.overflow<=2,'Pas de scroll horizontal');
  await page.locator('.plab-pitch').screenshot({path:'/tmp/opfc-v55-realistic-pitch-'+stadium+'-iphone.png'});
  await page.locator('button[data-action="plab-choose"][data-choice="GAUCHE"]').click();
  await page.locator('button[data-action="keeper-ready"]').click();
  await page.locator('button[data-action="plab-choose"][data-choice="DROITE"]').click();
  await page.locator('.shot-result-unified').waitFor({state:'visible'});
  assert.match(await page.locator('.shot-result-unified').innerText(),/BUUUUT/);
  console.log('OK — pelouse réaliste iPhone, '+stadium+': '+JSON.stringify({...data,backdrop:'ok'}));
 }
 assert.deepEqual(issues,[]);
 assert.deepEqual(writes,[],'Aucune écriture et aucun Supabase');
 console.log('OK — Trois arènes, pelouse, filets animés et buts officiels intactes');
}finally{await browser.close();}
