/** Exécuter : node --test tests/opfc-v2-catalog-sort.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import {sortCatalogCharacters,sortCatalogClubs,characterStatSortAvailable} from '../opfc/catalog-sorting.mjs';

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
