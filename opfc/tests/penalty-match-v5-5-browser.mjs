import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BINARY,
 args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const issues=[],writes=[];
page.on('pageerror',e=>issues.push(String(e)));
page.on('request',r=>{if(/supabase\.co/i.test(r.url())||r.method()!=='GET')writes.push(r.method()+' '+r.url())});
const host='http://127.0.0.1:8765',url=host+'/opfc-match-v55-fixture.html';
await page.route(url,route=>route.fulfill({status:200,contentType:'text/html;charset=utf-8',
 body:'<!doctype html><html lang="fr"><head><meta name="viewport" content="width=device-width,initial-scale=1">'+
 '<link rel="stylesheet" href="/opfc/ui.css"><link rel="stylesheet" href="/opfc/v3-match.css">'+
 '<link rel="stylesheet" href="/opfc/penalty-scene.css">'+
 '<link rel="stylesheet" href="/opfc/penalty-scene-v5-5.css"></head>'+
 '<body><div id="opfc-app" class="app" data-v3-phase="shootout"></div></body></html>'}));
try{
 await page.goto(url,{waitUntil:'networkidle'});
 const id=await page.evaluate(async()=>{
  const {CARDS}=await import('/opfc/catalog.mjs');
  const shooter=CARDS.find(c=>c.position==='ATT')?.id;
  const keeper=CARDS.find(c=>c.position==='GAR')?.id;
  if(!shooter||!keeper)throw Error('Acteurs du match absents');
  return {shooter,keeper};
 });
 const all=['mugiwara','wanodrome','erbaf','skypiea','alabasta','marineford','dressrosa','whole-cake'];
 for(const stadium of all){
  const result=await page.evaluate(async ({id,stadium})=>{
   const {renderMatchPenaltyScene}=await import('/opfc/penalty-scene.mjs');
   const root=document.querySelector('#opfc-app');
   root.dataset.v3Stadium=stadium;
   root.innerHTML='<section class="panel match-stage">'+renderMatchPenaltyScene({
    shooterId:id.shooter,keeperId:id.keeper,stadiumId:stadium
   })+'</section>';
   const p=root.querySelector('.plab-pitch');
   const background=p.querySelector('.plab-v5-backdrop'),grass=p.querySelector('.plab-v55-turf');
   const mesh=p.querySelector('.plab-v52-net');
   const rect=p.getBoundingClientRect(),backRect=background.getBoundingClientRect();
   const css=getComputedStyle(background),turfCss=getComputedStyle(grass);
   const url=css.backgroundImage.match(/url\(["']?([^"')]+)["']?\)/)?.[1];
   if(!url)throw Error('Décor absent du CSS : '+stadium);
   const img=new Image();img.src=url;await img.decode();
   const response=await fetch(url);
   const layers={back:css.zIndex,turf:turfCss.zIndex,goal:getComputedStyle(p.querySelector('svg.plab-lines')).zIndex};
   return {stadium:background.dataset.stadium,
    backgroundImage:css.backgroundImage,size:css.backgroundSize,position:css.backgroundPosition,
    percent:backRect.height/rect.height,keeperTop:getComputedStyle(p.querySelector('.plab-keeper')).top,
    imageStatus:response.status,dimensions:[img.naturalWidth,img.naturalHeight],
    layers,net:mesh?.querySelectorAll('path[data-net-line]').length,
    goal:!!p.querySelector('.plab-v51-front-frame'),ball:!!p.querySelector('.plab-ball-art'),
    player:!!p.querySelector('.plab-shooter .character-portrait'),grass:!!grass,
    ratio:backRect.width/backRect.height,overflow:document.documentElement.scrollWidth-innerWidth};
  },{id,stadium});
  assert.equal(result.stadium,stadium);
  assert.ok(result.backgroundImage.includes('/'+stadium+'.webp'));
  assert.equal(result.imageStatus,200);
  assert.deepEqual(result.layers,{back:'1',turf:'2',goal:'3'});
  assert.equal(result.net,33);
  assert.ok(result.goal&&result.ball&&result.player&&result.grass);
  assert.ok(result.percent>.324&&result.percent<.336);
  assert.ok(result.overflow<=2);
  assert.ok(result.keeperTop.endsWith('px')&&parseFloat(result.keeperTop)>80);
  console.log('OK terrain match V5.5 '+stadium+': '+JSON.stringify(result));
  if(['mugiwara','erbaf','whole-cake'].includes(stadium))
   await page.locator('.plab-pitch').screenshot({path:'/tmp/opfc-v55-match-'+stadium+'-iphone.png'});
 }
 // Résultat déjà officiel : animation monobloc et écran de résultat INCHANGÉ.
 for(const outcome of ['goal','save','miss']){
  await page.evaluate(({id,outcome})=>{
   const p=import('/opfc/penalty-scene.mjs').then(({createPenaltySceneController})=>{
    const root=document.getElementById('opfc-app');
    const official='<section class="panel match-stage shot-result-panel"><h2>Résultat officiel intact</h2></section>';
    const result={club:'PSG',shotNumber:3,shooterId:id.shooter,keeperId:id.keeper,
     shotDirection:'GAUCHE',keeperDirection:outcome==='save'?'GAUCHE':'DROITE',
     result:outcome,scored:outcome==='goal'};
    const state={phase:'shootout',stadiumId:'mugiwara',match:{shootoutLastResult:result,
     shootout:{timeline:[result],score:{PSG:outcome==='goal'?1:0,OM:0}}}};
    const ctrl=createPenaltySceneController({onFinish:()=>{
     root.innerHTML=ctrl.decorate(official,state);
    }});
    root.innerHTML=ctrl.decorate(official,state);
    ctrl.animate(root,state);
    window.__testMatchV55={ctrl,state,official};
   });
   return p;
  },{id,outcome});
  await page.locator('.opfc-penalty-animation').waitFor({state:'visible'});
  assert.equal(await page.locator('.shot-result-panel').count(),0);
  const ballStart=await page.locator('.opfc-penalty-animation .plab-ball').evaluate(el=>el.getAnimations().length);
  assert.ok(ballStart>0,'Le ballon vole selon la trajectoire V5.1');
  if(outcome==='goal'){
   await page.waitForTimeout(1040);
   const changed=await page.locator('.plab-v52-net').evaluate(el=>
    el.querySelector('path')?.getAttribute('d')!==el.querySelector('path')?.dataset.initialPath
     &&el.classList.contains('plab-v52-net-active'));
   // Vérifie le déclenchement du filet continu sans imposer une valeur de
   // coordonnées liée à la fréquence RAF et au navigateur.
   assert.ok(changed,'Filet monobloc activé sur un but');
  }
  await page.locator('.shot-result-panel').waitFor({state:'visible',timeout:5500});
  assert.equal(await page.locator('.opfc-penalty-animation').count(),0);
  assert.equal(await page.locator('.shot-result-panel h2').innerText(),'Résultat officiel intact');
  console.log('OK animation officielle V5.5 : '+outcome);
 }
 assert.deepEqual(issues,[],'Aucune erreur Javascript');
 assert.deepEqual(writes,[],'Aucune requête d écriture, aucun Supabase');
}finally{await browser.close();}
