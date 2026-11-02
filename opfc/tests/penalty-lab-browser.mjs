import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
// Le labo tourne sur localhost, sans Supabase ni aucune partie officielle.
const browser=await chromium.launch({
 executablePath:process.env.CHROME_BINARY,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage']
});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const exceptions=[],writes=[];
page.on('pageerror',error=>exceptions.push(String(error)));
page.on('request',req=>{
 if(/supabase\.co/i.test(req.url())||req.method()!=='GET')
  writes.push(req.method()+' '+req.url());
});
const visible=selector=>page.locator(selector).waitFor({state:'visible',timeout:12000});
const choose=dir=>page.locator('button[data-action="plab-choose"][data-choice="'+dir+'"]').click();
async function kick(shot,keeper){
 await choose(shot);
 await visible('button[data-action="keeper-ready"]');
 await page.locator('button[data-action="keeper-ready"]').click();
 await choose(keeper);
 await visible('.shot-result-unified');
}
const scores=()=>page.locator('.shootout-tracker-goals').allTextContents();
try{
 await page.goto('http://127.0.0.1:8765/opfc-labo-penaltys.html',{waitUntil:'networkidle'});
 await visible('button[data-action="start"]');
 assert.equal(await page.locator('.plab-roster-slot').count(),14);
 assert.equal(await page.locator('select[data-role="club"] option').count(),40);
 await page.locator('select[data-role="mode"]').selectOption('goal');
 await page.locator('button[data-action="start"]').click();
 await visible('.plab-pitch');
 assert.equal(await page.locator('.plab-pitch .character-portrait img').count(),2);
 assert.equal(await page.locator('.plab-ball-art').count(),1);
 assert.equal(await page.locator('.match-scoreboard').count(),1,'Bandeau de score OPFC original');
 assert.equal(await page.locator('.match-tactical-choices .match-choice').count(),3,'Boutons de choix OPFC originaux');
 assert.equal(await page.locator('.plab-score').count(),0,'Aucun score parallèle créé par le laboratoire');
 assert.equal(await page.locator('.plab-dot').count(),0,'Aucune pastille de TAB parallèle');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Débordement horizontal iPhone');
 assert.ok(await page.locator('.plab-ball-art').evaluate(el=>el.outerHTML.includes('M33 21 L47 13 L67 22')),
  'Ballon pentagone noir classique de la référence');
 await page.screenshot({path:'/tmp/opfc-penalty-lab-iphone.png',fullPage:true});
 await kick('GAUCHE','DROITE');
 assert.match(await page.locator('.shot-result-unified').innerText(),/BUUUUT/);
 assert.equal(await page.locator('.shot-result-unified .btn.primary.full').innerText(),'Continuer');
 await page.locator('button[data-action="plab-replay"]').click();
 assert.equal(await page.locator('.plab-ball').count(),1);
 await page.locator('button[data-action="config"]').click();
 await page.locator('button[data-action="type-shootout"]').click();
 await page.locator('button[data-action="start"]').click();
 await visible('.shootout-tracker');
 assert.equal(await page.locator('.shootout-tracker-team').count(),2,'Tracker officiel des deux clubs');
 assert.equal(await page.locator('.shootout-mark').count(),10,'Cinq cases par club, comme le jeu');
 assert.equal(await page.locator('.match-scoreboard').count(),1);
 await kick('DROITE','DROITE');
 assert.deepEqual(await scores(),['0','0'],'Ne pas avancer le score avant Continuer');
 await page.locator('.plab-tools summary').click();
 await page.locator('button[data-action="replay"]').click();
 assert.deepEqual(await scores(),['0','0'],'Rejouer conserve le score officiel du labo');
 await kick('CENTRE','GAUCHE');
 await page.locator('button[data-action="plab-next"]').click();
 assert.deepEqual(await scores(),['1','0'],'Continuer comptabilise le tir une seule fois');
 assert.equal(await page.locator('.shootout-mark--goal').count(),1);
 assert.equal(await page.locator('.shootout-attempt').count(),1,'Historique réel du moteur');
 assert.equal(await page.locator('.plab-ball').count(),1);
 assert.deepEqual(writes,[],'Aucun appel distant ni écriture');
 assert.deepEqual(exceptions,[],'Aucune erreur JavaScript');
 console.log('OK — OPFC natif : score, 2 clubs, marqueurs TAB, boutons, résultat et ballon référence');
}finally{await browser.close();}
