import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createOnlineClient,validateOnlineApiUrl,ONLINE_SESSION_KEY} from '../online-client.mjs';
import {renderOnlineLobby,normalizeJoinCodeInput} from '../ui-online.mjs';
import {OPFC_ONLINE_API_URL} from '../online-config.mjs';

const base='https://opfc-separate-project.supabase.co/functions/v1/opfc-online';
const id='6be1626a-69ea-4a97-a858-ef04b5131721',token='A'.repeat(43);
const room=(changes={})=>({
 protocol:1,id,code:'ABCD23',status:'waiting',version:1,
 hostClub:'PSG',guestClub:'OM',role:'host',myClub:'PSG',
 opponentConnected:false,expiresAt:'2030-10-30T12:00:00.000Z',...changes
});
const session=(changes={})=>({roomId:id,role:'host',club:'PSG',token,...changes});
const storage=()=>{
 const data=new Map();
 return {data,
  getItem:key=>data.get(key)??null,
  setItem:(key,v)=>data.set(key,v),
  removeItem:key=>data.delete(key)
 };
};
function fixture(){
 const store=storage(),requests=[],responses=[];
 const fetchImpl=async(url,init)=>{
  requests.push({url,init,body:JSON.parse(init.body)});
  if(!responses.length)throw Error('Fausse réponse non préparée');
  const next=responses.shift();
  if(next instanceof Error)throw next;
  return {ok:next.ok??true,json:async()=>next.json};
 };
 const client=createOnlineClient({apiUrl:base,storage:store,fetchImpl,timeoutMs:3000});
 return {client,store,requests,responses};
}
test('Un client explicitement non configuré doit refuser les connexions',async()=>{
 assert.equal(OPFC_ONLINE_API_URL,'https://cihzwaxernachchpjktj.supabase.co/functions/v1/opfc-online');
 const f=createOnlineClient({apiUrl:'',fetchImpl:()=>{throw Error('appel interdit')}});
 assert.equal(f.configured,false);
 await assert.rejects(f.createRoom('PSG'),/pas encore configuré/);
 await assert.rejects(f.joinRoom('ABCD23'),/pas encore configuré/);
 assert.equal(f.hasSession,false);
});
test('Interdiction explicite des projets Supabase du classique et d’ARCHIPEL',()=>{
 assert.equal(validateOnlineApiUrl(base),base);
 assert.equal(validateOnlineApiUrl(base+'/'),base);
 assert.equal(validateOnlineApiUrl(''),null);
 for(const wrong of [
  'https://nezqupnhcqwuewfilioa.supabase.co/functions/v1/opfc-online',
  'https://lrmgtnbxujdvswaykyxi.supabase.co/functions/v1/opfc-online',
  'http://test.supabase.co/functions/v1/opfc-online',
  'https://test.supabase.co/functions/v1/opmercato-online',
  'https://example.com/api',
  'https://test.supabase.co/functions/v1/opfc-online?token=123'
 ])assert.throws(()=>validateOnlineApiUrl(wrong),/indépendant/);
});
test('Créer un salon envoie le club, sauvegarde le jeton mais ne l’affiche pas',async()=>{
 const f=fixture();
 f.responses.push({json:{session:session(),room:room()}});
 const actual=await f.client.createRoom('PSG');
 assert.deepEqual(actual,room());
 assert.equal(f.requests.length,1);
 assert.equal(f.requests[0].url,base);
 assert.deepEqual(f.requests[0].body,{action:'create',firstClub:'PSG'});
 assert.equal(f.requests[0].init.method,'POST');
 assert.equal(f.requests[0].init.cache,'no-store');
 assert.equal(f.requests[0].init.headers['Content-Type'],'application/json');
 assert.equal(f.requests[0].init.headers.Authorization,undefined);
 assert.equal(f.client.hasSession,true);
 assert.equal(f.client.sessionRole,'host');
 assert.equal(JSON.parse(f.store.data.get(ONLINE_SESSION_KEY)).token,token);
 assert.equal(JSON.stringify(actual).includes(token),false);
});
test('Joindre un salon accepte un code avec espaces et attribue OM au second joueur',async()=>{
 const f=fixture();
 const guestRoom=room({role:'guest',myClub:'OM',status:'ready',version:2,opponentConnected:true});
 const guestSession=session({role:'guest',club:'OM'});
 f.responses.push({json:{session:guestSession,room:guestRoom}});
 const received=await f.client.joinRoom(' ab-cd 23 ');
 assert.equal(f.requests[0].body.code,'ABCD23');
 assert.equal(received.myClub,'OM');
 assert.equal(received.opponentConnected,true);
 assert.equal(f.client.sessionRole,'guest');
 assert.throws(()=>normalizeJoinCodeInput('AB I023'),/Code/);
});
test('Deux sessions ne peuvent pas être créées depuis le même iPhone sans quitter',async()=>{
 const f=fixture();f.responses.push({json:{session:session(),room:room()}});
 await f.client.createRoom('PSG');
 await assert.rejects(f.client.joinRoom('ABCD23'),/Quitte d’abord/);
 await assert.rejects(f.client.createRoom('OM'),/Quitte d’abord/);
 assert.equal(f.requests.length,1);
});
test('Actualisation authentifiée : le jeton va dans le POST, jamais dans l’URL',async()=>{
 const f=fixture();
 f.responses.push({json:{session:session(),room:room()}});
 await f.client.createRoom();
 f.responses.push({json:{room:room({status:'ready',version:2,opponentConnected:true})}});
 const next=await f.client.refreshRoom();
 assert.equal(next.status,'ready');
 assert.equal(next.version,2);
 assert.deepEqual(f.requests[1].body,{action:'get',roomId:id,token});
 assert.equal(f.requests[1].url,base);
 assert.equal(f.requests[1].url.includes(token),false);
});
test('Une réponse périmée ne ramène pas le salon de prêt à attente',async()=>{
 const f=fixture();
 f.responses.push({json:{session:session(),room:room({status:'ready',opponentConnected:true,version:3})}});
 await f.client.createRoom();
 f.responses.push({json:{room:room({status:'ready',opponentConnected:true,version:2})}});
 assert.equal((await f.client.refreshRoom()).version,3);
 assert.equal(f.client.room.status,'ready');
});
test('Récupération après rechargement et oubli ne touchent pas à la sauvegarde locale',async()=>{
 const f=fixture();
 f.store.data.set('opfc-v08-local-dev','une partie locale existante');
 f.responses.push({json:{session:session(),room:room()}});
 await f.client.createRoom();
 const second=createOnlineClient({apiUrl:base,storage:f.store,
  fetchImpl:async()=>({ok:true,json:async()=>({room:room({status:'ready',version:2,opponentConnected:true})})})});
 assert.equal(second.loadSession(),true);
 assert.equal(second.hasSession,true);
 assert.equal(second.room,null);
 assert.equal((await second.refreshRoom()).status,'ready');
 second.leaveDevice();
 assert.equal(second.hasSession,false);
 assert.equal(f.store.data.has(ONLINE_SESSION_KEY),false);
 assert.equal(f.store.data.get('opfc-v08-local-dev'),'une partie locale existante');
});
test('Sessions corrompues refusées et supprimées sans fuite',()=>{
 const store=storage();
 for(const bad of [
  '{"roomId":"oops","token":"123","club":"PSG","role":"host"}',
  '{malformed',
  JSON.stringify(session({role:'admin'})),
  JSON.stringify(session({token:'ABC'}))
 ]){
  store.setItem(ONLINE_SESSION_KEY,bad);
  const c=createOnlineClient({apiUrl:base,storage:store,fetchImpl:async()=>{}});
  assert.equal(c.loadSession(),false);
  assert.equal(store.getItem(ONLINE_SESSION_KEY),null);
 }
});
test('Erreur serveur, salon incohérent et statut HTTP refusés sans enregistrer de session',async()=>{
 for(const bad of [
  {ok:false,json:{error:'Salon déjà complet'}},
  {json:{session:session(),room:room({id:'6be1626a-69ea-4a97-a858-ef04b5131722'})}},
  {json:{session:session(),room:room({role:'guest',myClub:'OM'})}},
  {json:{session:session(),room:room({status:'ready',opponentConnected:false})}},
  {json:{session:session(),room:room({version:0})}}
 ]){
  const f=fixture();f.responses.push(bad);
  await assert.rejects(f.client.createRoom(),Error);
  assert.equal(f.client.hasSession,false);
  assert.equal(f.store.getItem(ONLINE_SESSION_KEY),null);
 }
});
test('Accueil, création, rejoindre, attente, prêt, reprise et oubli ont leurs écrans',()=>{
 const common={configured:true,firstClub:'OM'};
 const a=renderOnlineLobby({...common,stage:'choose'});
 assert.match(a,/Créer une partie/);assert.match(a,/Rejoindre une partie/);
 assert.match(renderOnlineLobby({...common,stage:'create'}),/Olympique de MaryGeoise/);
 const join=renderOnlineLobby({...common,stage:'join',joinCode:'ABCD23'});
 assert.match(join,/opfc-room-code/);assert.match(join,/ABCD23/);
 const waiting=renderOnlineLobby({...common,stage:'room',room:room()});
 assert.match(waiting,/En attente de l’adversaire/);
 assert.match(waiting,/ABCD23/);
 assert.doesNotMatch(waiting,new RegExp(token));
 assert.match(renderOnlineLobby({...common,stage:'room',room:room({status:'ready',opponentConnected:true,version:2})}),/Adversaire connecté/);
 assert.match(renderOnlineLobby({...common,stage:'restore'}),/Session retrouvée/);
 assert.match(renderOnlineLobby({...common,stage:'forget-confirm'}),/Oublier la session/);
});
test('Sans serveur : écrans visibles mais boutons réseau désactivés',()=>{
 for(const stage of ['create','join']){
  const html=renderOnlineLobby({stage,configured:false});
  assert.match(html,/n’est pas encore déployé/);
  assert.match(html,/disabled aria-disabled="true"/);
 }
 const roomHtml=renderOnlineLobby({stage:'room',configured:false,room:room()});
 assert.match(roomHtml,/ABC/);
 assert.match(roomHtml,/n’est pas encore déployé/);
});
test('Aucun secret ni ancien projet codé dans le rendu ou la configuration',()=>{
 const config=readFileSync(new URL('../online-config.mjs',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../ui-online.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(config,/nezqupnhcqwuewfilioa|lrmgtnbxujdvswaykyxi|SERVICE_ROLE/);
 assert.doesNotMatch(ui,/token|service_role|supabase\.co/i);
 assert.match(ui,/aria-label="Code du salon"/);
});
