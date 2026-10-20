import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../engine.mjs';
import {dispatchOpenMatch,renderMatchScreen} from '../ui-match.mjs';
import {renderShootoutScreen} from '../ui-shootout.mjs';
import {renderOnlineGame} from '../ui-online-game.mjs';
import {onlineMarketPublicView} from '../online-market.mjs';
import {onlinePreMatchView} from '../online-lineup.mjs';
import {setDisplayedClubs} from '../club-identities.mjs';

const textOnly=html=>html.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');
const noInternalNames=html=>assert.doesNotMatch(textOnly(html),/\b(?:PSG|OM)\b/,
 'Les identifiants internes ne doivent jamais etre visibles pour BDW/RM');
const random=seed=>()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);
const choices={PSG:'BDW',OM:'RM'};
const PSG=['chopper','jinbe','kaido','shanks','nami','luffy','zoro'];
const OM=['loki','mihawk','monkey-d-garp','katakuri','sabo','sanji','kizaru'];
function ready(){
 const s=createGame({dice:[5,2],rng:random(5),clubChoices:choices});
 s.phase='kickoff-ready';s.auction=null;
 for(const t of s.teams){
  t.roster=[...(t.club==='PSG'?PSG:OM)];t.slots=[...t.roster];
  t.formation='2-2-2';t.ready=true;
 }
 return s;
}
function first(type){
 for(let seed=1;seed<=300;seed++){
  const s=dispatchOpenMatch(ready(),'kickoff',{rng:random(seed)});
  if(s.match.schedule[0].type===type)return s;
 }
 throw Error('Moment absent : '+type);
}
test('BDW/RM : encheres et attente sur les deux iPhone sans sigle interne visible',()=>{
 const s=createGame({dice:[5,2],rng:random(3),clubChoices:choices});
 for(const slot of ['PSG','OM']){
  const html=renderOnlineGame(onlineMarketPublicView(s,slot),{myClub:slot,hostClub:'PSG'});
  noInternalNames(html);
  assert.match(textOnly(html),/BDW|Bayern de Wano/);
  assert.match(textOnly(html),/RM|Real Marineford/);
 }
});
test('BDW/RM : annonces de jeu et transmission locale sans mention PSG/OM',()=>{
 let s=first('open');
 let html=renderMatchScreen(s);
 noInternalNames(html);
 assert.match(textOnly(html),/BDW/);assert.match(textOnly(html),/RM/);
 s=dispatchOpenMatch(s,'begin-open',{rng:()=>.4});
 noInternalNames(renderMatchScreen(s));
 noInternalNames(renderMatchScreen(s,{uncovered:true}));
 s=dispatchOpenMatch(s,'choose',{choice:'COMBINER'});
 noInternalNames(renderMatchScreen(s));
 noInternalNames(renderMatchScreen(s,{uncovered:true}));
});
test('BDW/RM : corners, coups francs et penalties sans sigle technique',()=>{
 for(const kind of ['corner','free-kick','penalty']){
  const s=dispatchOpenMatch(first(kind),'begin-setpiece');
  const html=renderMatchScreen(s,{uncovered:true});
  noInternalNames(html);
  assert.match(textOnly(html),/BDW|Bayern de Wano/);
  assert.match(textOnly(html),/RM|Real Marineford/);
 }
});
test('BDW/RM : historique de tirs au but affiche exclusivement les clubs choisis',()=>{
 const state={
  phase:'finished',teams:[{club:'PSG',identityId:'BDW'},{club:'OM',identityId:'RM'}],
  match:{shootoutLastResult:null,shootout:{
   attempts:{PSG:[{club:'PSG',scored:true,result:'goal',shotNumber:1,shooterId:'luffy'}],OM:[]},
   score:{PSG:1,OM:0},phase:'finished',stage:'regular',
   timeline:[{club:'PSG',scored:true,result:'goal',shotNumber:1,shooterId:'luffy'}]
  }}
 };
 setDisplayedClubs(state.teams);
 try{
  const html=renderShootoutScreen(state);
  noInternalNames(html);
  assert.match(textOnly(html),/BDW/);assert.match(textOnly(html),/RM/);
 }finally{setDisplayedClubs(null);}
});
test('BDW/RM : les affichages en ligne des actions suivent les clubs choisis',()=>{
 const s=first('open');
 const html=renderOnlineGame(onlinePreMatchView(s,'PSG'),{myClub:'PSG',hostClub:'PSG'});
 noInternalNames(html);
 assert.match(textOnly(html),/BDW|Bayern de Wano/);
 assert.match(textOnly(html),/RM|Real Marineford/);
});
