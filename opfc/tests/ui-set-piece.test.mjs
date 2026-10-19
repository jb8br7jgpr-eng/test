import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../engine.mjs';
import {matchPublicView} from '../match.mjs';
import {CARD_BY_ID} from '../catalog.mjs';
import {renderMatchScreen,matchTurnOwner,matchRequiresPrivacy,dispatchOpenMatch} from '../ui-match.mjs';
import {isSetPieceKind,setPieceTurnOwner} from '../ui-set-piece.mjs';

const PSG=['chopper','jinbe','kaido','shanks','nami','luffy','zoro'];
const OM=['loki','mihawk','monkey-d-garp','katakuri','sabo','sanji','kizaru'];
const rng=(seed=9)=>()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);
function ready(){
 const s=createGame({dice:[5,2],rng:rng(1)});
 s.phase='kickoff-ready';s.auction=null;
 for(const t of s.teams){
  t.roster=[...(t.club==='PSG'?PSG:OM)];
  t.slots=[...t.roster];t.formation='2-2-2';t.ready=true;
 }
 return s;
}
const originals=(()=> {
 const results={};
 for(let seed=1;seed<=2000&&Object.keys(results).length<4;seed++){
  const s=dispatchOpenMatch(ready(),'kickoff',{rng:rng(seed)});
  const kind=s.match.schedule[0].type;
  if(!(kind in results))results[kind]=s;
 }
 return results;
})();
function first(kind){
 const value=originals[kind];
 if(!value)throw Error('Séquence initiale introuvable : '+kind);
 return structuredClone(value);
}
const attackChoice={corner:'PREMIER','free-kick':'DIRECT',penalty:'GAUCHE'};
const defenseChoice={corner:'SECOND','free-kick':'MUR',penalty:'DROITE'};
function begun(kind){
 return dispatchOpenMatch(first(kind),'begin-setpiece');
}
function taker(state){
 const a=state.match.action;
 const team=state.teams.find(t=>t.club===a.attacker);
 return dispatchOpenMatch(state,'select-taker',{takerId:team.slots[4],rng:()=>.2});
}
function lock(state,attack,defense){
 state=dispatchOpenMatch(state,'choose',{choice:attack});
 return dispatchOpenMatch(state,'choose',{choice:defense});
}
function assertNoSecrets(state,out){
 const view=matchPublicView(state);
 assert.equal(Object.hasOwn(view.match,'schedule'),false);
 assert.equal(Object.hasOwn(view.match.action,'choices'),false);
 assert.equal(Object.hasOwn(view.match.action,'chemistryBonus'),false);
 assert.equal(Object.hasOwn(view.match.action,'originalDuel'),false);
 assert.equal(Object.hasOwn(view.match.action,'duel'),false);
 assert.doesNotMatch(out,/schedule/);
}
test('Calendrier prêt à tester : corners, coups francs, penalties et jeu ouvert',()=>{
 assert.deepEqual(Object.keys(originals).sort(),['corner','free-kick','open','penalty']);
 assert.deepEqual(['corner','free-kick','penalty'].map(isSetPieceKind),[true,true,true]);
 assert.equal(isSetPieceKind('open'),false);
});
test('Les trois phases commencent au bon moment, conservent minute et calendrier',()=>{
 for(const kind of ['corner','free-kick','penalty']){
  const start=first(kind),original=structuredClone(start.match.schedule),event=start.match.schedule[0];
  const s=begun(kind);
  assert.equal(s.match.action.kind,kind);
  assert.equal(s.match.action.stage,'taker-choice');
  assert.equal(s.match.action.minute,event.minute);
  assert.equal(s.match.action.index,0);
  assert.deepEqual(s.match.schedule,original);
  assert.equal(matchTurnOwner(s),event.attacker);
  assert.equal(setPieceTurnOwner(s),event.attacker);
  assert.equal(matchRequiresPrivacy(s),true);
  const cover=renderMatchScreen(s);
  assert.match(cover,/Passe le téléphone/);
  assert.doesNotMatch(cover,/data-action="match-taker"/);
  const display=renderMatchScreen(s,{uncovered:true});
  assert.match(display,/Choisis le tireur/);
  assert.equal((display.match(/data-action="match-taker"/g)??[]).length,7);
 }
});
test('Le tireur réel est annoncé avant les tactiques (gardien également disponible)',()=>{
 for(const kind of ['corner','free-kick','penalty']){
  let s=begun(kind);
  const t=s.teams.find(x=>x.club===s.match.action.attacker);
  s=dispatchOpenMatch(s,'select-taker',{takerId:t.slots[0],rng:()=>0});
  assert.equal(s.match.action.actors.taker.cardId,t.slots[0]);
  assert.equal(s.match.action.stage,'attack-choice');
  const view=renderMatchScreen(s,{uncovered:true});
  assert.match(view,new RegExp(CARD_BY_ID.get(t.slots[0]).name));
  assert.match(view,/data-action="match-choose"/);
  assert.equal(matchPublicView(s).match.action.choices,undefined);
 }
});
test('Premier choix verrouillé : l’adversaire ne voit pas la décision précédente',()=>{
 for(const kind of ['corner','free-kick','penalty']){
  let s=taker(begun(kind));
  const attacker=s.match.action.attacker,defender=s.match.action.defender;
  const attack=attackChoice[kind];
  assert.equal(matchTurnOwner(s),attacker);
  s=dispatchOpenMatch(s,'choose',{choice:attack});
  assert.equal(s.match.action.choices.attack,attack);
  assert.equal(s.match.action.stage,'defense-choice');
  assert.equal(matchTurnOwner(s),defender);
  const covered=renderMatchScreen(s);
  assert.match(covered,/Passe le téléphone/);
  assert.doesNotMatch(covered,/data-choice=/);
  const unwrapped=renderMatchScreen(s,{uncovered:true});
  // Corner et penalty partagent les mêmes options des deux côtés :
  // le texte d'une option n'indique donc pas le choix adverse.
  if(kind==='free-kick')assert.doesNotMatch(unwrapped,/data-choice="DIRECT"/);
  assert.match(unwrapped,/data-choice=/);
  assertNoSecrets(s,covered);
  s=dispatchOpenMatch(s,'choose',{choice:defenseChoice[kind]});
  assert.equal(matchTurnOwner(s),null);
  assert.equal(matchRequiresPrivacy(s),false);
  const both=renderMatchScreen(s);
  assertNoSecrets(s,both);
  assert.doesNotMatch(both,new RegExp('data-choice="'+attack+'"'));
 }
});
test('Corner : duel réussi, choix de tête puis vrai but du réceptionneur',()=>{
 let s=taker(begun('corner')),source=structuredClone(s.match.schedule);
 const attacker=s.match.action.attacker;
 s=lock(s,'PREMIER','SECOND');
 assert.match(renderMatchScreen(s),/Révéler et résoudre le duel/);
 s=dispatchOpenMatch(s,'reveal-setpiece-duel',{rng:()=>0});
 assert.equal(s.match.action.duel.outcome.outcome,'chance');
 assert.match(renderMatchScreen(s),/Occasion créée/);
 s=dispatchOpenMatch(s,'continue-setpiece-duel',{rng:()=>.5});
 assert.equal(s.match.action.stage,'corner-gesture-choice');
 assert.equal(matchTurnOwner(s),attacker);
 assert.match(renderMatchScreen(s),/Passe le téléphone/);
 s=dispatchOpenMatch(s,'choose',{choice:'TETE'});
 assert.equal(s.match.action.stage,'corner-finish-ready');
 assert.match(renderMatchScreen(s),/Résoudre la finition/);
 const receiver=s.match.action.actors.receiver.cardId;
 s=dispatchOpenMatch(s,'finish-corner',{rng:()=>.99999});
 assert.equal(s.phase,'moment-result');
 assert.equal(s.match.lastResult.outcome,'goal');
 assert.equal(s.match.score[attacker],1);
 assert.equal(s.match.lastResult.scorerId,receiver);
 assert.match(renderMatchScreen(s),/BUUUUT/);
 s=dispatchOpenMatch(s,'continue-result');
 assert.equal(s.match.index,1);
 assert.deepEqual(s.match.schedule,source);
});
test('Corner défendu : séquence terminée, aucun tir ni but',()=>{
 let s=taker(begun('corner'));
 s=lock(s,'PREMIER','PREMIER');
 s=dispatchOpenMatch(s,'reveal-setpiece-duel',{rng:()=>.99999});
 assert.equal(s.match.action.duel.outcome.outcome,'stopped');
 s=dispatchOpenMatch(s,'continue-setpiece-duel');
 assert.equal(s.phase,'moment-result');
 assert.equal(s.match.lastResult.outcome,'stopped');
 assert.equal(s.match.statistics.PSG.shots+s.match.statistics.OM.shots,0);
 assert.equal(s.match.history.length,1);
});
test('Coup franc : duel puis finition automatique sans second choix gardien',()=>{
 let s=taker(begun('free-kick')),source=structuredClone(s.match.schedule);
 const attacker=s.match.action.attacker,receiver=s.match.action.actors.receiver.cardId;
 s=lock(s,'CENTRE','MUR');
 s=dispatchOpenMatch(s,'reveal-setpiece-duel',{rng:()=>0});
 assert.equal(s.match.action.duel.outcome.outcome,'chance');
 assert.match(renderMatchScreen(s),/Continuer/);
 s=dispatchOpenMatch(s,'continue-setpiece-duel',{rng:()=>.99999});
 assert.equal(s.phase,'moment-result');
 assert.equal(s.match.lastResult.outcome,'goal');
 assert.equal(s.match.lastResult.scorerId,receiver);
 assert.equal(s.match.statistics[attacker].shots,1);
 assert.deepEqual(s.match.schedule,source);
 assert.match(renderMatchScreen(s),/Buteur/);
});
test('Penalty : directions révélées ensemble, résolution unique et score réel',()=>{
 let s=taker(begun('penalty')),source=structuredClone(s.match.schedule);
 const attacker=s.match.action.attacker,takerId=s.match.action.actors.taker.cardId;
 s=lock(s,'GAUCHE','DROITE');
 assert.equal(s.match.action.stage,'penalty-ready');
 const before=renderMatchScreen(s);
 assert.match(before,/Révéler les directions/);
 assert.doesNotMatch(before,/data-choice="GAUCHE"/);
 assertNoSecrets(s,before);
 s=dispatchOpenMatch(s,'reveal-penalty',{rng:()=>.99999});
 assert.equal(s.phase,'moment-result');
 assert.equal(s.match.lastResult.outcome,'goal');
 assert.equal(s.match.lastResult.scorerId,takerId);
 assert.equal(s.match.score[attacker],1);
 assert.deepEqual(s.match.schedule,source);
});
test('Une faute en jeu ouvert ouvre un coup franc/penalty dans la même séquence',()=>{
 for(const [draw,kind] of [[.1,'penalty'],[.9,'free-kick']]){
  let s=first('open');
  const original=structuredClone(s.match.schedule);
  s=dispatchOpenMatch(s,'begin-open',{rng:()=>draw});
  s=dispatchOpenMatch(s,'choose',{choice:'COMBINER'});
  s=dispatchOpenMatch(s,'choose',{choice:'PRESSER'});
  s=dispatchOpenMatch(s,'reveal-duel',{rng:()=>0});
  assert.equal(s.match.action.duel.outcome.outcome,'foul');
  s=dispatchOpenMatch(s,'continue-duel');
  assert.match(renderMatchScreen(s),/Continuer avec la phase arrêtée/);
  s=dispatchOpenMatch(s,'begin-setpiece');
  assert.equal(s.match.action.kind,kind);
  assert.equal(s.match.action.source,'foul');
  assert.deepEqual(s.match.schedule,original);
  assert.equal(s.match.history.length,0);
  s=taker(s);
  if(kind==='penalty'){
   s=lock(s,'GAUCHE','DROITE');
   s=dispatchOpenMatch(s,'reveal-penalty',{rng:()=>.99999});
  }else{
   s=lock(s,'CENTRE','MUR');
   s=dispatchOpenMatch(s,'reveal-setpiece-duel',{rng:()=>0});
   s=dispatchOpenMatch(s,'continue-setpiece-duel',{rng:()=>.99999});
  }
  assert.equal(s.phase,'moment-result');
  assert.equal(s.match.history.length,1);
  assert.equal(s.match.history[0].type,'open');
  assert.equal(s.match.history[0].details.kind,kind);
  assert.equal(s.match.statistics.PSG.sequences+s.match.statistics.OM.sequences,1);
  assert.deepEqual(s.match.schedule,original);
 }
});
test('Le moteur refuse les sauts d’étape et choix tactiques illicites',()=>{
 let s=taker(begun('corner'));
 assert.throws(()=>dispatchOpenMatch(s,'reveal-setpiece-duel',{rng:()=>0}),/Étape/);
 assert.throws(()=>dispatchOpenMatch(s,'choose',{choice:'DROITE'}),/invalide/);
 s=dispatchOpenMatch(s,'choose',{choice:'PREMIER'});
 assert.throws(()=>dispatchOpenMatch(s,'select-taker',{takerId:'nami'}),/Choix/);
 assert.throws(()=>dispatchOpenMatch(s,'finish-corner',{rng:()=>0}),/Étape/);
 const open=first('open');
 assert.throws(()=>dispatchOpenMatch(open,'begin-setpiece'),/ne contient pas/);
});
