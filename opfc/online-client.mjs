/**
 * OPFC — bloc 10A2 : client de lobby privé et sauvegarde de session.
 * Ne communique JAMAIS avec le projet Supabase OPMercato classique.
 * Les deux API publiques sont \`create/join/get\` ; pas encore de jeu en ligne.
 */
import {normalizeRoomCode,validateClub,validateSessionToken,validateRoomId,ONLINE_PROTOCOL_VERSION} from './online-protocol.mjs';
import {OPFC_ONLINE_API_URL,OPFC_ONLINE_PUBLISHABLE_KEY} from './online-config.mjs';
import {chooseClubPair,validateDisplayClub,isDisplayClub} from './club-identities.mjs';

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
 if(room.clubChoices)chooseClubPair(room.clubChoices.PSG,room.clubChoices.OM);
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
 let session=null,room=null,marketGame=null;
 const validSnapshot=(payload)=>{
  if(payload===null||payload===undefined)return null;
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||
   !['mercato','lineup','kickoff-ready','match','moment-result','half-time',
     'resume-ready','shootout-ready','shootout','finished'].includes(payload.phase)||
   !Array.isArray(payload.teams)||payload.teams.length!==2||
   !Number.isInteger(payload.version)||payload.version!==1)
   fail('Vue de mercato reçue invalide');
  const withMatch=['match','moment-result','half-time','resume-ready',
   'shootout-ready','shootout','finished'].includes(payload.phase);
  const allowed=withMatch?['version','phase','teams','dice','match']:
   ['version','phase','teams','dice','auction','lastResult','myObservation'];
  if(Object.keys(payload).some(k=>!allowed.includes(k)))fail('Vue de mercato contenant des secrets');
  if(!Array.isArray(payload.dice)||payload.dice.length!==2||
   payload.teams.some(t=>!t||!['PSG','OM'].includes(t.club)))
   fail('Vue de partie incohérente');
  const identities=payload.teams.map(t=>t.identityId??t.club);
  if(identities.some(id=>!isDisplayClub(id))||identities[0]===identities[1])
   fail('Identités de clubs reçues incohérentes');
  if(withMatch){
   const m=payload.match;
   const matchFields=['index','minute','score','statistics','goals',
    'history','lastResult','winner','victory','currentMoment','action','shootout'];
   if(!m||typeof m!=='object'||Array.isArray(m)||
    Object.keys(m).some(k=>!matchFields.includes(k))||
    !Number.isInteger(m.index)||m.index<0||
    !Number.isInteger(m.minute)||m.minute<0||m.minute>90||
    !Array.isArray(m.goals)||!m.score||!m.statistics||
    !['PSG','OM'].every(c=>Number.isInteger(m.score[c])&&m.score[c]>=0))
    fail('Vue de match invalide');
   if(m.history!==undefined&&!Array.isArray(m.history))
    fail('Historique de match invalide');
   if(m.action){
    if(typeof m.action!=='object'||Array.isArray(m.action)||
     !['open','corner','free-kick','penalty'].includes(m.action.kind)||
     m.action.index!==m.index||
     ['choices','chemistryBonus','shotResult','originalDuel','schedule',
      'shotDirection','keeperDirection'].some(k=>Object.hasOwn(m.action,k)))
     fail('Action de match contenant des secrets');
   }
   if(m.shootout!==undefined){
    const sh=m.shootout,allowedShootout=['phase','stage','winner',
     'firstClub','nextClub','score','attempts','timeline','active',
     'confirmed','lastResult'];
    const attemptAllowed=['club','shotNumber','shooterId','keeperId',
     'shotDirection','keeperDirection','result','scored'];
    const safeAttempt=a=>a&&typeof a==='object'&&!Array.isArray(a)&&
     Object.keys(a).every(k=>attemptAllowed.includes(k));
    if(!sh||typeof sh!=='object'||Array.isArray(sh)||
     Object.keys(sh).some(k=>!allowedShootout.includes(k))||
     !Array.isArray(sh.timeline)||!sh.score||!sh.attempts||!sh.confirmed||
     sh.timeline.some(a=>!safeAttempt(a))||
     (sh.lastResult!==null&&!safeAttempt(sh.lastResult))||
     (sh.active!==null&&(!sh.active||typeof sh.active!=='object'||
       Object.keys(sh.active).some(k=>!['club','shotNumber','shooterId','keeperId'].includes(k)))))
     fail('Séance contenant des informations privées ou invalides');
   }
  }
  return structuredClone(payload);
 };
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
  session=incoming;room=incomingRoom;marketGame=validSnapshot(payload?.game);
  if(persistSession)persist();
  return room;
 };
 const sendCommand=async(action,command)=>{
  ensureOnline();
  if(!session||!room||room.status!=='ready')
   fail('Actualise d’abord un salon avec deux joueurs');
  if(!command||typeof command!=='object'||Array.isArray(command))
   fail('Commande de jeu invalide');
  const before=room.version;
  const data=await request({action,roomId:session.roomId,token:session.token,
   expectedVersion:before,command});
  const nextRoom=validRoom(data.room,session);
  if(nextRoom.version!==before+1)
   fail('Version de confirmation de la partie invalide');
  const nextGame=validSnapshot(data.game);
  if(!nextGame)fail('Réponse de partie incomplète');
  // Une actualisation plus récente ne doit jamais être remplacée par
  // une réponse réseau plus ancienne terminée en retard.
  if(room.version<=nextRoom.version){room=nextRoom;marketGame=nextGame;}
  return marketGame;
 };
 return Object.freeze({
  get configured(){return !!url;},
  get room(){return room;},
  get marketGame(){return marketGame;},
  get game(){return marketGame;},
  get hasSession(){return session!==null;},
  get sessionRole(){return session?.role??null;},
  loadSession(){
   let raw;try{raw=storage?.getItem(ONLINE_SESSION_KEY);}catch{return false;}
   if(!raw)return false;
   try{session=validSession(JSON.parse(raw));room=null;marketGame=null;return true;}
   catch{session=null;room=null;marketGame=null;persist();return false;}
  },
  async createRoom(firstClub='PSG',identityId=firstClub){
   ensureOnline();if(session)fail('Quitte d’abord le salon en cours');
   validateDisplayClub(identityId);
   const command={action:'create',firstClub:validateClub(firstClub)};
   if(identityId!==firstClub)command.identityId=identityId;
   const data=await request(command);
   return accept(data,true);
  },
  async joinRoom(code,identityId='OM'){
   ensureOnline();if(session)fail('Quitte d’abord le salon en cours');
   validateDisplayClub(identityId);
   const command={action:'join',code:normalizeRoomCode(code)};
   if(identityId!=='OM')command.identityId=identityId;
   const data=await request(command);
   return accept(data,true);
  },
  async refreshRoom(){
   ensureOnline();if(!session)fail('Aucune session de salon à actualiser');
   const data=await request({action:'get',roomId:session.roomId,token:session.token});
   const next=validRoom(data.room,session);
   const snapshot=validSnapshot(data.game);
   // Réponses réseau en retard : une ancienne version ne remplace jamais
   // une version plus récente déjà connue de ce client.
   if(!room||next.version>=room.version){room=next;marketGame=snapshot;}
   return room;
  },
  async marketAction(command){
   return sendCommand('market',command);
  },
  async lineupAction(command){
   if(!marketGame||!['lineup','kickoff-ready'].includes(marketGame.phase))
    fail('Actualise la partie avant de modifier les compositions');
   return sendCommand('lineup',command);
  },
  async matchAction(command){
   if(!marketGame||!['match','moment-result','half-time','resume-ready',
     'shootout-ready','shootout','finished'].includes(marketGame.phase))
    fail('Actualise le match avant de jouer une action');
   return sendCommand('match',command);
  },
  leaveDevice(){
   session=null;room=null;marketGame=null;persist(); // Ne ferme pas le salon distant.
  }
 });
}
