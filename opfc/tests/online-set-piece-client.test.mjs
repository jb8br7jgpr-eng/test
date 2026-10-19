import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../engine.mjs';
import {kickoffMatch} from '../match.mjs';
import {applyOnlineOpenPlayCommand} from '../online-match.mjs';
import {onlinePreMatchView} from '../online-lineup.mjs';
import {createOnlineClient} from '../online-client.mjs';

const API='https://opfc-separate-project.supabase.co/functions/v1/opfc-online';
const UUID='6be1626a-69ea-4a97-a858-ef04b5131721';
const TOKENS={host:'A'.repeat(43),guest:'B'.repeat(43)};
const PSG=['chopper','jinbe','kaido','shanks','nami','luffy','zoro'];
const OM=['loki','mihawk','monkey-d-garp','katakuri','sabo','sanji','kizaru'];
const rng=seed=>()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);
function fixture(kind){
 const s=createGame({dice:[5,2],rng:rng(1)});
 s.phase='kickoff-ready';s.auction=null;
 for(const team of s.teams){
  team.roster=[...(team.club==='PSG'?PSG:OM)];
  team.slots=[...team.roster];team.formation='2-2-2';team.ready=true;
 }
 for(let seed=1;seed<=1800;seed++){
  const match=kickoffMatch(s,rng(seed));
  if(match.match.schedule[0].type===kind)return match;
 }
 throw Error('Aucune séquence '+kind);
}
const store=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
function server(kind){
 const remote={game:fixture(kind),version:1,joined:false,requests:[]};
 const room=role=>({
  protocol:1,id:UUID,code:'ABCD23',status:remote.joined?'ready':'waiting',
  version:remote.version,hostClub:'PSG',guestClub:'OM',
  role,myClub:role==='host'?'PSG':'OM',opponentConnected:remote.joined,
  expiresAt:'2030-10-30T12:00:00Z'
 });
 const reply=(json,status=200)=>({ok:status<400,json:async()=>json});
 const fetchImpl=async(url,request)=>{
  assert.equal(url,API);
  const body=JSON.parse(request.body);
  remote.requests.push(body);
  if(body.action==='create')return reply({
   room:room('host'),session:{roomId:UUID,role:'host',club:'PSG',token:TOKENS.host}
  },201);
  if(body.action==='join'){
   remote.joined=true;remote.version++;
   return reply({room:room('guest'),
    session:{roomId:UUID,role:'guest',club:'OM',token:TOKENS.guest}});
  }
  const role=body.token===TOKENS.host?'host':body.token===TOKENS.guest?'guest':null;
  if(!role||body.roomId!==UUID)return reply({error:'Accès refusé'},403);
  const club=role==='host'?'PSG':'OM';
  if(body.action==='get')return reply({room:room(role),game:onlinePreMatchView(remote.game,club)});
  if(body.action==='match'){
   if(body.expectedVersion!==remote.version)
    return reply({error:'Salon modifié : actualise la partie'},409);
   try{
    const draw=body.command.type==='reveal-setpiece-duel'?0:
      ['reveal-penalty','finish-corner','continue-setpiece-duel'].includes(body.command.type)? .99999 : .2;
    const t=applyOnlineOpenPlayCommand(remote.game,club,body.command,{rng:()=>draw});
    remote.game=t.state;remote.version++;
    return reply({room:room(role),game:t.publicForActor});
   }catch(e){return reply({error:e.message},400);}
  }
  return reply({error:'Action inconnue'},400);
 };
 return {remote,fetchImpl};
}
async function connected(kind){
 const {remote,fetchImpl}=server(kind);
 const host=createOnlineClient({apiUrl:API,storage:store(),fetchImpl});
 const guest=createOnlineClient({apiUrl:API,storage:store(),fetchImpl});
 await host.createRoom('PSG');
 await guest.joinRoom('ABCD23');
 await host.refreshRoom();await guest.refreshRoom();
 const attacker=remote.game.match.schedule[0].attacker;
 const attack=attacker==='PSG'?host:guest;
 const defense=attacker==='PSG'?guest:host;
 return {remote,host,guest,attack,defense,attacker};
}
const sameState=async c=>{
 await c.host.refreshRoom();await c.guest.refreshRoom();
 assert.deepEqual(c.host.game.match.score,c.guest.game.match.score);
 assert.equal(c.host.game.match.schedule,undefined);
 assert.equal(c.guest.game.match.schedule,undefined);
};
test('Deux iPhone : corner complet, choix caché et 409 après action adversaire',async()=>{
 const c=await connected('corner');
 const {remote,attack,defense,attacker}=c;
 const original=structuredClone(remote.game.match.schedule);
 await attack.matchAction({type:'begin-setpiece'});
 await defense.refreshRoom();
 assert.equal(defense.game.match.action.kind,'corner');
 assert.equal(defense.game.match.action.stage,'taker-choice');
 const taker=remote.game.teams.find(t=>t.club===attacker).slots[4];
 await assert.rejects(defense.matchAction({type:'select-taker',takerId:taker}),/tour/);
 await attack.matchAction({type:'select-taker',takerId:taker});
 await defense.refreshRoom();
 assert.equal(defense.game.match.action.actors.taker.cardId,taker);
 await attack.matchAction({type:'choose',choice:'PREMIER'});
 await assert.rejects(defense.matchAction({type:'choose',choice:'SECOND'}),/actualise/);
 await defense.refreshRoom();
 assert.equal(defense.game.match.action.choices,undefined);
 assert.equal(defense.game.match.action.confirmed.attacker,true);
 await defense.matchAction({type:'choose',choice:'SECOND'});
 await attack.refreshRoom();
 assert.equal(attack.game.match.action.duel,undefined);
 await attack.matchAction({type:'reveal-setpiece-duel'});
 assert.equal(attack.game.match.action.duel.outcome.outcome,'chance');
 await attack.matchAction({type:'continue-setpiece-duel'});
 await attack.matchAction({type:'choose',choice:'TETE'});
 assert.equal(attack.game.match.action.choices,undefined);
 await attack.matchAction({type:'finish-corner'});
 assert.equal(attack.game.phase,'moment-result');
 assert.equal(attack.game.match.lastResult.outcome,'goal');
 assert.equal(remote.game.match.score[attacker],1);
 await sameState(c);
 assert.equal(defense.game.match.history.length,1);
 assert.deepEqual(remote.game.match.schedule,original);
 await attack.matchAction({type:'continue-result'});
 await sameState(c);
 assert.equal(c.host.game.match.index,1);
 assert.equal(c.guest.game.match.index,1);
});
test('Deux iPhone : penalty, double confirmation secrète et score unique',async()=>{
 const c=await connected('penalty');
 const {remote,attack,defense,attacker}=c;
 const original=structuredClone(remote.game.match.schedule);
 await attack.matchAction({type:'begin-setpiece'});
 const taker=remote.game.teams.find(t=>t.club===attacker).slots[2];
 await attack.matchAction({type:'select-taker',takerId:taker});
 await attack.matchAction({type:'choose',choice:'GAUCHE'});
 await defense.refreshRoom();
 assert.equal(defense.game.match.action.stage,'defense-choice');
 assert.equal(defense.game.match.action.choices,undefined);
 await defense.matchAction({type:'choose',choice:'DROITE'});
 await attack.refreshRoom();
 assert.equal(attack.game.match.action.stage,'penalty-ready');
 assert.equal(attack.game.match.action.choices,undefined);
 await assert.rejects(defense.matchAction({type:'reveal-penalty'}),/actualise|tour/);
 await attack.matchAction({type:'reveal-penalty'});
 await sameState(c);
 assert.equal(remote.game.match.history.length,1);
 assert.equal(remote.game.match.score[attacker],1);
 assert.equal(remote.game.match.lastResult.scorerId,taker);
 assert.deepEqual(remote.game.match.schedule,original);
});
test('Deux iPhone : coup franc, finition calculée sans seconde décision du gardien',async()=>{
 const c=await connected('free-kick');
 const {remote,attack,defense,attacker}=c;
 await attack.matchAction({type:'begin-setpiece'});
 const taker=remote.game.teams.find(t=>t.club===attacker).slots[3];
 await attack.matchAction({type:'select-taker',takerId:taker});
 await attack.matchAction({type:'choose',choice:'CENTRE'});
 await defense.refreshRoom();
 await defense.matchAction({type:'choose',choice:'MUR'});
 await attack.refreshRoom();
 await attack.matchAction({type:'reveal-setpiece-duel'});
 assert.equal(remote.game.match.action.duel.outcome.outcome,'chance');
 await attack.matchAction({type:'continue-setpiece-duel'});
 await sameState(c);
 assert.equal(remote.game.phase,'moment-result');
 assert.equal(remote.game.match.history.length,1);
 assert.equal(remote.game.match.statistics[attacker].shots,1);
 assert.equal(remote.game.match.lastResult.outcome,'goal');
 assert.equal(c.guest.game.match.action,null);
});
test('Un ancien client ne peut ni écraser une réponse plus récente ni forcer un résultat',async()=>{
 const c=await connected('penalty');
 const {remote,attack,defense,attacker}=c;
 await attack.matchAction({type:'begin-setpiece'});
 await assert.rejects(defense.matchAction({type:'select-taker',takerId:'luffy'}),/actualise/);
 assert.equal(remote.game.match.action.stage,'taker-choice');
 await defense.refreshRoom();
 await assert.rejects(defense.matchAction({type:'select-taker',takerId:'luffy'}),/tour/);
 await assert.rejects(attack.matchAction({type:'reveal-penalty',outcome:'goal'}),/interdit/);
 assert.equal(remote.game.match.history.length,0);
 assert.equal(remote.game.match.score.PSG+remote.game.match.score.OM,0);
});
