/** Exécuter avec : node --test tests/opfc-v2.test.mjs */
import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {matchPerformances} from '../opfc/player-performance.mjs';
import {STADIUMS,isStadium} from '../opfc/stadiums.mjs';
import {onlineMarketPublicView} from '../opfc/online-market.mjs';
import {onlineKickoffView} from '../opfc/online-lineup.mjs';
const clubs=[{club:'PSG',roster:['a0','a1','a2','a3','a4','a5','a6']},
 {club:'OM',roster:['b0','b1','b2','b3','b4','b5','b6']}];
const finish=(goals,history)=>matchPerformances({phase:'finished',teams:clubs,match:{goals,history}});
const open=(carrier,partner,outcome)=>({outcome:outcome==='stopped'?'stopped':'goal',details:{
 kind:'open',duel:{outcome:{outcome}},roles:{carrier:{cardId:carrier},partner:{cardId:partner}},
 defenderId:'b1',keeperId:'b0'}});
test('Collection de huit stades distincts, images WebP',()=>{
 assert.equal(STADIUMS.length,8);
 assert.equal(new Set(STADIUMS.map(s=>s.id)).size,8);
 assert.ok(STADIUMS.every(s=>isStadium(s.id)&&s.image.endsWith('.webp')&&s.capacity>=40000));
});
test('Passe courte : porteur marque, partenaire passeur',()=>{
 const p=finish([{club:'PSG',cardId:'a0',assistId:'a1',minute:24}],[open('a0','a1','chance')]).players;
 assert.equal(p.a0.goals,1);assert.equal(p.a1.assists,1);
 assert.equal(p.a0.attacks,1);assert.equal(p.a0.points,6);
 assert.equal(p.a1.points,3);
});
test('Passe courte : partenaire marque, porteur passeur',()=>{
 const p=finish([{club:'PSG',cardId:'a1',assistId:'a0',minute:25}],[open('a0','a1','chance')]).players;
 assert.equal(p.a1.goals,1);assert.equal(p.a0.assists,1);assert.equal(p.a0.points,4);
});
test('Arrêt et défense comptés chez leurs acteurs, pas de passe sur échec',()=>{
 const p=finish([],[open('a0','a1','stopped'),{outcome:'save',details:{kind:'penalty',keeperId:'b0'}}]).players;
 assert.equal(p.b1.defenses,1);assert.equal(p.b0.saves,1);assert.equal(p.b0.points,3);
 assert.equal(p.a0.assists,0);
});
test('Le score de départage aux tirs au but ne compte pas',()=>{
 const p=matchPerformances({phase:'finished',teams:clubs,match:{
  goals:[],history:[],shootout:{score:{PSG:5,OM:4}}}}).players;
 assert.ok(Object.values(p).every(x=>x.goals===0&&x.assists===0));
 assert.equal(Object.values(p).reduce((n,x)=>n+x.anchors,0),1);
});
test('Ancien match sans détails conserve son but',()=>{
 const p=finish([{club:'PSG',cardId:'a3',minute:48}],[{outcome:'goal'}]).players;
 assert.equal(p.a3.goals,1);assert.equal(p.a3.assists,0);
});

test('Compatibilité V1/V2 : les salons existants ne reçoivent aucun nouveau champ',()=>{
 const mk=id=>({club:id,identityId:id,roster:[],budget:100,refusals:0,
  formation:'2-2-2',slots:Array(7).fill(null),ready:true,hakis:{observation:false,kings:false}});
 const old={version:1,phase:'kickoff-ready',competition:'league',
  teams:[mk('PSG'),mk('OM')],dice:[2,5],auction:null,lastResult:null};
 const legacy=onlineMarketPublicView(old,'PSG');
 assert.equal(Object.hasOwn(legacy,'stadiumId'),false);
 assert.equal(Object.hasOwn(legacy,'competition'),false);
 const fresh=onlineMarketPublicView({...old,stadiumId:'whole-cake'},'PSG');
 assert.equal(fresh.stadiumId,'whole-cake');
 assert.equal(fresh.competition,'league');
});
test('Compatibilité V1/V2 : le premier état du match conserve la forme attendue',()=>{
 const mk=id=>({club:id,identityId:id,roster:[],budget:100,refusals:0,
  formation:'2-2-2',slots:Array(7).fill(null),ready:true,hakis:{observation:false,kings:false}});
 const initial={version:1,phase:'match',dice:[2,5],
  teams:[mk('PSG'),mk('OM')],match:{index:0,history:[],action:null,
  minute:13,score:{PSG:0,OM:0},statistics:{PSG:{},OM:{}},
  goals:[],schedule:[{minute:13,type:'open',attacker:'PSG',period:1}]}};
 const old=onlineKickoffView(initial);
 assert.equal(Object.hasOwn(old,'stadiumId'),false);
 const updated=onlineKickoffView({...initial,stadiumId:'whole-cake'});
 assert.equal(updated.stadiumId,'whole-cake');
});
