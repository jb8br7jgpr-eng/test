/**
 * Test du serveur OPFC VRAIMENT déployé, sans dépendre du site public.
 * Usage réservé à un essai contrôlé : une petite salle temporaire (7 jours)
 * est créée. Aucun jeton ni identité secrète n'est affiché dans la CI.
 */
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';

const URL=process.env.OPFC_REAL_EDGE_URL??'';
const ORIGIN='https://jb8br7jgpr-eng.github.io';
if(!URL||!/^https:\/\/[a-z0-9-]+\.supabase\.co\/functions\/v1\/opfc-online$/.test(URL))
 throw Error('Adresse Edge OPFC invalide ou absente');
async function call(payload,expected=200){
 const res=await fetch(URL,{
  method:'POST',headers:{'Content-Type':'application/json','Cache-Control':'no-store','Origin':ORIGIN},
  body:JSON.stringify(payload),signal:AbortSignal.timeout(18000)
 });
 const data=await res.json();
 assert.equal(res.status,expected,
  'Statut '+res.status+' reçu pour '+String(payload.action)+
  ' (attendu '+expected+', code: '+String(data?.protocol??'—')+')');
 return data;
}
function safe(room){
 assert.match(room.code,/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
 assert.equal(room.protocol,1);
 assert.equal(room.hostClub==='PSG'||room.hostClub==='OM',true);
 assert.equal(room.version>=1,true);
 for(const key of ['private_state','deck','host_token_hash','guest_token_hash'])
  assert.equal(Object.hasOwn(room,key),false,'État privé dans le salon : '+key);
}
const host=await call({action:'create',firstClub:'PSG'},201);
safe(host.room);
assert.equal(host.room.status,'waiting');
assert.equal(host.room.myClub,'PSG');
assert.equal(host.game,undefined);
assert.equal(host.session.role,'host');
const guest=await call({action:'join',code:host.room.code});
safe(guest.room);
assert.equal(guest.room.status,'ready');
assert.equal(guest.room.myClub,'OM');
const forHost=await call({action:'get',roomId:host.session.roomId,token:host.session.token});
safe(forHost.room);
assert.equal(forHost.room.myClub,'PSG');
assert.equal(forHost.game.phase,'mercato');
assert.equal(guest.room.status,'ready');
assert.equal(forHost.game.auction.turn==='PSG'||forHost.game.auction.turn==='OM',true);
assert.equal(forHost.game.deck,undefined);
assert.equal(forHost.game.match?.schedule,undefined);
const auctionTurn=forHost.game.auction.turn;
const token=auctionTurn==='PSG'?host.session.token:guest.session.token;
const amount=5;
const bid=await call({action:'market',roomId:host.session.roomId,token,
 expectedVersion:forHost.room.version,command:{type:'bid',amount}});
assert.equal(bid.game.phase,'mercato');
assert.equal(bid.game.auction.highestBid,amount);
assert.equal(bid.room.version,forHost.room.version+1);
assert.equal(bid.game.deck,undefined);
const refreshed=await call({action:'get',roomId:guest.session.roomId,token:guest.session.token});
assert.equal(refreshed.room.version,bid.room.version);
assert.equal(refreshed.game.auction.highestBid,amount);
// Une commande obsolète doit être refusée sans altérer le salon.
await call({action:'market',roomId:host.session.roomId,token,
 expectedVersion:forHost.room.version,command:{type:'bid',amount:6}},409);
const unauthorized=await call({action:'get',roomId:host.session.roomId,
 token:'A'.repeat(43)},403);
assert.equal(unauthorized.game,undefined);
console.log('PASS OPFC Edge réel : création, deuxième iPhone, salon privé, mercato, versions concurrentes et refus d’accès non autorisé');
