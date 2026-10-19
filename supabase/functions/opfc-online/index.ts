/**
 * OPFC / bloc 10A1 — Edge Function Supabase, NON DÉPLOYÉE.
 * Salon privé : create / join / get, sans moteur d'actions de match pour l'instant.
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
} from '../../../opfc/online-protocol.mjs';
import {applyOnlineMarketCommand} from '../../../opfc/online-market.mjs';
import {applyOnlineLineupCommand,onlinePreMatchView} from '../../../opfc/online-lineup.mjs';

const origin=Deno.env.get('OPFC_ALLOWED_ORIGIN')??'https://jb8br7jgpr-eng.github.io';
const supabaseUrl=Deno.env.get('SUPABASE_URL');
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if(!supabaseUrl||!serviceKey)throw Error('Supabase OPFC non configuré');
const db=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const maxBody=2048,MAX_CREATE_RETRIES=8;
const expiry=()=>new Date(Date.now()+7*86400_000).toISOString();
function headers(){
 return {
  'Content-Type':'application/json; charset=utf-8',
  'Access-Control-Allow-Origin':origin,
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Access-Control-Allow-Headers':'Content-Type, apikey, Authorization',
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
 for(let attempt=0;attempt<MAX_CREATE_RETRIES;attempt++){
  const code=generateRoomCode();
  const {data, error:dbError}=await db.from('opfc_rooms')
   .insert({
    code,host_club:hostClub,host_token_hash:hash,guest_token_hash:null,
    status:'waiting',private_state:initial,version:1,expires_at:expiry()
   })
   .select('id,code,host_club,guest_token_hash,status,version,expires_at')
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
  .select('id,code,host_club,guest_token_hash,status,version,expires_at')
  .eq('code',code).gt('expires_at',new Date().toISOString()).maybeSingle();
 if(readErr)throw new Error('Recherche du salon indisponible');
 if(!found)return error('Salon introuvable ou expiré',404);
 if(found.status!=='waiting'||found.guest_token_hash)return error('Salon déjà complet',409);
 const token=generateSessionToken(),hash=await sha256Token(token);
 // Compare-and-swap : si les deux iPhones rejoignent simultanément, un seul gagne.
 const {data:joined,error:joinErr}=await db.from('opfc_rooms')
  .update({
   guest_token_hash:hash,status:'ready',version:found.version+1,
   updated_at:new Date().toISOString()
  })
  .eq('id',found.id).eq('version',found.version).is('guest_token_hash',null)
  .eq('status','waiting')
  .select('id,code,host_club,guest_token_hash,status,version,expires_at')
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
 // Les vues de match propres à chaque joueur seront ajoutées en 10A3B.
 if(row.status!=='ready')return null;
 return onlinePreMatchView(row.private_state,club);
}
async function get(body){
 const auth=await authenticatedRoom(body);
 if(auth.error)return auth.error;
 return response({room:roomView(auth.row,auth.role),
  game:playerGameView(auth.row,auth.club)});
}
async function mutate(body,kind){
 const auth=await authenticatedRoom(body);
 if(auth.error)return auth.error;
 const {row,role,club}=auth;
 if(row.status!=='ready')return error('En attente du deuxième joueur',409);
 if(!Number.isSafeInteger(body.expectedVersion)||body.expectedVersion<1)
  return error('Version attendue invalide');
 if(row.version!==body.expectedVersion)
  return error('Salon modifié : actualise la partie',409);
 if(kind==='market'&&row.private_state?.phase!=='mercato')
  return error('Le mercato n’est plus actif',409);
 if(kind==='lineup'&&!['lineup','kickoff-ready'].includes(row.private_state?.phase))
  return error('La composition n’est pas disponible',409);
 let transition;
 try{
  transition=kind==='market'?
   applyOnlineMarketCommand(row.private_state,club,body.command):
   applyOnlineLineupCommand(row.private_state,club,body.command,{hostClub:row.host_club});
 }catch(e){
  return error(e instanceof Error?e.message:'Action illégale',400);
 }
 // Mise à jour atomique avec contrôle strict de la version et du statut.
 const {data:updated,error:writeErr}=await db.from('opfc_rooms')
  .update({
   private_state:transition.state,
   version:row.version+1,
   updated_at:new Date().toISOString()
  })
  .eq('id',row.id).eq('version',row.version).eq('status','ready')
  .select('id,code,host_club,guest_token_hash,status,version,expires_at')
  .maybeSingle();
 if(writeErr)throw new Error('Sauvegarde de la partie indisponible');
 if(!updated)return error('Salon modifié : actualise la partie',409);
 return response({room:roomView(updated,role),game:transition.publicForActor});
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
  if(body.action==='create')return await create(body);
  if(body.action==='join')return await join(body);
  if(body.action==='get')return await get(body);
  if(body.action==='market')return await mutate(body,'market');
  if(body.action==='lineup')return await mutate(body,'lineup');
  return error('Action inconnue');
 }catch(e){
  console.error('opfc-online:',e instanceof Error?e.message:'server error');
  return error('Serveur OPFC temporairement indisponible',500);
 }
});
