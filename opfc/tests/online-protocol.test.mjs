import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {
 ONLINE_PROTOCOL_VERSION,ROOM_ALPHABET,normalizeRoomCode,validateRoomId,
 validateSessionToken,validateClub,generateRoomCode,generateSessionToken,
 secureRandomBytes,sha256Token,authenticateRoom,generateServerGame,lobbyPublicView
} from '../online-protocol.mjs';

// Les primitives WebCrypto sont obligatoires côté serveur et injectées dans Node
// si la version de Node ne fournit pas globalThis.crypto par défaut.
globalThis.crypto ??= webcrypto;
const uuid='6be1626a-69ea-4a97-a858-ef04b5131721';
const row=(change={})=>({
 id:uuid,code:'ABCD23',host_club:'PSG',
 host_token_hash:'0'.repeat(64),guest_token_hash:null,
 status:'waiting',version:1,expires_at:'2026-10-27T00:00:00.000Z',
 private_state:{deck:['SECRET'],auction:{turn:'PSG'},cursor:2},
 ...change
});
test('Le code de salon utilise exactement 32 symboles non ambigus',()=>{
 assert.equal(ROOM_ALPHABET.length,32);
 assert.equal(new Set(ROOM_ALPHABET).size,32);
 for(const c of 'IO01')assert.equal(ROOM_ALPHABET.includes(c),false);
 const seen=[...Array(256)].map((_,i)=>generateRoomCode(new Uint8Array(6).fill(i)));
 assert.equal(new Set(seen).size,32);
 assert.equal(generateRoomCode(new Uint8Array([0,1,2,3,4,31])),ROOM_ALPHABET.slice(0,5)+ROOM_ALPHABET[31]);
});
test('Normalisation du code collé, espacé ou séparé par tiret',()=>{
 assert.equal(normalizeRoomCode('abcd23'),'ABCD23');
 assert.equal(normalizeRoomCode(' AB-CD 23 '),'ABCD23');
 assert.equal(normalizeRoomCode('A B C D 2 3'),'ABCD23');
 for(const value of ['A','ABCDEFG','IABCDE','01ABCD','ABC*23',null,12,''])assert.throws(()=>normalizeRoomCode(value),/Code/);
});
test('Jeton de 32 octets encodé en 43 caractères URL-safe',()=>{
 const token=generateSessionToken(new Uint8Array(32));
 assert.equal(token.length,43);
 assert.match(token,/^[A-Za-z0-9_-]{43}$/);
 assert.equal(validateSessionToken(token),token);
 assert.throws(()=>validateSessionToken('simple-code'),/Jeton/);
 assert.throws(()=>generateSessionToken(new Uint8Array(6)),/octets/);
});
test('La génération sécurisée crée des codes et jetons valides sans Math.random',()=>{
 const saved=Math.random;
 try{
  Math.random=()=>{throw Error('Math.random interdit sur serveur')};
  for(let i=0;i<20;i++){
   assert.match(generateRoomCode(),/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
   assert.match(generateSessionToken(),/^[A-Za-z0-9_-]{43}$/);
  }
  assert.equal(secureRandomBytes(32).length,32);
 }finally{Math.random=saved;}
 assert.throws(()=>secureRandomBytes(70000),/Taille/);
});
test('Hash SHA-256 : deux jetons indépendants restent privés',async()=>{
 const host=generateSessionToken(new Uint8Array(32).fill(1));
 const guest=generateSessionToken(new Uint8Array(32).fill(2));
 const h=await sha256Token(host),g=await sha256Token(guest);
 assert.match(h,/^[0-9a-f]{64}$/);
 assert.notEqual(h,g);
 assert.notEqual(h,host);
 assert.equal(h,await sha256Token(host));
 const session=row({host_token_hash:h,guest_token_hash:g,status:'ready'});
 assert.equal(await authenticateRoom(session,host),'host');
 assert.equal(await authenticateRoom(session,guest),'guest');
 assert.equal(await authenticateRoom(session,generateSessionToken(new Uint8Array(32).fill(3))),null);
 assert.equal(await authenticateRoom(session,'bad-token'),null);
});
test('Vue de salon explicitement limitée aux informations publiques',()=>{
 const source=row();
 const v=lobbyPublicView(source,'host');
 assert.equal(v.protocol,ONLINE_PROTOCOL_VERSION);
 assert.deepEqual(Object.keys(v),[
  'protocol','id','code','status','version','hostClub',
  'guestClub','role','myClub','opponentConnected','expiresAt'
 ]);
 assert.equal(v.opponentConnected,false);
 assert.equal(v.myClub,'PSG');
 assert.equal(v.guestClub,'OM');
 assert.equal(v.private_state,undefined);
 assert.equal(v.host_token_hash,undefined);
 assert.equal(v.guest_token_hash,undefined);
 assert.equal(JSON.stringify(v).includes('SECRET'),false);
 const guest=lobbyPublicView(row({guest_token_hash:'a'.repeat(64),status:'ready',version:2}),'guest');
 assert.equal(guest.opponentConnected,true);
 assert.equal(guest.myClub,'OM');
 assert.ok(Object.isFrozen(v));
});
test('La vue de salon expose BDW contre BDR sans divulguer de secrets',()=>{
 const source=row({private_state:{
  teams:[{club:'PSG',identityId:'BDW'},{club:'OM',identityId:'BDR'}],
  deck:['TOPSECRET'],private:'SECRET'
 }});
 const view=lobbyPublicView(source,'guest');
 assert.deepEqual(view.clubChoices,{PSG:'BDW',OM:'BDR'});
 assert.equal(view.myClub,'OM');
 assert.doesNotMatch(JSON.stringify(view),/TOPSECRET|private_state|SECRET/);
});
test('Validation des rôles, clubs, versions et UUID',()=>{
 assert.equal(validateClub('OM'),'OM');
 assert.throws(()=>validateClub('autre'),/Club/);
 assert.equal(validateRoomId(uuid),uuid);
 assert.throws(()=>validateRoomId('123'),/Identifiant/);
 for(const bad of [{status:'offline'},{version:0},{host_club:'autre'},{id:'bad'}])
  assert.throws(()=>lobbyPublicView(row(bad),'host'));
 assert.throws(()=>lobbyPublicView(row(),'stranger'),/non authentifiée/);
});
test('Création d’une vraie partie côté serveur, avec paquet de 50 personnages caché',()=>{
 for(const club of ['PSG','OM']){
  const game=generateServerGame(club);
  assert.equal(game.phase,'mercato');
  assert.equal(game.teams[0].club,club);
  assert.equal(game.teams[1].club,club==='PSG'?'OM':'PSG');
  assert.equal(game.deck.length,50);
  assert.equal(new Set(game.deck).size,50);
  assert.equal(game.teams[0].budget,250);
  assert.equal(game.teams[1].budget,250);
  assert.equal(game.auction.highestBid,0);
 }
});
test('Schema SQL reste séparé, privé et non appliqué automatiquement',()=>{
 const sql=readFileSync(new URL('../../supabase/opfc-schema.sql',import.meta.url),'utf8');
 assert.match(sql,/create table if not exists public\.opfc_rooms/);
 assert.match(sql,/row level security/);
 assert.match(sql,/revoke all privileges .* anon, authenticated/);
 assert.match(sql,/grant select, insert, update, delete .* service_role/);
 assert.match(sql,/private_state jsonb not null/);
 assert.match(sql,/guest_token_hash text/);
 assert.doesNotMatch(sql,/drop table|alter table\s+public\.(?!opfc_rooms)/i);
});
test('Fonction serveur distincte de la fonction OPMercato classique',()=>{
 const edge=readFileSync(new URL('../../supabase/functions/opfc-online/index.ts',import.meta.url),'utf8');
 assert.match(edge,/from ['"]\.\.\/\.\.\/\.\.\/opfc\/online-protocol\.mjs/);
 assert.match(edge,/guest_token_hash.*null/);
 assert.match(edge,/status:'waiting'/);
 assert.match(edge,/status:'ready'/);
 assert.match(edge,/\.eq\('version',found\.version\)/);
 assert.match(edge,/authenticateRoom/);
 assert.match(edge,/lobbyPublicView/);
 assert.match(edge,/maxBody=2048/);
 assert.match(edge,/no-store/);
 assert.doesNotMatch(edge,/Math\.random|opmercato-online|localStorage|SUPABASE_ANON_KEY/);
});
