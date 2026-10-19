/**
 * Contrôle visuel réel du mode local OPFC sur Chromium mobile.
 * À lancer dans GitHub Actions après installation de playwright-core et Chrome.
 * Aucun déploiement, aucune connexion Supabase, aucune mutation distante.
 */
import {chromium} from 'playwright-core';
import {mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';

const origin='http://127.0.0.1:8765';
const key='opfc-v08-local-dev';
const shots='opfc-mobile-captures';
mkdirSync(shots,{recursive:true});
const browser=await chromium.launch({
 executablePath:process.env.CHROME_BINARY,
 headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage']
});
const context=await browser.newContext({
 viewport:{width:390,height:844},
 deviceScaleFactor:2,
 isMobile:true,
 hasTouch:true
});
const page=await context.newPage();
const errors=[],badImages=[];
page.on('pageerror',e=>errors.push(e.stack||e.message));
page.on('response',r=>{
 if(r.url().includes('/portraits_opfc/')&&!r.ok()&&r.status()!==304)badImages.push(r.url()+' '+r.status());
});
const take=async(name)=>{
 await page.evaluate(()=>scrollTo(0,0));
 await page.screenshot({path:shots+'/'+name+'.png',fullPage:true,animations:'disabled'});
 console.log('CAPTURE '+name);
};
const game=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'{}').game,key);
const phase=async()=> (await game())?.phase;
async function checkMobileLayout(label){
 for(const width of [375,390,430]){
  await page.setViewportSize({width,height:844});
  const result=await page.evaluate(()=>({
   width:innerWidth,
   pageWidth:document.documentElement.scrollWidth,
   viewportWidth:document.documentElement.clientWidth
  }));
  assert.ok(result.pageWidth<=result.viewportWidth+1,
   'Débordement horizontal '+label+': '+JSON.stringify(result));
 }
 await page.setViewportSize({width:390,height:844});
}
const press=async (action,extra='')=>page.locator('[data-action="'+action+'"]'+extra).first().click();
try{
 await page.goto(origin+'/opfc.html',{waitUntil:'domcontentloaded'});
 await page.locator('[data-action="start"]').waitFor();
 await page.evaluate(()=>localStorage.clear());
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('[data-action="start"]').waitFor();

 // Vérifie que les 50 vrais WebP peuvent être décodés par le navigateur.
 const images=await page.evaluate(async()=>{
  const {CARDS}=await import('/opfc/catalog.mjs');
  const {portraitFile}=await import('/opfc/ui-portraits.mjs');
  return Promise.all(CARDS.map(async card=>{
   const path=portraitFile(card.id);
   const image=new Image();image.src=path;
   try{await image.decode();return {id:card.id,path,ok:true,width:image.naturalWidth,height:image.naturalHeight};}
   catch(e){return {id:card.id,path,ok:false,error:String(e)};}
  }));
 });
 assert.equal(images.length,50);
 assert.ok(images.every(x=>x.ok&&x.width>0&&x.height>0),
   'Portraits impossibles à décoder : '+JSON.stringify(images.filter(x=>!x.ok)));
 assert.equal(new Set(images.map(x=>x.path)).size,50);
 console.log('PASS 50 portraits WebP décodés dans Chrome mobile');

 await press('start');
 await page.locator('.modal [data-action="close"]').waitFor();
 await press('close');
 await page.locator('.portrait-card img').first().evaluate(img=>img.decode());
 assert.ok(await page.locator('.portrait-card img').count()>0);
 const playerCardLayout=await page.locator('.opfc-player-card').first().evaluate(card=>{
  const rect=selector=>{const r=card.querySelector(selector)?.getBoundingClientRect();return r?{top:r.top,left:r.left,width:r.width,height:r.height}:null;};
  const stats=[...card.querySelectorAll('.opfc-stat')].map(el=>{
   const r=el.getBoundingClientRect();return {top:r.top,left:r.left,grade:el.querySelector('strong')?.className};
  });
  const colors=['elite','high','medium','low','weak'].map(level=>{
   const element=document.createElement('strong');
   element.className='opfc-stat-value stat-'+level;
   card.appendChild(element);
   const color=getComputedStyle(element).backgroundColor;
   element.remove();return color;
  });
  return {photo:rect('.portrait-shell-photo'),identity:rect('.player-identity-row'),
   rating:rect('.player-rating'),grid:rect('.stats-grid'),stats,colors,
   position:card.querySelector('.player-position')?.textContent,
   tier:card.querySelector('.player-tier')?.textContent};
 });
 assert.ok(playerCardLayout.photo&&playerCardLayout.identity&&playerCardLayout.rating&&playerCardLayout.grid);
 assert.ok(playerCardLayout.photo.top<playerCardLayout.identity.top&&
  playerCardLayout.identity.top<playerCardLayout.rating.top&&
  playerCardLayout.rating.top<playerCardLayout.grid.top,
  'L’ordre des blocs de la carte est incorrect : '+JSON.stringify(playerCardLayout));
 assert.equal(playerCardLayout.stats.length,6);
 assert.ok(Math.abs(playerCardLayout.stats[0].top-playerCardLayout.stats[2].top)<2);
 assert.ok(playerCardLayout.stats[3].top>playerCardLayout.stats[0].top+10);
 assert.equal(new Set(playerCardLayout.colors).size,5,'Les cinq couleurs de statistiques doivent être distinctes');
 assert.ok(['GAR','DEF','MIL','ATT'].includes(playerCardLayout.position));
 assert.ok(['DIAMANT','OR','ARGENT','BRONZE'].includes(playerCardLayout.tier));
 await checkMobileLayout('mercato');
 await take('01-mercato');

 // Véritable enchère jusqu'à l'écran de vente avec portrait.
 await press('bid');
 await press('bid');
 await press('pass');
 await page.locator('.sale-result-portrait img').waitFor();
 await page.locator('.sale-result-portrait img').evaluate(img=>img.decode());
 await checkMobileLayout('vente');
 await take('02-recrue');

 // Continue la vraie partie locale avec les commandes de l'interface.
 await press('close');
 for(let iteration=0;await phase()==='mercato';iteration++){
  assert.ok(iteration<130,'Le mercato reste bloqué');
  const s=await game();
  if(s.auction.solo)await press('solo');
  else if(s.auction.highestBid<6)await press('bid');
  else await press('pass');
  if(await page.locator('.modal [data-action="close"]').count())await press('close');
 }
 assert.equal(await phase(),'lineup');
 let s=await game();
 for(const team of s.teams){
  for(let slot=0;slot<7;slot++){
   const id=team.roster[slot],club=team.club;
   await press('pick','[data-club="'+club+'"][data-card="'+id+'"]');
   await press('slot','[data-club="'+club+'"][data-slot="'+slot+'"]');
  }
 }
 assert.equal(await page.locator('.pitch-player .character-portrait img').count(),14);
 await checkMobileLayout('terrain');
 await take('03-terrain');
 await press('ready','[data-club="PSG"]');
 await press('ready','[data-club="OM"]');
 assert.equal(await phase(),'kickoff-ready');
 const prepared=await page.evaluate(k=>localStorage.getItem(k),key);
 await take('04-avant-match');

 // Construit un duel réel avec les mêmes fonctions que le jeu,
 // sauvegarde cet état puis teste son affichage après rechargement.
 const duelState=await page.evaluate(async({key,prepared})=>{
  const {kickoffMatch}=await import('/opfc/match.mjs');
  const {beginOpenPlayAction,lockOpenPlayChoice}=await import('/opfc/match-actions.mjs');
  const random=seed=>()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);
  const original=JSON.parse(prepared);let s=null;
  for(let seed=1;seed<=100;seed++){
   const next=kickoffMatch(original.game,random(seed));
   if(next.match.schedule[0].type==='open'){s=next;break;}
  }
  if(!s)throw Error('Aucun match ne commence par un duel');
  s=beginOpenPlayAction(s,()=>.4);
  s=lockOpenPlayChoice(s,s.match.action.attacker,'COMBINER');
  s=lockOpenPlayChoice(s,s.match.action.defender,'PRESSER');
  original.game=s;
  localStorage.setItem(key,JSON.stringify(original));
  return s.match.action.stage;
 },{key,prepared});
 assert.equal(duelState,'duel-ready');
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('.match-faceoff').waitFor();
 assert.equal(await page.locator('.match-faceoff img').count(),2);
 await checkMobileLayout('duel');
 await take('05-duel');

 // Parcourt la simulation moteur en conditions identiques aux tests unitaires.
 const result=await page.evaluate(async({key,prepared})=>{
  const {kickoffMatch,resolveMatchMoment,continueMatch,resumeMatch}=await import('/opfc/match.mjs');
  const {ready}=await import('/opfc/engine.mjs');
  const random=seed=>()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);
  const saved=JSON.parse(prepared);let s=kickoffMatch(saved.game,random(12));
  for(let n=0;s.phase!=='finished';n++){
   if(n>45)throw Error('Match complet bloqué');
   if(s.phase==='half-time'){s=ready(ready(s,'PSG'),'OM');s=resumeMatch(s);continue;}
   if(s.phase==='moment-result'){s=continueMatch(s);continue;}
   if(s.phase!=='match')throw Error('Phase imprévue '+s.phase);
   const club=s.match.schedule[s.match.index].attacker;
   s=resolveMatchMoment(s,{outcome:club==='PSG'?'goal':'stopped',
    scorerId:club==='PSG'?s.teams.find(t=>t.club==='PSG').slots[5]:null});
  }
  saved.game=s;localStorage.setItem(key,JSON.stringify(saved));
  return {score:s.match.score,winner:s.match.winner};
 },{key,prepared});
 assert.equal(result.winner,'PSG');
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('.final-screen').waitFor();
 assert.ok(await page.locator('.final-goal .character-portrait img').count()>=1);
 await checkMobileLayout('résultat final');
 await take('06-resultat-final');

 assert.deepEqual(errors,[],'Erreur JavaScript du navigateur');
 assert.deepEqual(badImages,[],'Images WebP introuvables');
 console.log('PASS parcours écran iPhone (390/375/430), images, composition, duel, résultat');
} catch(e){
 console.error(e);
 try{await page.screenshot({path:shots+'/ERREUR.png',fullPage:true});}catch{}
 process.exitCode=1;
} finally {
 await browser.close();
}
