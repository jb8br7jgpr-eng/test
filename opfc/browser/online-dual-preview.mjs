/** Recette de deux iPhone réseau SANS aucun déploiement Supabase.
 * Les requêtes sont interceptées par Playwright : le serveur simulé exécute
 * les VRAIES transitions serveur et renvoie des projections publiques
 * distinctes à chaque joueur. Aucun jeton n'est dans les captures.
 */
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createGame,ready} from '../engine.mjs';
import {kickoffMatch,resolveMatchMoment,continueMatch,resumeMatch,advanceShootout} from '../match.mjs';
import {applyOnlineMarketCommand} from '../online-market.mjs';
import {applyOnlineLineupCommand,onlinePreMatchView} from '../online-lineup.mjs';
import {applyOnlineOpenPlayCommand} from '../online-match.mjs';
import {nextShootoutShooter} from '../shootout.mjs';
import {mkdir} from 'node:fs/promises';

const BASE='http://127.0.0.1:8765/opfc.html';
const API='https://opfc-e2e-isole.supabase.co/functions/v1/opfc-online';
const UID='6be1626a-69ea-4a97-a858-ef04b5131721';
const PSG=['chopper','jinbe','kaido','shanks','nami','luffy','zoro'];
const OM=['loki','mihawk','monkey-d-garp','katakuri','sabo','sanji','kizaru'];
const random=seed=>()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);
const state={game:createGame({firstClub:'PSG',dice:[5,2],rng:random(2)}),
 version:1,joined:false};
const club=role=>role==='host'?'PSG':'OM';
const room=role=>({protocol:1,id:UID,code:'ABCD23',
 status:state.joined?'ready':'waiting',version:state.version,
 hostClub:'PSG',guestClub:'OM',role,myClub:club(role),
 opponentConnected:state.joined,expiresAt:'2030-10-30T12:00:00Z'});
const tokens={host:'A'.repeat(43),guest:'B'.repeat(43)};
function response(body,status=200){
 return {status,contentType:'application/json',
  headers:{'Access-Control-Allow-Origin':'*'},
  body:JSON.stringify(body)};
}
function handle(body){
 if(body.action==='create')return response({
  session:{roomId:UID,club:'PSG',role:'host',token:tokens.host},room:room('host')
 },201);
 if(body.action==='join'){
  if(state.joined)return response({error:'Code indisponible'},409);
  state.joined=true;state.version++;
  return response({session:{roomId:UID,club:'OM',role:'guest',token:tokens.guest},
   room:room('guest')});
 }
 const role=body.token===tokens.host?'host':body.token===tokens.guest?'guest':null;
 if(!role||body.roomId!==UID)return response({error:'Accès refusé'},403);
 const myClub=club(role);
 if(body.action==='get')return response({
  room:room(role),
  game:state.joined?onlinePreMatchView(state.game,myClub):null
 });
 if(!state.joined)return response({error:'Salon en attente'},409);
 if(body.expectedVersion!==state.version)
  return response({error:'Salon modifié : actualise la partie'},409);
 try{
  const command=body.command;
  let next;
  if(body.action==='market')
   next=applyOnlineMarketCommand(state.game,myClub,command);
  else if(body.action==='lineup')
   next=applyOnlineLineupCommand(state.game,myClub,command,{hostClub:'PSG',rng:random(17)});
  else if(body.action==='match')
   next=applyOnlineOpenPlayCommand(state.game,myClub,command,{hostClub:'PSG',
    // Pièce PSG premier, puis frappes déterministes pour scénario mort subite.
    rng:()=>command.type==='begin-shootout'?.1:.999999});
  else return response({error:'Action inconnue'},400);
  state.game=next.state;state.version++;
  return response({room:room(role),game:next.publicForActor});
 }catch(e){return response({error:e.message},400);}
}
function completedReady(){
 const s=createGame({firstClub:'PSG',dice:[5,2],rng:random(3)});
 s.phase='kickoff-ready';s.auction=null;
 for(const t of s.teams){
  t.roster=[...(t.club==='PSG'?PSG:OM)];t.slots=[...t.roster];
  t.formation='2-2-2';t.ready=true;
 }
 return s;
}
function matchType(kind){
 for(let seed=1;seed<=3000;seed++){
  const s=kickoffMatch(completedReady(),random(seed));
  if(s.match.schedule[0].type===kind)return s;
 }
 throw Error('Moment '+kind+' introuvable');
}
function shootoutReady(){
 let s=kickoffMatch(completedReady(),random(18));
 for(let n=0;s.phase==='match'&&n<24;n++){
  s=resolveMatchMoment(s,{outcome:'stopped'});s=continueMatch(s);
 }
 assert.equal(s.phase,'half-time');
 s=resumeMatch(ready(ready(s,'PSG'),'OM'));
 for(let n=0;s.phase==='match'&&n<24;n++){
  s=resolveMatchMoment(s,{outcome:'stopped'});s=continueMatch(s);
 }
 assert.equal(s.phase,'shootout-ready');
 return s;
}
async function refresh(page){
 // La disponibilité du bouton avant le clic ne prouve pas que le GET est fini.
 // Attendre explicitement la réponse HTTP puis la fin du rendu asynchrone.
 const got=page.waitForResponse(r=>r.url()===API&&
  r.request().method()==='POST'&&
  r.request().postDataJSON()?.action==='get');
 await page.locator('[data-action="online-refresh"]').click();
 const response=await got;
 assert.equal(response.status(),200,'Actualisation serveur indisponible');
 await page.waitForFunction(()=>document.querySelector('[data-action="online-refresh"]')?.disabled===false);
}
async function updateBoth(host,guest){
 await refresh(host);
 await refresh(guest);
}
async function replaceServer(game,host,guest){
 state.game=game;state.version++;
 await updateBoth(host,guest);
}
async function fit(page,label){
 for(const width of [375,390,430]){
  await page.setViewportSize({width,height:844});
  const overflow=await page.evaluate(()=>({
   viewport:document.documentElement.clientWidth,
   content:document.documentElement.scrollWidth
  }));
  assert.ok(overflow.content<=overflow.viewport+2,
   label+' '+width+'px : débordement '+JSON.stringify(overflow));
 }
 await page.setViewportSize({width:390,height:844});
}
const dest='opfc-mobile-captures';
await mkdir(dest,{recursive:true});
const browser=await chromium.launch({
 executablePath:process.env.CHROME_BINARY??'/usr/bin/chromium',
 headless:true,args:['--no-sandbox','--disable-dev-shm-usage']
});
const contexts=[],errors=[];
try{
 for(let i=0;i<2;i++){
  const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,
   isMobile:true,hasTouch:true});
  contexts.push(ctx);
  await ctx.route('**/opfc/online-config.mjs',route=>route.fulfill({
   status:200,contentType:'text/javascript',
   body:"export const OPFC_ONLINE_API_URL='"+API+"';\n"+
    "export const OPFC_ONLINE_PUBLISHABLE_KEY='';\n"
  }));
  await ctx.route(API,route=>{
   if(route.request().method()==='OPTIONS'){
    return route.fulfill({status:204,headers:{
     'Access-Control-Allow-Origin':'*',
     'Access-Control-Allow-Methods':'POST,OPTIONS',
     'Access-Control-Allow-Headers':'Content-Type,Cache-Control,apikey'
    }});
   }
   return route.fulfill(handle(route.request().postDataJSON()));
  });
 }
 const host=await contexts[0].newPage(),guest=await contexts[1].newPage();
 for(const p of [host,guest]){
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto(BASE,{waitUntil:'domcontentloaded'});
  await p.locator('[data-action="online"]').click();
 }
 await host.locator('[data-action="online-create-screen"]').click();
 await host.locator('[data-action="online-create"]').click();
 await host.locator('.online-room-code').waitFor();
 assert.match(await host.locator('.online-room-code').textContent(),/ABCD23/);
 await guest.locator('[data-action="online-join-screen"]').click();
 await guest.locator('#opfc-room-code').fill('ABCD23');
 await guest.locator('[data-action="online-join"]').click();
 await updateBoth(host,guest);
 assert.equal(await host.locator('.online-game-content').count(),1);
 assert.equal(await guest.locator('.online-game-content').count(),1);
 assert.equal(state.joined,true);
 assert.equal(await host.locator('.online-market').count(),1);
 assert.equal(await guest.locator('.online-market').count(),1);
 const attacker=state.game.auction.turn==='PSG'?host:guest;
 const defender=attacker===host?guest:host;
 assert.ok(await attacker.locator('[data-action="online-bid"]').count()>=1);
 assert.equal(await defender.locator('[data-action="online-bid"]').count(),0);
 await attacker.locator('[data-action="online-bid"]').first().click();
 assert.ok(state.game.auction.highestBid>=5);
 await refresh(defender);
 assert.match(await defender.locator('.bid-amount').textContent(),/5 000 000|6 000 000/);
 await fit(attacker,'mercato réseau');
 await attacker.locator('.online-market').screenshot({
  path:dest+'/16a-en-ligne-encheres.png',animations:'disabled'});
 console.log('PASS OPFC online 2 iPhone : salon, enchère serveur, budget et propriété du tour');

 let lineup=completedReady();lineup.phase='lineup';
 lineup.teams.forEach(t=>{t.slots=Array(7).fill(null);t.ready=false;});
 await replaceServer(lineup,host,guest);
 assert.equal(await host.locator('.online-team-overview').count(),1);
 assert.equal(await guest.locator('.online-team-overview').count(),1);
 assert.equal(await guest.locator('select[data-action="formation"][data-club="PSG"]').isDisabled(),true);
 assert.equal(await host.locator('select[data-action="formation"][data-club="OM"]').isDisabled(),true);
 await host.locator('[data-action="pick"][data-club="PSG"][data-card="luffy"]').click();
 await host.locator('[data-action="slot"][data-club="PSG"][data-slot="5"]').click();
 assert.equal(state.game.teams.find(t=>t.club==='PSG').slots[5],'luffy');
 await refresh(guest);
 assert.equal(await guest.locator('.pitch-player[data-club="PSG"][data-slot="5"] img').count(),1);
 await fit(host,'compositions réseau');
 await host.locator('.online-team-overview').screenshot({
  path:dest+'/16b-en-ligne-terrain.png',animations:'disabled'});
 console.log('PASS OPFC online 2 iPhone : placement d’un joueur, composition vue par adversaire');

 const match=matchType('open');
 await replaceServer(match,host,guest);
 const a=match.match.schedule[0].attacker==='PSG'?host:guest;
 const d=a===host?guest:host;
 await a.locator('[data-type="begin-open"]').click();
 await refresh(d);
 assert.equal(await a.locator('[data-action="online-choice"][data-choice="COMBINER"]').count(),1);
 assert.equal(await d.locator('[data-action="online-choice"]').count(),0);
 await a.locator('[data-action="online-choice"][data-choice="COMBINER"]').click();
 await refresh(d);
 assert.equal(await d.locator('[data-action="online-choice"][data-choice="PRESSER"]').count(),1);
 assert.doesNotMatch(await d.locator('.online-game-content').textContent(),/Combiner/);
 await d.locator('[data-action="online-choice"][data-choice="CONTENIR"]').click();
 await refresh(a);
 assert.equal(await a.locator('[data-type="reveal-duel"]').count(),1);
 await fit(a,'duel réseau');
 await a.locator('.online-match-stage').screenshot({
  path:dest+'/16c-en-ligne-duel.png',animations:'disabled'});
 console.log('PASS OPFC online 2 iPhone : choix secrets et adversaire bloqué avant révélation');

 const corner=matchType('corner');
 const {beginSetPieceAction,selectSetPieceTaker}=await import('../set-piece-actions.mjs');
 let setPiece=beginSetPieceAction(corner);
 setPiece=selectSetPieceTaker(setPiece,setPiece.match.action.attacker,
  setPiece.teams.find(t=>t.club===setPiece.match.action.attacker).slots[5],()=>.25);
 await replaceServer(setPiece,host,guest);
 const c=setPiece.match.action.attacker==='PSG'?host:guest;
 assert.equal(await c.locator('.receiver-card').count(),1);
 assert.equal(await c.locator('[data-type="choose"]').count(),3);
 assert.equal(await c.locator('.receiver-card .receiver-portrait img').count(),1);
 await fit(c,'corner réseau');
 await c.locator('.match-stage').first().screenshot({
  path:dest+'/16d-en-ligne-corner.png',animations:'disabled'});
 console.log('PASS OPFC online 2 iPhone : réceptionneur compact et choix d’un corner');

 await replaceServer(shootoutReady(),host,guest);
 assert.equal(await host.locator('[data-type="begin-shootout"]').count(),1);
 assert.equal(await guest.locator('[data-type="begin-shootout"]').count(),0);
 await host.locator('[data-type="begin-shootout"]').click();
 await refresh(guest);
 const first=state.game.match.shootout.nextClub==='PSG'?host:guest;
 const other=first===host?guest:host;
 assert.equal(await first.locator('[data-action="online-choice"][data-shootout="true"]').count(),3);
 assert.equal(await other.locator('[data-action="online-choice"][data-shootout="true"]').count(),0);
 await first.locator('[data-action="online-choice"][data-choice="GAUCHE"]').click();
 await refresh(other);
 assert.equal(await other.locator('[data-action="online-choice"][data-shootout="true"]').count(),3);
 assert.doesNotMatch(await other.locator('.online-game-content').textContent(),/shotDirection|keeperDirection/);
 await other.locator('[data-action="online-choice"][data-choice="DROITE"]').click();
 await refresh(first);
 await first.locator('[data-type="shootout-reveal"]').click();
 assert.equal(state.game.match.shootout.timeline.length,1);
 await first.locator('.shootout-mark--goal').first().waitFor({state:'visible'});
 assert.equal(await first.locator('.shootout-mark--goal').count(),1);
 await first.locator('[data-type="shootout-continue"]').click();
 await first.locator('[data-type="shootout-continue"]').waitFor({state:'detached'});
 await fit(first,'TAB réseau');
 await first.locator('.shootout-tracker').screenshot({
  path:dest+'/16e-en-ligne-tab.png',animations:'disabled'});
 // Continuer uniquement avec le moteur officiel et afficher une vraie victoire
 for(let i=1;i<12;i++){
  const s=state.game,sh=s.match.shootout;
  const next=nextShootoutShooter(sh);
  state.game=advanceShootout(s,{club:next.club,shooterId:next.cardId,
   shotDirection:'GAUCHE',keeperDirection:'DROITE',draw:i===10?0:.999999});
  state.game.match.shootoutLastResult=state.game.match.shootout.timeline.at(-1);
  if(i<11)state.game.match.shootoutLastResult=null;
 }
 state.version++;
 await updateBoth(host,guest);
 assert.equal(state.game.phase,'finished');
 assert.deepEqual(
  Object.values(state.game.match.shootout.score).sort((a,b)=>a-b),
  [5,6],
  'La séance doit finir avec un score 6–5, quel que soit le premier tireur'
 );
 assert.equal(state.game.match.winner,
  state.game.match.shootout.score.PSG>state.game.match.shootout.score.OM?'PSG':'OM');
 const winner=state.game.match.winner==='PSG'?host:guest;
 assert.equal(await winner.locator('[data-type="shootout-continue"]').count(),1);
 await winner.locator('[data-type="shootout-continue"]').click();
 await refresh(winner===host?guest:host);
 assert.equal(await winner.locator('.final-screen').count(),1);
 assert.equal(await winner.locator('.final-penalty-score').count(),1);
 await fit(winner,'finale réseau');
 await winner.locator('.final-score').screenshot({
  path:dest+'/16f-en-ligne-victoire.png',animations:'disabled'});
 assert.deepEqual(errors,[],'Erreurs JavaScript sur les deux iPhone');
 console.log('PASS OPFC online 2 iPhone : tirs secrets, mort subite, finale, reconnection et secret');
}finally{
 for(const ctx of contexts)await ctx.close();
 await browser.close();
}
