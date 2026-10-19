import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../engine.mjs';
import {kickoffMatch} from '../match.mjs';
import {calculateOpenPlay} from '../open-play.mjs';
import {onlinePreMatchView} from '../online-lineup.mjs';
import {applyOnlineOpenPlayCommand} from '../online-match.mjs';
import {createOnlineClient} from '../online-client.mjs';

const API='https://opfc-separate-project.supabase.co/functions/v1/opfc-online';
const UUID='6be1626a-69ea-4a97-a858-ef04b5131721';
const TOKENS={host:'A'.repeat(43),guest:'B'.repeat(43)};
const P=['chopper','jinbe','kaido','shanks','nami','luffy','zoro'];
const O=['loki','mihawk','monkey-d-garp','katakuri','sabo','sanji','kizaru'];
const rng=seed=>()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
function kickoff(){
 const s=createGame({dice:[5,2],rng:rng(4)});
 s.phase='kickoff-ready';s.auction=null;
 for(const t of s.teams){
  t.roster=[...(t.club==='PSG'?P:O)];t.slots=[...t.roster];
  t.formation='2-2-2';t.ready=true;
 }
 for(let seed=1;seed<400;seed++){
  const next=kickoffMatch(s,rng(seed));
  if(next.match.schedule[0].type==='open')return next;
 }
 throw Error('Aucun match en jeu ouvert trouvé');
}
function fakeServer(){
 const server={game:kickoff(),version:1,guest:false,requests:[]};
 const room=role=>({
  protocol:1,id:UUID,code:'ABCD23',status:server.guest?'ready':'waiting',
  version:server.version,hostClub:'PSG',guestClub:'OM',
  role,myClub:role==='host'?'PSG':'OM',opponentConnected:server.guest,
  expiresAt:'2030-10-30T12:00:00Z'
 });
 const reply=(json,code=200)=>({ok:code<400,json:async()=>json});
 const fetchImpl=async(url,init)=>{
  assert.equal(url,API);
  const body=JSON.parse(init.body);
  server.requests.push(body);
  if(body.action==='create')return reply({
   session:{roomId:UUID,role:'host',club:'PSG',token:TOKENS.host},room:room('host')
  },201);
  if(body.action==='join'){
   server.guest=true;server.version++;
   return reply({
    session:{roomId:UUID,role:'guest',club:'OM',token:TOKENS.guest},room:room('guest')
   });
  }
  const role=body.token===TOKENS.host?'host':body.token===TOKENS.guest?'guest':null;
  if(!role||body.roomId!==UUID)return reply({error:'Accès refusé'},403);
  const club=role==='host'?'PSG':'OM';
  if(body.action==='get')
   return reply({room:room(role),game:onlinePreMatchView(server.game,club)});
  if(body.action==='match'){
   if(body.expectedVersion!==server.version)
    return reply({error:'Salon modifié : actualise la partie'},409);
   try{
    let draw=.3;
    if(body.command.type==='reveal-duel'){
     const a=server.game.match.action;
     const calc=calculateOpenPlay({...a.roles,attack:a.choices.attack,
      defense:a.choices.defense,chemistryBonus:a.chemistryBonus});
     draw=(calc.foulProbability+calc.successProbability/2)/100;
    }
    if(body.command.type==='reveal-shot')draw=.999999;
    const result=applyOnlineOpenPlayCommand(server.game,club,body.command,{rng:()=>draw});
    server.game=result.state;server.version++;
    return reply({room:room(role),game:result.publicForActor});
   }catch(e){return reply({error:e.message},400);}
  }
  return reply({error:'Action non autorisée'},400);
 };
 return {server,fetchImpl};
}
async function joined(){
 const {server,fetchImpl}=fakeServer();
 const p=createOnlineClient({apiUrl:API,storage:storage(),fetchImpl});
 const o=createOnlineClient({apiUrl:API,storage:storage(),fetchImpl});
 await p.createRoom('PSG');await o.joinRoom('ABCD23');
 await p.refreshRoom();await o.refreshRoom();
 return {server,p,o,attacker:server.game.match.schedule[0].attacker};
}
test('Deux iPhone : un seul peut commencer la première attaque',async()=>{
 const {server,p,o,attacker}=await joined();
 const attacking=attacker==='PSG'?p:o,defending=attacker==='PSG'?o:p;
 await assert.rejects(defending.matchAction({type:'begin-open'}),/attaquant/);
 const started=await attacking.matchAction({type:'begin-open'});
 assert.equal(started.match.action.stage,'attack-choice');
 assert.equal(server.game.match.action.stage,'attack-choice');
 assert.equal(started.match.schedule,undefined);
 assert.equal(started.match.action.choices,undefined);
 await defending.refreshRoom();
 assert.equal(defending.game.match.action.stage,'attack-choice');
});
test('Choix adverse masqué, rejet conflit 409, résolution et score synchronisé',async()=>{
 const {server,p,o,attacker}=await joined();
 const attacking=attacker==='PSG'?p:o,defending=attacker==='PSG'?o:p;
 await attacking.matchAction({type:'begin-open'});
 await defending.refreshRoom();
 await attacking.matchAction({type:'choose',choice:'COMBINER'});
 await assert.rejects(defending.matchAction({type:'choose',choice:'CONTENIR'}),/actualise/);
 await defending.refreshRoom();
 assert.equal(defending.game.match.action.stage,'defense-choice');
 // Les noms de tactiques sont des étiquettes publiques ; seuls
 // les champs de confirmation des décisions doivent rester absents.
 assert.equal(defending.game.match.action.choices,undefined);
 assert.equal(defending.game.match.action.duel,undefined);
 await defending.matchAction({type:'choose',choice:'CONTENIR'});
 await attacking.refreshRoom();
 assert.equal(attacking.game.match.action.stage,'duel-ready');
 assert.equal(attacking.game.match.action.duel,undefined);
 await attacking.matchAction({type:'reveal-duel'});
 await defending.refreshRoom();
 assert.equal(defending.game.match.action.stage,'duel-revealed');
 assert.equal(defending.game.match.action.duel.calculation.attack,'COMBINER');
 await attacking.matchAction({type:'continue-duel'});
 await attacking.matchAction({type:'choose',choice:'PLACEE'});
 await defending.refreshRoom();
 assert.equal(defending.game.match.action.stage,'shot-defense-choice');
 assert.equal(JSON.stringify(defending.game).includes('"PLACEE"'),false);
 await defending.matchAction({type:'choose',choice:'LIGNE'});
 await attacking.refreshRoom();
 assert.equal(attacking.game.match.action.stage,'shot-ready');
 await attacking.matchAction({type:'reveal-shot'});
 assert.equal(server.game.phase,'moment-result');
 assert.equal(server.game.match.score[attacker],1);
 assert.equal(attacking.game.match.lastResult.outcome,'goal');
 assert.equal(attacking.game.match.history.length,1);
 await defending.refreshRoom();
 assert.equal(defending.game.match.score[attacker],1);
 assert.equal(defending.game.match.schedule,undefined);
 await assert.rejects(defending.matchAction({type:'continue-result'}),/attaquant/);
 await attacking.matchAction({type:'continue-result'});
 await defending.refreshRoom();
 assert.equal(defending.game.match.index,1);
 assert.equal(server.game.match.index,1);
 assert.equal(attacking.game.match.history.length,1);
 assert.equal(defending.game.match.history.length,1);
});
test('Le client refuse un retour contenant calendrier, décisions ou hasard secret',async()=>{
 const {p}=await joined();
 const known=p.game;
 assert.equal(known.match.schedule,undefined);
 assert.equal(known.match.action,undefined);
 assert.equal(known.deck,undefined);
 assert.equal(known.onlinePrivate,undefined);
 assert.equal(known.cursor,undefined);
 await assert.rejects(p.matchAction({type:'unknown'}),/invalide|inconnue/);
});
