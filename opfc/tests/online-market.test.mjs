import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../engine.mjs';
import {onlineMarketPublicView,applyOnlineMarketCommand,marketCommandActor} from '../online-market.mjs';
import {readFileSync} from 'node:fs';

const random=(seed=6)=>()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);
const game=()=>createGame({rng:random(1),dice:[5,2]});
const serialize=o=>JSON.stringify(o);
const action=(s,club,type,extra={})=>applyOnlineMarketCommand(s,club,{type,...extra});
const other=id=>id==='PSG'?'OM':'PSG';
const hiddenStrings=s=>[...s.deck.slice(s.cursor,s.cursor+5)].filter(id=>id!==s.auction.cardId);

test('La vue en ligne ne transmet jamais le paquet, le curseur, l’historique interne ni le secret serveur',()=>{
 const s=game();
 s.onlinePrivate={observations:{PSG:['TEST-SECRET']}};
 const v=onlineMarketPublicView(s,'OM');
 assert.deepEqual(Object.keys(v),['version','phase','teams','dice','auction','lastResult','myObservation']);
 for(const key of ['deck','cursor','onlinePrivate','history','private_state','token','rng'])
  assert.equal(v[key],undefined);
 assert.equal(v.auction.cardId,s.auction.cardId);
 assert.equal(v.myObservation,null);
 assert.equal(serialize(v).includes('TEST-SECRET'),false);
 assert.equal(serialize(v).includes(s.deck.slice(s.cursor).join(',')),false);
 assert.notEqual(v.teams,s.teams);
});

test('Le Haki de l’Observation divulgue cinq cartes seulement à son propriétaire',()=>{
 const s=game(),peek=s.deck.slice(s.cursor,s.cursor+5);
 const {state,publicForActor}=action(s,'OM','observation');
 assert.deepEqual(publicForActor.myObservation,peek);
 assert.deepEqual(onlineMarketPublicView(state,'OM').myObservation,peek);
 const opponentView=onlineMarketPublicView(state,'PSG');
 assert.equal(opponentView.myObservation,null);
 for(const card of peek)assert.equal(opponentView.myObservation?.includes(card),undefined);
 assert.equal(serialize(opponentView).includes('"onlinePrivate"'),false);
 assert.deepEqual(s.teams.find(x=>x.club==='OM').hakis,{observation:false,kings:false});
 assert.throws(()=>action(state,'OM','observation'),/déjà/);
});

test('Une offre et le passage doivent venir du club dont c’est le tour',()=>{
 let s=game(),turn=s.auction.turn,opp=other(turn);
 assert.equal(marketCommandActor(s,{type:'bid'}),turn);
 assert.equal(marketCommandActor(s,{type:'pass'}),turn);
 assert.throws(()=>action(s,opp,'bid',{amount:5}),/ton tour/);
 assert.throws(()=>action(s,opp,'pass'),/ton tour/);
 s=action(s,turn,'bid',{amount:5}).state;
 assert.equal(s.auction.highestBid,5);
 assert.equal(s.auction.highestClub,turn);
 assert.equal(s.auction.turn,opp);
 assert.throws(()=>action(s,turn,'bid',{amount:6}),/ton tour/);
 s=action(s,opp,'pass').state;
 assert.equal(s.lastResult.winner,turn);
 assert.equal(s.teams.find(t=>t.club===turn).roster.length,1);
 assert.equal(s.teams.find(t=>t.club===turn).budget,245);
});

test('Le Haki des Rois, le solo et les prix utilisent strictement le moteur local',()=>{
 let s=game(),priority=s.auction.priority;
 assert.throws(()=>action(s,other(priority),'kings'),/Haki des Rois indisponible|ton tour/);
 s=action(s,priority,'kings').state;
 assert.equal(s.auction.king.holder,priority);
 assert.throws(()=>action(s,priority,'pass'),/obligatoire/);
 s=action(s,priority,'bid',{amount:5}).state;
 assert.equal(s.auction.king.phase,'reply');
 assert.throws(()=>action(s,priority,'bid',{amount:6}),/ton tour/);
 const temp=game();
 temp.teams[0].roster=['luffy','zoro','sanji','nami','chopper','jinbe','robin'];
 temp.auction.solo=true;temp.auction.turn='OM';
 const result=action(temp,'OM','solo');
 assert.equal(result.state.lastResult.price,5);
 assert.throws(()=>action(game(),'PSG','solo'),/Achat seul/);
});

test('Le client ne peut pas imposer son club ni manipuler un état arbitraire',()=>{
 const s=game();
 for(const illegal of [
  {type:'bid',amount:5,club:'OM'},
  {type:'pass',club:'OM'},
  {type:'kings',state:{phase:'finished'}},
  {type:'observation',peek:['secret']},
  {type:'solo',cardId:'luffy'},
  {type:'game-swap'},
  null,'bid',[],{},
  {type:'bid',amount:'5'}, {type:'bid',amount:5.5}, {type:'bid',amount:9999}
 ]){
  assert.throws(()=>applyOnlineMarketCommand(s,'PSG',illegal),/./);
 }
 assert.throws(()=>action(s,'INTRUS','bid',{amount:5}),/Club/);
});

test('Le Haki Observation n’efface pas un tour d’enchère ni les secrets de l’autre',()=>{
 let s=game();
 s=action(s,'PSG','observation').state;
 const before=s.auction.turn;
 s=action(s,'OM','observation').state;
 assert.equal(s.auction.turn,before);
 assert.equal(s.teams.find(t=>t.club==='OM').hakis.observation,true);
 assert.deepEqual(onlineMarketPublicView(s,'PSG').myObservation,s.onlinePrivate.observations.PSG);
 assert.deepEqual(onlineMarketPublicView(s,'OM').myObservation,s.onlinePrivate.observations.OM);
 assert.equal(onlineMarketPublicView(s,'PSG').myObservation===s.onlinePrivate.observations.PSG,false);
});

test('Deux téléphones peuvent alterner les enchères jusqu’aux 14 joueurs',()=>{
 let s=game(),rounds=0;
 while(s.phase==='mercato'){
  if(++rounds>55)throw Error('Boucle impossible');
  if(s.auction.solo){
   const club=s.auction.turn;
   s=action(s,club,'solo').state;
   continue;
  }
  const first=s.auction.turn;
  s=action(s,first,'bid',{amount:5}).state;
  if(s.phase==='mercato'&&s.auction.highestBid===5){
   const challenger=s.auction.turn;
   s=action(s,challenger,'bid',{amount:6}).state;
   if(s.phase==='mercato'&&s.auction.highestBid===6)
    s=action(s,s.auction.turn,'pass').state;
  }
 }
 assert.equal(s.phase,'lineup');
 assert.equal(s.teams[0].roster.length,7);
 assert.equal(s.teams[1].roster.length,7);
 assert.equal(new Set(s.teams.flatMap(t=>t.roster)).size,14);
 const host=onlineMarketPublicView(s,'PSG');
 const guest=onlineMarketPublicView(s,'OM');
 assert.equal(host.phase,'lineup');
 assert.equal(guest.phase,'lineup');
 assert.deepEqual(host.teams,guest.teams);
 assert.equal(host.auction,null);
});

test('La vue de mercato ne peut être utilisée comme état maître pour effectuer une action',()=>{
 const s=game();
 const v=onlineMarketPublicView(s,'PSG');
 assert.throws(()=>applyOnlineMarketCommand(v,'PSG',{type:'bid',amount:5}),/./);
 assert.equal(s.deck.length,50);
});

test('La fonction Edge exige session, rôle, version CAS et renvoie uniquement une vue filtrée',()=>{
 const edge=readFileSync(new URL('../../supabase/functions/opfc-online/index.ts',import.meta.url),'utf8');
 for(const phrase of [
  'authenticateRoom(row,token)',
  'applyOnlineMarketCommand(row.private_state,club,body.command)',
  '.eq(\\'version\\',row.version)',
  '.eq(\\'status\\',\\'ready\\')',
  'expectedVersion',
  'onlineMarketPublicView(row.private_state,club)',
  "if(body.action==='market')return await mutate(body)",
  'game:transition.publicForActor'
 ])assert.ok(edge.includes(phrase),phrase);
 assert.doesNotMatch(edge,/response\\(\\{[^}]*private_state|response\\(row\\)/);
 assert.doesNotMatch(edge,/Math\\.random/);
});
