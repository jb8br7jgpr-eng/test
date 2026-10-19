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
 assert.equal(await page.locator('link[href="./opfc/ui-classic-auction.css"]').count(),1);
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
  return {photo:rect('.portrait-shell-photo'),identity:rect('.player-identity'),
   rating:rect('.player-rating-row'),centerRating:rect('.player-rating'),
   badge:rect('.player-position'),tierBadge:rect('.player-tier'),
   grid:rect('.stats-grid'),stats,colors,
   position:card.querySelector('.player-position')?.textContent,
   tier:card.querySelector('.player-tier')?.textContent};
 });
 assert.ok(playerCardLayout.photo&&playerCardLayout.identity&&playerCardLayout.rating&&playerCardLayout.grid);
 assert.ok(playerCardLayout.badge&&playerCardLayout.tierBadge);
 assert.ok(Math.abs(playerCardLayout.badge.top-playerCardLayout.rating.top)<35 &&
  Math.abs(playerCardLayout.tierBadge.top-playerCardLayout.rating.top)<35,
  'Poste et rang doivent encadrer la note globale');
 assert.ok(playerCardLayout.badge.left<playerCardLayout.centerRating.left &&
  playerCardLayout.tierBadge.left>playerCardLayout.centerRating.left,
  'Le poste doit être à gauche de la note et le rang à droite');
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
 // La version compacte conserve les six statistiques et réduit le portrait du mercato.
 assert.ok(playerCardLayout.photo.width<=190,'Portrait du mercato trop grand');
 await checkMobileLayout('mercato');
 assert.equal(await page.locator('.slot-field').count(),0,'Terrain masqué initialement');
 assert.equal(await page.locator('.opfc-auction .offer-btn').count(),4);
 assert.match(await page.locator('.opfc-auction .refusal-counter').textContent(),/Refus utilisés : 0\/5.*Restants : 5\/5/);
 assert.equal(await page.locator('.opfc-auction .auction-hakis .extra-power').count(),1);
 assert.equal(await page.locator('.opfc-auction .haki-btn').count(),1);
 assert.match(await page.locator('.opfc-auction .haki-btn').innerText(),/👑 Haki des Rois/);
 assert.match(await page.locator('.opfc-auction .extra-power').innerText(),/👁 Observation/);
 assert.equal(await page.locator('.opfc-auction .custom-bid').count(),1);
 assert.equal(await page.locator('.opfc-auction .auction-hakis').count(),1);
 const display=await page.locator('.opfc-auction').evaluate(panel=>{
  const box=selector=>{const e=panel.querySelector(selector),r=e?.getBoundingClientRect();return r?{top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height}:null;};
  return {custom:box('.custom-bid'),refusal:box('.pass-btn'),hakiRow:box('.auction-hakis'),
   kings:box('.haki-btn'),observation:box('.extra-power'),
   budget:panel.querySelector('.turn-budget')?.textContent,
   prices:[...panel.querySelectorAll('.offer-btn b')].map(el=>el.textContent),
   starting:panel.querySelector('.bid-leader strong')?.textContent,
   input:panel.querySelector('#bid-value')?.value,
   label:panel.querySelector('.custom-bid label')?.textContent,
   columns:getComputedStyle(panel.querySelector('.auction-hakis')).gridTemplateColumns};
 });
 assert.deepEqual(display.prices,['5 000 000 ฿','6 000 000 ฿','10 000 000 ฿','15 000 000 ฿']);
 assert.match(display.budget,/250 000 000 ฿/);
 assert.equal(display.starting,'5 000 000 ฿');
 assert.equal(display.input,'5000000');
 assert.equal(display.label,'Autre montant (฿)');
 assert.ok(display.custom.bottom<=display.refusal.top,'Le refus doit suivre immédiatement la saisie');
 assert.ok(display.refusal.bottom<=display.hakiRow.top,'La rangée Haki doit suivre le refus');
 assert.ok(Math.abs(display.refusal.width-display.hakiRow.width)<2,'Le refus doit couvrir toute la largeur');
 assert.ok(display.kings.right<=display.observation.left+2,'Rois à gauche, Observation à droite');
 assert.ok(Math.abs(display.kings.width-display.observation.width)<2,'Les deux Hakis doivent faire 50 %');
 assert.ok(Math.abs(display.kings.top-display.observation.top)<2);
 for(const width of [375,390,430]){
  await page.setViewportSize({width,height:844});
  const refusal=await page.locator('.opfc-auction .pass-btn').evaluate(el=>{
   const r=el.getBoundingClientRect();
   return {scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,
    scrollHeight:el.scrollHeight,clientHeight:el.clientHeight,
    buttonHeight:r.height,lineHeight:getComputedStyle(el).lineHeight,
    name:getComputedStyle(el).whiteSpace};
  });
  assert.ok(refusal.scrollWidth<=refusal.clientWidth+1,'Le libellé de refus déborde : '+JSON.stringify({width,...refusal}));
  assert.equal(refusal.name,'nowrap','Le bouton refus doit rester sur une seule ligne');
 }
 await page.setViewportSize({width:390,height:844});
 assert.equal((await page.locator('.turn-banner strong').first().textContent()).trim().length<=3,true);
 console.log('PASS modèle utilisateur : montants complets, refus pleine largeur et Hakis 50/50');
 await take('01-mercato');
 // Pour cette capture seulement, retirer temporairement le positionnement sticky du HUD
 // qui recouvrirait le titre lorsqu'on capture un élément plus bas dans la page.
 await page.locator('.huds').evaluate(el=>{el.style.position='static';});
 await page.locator('.opfc-auction').screenshot({path:shots+'/01b-encheres-classiques.png',animations:'disabled'});
 await page.locator('.huds').evaluate(el=>{el.style.position='';});
 assert.equal(await page.locator('.opfc-auction .notice').evaluate(el=>getComputedStyle(el).borderTopStyle),'none',
  'La notice doit être sans encadré, comme dans OPMercato classique');
 // Comparaison CSS avec les éléments d'origine du véritable OPMercato classique.
 // Le HTML original est chargé sur une page séparée, sans modifier ses sources.
 const classicPage=await context.newPage();
 try{
  await classicPage.goto(origin+'/classique.html',{waitUntil:'domcontentloaded'});
  await classicPage.evaluate(()=>{
   const probe=document.createElement('section');
   probe.id='opfc-compare-classic';
   probe.className='card auction';
   probe.innerHTML='<div class="bid-title"><div><span class="kicker">Meilleure offre</span>'+
    '<strong class="bid-amount">5 M</strong></div><div class="bid-leader">En tête : <strong>PSG</strong></div></div>'+
    '<div class="turn-banner"><div><span>AU TOUR DE</span><strong>PSG</strong></div>'+
    '<div class="turn-budget">250 M<span>disponibles</span></div></div>'+
    '<div class="offers"><button class="offer-btn"><b>5 M</b><small>Offre minimale</small></button></div>'+
    '<div class="custom-bid"><label>Autre montant</label><div><input placeholder="5">'+
    '<button class="btn-ghost">Enchérir</button></div></div>'+
    '<button class="haki-btn">👑 Haki des Rois<small>Une seule fois</small></button>'+
    '<div class="extra-powers"><button class="extra-power">👁 Observation</button></div>'+
    '<button class="pass-btn">Refuser ce personnage</button>';
   document.body.append(probe);
  });
  const selectors={
   title:'.bid-title',kicker:'.bid-title .kicker',amount:'.bid-amount',
   leader:'.bid-leader',turn:'.turn-banner',bidder:'.turn-banner strong',
   offers:'.offers',offer:'.offer-btn',offerAmount:'.offer-btn b',
   offerHint:'.offer-btn small',custom:'.custom-bid',customLabel:'.custom-bid label',
   customButton:'.custom-bid button',king:'.haki-btn',observation:'.extra-power',
   refusal:'.pass-btn'
  };
  const props=['display','color','backgroundColor','backgroundImage','borderRadius',
   'borderTopColor','paddingTop','paddingLeft','paddingBottom','fontFamily',
   'fontSize','fontWeight','letterSpacing','minHeight','marginTop','gap'];
  const read=async(tab,root)=>tab.evaluate(({root,selectors,props})=>{
   const scope=document.querySelector(root);if(!scope)throw Error('Enchère de comparaison absente : '+root);
   const out={};
   for(const [name,selector] of Object.entries(selectors)){
    const element=scope.querySelector(selector);
    if(!element)throw Error('Élément de comparaison absent '+selector);
    const style=getComputedStyle(element);
    out[name]=Object.fromEntries(props.map(prop=>[prop,style[prop]]));
   }
   return out;
  },{root,selectors,props});
  const reference=await read(classicPage,'#opfc-compare-classic');
  const current=await read(page,'.opfc-auction');
  const keys={
   title:['display','paddingBottom','fontFamily'],
   kicker:['fontSize','fontWeight','color','letterSpacing'],
   amount:['fontSize','fontWeight','color','letterSpacing'],
   turn:['backgroundColor','borderRadius','paddingTop','marginTop'],
   offer:['backgroundColor','borderRadius','paddingTop','minHeight'],
   offerAmount:['fontSize','fontWeight','color'],
   offerHint:['fontSize','fontWeight','color'],
   customLabel:['fontSize','fontWeight','color'],
   king:['fontSize','fontWeight','backgroundImage','borderRadius'],
   observation:['fontSize','fontWeight','backgroundImage','borderRadius'],
   // Taille du refus adaptée volontairement pour tenir sur UNE ligne sur iPhone.
   refusal:['fontWeight','backgroundColor','borderRadius','minHeight']
  };
  const differences=[];
  for(const [name,fields] of Object.entries(keys)){
   for(const field of fields){
    if(reference[name][field]!==current[name][field]){
     differences.push({name,field,classic:reference[name][field],opfc:current[name][field]});
    }
   }
  }
  assert.deepEqual(differences,[], 'OPFC ne respecte pas les styles exacts d’OPMercato classique');
  console.log('PASS enchères : '+Object.values(keys).reduce((n,fields)=>n+fields.length,0)+
    ' propriétés CSS identiques à OPMercato classique');
 }finally{await classicPage.close();}

 // Ouverture facultative des équipes : le club concerné est orienté vers le haut.
 await press('toggle-teams');
 const initialClub=(await game()).auction.turn;
 assert.equal(await page.locator('.slot-field').getAttribute('data-top-club'),initialClub);
 await checkMobileLayout('équipes ouvertes');
 await press('toggle-teams');
 assert.equal(await page.locator('.slot-field').count(),0);

 // Véritable enchère jusqu'à l'écran de vente avec portrait.
 await press('bid-quick');
 await press('bid-quick');
 await press('pass');
 await page.locator('.sale-result-portrait img').waitFor();
 await page.locator('.sale-result-portrait img').evaluate(img=>img.decode());
 await checkMobileLayout('vente');
 await take('02-recrue');

 // Continue la vraie partie locale avec les commandes de l'interface.
 await press('close');
 const placeCurrent=async()=>{
  if(await page.locator('.placement-intro').count()===0)return false;
  const s=await game(),club=s.lastResult?.winner;
  assert.ok(club,'Une fenêtre de placement nécessite une recrue gagnée');
  assert.equal(await page.locator('.slot-field').getAttribute('data-top-club'),club);
  assert.equal(await page.locator('.slot-field-single .field-half').count(),1,'Une seule moitié doit apparaître');
  assert.equal(await page.locator('.slot-field-single .field-label').count(),1);
  assert.equal(await page.locator('.team-panel').count(),2,'Les deux listes restent visibles');
  assert.ok(await page.locator('.placement-metadata .roster-position').count()===1);
  assert.ok(await page.locator('.placement-metadata .roster-rating').count()===1);
  assert.ok(await page.locator('.placement-metadata .roster-tier').count()===1);
  const recruited=page.locator('.team-panel .team-chip[data-card="'+s.lastResult.cardId+'"]');
  assert.ok(await recruited.locator('.chip-portrait img').count()===1);
  assert.ok(await recruited.locator('.roster-position').count()===1);
  assert.ok(await recruited.locator('.roster-rating').count()===1);
  assert.ok(await recruited.locator('.roster-tier').count()===1);
  const t=s.teams.find(t=>t.club===club);
  const free=t.slots.indexOf(null);
  assert.ok(free>=0,'Une case doit être disponible pour la recrue');
  assert.ok(await page.locator('[data-action="continue-placement"]').isDisabled(),
   'La reprise doit être bloquée tant que la recrue n’est pas placée');
  await press('slot','[data-club="'+club+'"][data-slot="'+free+'"]');
  const updated=await game();
  assert.equal(updated.teams.find(team=>team.club===club).slots[free],s.lastResult.cardId);
  assert.ok(await page.locator('[data-action="continue-placement"]').isEnabled());
  await press('continue-placement');
  return true;
 };
 await checkMobileLayout('placement');
 await take('03-placement');
 // Une fermeture/reprise Safari ne doit pas faire perdre le placement de recrue.
 const recruiter=(await game()).lastResult.winner;
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('.placement-intro').waitFor();
 assert.equal(await page.locator('.slot-field').getAttribute('data-top-club'),recruiter);
 assert.ok(await placeCurrent(),'Le placement doit reprendre après rechargement');
 // Tester explicitement l'autre club : PSG et OM doivent chacun voir uniquement LEUR moitié.
 const otherRecruiter=recruiter==='PSG'?'OM':'PSG';
 const secondStarter=(await game()).auction.turn;
 await press('bid-quick');
 if(secondStarter!==otherRecruiter)await press('bid-quick');
 await press('pass');
 assert.equal((await game()).lastResult.winner,otherRecruiter,'Le second recrutement doit être gagné par l’autre club');
 await press('close');
 assert.equal(await page.locator('.slot-field').getAttribute('data-top-club'),otherRecruiter);
 assert.equal(await page.locator('.slot-field-single .field-half').count(),1);
 await checkMobileLayout('placement de '+otherRecruiter);
 await take('03b-placement-autre-club');
 assert.ok(await placeCurrent(),'Le second club doit aussi pouvoir placer sa recrue');
 for(let iteration=0;await phase()==='mercato';iteration++){
  assert.ok(iteration<130,'Le mercato reste bloqué');
  const s=await game();
  if(s.auction.solo)await press('solo');
  else if(s.auction.highestBid<6)await press('bid-quick');
  else await press('pass');
  if(await page.locator('.modal [data-action="close"]').count())await press('close');
  await placeCurrent();
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
 await take('04-terrain');
 await press('ready','[data-club="PSG"]');
 await press('ready','[data-club="OM"]');
 assert.equal(await phase(),'kickoff-ready');
 const prepared=await page.evaluate(k=>localStorage.getItem(k),key);
 await take('05-avant-match');

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
 await take('06-duel');

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
 await take('07-resultat-final');

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
