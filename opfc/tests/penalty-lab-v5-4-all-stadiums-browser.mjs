import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const stadiums=[
 ['mugiwara',480],['wanodrome',480],['erbaf',480],
 ['skypiea',512],['alabasta',512],['marineford',512],
 ['dressrosa',512],['whole-cake',512]
];
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BINARY,
 args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
const errors=[],writes=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('request',r=>{if(/supabase\.co/i.test(r.url())||r.method()!=='GET')writes.push(r.method()+' '+r.url())});
const url='http://127.0.0.1:8765/opfc-labo-penaltys.html';
try{
 for(const [stadium,expectedHeight] of stadiums){
  await page.goto(url,{waitUntil:'networkidle'});
  await page.locator('button[data-action="start"]').waitFor({state:'visible'});
  await page.locator('select[data-role="stadium"]').selectOption(stadium);
  await page.locator('select[data-role="mode"]').selectOption('goal');
  await page.locator('button[data-action="start"]').click();
  await page.locator('.plab-pitch').waitFor({state:'visible'});
  const result=await page.evaluate(async stadium=>{
   const bg=document.querySelector('.plab-v5-backdrop');
   const p=document.querySelector('.plab-pitch');
   const rect=bg.getBoundingClientRect();
   const rectPitch=p.getBoundingClientRect();
   const css=getComputedStyle(bg);
   const found=css.backgroundImage.match(/url\(["']?([^"')]+)["']?\)/)?.[1];
   if(!found)throw Error('Image CSS absente pour '+stadium);
   const image=new Image();
   image.src=found;
   await image.decode();
   const response=await fetch(found,{method:'GET'});
   return {
    selected:bg.dataset.stadium,
    imageUrl:new URL(found,location.href).pathname,
    bytesStatus:response.status,format:response.headers.get('content-type'),
    dimensions:[image.naturalWidth,image.naturalHeight],
    heightPercent:rect.height/rectPitch.height,
    pictureRatio:rect.width/rect.height,
    position:css.backgroundPosition,backgroundSize:css.backgroundSize,
    overlayBefore:getComputedStyle(bg,'::before').content,
    overlayAfter:getComputedStyle(bg,'::after').content,
    cssStands:getComputedStyle(bg.querySelector('.plab-v4-stands')).display,
    keeper:!!p.querySelector('.plab-keeper'),
    ball:!!p.querySelector('.plab-ball'),
    portrait:!!p.querySelector('.plab-shooter'),
    goal:!!p.querySelector('.plab-v51-front-frame'),
    netLines:p.querySelectorAll('.plab-v52-net path[data-net-line]').length,
    overflow:document.documentElement.scrollWidth-innerWidth
   };
  },stadium);
  assert.equal(result.selected,stadium);
  assert.equal(result.imageUrl,'/opfc/assets/penalty-backgrounds/'+stadium+'.webp');
  assert.equal(result.bytesStatus,200,'Le fichier WebP doit être chargé');
  assert.deepEqual(result.dimensions,[1536,expectedHeight]);
  assert.ok(result.heightPercent>.324&&result.heightPercent<.336,'33% de la scène');
  assert.ok(Math.abs(result.pictureRatio-3.2)<.12,'Le cadre mobile respecte un ratio panoramique proche de 3.2:1');
  assert.equal(result.backgroundSize,'cover','Adapte tout l espace');
  assert.equal(result.position,'50% 100%','Panneaux publicitaires maintenus en bas');
  assert.equal(result.cssStands,'none','Anciens faux gradins invisibles');
  assert.equal(result.overlayBefore,'none');
  assert.equal(result.overlayAfter,'none');
  assert.ok(result.goal&&result.keeper&&result.ball&&result.portrait&&result.netLines===33,
   'La scène V5.2 est conservée');
  assert.ok(result.overflow<=2,'Pas de débordement sur iPhone');
  await page.locator('.plab-pitch').screenshot({path:'/tmp/opfc-v54-'+stadium+'-iphone.png'});
  console.log('OK stadium',stadium,JSON.stringify(result));
 }
 // Une frappe avec un des six nouveaux décors : animation/résultat inchangés.
 await page.goto(url,{waitUntil:'networkidle'});
 await page.locator('button[data-action="start"]').waitFor({state:'visible'});
 await page.locator('select[data-role="stadium"]').selectOption('whole-cake');
 await page.locator('select[data-role="mode"]').selectOption('goal');
 await page.locator('button[data-action="start"]').click();
 await page.locator('button[data-action="plab-choose"][data-choice="DROITE"]').click();
 await page.locator('button[data-action="keeper-ready"]').click();
 await page.locator('button[data-action="plab-choose"][data-choice="GAUCHE"]').click();
 await page.locator('.shot-result-unified').waitFor({state:'visible'});
 assert.match(await page.locator('.shot-result-unified').innerText(),/BUUUUT/);
 assert.deepEqual(errors,[],'Aucune erreur JS');
 assert.deepEqual(writes,[],'Pas d enregistrement ou de requête serveur');
 console.log('OK — huit décors et penalty V5.2 fonctionnels sur iPhone, aucun moteur modifié');
}finally{await browser.close();}
