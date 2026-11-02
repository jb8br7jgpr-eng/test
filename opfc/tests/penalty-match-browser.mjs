import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({
 executablePath:process.env.CHROME_BINARY,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage']
});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
let errors=[];
page.on('pageerror',err=>errors.push(String(err)));
page.on('request',r=>{if(/supabase\.co/i.test(r.url()))errors.push('Unexpected Supabase access '+r.url());});
await page.route('http://127.0.0.1:8765/penalty-browser-fixture.html',route=>route.fulfill({
 status:200,contentType:'text/html;charset=utf-8',
 body:'<!doctype html><html lang="fr"><head><meta name="viewport" content="width=device-width,initial-scale=1">'+
 '<link rel="stylesheet" href="/opfc/ui.css"><link rel="stylesheet" href="/opfc/v3-match.css">'+
 '<link rel="stylesheet" href="/opfc/penalty-scene.css"></head>'+
 '<body><div class="app" id="opfc-app" data-v3-phase="shootout" data-v3-stadium="mugiwara"></div></body></html>'
}));
try{
 await page.goto('http://127.0.0.1:8765/penalty-browser-fixture.html',{waitUntil:'networkidle'});
 const outcome=await page.evaluate(async()=>{
  const {CARDS}=await import('/opfc/catalog.mjs');
  const {renderMatchPenaltyScene,createPenaltySceneController}=await import('/opfc/penalty-scene.mjs');
  const {renderShotResult}=await import('/opfc/ui-match-widgets.mjs');
  const ids=CARDS.filter(c=>c.position==='ATT').slice(0,1).map(c=>c.id);
  const keeper=CARDS.find(c=>c.position==='GAR')?.id;
  const shooter=ids[0];if(!shooter||!keeper)throw Error('Acteurs manquants');
  const root=document.querySelector('#opfc-app');
  const base=renderMatchPenaltyScene({shooterId:shooter,keeperId:keeper});
  root.innerHTML='<section class="panel match-stage">'+base+
   '<div class="match-choice-grid match-tactical-choices">'+
   '<button class="btn match-choice" data-action="match-shootout-choose" data-choice="GAUCHE">Gauche</button>'+
   '</div></section>';
  const initial={
   scene:root.querySelector('.opfc-penalty-scene')!==null,
   keeper:root.querySelector('.plab-keeper .character-portrait')!==null,
   ball:root.querySelector('.plab-ball-art')!==null,
   net:root.querySelector('.plab-net-mesh')!==null,
   choice:root.querySelector('button[data-action="match-shootout-choose"]')!==null,
   width:document.documentElement.scrollWidth,
   viewport:window.innerWidth
  };
  const state={phase:'shootout',teams:[{club:'PSG',formation:'2-2-2',slots:[],roster:[]},{club:'OM',formation:'2-2-2',slots:[],roster:[]}],
   match:{shootout:{lastResult:{club:'PSG',shotNumber:1,shooterId:shooter,keeperId:keeper,
    shotDirection:'GAUCHE',keeperDirection:'DROITE',result:'goal',scored:true}}}};
  const result=renderShotResult(state,{outcome:'goal',attacker:'PSG',shooterId:shooter,keeperId:keeper,
   context:'Séance de tirs au but',score:{PSG:1,OM:0}});
  let done=0;
  const ctrl=createPenaltySceneController({onFinish:()=>{
   done++;
   root.innerHTML=ctrl.decorate(result,state);
  }});
  root.innerHTML=ctrl.decorate(result,state);
  ctrl.animate(root);
  const moving=root.querySelector('.plab-ball');
  const animations=moving.getAnimations().length;
  const keeperAnimations=root.querySelector('.plab-keeper').getAnimations().length;
  return {initial,animations,keeperAnimations,done,rootTestId:root.id,
   getFinal:()=>null};
 });
 assert.equal(outcome.initial.scene,true);
 assert.equal(outcome.initial.keeper,true);
 assert.equal(outcome.initial.ball,true);
 assert.equal(outcome.initial.net,true);
 assert.equal(outcome.initial.choice,true);
 assert.ok(outcome.initial.width<=outcome.initial.viewport+2,'Débordement horizontal mobile');
 assert.ok(outcome.animations>0,'Ballon animé');
 assert.ok(outcome.keeperAnimations>0,'Gardien animé');
 await page.screenshot({path:'/tmp/opfc-penalty-integration-iphone.png'});
 await page.waitForSelector('.shot-result-unified',{timeout:4000});
 assert.equal(await page.locator('.opfc-penalty-animation').count(),0,'Scène animée retirée après 1 seconde');
 assert.equal(await page.locator('.shot-result-unified').count(),1,'Écran résultat officiel rétabli');
 assert.deepEqual(errors,[]);
 console.log('OK — iPhone 390 px : terrain validé, animation, gardien, puis résultat OPFC original');
}finally{await browser.close();}
