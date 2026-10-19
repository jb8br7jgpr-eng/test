import test from 'node:test';
import assert from 'node:assert/strict';
import {CARDS} from '../catalog.mjs';
import {calculatePenalty,averagePenaltyGoal} from '../penalty.mjs';
import {rankShootoutShooters,createShootout,nextShootoutShooter,applyShootoutKick} from '../shootout.mjs';
import {matchStats} from '../rules.mjs';
const a={formation:'2-2-2',slots:['chopper','jinbe','kaido','shanks','nami','luffy','zoro']};
const b={formation:'2-2-2',slots:['loki','mihawk','monkey-d-garp','katakuri','sabo','sanji','kizaru']};
const init=(draw=.1)=>createShootout({psg:a,om:b,regulationScore:{PSG:2,OM:2},coinDraw:draw});
const near=(x,y)=>assert.ok(Math.abs(x-y)<1e-8,String(x)+' != '+String(y));
function kick(s,resultDraw=.9999){
 const pick=nextShootoutShooter(s);
 assert.ok(pick);
 return applyShootoutKick(s,{club:pick.club,shooterId:pick.cardId,
   shotDirection:'GAUCHE',keeperDirection:'GAUCHE',draw:resultDraw});
}
test('Séance réservée à égalité à 90; pas de prolongations',()=>{
 assert.throws(()=>createShootout({psg:a,om:b,regulationScore:{PSG:1,OM:0},coinDraw:.1}),/égalité/);
 assert.throws(()=>createShootout({psg:a,om:b,regulationScore:{PSG:-1,OM:-1},coinDraw:.1}),/égalité/);
 assert.equal(init().regulationScore.PSG,2);
});
test('Lancer de pièce : PSG premier en dessous de 0,5, OM au-dessus',()=>{
 const p=init(0),o=init(.999);
 assert.equal(p.firstClub,'PSG');assert.equal(p.nextClub,'PSG');
 assert.equal(o.firstClub,'OM');assert.equal(o.nextClub,'OM');
 assert.equal(init(.5).firstClub,'OM');
 assert.throws(()=>init(1),/pièce/);
});
test('Sept tireurs par club, gardien inclus, classement distinct des sept cartes',()=>{
 const s=init();
 for(const club of ['PSG','OM']){
  const order=s.orders[club];
  assert.equal(order.length,7);
  assert.equal(new Set(order.map(x=>x.cardId)).size,7);
 }
 assert.ok(s.orders.PSG.some(x=>x.cardId==='chopper'));
 assert.ok(s.orders.OM.some(x=>x.cardId==='loki'));
});
test('Classement par probabilité moyenne réelle TEC/PUI et GAR adverse',()=>{
 const s=init();
 for(const club of ['PSG','OM']){
  const order=s.orders[club];
  for(const entry of order){
   const keeper=s.keepers[club==='PSG'?'OM':'PSG'];
   near(entry.averageGoal,averagePenaltyGoal(entry,keeper));
  }
  for(let i=1;i<order.length;i++)assert.ok(order[i-1].averageGoal>=order[i].averageGoal);
 }
});
test('Stats de classement proviennent du poste de terrain réel, pas du poste naturel',()=>{
 const altered={...a,slots:['chopper','luffy','kaido','shanks','nami','jinbe','zoro']};
 const s=createShootout({psg:altered,om:b,regulationScore:{PSG:1,OM:1},coinDraw:0});
 const luffy=s.orders.PSG.find(x=>x.cardId==='luffy');
 assert.equal(luffy.position,'DEF');
 assert.equal(luffy.stats.TEC,matchStats('luffy','DEF').TEC);
 assert.equal(luffy.stats.PUI,matchStats('luffy','DEF').PUI);
});
test('Les gardiens sont figés au poste GAR à la 90e et indépendants des mutations extérieures',()=>{
 const copyA={...a,slots:[...a.slots]};
 const s=createShootout({psg:copyA,om:b,regulationScore:{PSG:0,OM:0},coinDraw:0});
 copyA.slots[0]='zoro';
 assert.equal(s.keepers.PSG.cardId,'chopper');
 assert.equal(s.keepers.OM.cardId,'loki');
 assert.equal(s.regulationScore.PSG,0);
});
test('Tir automatique selon ordre figé et directions secrètes révélées ensemble',()=>{
 let s=init();
 const first=nextShootoutShooter(s);
 assert.equal(first.club,'PSG');assert.equal(first.shotNumber,1);
 s=kick(s,.9999);
 assert.equal(s.nextClub,'OM');
 assert.equal(s.timeline.length,1);
 assert.equal(s.timeline[0].shooterId,first.cardId);
 assert.equal(s.timeline[0].keeperId,'loki');
 assert.equal(s.timeline[0].result,'goal');
 assert.equal(s.score.PSG,1);
 assert.deepEqual(s.regulationScore,{PSG:2,OM:2});
});
test('Inviolabilité des tours et de l’ordre des tireurs',()=>{
 const s=init(),pick=nextShootoutShooter(s);
 const valid={club:pick.club,shooterId:pick.cardId,shotDirection:'GAUCHE',keeperDirection:'CENTRE',draw:.5};
 assert.throws(()=>applyShootoutKick(s,{...valid,club:'OM'}),/club/);
 assert.throws(()=>applyShootoutKick(s,{...valid,shooterId:'intrus'}),/Tireur/);
 assert.throws(()=>applyShootoutKick(s,{...valid,shotDirection:'INCONNU'}),/Direction/);
 assert.throws(()=>applyShootoutKick(s,{...valid,draw:1}),/Tirage/);
 assert.equal(s.timeline.length,0);
 const advanced=applyShootoutKick(s,valid);
 assert.equal(s.timeline.length,0);
 assert.equal(advanced.timeline.length,1);
});
test('Fin anticipée dès 3-0 (trois tirs chacun) : résultat hors d’atteinte',()=>{
 let s=init();
 for(let i=0;i<6;i++)s=kick(s,s.nextClub==='PSG'?.9999:0);
 assert.equal(s.phase,'finished');
 assert.equal(s.winner,'PSG');
 assert.equal(s.score.PSG,3);
 assert.equal(s.score.OM,0);
 assert.equal(s.attempts.PSG.length,3);
 assert.equal(s.attempts.OM.length,3);
 assert.equal(nextShootoutShooter(s),null);
 assert.throws(()=>kick(s),/./);
});
test('Cinq tirs chacun et égalité -> mort subite, départage par paires complètes',()=>{
 let s=init();
 for(let i=0;i<10;i++)s=kick(s,.9999);
 assert.equal(s.stage,'sudden-death');
 assert.equal(s.phase,'active');
 assert.deepEqual(s.score,{PSG:5,OM:5});
 s=kick(s,0);
 assert.equal(s.phase,'active');
 assert.equal(s.score.PSG,5);assert.equal(s.score.OM,5);
 s=kick(s,.9999);
 assert.equal(s.phase,'finished');
 assert.equal(s.winner,'OM');
 assert.deepEqual(s.score,{PSG:5,OM:6});
 assert.equal(s.timeline.length,12);
});
test('Après sept tireurs, la liste recommence au premier sans reclasser',()=>{
 let s=init();
 for(let i=0;i<14;i++)s=kick(s,.9999);
 assert.equal(s.phase,'active');
 assert.equal(s.stage,'sudden-death');
 assert.equal(s.attempts.PSG.length,7);
 assert.equal(s.attempts.OM.length,7);
 const shooter=nextShootoutShooter(s);
 assert.equal(shooter.club,'PSG');
 assert.equal(shooter.shotNumber,8);
 assert.equal(shooter.cardId,s.orders.PSG[0].cardId);
});
test('Écart à l’issue des cinq tirs par équipe : vainqueur, sans prolongations',()=>{
 let s=init();
 for(let i=0;i<10;i++){
  const current=s.nextClub;
  s=kick(s,i===9?0:.9999);
 }
 assert.equal(s.phase,'finished');
 assert.equal(s.winner,'PSG');
 assert.deepEqual(s.score,{PSG:5,OM:4});
});
test('Résultats de TAB exclus des buts et tirs du temps réglementaire',()=>{
 let s=init();
 const official=structuredClone(s.regulationScore);
 s=kick(s,.9999);s=kick(s,0);
 assert.deepEqual(s.regulationScore,official);
 assert.deepEqual(s.score,{PSG:1,OM:0});
 assert.equal(s.timeline.length,2);
});
test('Gardien et tireurs de deux clubs distincts obligatoires',()=>{
 const repeated={formation:'2-2-2',slots:[...a.slots]};
 assert.throws(()=>createShootout({psg:a,om:repeated,regulationScore:{PSG:0,OM:0},coinDraw:0}),/distincts/);
 const duplicate={...a,slots:['chopper','jinbe','jinbe','shanks','nami','luffy','zoro']};
 assert.throws(()=>rankShootoutShooters(duplicate,{stats:{GAR:75}}),/Doublons/);
});
