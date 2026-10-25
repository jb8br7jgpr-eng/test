/** Régression cosmétique OPFC : ni moteur ni déploiement. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CARDS} from '../catalog.mjs';
import {renderShotResult,matchTacticalChoices} from '../ui-match-widgets.mjs';

const fixture=()=>({
 matchRecordId:'42181c51-5a1b-4a60-8c77-e8b05b7e2f13',
 teams:[],
 match:{index:6,shootout:{timeline:[]}}
});
const scores={PSG:1,OM:2};
const ids=Object.freeze({
 goal:{title:'BUUUUT !',badge:'⚽'},
 save:{title:'ARRÊT DU GARDIEN !',badge:'🧤'},
 stopped:{title:'ATTAQUE STOPPÉE !',badge:'🛡️'},
 miss:{title:'TIR RATÉ !',badge:'❌'},
 chance:{title:'OCCASION CRÉÉE !',badge:'🔥'},
 foul:{title:'FAUTE SIFFLÉE !',badge:'📣'}
});
const choice=(group)=>matchTacticalChoices(group.map(([id,label])=>[id,label]));
const hints=html=>[...html.matchAll(/<small class="match-keeper-hint">([^<]+)<\/small>/g)].map(x=>x[1]);

test('Les six résultats réutilisent exactement le panneau et les portraits du but',()=>{
 for(const [outcome,{title,badge}] of Object.entries(ids)){
  const s=fixture(), html=renderShotResult(s,{
   outcome,attacker:'PSG',minute:65,
   shooterId:CARDS[0].id,keeperId:CARDS[1].id,defenderId:CARDS[2].id,
   score:scores,context:'Test de résultat',
   ...(outcome==='goal'?{goalInfo:{kind:'open',shot:'PLACEE'}}:{})
  });
  assert.ok(html.includes('shot-goal-celebration shot-result-unified'),outcome+' : format commun');
  assert.ok(html.includes('shot-result-'+outcome),outcome+' : identité');
  assert.ok(html.includes(title),outcome+' : titre');
  assert.ok(html.includes(badge),outcome+' : pictogramme');
  assert.ok(html.includes('shot-result-portrait'),outcome+' : portrait');
  assert.equal((html.match(/shot-goal-crest/g)||[]).length,2,outcome+' : écussons');
  assert.ok(html.includes('1 – 2'),outcome+' : score');
  assert.ok(html.includes('data-action="match-continue-result"'),outcome+' : validation');
 }
});

test('Animation non répétée à chaque rafraîchissement de la même action',()=>{
 const s=fixture();
 const config={outcome:'save',attacker:'PSG',minute:67,keeperId:CARDS[0].id,score:scores,context:'Tir'};
 assert.ok(renderShotResult(s,config).includes('shot-result-intro'));
 assert.ok(!renderShotResult(s,config).includes('shot-result-intro'));
 s.match.index++;
 assert.ok(renderShotResult(s,config).includes('shot-result-intro'));
});

test('La célébration du but et ses confirmations restent identiques',()=>{
 const html=renderShotResult(fixture(),{
  outcome:'goal',attacker:'PSG',minute:45,shooterId:CARDS[0].id,score:scores,
  goalInfo:{kind:'open',shot:'PLACEE',assistId:CARDS[1].id},
  localGoalAcks:{PSG:false,OM:false},animateGoal:true
 });
 assert.ok(html.includes('shot-goal-intro'));
 assert.ok(html.includes('Passe décisive'));
 assert.equal((html.match(/data-action="match-goal-ack"/g)||[]).length,2);
 assert.ok(html.includes('Frappe placée'));
});

test('Aides du jeu ouvert : mêmes textes que validés, aucun changement des IDs',()=>{
 const html=choice([['PRESSER','Tacler'],['INTERCEPTER','Intercepter'],['CONTENIR','Pressing']]);
 assert.deepEqual(hints(html),[
  'Contre surtout le dribble',
  'Contre surtout la passe en profondeur',
  'Contre surtout la passe courte'
 ]);
 for(const id of ['PRESSER','INTERCEPTER','CONTENIR'])assert.ok(html.includes('data-choice="'+id+'"'));
});

test('Aides coups francs : avantages affichés seulement au défenseur',()=>{
 const defense=choice([['MUR','Renforcer le mur'],['MARQUAGE','Marquage serré'],['ANTICIPER','Anticiper']]);
 assert.deepEqual(hints(defense),[
  'Contre surtout la frappe directe',
  'Contre surtout le centre',
  'Contre surtout la combinaison courte'
 ]);
 assert.deepEqual(hints(choice([['DIRECT','Frappe directe'],['CENTRE','Centre'],['COMBINAISON','Combinaison courte']])),[]);
 for(const id of ['MUR','MARQUAGE','ANTICIPER'])assert.ok(defense.includes('data-choice="'+id+'"'));
});

test('Aucune aide ajoutée aux zones ou aux directions ni aux frappes',()=>{
 for(const list of [
  [['COMBINER','Passe courte'],['LANCER','Passe en profondeur'],['PERCER','Dribbler']],
  [['PREMIER','Couvrir le premier poteau'],['PENALTY','Couvrir le point de penalty'],['SECOND','Couvrir le second poteau']],
  [['GAUCHE','Plonger à gauche'],['CENTRE','Rester au centre'],['DROITE','Plonger à droite']],
  [['TETE','Tête'],['VOLEE','Reprise de volée'],['RETOURNE','Retourné acrobatique']]
 ])assert.deepEqual(hints(choice(list)),[]);
 assert.deepEqual(hints(choice([['LIGNE','Rester sur sa ligne'],['SORTIE','Réduire l’angle'],['PLONGEON','Plongeon anticipé']])),[
  'Contre surtout le ballon piqué','Contre surtout la frappe placée','Contre surtout la frappe puissante'
 ]);
});

test('Tirs au but local et en ligne : score de séance séparé du score du match',()=>{
 const src=readFileSync(new URL('../ui-shootout.mjs',import.meta.url),'utf8');
 assert.equal((src.match(/scoreLabel:'Score de la séance de tirs au but'/g)||[]).length,2);
 const html=renderShotResult(fixture(),{
  outcome:'goal',attacker:'PSG',shooterId:CARDS[0].id,score:{PSG:4,OM:3},
  context:'Séance de tirs au but',scoreLabel:'Score de la séance de tirs au but'
 });
 assert.ok(html.includes('shot-goal-celebration shot-result-unified'));
 assert.ok(html.includes('aria-label="Score de la séance de tirs au but"'));
 assert.ok(html.includes('4 – 3'));
 assert.ok(!html.includes('match-goal-ack'));
});

test('Les six identités visuelles ont leur propre couleur sans modifier celle du but',()=>{
 const css=readFileSync(new URL('../v3-match.css',import.meta.url),'utf8');
 for(const tone of ['save','stopped','miss','chance','foul'])
  assert.ok(css.includes('.shot-result-unified.shot-result-'+tone),tone+' : palette');
 assert.ok(css.includes('shot-result-unified:not(.shot-result-goal)'));
 assert.ok(css.includes('prefers-reduced-motion'));
 const markup=readFileSync(new URL('../ui-match.mjs',import.meta.url),'utf8');
 assert.ok(markup.includes('./ui-match-widgets.mjs?v=opfc-result-polish-20261026'));
});
