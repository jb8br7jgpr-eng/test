/** OPFC — Tests isolés de la préparation octobre 2026.
 * Exécuter : node --test opfc/tests/integration-20261025.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {CARDS} from '../catalog.mjs';
import {SHOT_CHOICES,KEEPER_CHOICES,calculateOpenShot,recommendOpenShot,resolveOpenShot} from '../shot.mjs';
import {prepareRematch} from '../rematch.mjs';
import {applyOnlineOpenPlayCommand,onlineMatchView} from '../online-match.mjs';
import {renderMatchScreen,renderOnlineMatchScreen} from '../ui-match.mjs';

const keeper={stats:{GAR:75}};
const finisher={stats:{TEC:75,PUI:75}};
const expected={
 FRANCHE:[64,61,64],
 BONNE:[41,40,39],
 DIFFICILE:[19,22,18]
};
test('Chaque contexte reproduit exactement les neuf références à stats 75',()=>{
 for(const [context,rates] of Object.entries(expected))
  for(let i=0;i<SHOT_CHOICES.length;i++){
   const values=KEEPER_CHOICES.map(keeperReaction=>calculateOpenShot({
    context,shot:SHOT_CHOICES[i],finisher,keeper,keeperReaction
   }).goalProbability);
   const avg=values.reduce((sum,x)=>sum+x,0)/3;
   assert.ok(Math.abs(avg-rates[i])<1e-7,context+' '+SHOT_CHOICES[i]+' '+avg);
  }
});
test('Toutes les associations du catalogue gardent des taux valides',()=>{
 const field=CARDS.filter(c=>c.position!=='GAR');
 const keepers=CARDS.filter(c=>c.position==='GAR');
 assert.equal(field.length,63);assert.equal(keepers.length,12);
 let cases=0;
 for(const f of field)for(const g of keepers)for(const context of Object.keys(expected))
  for(const shot of SHOT_CHOICES)for(const keeperReaction of KEEPER_CHOICES){
   const p=calculateOpenShot({finisher:f,keeper:g,context,shot,keeperReaction});
   assert.ok(p.accuracy>=5&&p.accuracy<=95);
   assert.ok(p.saveIfOnTarget>=5&&p.saveIfOnTarget<=90);
   assert.ok(p.goalProbability>=0&&p.goalProbability<=100);
   assert.ok(Math.abs(p.missProbability+p.saveProbability+p.goalProbability-100)<1e-7);
   cases++;
  }
 assert.equal(cases,20412);
});
test('Tir conseillé ne consomme pas de hasard et ne requiert pas le choix gardien',()=>{
 const f=CARDS.find(c=>c.id==='barbe-noire');
 const g=CARDS.find(c=>c.id==='chopper');
 assert.equal(recommendOpenShot({finisher:f,keeper:g,context:'BONNE'}),'PUISSANTE');
 const shot=calculateOpenShot({finisher:f,keeper:g,context:'BONNE',shot:'PUISSANTE',keeperReaction:'LIGNE'});
 for(const p of [0,.999999]){
  const r=resolveOpenShot(shot,p);
  assert.ok(['miss','save','goal'].includes(r.outcome));
 }
});
const take=(position,used)=>{
 const card=CARDS.find(c=>c.position===position&&!used.has(c.id));
 assert.ok(card);
 used.add(card.id);
 return card.id;
};
const used=new Set();
const team=(club,identityId)=>{
 const roster=['GAR','DEF','DEF','MIL','MIL','ATT','ATT'].map(pos=>take(pos,used));
 return {club,identityId,roster,slots:[...roster],formation:'2-2-2',ready:true,
  budget:0,refusals:0,hakis:{kings:false,observation:false}};
};
const teams=[team('PSG','PSG'),team('OM','BDW')];
const makeFinished=()=>({
 version:1,phase:'finished',competition:'grandline',stadiumId:'mugiwara',
 playerStatsVersion:2,matchRecordId:'1a8c9e07-f7f8-47fe-9776-abdfce3dc221',
 dice:[5,2],teams:structuredClone(teams),deck:[],history:[],auction:null,
 match:{index:11,minute:90,score:{PSG:1,OM:0},winner:'PSG',victory:'regulation',
  goals:[{club:'PSG',cardId:teams[0].roster[5],minute:72}],
  history:[],statistics:{
   PSG:{sequences:6,shots:1,onTarget:1,saves:0},
   OM:{sequences:5,shots:0,onTarget:0,saves:0}
  },schedule:[],lastResult:null}
});
test('Revanche conserve effectifs ET placements de fin de match',()=>{
 const original=makeFinished();
 [original.teams[0].slots[5],original.teams[0].slots[6]]=
 [original.teams[0].slots[6],original.teams[0].slots[5]];
 const previous=structuredClone(original);
 const rematch=prepareRematch(original,{matchRecordId:'ad5c92a4-cc56-4dc3-910b-367ab9de2be5'});
 assert.equal(rematch.phase,'kickoff-ready');
 assert.equal(rematch.match,null);
 assert.equal(rematch.matchRecordId,'ad5c92a4-cc56-4dc3-910b-367ab9de2be5');
 assert.deepEqual(rematch.teams.map(t=>t.slots),previous.teams.map(t=>t.slots));
 assert.deepEqual(rematch.teams.map(t=>t.roster),previous.teams.map(t=>t.roster));
 assert.deepEqual(rematch.teams.map(t=>t.formation),previous.teams.map(t=>t.formation));
 assert.equal(rematch.prematchSeen,true);
 assert.deepEqual(rematch.prematchReady,{PSG:false,OM:false});
 assert.equal(original.phase,'finished'); // Le premier match n'est pas modifié
 assert.throws(()=>prepareRematch(original,{matchRecordId:original.matchRecordId}));
});
test('Deux confirmations en ligne déclenchent une seule nouvelle rencontre',()=>{
 const first=applyOnlineOpenPlayCommand(makeFinished(),'PSG',{type:'rematch-accept'},{hostClub:'PSG'});
 assert.equal(first.state.phase,'finished');
 assert.equal(first.state.rematch.votes.PSG,true);
 assert.equal(first.state.rematch.votes.OM,false);
 assert.equal(first.publicForActor.match.rematch.votes.PSG,true);
 const second=applyOnlineOpenPlayCommand(first.state,'OM',{type:'rematch-accept'},{hostClub:'PSG'});
 assert.equal(second.state.phase,'kickoff-ready');
 assert.ok(second.state.matchRecordId);
 assert.notEqual(second.state.matchRecordId,first.state.matchRecordId);
 assert.equal(second.state.match,null);
 assert.deepEqual(second.state.prematchReady,{PSG:false,OM:false});
 assert.equal(second.publicForActor.phase,'kickoff-ready');
});
test('Refus en ligne conserve le match terminé et réinitialise la proposition',()=>{
 const first=applyOnlineOpenPlayCommand(makeFinished(),'PSG',{type:'rematch-accept'},{hostClub:'PSG'});
 const rejected=applyOnlineOpenPlayCommand(first.state,'OM',{type:'rematch-decline'},{hostClub:'PSG'});
 assert.equal(rejected.state.phase,'finished');
 assert.equal(rejected.state.match.score.PSG,1);
 assert.equal(rejected.state.rematch.rejectedBy,'OM');
 assert.deepEqual(rejected.state.rematch.votes,{PSG:false,OM:false});
});
test('Célébration officielle : deux confirmations locales, un bouton en ligne',()=>{
 const state=makeFinished();
 state.phase='moment-result';
 state.match.index=0;
 state.match.minute=72;
 state.match.schedule=[{minute:72,period:2,attacker:'PSG',type:'open'}];
 state.match.goals=[{club:'PSG',cardId:teams[0].roster[5],assistId:teams[0].roster[4],minute:72}];
 state.match.lastResult={index:0,minute:72,period:2,attacker:'PSG',type:'open',
  outcome:'goal',scorerId:teams[0].roster[5],
  details:{kind:'open',shot:{calculation:{shot:'PLACEE'}}}};
 const local=renderMatchScreen(state);
 assert.ok(local.includes('shot-goal-celebration'));
 assert.ok(local.includes('Frappe placée'));
 assert.ok(local.includes('Passe décisive'));
 assert.equal((local.match(/data-action="match-goal-ack"/g)||[]).length,2);
 const publicS=onlineMatchView(state,'PSG');
 const online=renderOnlineMatchScreen(publicS,{myClub:'PSG',hostClub:'PSG'});
 assert.ok(online.includes('shot-goal-celebration'));
 assert.equal((online.match(/data-type="ack"/g)||[]).length,1);
 assert.ok(!online.includes('match-goal-ack'));
});
