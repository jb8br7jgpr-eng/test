import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../engine.mjs';
import {applyOnlineLineupCommand,onlinePreMatchView,onlineKickoffView} from '../online-lineup.mjs';
const random=(seed=7)=>()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);
function filled(){
 const s=createGame({dice:[5,2],rng:random(13)});
 // Force seulement l'état pré-match des tests : les achats du vrai moteur
 // ont déjà leurs tests intégrés dans online-market.test.mjs.
 const a=['chopper','jinbe','kaido','shanks','nami','luffy','zoro'];
 const b=['loki','mihawk','monkey-d-garp','katakuri','sabo','sanji','kizaru'];
 s.phase='lineup';s.auction=null;
 for(const t of s.teams){
  t.roster=[...(t.club==='PSG'?a:b)];
  t.slots=Array(7).fill(null);
  t.ready=false;
 }
 s.onlinePrivate={observations:{PSG:['NEXT-CARD-SECRET'],OM:['DIFFERENT-SECRET']}};
 return s;
}
const doIt=(s,club,type,values={},hostClub='PSG')=>
 applyOnlineLineupCommand(s,club,{type,...values},{hostClub,rng:random(9)});
function fullyPlaced(){
 let s=filled();
 for(const club of ['PSG','OM']){
  const team=s.teams.find(x=>x.club===club);
  for(let slot=0;slot<7;slot++)
   s=doIt(s,club,'place',{cardId:team.roster[slot],slot}).state;
 }
 return s;
}
function bothReady(){
 let s=fullyPlaced();
 s=doIt(s,'PSG','ready').state;
 s=doIt(s,'OM','ready').state;
 return s;
}

test('Les 7 titulaires de chaque club ne peuvent être placés que par leur propriétaire',()=>{
 let s=filled();
 assert.throws(()=>doIt(s,'OM','place',{cardId:'luffy',slot:1}),/personnage.*club/);
 assert.throws(()=>doIt(s,'PSG','place',{cardId:'loki',slot:1}),/personnage.*club/);
 s=doIt(s,'PSG','place',{cardId:'luffy',slot:1}).state;
 assert.equal(s.teams.find(x=>x.club==='PSG').slots[1],'luffy');
 assert.equal(s.teams.find(x=>x.club==='OM').slots[1],null);
 assert.equal(filled().teams.find(x=>x.club==='PSG').slots[1],null);
});
test('Les deux clubs peuvent choisir parmi les sept formations, sans changer celle de l’autre',()=>{
 let s=filled();
 s=doIt(s,'OM','formation',{formation:'3-2-1'}).state;
 assert.equal(s.teams.find(t=>t.club==='OM').formation,'3-2-1');
 assert.equal(s.teams.find(t=>t.club==='PSG').formation,'2-2-2');
 assert.throws(()=>doIt(s,'OM','formation',{formation:'4-4-2'}),/Formation/);
});
test('La validation est interdite si la composition de sept joueurs est incomplète',()=>{
 const s=filled();
 assert.throws(()=>doIt(s,'PSG','ready'),/incomplète/);
 assert.equal(s.phase,'lineup');
 assert.equal(s.teams[0].ready,false);
});
test('La validation d’une équipe verrouille ses changements jusqu’au coup d’envoi',()=>{
 let s=fullyPlaced();
 s=doIt(s,'PSG','ready').state;
 assert.equal(s.phase,'lineup');
 assert.equal(s.teams.find(t=>t.club==='PSG').ready,true);
 assert.throws(()=>doIt(s,'PSG','place',{cardId:'luffy',slot:0}),/verrouillée/);
 assert.throws(()=>doIt(s,'PSG','formation',{formation:'1-2-3'}),/verrouillée/);
 assert.throws(()=>doIt(s,'PSG','ready'),/verrouillée/);
 s=doIt(s,'OM','formation',{formation:'1-3-2'}).state;
 assert.equal(s.teams.find(t=>t.club==='OM').formation,'1-3-2');
});
test('Les deux validations mènent à kickoff-ready sans détruire le calendrier futur',()=>{
 const s=bothReady();
 assert.equal(s.phase,'kickoff-ready');
 assert.equal(s.match,undefined);
 for(const t of s.teams)assert.equal(t.ready,true);
 assert.equal(onlinePreMatchView(s,'PSG').phase,'kickoff-ready');
 assert.equal(onlinePreMatchView(s,'OM').phase,'kickoff-ready');
 assert.equal(onlinePreMatchView(s,'PSG').deck,undefined);
});
test('Seul le club hôte peut déclencher le coup d’envoi avec le moteur officiel',()=>{
 const s=bothReady();
 assert.throws(()=>doIt(s,'OM','kickoff'),/hôte/);
 const result=doIt(s,'PSG','kickoff');
 assert.equal(result.state.phase,'match');
 assert.equal(result.state.match.schedule.length>=10,true);
 assert.equal(result.state.match.schedule.length<=12,true);
 assert.deepEqual(result.state.match.score,{PSG:0,OM:0});
 assert.equal(result.state.match.history.length,0);
 assert.equal(s.phase,'kickoff-ready');
});
test('La vue de coup d’envoi ne transmet ni calendrier, ni Observation, ni paquet',()=>{
 const s=doIt(bothReady(),'PSG','kickoff').state;
 const v=onlinePreMatchView(s,'OM'),host=onlinePreMatchView(s,'PSG');
 assert.equal(v.phase,'match');
 assert.equal(v.match.index,0);
 assert.equal(v.match.currentMoment.minute,s.match.schedule[0].minute);
 assert.equal(v.match.currentMoment.type,s.match.schedule[0].type);
 assert.deepEqual(host.match,v.match);
 for(const secret of ['deck','cursor','onlinePrivate','history','lastResult','schedule'])
  assert.equal(v[secret],undefined);
 assert.equal(v.match.schedule,undefined);
 assert.equal(JSON.stringify(v).includes('NEXT-CARD-SECRET'),false);
 assert.equal(JSON.stringify(v).includes('DIFFERENT-SECRET'),false);
 assert.equal(JSON.stringify(v).includes(s.deck.slice(s.cursor,s.cursor+5).join(',')),false);
 assert.deepEqual(v.match.goals,[]);
 assert.deepEqual(onlineKickoffView(s),v);
});
test('Les commandes malformées ou usurpant un club sont refusées',()=>{
 const s=filled();
 for(const bad of [
  null,'ready',[],{}, {type:'unknown'},
  {type:'place',cardId:'luffy',slot:1,club:'OM'},
  {type:'place',cardId:'luffy',slot:1,deck:['hidden']},
  {type:'place',cardId:'luffy',slot:'1'},
  {type:'place',cardId:'luffy',slot:7},
  {type:'formation',formation:'2-2-2',hostClub:'OM'},
  {type:'ready',score:{PSG:2,OM:0}},
  {type:'kickoff',schedule:[]},
 ]){
  assert.throws(()=>applyOnlineLineupCommand(s,'PSG',bad,{hostClub:'PSG'}),/./);
 }
 assert.throws(()=>applyOnlineLineupCommand(s,'HACK',{type:'ready'},{hostClub:'PSG'}),/Club/);
 assert.throws(()=>applyOnlineLineupCommand(s,'PSG',{type:'ready'},{hostClub:'HACK'}),/Club/);
});
test('Le coup d’envoi est interdit avant que les deux compositions soient prêtes',()=>{
 const s=filled();
 assert.throws(()=>doIt(s,'PSG','kickoff'),/doivent être prêtes/);
 assert.equal(s.phase,'lineup');
});
test('Le match engagé ne peut plus passer par les commandes de composition',()=>{
 const s=doIt(bothReady(),'PSG','kickoff').state;
 assert.throws(()=>doIt(s,'PSG','formation',{formation:'2-1-3'}),/indisponible/);
 assert.throws(()=>doIt(s,'OM','ready'),/indisponible/);
});
