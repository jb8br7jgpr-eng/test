/**
 * OPFC / bloc 10A1 — Edge Function Supabase, NON DÉPLOYÉE.
 * Salon privé et actions de jeu : create / join / get / market / lineup / match.
 * Les commandes sont validées par les transitions officielles du moteur.
 * Aucun changement aux fonctions ou aux tables du jeu classique.
 *
 * Avant déploiement sur un projet OPFC dédié : appliquer opfc-schema.sql,
 * déployer CETTE fonction seule avec --no-verify-jwt (création anonyme),
 * définir OPFC_ALLOWED_ORIGIN et limiter le débit au niveau du proxy.
 */
import {createClient} from 'npm:@supabase/supabase-js@2';
import {
 ONLINE_PROTOCOL_VERSION,generateRoomCode,generateSessionToken,
 generateServerGame,sha256Token,authenticateRoom,lobbyPublicView,
 normalizeRoomCode,validateRoomId,validateClub,validateSessionToken
} from './opfc/online-protocol.mjs';
import {applyOnlineMarketCommand} from './opfc/online-market.mjs';
import {generateRandomTeams} from './opfc/random-rosters.mjs';
import {formationPositions} from './opfc/rules.mjs';
import {validateDisplayClub,isDisplayClub} from './opfc/club-identities.mjs';
import {applyOnlineLineupCommand,onlinePreMatchView} from './opfc/online-lineup.mjs';
import {applyOnlineOpenPlayCommand} from './opfc/online-match.mjs';
import {matchPerformances} from './opfc/player-performance.mjs';
import {isStadium} from './opfc/stadiums.mjs';
import {CARD_BY_ID} from './opfc/catalog.mjs';

const origin=Deno.env.get('OPFC_ALLOWED_ORIGIN')??'https://jb8br7jgpr-eng.github.io';
const supabaseUrl=Deno.env.get('SUPABASE_URL');
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if(!supabaseUrl||!serviceKey)throw Error('Supabase OPFC non configuré');
const db=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const maxBody=8192,MAX_CREATE_RETRIES=8;
const competitions=['grandline','league','cup'];
const clubIds=['PSG','OM','BDW','SPJ','WSC','AWC','SU','RM','LFC','BDR','SKS','ALA','RFC','JVK','AST','RBE','FCI','ATZ','ERG','PHC'];
// Quota GLOBAL atomique : solution provisoire pour lancement privé.
// Dépend de la migration SQL opfc_rate_limit dans le seul projet OPFC.
async function allowPublicAction(action){
 const {data,error:rateError}=await db.rpc('opfc_take_rate_token',{p_action:action});
 if(rateError||typeof data!=='boolean')throw Error('Protection anti-abus indisponible');
 return data;
}
const expiry=()=>new Date(Date.now()+7*86400_000).toISOString();
function headers(){
 return {
  'Content-Type':'application/json; charset=utf-8',
  'Access-Control-Allow-Origin':origin,
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Access-Control-Allow-Headers':'Content-Type, Cache-Control, apikey, Authorization',
  'Vary':'Origin',
  'Cache-Control':'no-store'
 };
}
const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:headers()});
function error(message,status=400){
 return response({error:message,protocol:ONLINE_PROTOCOL_VERSION},status);
}
function roomView(row,role){
 return lobbyPublicView(row,role);
}
function publicSession(row,role,token){
 return {session:{roomId:row.id,club:role==='host'?row.host_club:row.host_club==='PSG'?'OM':'PSG',
  role,token},room:roomView(row,role)};
}
function isUuid(s){try{return validateRoomId(s);}catch{return null;}}
function safeCode(s){try{return normalizeRoomCode(s);}catch{return null;}}
function safeToken(s){try{return validateSessionToken(s);}catch{return null;}}
async function create(body){
 const hostClub=validateClub(body.firstClub??'PSG');
 const token=generateSessionToken();
 const hash=await sha256Token(token);
 const initial=generateServerGame(hostClub); // paquet secret, jeu sans action client
 const recruitmentMode=body.recruitmentMode??'auction';
 if(!['auction','random'].includes(recruitmentMode))return error('Mode de recrutement invalide');
 // Les anciens clients sans formation gardent le 2-2-2 par défaut.
 const hostFormation=body.formation??'2-2-2';
 try{if(formationPositions(hostFormation).length!==7)throw Error();}
 catch{return error('Formation de l’hôte invalide');}
 initial.teams.find(t=>t.club===hostClub).formation=hostFormation;
 if(recruitmentMode==='random'){
  initial.recruitmentMode='random';
  initial.randomHostFormation=hostFormation;
 }
 const selectedCompetition=body.competition??'grandline';
 if(!competitions.includes(selectedCompetition))return error('Compétition invalide',400);
 initial.competition=selectedCompetition;
 if(body.stadiumId!==undefined&&!isStadium(body.stadiumId))return error('Stade invalide',400);
 // Les anciens clients ne passent pas stadiumId : ne rien ajouter à leurs salons.
 if(body.stadiumId!==undefined)initial.stadiumId=body.stadiumId;
 const chosen=validateDisplayClub(body.identityId??hostClub);
 const other=hostClub==='PSG'?'OM':'PSG';
 initial.teams.find(t=>t.club===hostClub).identityId=chosen;
 initial.teams.find(t=>t.club===other).identityId=chosen===other?hostClub:other;
 for(let attempt=0;attempt<MAX_CREATE_RETRIES;attempt++){
  const code=generateRoomCode();
  const {data, error:dbError}=await db.from('opfc_rooms')
   .insert({
    code,host_club:hostClub,host_token_hash:hash,guest_token_hash:null,
    status:'waiting',private_state:initial,version:1,expires_at:expiry()
   })
   .select('id,code,host_club,guest_token_hash,status,version,expires_at,private_state')
   .single();
  if(!dbError&&data)return response(publicSession(data,'host',token),201);
  if(dbError?.code==='23505')continue; // collision rare du code
  throw new Error('Création du salon indisponible');
 }
 throw new Error('Impossible de trouver un code de salon libre');
}
async function join(body){
 const code=safeCode(body.code);
 if(!code)return error('Code de salon invalide');
 const {data:found,error:readErr}=await db.from('opfc_rooms')
  .select('id,code,host_club,guest_token_hash,status,version,expires_at,private_state')
  .eq('code',code).gt('expires_at',new Date().toISOString()).maybeSingle();
 if(readErr)throw new Error('Recherche du salon indisponible');
 if(!found)return error('Salon introuvable ou expiré',404);
 if(found.status!=='waiting'||found.guest_token_hash)return error('Salon déjà complet',409);
 const guestClub=found.host_club==='PSG'?'OM':'PSG';
 const guestIdentity=validateDisplayClub(body.identityId??guestClub);
 const nextState=structuredClone(found.private_state);
 const hostIdentity=nextState.teams.find(t=>t.club===found.host_club)?.identityId??found.host_club;
 if(guestIdentity===hostIdentity)return error('Ce club est déjà choisi par ton adversaire',409);
 nextState.teams.find(t=>t.club===guestClub).identityId=guestIdentity;
 if(nextState.recruitmentMode==='random'&&body.formation===undefined)
  return error('Formation de l’invité invalide');
 const guestFormation=body.formation??'2-2-2';
 try{if(formationPositions(guestFormation).length!==7)throw Error();}
 catch{return error('Formation de l’invité invalide');}
 nextState.teams.find(t=>t.club===guestClub).formation=guestFormation;
 let stateToSave=nextState;
 if(nextState.recruitmentMode==='random'){
  const forms={
   [found.host_club]:nextState.randomHostFormation,
   [guestClub]:guestFormation
  };
  const secureRng=()=>{
   const bytes=new Uint8Array(4);
   crypto.getRandomValues(bytes);
   return new DataView(bytes.buffer).getUint32(0)/4294967296;
  };
  stateToSave=generateRandomTeams(nextState,forms,{rng:secureRng});
  delete stateToSave.randomHostFormation;
 }
 const token=generateSessionToken(),hash=await sha256Token(token);
 // Compare-and-swap : si les deux iPhones rejoignent simultanément, un seul gagne.
 const {data:joined,error:joinErr}=await db.from('opfc_rooms')
  .update({
   guest_token_hash:hash,status:'ready',private_state:stateToSave,version:found.version+1,
   updated_at:new Date().toISOString()
  })
  .eq('id',found.id).eq('version',found.version).is('guest_token_hash',null)
  .eq('status','waiting')
  .select('id,code,host_club,guest_token_hash,status,version,expires_at,private_state')
  .maybeSingle();
 if(joinErr)throw new Error('Impossible de rejoindre ce salon');
 if(!joined)return error('Salon déjà rejoint par un autre joueur',409);
 return response(publicSession(joined,'guest',token));
}
// Ne JAMAIS renvoyer private_state, hashs de jetons ou paquet au client.
async function authenticatedRoom(body){
 const roomId=isUuid(body.roomId),token=safeToken(body.token);
 if(!roomId||!token)return {error:error('Session invalide',401)};
 const {data:row,error:dbErr}=await db.from('opfc_rooms')
  .select('id,code,host_club,host_token_hash,guest_token_hash,status,version,expires_at,private_state')
  .eq('id',roomId).gt('expires_at',new Date().toISOString()).maybeSingle();
 if(dbErr)throw new Error('Lecture du salon indisponible');
 if(!row)return {error:error('Salon introuvable ou expiré',404)};
 const role=await authenticateRoom(row,token);
 if(!role)return {error:error('Accès au salon refusé',403)};
 return {row,role,club:role==='host'?row.host_club:row.host_club==='PSG'?'OM':'PSG'};
}
function playerGameView(row,club){
 // Vues de match filtrées : calendrier et choix tactiques jamais exposés.
 if(row.status!=='ready')return null;
 return onlinePreMatchView(row.private_state,club);
}
async function get(body){
 const auth=await authenticatedRoom(body);
 if(auth.error)return auth.error;
 return response({room:roomView(auth.row,auth.role),
  game:playerGameView(auth.row,auth.club)});
}
const REQUEST_ID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
function commandSignature(kind,command){
 if(!command||typeof command!=='object'||Array.isArray(command))return '';
 return JSON.stringify([kind,Object.keys(command).sort().map(k=>[k,command[k]])]);
}
function commandContext(state,command){
 const ctx={phase:state?.phase};
 if(state?.phase==='mercato'&&!['place','formation'].includes(command?.type)){
  ctx.auctionCard=state?.auction?.cardId??null;
  if(command?.type!=='observation')ctx.auctionTurn=state?.auction?.turn??null;
 }else if(['match','moment-result','half-time','resume-ready',
  'shootout-ready','shootout','finished'].includes(state?.phase)){
  const m=state.match;
  ctx.index=m?.index??null;
  ctx.stage=m?.action?.stage??null;
  ctx.actionKind=m?.action?.kind??null;
  ctx.shootoutCount=m?.shootout?.timeline?.length??0;
 }
 return ctx;
}
async function mutate(body,kind){
 const auth=await authenticatedRoom(body);
 if(auth.error)return auth.error;
 const {row,role,club}=auth;
 const id=body.requestId;
 if(id!==undefined){
  if(typeof id!=='string'||!REQUEST_ID.test(id)||
   !body.context||typeof body.context!=='object'||Array.isArray(body.context))
   return error('Identifiant ou contexte de commande invalide',400);
  const previous=row.private_state?.onlineRequestIds?.[id];
  if(previous){
   if(previous.club!==club||previous.signature!==commandSignature(kind,body.command))
    return error('Identifiant déjà utilisé pour une autre action',409);
   return response({room:roomView(row,role),game:playerGameView(row,club),duplicate:true});
  }
 }
 if(row.status!=='ready')return error('En attente du deuxième joueur',409);
 if(!Number.isSafeInteger(body.expectedVersion)||body.expectedVersion<1)
  return error('Version attendue invalide');
 if(row.version!==body.expectedVersion)
  return error('Salon modifié : actualise la partie',409);
 if(id&&JSON.stringify(body.context)!==JSON.stringify(commandContext(row.private_state,body.command)))
  return error('Action devenue obsolète : partie resynchronisée',409);
 if(kind==='market'&&row.private_state?.phase!=='mercato')
  return error('Le mercato n’est plus actif',409);
 if(kind==='lineup'&&!['lineup','kickoff-ready'].includes(row.private_state?.phase))
  return error('La composition n’est pas disponible',409);
 if(kind==='match'&&!['match','moment-result','half-time','resume-ready',
    'shootout-ready','shootout','finished'].includes(row.private_state?.phase))
  return error('L’action de match n’est pas disponible',409);
 let transition;
 try{
  transition=kind==='market'?
   applyOnlineMarketCommand(row.private_state,club,body.command):
   kind==='lineup'?
    applyOnlineLineupCommand(row.private_state,club,body.command,{hostClub:row.host_club}):
    applyOnlineOpenPlayCommand(row.private_state,club,body.command,{hostClub:row.host_club});
 }catch(e){
  return error(e instanceof Error?e.message:'Action illégale',400);
 }
 // Statistiques calculées exclusivement sur l'état validé par le serveur, une seule fois.
 if(transition.state.phase==='finished'&&row.private_state.phase!=='finished'){
  const stats=matchPerformances(transition.state);
  transition.state.match.playerStats=stats.players;
  transition.state.match.anchorId=stats.winner;
 }
 // Effet et identifiant enregistrés dans une seule écriture atomique.
 if(id)transition.state.onlineRequestIds={
  ...(row.private_state?.onlineRequestIds??{}),
  [id]:{club,signature:commandSignature(kind,body.command)}
 };
 const {data:updated,error:writeErr}=await db.from('opfc_rooms')
  .update({
   private_state:transition.state,
   version:row.version+1,
   updated_at:new Date().toISOString()
  })
  .eq('id',row.id).eq('version',row.version).eq('status','ready')
  .select('id,code,host_club,guest_token_hash,status,version,expires_at,private_state')
  .maybeSingle();
 if(writeErr)throw new Error('Sauvegarde de la partie indisponible');
 if(!updated)return error('Salon modifié : actualise la partie',409);
 return response({room:roomView(updated,role),game:transition.publicForActor});
}

/** Lecture publique : uniquement les résultats de matchs, jamais les salons privés. */
async function getHonours(){
 const [{data:summary,error:summaryError},{data:recent,error:historyError}]=await Promise.all([
  db.rpc('opfc_palmares_summary'),
  db.from('opfc_match_results').select('source_key,mode,competition,home_club,away_club,home_score,away_score,winner,shootout,goals,played_at').order('played_at',{ascending:false}).limit(100)
 ]);
 if(summaryError||historyError)throw Error('Palmarès indisponibles');
 return response({summary,history:recent});
}
/** En local, le résultat est transmis par le navigateur : aucune preuve sportive
 * cryptographique n'est possible sans serveur arbitrant les actions.
 * L'identifiant persistant garantit au moins qu'un même match n'est compté qu'une fois. */
async function recordLocal(body){
 const x=body.result;
 if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).some(k=>![
   'id','competition','clubs','score','winner','victory','shootout','goals','playerStats','anchorId'].includes(k)))
   return error('Résultat local invalide',400);
 if(typeof x.id!=='string'||!/^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.test(x.id)||
    !competitions.includes(x.competition))return error('Identifiant ou compétition invalide',400);
 const a=x.clubs?.PSG,b=x.clubs?.OM,w=x.winner;
 if(!clubIds.includes(a)||!clubIds.includes(b)||a===b||!['PSG','OM'].includes(w))return error('Clubs invalides',400);
 const home=x.score?.PSG,away=x.score?.OM;
 if(!Number.isInteger(home)||!Number.isInteger(away)||home<0||away<0||home>99||away>99)return error('Score invalide',400);
 if(!['regulation','shootout'].includes(x.victory)||
    (x.victory==='regulation'&&!(w===(home>away?'PSG':'OM')&&home!==away))||
    (x.victory==='shootout'&&home!==away))return error('Vainqueur incohérent',400);
 if(!Array.isArray(x.goals)||x.goals.length>99||x.goals.some(g=>
   !g||!['PSG','OM'].includes(g.club)||typeof g.cardId!=='string'||g.cardId.length>80||
   !Number.isInteger(g.minute)||g.minute<1||g.minute>90))return error('Buteurs invalides',400);
 // Compatibilité descendante : les téléphones encore sur l'ancienne version
 // peuvent envoyer une finale contenant uniquement les buts.
 // Ces finales préservent les buts, mais n'inventent ni matchs, ni passes, ni récompenses.
 const legacy=!Object.hasOwn(x,'playerStats');
 const stats=legacy?{}:x.playerStats;
 if(legacy){
  for(const g of x.goals){
   if(!stats[g.cardId])stats[g.cardId]={club:g.club,matches:0,goals:0,assists:0,
    anchors:0,attacks:0,defenses:0,saves:0,points:0};
   stats[g.cardId].goals++;
   stats[g.cardId].points+=5;
  }
 }
 if((!legacy&&(!stats||typeof stats!=='object'||Array.isArray(stats)||
  Object.keys(stats).length!==14||typeof x.anchorId!=='string'||!stats[x.anchorId])))
  return error('Statistiques individuelles manquantes',400);
 for(const [id,v] of Object.entries(stats)){
  if(!CARD_BY_ID.has(id)||!v||typeof v!=='object'||Array.isArray(v)||
    !['PSG','OM'].includes(v.club)||
    !['matches','goals','assists','anchors','attacks','defenses','saves','points'].every(k=>
       Number.isSafeInteger(v[k])&&v[k]>=0&&v[k]<=99)||
    v.matches!==(legacy?0:1)||v.anchors!==(id===x.anchorId?1:0)||
    v.points!==5*v.goals+3*v.assists+v.attacks+2*v.defenses+3*v.saves)
    return error('Statistiques individuelles invalides',400);
 }
 if(Object.values(stats).reduce((n,p)=>n+p.goals,0)!==home+away||
   Object.values(stats).reduce((n,p)=>n+p.assists,0)>home+away)
   return error('Statistiques incompatibles avec le score',400);
 if(!legacy){
  // En mode local le serveur ne peut pas arbitrer les actions passées ; il vérifie
  // néanmoins la cohérence exacte des buts, des passes et du meilleur joueur.
  const counts={PSG:0,OM:0},scored=new Map(),assisted=new Map();
  for(const item of Object.values(stats))counts[item.club]++;
  if(counts.PSG!==7||counts.OM!==7)return error('Sept titulaires requis par équipe',400);
  let psg=0,om=0;
  for(const goal of x.goals){
   if(!stats[goal.cardId]||stats[goal.cardId].club!==goal.club)
    return error('Buteur hors composition',400);
   if(goal.club==='PSG')psg++;else om++;
   scored.set(goal.cardId,(scored.get(goal.cardId)??0)+1);
   if(goal.assistId!==undefined&&goal.assistId!==null){
    if(typeof goal.assistId!=='string'||!stats[goal.assistId]||
       stats[goal.assistId].club!==goal.club||goal.assistId===goal.cardId)
      return error('Passe décisive invalide',400);
    assisted.set(goal.assistId,(assisted.get(goal.assistId)??0)+1);
   }
  }
  if(psg!==home||om!==away)return error('Buts incohérents par club',400);
  for(const [id,v] of Object.entries(stats)){
   if(v.goals!==(scored.get(id)??0)||v.assists!==(assisted.get(id)??0))
    return error('Buts ou passes individuelles incohérents',400);
  }
  const ranked=Object.keys(stats).sort((l,r)=>{
   const a=stats[l],b=stats[r];
   return b.points-a.points||b.goals-a.goals||b.assists-a.assists||
     b.defenses-a.defenses||b.saves-a.saves||l.localeCompare(r);
  });
  if(ranked[0]!==x.anchorId)return error('Ancre d’Or incohérente',400);
 }
 let shootout=null;
 if(x.victory==='shootout'){
   if(!x.shootout||!Number.isInteger(x.shootout.PSG)||!Number.isInteger(x.shootout.OM)||
      x.shootout.PSG<0||x.shootout.OM<0||x.shootout.PSG===x.shootout.OM||
      w!==(x.shootout.PSG>x.shootout.OM?'PSG':'OM'))return error('Tirs au but invalides',400);
   shootout={home:x.shootout.PSG,away:x.shootout.OM};
 }else if(x.shootout!==null)return error('Tirs au but inattendus',400);
 const id='local:'+x.id.toLowerCase();
 const record={source_key:id,mode:'local',competition:x.competition,
    home_club:a,away_club:b,home_score:home,away_score:away,winner:w==='PSG'?a:b,
    shootout,goals:x.goals,player_stats:stats,anchor_id:legacy?null:x.anchorId};
 const {data,error:insertError}=await db.from('opfc_match_results').upsert(record,{onConflict:'source_key',ignoreDuplicates:true}).select('source_key').maybeSingle();
 if(insertError)throw Error('Sauvegarde du résultat indisponible');
 return response({saved:true,duplicate:!data});
}

Deno.serve(async req=>{
 // Un origin absent est admis pour clients non navigateurs, mais AUCUN droit
 // d'écrire ni de lire sans jeton (sauf create/join, à limiter au proxy).
 const requestOrigin=req.headers.get('Origin');
 if(requestOrigin&&requestOrigin!==origin)return error('Origine non autorisée',403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:headers()});
 if(req.method!=='POST')return error('Méthode non autorisée',405);
 try{
  const size=req.headers.get('Content-Length');
  if(size&&Number(size)>maxBody)return error('Requête trop volumineuse',413);
  const raw=await req.text();
  if(raw.length>maxBody)return error('Requête trop volumineuse',413);
  let body;
  try{body=JSON.parse(raw);}catch{return error('JSON invalide');}
  if(!body||Array.isArray(body)||typeof body!=='object')return error('Requête invalide');
  if(body.action==='honours')return await getHonours();
  if(body.action==='record-local'){
   if(!await allowPublicAction('record'))return error('Limite horaire des résultats atteinte. Réessaie plus tard.',429);
   return await recordLocal(body);
  }
  if(body.action==='create'){
   if(body.firstClub!==undefined&&!['PSG','OM'].includes(body.firstClub))
    return error('Club inconnu',400);
   if(body.identityId!==undefined&&!isDisplayClub(body.identityId))return error('Club sélectionné invalide',400);
   if(!await allowPublicAction('create'))
    return error('Trop de salons créés récemment. Réessaie plus tard.',429);
   return await create(body);
  }
  if(body.action==='join'){
   if(!safeCode(body.code))return error('Code de salon invalide',400);
   if(body.identityId!==undefined&&!isDisplayClub(body.identityId))return error('Club sélectionné invalide',400);
   if(!await allowPublicAction('join'))
    return error('Trop de tentatives de connexion. Réessaie plus tard.',429);
   return await join(body);
  }
  if(body.action==='get')return await get(body);
  if(body.action==='market')return await mutate(body,'market');
  if(body.action==='lineup')return await mutate(body,'lineup');
  if(body.action==='match')return await mutate(body,'match');
  return error('Action inconnue');
 }catch(e){
  console.error('opfc-online:',e instanceof Error?e.message:'server error');
  return error('Serveur OPFC temporairement indisponible',500);
 }
});
