import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../engine.mjs';
import {lineupDetails} from '../rules.mjs';
import {renderShotResult,renderShotFaceOff,renderReceiverCard,matchTacticalChoices} from '../ui-match-widgets.mjs';
import {setDisplayedClubs,visualAbbr} from '../club-identities.mjs';

const fixture=()=>{
 const s=createGame({dice:[5,2],rng:()=>.3});
 const list={
  PSG:['chopper','jinbe','kaido','shanks','nami','luffy','zoro'],
  OM:['loki','mihawk','monkey-d-garp','katakuri','sabo','sanji','kizaru']
 };
 for(const t of s.teams){t.roster=[...list[t.club]];t.slots=[...t.roster];t.formation='2-2-2';t.ready=true;}
 return s;
};
test('Les boutons tactiques partagent l’habillage des quatre cases d’enchères et gardent les IDs du moteur',()=>{
 for(const [action,count] of [['match-choose',3],['match-shootout-choose',3]]){
  const html=matchTacticalChoices([['GAUCHE','Tirer à gauche'],['CENTRE','Tirer au centre'],['DROITE','Tirer à droite']],action);
  assert.match(html,/match-tactical-choices/);
  assert.equal((html.match(/class="btn match-choice"/g)||[]).length,count);
  assert.equal((html.match(/<strong>/g)||[]).length,count);
  assert.match(html,new RegExp('data-action="'+action+'"'));
  assert.match(html,/data-choice="GAUCHE"/);
  assert.doesNotMatch(html,/data-choice="QUELCONQUE"/);
 }
});
test('Tous les choix en match possèdent un emoji décoratif, un nom exact et le même code de décision',()=>{
 const groups=[
  [['COMBINER','Combiner'],['LANCER','Lancer'],['PERCER','Percer']],
  [['PRESSER','Presser'],['INTERCEPTER','Intercepter'],['CONTENIR','Contenir']],
  [['PLACEE','Frappe placée'],['PUISSANTE','Frappe puissante'],['PIQUEE','Ballon piqué']],
  [['LIGNE','Rester sur la ligne'],['SORTIE','Sortir'],['PLONGEON','Anticiper le plongeon']],
  [['PREMIER','Premier poteau'],['PENALTY','Point de penalty'],['SECOND','Second poteau']],
  [['PREMIER','Couvrir le premier poteau'],['PENALTY','Couvrir le point de penalty'],['SECOND','Couvrir le second poteau']],
  [['DIRECT','Frappe directe'],['CENTRE','Centre'],['COMBINAISON','Combinaison courte']],
  [['MUR','Renforcer le mur'],['MARQUAGE','Marquage serré'],['ANTICIPER','Anticiper']],
  [['GAUCHE','Tirer à gauche'],['CENTRE','Tirer au centre'],['DROITE','Tirer à droite']],
  [['GAUCHE','Plonger à gauche'],['CENTRE','Rester au centre'],['DROITE','Plonger à droite']],
  [['TETE','Tête'],['VOLEE','Reprise de volée'],['RETOURNE','Retourné acrobatique']],
  [['GAUCHE','Gauche'],['CENTRE','Centre'],['DROITE','Droite']]
 ];
 for(const [index,options] of groups.entries()){
  const action=index===groups.length-1?'match-shootout-choose':'match-choose';
  const html=matchTacticalChoices(options,action);
  assert.equal((html.match(/class="match-choice-emoji" aria-hidden="true"/g)||[]).length,3,
   'Un emoji doit accompagner CHAQUE option');
  assert.equal((html.match(/class="btn match-choice"/g)||[]).length,3);
  for(const [id,label] of options){
   assert.ok(html.includes('data-choice="'+id+'">'),'Identifiant moteur conservé');
   assert.ok(html.includes('<strong>'+label+'</strong>'),'Libellé officiel conservé');
  }
  assert.doesNotMatch(html,/undefined|null/);
 }
 // Cas futur : une nouvelle tactique reste habillée sans adapter l’API du moteur.
 const future=matchTacticalChoices([['TEST','Action future']]);
 assert.match(future,/⚽/);
 assert.match(future,/data-choice="TEST"/);
});
test('Réceptionneur : portrait, poste réellement joué, note effective et alerte hors poste',()=>{
 const s=fixture(),team=s.teams.find(t=>t.club==='PSG');
 const before=structuredClone(team);
 // Chopper est naturellement gardien mais doit être affiché comme attaquant.
 team.slots[0]='luffy';team.slots[5]='chopper';
 const effective=lineupDetails(team).find(p=>p.cardId==='chopper');
 assert.equal(effective.position,'ATT');
 assert.equal(effective.outOfPosition,true);
 const html=renderReceiverCard(s,{receiverId:'chopper',club:'PSG'});
 assert.match(html,/receiver-card psg/);
 assert.match(html,/JOUEUR À LA RÉCEPTION/);
 assert.match(html,/portraits_opfc\/chopper.webp/);
 assert.match(html,/Chopper/);
 assert.match(html,/receiver-card-club">PSG/);
 assert.match(html,/receiver-card-position">ATT/);
 assert.match(html,new RegExp('receiver-card-rating">NOTE '+effective.rating));
 assert.match(html,/! Hors poste/);
 assert.doesNotMatch(html,/data-action=|data-choice=/);
 const potential=renderReceiverCard(s,{receiverId:'chopper',club:'PSG',possible:true});
 assert.match(potential,/PARTENAIRE POTENTIEL À LA RÉCEPTION/);
 assert.equal(renderReceiverCard(s,{receiverId:'introuvable',club:'PSG'}),'');
 assert.equal(renderReceiverCard(s,{receiverId:'chopper',club:'CLUB_INCONNU'}),'');
 assert.notDeepEqual(team,before,'La composition modifiée doit être prise en compte');
});
test('Le tireur et le gardien sont visibles ensemble avant la résolution avec leurs notes effectives',()=>{
 const s=fixture(),t=s.teams.find(t=>t.club==='PSG'),
 keeper=s.teams.find(t=>t.club==='OM');
 const left=t.slots[5],right=keeper.slots[0];
 const html=renderShotFaceOff(s,{shooterId:left,keeperId:right,attacker:'PSG',defender:'OM'});
 assert.equal((html.match(/class="match-duelist /g)||[]).length,2);
 assert.match(html,/match-shot-faceoff/);
 assert.match(html,/Tireur/);
 assert.match(html,/Gardien/);
 assert.match(html,/match-duelist-position/);
 const ratings=[lineupDetails(t).find(p=>p.cardId===left).rating,lineupDetails(keeper)[0].rating];
 for(const rating of ratings)assert.ok(html.includes('NOTE '+rating));
 assert.equal(renderShotFaceOff(s,{shooterId:null,keeperId:right,attacker:'PSG',defender:'OM'}),'');
});
test('BUT, ARRÊT et TIR MANQUÉ : cartes, couleurs, acteur exact, score et bouton Continuer',()=>{
 const s=fixture(),shot=s.teams[0].slots[5],keeper=s.teams[1].slots[0];
 const score={PSG:2,OM:1};
 for(const [outcome,tone,title,actor,role] of [
  ['goal','goal','BUUUUT !',shot,'Buteur'],
  ['save','save','ARRÊT DU GARDIEN !',keeper,'Gardien'],
  ['miss','miss','TIR MANQUÉ !',shot,'Tireur']
 ]){
  const html=renderShotResult(s,{outcome,attacker:'PSG',minute:73,shooterId:shot,keeperId:keeper,score});
  assert.ok(html.includes('shot-result-'+tone));
  assert.ok(html.includes(title));
  assert.ok(html.includes('portraits_opfc/'+actor+'.webp'));
  assert.ok(html.includes(' · '+role));
  assert.match(html,/2 – 1/);
  assert.match(html,/73e/);
  assert.match(html,/data-action="match-continue-result"/);
  assert.doesNotMatch(html,/undefined|null/);
 }
});
test('Séance de tirs au but : ne pas inventer une minute, conserver les scores séparés',()=>{
 const s=fixture();
 const h=renderShotResult(s,{outcome:'save',attacker:'OM',shooterId:'kizaru',keeperId:'chopper',
  score:{PSG:4,OM:3},context:'Séance de tirs au but',detailExtra:'Droite / gauche',
  action:'match-shootout-continue'});
 assert.match(h,/ARRÊT DU GARDIEN !/);
 assert.match(h,/chopper.webp/);
 assert.match(h,/4 – 3/);
 assert.match(h,/data-action="match-shootout-continue"/);
 assert.doesNotMatch(h,/undefinede|NaNe/);
 assert.match(h,/Droite \/ gauche/);
 assert.equal(renderShotResult(s,{outcome:'stopped',attacker:'PSG'}),'');
});

test('BDW contre BDR : les réceptions, duels et tirs montrent les nouveaux sigles',()=>{
 const s=fixture();
 s.teams.find(t=>t.club==='PSG').identityId='BDW';
 s.teams.find(t=>t.club==='OM').identityId='BDR';
 setDisplayedClubs(s.teams);
 try{
  assert.equal(visualAbbr('PSG'),'BDW');
  const reception=renderReceiverCard(s,{receiverId:'luffy',club:'PSG'});
  assert.match(reception,/receiver-card-club">BDW/);
  assert.doesNotMatch(reception,/receiver-card-club">PSG/);
  const duel=renderShotFaceOff(s,{
   shooterId:'luffy',keeperId:'loki',attacker:'PSG',defender:'OM'
  });
  assert.match(duel,/match-duelist-team">BDW · Tireur/);
  assert.match(duel,/match-duelist-team">BDR · Gardien/);
  const shot=renderShotResult(s,{
   outcome:'goal',attacker:'PSG',shooterId:'luffy',keeperId:'loki',
   score:{PSG:2,OM:1}
  });
  assert.match(shot,/BDW/);assert.match(shot,/BDR/);
  assert.doesNotMatch(shot,/<span>PSG<\/span>|<span>OM<\/span>/);
 }finally{setDisplayedClubs(null);}
});
