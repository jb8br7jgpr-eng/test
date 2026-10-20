import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../engine.mjs';
import {createOnlineClient} from '../online-client.mjs';
import {onlineMarketPublicView,applyOnlineMarketCommand} from '../online-market.mjs';

const UUID='6be1626a-69ea-4a97-a858-ef04b5131721';
const TOKENS={host:'A'.repeat(43),guest:'B'.repeat(43)};
const API='https://opfc-separate-project.supabase.co/functions/v1/opfc-online';
const random=(seed=1)=>()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);
const initial=()=>createGame({dice:[5,2],rng:random(9)});
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
function fakeServer(){
 const server={version:1,status:'waiting',guest:false,game:initial(),requests:[]};
 const club=role=>role==='host'?'PSG':'OM';
 const room=role=>({
  protocol:1,id:UUID,code:'ABCD23',status:server.status,
  version:server.version,hostClub:'PSG',guestClub:'OM',
  role,myClub:club(role),opponentConnected:server.guest,
  expiresAt:'2030-10-30T12:00:00Z'
 });
 const response=(json,status=200)=>({ok:status<400,json:async()=>json});
 const fetchImpl=async(url,request)=>{
  assert.equal(url,API);
  const data=JSON.parse(request.body);
  server.requests.push({data,request});
  if(data.action==='create')return response({
   session:{roomId:UUID,club:'PSG',role:'host',token:TOKENS.host},
   room:room('host')
  },201);
  if(data.action==='join'){
   if(data.code!=='ABCD23'||server.guest)return response({error:'Salon indisponible'},409);
   server.guest=true;server.status='ready';server.version++;
   return response({
    session:{roomId:UUID,club:'OM',role:'guest',token:TOKENS.guest},
    room:room('guest')
   });
  }
  const role=data.token===TOKENS.host?'host':data.token===TOKENS.guest?'guest':null;
  if(!role||data.roomId!==UUID)return response({error:'Accès refusé'},403);
  if(data.action==='get')
   return response({room:room(role),game:server.guest?onlineMarketPublicView(server.game,club(role)):null});
  if(data.action==='market'){
   if(data.expectedVersion!==server.version)return response({error:'Salon modifié : actualise la partie'},409);
   let result;
   try{result=applyOnlineMarketCommand(server.game,club(role),data.command);}
   catch(e){return response({error:e.message},400);}
   server.game=result.state;server.version++;
   return response({room:room(role),game:result.publicForActor});
  }
  return response({error:'Action inconnue'},400);
 };
 return {server,fetchImpl};
}
test('Deux iPhone : créer, rejoindre, récupérer le même état par joueur',async()=>{
 const {server,fetchImpl}=fakeServer();
 const host=createOnlineClient({apiUrl:API,fetchImpl,storage:storage()});
 const guest=createOnlineClient({apiUrl:API,fetchImpl,storage:storage()});
 await host.createRoom('PSG');
 assert.equal(host.room.status,'waiting');
 await guest.joinRoom('ABCD23');
 assert.equal(guest.room.status,'ready');
 await host.refreshRoom();await guest.refreshRoom();
 assert.equal(host.marketGame.auction.cardId,server.game.auction.cardId);
 assert.deepEqual(host.marketGame.teams,guest.marketGame.teams);
 assert.equal(host.marketGame.deck,undefined);
 assert.equal(guest.marketGame.deck,undefined);
 assert.equal(host.room.version,2);
});
test('Action host, état guest, conflit de version et reprise sans écrasement',async()=>{
 const {server,fetchImpl}=fakeServer();
 const host=createOnlineClient({apiUrl:API,fetchImpl,storage:storage()});
 const guest=createOnlineClient({apiUrl:API,fetchImpl,storage:storage()});
 await host.createRoom('PSG');await guest.joinRoom('ABCD23');
 await host.refreshRoom();await guest.refreshRoom();
 const initialVersion=host.room.version,card=host.marketGame.auction.cardId;
 const afterBid=await host.marketAction({type:'bid',amount:5});
 assert.equal(afterBid.auction.highestClub,'PSG');
 assert.equal(server.version,initialVersion+1);
 await assert.rejects(guest.marketAction({type:'bid',amount:6}),/actualise/);
 assert.equal(server.game.auction.highestBid,5);
 assert.equal(guest.room.version,initialVersion);
 await guest.refreshRoom();
 assert.equal(guest.marketGame.auction.cardId,card);
 assert.equal(guest.marketGame.auction.highestBid,5);
 await guest.marketAction({type:'bid',amount:6});
 assert.equal(host.marketGame.auction.highestBid,5); // Pas de mutation locale cachée.
 await host.refreshRoom();
 assert.equal(host.marketGame.auction.highestBid,6);
 await host.marketAction({type:'pass'});
 assert.equal(server.game.lastResult.winner,'OM');
 await guest.refreshRoom();
 assert.equal(guest.marketGame.teams.find(t=>t.club==='OM').roster.length,1);
 assert.equal(host.marketGame.deck,undefined);
 assert.equal(guest.marketGame.deck,undefined);
});
test('Haki Observation reste réservé au téléphone de son propriétaire',async()=>{
 const {fetchImpl}=fakeServer();
 const host=createOnlineClient({apiUrl:API,fetchImpl,storage:storage()});
 const guest=createOnlineClient({apiUrl:API,fetchImpl,storage:storage()});
 await host.createRoom();await guest.joinRoom('ABCD23');
 await host.refreshRoom();await guest.refreshRoom();
 const revealed=await guest.marketAction({type:'observation'});
 assert.equal(revealed.myObservation.length,5);
 assert.equal(guest.marketGame.myObservation.length,5);
 await host.refreshRoom();
 assert.equal(host.marketGame.myObservation,null);
 await assert.rejects(guest.marketAction({type:'observation'}),/déjà/);
});
test('Les deux clients ne peuvent pas choisir le club via la commande réseau',async()=>{
 const {server,fetchImpl}=fakeServer();
 const host=createOnlineClient({apiUrl:API,fetchImpl,storage:storage()});
 const guest=createOnlineClient({apiUrl:API,fetchImpl,storage:storage()});
 await host.createRoom();await guest.joinRoom('ABCD23');
 await host.refreshRoom();await guest.refreshRoom();
 await assert.rejects(guest.marketAction({type:'bid',amount:5}),/ton tour/);
 await assert.rejects(host.marketAction({type:'bid',amount:5,club:'OM'}),/interdit/);
 assert.equal(server.version,2);
 assert.equal(server.game.auction.highestBid,0);
});

test('Un salon contenant des identités inventées ou dupliquées est rejeté',async()=>{
 const {server,fetchImpl}=fakeServer();
 const host=createOnlineClient({apiUrl:API,fetchImpl,storage:storage()});
 const guest=createOnlineClient({apiUrl:API,fetchImpl,storage:storage()});
 await host.createRoom('PSG');await guest.joinRoom('ABCD23');
 server.game.teams[0].identityId='FAUX';
 await assert.rejects(host.refreshRoom(),/Identités de clubs/);
 server.game.teams[0].identityId='BDW';
 server.game.teams[1].identityId='BDW';
 await assert.rejects(guest.refreshRoom(),/Identités de clubs/);
 server.game.teams[1].identityId='BDR';
 await host.refreshRoom();
 assert.deepEqual(host.game.teams.map(t=>t.identityId),['BDW','BDR']);
});
