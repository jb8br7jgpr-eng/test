/**
 * OPFC — bloc 10A2 : client de lobby privé et sauvegarde de session.
 * Ne communique JAMAIS avec le projet Supabase OPMercato classique.
 * Les deux API publiques sont \`create/join/get\` ; pas encore de jeu en ligne.
 */
import {normalizeRoomCode,validateClub,validateSessionToken,validateRoomId,ONLINE_PROTOCOL_VERSION} from './online-protocol.mjs';
import {OPFC_ONLINE_API_URL,OPFC_ONLINE_PUBLISHABLE_KEY} from './online-config.mjs';

export const ONLINE_SESSION_KEY='opfc-v1-online-session';
const FORBIDDEN_PROJECTS=['nezqupnhcqwuewfilioa','lrmgtnbxujdvswaykyxi'];
const ROOM_STATUSES=['waiting','ready','finished'];
const fail=msg=>{throw new Error(msg);};
export function validateOnlineApiUrl(value){
 if(typeof value!=='string'||!value.trim())return null;
 const url=value.trim();
 const match=url.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co\/functions\/v1\/opfc-online\/?$/);
 if(!match||FORBIDDEN_PROJECTS.includes(match[1]))fail('Le mode en ligne exige un projet Supabase OPFC indépendant');
 return url.replace(/\/$/,'');
}
function validRoom(room,session=null){
 if(!room||typeof room!=='object')fail('Réponse de salon invalide');
 validateRoomId(room.id);
 normalizeRoomCode(room.code);
 validateClub(room.hostClub);validateClub(room.guestClub);validateClub(room.myClub);
 if(room.hostClub===room.guestClub||room.guestClub!==(room.hostClub==='PSG'?'OM':'PSG'))
  fail('Attribution des clubs incohérente');
 if(!ROOM_STATUSES.includes(room.status))fail('Statut du salon invalide');
 if(!Number.isSafeInteger(room.version)||room.version<1)fail('Version de salon invalide');
 if(typeof room.opponentConnected!=='boolean')fail('Connexion adverse invalide');
 if(room.status==='waiting'&&room.opponentConnected)fail('Salon en attente incohérent');
 if(room.status!=='waiting'&&!room.opponentConnected)fail('Salon rejoint incohérent');
 if(room.protocol!==ONLINE_PROTOCOL_VERSION)fail('Protocole du salon incompatible');
 if(room.role!=='host'&&room.role!=='guest')fail('Rôle de salon invalide');
 if((room.role==='host'?room.hostClub:room.guestClub)!==room.myClub)
  fail('Club de session incohérent');
 if(typeof room.expiresAt!=='string'||!Number.isFinite(Date.parse(room.expiresAt)))
  fail('Expiration du salon invalide');
 if(session){
  if(room.id!==session.roomId||room.role!==session.role||room.myClub!==session.club)
   fail('Session et salon incompatibles');
 }
 return Object.freeze({...room});
}
function validSession(session){
 if(!session||typeof session!=='object')fail('Session de salon invalide');
 return Object.freeze({
  roomId:validateRoomId(session.roomId),
  role:session.role==='host'||session.role==='guest'?session.role:fail('Rôle de session invalide'),
  club:validateClub(session.club),
  token:validateSessionToken(session.token)
 });
}
export function createOnlineClient({
 apiUrl=OPFC_ONLINE_API_URL,
 publishableKey=OPFC_ONLINE_PUBLISHABLE_KEY,
 fetchImpl=globalThis.fetch,
 storage=globalThis.localStorage,
 timeoutMs=12000
}={}){
 const url=validateOnlineApiUrl(apiUrl);
 if(!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>120000)fail('Délai réseau invalide');
 if(publishableKey && (typeof publishableKey!=='string'||publishableKey.length>2048))
  fail('Clé publique du salon invalide');
 let session=null,room=null;
 const persist=()=>{try{if(session)storage?.setItem(ONLINE_SESSION_KEY,JSON.stringify(session));else storage?.removeItem(ONLINE_SESSION_KEY);}catch{/* Stockage indisponible : session en mémoire uniquement. */}};
 const ensureOnline=()=>{
  if(!url)fail('Le serveur OPFC n’est pas encore configuré. Aucun salon ne peut être créé ou rejoint.');
  if(typeof fetchImpl!=='function')fail('Connexion réseau indisponible');
 };
 async function request(body){
  ensureOnline();
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  const headers={'Content-Type':'application/json','Cache-Control':'no-store'};
  if(publishableKey)headers.apikey=publishableKey;
  try{
   const reply=await fetchImpl(url,{method:'POST',headers,
    body:JSON.stringify(body),signal:controller.signal,cache:'no-store'});
   let data;
   try{data=await reply.json();}catch{fail('Réponse serveur illisible');}
   if(!reply.ok||data?.error)fail(typeof data?.error==='string'?data.error:'Serveur OPFC indisponible');
   if(!data||typeof data!=='object')fail('Réponse serveur invalide');
   return data;
  }catch(error){
   if(error?.name==='AbortError')fail('Connexion au salon expirée. Réessaie.');
   throw error;
  }finally{clearTimeout(timer);}
 }
 const accept=(payload,persistSession)=>{
  const incoming=validSession(payload?.session);
  const incomingRoom=validRoom(payload?.room,incoming);
  session=incoming;room=incomingRoom;
  if(persistSession)persist();
  return room;
 };
 return Object.freeze({
  get configured(){return !!url;},
  get room(){return room;},
  get hasSession(){return session!==null;},
  get sessionRole(){return session?.role??null;},
  loadSession(){
   let raw;try{raw=storage?.getItem(ONLINE_SESSION_KEY);}catch{return false;}
   if(!raw)return false;
   try{session=validSession(JSON.parse(raw));room=null;return true;}
   catch{session=null;room=null;persist();return false;}
  },
  async createRoom(firstClub='PSG'){
   ensureOnline();if(session)fail('Quitte d’abord le salon en cours');
   const data=await request({action:'create',firstClub:validateClub(firstClub)});
   return accept(data,true);
  },
  async joinRoom(code){
   ensureOnline();if(session)fail('Quitte d’abord le salon en cours');
   const data=await request({action:'join',code:normalizeRoomCode(code)});
   return accept(data,true);
  },
  async refreshRoom(){
   ensureOnline();if(!session)fail('Aucune session de salon à actualiser');
   const data=await request({action:'get',roomId:session.roomId,token:session.token});
   const next=validRoom(data.room,session);
   // Réponses réseau en retard : une ancienne version ne remplace jamais
   // une version plus récente déjà connue de ce client.
   if(!room||next.version>=room.version)room=next;
   return room;
  },
  leaveDevice(){
   session=null;room=null;persist(); // Ne ferme pas le salon distant.
  }
 });
}
