import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BINARY,args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
const errors=[],writes=[];
page.on('pageerror',err=>errors.push(String(err)));
page.on('request',r=>{if(/supabase\.co/.test(r.url())||r.method()!=='GET')writes.push(r.method()+' '+r.url())});
const uri='http://127.0.0.1:8765/opfc-labo-penaltys.html';
const root='./opfc/assets/penalty-backgrounds/';
try{
 for(const stadium of ['mugiwara','wanodrome','erbaf']){
  await page.goto(uri,{waitUntil:'networkidle'});
  await page.locator('button[data-action="start"]').waitFor({state:'visible'});
  await page.locator('select[data-role="stadium"]').selectOption(stadium);
  await page.locator('select[data-role="mode"]').selectOption('goal');
  const imageResponse=stadium==='erbaf'?null:page.waitForResponse(r=>
   r.url().includes('/opfc/assets/penalty-backgrounds/'+stadium+'.webp'),{timeout:12000});
  await page.locator('button[data-action="start"]').click();
  await page.locator('.plab-pitch').waitFor({state:'visible'});
  if(imageResponse)assert.equal((await imageResponse).status(),200,'Stade WebP doit être servi avec succès');
  const metrics=await page.evaluate(async()=>{
   const bg=document.querySelector('.plab-v5-backdrop');
   const pitch=document.querySelector('.plab-pitch');
   const style=getComputedStyle(bg);
   const rect=bg.getBoundingClientRect();
   const imageUrl=style.backgroundImage.match(/url\(["']?([^"')]+)["']?\)/)?.[1];
   const info={backgroundImage:style.backgroundImage,src:imageUrl??null,visibility:style.visibility,
    backgroundPosition:style.backgroundPosition,backgroundSize:style.backgroundSize,
    ratio:rect.width/rect.height,heightPercent:rect.height/pitch.getBoundingClientRect().height,
    backdropTop:rect.top,backdropBottom:rect.bottom,standsDisplay:getComputedStyle(bg.querySelector('.plab-v4-stands')).display,
    keeper:!!document.querySelector('.plab-keeper'),goal:!!document.querySelector('.plab-v51-front-frame'),
    netLines:document.querySelectorAll('.plab-v52-net path[data-net-line]').length,
    overflow:document.documentElement.scrollWidth-innerWidth,decoded:null};
   if(imageUrl){
    const image=new Image();image.src=imageUrl;
    await image.decode();info.decoded={width:image.naturalWidth,height:image.naturalHeight};
   }
   return info;
  });
  assert.ok(metrics.heightPercent>.324&&metrics.heightPercent<.335,'Décor occupe 33% terrain');
  assert.ok(metrics.overflow<=2,'Pas de débordement iPhone');
  assert.ok(metrics.goal&&metrics.keeper&&metrics.netLines===33,'But, gardien, filet V5.2 préservés');
  if(stadium!=='erbaf'){
   assert.ok(metrics.backgroundImage.includes('/'+stadium+'.webp'),'Image personnalisée correcte '+JSON.stringify(metrics));
   assert.equal(metrics.standsDisplay,'none','Ne pas afficher les anciens gradins au-dessus de WebP');
   assert.deepEqual(metrics.decoded,{width:1536,height:480});
   assert.ok(Math.abs(metrics.ratio-3.2)<.1,'Image 3.2:1 adaptée sans recadrage notable sur iPhone');
   assert.equal(metrics.backgroundSize,'cover');
   await page.locator('.plab-pitch').screenshot({path:'/tmp/opfc-v53-decor-'+stadium+'-iphone.png'});
   await page.locator('button[data-action="plab-choose"][data-choice="GAUCHE"]').click();
   await page.locator('button[data-action="keeper-ready"]').click();
   await page.locator('button[data-action="plab-choose"][data-choice="DROITE"]').click();
   await page.locator('.shot-result-unified').waitFor({state:'visible'});
  }else{
   assert.ok(!metrics.backgroundImage.includes('penalty-backgrounds'),'Six autres stades restent en décor CSS');
   assert.notEqual(metrics.standsDisplay,'none','Gradins CSS toujours visibles dans les 6 autres stades');
  }
  console.log('OK —',stadium,metrics);
 }
 assert.deepEqual(errors,[],'Pas d erreurs JS');
 assert.deepEqual(writes,[],'Aucun accès Supabase ni requête d écriture');
}finally{await browser.close();}
