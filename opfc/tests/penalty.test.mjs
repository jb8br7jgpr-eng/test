import test from 'node:test';
import assert from 'node:assert/strict';
import {calculatePenalty,resolvePenalty,averagePenaltyGoal,PENALTY_DIRECTIONS} from '../penalty.mjs';
import {matchStats} from '../rules.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,String(a)+' != '+String(b));
const player=(TEC=75,PUI=75)=>({stats:{TEC,PUI}});
const keeper=(GAR=75)=>({stats:{GAR}});
const calc=(extra={})=>calculatePenalty({taker:player(),keeper:keeper(),shotDirection:'GAUCHE',keeperDirection:'GAUCHE',...extra});
test('Trois directions et même point de vue; centre/centre est une anticipation correcte',()=>{
 assert.deepEqual(PENALTY_DIRECTIONS,['GAUCHE','CENTRE','DROITE']);
 assert.equal(calc({shotDirection:'CENTRE',keeperDirection:'CENTRE'}).sameDirection,true);
 assert.equal(calc({shotDirection:'CENTRE',keeperDirection:'DROITE'}).sameDirection,false);
});
test('Barème officiel TEC/PUI/GAR 75 : bonne direction 30 / 60 / 10',()=>{
 const p=calc();
 near(p.goalProbability,30);near(p.saveProbability,60);near(p.missProbability,10);
 near(p.saveIfOnTarget,200/3);near(p.accuracy,90);
});
test('Barème officiel à 75 : mauvaise direction 88 / 2 / 10',()=>{
 const p=calc({keeperDirection:'DROITE'});
 near(p.goalProbability,88);near(p.saveProbability,2);near(p.missProbability,10);
 near(p.saveIfOnTarget,200/90);
});
test('Moyenne théorique à 75 : (30+88+88)/3 = 68,666… %',()=>{
 near(averagePenaltyGoal(player(),keeper()),(30+88+88)/3);
});
test('Toutes les neuf combinaisons de direction ont le bon barème',()=>{
 for(const a of PENALTY_DIRECTIONS)for(const d of PENALTY_DIRECTIONS){
  const p=calc({shotDirection:a,keeperDirection:d});
  near(p.goalProbability,a===d?30:88);
  near(p.saveProbability,a===d?60:2);
 }
});
test('TEC +10 réduit le raté de 4 points; GAR ne change jamais le cadrage',()=>{
 near(calc({taker:player(65,75)}).missProbability-calc({taker:player(75,75)}).missProbability,4);
 near(calc({keeper:keeper(50)}).missProbability,calc({keeper:keeper(100)}).missProbability);
});
test('Bonne direction : GAR +10 ajoute 5 points à arrêt conditionnel',()=>{
 near(calc({keeper:keeper(85)}).saveIfOnTarget-calc({keeper:keeper(75)}).saveIfOnTarget,5);
 near(calc({taker:player(75,85)}).saveIfOnTarget-calc({taker:player(75,75)}).saveIfOnTarget,-2);
});
test('Mauvaise direction : ni GAR ni PUI ne modifient arrêt conditionnel',()=>{
 const bad=(TEC,PUI,GAR)=>calc({taker:player(TEC,PUI),keeper:keeper(GAR),keeperDirection:'DROITE'});
 near(bad(75,0,0).saveIfOnTarget,bad(75,100,100).saveIfOnTarget);
 near(bad(75,0,0).goalProbability,bad(75,100,100).goalProbability);
});
test('Borne du tir raté 2–25 %, bonne direction arrêt cadré 20–85 %',()=>{
 near(calc({taker:player(100)}).missProbability,2);
 near(calc({taker:player(0)}).missProbability,25);
 near(calc({taker:player(75,100),keeper:keeper(0)}).saveIfOnTarget,200/3-.5*75-.2*25);
 near(calc({taker:player(75,0),keeper:keeper(100)}).saveIfOnTarget,85);
});
test('Un seul tirage final : raté, arrêt, but, sans rebond',()=>{
 const p=calc();
 assert.deepEqual(resolvePenalty(p,0),{outcome:'miss',onTarget:false,isGoal:false});
 assert.deepEqual(resolvePenalty(p,.4),{outcome:'save',onTarget:true,isGoal:false});
 assert.deepEqual(resolvePenalty(p,.99999),{outcome:'goal',onTarget:true,isGoal:true});
});
test('Toutes les probabilités extrêmes totalisent exactement 100 %',()=>{
 for(const tec of [0,25,75,100])for(const pui of [0,75,100])for(const gar of [0,75,100])
 for(const s of PENALTY_DIRECTIONS)for(const k of PENALTY_DIRECTIONS){
  const p=calc({taker:player(tec,pui),keeper:keeper(gar),shotDirection:s,keeperDirection:k});
  assert.ok([p.goalProbability,p.saveProbability,p.missProbability].every(x=>x>=0&&x<=100));
  near(p.goalProbability+p.saveProbability+p.missProbability,100);
 }
});
test('Rejet des directions, stats et tirages malformés',()=>{
 assert.throws(()=>calc({shotDirection:'BAS'}),/Direction/);
 assert.throws(()=>calc({keeperDirection:null}),/Direction/);
 assert.throws(()=>calc({taker:player(101,75)}),/Statistique/);
 assert.throws(()=>calc({keeper:keeper(NaN)}),/Statistique/);
 assert.throws(()=>resolvePenalty(null,.5),/Calcul/);
 assert.throws(()=>resolvePenalty(calc(),1),/Tirage/);
 assert.throws(()=>resolvePenalty(calc(),-.1),/Tirage/);
});
