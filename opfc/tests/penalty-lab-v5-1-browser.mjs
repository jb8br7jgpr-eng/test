import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({executablePath:process.env.CHROME_BINARY,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
const errors=[],writes=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('request',r=>{if(/supabase\.co/.test(r.url())||r.method()!=='GET')writes.push(r.method()+' '+r.url());});
const visible=x=>page.locator(x).waitFor({state:'visible',timeout:14000});
try{
 await page.goto('http://127.0.0.1:8765/opfc-labo-penaltys.html',{waitUntil:'networkidle'});
 await visible('button[data-action="start"]');
 await page.locator('select[data-role="stadium"]').selectOption('dressrosa');
 await page.locator('select[data-role="mode"]').selectOption('goal');
 await page.locator('button[data-action="start"]').click();
 await visible('.plab-pitch');
 const measured=await page.evaluate(()=>{
  const pitch=document.querySelector('.plab-pitch');
  const back=document.querySelector('.plab-v5-backdrop');
  const goal=document.querySelector('.plab-v51-front-frame');
  const keeper=document.querySelector('.plab-keeper');
  const ball=document.querySelector('.plab-ball');
  const shooter=document.querySelector('.plab-shooter');
  return {
   pitchWidth:pitch.getBoundingClientRect().width,
   pitchHeight:pitch.getBoundingClientRect().height,
   backdropRatio:back.getBoundingClientRect().height/pitch.getBoundingClientRect().height,
   goalRatio:goal.getBoundingClientRect().width/pitch.getBoundingClientRect().width,
   keeperTop:(keeper.getBoundingClientRect().top+keeper.getBoundingClientRect().height/2-pitch.getBoundingClientRect().top)/pitch.getBoundingClientRect().height,
   ballTop:(ball.getBoundingClientRect().top+ball.getBoundingClientRect().height/2-pitch.getBoundingClientRect().top)/pitch.getBoundingClientRect().height,
   shooterTop:(shooter.getBoundingClientRect().top+shooter.getBoundingClientRect().height/2-pitch.getBoundingClientRect().top)/pitch.getBoundingClientRect().height,
   overflow:document.documentElement.scrollWidth-innerWidth,
   stadium:back.dataset.stadium,
   goalTransform:goal.getAttribute('transform')
  };
 });
 assert.ok(measured.backdropRatio>.324&&measured.backdropRatio<.335,'33% visible TV backdrop: '+JSON.stringify(measured));
 assert.ok(measured.goalRatio>.745&&measured.goalRatio<.78,'Front frame width (no V5 rear-net shadow): '+JSON.stringify(measured));
 assert.ok(measured.ballTop>.665&&measured.ballTop<.695,'Ball remains fixed: '+JSON.stringify(measured));
 assert.ok(measured.shooterTop>.83&&measured.shooterTop<.87,'Shooter remains fixed: '+JSON.stringify(measured));
 assert.ok(measured.keeperTop>.29&&measured.keeperTop<.312,'Keeper at lower TV camera: '+JSON.stringify(measured));
 assert.ok(measured.overflow<=2,'No iPhone horizontal overflow');
 assert.equal(measured.stadium,'dressrosa');
 assert.equal(measured.goalTransform,null,'No distortion scale: physically redrawn frontal goal');
 assert.ok(await page.locator('.plab-keeper .plab-person-label').evaluate(el=>el.scrollWidth<=el.clientWidth+1),
  'Le nom du gardien doit rester lisible avec le nouveau cadrage');
 assert.equal(await page.locator('.plab-v4-net-left').count(),1);
 assert.equal(await page.locator('.plab-v4-net-center').count(),1);
 assert.equal(await page.locator('.plab-v4-net-right').count(),1);
 assert.equal(await page.locator('.plab-ball-art').count(),1);
 assert.equal(await page.locator('.match-scoreboard').count(),1);
 assert.equal(await page.locator('.match-tactical-choices .match-choice').count(),3);
 await page.screenshot({path:'/tmp/opfc-lab-v5-1-iphone-full.png',fullPage:true});
 await page.locator('.plab-pitch').screenshot({path:'/tmp/opfc-lab-v5-1-scene-iphone.png'});
 await page.locator('button[data-action="plab-choose"][data-choice="GAUCHE"]').click();
 await visible('button[data-action="keeper-ready"]');
 await page.locator('button[data-action="keeper-ready"]').click();
 await page.locator('button[data-action="plab-choose"][data-choice="DROITE"]').click();
 await visible('.shot-result-unified');
 assert.equal(await page.locator('.plab-ball-art').count(),0,'Original result screen appears cleanly');
 assert.deepEqual(errors,[]);
 assert.deepEqual(writes,[]);
 console.log('OK — V5.1 broadcast 390px: 33% visible stadium, wider frontal lower goal, keeper aligned, ball/shooter and original result unchanged',measured);
}finally{await browser.close();}
