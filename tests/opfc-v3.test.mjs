import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CATEGORIES,rankCards,hallSeven} from '../opfc/v3-hall-core.mjs';
import {renderV3Hall} from '../opfc/v3-hall-view.mjs';
import {CARDS} from '../opfc/catalog.mjs';
import {clubMetrics,loadV3ClubStats,loadV3PlayerPoints,loadV3Milestones} from '../opfc/v3-data-service.mjs';
const s=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('Le Sept de Légende garde exactement 1 G, 2 D, 2 M et 2 A',()=>{
 const cards=['GAR','DEF','MIL','ATT'].flatMap((position,pi)=>[1,2,3].map(n=>({id:position+n,position})));
 const points=new Map(cards.map(c=>[c.id,Number(c.id.at(-1))*10]));
 const seven=hallSeven(cards,points);
 assert.equal(seven.length,7);
 for(const [position,n] of Object.entries({GAR:1,DEF:2,MIL:2,ATT:2})){
  const selected=seven.filter(x=>x.position===position);
  assert.equal(selected.length,n);
  assert.equal(selected[0].points,30);
 }
});
test('A égalité, le titulaire sort uniquement lorsqu’il est dépassé',()=>{
 const cards=[{id:'A'},{id:'B'},{id:'C'}];
 const tied=new Map([['A',{points:12}],['B',{points:12}],['C',{points:7}]]);
 assert.equal(rankCards(cards,'points',tied,{incumbents:['B']})[0].id,'B');
 tied.get('A').points=13;
 assert.equal(rankCards(cards,'points',tied,{incumbents:['B']})[0].id,'A');
});
test('Ratios, victoires TAB et différence de buts sont calculés sans compter les TAB comme buts',()=>{
 const m=clubMetrics({matches:4,wins:3,losses:1,goalsFor:8,goalsAgainst:5});
 assert.equal(m.ratio,75);
 assert.equal(m.diff,3);
 assert.equal(clubMetrics({matches:0,wins:0,losses:0,goalsFor:0,goalsAgainst:0}).ratio,null);
});
test('Données publiques V3 : lecture refusant valeurs null et négatives',async()=>{
 const old=globalThis.fetch;
 try{
  globalThis.fetch=async url=>({ok:true,json:async()=>url.includes('club_totals')?
   [{club_id:'BDW',matches:2,wins:1,losses:1,goals_for:3,goals_against:2}]:
   [{card_id:'luffy',points:15}]});
  assert.equal((await loadV3ClubStats()).get('BDW').wins,1);
  assert.equal((await loadV3PlayerPoints()).get('luffy'),15);
  globalThis.fetch=async()=>({ok:true,json:async()=>[{card_id:'luffy',points:null}]});
  await assert.rejects(loadV3PlayerPoints(),/invalides/);
 }finally{globalThis.fetch=old;}
});
test('Le bouton et la matrice ne changent aucun choix de l’action moteur',()=>{
 const help=s('../opfc/v3-tactical-help.mjs'),ui=s('../opfc/ui.mjs'),css=s('../opfc/v3-match.css');
 assert.match(help,/Passe en profondeur/);
 for(const action of ['Tacler','Intercepter','Pressing','Passe courte','Dribbler'])assert.ok(help.includes(action));
 assert.match(ui,/v3HelpUi/);
 assert.match(css,/data-v3-phase/);
 assert.doesNotMatch(css,/\.match-choice\s*\{/);
 assert.equal(CATEGORIES.length,4);
});

test('Les égalités utilisent les dates de palier communes à tous les appareils',()=>{
 const cards=[{id:'A'},{id:'B'}],totals=new Map([['A',{points:20}],['B',{points:20}]]);
 const milestones=new Map([['A',{points:'2026-10-20T10:00:00Z'}],['B',{points:'2026-10-21T10:00:00Z'}]]);
 assert.equal(rankCards(cards,'points',totals,{incumbents:['B'],milestones})[0].id,'A');
 totals.get('B').points=21;
 assert.equal(rankCards(cards,'points',totals,{incumbents:['A'],milestones})[0].id,'B');
});
test('Dates des paliers chargées uniquement depuis les compteurs publics',async()=>{
 const old=globalThis.fetch;
 try{
  globalThis.fetch=async()=>({ok:true,json:async()=>[{card_id:'zoro',matches_at:null,goals_at:null,assists_at:null,anchors_at:null,points_at:'2026-10-24T12:00:00Z'}]});
  assert.equal((await loadV3Milestones()).get('zoro').points,'2026-10-24T12:00:00Z');
 }finally{globalThis.fetch=old;}
});

test('Hall complet : les quatre classements affichent chacun tous les personnages, même à zéro',()=>{
 const old=globalThis.localStorage;
 try {
  globalThis.localStorage={getItem:()=>null,setItem:()=>{}};
  const totals=new Map(CARDS.map(c=>[c.id,{matches:0,goals:0,assists:0,anchors:0}]));
  totals.get(CARDS[0].id).goals=3;
  const points=new Map(CARDS.map(c=>[c.id,5]));
  const html=renderV3Hall(totals,points,new Map());
  // Les quatre classements historiques conservent leurs 75 entrées et le podium du buteur.
  assert.equal((html.match(/<li>/g)||[]).length,4*CARDS.length+1);
  assert.equal((html.match(/class="v3-hall-player"/g)||[]).length,7);
  assert.match(html,/class="v3-hall-pitch slot-field slot-field-single"/);
 }finally{globalThis.localStorage=old;}
});

test('Prétendants : 75 portraits ronds, 4 postes, points et écart sans changer le Sept',()=>{
 const original=globalThis.localStorage;
 try{
  globalThis.localStorage={getItem:()=>null,setItem:()=>{}};
  const totals=new Map(CARDS.map(c=>[c.id,{matches:0,goals:0,assists:0,anchors:0}]));
  const points=new Map(CARDS.map(c=>[c.id,0]));
  const defenders=CARDS.filter(c=>c.position==='DEF');
  assert.ok(defenders.length>=3);
  points.set(defenders[0].id,40);
  points.set(defenders[1].id,30);
  points.set(defenders[2].id,27);
  const before=hallSeven(CARDS,points,{},new Map());
  const html=renderV3Hall(totals,points,new Map());
  const after=hallSeven(CARDS,points,{},new Map());
  assert.deepEqual(after,before);
  assert.match(html,/<details class="discovery-panel v3-hall-chasers">/);
  assert.equal((html.match(/class="v3-hall-rank-row/g)||[]).length,CARDS.length);
  assert.equal((html.match(/class="v3-hall-rank-avatar"/g)||[]).length,CARDS.length);
  assert.equal((html.match(/class="v3-hall-position"/g)||[]).length,4);
  assert.match(html,/Gardiens[\s\S]*Défenseurs[\s\S]*Milieux[\s\S]*Attaquants/);
  assert.match(html,/−3 pts du dernier titulaire/);
  assert.match(html,/★ Sept de légende/);
  assert.match(html,/<strong>0<\/strong><small>pts<\/small>/);
  assert.match(html,/v3-hall-rank-avatar"><img src="\.\/portraits_opfc\//);
 }finally{globalThis.localStorage=original;}
});
