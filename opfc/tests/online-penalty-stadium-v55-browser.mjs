/** OPFC : deux iPhone simulés, même match en ligne, décor Wanodrome identique.
 * Aucun salon réel, aucune connexion Supabase, aucun match sauvegardé.
 */
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createLabSession} from '../penalty-lab-core.mjs';
import {applyOnlineSetPieceTransition} from '../online-set-piece.mjs';
import {onlineMatchView} from '../online-match.mjs';

const gameTeams=createLabSession().teams;
const zeroStats=()=>({sequences:0,shots:0,onTarget:0,saves:0});
const makeState=(stadiumId,attacker)=>({
 version:1,phase:'match',stadiumId,competition:'league',dice:[2,3],
 teams:structuredClone(gameTeams),match:{
  index:0,minute:36,score:{PSG:0,OM:0},goals:[],history:[],
  statistics:{PSG:zeroStats(),OM:zeroStats()},
  schedule:[{minute:36,period:1,attacker,type:'penalty'}],
  currentMoment:null,action:null,lastResult:null,competition:'league'
 }
});
const next=(s,club,command)=>applyOnlineSetPieceTransition(s,club,command,()=>.98);
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BINARY,
 args:['--no-sandbox','--disable-dev-shm-usage']});
const pages=[],errors=[],calls=[];
const url='http://127.0.0.1:8765/opfc-penalty-two-phones-stadium-fixture.html';
try{
 for(const club of ['PSG','OM']){
  const page=await browser.newPage({viewport:{width:390,height:844},
   deviceScaleFactor:2,isMobile:true,hasTouch:true});
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('request',r=>{
   if(/supabase\.co/i.test(r.url()))errors.push('Accès Supabase interdit');
   if(/penalty-backgrounds\//.test(r.url()))calls.push({club,url:r.url()});
  });
  await page.route(url,route=>route.fulfill({
   status:200,contentType:'text/html;charset=utf-8',
   body:'<!doctype html><html lang="fr"><head><meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<link rel="stylesheet" href="/opfc/ui.css"><link rel="stylesheet" href="/opfc/v3-match.css">'+
    '<link rel="stylesheet" href="/opfc/penalty-scene.css"><link rel="stylesheet" href="/opfc/penalty-scene-v5-5.css">'+
    '</head><body><div class="app" id="opfc-app" data-v3-phase="match"></div></body></html>'
  }));
  await page.goto(url,{waitUntil:'networkidle'});
  await page.evaluate(async club=>{
   const {renderOnlineGame}=await import('/opfc/ui-online-game.mjs?v=opfc-online-penalty-stadium-fix-20261103');
   window.renderOfficial=(view)=>{
    const root=document.getElementById('opfc-app');
    root.dataset.v3Stadium=view.stadiumId;
    root.innerHTML=renderOnlineGame(view,{myClub:club,hostClub:'PSG',competition:'league'});
   };
  },club);
  pages.push({club,page});
 }
 const paint=async(state,stadiumId,activeClub,stage)=>{
  for(const {club,page} of pages){
   const view=onlineMatchView(state,club);
   assert.equal(view.stadiumId,stadiumId,'Projection publique du stade officiel');
   await page.evaluate(view=>window.renderOfficial(view),view);
   const scene=page.locator('.opfc-penalty-scene');
   await scene.waitFor({state:'visible'});
   const res=await scene.evaluate(async node=>{
    const stadium=node.querySelector('.plab-v5-backdrop');
    const imageUrl=getComputedStyle(stadium).backgroundImage.match(/url\(["']?([^"')]+)["']?\)/)?.[1];
    const img=new Image();img.src=imageUrl;await img.decode();
    return {id:stadium?.dataset.stadium,path:new URL(imageUrl,location.href).pathname,
     w:img.naturalWidth,h:img.naturalHeight,live:false};
   });
   assert.equal(res.id,stadiumId,stage+' '+club+' : stade sélectionné');
   assert.equal(res.path,'/opfc/assets/penalty-backgrounds/'+stadiumId+'.webp',
    stage+' '+club+' : vrai fichier WebP affiché');
   assert.equal(res.w,1536);
   assert.ok(res.h===480||res.h===512);
   assert.equal(await page.locator('.online-turn-wait').count(),
    activeClub===club?0:1,stage+' '+club+' : état d attente');
   assert.equal(await page.locator('button[data-action="online-choice"]').count(),
    activeClub===club?3:0,stage+' '+club+' : commandes confidentielles');
   await page.locator('.opfc-penalty-scene').screenshot({
    path:'/tmp/opfc-online-penalty-'+stadiumId+'-'+stage+'-'+club+'.png'
   });
   console.log('OK '+stage+' '+club+' -> '+res.path);
  }
 };
 for(const [stadiumId,attacker] of [['wanodrome','PSG'],['dressrosa','OM']]){
  const keeper=attacker==='PSG'?'OM':'PSG';
  let state=makeState(stadiumId,attacker);
  const taker=gameTeams.find(x=>x.club===attacker).slots[5];
  state=next(state,attacker,{type:'begin-setpiece'});
  state=next(state,attacker,{type:'select-taker',takerId:taker});
  await paint(state,stadiumId,attacker,'attack-choice');
  state=next(state,attacker,{type:'choose',choice:'GAUCHE'});
  await paint(state,stadiumId,keeper,'defense-choice');
  state=next(state,keeper,{type:'choose',choice:'DROITE'});
  assert.equal(state.phase,'moment-result');
  for(const {club,page} of pages){
   const view=onlineMatchView(state,club);
   await page.evaluate(async view=>{
    const {createPenaltySceneController}=await import('/opfc/penalty-scene.mjs');
    const root=document.getElementById('opfc-app');
    const official=window.renderOfficial;official(view);
    const original=root.innerHTML;
    const ctrl=createPenaltySceneController({clock:()=>0,schedule:()=>1,cancel:()=>{}});
    root.innerHTML=ctrl.decorate(original,view);
   },view);
   const image=page.locator('.opfc-penalty-animation .plab-v5-backdrop');
   await image.waitFor({state:'attached'});
   assert.equal(await image.getAttribute('data-stadium'),stadiumId,
    'Animation penalty correct sur '+club);
   assert.ok(await page.locator('.opfc-penalty-animation').count());
   console.log('OK animation '+stadiumId+' '+club);
  }
 }
 assert.deepEqual(errors,[]);
 assert.ok(calls.length>=4,'WebP réellement demandés par le navigateur');
 console.log('OK — 2 iPhone: Wanodrome et Dressrosa, attaquant + gardien + attente + animation, zéro secret et aucun Supabase');
}finally{await browser.close();}
