import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
// Aucune donnée réelle : serveur local et navigateur iPhone simulé.
const browser=await chromium.launch({executablePath:process.env.CHROME_BINARY,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const exceptions=[],writes=[];
page.on('pageerror',err=>exceptions.push(String(err)));
page.on('request',req=>{if(/supabase\.co/i.test(req.url())||req.method()!=='GET')writes.push(req.method()+' '+req.url());});
const visible=s=>page.locator(s).waitFor({state:'visible',timeout:12000});
const choose=dir=>page.locator('button[data-action="choose"][data-direction="'+dir+'"]').click();
async function kick(shot,keeper){
 await choose(shot);
 await visible('button[data-action="keeper-ready"]');
 await page.locator('button[data-action="keeper-ready"]').click();
 await choose(keeper);
 await visible('.shot-result-unified');
}
try{
 await page.goto('http://127.0.0.1:8765/opfc-labo-penaltys.html',{waitUntil:'networkidle'});
 await visible('button[data-action="start"]');
 assert.equal(await page.locator('.plab-roster-slot').count(),14);
 assert.equal(await page.locator('select[data-role="club"] option').count(),40);
 await page.locator('select[data-role="mode"]').selectOption('goal');
 await page.locator('button[data-action="start"]').click();
 await visible('.plab-pitch');
 assert.equal(await page.locator('.plab-pitch .character-portrait img').count(),2);
 assert.equal(await page.locator('.plab-ball').count(),1);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Débordement horizontal iPhone');
 await page.screenshot({path:'/tmp/opfc-penalty-lab-iphone.png'});
 await kick('GAUCHE','DROITE');
 assert.match(await page.locator('.shot-result-unified').innerText(),/BUUUUT/);
 await page.locator('button[data-action="plab-replay"]').click();
 assert.equal(await page.locator('.plab-ball').count(),1);
 await page.locator('button[data-action="config"]').click();
 await page.locator('button[data-action="type-shootout"]').click();
 await page.locator('button[data-action="start"]').click();
 await kick('DROITE','DROITE');
 assert.equal(await page.locator('.plab-score strong').allTextContents().then(x=>x.join(':')),'0:0');
 await page.locator('button[data-action="replay"]').click();
 assert.equal(await page.locator('.plab-score strong').allTextContents().then(x=>x.join(':')),'0:0');
 await kick('CENTRE','GAUCHE');
 await page.locator('button[data-action="plab-next"]').click();
 assert.equal(await page.locator('.plab-score strong').allTextContents().then(x=>x.join(':')),'1:0');
 assert.equal(await page.locator('.plab-ball').count(),1);
 assert.deepEqual(writes,[],'Aucun appel distant ni écriture');
 assert.deepEqual(exceptions,[],'Aucune erreur JavaScript');
 console.log('OK — parcours iPhone : penalty, animation, résultat, rejouer, TAB et zéro écriture');
}finally{await browser.close();}
