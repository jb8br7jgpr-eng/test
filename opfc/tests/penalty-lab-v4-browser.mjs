import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({executablePath:process.env.CHROME_BINARY,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const errors=[],writes=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('request',r=>{if(/supabase\.co/.test(r.url())||r.method()!=='GET')writes.push(r.method()+' '+r.url());});
const visible=selector=>page.locator(selector).waitFor({state:'visible',timeout:15000});
const choose=dir=>page.locator('button[data-action="plab-choose"][data-choice="'+dir+'"]').click();
async function kick(shot,keeper,cls){
 await choose(shot);
 await visible('button[data-action="keeper-ready"]');
 await page.locator('button[data-action="keeper-ready"]').click();
 await choose(keeper);
 await visible('.plab-pitch.'+cls);
 await visible('.shot-result-unified');
}
async function configure(mode,stadium,type='penalty'){
 await page.locator('select[data-role="mode"]').selectOption(mode);
 await page.locator('select[data-role="stadium"]').selectOption(stadium);
 if(type==='shootout')await page.locator('button[data-action="type-shootout"]').click();
 await page.locator('button[data-action="start"]').click();
 await visible('.plab-pitch');
}
async function backConfig(){
 await page.locator('.plab-tools summary').click();
 await page.locator('button[data-action="config"]').click();
 await visible('button[data-action="start"]');
}
try{
 await page.goto('http://127.0.0.1:8765/opfc-labo-penaltys.html',{waitUntil:'networkidle'});
 await visible('button[data-action="start"]');
 assert.equal(await page.locator('.plab-roster-slot').count(),14);
 await configure('goal','dressrosa');
 assert.equal(await page.locator('.plab-v4-stands').count(),1);
 assert.equal(await page.locator('.plab-v4-lights').count(),1);
 assert.equal(await page.locator('.plab-v4-net-left').count(),1);
 assert.equal(await page.locator('.plab-v4-net-center').count(),1);
 assert.equal(await page.locator('.plab-v4-net-right').count(),1);
 assert.equal(await page.locator('.plab-ball-art').count(),1);
 assert.ok(await page.locator('.plab-ball-art').evaluate(el=>el.outerHTML.includes('M33 21 L47 13 L67 22')));
 assert.equal(await page.locator('.match-scoreboard').count(),1);
 assert.equal(await page.locator('.match-tactical-choices .match-choice').count(),3);
 assert.equal(await page.locator('.plab-score').count(),0);
 assert.equal(await page.locator('.plab-dot').count(),0);
 assert.equal(await page.locator('.plab-pitch').evaluate(el=>el.style.getPropertyValue('--plab-v4-light')),'#e6bd70');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Débordement écran iPhone');
 await page.screenshot({path:'/tmp/opfc-lab-v4-iphone.png',fullPage:true});
 await kick('GAUCHE','DROITE','plab-v4-impact-left');
 assert.match(await page.locator('.shot-result-unified').innerText(),/BUUUUT/);
 assert.equal(await page.locator('.shot-result-unified .btn.primary.full').count(),1);
 await backConfig();await configure('save','marineford');
 await kick('CENTRE','CENTRE','plab-v4-save-contact');
 assert.equal(await page.locator('.shot-result-unified').count(),1);
 await backConfig();await configure('miss','whole-cake');
 await kick('DROITE','GAUCHE','plab-v4-miss-out');
 assert.equal(await page.locator('.shot-result-unified').count(),1);
 await backConfig();await configure('goal','mugiwara','shootout');
 assert.equal(await page.locator('.shootout-tracker-team').count(),2);
 assert.equal(await page.locator('.shootout-mark').count(),10);
 await kick('DROITE','GAUCHE','plab-v4-impact-right');
 assert.deepEqual(await page.locator('.shootout-tracker-goals').allTextContents(),['0','0']);
 await page.locator('button[data-action="plab-next"]').click();
 assert.deepEqual(await page.locator('.shootout-tracker-goals').allTextContents(),['1','0']);
 assert.equal(await page.locator('.shootout-mark--goal').count(),1);
 assert.deepEqual(writes,[],'Labo n écrit rien');
 assert.deepEqual(errors,[],'Aucune erreur JavaScript');
 console.log('OK — V4 lab iPhone: 3 outcomes, 3 directional nets, all existing OPFC scores and buttons, zero network');
}finally{await browser.close();}
