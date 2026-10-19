/** Smoke test des événements réels de l'interface 9B3, sans navigateur graphique. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,ready} from '../engine.mjs';
import {kickoffMatch,resolveMatchMoment,continueMatch,resumeMatch} from '../match.mjs';
const PSG=['chopper','jinbe','kaido','shanks','nami','luffy','zoro'];
const OM=['loki','mihawk','monkey-d-garp','katakuri','sabo','sanji','kizaru'];
const rng=(seed=23)=>()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);
function fixture(){
 const s=createGame({dice:[5,2],rng:rng(5)});
 s.auction=null;s.phase='kickoff-ready';
 for(const t of s.teams){t.roster=[...(t.club==='PSG'?PSG:OM)];t.slots=[...t.roster];t.formation='2-2-2';t.ready=true;}
 let current=kickoffMatch(s,rng(55));
 while(current.phase!=='shootout-ready'){
  if(current.phase==='half-time'){
   current=ready(ready(current,'PSG'),'OM');
   current=resumeMatch(current);
  }else{
   current=continueMatch(resolveMatchMoment(current,{outcome:'stopped'}));
  }
 }
 return current;
}
test('iPhone local simulé : 12 tentatives, secret et écran final via les boutons',async()=>{
 const cache=new Map([['opfc-v08-local-dev',JSON.stringify({
  game:fixture(),firstClub:'PSG',beforeForm:{PSG:'2-2-2',OM:'2-2-2'}
 })]]);
 const listeners={},app={innerHTML:'',addEventListener:(k,fn)=>{listeners[k]=fn;}};
 const previousRandom=Math.random;
 globalThis.document={getElementById:id=>id==='opfc-app'?app:null};
 globalThis.localStorage={
  getItem:key=>cache.get(key)??null,
  setItem:(key,val)=>cache.set(key,val),
  removeItem:key=>cache.delete(key)
 };
 const click=(action,attributes={})=>listeners.click({target:{closest:()=>({
  dataset:{action,...attributes},disabled:false
 })}});
 const state=()=>JSON.parse(cache.get('opfc-v08-local-dev')).game;
 try{
  await import('../ui.mjs');
  assert.match(app.innerHTML,/Lancer la pièce/);
  Math.random=()=>.1;
  click('match-begin-shootout');
  assert.equal(state().phase,'shootout');
  assert.equal(state().match.shootout.firstClub,'PSG');
  assert.match(app.innerHTML,/Passe le téléphone/);
  for(let i=0;i<12;i++){
   click('match-uncover');
   assert.match(app.innerHTML,/data-choice="GAUCHE"/);
   click('match-shootout-choose',{choice:'GAUCHE'});
   assert.equal(state().match.shootoutPending.shotDirection,'GAUCHE');
   assert.match(app.innerHTML,/Passe le téléphone/);
   click('match-uncover');
   assert.doesNotMatch(app.innerHTML,/Révéler et tirer/);
   click('match-shootout-choose',{choice:'DROITE'});
   assert.match(app.innerHTML,/Révéler et tirer/);
   Math.random=()=>i===10?0:.999999;
   click('match-shootout-reveal');
   assert.equal(state().match.shootout.timeline.length,i+1);
   assert.match(app.innerHTML,/match-shootout-continue/);
   click('match-shootout-continue');
  }
  assert.equal(state().phase,'finished');
  assert.equal(state().match.winner,'OM');
  assert.deepEqual(state().match.shootout.score,{PSG:5,OM:6});
  assert.deepEqual(state().match.score,{PSG:0,OM:0});
  assert.match(app.innerHTML,/Victoire de Olympique de MaryGeoise/);
  assert.match(app.innerHTML,/Buteurs du match/);
  assert.match(app.innerHTML,/Séquences offensives/);
  assert.match(app.innerHTML,/final-kicks/);
  assert.doesNotMatch(app.innerHTML,/data-action="match-shootout-choose"/);
 }finally{
  Math.random=previousRandom;
  delete globalThis.document;delete globalThis.localStorage;
 }
});
