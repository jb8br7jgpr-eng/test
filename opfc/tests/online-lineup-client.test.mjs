import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../engine.mjs';
import {createOnlineClient} from '../online-client.mjs';
import {applyOnlineLineupCommand,onlinePreMatchView} from '../online-lineup.mjs';
const UUID='6be1626a-69ea-4a97-a858-ef04b5131721';
const TOKENS={host:'A'.repeat(43),guest:'B'.repeat(43)};
const API='https://opfc-separate-project.supabase.co/functions/v1/opfc-online';
const random=(seed=9)=>()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);
function storage(){
 const m=new Map();
 return {getItem:key=>m.get(key)??null,setItem:(key,v)=>m.set(key,v),removeItem:key=>m.delete(key)};
}
function serverFixture(){
 const s=createGame({dice:[5,2],rng:random(1)});
 s.phase='lineup';s.auction=null;
 const PSG=['chopper','jinbe','kaido','shanks','nami','luffy','zoro'];
 const OM=['loki','mihawk','monkey-d-garp','katakuri','sabo','sanji','kizaru'];
 for(const t of s.teams){
  t.roster=[...(t.club==='PSG'?PSG:OM)];t.slots=Array(7).fill(null);t.ready=false;
 }
 const server={game:s,version:1,guest:false,requests:[]};
 const room=role=>({
  protocol:1,id:UUID,code:'ABCD23',status:server.guest?'ready':'waiting',
  version:server.version,hostClub:'PSG',guestClub:'OM',role,
  myClub:role==='host'?'PSG':'OM',opponentConnected:server.guest,
  expiresAt:'2030-10-30T12:00:00Z'
 });
 const reply=(body,code=200)=>({ok:code<400,json:async()=>body});
 const fetchImpl=async(url,request)=>{
  assert.equal(url,API);
  const body=JSON.parse(request.body);
  server.requests.push(body);
  if(body.action==='create')
   return reply({room:room('host'),session:{roomId:UUID,club:'PSG',role:'host',token:TOKENS.host}},201);
  if(body.action==='join'){
   server.guest=true;server.version++;
   return reply({room:room('guest'),session:{roomId:UUID,club:'OM',role:'guest',token:TOKENS.guest}});
  }
  const role=body.token===TOKENS.host?'host':body.token===TOKENS.guest?'guest':null;
  if(!role||body.roomId!==UUID)return reply({error:'Accès refusé'},403);
  const club=role==='host'?'PSG':'OM';
  if(body.action==='get')return reply({room:room(role),game:onlinePreMatchView(server.game,club)});
  if(body.action==='lineup'){
   if(body.expectedVersion!==server.version)return reply({error:'Salon modifié : actualise la partie'},409);
   try{
    const result=applyOnlineLineupCommand(server.game,club,body.command,{hostClub:'PSG',rng:random(5)});
    server.game=result.state;server.version++;
    return reply({room:room(role),game:result.publicForActor});
   }catch(e){return reply({error:e.message},400);}
  }
  return reply({error:'Commande inconnue'},400);
 };
 return {server,fetchImpl};
}
async function joinBoth(){
 const {server,fetchImpl}=serverFixture();
 const host=createOnlineClient({apiUrl:API,fetchImpl,storage:storage()});
 const guest=createOnlineClient({apiUrl:API,fetchImpl,storage:storage()});
 await host.createRoom('PSG');await guest.joinRoom('ABCD23');
 await host.refreshRoom();await guest.refreshRoom();
 return {server,host,guest};
}
test('Les compositions des deux iPhone se mettent à jour sans toucher au club adverse',async()=>{
 const {server,host,guest}=await joinBoth();
 await host.lineupAction({type:'place',cardId:'luffy',slot:1});
 assert.equal(server.game.teams.find(t=>t.club==='PSG').slots[1],'luffy');
 assert.equal(guest.game.teams.find(t=>t.club==='PSG').slots[1],null);
 await guest.refreshRoom();
 assert.equal(guest.game.teams.find(t=>t.club==='PSG').slots[1],'luffy');
 await assert.rejects(guest.lineupAction({type:'place',cardId:'luffy',slot:0}),/club/);
 assert.equal(server.game.teams.find(t=>t.club==='OM').slots[0],null);
});
test('Conflit concurrent de placement : on actualise avant le second coup',async()=>{
 const {server,host,guest}=await joinBoth();
 await host.lineupAction({type:'formation',formation:'2-3-1'});
 const version=server.version;
 await assert.rejects(guest.lineupAction({type:'place',cardId:'loki',slot:1}),/actualise/);
 assert.equal(server.version,version);
 await guest.refreshRoom();
 await guest.lineupAction({type:'place',cardId:'loki',slot:1});
 assert.equal(server.game.teams.find(t=>t.club==='OM').slots[1],'loki');
});
test('Deux équipes prêtes : coup d’envoi uniquement par l’hôte, minute et calendrier secrets',async()=>{
 const {server,host,guest}=await joinBoth();
 const roster={PSG:server.game.teams.find(t=>t.club==='PSG').roster,
  OM:server.game.teams.find(t=>t.club==='OM').roster};
 for(const slot of [0,1,2,3,4,5,6]){
  await host.refreshRoom();
  await host.lineupAction({type:'place',cardId:roster.PSG[slot],slot});
  await guest.refreshRoom();
  await guest.lineupAction({type:'place',cardId:roster.OM[slot],slot});
 }
 await host.refreshRoom();await host.lineupAction({type:'ready'});
 await guest.refreshRoom();await guest.lineupAction({type:'ready'});
 assert.equal(guest.game.phase,'kickoff-ready');
 assert.equal(server.game.phase,'kickoff-ready');
 await assert.rejects(guest.lineupAction({type:'kickoff'}),/hôte/);
 await host.refreshRoom();await host.lineupAction({type:'kickoff'});
 assert.equal(host.game.phase,'match');
 assert.equal(host.game.match.index,0);
 assert.equal(host.game.match.schedule,undefined);
 assert.equal(host.game.deck,undefined);
 assert.equal(host.game.onlinePrivate,undefined);
 assert.equal(server.game.match.schedule.length>=10,true);
 await guest.refreshRoom();
 assert.deepEqual(guest.game.match,host.game.match);
 assert.equal(guest.game.match.schedule,undefined);
 await assert.rejects(host.lineupAction({type:'formation',formation:'3-2-1'}),/compositions/);
});
