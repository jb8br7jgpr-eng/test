import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,ready} from '../engine.mjs';
import {kickoffMatch,resolveMatchMoment,continueMatch,resumeMatch} from '../match.mjs';
import {applyOnlineOpenPlayCommand} from '../online-match.mjs';
import {onlinePreMatchView} from '../online-lineup.mjs';
import {createOnlineClient} from '../online-client.mjs';

const API='https://opfc-separate-project.supabase.co/functions/v1/opfc-online';
const ID='6be1626a-69ea-4a97-a858-ef04b5131721',P=['chopper','jinbe','kaido','shanks','nami','luffy','zoro'],O=['loki','mihawk','monkey-d-garp','katakuri','sabo','sanji','kizaru'];
const tokens={host:'A'.repeat(43),guest:'B'.repeat(43)};
const rng=seed=>()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);
function fixture(target){
 let s=createGame({dice:[5,2],rng:rng(1)});
 s.phase='kickoff-ready';s.auction=null;
 for(const t of s.teams){
  t.roster=[...(t.club==='PSG'?P:O)];
  t.slots=[...t.roster];t.formation='2-2-2';t.ready=true;
 }
 s=kickoffMatch(s,rng(8));
 while(s.phase==='match'){
  s=continueMatch(resolveMatchMoment(s,{outcome:'stopped'}));
 }
 if(target==='half-time')return s;
 s=ready(ready(s,'PSG'),'OM');
 s=resumeMatch(s);
 while(s.phase==='match')s=continueMatch(resolveMatchMoment(s,{outcome:'stopped'}));
 assert.equal(s.phase,'shootout-ready');
 return s;
}
function storage(){const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};}
function environment(phase){
 const master={state:fixture(phase),version:1,guest:false};
 const room=role=>({
  protocol:1,id:ID,code:'ABCD23',status:master.guest?'ready':'waiting',
  version:master.version,hostClub:'PSG',guestClub:'OM',
  role,myClub:role==='host'?'PSG':'OM',opponentConnected:master.guest,
  expiresAt:'2030-10-30T12:00:00.000Z'
 });
 const result=(value,status=200)=>({ok:status<400,json:async()=>value});
 const fetchImpl=async(url,args)=>{
  assert.equal(url,API);
  const request=JSON.parse(args.body);
  if(request.action==='create')return result({session:{roomId:ID,club:'PSG',role:'host',token:tokens.host},room:room('host')},201);
  if(request.action==='join'){
   master.guest=true;master.version++;
   return result({session:{roomId:ID,club:'OM',role:'guest',token:tokens.guest},room:room('guest')});
  }
  const role=request.token===tokens.host?'host':request.token===tokens.guest?'guest':null;
  if(!role||request.roomId!==ID)return result({error:'Session invalide'},403);
  const club=role==='host'?'PSG':'OM';
  if(request.action==='get')
   return result({room:room(role),game:onlinePreMatchView(master.state,club)});
  if(request.action==='match'){
   if(request.expectedVersion!==master.version)
    return result({error:'Salon modifié : actualise la partie'},409);
   try{
    let draw=.1;
    if(request.command.type==='shootout-reveal'){
     const n=master.state.match.shootout.timeline.length;
     draw=n===10?0:.999999;
    }
    const t=applyOnlineOpenPlayCommand(master.state,club,request.command,{
     hostClub:'PSG',rng:()=>draw
    });
    master.state=t.state;master.version++;
    return result({room:room(role),game:t.publicForActor});
   }catch(e){return result({error:e.message},400);}
  }
  return result({error:'Action inconnue'},400);
 };
 return {master,fetchImpl};
}
async function connected(phase){
 const {master,fetchImpl}=environment(phase);
 const host=createOnlineClient({apiUrl:API,fetchImpl,storage:storage()});
 const guest=createOnlineClient({apiUrl:API,fetchImpl,storage:storage()});
 await host.createRoom('PSG');await guest.joinRoom('ABCD23');
 await host.refreshRoom();await guest.refreshRoom();
 return {master,host,guest};
}
test('Deux téléphones synchronisent placements mi-temps et seconde période',async()=>{
 const {master,host,guest}=await connected('half-time');
 const schedule=structuredClone(master.state.match.schedule);
 await host.matchAction({type:'half-formation',formation:'3-2-1'});
 await assert.rejects(guest.matchAction({type:'half-ready'}),/actualise/);
 await guest.refreshRoom();
 assert.equal(guest.game.teams.find(t=>t.club==='PSG').formation,'3-2-1');
 assert.equal(guest.game.teams.find(t=>t.club==='PSG').slots.every(x=>x===null),true);
 const roster=master.state.teams.find(t=>t.club==='PSG').roster;
 for(let i=0;i<7;i++)await host.matchAction({type:'half-place',cardId:roster[i],slot:i});
 await host.matchAction({type:'half-ready'});
 await guest.refreshRoom();
 assert.equal(guest.game.teams.find(t=>t.club==='PSG').ready,true);
 await guest.matchAction({type:'half-ready'});
 assert.equal(guest.game.phase,'resume-ready');
 await host.refreshRoom();
 await assert.rejects(guest.matchAction({type:'resume'}),/hôte/);
 await host.matchAction({type:'resume'});
 assert.equal(host.game.phase,'match');
 await guest.refreshRoom();
 assert.equal(guest.game.phase,'match');
 assert.deepEqual(guest.game.teams,host.game.teams);
 assert.deepEqual(master.state.match.schedule,schedule);
 assert.equal(host.game.match.schedule,undefined);
 assert.equal(guest.game.deck,undefined);
});
test('Deux téléphones réalisent 12 tirs, directions cachées, mort subite et résultat final',async()=>{
 const {master,host,guest}=await connected('shootout-ready');
 await assert.rejects(guest.matchAction({type:'begin-shootout'}),/hôte/);
 await host.matchAction({type:'begin-shootout'});
 await guest.refreshRoom();
 assert.equal(host.game.phase,'shootout');
 assert.equal(guest.game.match.shootout.firstClub,'PSG');
 for(let n=0;n<12;n++){
  const shooter=master.state.match.shootout.nextClub;
  const attack=shooter==='PSG'?host:guest;
  const defend=shooter==='PSG'?guest:host;
  await attack.refreshRoom();await defend.refreshRoom();
  await attack.matchAction({type:'shootout-choose',choice:'GAUCHE'});
  await assert.rejects(defend.matchAction({type:'shootout-choose',choice:'DROITE'}),/actualise/);
  await defend.refreshRoom();
  assert.equal(defend.game.match.shootout.confirmed.shooter,true);
  assert.equal(defend.game.match.shootout.confirmed.keeper,false);
  assert.equal(Object.hasOwn(defend.game.match.shootout,'shotDirection'),false);
  assert.equal(defend.game.match.shootout.timeline.length,n);
  assert.equal(defend.game.match.shootout.lastResult,null);
  await defend.matchAction({type:'shootout-choose',choice:'DROITE'});
  await attack.refreshRoom();
  assert.equal(attack.game.match.shootout.confirmed.keeper,true);
  assert.equal(attack.game.match.shootout.timeline.length,n);
  await attack.matchAction({type:'shootout-reveal'});
  assert.equal(attack.game.match.shootout.timeline.length,n+1);
  assert.equal(attack.game.match.shootout.timeline.at(-1).probabilities,undefined);
  await defend.refreshRoom();
  assert.deepEqual(defend.game.match.shootout.score,attack.game.match.shootout.score);
  assert.equal(defend.game.match.score.PSG+defend.game.match.score.OM,0);
  assert.equal(defend.game.match.shootout.lastResult.scored,n!==10);
  await attack.matchAction({type:'shootout-continue'});
  assert.equal(attack.game.match.shootout.lastResult,null);
 }
 assert.equal(master.state.phase,'finished');
 assert.equal(master.state.match.winner,'OM');
 assert.deepEqual(master.state.match.shootout.score,{PSG:5,OM:6});
 assert.deepEqual(master.state.match.score,{PSG:0,OM:0});
 await host.refreshRoom();await guest.refreshRoom();
 assert.equal(host.game.phase,'finished');
 assert.equal(guest.game.phase,'finished');
 assert.equal(host.game.match.winner,'OM');
 assert.deepEqual(host.game.match.shootout.timeline,guest.game.match.shootout.timeline);
 assert.equal(host.game.match.shootout.timeline.length,12);
 assert.equal(host.game.match.shootout.timeline.some(t=>t.probabilities!==undefined),false);
 assert.equal(guest.game.match.shootout.lastResult,null);
});
test('Une session déconnectée reprend la séance sans récupérer les directions privées',async()=>{
 const {host,guest}=await connected('shootout-ready');
 await host.matchAction({type:'begin-shootout'});
 await host.matchAction({type:'shootout-choose',choice:'GAUCHE'});
 await guest.refreshRoom();
 const state=guest.game.match.shootout;
 assert.equal(state.confirmed.shooter,true);
 assert.equal(state.confirmed.keeper,false);
 assert.equal(state.timeline.length,0);
 assert.equal(state.shotDirection,undefined);
 assert.equal(state.keeperDirection,undefined);
 assert.equal(state.orders,undefined);
 assert.equal(state.keepers,undefined);
 await assert.rejects(guest.matchAction({type:'shootout-reveal'}),/directions|tireur/);
 await guest.matchAction({type:'shootout-choose',choice:'DROITE'});
 await host.refreshRoom();
 assert.equal(host.game.match.shootout.confirmed.keeper,true);
 assert.equal(host.game.match.shootout.timeline.length,0);
});
