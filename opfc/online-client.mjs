/**
 * OPFC — bloc 10A2 : client de lobby privé et sauvegarde de session.
 * Ne communique JAMAIS avec le projet Supabase OPMercato classique.
 * Les deux API publiques sont \`create/join/get\` ; pas encore de jeu en ligne.
 */
import {normalizeRoomCode,validateClub,validateSessionToken,validateRoomId,ONLINE_PROTOCOL_VERSION} from './online-protocol.mjs';
import {OPFC_ONLINE_API_URL,OPFC_ONLINE_PUBLISHABLE_KEY} from './online-config.mjs';
import {chooseClubPair,validateDisplayClub,isDisplayClub} from './club-identities.mjs';
import {isCompetition} from './club-honours.mjs';

export const ONLINE_SESSION_KEY='opfc-v1-online-session';
export const ONLINE_PENDING_KEY='opfc-v1-online-pending-action';
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
 if(room.competition!==undefined&&room.competition!==null&&!isCompetition(room.competition))fail('Compétition du salon invalide');
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
 timeoutMs=20000
}={}){
 const url=validateOnlineApiUrl(apiUrl);
 if(!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>120000)fail('Délai réseau invalide');
 if(publishableKey && (typeof publishableKey!=='string'||publishableKey.length>2048))
  fail('Clé publique du salon invalide');
 let session=null,room=null,marketGame=null,pending=null,inFlight=false,lastRecoveryAt=0;
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
    'history','lastResult','winner','victory','currentMoment','action','shootout','resultAcks','competition'];
   if(!m||typeof m!=='object'||Array.isArray(m)||
    Object.keys(m).some(k=>!matchFields.includes(k))||
    !Number.isInteger(m.index)||m.index<0||
    !Number.isInteger(m.minute)||m.minute<0||m.minute>90||
    !Array.isArray(m.goals)||!m.score||!m.statistics||
    !['PSG','OM'].every(c=>Number.isInteger(m.score[c])&&m.score[c]>=0))
    fail('Vue de match invalide');
   if(m.history!==undefined&&!Array.isArray(m.history))
    fail('Historique de match invalide');
   if(m.resultAcks!==undefined&&(
    !m.resultAcks||typeof m.resultAcks!=='object'||Array.isArray(m.resultAcks)||
    Object.keys(m.resultAcks).some(k=>!['PSG','OM'].includes(k))||
    !['PSG','OM'].every(c=>typeof m.resultAcks[c]==='boolean')))
    fail('Synchronisation des validations invalide');
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
   if(!reply.ok||data?.error){
     const issue=new Error(typeof data?.error==='string'?data.error:'Serveur OPFC indisponible');
     issue.status=reply.status;
     throw issue;
    }
   if(!data||typeof data!=='object')fail('Réponse serveur invalide');
   return data;
  }catch(error){
   if(error?.name==='AbortError'){
    const problem=new Error('Le serveur répond trop lentement. Ta session est conservée : actualise pour reprendre.');
    problem.opfcTransient=true;throw problem;
   }
   if(error instanceof TypeError)error.opfcTransient=true;
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
 const rememberPending=()=>{
  try{
   if(pending)storage?.setItem(ONLINE_PENDING_KEY,JSON.stringify(pending));
   else storage?.removeItem(ONLINE_PENDING_KEY);
  }catch{/* Le navigateur peut refuser le stockage : conserver en mémoire. */}
 };
 const loadPending=()=>{
  try{
   const saved=JSON.parse(storage?.getItem(ONLINE_PENDING_KEY)??'null');
   if(saved&&saved.roomId===session?.roomId&&
    ['market','lineup','match'].includes(saved.action)&&
    /^[a-f0-9-]{36}$/.test(saved.requestId)&&
    saved.command&&typeof saved.command.type==='string')
    pending=saved;
   else{pending=null;rememberPending();}
  }catch{pending=null;rememberPending();}
 };
 // Un identifiant unique et persistant par intention, même après redémarrage.
 const actionId=()=>{
  if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();
  if(globalThis.crypto?.getRandomValues){
   const bytes=new Uint8Array(16);globalThis.crypto.getRandomValues(bytes);
   bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
   const h=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
   return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
  }
  fail('Identifiant de sécurité indisponible sur cet appareil');
 };
 // Précondition métier : un ancien choix ne doit pas s'appliquer sur un autre
 // personnage, une autre enchère ou une autre séquence après synchronisation.
 const contextFor=(state,command)=>{
  const ctx={phase:state?.phase};
  if(state?.phase==='mercato'){
   if(!['place','formation'].includes(command.type)){
    ctx.auctionCard=state?.auction?.cardId??null;
    if(command.type!=='observation')ctx.auctionTurn=state?.auction?.turn??null;
   }
  }else if(['match','moment-result','half-time','resume-ready',
   'shootout-ready','shootout','finished'].includes(state?.phase)){
   const m=state.match;
   ctx.index=m?.index??null;
   ctx.stage=m?.action?.stage??null;
   ctx.actionKind=m?.action?.kind??null;
   ctx.shootoutCount=m?.shootout?.timeline?.length??0;
  }
  return ctx;
 };
 const adopt=(data,expected=null)=>{
  const newRoom=validRoom(data.room,session);
  if(!data.duplicate&&expected!==null&&newRoom.version!==expected+1)
   fail('Version de confirmation de la partie invalide');
  const nextGame=validSnapshot(data.game);
  if(!nextGame)fail('Réponse de partie incomplète');
  if(!room||newRoom.version>=room.version){room=newRoom;marketGame=nextGame;}
  return marketGame;
 };
 const getLatest=async()=>{
  const data=await request({action:'get',roomId:session.roomId,token:session.token});
  const latestRoom=validRoom(data.room,session);
  const snapshot=validSnapshot(data.game);
  if(!room||latestRoom.version>=room.version){room=latestRoom;marketGame=snapshot;}
 };
 const retryable=e=>!!e?.opfcTransient||e?.status>=500||
  (e?.status===409&&/Salon modifié|actualise la partie/i.test(e?.message??''));
 const sendPending=async()=>{
  if(!pending)return marketGame;
  if(inFlight)fail('Une action est déjà en cours de synchronisation');
  inFlight=true;
  try{
   // L'identifiant ne change jamais, y compris si le serveur a appliqué
   // une action dont la réponse a été perdue.
   for(let attempt=0;attempt<2;attempt++){
    const current=pending;
    if(!Number.isSafeInteger(room?.version)||room.version<1)await getLatest();
    const version=room.version;
    try{
     const data=await request({
      action:current.action,roomId:session.roomId,token:session.token,
      expectedVersion:version,command:current.command,
      requestId:current.requestId,context:current.context
     });
     const answer=adopt(data,version);
     pending=null;rememberPending();lastRecoveryAt=0;
     return answer;
    }catch(e){
     if(!retryable(e)){
      pending=null;rememberPending();throw e;
     }
     try{await getLatest();}
     catch{
      throw new Error('Connexion interrompue : ton action et ta partie sont sauvegardées. La reprise sera tentée automatiquement.');
     }
     if(attempt===1)
      throw new Error('Synchronisation encore instable. Ton action est conservée et sera vérifiée automatiquement.');
    }
   }
  }finally{inFlight=false;}
 };
 const sendCommand=async(action,command)=>{
  ensureOnline();
  if(!session||!room||room.status!=='ready')
   fail('Actualise d’abord un salon avec deux joueurs');
  if(!command||typeof command!=='object'||Array.isArray(command))
   fail('Commande de jeu invalide');
  if(pending){
   if(inFlight)fail('Une action est déjà en cours de synchronisation');
   await sendPending();
   fail('Action précédente synchronisée. Vérifie le nouvel écran avant de recommencer.');
  }
  pending={roomId:session.roomId,action,command:structuredClone(command),
   requestId:actionId(),context:contextFor(marketGame,command),
   createdAt:Date.now()};
  rememberPending();
  return sendPending();
 };
 const recoverPending=async()=>{
  if(!pending||inFlight||!room||room.status!=='ready')return;
  if(Date.now()-lastRecoveryAt<5000)return;
  lastRecoveryAt=Date.now();
  await sendPending();
 };
 return Object.freeze({
  get configured(){return !!url;},
  get room(){return room;},
  get marketGame(){return marketGame;},
  get game(){return marketGame;},
  get hasSession(){return session!==null;},
  get hasPendingAction(){return pending!==null;},
  get sessionRole(){return session?.role??null;},
  loadSession(){
   let raw;try{raw=storage?.getItem(ONLINE_SESSION_KEY);}catch{return false;}
   if(!raw)return false;
   try{session=validSession(JSON.parse(raw));room=null;marketGame=null;loadPending();return true;}
   catch{session=null;room=null;marketGame=null;pending=null;persist();rememberPending();return false;}
  },
  async createRoom(firstClub='PSG',identityId=firstClub,competition='grandline'){
   ensureOnline();if(session)fail('Quitte d’abord le salon en cours');
   validateDisplayClub(identityId);
   if(!isCompetition(competition))fail('Compétition inconnue');
   const command={action:'create',firstClub:validateClub(firstClub),competition};
   if(identityId!==firstClub)command.identityId=identityId;
   const data=await request(command);
   pending=null;rememberPending();return accept(data,true);
  },
  async joinRoom(code,identityId='OM'){
   ensureOnline();if(session)fail('Quitte d’abord le salon en cours');
   validateDisplayClub(identityId);
   const command={action:'join',code:normalizeRoomCode(code)};
   if(identityId!=='OM')command.identityId=identityId;
   const data=await request(command);
   pending=null;rememberPending();return accept(data,true);
  },
  async refreshRoom(){
   ensureOnline();if(!session)fail('Aucune session de salon à actualiser');
   const data=await request({action:'get',roomId:session.roomId,token:session.token});
   const next=validRoom(data.room,session);
   const snapshot=validSnapshot(data.game);
   // Réponses réseau en retard : une ancienne version ne remplace jamais
   // une version plus récente déjà connue de ce client.
   if(!room||next.version>=room.version){room=next;marketGame=snapshot;}
   await recoverPending();
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
   session=null;room=null;marketGame=null;pending=null;persist();rememberPending(); // Ne ferme pas le salon distant.
  }
 });
}
