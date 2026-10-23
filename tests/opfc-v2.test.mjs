/** Exécuter avec : node --test tests/opfc-v2.test.mjs */
import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {matchPerformances} from '../opfc/player-performance.mjs';
import {STADIUMS,isStadium} from '../opfc/stadiums.mjs';
import {onlineMarketPublicView} from '../opfc/online-market.mjs';
import {onlineKickoffView,applyOnlineLineupCommand} from '../opfc/online-lineup.mjs';
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

test('Corner et coup franc combiné : tireur passeur, réceptionneur buteur',()=>{
 const history=[
  {outcome:'goal',details:{kind:'corner',takerId:'a1',receiverId:'a2',
    duel:{outcome:{outcome:'chance'}},keeperId:'b0'}},
  {outcome:'goal',details:{kind:'free-kick',takerId:'a3',receiverId:'a4',
    duel:{outcome:{outcome:'chance'}},keeperId:'b0'}}
 ];
 const goals=[{club:'PSG',cardId:'a2',assistId:'a1',minute:14},
  {club:'PSG',cardId:'a4',assistId:'a3',minute:46}];
 const p=finish(goals,history).players;
 assert.equal(p.a1.assists,1);assert.equal(p.a2.goals,1);
 assert.equal(p.a3.assists,1);assert.equal(p.a4.goals,1);
 assert.equal(p.a1.attacks,1);assert.equal(p.a3.attacks,1);
});
test('Penalty direct : tireur buteur, pas de passe D, gardien crédité si arrêt',()=>{
 const goals=[{club:'PSG',cardId:'a0',minute:21}];
 const history=[
  {outcome:'goal',details:{kind:'penalty',takerId:'a0',keeperId:'b0',assistId:null}},
  {outcome:'save',details:{kind:'penalty',takerId:'a2',keeperId:'b0'}}
 ];
 const p=finish(goals,history).players;
 assert.equal(p.a0.goals,1);assert.equal(p.b0.saves,1);
 assert.equal(Object.values(p).reduce((n,x)=>n+x.assists,0),0);
});
test('Un match ancien ne reçoit aucune passe fictive à partir des seuls buts',()=>{
 const players=finish([{club:'PSG',cardId:'a0',minute:27}],[{outcome:'goal'}]).players;
 assert.equal(players.a0.goals,1);
 assert.equal(Object.values(players).reduce((n,p)=>n+p.assists,0),0);
});

test('Avant-match V2 : les deux joueurs valident séparément, le serveur protège le coup d’envoi',()=>{
 const mk=club=>({club,identityId:club,roster:[],slots:Array(7).fill(null),
  formation:'2-2-2',budget:100,refusals:0,ready:true,hakis:{observation:false,kings:false}});
 const current={version:1,phase:'kickoff-ready',competition:'league',stadiumId:'mugiwara',
  playerStatsVersion:2,prematchReady:{PSG:false,OM:false},
  teams:[mk('PSG'),mk('OM')],dice:[1,3],auction:null,lastResult:null};
 assert.throws(()=>applyOnlineLineupCommand(current,'PSG',{type:'kickoff'},{hostClub:'PSG'}),
  /doivent confirmer/);
 const host=applyOnlineLineupCommand(current,'PSG',{type:'prematch-next'},{hostClub:'PSG'});
 assert.deepEqual(host.state.prematchReady,{PSG:true,OM:false});
 assert.deepEqual(host.publicForActor.prematchReady,{PSG:true,OM:false});
 assert.throws(()=>applyOnlineLineupCommand(host.state,'PSG',{type:'prematch-next'},{hostClub:'PSG'}),
  /déjà confirmée/);
 assert.throws(()=>applyOnlineLineupCommand(host.state,'PSG',{type:'kickoff'},{hostClub:'PSG'}),
  /doivent confirmer/);
 const guest=applyOnlineLineupCommand(host.state,'OM',{type:'prematch-next'},{hostClub:'PSG'});
 assert.deepEqual(guest.state.prematchReady,{PSG:true,OM:true});
 assert.throws(()=>applyOnlineLineupCommand(guest.state,'OM',{type:'kickoff'},{hostClub:'PSG'}),
  /Seul l’hôte/);
});
test('Salons historiques : pas de nouvelle obligation avant le coup d’envoi',()=>{
 const mk=club=>({club,identityId:club,roster:[],slots:Array(7).fill(null),
  formation:'2-2-2',budget:100,refusals:0,ready:true,hakis:{observation:false,kings:false}});
 const old={version:1,phase:'kickoff-ready',competition:'league',teams:[mk('PSG'),mk('OM')],
  dice:[1,3],auction:null,lastResult:null};
 assert.equal(Object.hasOwn(onlineMarketPublicView(old,'PSG'),'prematchReady'),false);
 assert.throws(()=>applyOnlineLineupCommand(old,'PSG',{type:'prematch-next'},{hostClub:'PSG'}),
  /indisponible/);
});
