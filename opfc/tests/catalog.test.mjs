import test from 'node:test';
import assert from 'node:assert/strict';
import {CARDS,CARD_BY_ID,CLUBS} from '../catalog.mjs';
test('Exactement 50 cartes uniques et 7 groupes',()=>{
 assert.equal(CARDS.length,50);
 assert.equal(CARD_BY_ID.size,50);
 assert.equal(new Set(CARDS.map(c=>c.group)).size,7);
});
test('Raretés officielles 6 Diamant / 14 Or / 15 Argent / 15 Bronze',()=>{
 const n=rarity=>CARDS.filter(c=>c.rarity===rarity).length;
 assert.deepEqual([n('DIA'),n('OR'),n('ARG'),n('BRZ')],[6,14,15,15]);
});
test('Répartition des groupes 10/10/6/9/5/4/6',()=>{
 const tally=Object.values(CARDS.reduce((o,c)=>(o[c.group]=(o[c.group]||0)+1,o),{}));
 assert.deepEqual(tally,[10,10,6,9,5,4,6]);
});
test('Chaque carte a six statistiques entières entre 0 et 100',()=>{
 for(const c of CARDS){
  assert.match(c.id,/^[a-z0-9-]+$/);assert.ok(c.name);
  assert.ok(['ATT','DEF','MIL','GAR'].includes(c.position));
  assert.ok(Number.isInteger(c.rating)&&c.rating>=0&&c.rating<=100);
  assert.deepEqual(Object.keys(c.stats),['PUI','TEC','PAS','VIT','DEF','GAR']);
  for(const n of Object.values(c.stats))assert.ok(Number.isInteger(n)&&n>=0&&n<=100,c.name);
 }
});
test('Valeurs clés et bornes du dossier v0.8',()=>{
 assert.equal(CARD_BY_ID.get('luffy').rating,93);
 assert.equal(CARD_BY_ID.get('gol-d-roger').rating,96);
 assert.equal(CARD_BY_ID.get('rocks-d-xebec').rating,96);
 assert.equal(CARD_BY_ID.get('loki').position,'GAR');
 assert.equal(CARD_BY_ID.get('scratchmen-apoo').rating,59);
 assert.equal(Math.max(...CARDS.map(c=>c.rating)),96);
 assert.equal(Math.min(...CARDS.map(c=>c.rating)),59);
 assert.equal(CARD_BY_ID.get('kizaru').stats.VIT,100);
});
test('Identités des deux clubs et aucun bonus sportif implicite',()=>{
 assert.deepEqual(CLUBS.map(c=>c.id),['PSG','OM']);
 assert.deepEqual(CLUBS.map(c=>c.name),['Pirates Saint-Grandline','Olympique de MaryGeoise']);
});
