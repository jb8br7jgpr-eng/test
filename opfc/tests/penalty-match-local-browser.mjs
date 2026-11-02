/** Parcours E2E isolé du véritable jeu local (sauvegarde uniquement dans le navigateur de CI). */
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createLabSession} from '../penalty-lab-core.mjs';
import {dispatchSetPieceMatch} from '../ui-set-piece.mjs';
const teams=createLabSession().teams.map(t=>({...t,identityId:t.club,ready:true,budget:0,refusals:0,hakis:{kings:false,observation:false}}));
let game={version:1,phase:'match',competition:'league',stadiumId:'mugiwara',
 playerStatsVersion:2,prematchSeen:true,matchRecordId:'ci-penalty-no-persistence',
 recruitmentMode:'random',teams,dice:[2,4],
 match:{
  index:0,minute:35,score:{PSG:0,OM:0},
  statistics:{PSG:{sequences:0,shots:0,onTarget:0,saves:0},OM:{sequences:0,shots:0,onTarget:0,saves:0}},
  schedule:[{minute:35,period:1,attacker:'PSG',type:'penalty'},
            {minute:62,period:2,attacker:'OM',type:'penalty'}],
  goals:[],history:[],lastResult:null,winner:null,victory:null,shootout:null,competition:'league'
 }};
game=dispatchSetPieceMatch(game,'begin-setpiece');
game=dispatchSetPieceMatch(game,'select-taker',{takerId:teams[0].slots[5]});
assert.equal(game.match.action.stage,'attack-choice');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BINARY,
 args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
const errors=[],network=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('request',r=>{if(/supabase\.co/.test(r.url()))network.push(r.url());});
await page.addInitScript(g=>{
 localStorage.setItem('opfc-v08-local-dev',JSON.stringify({
  game:g,firstClub:'PSG',beforeForm:{PSG:'2-2-2',OM:'2-2-2'},teamsVisible:false
 }));
},game);
const visible=sel=>page.locator(sel).waitFor({state:'visible',timeout:15000});
try{
 await page.goto('http://127.0.0.1:8765/opfc.html',{waitUntil:'domcontentloaded'});
 await visible('button[data-action="open-local"]');
 await page.locator('button[data-action="open-local"]').click();
 await visible('button[data-action="resume-local"]');
 await page.locator('button[data-action="resume-local"]').click();
 await visible('button[data-action="match-uncover"]');
 await page.locator('button[data-action="match-uncover"]').click();
 await visible('.opfc-penalty-scene .plab-ball-art');
 assert.equal(await page.locator('.opfc-penalty-scene .plab-net-mesh').count(),1);
 assert.equal(await page.locator('button[data-action="match-choose"]').count(),3);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Mobile width');
 await page.screenshot({path:'/tmp/opfc-penalty-local-choice.png'});
 await page.locator('button[data-action="match-choose"][data-choice="GAUCHE"]').click();
 await visible('button[data-action="match-uncover"]');
 await page.locator('button[data-action="match-uncover"]').click();
 await visible('.opfc-penalty-scene .plab-ball');
 await page.locator('button[data-action="match-choose"][data-choice="DROITE"]').click();
 await visible('.opfc-penalty-animation .plab-ball');
 assert.equal(await page.locator('.shot-result-unified').count(),0,'Do not reveal result before animation');
 await page.screenshot({path:'/tmp/opfc-penalty-local-animation.png'});
 await visible('.shot-result-unified');
 assert.equal(await page.locator('.opfc-penalty-animation').count(),0);
 assert.ok(await page.locator('.shot-result-unified .shot-result-headline').count());
 assert.deepEqual(errors,[]);
 assert.deepEqual(network,[],'No Supabase access in local test');
 console.log('OK — VRAI match local: choix tireur, confidentialité, choix gardien, animation, résultat officiel');
}finally{await browser.close();}
