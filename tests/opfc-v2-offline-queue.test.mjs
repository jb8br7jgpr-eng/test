/** Exécuter : node --test tests/opfc-v2-offline-queue.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import {CARDS} from '../opfc/catalog.mjs';
import {queueFinishedLocalGame,syncQueuedLocalResults,pendingLocalResultsCount} from '../opfc/trophy-service.mjs';

test('OPFC V2 : échec réseau, reprise, idempotence et sauvegarde des statistiques',async()=>{
 const previousFetch=globalThis.fetch,previousStorage=globalThis.localStorage;
 const storage=new Map(),sent=[];
 let connected=false;
 globalThis.localStorage={
  getItem:key=>storage.get(key)??null,
  setItem:(key,value)=>{storage.set(key,String(value));}
 };
 globalThis.fetch=async(url,options)=>{
  const data=JSON.parse(options.body);
  sent.push(data);
  if(!connected)throw Error('Simulated offline connection');
  return {ok:true,json:async()=>({saved:true})};
 };
 const ids=CARDS.slice(0,14).map(x=>x.id);
 const teams=['PSG','OM'].map((club,i)=>({
  club,identityId:club,roster:ids.slice(i*7,i*7+7)
 }));
 const [scorer,assister]=ids;
 const match={
  phase:'finished',playerStatsVersion:2,
  matchRecordId:'123e4567-e89b-42d3-a456-426614174000',competition:'league',teams,
  match:{
   winner:'PSG',victory:'regulation',score:{PSG:1,OM:0},shootout:null,
   goals:[{club:'PSG',cardId:scorer,assistId:assister,minute:33}],
   history:[{outcome:'goal',details:{
    kind:'open',duel:{outcome:{outcome:'chance'}},
    roles:{carrier:{cardId:assister},partner:{cardId:scorer}}
   }}]
  }
 };
 try{
  assert.equal(queueFinishedLocalGame(match),true);
  await syncQueuedLocalResults();
  assert.equal(pendingLocalResultsCount(),1);
  const pending=JSON.parse(storage.get('opfc-local-trophy-results-v1'));
  assert.equal(pending.length,1);
  assert.equal(pending[0].playerStats[scorer].goals,1);
  assert.equal(pending[0].playerStats[assister].assists,1);
  assert.equal(pending[0].anchorId,scorer);
  // Même résultat rappelé par une interface rechargée : aucun doublon local.
  assert.equal(queueFinishedLocalGame(match),true);
  await syncQueuedLocalResults();
  assert.equal(pendingLocalResultsCount(),1);
  connected=true;
  await syncQueuedLocalResults();
  assert.equal(pendingLocalResultsCount(),0);
  assert.ok(JSON.parse(storage.get('opfc-local-confirmed-trophy-results-v1'))
   .includes(match.matchRecordId));
  assert.equal(queueFinishedLocalGame(match),true);
  assert.equal(pendingLocalResultsCount(),0);
  // Un résultat V1 historique reste compatible, sans inventer de carrière V2.
  const legacy={...match,playerStatsVersion:undefined,
   matchRecordId:'123e4567-e89b-42d3-a456-426614174001'};
  assert.equal(queueFinishedLocalGame(legacy),true);
  await syncQueuedLocalResults();
  const old=sent.find(data=>data.result?.id===legacy.matchRecordId);
  assert.ok(old,'Ancien résultat transmis');
  assert.equal(Object.hasOwn(old.result,'playerStats'),false);
  assert.equal(Object.hasOwn(old.result,'anchorId'),false);
 }finally{
  globalThis.fetch=previousFetch;
  globalThis.localStorage=previousStorage;
 }
});
