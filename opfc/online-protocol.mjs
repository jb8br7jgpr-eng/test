/**
 * OPFC — bloc 10A1 : protocole de salon en ligne indépendant.
 * Aucune logique de jeu, aucun secret ni état d'enchère n'est exposé ici.
 * Compatible Node.js (tests) et Supabase Edge/Deno (serveur futur).
 */
import {createGame} from './engine.mjs';
import {currentClubChoices} from './club-identities.mjs';

export const ONLINE_PROTOCOL_VERSION=1;
export const ROOM_ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TOKEN_RE=/^[A-Za-z0-9_-]{43}$/;
const CODE_RE=/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SALON_STATUS=Object.freeze(['waiting','ready','finished']);
const fail=msg=>{throw new Error(msg);};
function cryptoSource(){
 const c=globalThis.crypto;
 if(!c?.getRandomValues||!c?.subtle)fail('Cryptographie sécurisée indisponible');
 return c;
}
export function secureRandomBytes(size){
 if(!Number.isInteger(size)||size<1||size>65536)fail('Taille aléatoire invalide');
 const data=new Uint8Array(size);
 cryptoSource().getRandomValues(data);
 return data;
}
export function validateClub(club){
 if(club!=='PSG'&&club!=='OM')fail('Club inconnu');
 return club;
}
export function normalizeRoomCode(value){
 if(typeof value!=='string')fail('Code de salon invalide');
 const code=value.trim().toUpperCase().replace(/[\s-]/g,'');
 if(!CODE_RE.test(code))fail('Code de salon invalide');
 return code;
}
export function validateRoomId(value){
 if(typeof value!=='string'||!UUID_RE.test(value))fail('Identifiant de salon invalide');
 return value;
}
export function validateSessionToken(value){
 if(typeof value!=='string'||!TOKEN_RE.test(value))fail('Jeton de session invalide');
 return value;
}
/** 32 caractères : 5 bits/caractère, donc 30 bits pour six caractères.
 * L'entropie vient UNIQUEMENT du serveur, jamais de Math.random. */
export function generateRoomCode(bytes=secureRandomBytes(6)){
 if(!(bytes instanceof Uint8Array)||bytes.length!==6)fail('Six octets requis pour le code');
 if(ROOM_ALPHABET.length!==32)fail('Alphabet non conforme');
 return [...bytes].map(x=>ROOM_ALPHABET[x&31]).join('');
}
export function generateSessionToken(bytes=secureRandomBytes(32)){
 if(!(bytes instanceof Uint8Array)||bytes.length!==32)fail('Trente-deux octets requis pour le jeton');
 const base64=btoa(String.fromCharCode(...bytes));
 return base64.replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}
export async function sha256Token(token){
 validateSessionToken(token);
 const data=new TextEncoder().encode(token);
 const digest=new Uint8Array(await cryptoSource().subtle.digest('SHA-256',data));
 return [...digest].map(v=>v.toString(16).padStart(2,'0')).join('');
}
function equalHashes(a,b){
 if(typeof a!=='string'||typeof b!=='string'||a.length!==64||b.length!==64)return false;
 let mismatch=0;
 for(let i=0;i<64;i++)mismatch|=a.charCodeAt(i)^b.charCodeAt(i);
 return mismatch===0;
}
/** Le serveur peut identifier le club depuis un jeton sans faire confiance
 * au club déclaré dans la requête. Les hashs ne sortent jamais du backend. */
export async function authenticateRoom(room,token){
 let hash;
 try{hash=await sha256Token(token);}catch{return null;}
 if(equalHashes(room?.host_token_hash,hash))return 'host';
 if(equalHashes(room?.guest_token_hash,hash))return 'guest';
 return null;
}
/** Un seul moteur : deck, dés et événements générés sur le serveur avec
 * des tirages issus de crypto.getRandomValues, puis jamais envoyés aux clients. */
export function generateServerGame(firstClub){
 validateClub(firstClub);
 const random=()=>new DataView(secureRandomBytes(4).buffer).getUint32(0)/4294967296;
 return createGame({firstClub,rng:random});
}
/** Liste blanche explicite : le lobby ne révèle ni paquet, ni carte suivante,
 * ni secret de joueur, ni état complet du moteur. */
export function lobbyPublicView(row,role){
 if(role!=='host'&&role!=='guest')fail('Session non authentifiée');
 const hostClub=validateClub(row?.host_club);
 if(!SALON_STATUS.includes(row?.status))fail('État de salon invalide');
 const version=row?.version;
 if(!Number.isSafeInteger(version)||version<1)fail('Version de salon invalide');
 return Object.freeze({
  protocol:ONLINE_PROTOCOL_VERSION,
  id:validateRoomId(row.id),
  code:normalizeRoomCode(row.code),
  status:row.status,
  version,
  hostClub,
  guestClub:hostClub==='PSG'?'OM':'PSG',
  role,
  myClub:role==='host'?hostClub:hostClub==='PSG'?'OM':'PSG',
  opponentConnected:row.guest_token_hash!==null,
  competition:row.private_state?.competition??null,
  ...(Array.isArray(row?.private_state?.teams)?{clubChoices:currentClubChoices(row.private_state.teams)}:{}),
  // Cette date est une limite de session technique, pas une règle de match.
  expiresAt:row.expires_at
 });
}
