import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const cases=[
 {mode:'goal',shot:'GAUCHE',keeper:'DROITE'},
 {mode:'goal',shot:'CENTRE',keeper:'GAUCHE'},
 {mode:'goal',shot:'DROITE',keeper:'CENTRE'},
 {mode:'goal',shot:'GAUCHE',keeper:'GAUCHE'},
 {mode:'goal',shot:'CENTRE',keeper:'CENTRE'},
 {mode:'goal',shot:'DROITE',keeper:'DROITE'},
 {mode:'save',shot:'GAUCHE',keeper:'GAUCHE'},
 {mode:'save',shot:'CENTRE',keeper:'CENTRE'},
 {mode:'save',shot:'DROITE',keeper:'DROITE'},
 {mode:'miss',shot:'GAUCHE',keeper:'CENTRE'},
 {mode:'miss',shot:'CENTRE',keeper:'GAUCHE'},
 {mode:'miss',shot:'DROITE',keeper:'CENTRE'}
];
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BINARY,
 args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
const errors=[],writes=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('request',r=>{if(/supabase\.co/i.test(r.url())||r.method()!=='GET')
 writes.push(r.method()+' '+r.url());});
try{
 for(const item of cases){
  await page.goto('http://127.0.0.1:8765/opfc-labo-penaltys.html',{waitUntil:'domcontentloaded'});
  await page.locator('button[data-action="start"]').waitFor({state:'visible'});
  await page.locator('select[data-role="mode"]').selectOption(item.mode);
  await page.locator('button[data-action="start"]').click();
  await page.locator('button[data-action="plab-choose"][data-choice="'+item.shot+'"]').click();
  await page.locator('button[data-action="keeper-ready"]').click();
  await page.locator('button[data-action="plab-choose"][data-choice="'+item.keeper+'"]').click();

  await page.waitForFunction(()=>{
   const b=document.querySelector('.plab-pitch .plab-ball');
   return !!b?.getAnimations().find(a=>a.effect?.getKeyframes?.().length===5);
  },{timeout:4000});
  // Saute dans la dernière fraction de seconde, juste avant le résultat :
  // on contrôle la position RÉELLEMENT DESSINÉE à l'écran, pas seulement du code.
  const pos=await page.evaluate(()=>{
   const pitch=document.querySelector('.plab-pitch');
   const ball=document.querySelector('.plab-ball');
   const goal=document.querySelector('.plab-v51-front-frame');
   const keeper=document.querySelector('.plab-keeper .character-portrait');
   const a=ball.getAnimations().find(anim=>anim.effect?.getKeyframes?.().length===5);
   a.pause();a.currentTime=a.effect.getTiming().duration*.997;
   // Avance aussi le gardien au même instant : ses animations sont synchrones.
   // Sinon on comparerait un ballon en fin de course à un gardien encore au départ.
   for(const anim of document.querySelector('.plab-keeper')?.getAnimations()??[]){
    anim.pause();anim.currentTime=anim.effect.getTiming().duration*.997;
   }
   const rect=el=>{
    const r=el.getBoundingClientRect();
    return {x:r.x,y:r.y,left:r.left,right:r.right,top:r.top,bottom:r.bottom,
     cx:(r.left+r.right)/2,cy:(r.top+r.bottom)/2,width:r.width,height:r.height};
   };
   return {ball:rect(ball),goal:rect(goal),keeper:rect(keeper),pitch:rect(pitch),
    progress:a.currentTime/a.effect.getTiming().duration,
    ballArt:!!document.querySelector('.plab-ball-art'),
    officialScore:!!document.querySelector('.match-scoreboard')};
  });
  assert.ok(pos.ballArt&&pos.officialScore);
  const b=pos.ball,g=pos.goal;
  const fullyInside=b.left>g.left+1&&b.right<g.right-1&&b.top>g.top+1&&b.bottom<g.bottom-1;
  const message=item.mode+' '+item.shot+' vs '+item.keeper+': '+JSON.stringify({ball:b,goal:g});
  if(item.mode==='goal'){
   assert.ok(fullyInside,'But visible à l intérieur de la cage : '+message);
   if(item.shot==='GAUCHE')assert.ok(b.cx<g.cx,'Le but gauche reste à gauche : '+message);
   if(item.shot==='DROITE')assert.ok(b.cx>g.cx,'Le but droit reste à droite : '+message);
  }else if(item.mode==='miss'){
   assert.ok(!fullyInside,'Raté visible hors de la cage : '+message);
   if(item.shot==='GAUCHE')assert.ok(b.right<g.left+5,'Raté à gauche hors montant : '+message);
   if(item.shot==='DROITE')assert.ok(b.left>g.right-5,'Raté à droite hors montant : '+message);
   if(item.shot==='CENTRE')assert.ok(b.bottom<g.top-1,'Raté au-dessus de la barre : '+message);
  }else{
   const k=pos.keeper;
   assert.ok(Math.abs(b.cx-k.cx)<k.width*.56+b.width*.6,
    'Arrêt près du gardien : '+message);
   assert.ok(Math.abs(b.cy-k.cy)<k.height*.8+b.height,
    'Arrêt à hauteur du gardien : '+message);
  }
  if(item.mode==='goal'&&item.keeper!==item.shot){
   await page.locator('.plab-pitch').screenshot({
    path:'/tmp/opfc-v5-1-corrected-goal-'+item.shot.toLowerCase()+'.png'
   });
  }
  console.log('OK '+item.mode+' '+item.shot+' / '+item.keeper+
   ': ballon ('+Math.round(b.cx)+','+Math.round(b.cy)+') vs cage ['+
   Math.round(g.left)+','+Math.round(g.top)+','+Math.round(g.right)+','+Math.round(g.bottom)+']');
 }
 assert.deepEqual(writes,[],'Aucun appel serveur ni sauvegarde');
 assert.deepEqual(errors,[],'Aucune erreur JS');
 console.log('OK 12 animations V5.1 : 6 buts dans les filets, 3 arrêts sur gardien et 3 ratés hors cadre');
}finally{
 await browser.close();
}
