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
   assert.equal(await page.locator('.slot-field-single .pitch-goal-bottom').evaluate(el=>getComputedStyle(el).display),'none',
    'Le demi-terrain ne doit pas montrer un deuxième but');
   assert.equal(await page.locator('.slot-field-single .pitch-penalty-bottom').evaluate(el=>getComputedStyle(el).display),'none',
    'Le demi-terrain ne doit pas montrer une surface adverse');
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
 // Valider une formation réelle avec trois joueurs côte à côte.
 await page.locator('.team-panel select[data-club="PSG"]').selectOption('3-2-1');
 let s=await game();
 assert.equal(s.teams.find(t=>t.club==='PSG').formation,'3-2-1');
 for(const team of s.teams){
  for(let slot=0;slot<7;slot++){
   const id=team.roster[slot],club=team.club;
   await press('pick','[data-club="'+club+'"][data-card="'+id+'"]');
   await press('slot','[data-club="'+club+'"][data-slot="'+slot+'"]');
  }
 }
 assert.equal(await page.locator('.pitch-player .character-portrait img').count(),14);
 // Mettre le PSG en haut : l'équipe affichée en premier dépend de la dernière sélection.
 await press('pitch-view','[data-club="PSG"]');
 assert.equal(await page.locator('.slot-field').getAttribute('data-top-club'),'PSG');
 const trio=page.locator('.field-half-top .pitch-row-def .pitch-player');
 assert.equal(await trio.count(),3,'Trois défenseurs doivent se tenir sur la même ligne');
 const rectangles=await trio.evaluateAll(elements=>elements.map(el=>{
  const r=el.getBoundingClientRect();
  return {left:r.left,right:r.right,top:r.top,width:r.width};
 }));
 assert.ok(rectangles.every(r=>r.width<=76),'Pions trop larges');
 for(let i=1;i<rectangles.length;i++){
  assert.ok(rectangles[i-1].right<=rectangles[i].left+1,'Pions superposés');
  assert.ok(Math.abs(rectangles[i].top-rectangles[0].top)<2,'Pions mal alignés');
 }
 assert.equal(await page.locator('.slot-field-full .pitch-goal').count(),2);
 assert.equal(await page.locator('.slot-field-full .pitch-penalty-area').count(),2);
 assert.equal(await page.locator('.slot-field-full .pitch-center-circle').count(),1);
 await checkMobileLayout('terrain avec trois défenseurs');
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
 assert.equal(await page.locator('.match-team-overview .slot-field').count(),1);
 assert.equal(await page.locator('.match-team-overview .field-half').count(),2);
 assert.equal(await page.locator('.match-team-overview .team-panel').count(),2);
 assert.equal(await page.locator('.match-team-overview .team-chip').count(),14);
 assert.equal(await page.locator('.match-team-overview .pitch-player img').count(),14);
 assert.equal(await page.locator('.match-faceoff .match-duelist-rating').count(),2);
 assert.equal(await page.locator('.match-faceoff .match-duelist-position').count(),2);
 assert.equal(await page.locator('.match-attack-banner').count(),1);
 assert.equal(await page.locator('.match-action-type.type-bonne').count(),1);
 const displayClub=await page.locator('.match-attack-banner').getAttribute('aria-label');
 assert.equal(displayClub,'Équipe attaquante : '+(await game()).match.action.attacker);
 const matchType=await page.locator('.match-action-type').evaluate(el=>({
  text:el.textContent,
  borderColor:getComputedStyle(el).borderTopColor
 }));
 assert.match(matchType.text,/BONNE OCCASION/);
 assert.equal(await page.locator('.match-team-overview .pitch-player[data-action="inspect-player"]').count(),14);
 const savedTeams=(await game()).teams;
 await press('inspect-player','.pitch-player');
 assert.equal(await page.locator('.modal .detail-grid').count(),1,'Toucher un pion doit ouvrir la fiche');
 assert.deepEqual((await game()).teams,savedTeams,'Ouvrir la fiche ne doit pas modifier les joueurs');
 await press('close');
 for(const panel of await page.locator('.match-team-overview .team-panel').all()){
  const displayed=await panel.locator('.team-chip').evaluateAll(buttons=>buttons.map(button=>({
   cardId:button.dataset.card,
   position:button.querySelector('.roster-position')?.textContent?.trim(),
   rating:button.querySelector('.roster-rating')?.textContent?.trim(),
   outOfPosition:!!button.querySelector('.roster-warning')
  })));
  const club=await panel.locator('.team-chip').first().getAttribute('data-club');
  const team=(await game()).teams.find(t=>t.club===club);
  const expected=await page.evaluate(async team=>{
   const {uiRoster}=await import('/opfc/ui-model.mjs');
   return uiRoster(team).map(p=>({
    cardId:p.cardId,position:p.position??'À placer',rating:String(p.rating??'—'),
    outOfPosition:p.outOfPosition
   }));
  },team);
  assert.deepEqual(displayed,expected,
   'Postes et notes doivent correspondre à la vraie composition, pas aux postes de base');
 }
 await press('inspect-player','.team-chip');
 assert.equal(await page.locator('.modal .detail-grid').count(),1,'Toucher un joueur de la liste doit ouvrir sa fiche');
 await press('close');
 const heading=await page.locator('.match-duel-ready-heading').evaluate(el=>({
  size:parseFloat(getComputedStyle(el).fontSize)
 }));
 assert.ok(heading.size<=18,'Le titre des tactiques ne doit plus être surdimensionné');
 await checkMobileLayout('duel avec situation colorée et compositions permanentes');
 // Une capture pleine page ne fait pas défiler Safari/Chrome : demander le décodage
 // des 28 portraits du terrain et des listes pour montrer les VRAIES photos,
 // même lorsque les lignes sont plus bas que le premier viewport.
 const rosterImages=await page.locator('.match-team-overview .character-portrait img').count();
 assert.equal(rosterImages,28,'14 joueurs sur le terrain et 14 dans les listes');
 const portraits=await page.locator('.match-team-overview .character-portrait img').evaluateAll(async images=>{
  return Promise.all(images.map(async img=>{
   img.loading='eager';
   try{await img.decode();return !!img.naturalWidth&&!!img.naturalHeight;}
   catch{return false;}
  }));
 });
 assert.ok(portraits.every(Boolean),'Un portrait du terrain ou des effectifs manque');
 // Scroll réel sur chacune des zones pour charger les portraits comme sur iPhone
 // et produire des aperçus séparés plutôt qu'une image immense.
 for(const [selector,filename] of [
  ['.match-team-overview .slot-field','06c-terrain-permanent.png'],
  ['.match-team-overview .team-panel:nth-child(1)','06d-effectif-premier-club.png'],
  ['.match-team-overview .team-panel:nth-child(2)','06e-effectif-second-club.png']
 ]){
  const item=page.locator(selector);
  assert.equal(await item.count(),1,'Zone des effectifs introuvable : '+selector);
  await item.scrollIntoViewIfNeeded();
  await item.evaluate(async root=>{
   const imgs=[...root.querySelectorAll('img')];
   await Promise.all(imgs.map(async img=>{img.loading='eager';await img.decode();}));
   await new Promise(requestAnimationFrame);
   await new Promise(requestAnimationFrame);
  });
  await item.screenshot({path:shots+'/'+filename,animations:'disabled'});
 }
 await take('06-duel');
 // Captures courtes des deux zones, en complément de la page complète avec terrain.
 // L'écran de match ne possède pas de HUD sticky : aucune modification temporaire.
 await page.locator('.match-attack-banner').screenshot({path:shots+'/06a-type-action.png',animations:'disabled'});
 await page.locator('.match-stage').first().screenshot({path:shots+'/06b-duel-joueurs.png',animations:'disabled'});
 console.log('PASS duel iPhone : action orange, attaque visible, deux postes/notes et 14 joueurs sous le terrain');

 // Duels -> tir : simulation réelle, sans raccourci sur la mécanique.
 const savedDuel=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
 const shotStage=await page.evaluate(async({key,savedDuel})=>{
  const {dispatchOpenMatch}=await import('/opfc/ui-match.mjs');
  const {calculateOpenPlay}=await import('/opfc/open-play.mjs');
  let s=structuredClone(savedDuel.game);
  const a=s.match.action;
  const calculation=calculateOpenPlay({...a.roles,attack:'COMBINER',defense:'PRESSER',
   chemistryBonus:a.chemistryBonus});
  const chance=(calculation.foulProbability+calculation.successProbability/2)/100;
  s=dispatchOpenMatch(s,'reveal-duel',{rng:()=>chance});
  if(s.match.action.duel.outcome.outcome!=='chance')throw Error('Occasion de tir non obtenue');
  s=dispatchOpenMatch(s,'continue-duel');
  const holder=structuredClone(savedDuel);holder.game=s;
  localStorage.setItem(key,JSON.stringify(holder));
  return s.match.action.stage;
 },{key,savedDuel});
 assert.equal(shotStage,'shot-attack-choice');
 await page.reload({waitUntil:'domcontentloaded'});
 assert.equal(await page.locator('.match-handover').count(),1,
  'Le téléphone doit être transmis sans exposer les choix secrets');
 await press('match-uncover');
 assert.equal(await page.locator('.match-shot-faceoff .match-duelist').count(),2,
  'Tireur et gardien visibles dès le choix du tir');
 assert.equal(await page.locator('.match-shot-faceoff .match-duelist-rating').count(),2);
 assert.equal(await page.locator('.match-tactical-choices .match-choice').count(),3);
 assert.equal(await page.locator('.match-tactical-choices [data-choice="PLACEE"]').count(),1);
 // Comparaison CSS objective aux cases des enchères originelles du jeu.
 const choiceStyles=await page.evaluate(()=>{
  const wrapper=document.createElement('div');wrapper.style.cssText='position:absolute;left:-9999px';
  wrapper.innerHTML='<section class="opfc-auction"><div class="offers"><button class="offer-btn">'+
   '<b>5 000 000 ฿</b><small>Offre minimale</small></button></div></section>';
  document.body.append(wrapper);
  const a=getComputedStyle(wrapper.querySelector('.offer-btn'));
  const b=getComputedStyle(document.querySelector('.match-tactical-choices .match-choice'));
  const css=['backgroundColor','borderTopColor','borderTopLeftRadius','paddingTop',
   'minHeight','fontFamily'].map(prop=>({prop,original:a[prop],tactique:b[prop]}));
  wrapper.remove();
  const rect=[...document.querySelectorAll('.match-tactical-choices .match-choice')].map(el=>{
   const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top};
  });
  return {css,rect};
 });
 assert.deepEqual(choiceStyles.css.filter(x=>x.original!==x.tactique),[],
  'Les cases tactiques ne reprennent pas le style des enchères originales');
 assert.equal(choiceStyles.rect.length,3);
 assert.ok(Math.abs(choiceStyles.rect[0].top-choiceStyles.rect[1].top)<2);
 assert.ok(choiceStyles.rect[0].right<=choiceStyles.rect[1].left+2);
 assert.ok(choiceStyles.rect[2].top>choiceStyles.rect[0].top);
 await checkMobileLayout('choix tactique tireur');
 await page.locator('.match-stage').first().screenshot({
  path:shots+'/08a-tir-choix-offensif.png',animations:'disabled'});
 await press('match-choose','[data-choice="PLACEE"]');
 assert.equal(await page.locator('.match-handover').count(),1);
 await press('match-uncover');
 assert.equal(await page.locator('.match-shot-faceoff .match-duelist').count(),2);
 assert.equal(await page.locator('.match-tactical-choices [data-choice="LIGNE"]').count(),1);
 assert.doesNotMatch(await page.locator('.match-stage').first().textContent(),/Frappe placée/,
  'Le choix du tireur doit rester secret pour le gardien');
 await checkMobileLayout('choix tactique gardien');
 await page.locator('.match-stage').first().screenshot({
  path:shots+'/08b-tir-choix-gardien.png',animations:'disabled'});
 await press('match-choose','[data-choice="LIGNE"]');
 assert.equal(await page.locator('.match-shot-faceoff').count(),1);
 assert.equal(await page.locator('.match-tactical-choices').count(),0);
 assert.equal(await page.locator('[data-action="match-reveal-shot"]').count(),1);
 await page.locator('.match-stage').first().screenshot({
  path:shots+'/08c-tir-choix-confirmes.png',animations:'disabled'});
 const shotReady=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
 const shotOutcomes=await page.evaluate(async({shotReady})=>{
  const {dispatchOpenMatch}=await import('/opfc/ui-match.mjs');
  const results={};
  for(let n=0;n<100;n++){
   const s=dispatchOpenMatch(shotReady.game,'reveal-shot',{rng:()=>n/100});
   const outcome=s.match.lastResult?.outcome;
   if(outcome&&!(outcome in results))results[outcome]=n/100;
   if(['goal','save','miss'].every(x=>x in results))break;
  }
  return results;
 },{shotReady});
 assert.deepEqual(Object.keys(shotOutcomes).sort(),['goal','miss','save'],
  'Les trois issues de frappe doivent être accessibles avec le moteur officiel');
 const colorValues={};
 for(const [outcome,title] of [
  ['goal','BUUUUT !'],['save','ARRÊT DU GARDIEN !'],['miss','TIR MANQUÉ !']
 ]){
  await page.evaluate(async({key,shotReady,draw})=>{
   const {dispatchOpenMatch}=await import('/opfc/ui-match.mjs');
   const saved=structuredClone(shotReady);
   saved.game=dispatchOpenMatch(saved.game,'reveal-shot',{rng:()=>draw});
   localStorage.setItem(key,JSON.stringify(saved));
  },{key,shotReady,draw:shotOutcomes[outcome]});
  await page.reload({waitUntil:'domcontentloaded'});
  const resultPanel=page.locator('.shot-result-'+outcome);
  await resultPanel.waitFor();
  assert.equal((await page.locator('.shot-result-headline').textContent()).trim(),title);
  assert.equal(await resultPanel.locator('.shot-result-portrait img').count(),1);
  assert.equal(await resultPanel.locator('.shot-result-score').count(),1);
  assert.equal(await page.locator('.match-team-overview .team-chip').count(),14);
  assert.equal(await page.locator('[data-action="match-continue-result"]').count(),1);
  colorValues[outcome]=await resultPanel.evaluate(el=>getComputedStyle(el).borderTopColor);
  await checkMobileLayout('résultat frappe '+outcome);
  await resultPanel.screenshot({
   path:shots+'/09-resultat-'+outcome+'.png',animations:'disabled'});
 }
 assert.equal(new Set(Object.values(colorValues)).size,3,
  'Les trois annonces de tir doivent avoir des couleurs clairement distinctes');
 console.log('PASS tirs iPhone : cases identiques aux enchères, deux portraits, confidentialité et 3 résultats officiels');

 // Les MÊMES cases sont utilisées pour toutes les phases arrêtées.
 for(const kind of ['corner','free-kick','penalty']){
  const stage=await page.evaluate(async({kind,prepared,key})=>{
   const {kickoffMatch}=await import('/opfc/match.mjs');
   const {dispatchOpenMatch}=await import('/opfc/ui-match.mjs');
   const random=seed=>()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);
   let s=null;
   for(let seed=1;seed<=2500;seed++){
    const trial=kickoffMatch(prepared.game,random(seed));
    if(trial.match.schedule[0].type===kind){s=trial;break;}
   }
   if(!s)throw Error('Aucune action '+kind+' dans les tirages');
   s=dispatchOpenMatch(s,'begin-setpiece');
   const team=s.teams.find(t=>t.club===s.match.action.attacker);
   s=dispatchOpenMatch(s,'select-taker',{takerId:team.slots[5],rng:()=>.2});
   const holder=structuredClone(prepared);holder.game=s;
   localStorage.setItem(key,JSON.stringify(holder));
   return s.match.action.stage;
  },{kind,prepared:JSON.parse(prepared),key});
  assert.equal(stage,'attack-choice');
  await page.reload({waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('.match-handover').count(),1);
  await press('match-uncover');
  assert.equal(await page.locator('.match-shot-faceoff .match-duelist').count(),2,
   'Le tireur et le gardien doivent être visibles sur '+kind);
  assert.equal(await page.locator('.match-tactical-choices .match-choice').count(),3);
  assert.equal(await page.locator('.match-shot-faceoff img').count(),2);
  await checkMobileLayout('choix tactiques '+kind);
  await page.locator('.match-stage').first().screenshot({
   path:shots+'/10-choix-'+kind+'.png',animations:'disabled'});
 }
 // Contrôler également la séance : les deux portraits persistent sur le
 // choix du tireur, du gardien et la confirmation sans révélation prématurée.
 const shootoutStage=await page.evaluate(async({prepared,key})=>{
  const {kickoffMatch}=await import('/opfc/match.mjs');
  const {dispatchOpenMatch}=await import('/opfc/ui-match.mjs');
  const random=seed=>()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);
  let s=kickoffMatch(JSON.parse(prepared).game,random(7));
  s.phase='shootout-ready';
  s=dispatchOpenMatch(s,'begin-shootout',{rng:()=>.1});
  const holder=JSON.parse(prepared);holder.game=s;
  localStorage.setItem(key,JSON.stringify(holder));
  return s.phase;
 },{prepared,key});
 assert.equal(shootoutStage,'shootout');
 await page.reload({waitUntil:'domcontentloaded'});
 assert.equal(await page.locator('.match-handover').count(),1);
 await press('match-uncover');
 assert.equal(await page.locator('.match-shot-faceoff .match-duelist').count(),2);
 assert.equal(await page.locator('.match-tactical-choices .match-choice').count(),3);
 await checkMobileLayout('choix des tirs au but');
 await page.locator('.match-stage').first().screenshot({
  path:shots+'/11a-tab-tireur.png',animations:'disabled'});
 await press('match-shootout-choose','[data-choice="GAUCHE"]');
 assert.equal(await page.locator('.match-handover').count(),1);
 await press('match-uncover');
 assert.equal(await page.locator('.match-shot-faceoff .match-duelist').count(),2);
 assert.equal(await page.locator('.match-tactical-choices .match-choice').count(),3);
 await page.locator('.match-stage').first().screenshot({
  path:shots+'/11b-tab-gardien.png',animations:'disabled'});
 await press('match-shootout-choose','[data-choice="DROITE"]');
 assert.equal(await page.locator('[data-action="match-shootout-reveal"]').count(),1);
 assert.equal(await page.locator('.match-shot-faceoff .match-duelist').count(),2);
 console.log('PASS coups de pied arrêtés et TAB iPhone : mêmes boutons et portraits en choix secret');

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
 assert.equal(await page.locator('.match-team-overview .team-chip').count(),14,
  'Les listes doivent rester visibles même après le coup de sifflet final');
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
