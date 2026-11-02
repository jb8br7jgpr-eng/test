import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createLabSession} from '../penalty-lab-core.mjs';
import {applyOnlineEndgameTransition,onlineShootoutView} from '../online-endgame.mjs';
const lab=createLabSession({type:'shootout'}),teams=lab.teams;
let s={phase:'shootout',teams,match:{score:{PSG:0,OM:0},shootout:lab.shootout,shootoutPending:null,shootoutLastResult:null}};
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BINARY,args:['--no-sandbox']});
const phones=[],errors=[],stats=()=>({sequences:0,shots:0,onTarget:0,saves:0});
const publicState=()=>({phase:s.phase,teams,match:{minute:90,index:12,score:{PSG:0,OM:0},
 statistics:{PSG:stats(),OM:stats()},shootout:onlineShootoutView(s),resultAcks:{PSG:false,OM:false}}});
try{
 for(const club of ['PSG','OM']){
  const p=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  p.on('pageerror',e=>errors.push(String(e)));
  p.on('request',r=>{if(r.url().includes('supabase.co'))errors.push('Remote write');});
  await p.route('http://127.0.0.1:8765/opfc-two-phones-test.html',r=>r.fulfill({
   status:200,contentType:'text/html',body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/opfc/ui.css"><link rel="stylesheet" href="/opfc/v3-match.css"><link rel="stylesheet" href="/opfc/penalty-scene.css"></head><body><div id="opfc-app" class="app" data-v3-phase="shootout"></div></body></html>'}));
  await p.goto('http://127.0.0.1:8765/opfc-two-phones-test.html');
  await p.evaluate(async club=>{
   const {renderOnlineGame}=await import('/opfc/ui-online-game.mjs?v=opfc-penalty-scene-20261102');
   const {createPenaltySceneController}=await import('/opfc/penalty-scene.mjs');
   const root=document.getElementById('opfc-app');
   const c=createPenaltySceneController({onFinish:()=>window.paint(window.snap)});
   window.paint=state=>{window.snap=state;
    const html=renderOnlineGame(state,{myClub:club,hostClub:'PSG'});
    root.innerHTML=c.decorate(html,state,{previousTracker:root.querySelector('.shootout-tracker')?.outerHTML,
     previousLog:root.querySelector('.shootout-log')?.outerHTML});
    c.animate(root);
   };
  },club);
  phones.push({club,page:p});
 }
 const paint=()=>Promise.all(phones.map(p=>p.page.evaluate(state=>window.paint(state),publicState())));
 const first=lab.shootout.firstClub,second=first==='PSG'?'OM':'PSG';
 await paint();
 for(const p of phones){
  assert.equal(await p.page.locator('.opfc-penalty-scene').count(),1);
  assert.equal(await p.page.locator('button[data-action="online-choice"]').count(),p.club===first?3:0);
 }
 s=applyOnlineEndgameTransition(s,first,{type:'shootout-choose',choice:'GAUCHE'},{hostClub:'PSG',rng:()=>.5});
 assert.ok(!JSON.stringify(onlineShootoutView(s)).includes('shotDirection'));
 await paint();
 for(const p of phones)assert.equal(await p.page.locator('button[data-action="online-choice"]').count(),p.club===second?3:0);
 s=applyOnlineEndgameTransition(s,second,{type:'shootout-choose',choice:'DROITE'},{hostClub:'PSG',rng:()=>.99});
 assert.equal(s.match.shootout.timeline.length,1);
 await paint();
 for(const p of phones){
  assert.equal(await p.page.locator('.opfc-penalty-animation').count(),1);
  assert.equal(await p.page.locator('.shot-result-unified').count(),0);
 }
 await phones[0].page.screenshot({path:'/tmp/opfc-two-phones-penalty.png'});
 await Promise.all(phones.map(p=>p.page.locator('.shot-result-unified').waitFor({timeout:4000})));
 for(const p of phones)assert.equal(await p.page.locator('.opfc-penalty-animation').count(),0);
 assert.deepEqual(errors,[]);
 console.log('OK — two-phone online TAB: secret choices, one server result, scene then original result');
}finally{await browser.close();}
