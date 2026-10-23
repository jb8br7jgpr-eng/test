/** Exécuter : node --test tests/opfc-v2-catalog-sort.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import {sortCatalogCharacters,sortCatalogClubs,characterStatSortAvailable} from '../opfc/catalog-sorting.mjs';
import {loadPlayerTotals} from '../opfc/player-totals-service.mjs';
import {matchPerformances} from '../opfc/player-performance.mjs';

const players=[
 {id:'a',name:'Zoro',rating:90},
 {id:'b',name:'Ener',rating:85},
 {id:'c',name:'Alabasta',rating:85},
 {id:'d',name:'Luffy',rating:75}
];
const totals=new Map([
 ['a',{matches:3,goals:1,assists:0,anchors:0}],
 ['b',{matches:8,goals:2,assists:6,anchors:2}],
 ['c',{matches:8,goals:6,assists:3,anchors:0}],
 ['d',{matches:2,goals:0,assists:1,anchors:5}]
]);
const names=(mode,options={totals,complete:true})=>
 sortCatalogCharacters(players,mode,options).map(p=>p.name);

test('Les personnages sont triés dans les deux sens alphabétiques, sans perdre le tri par note',()=>{
 assert.deepEqual(names('alpha'),['Alabasta','Ener','Luffy','Zoro']);
 assert.deepEqual(names('alpha-desc'),['Zoro','Luffy','Ener','Alabasta']);
 assert.deepEqual(names('rating'),['Zoro','Alabasta','Ener','Luffy']);
});
test('Le catalogue classe chaque statistique décroissante avec égalités déterministes',()=>{
 assert.deepEqual(names('matches'),['Alabasta','Ener','Zoro','Luffy']);
 assert.deepEqual(names('goals'),['Alabasta','Ener','Zoro','Luffy']);
 assert.deepEqual(names('assists'),['Ener','Alabasta','Luffy','Zoro']);
 assert.deepEqual(names('anchors'),['Luffy','Ener','Zoro','Alabasta']);
});
test('Les statistiques non encore synchronisées ne produisent pas un faux classement',()=>{
 assert.equal(characterStatSortAvailable('assists',totals,false),false);
 assert.equal(characterStatSortAvailable('goals',totals,false),true);
 assert.deepEqual(names('anchors',{totals:null,complete:false}),
  ['Zoro','Alabasta','Ener','Luffy']);
 assert.deepEqual(names('goals',{totals,complete:false}),
  ['Alabasta','Ener','Zoro','Luffy']);
});
test('Les clubs supportent A vers Z et Z vers A sans altérer les classements de trophées',()=>{
 const clubs=[
  {id:'psg',name:'Pirates Saint-Grandline'},
  {id:'b',name:'Bayern de Wano'},
  {id:'z',name:'Zoro FC'}
 ];
 const honours={psg:{cup:4,league:0},b:{cup:1,league:3},z:{cup:5,league:0}};
 const trophies=[{key:'cup'},{key:'league'}];
 const sort=mode=>sortCatalogClubs(clubs,mode,honours,trophies).map(c=>c.name);
 assert.deepEqual(sort('alpha'),['Bayern de Wano','Pirates Saint-Grandline','Zoro FC']);
 assert.deepEqual(sort('alpha-desc'),['Zoro FC','Pirates Saint-Grandline','Bayern de Wano']);
 assert.deepEqual(sort('total'),['Zoro FC','Bayern de Wano','Pirates Saint-Grandline']);
 assert.deepEqual(sort('cup'),['Zoro FC','Pirates Saint-Grandline','Bayern de Wano']);
});

test('Une valeur de carrière null ne peut jamais être affichée comme un vrai zéro',async()=>{
 const previous=globalThis.fetch;
 try{
  globalThis.fetch=async()=>({ok:true,json:async()=>[
   {card_id:'luffy',matches:null,goals:2,assists:0,anchors:0}
  ]});
  await assert.rejects(loadPlayerTotals(),/invalides/);
  globalThis.fetch=async()=>({ok:true,json:async()=>[
   {card_id:'luffy',matches:'3',goals:2,assists:0,anchors:1}
  ]});
  const {totals,complete}=await loadPlayerTotals();
  assert.equal(complete,true);
  assert.deepEqual(totals.get('luffy'),{matches:3,goals:2,assists:0,anchors:1});
 }finally{
  globalThis.fetch=previous;
 }
});

test('De la feuille de match au classement permanent : buts, passes et Ancres d’Or',()=>{
 const psg=['a0','a1','a2','a3','a4','a5','a6'];
 const om=['b0','b1','b2','b3','b4','b5','b6'];
 const squads=[{club:'PSG',roster:psg},{club:'OM',roster:om}];
 const results=[
  matchPerformances({phase:'finished',teams:squads,match:{
   history:[{outcome:'goal',details:{kind:'open',duel:{outcome:{outcome:'chance'}},
    roles:{carrier:{cardId:'a1'},partner:{cardId:'a2'}}}}],
   goals:[{club:'PSG',cardId:'a2',assistId:'a1',minute:19}]
  }}),
  matchPerformances({phase:'finished',teams:squads,match:{
   history:[{outcome:'goal',details:{kind:'open',duel:{outcome:{outcome:'chance'}},
    roles:{carrier:{cardId:'a1'},partner:{cardId:'a2'}}}}],
   goals:[{club:'PSG',cardId:'a1',assistId:'a2',minute:61}]
  }})
 ];
 const merged=new Map();
 for(const match of results)for(const [id,p] of Object.entries(match.players)){
  const old=merged.get(id)??{matches:0,goals:0,assists:0,anchors:0};
  for(const key of ['matches','goals','assists','anchors'])old[key]+=p[key];
  merged.set(id,old);
 }
 assert.deepEqual(merged.get('a1'),{matches:2,goals:1,assists:1,anchors:1});
 assert.deepEqual(merged.get('a2'),{matches:2,goals:1,assists:1,anchors:1});
 assert.deepEqual(merged.get('b0'),{matches:2,goals:0,assists:0,anchors:0});
 assert.deepEqual(['a1','a2'].map(id=>merged.get(id).matches),[2,2]);
 const lookup=[
  {id:'a1',name:'Passeur A',rating:74},
  {id:'a2',name:'Buteur B',rating:86},
  {id:'b0',name:'Gardien C',rating:90}
 ];
 const winners=sortCatalogCharacters(lookup,'anchors',{totals:merged,complete:true});
 assert.deepEqual(winners.map(p=>p.id),['a2','a1','b0']);
 const scorers=sortCatalogCharacters(lookup,'goals',{totals:merged,complete:true});
 assert.deepEqual(scorers.map(p=>p.id),['a2','a1','b0']);
});
