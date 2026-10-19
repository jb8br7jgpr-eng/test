import test from 'node:test';
import assert from 'node:assert/strict';
import {matchStats} from '../rules.mjs';
import {
  CORNER_ZONES,CORNER_GESTURES,prepareCornerActors,
  calculateCornerDuel,resolveCornerDuel,calculateCornerFinish,resolveCornerFinish
} from '../corner.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,String(a)+' != '+String(b));
const player=(id,position)=>({cardId:id,stats:matchStats(id,position)});
const nami=player('nami','MIL'),luffy=player('luffy','ATT'),jinbe=player('jinbe','DEF');
const loki=player('loki','GAR');
const duel=(extra={})=>calculateCornerDuel({
  taker:nami,receiver:luffy,defender:jinbe,
  attackZone:'PREMIER',defenseZone:'PREMIER',...extra
});
const finish=(extra={})=>calculateCornerFinish({receiver:luffy,keeper:loki,gesture:'TETE',...extra});
const seeded=(...numbers)=>()=>{if(numbers.length===0)throw Error('Tirages épuisés');return numbers.shift();};
const teamA={formation:'2-2-2',slots:['chopper','jinbe','kaido','shanks','nami','luffy','zoro']};
const teamB={formation:'2-2-2',slots:['loki','mihawk','monkey-d-garp','katakuri','sabo','sanji','kizaru']};

test('Trois zones offensives/défensives et trois gestes officiels (§§26–27)',()=>{
 assert.deepEqual(CORNER_ZONES,['PREMIER','PENALTY','SECOND']);
 assert.deepEqual(CORNER_GESTURES,['TETE','VOLEE','RETOURNE']);
});
test('Exemple officiel Nami centre pour Luffy contre Jinbe : forces 92,85 / 90,25',()=>{
 const result=duel();
 near(result.attackStrength,92.85);
 near(result.defenseStrength,90.25);
 near(result.successProbability,51.6);
 near(duel({defenseZone:'SECOND'}).successProbability,69.6);
});
test('Les 3 x 3 combinaisons de zones : −12 si couverte, +6 sinon',()=>{
 for(const attackZone of CORNER_ZONES)for(const defenseZone of CORNER_ZONES){
  const r=duel({attackZone,defenseZone});
  assert.equal(r.tacticalAdjustment,attackZone===defenseZone?-12:6);
  near(r.successProbability,attackZone===defenseZone?51.6:69.6);
 }
});
test('Entente différentielle ±5 applicable au corner collectif et borne 15–85',()=>{
 near(duel({chemistryBonus:5}).successProbability,56.6);
 near(duel({chemistryBonus:-4}).successProbability,47.6);
 const low=calculateCornerDuel({taker:{stats:{PAS:0}},receiver:{stats:{PUI:0}},defender:{stats:{DEF:100,PUI:100}},
  attackZone:'PREMIER',defenseZone:'PREMIER',chemistryBonus:-5});
 const high=calculateCornerDuel({taker:{stats:{PAS:100}},receiver:{stats:{PUI:100}},defender:{stats:{DEF:0,PUI:0}},
  attackZone:'PREMIER',defenseZone:'SECOND',chemistryBonus:5});
 assert.equal(low.successProbability,15);
 assert.equal(high.successProbability,85);
});
test('Premier duel : un tirage, soit occasion soit corner arrêté, aucun but direct',()=>{
 const d=duel();
 assert.deepEqual(resolveCornerDuel(d,0),{outcome:'chance'});
 assert.deepEqual(resolveCornerDuel(d,0.515999),{outcome:'chance'});
 assert.deepEqual(resolveCornerDuel(d,0.516),{outcome:'stopped'});
 assert.deepEqual(resolveCornerDuel(d,.9999),{outcome:'stopped'});
});
test('Acteurs de corner sélectionnés AVANT la tactique : receveur non tireur ni GAR',()=>{
 const prepared=prepareCornerActors(teamA,teamB,'nami',seeded(.6,0));
 assert.equal(prepared.taker.cardId,'nami');
 assert.equal(prepared.receiver.cardId,'luffy');
 assert.equal(prepared.defender.cardId,'mihawk');
 assert.equal(prepared.receiver.position,'ATT');
 assert.equal(prepared.defender.position,'DEF');
 assert.ok(Object.isFrozen(prepared));
 assert.ok(Object.isFrozen(prepared.taker.stats));
 const d=calculateCornerDuel({...prepared,attackZone:'PREMIER',defenseZone:'SECOND'});
 near(d.attackStrength,92.85);
});
test('Finition de référence à 75 : tête/volée/retourné, +8 sur cadrage seulement',()=>{
 const target={stats:{PUI:75,TEC:75,VIT:75}};
 const keeper={stats:{GAR:75}};
 for(const [gesture,precision,save] of [
  ['TETE',80,52],['VOLEE',63,45],['RETOURNE',46,35]
 ]){
  const c=finish({receiver:target,keeper,gesture});
  near(c.force,75);near(c.accuracy,precision);near(c.saveIfOnTarget,save);
  near(c.goalProbability,precision*(100-save)/100);
  near(c.saveProbability,precision*save/100);
  near(c.missProbability,100-precision);
 }
});
test('Forces du geste : tête 70 PUI / 30 TEC, volée 65 TEC / 35 PUI, retourné 70 TEC / 30 VIT',()=>{
 const target={stats:{PUI:100,TEC:80,VIT:60}};
 near(finish({receiver:target,gesture:'TETE'}).force,94);
 near(finish({receiver:target,gesture:'VOLEE'}).force,87);
 near(finish({receiver:target,gesture:'RETOURNE'}).force,74);
});
test('Sensibilité précision au niveau de force : +3,5 / +5,5 / +9 pour +10',()=>{
 const keeper={stats:{GAR:75}};
 for(const [gesture,slope] of [['TETE',3.5],['VOLEE',5.5],['RETOURNE',9]]){
  const lower=finish({gesture,keeper,receiver:{stats:{TEC:70,PUI:70,VIT:70}}});
  const upper=finish({gesture,keeper,receiver:{stats:{TEC:80,PUI:80,VIT:80}}});
  near(upper.accuracy-lower.accuracy,slope);
  near(lower.saveIfOnTarget-upper.saveIfOnTarget,2);
 }
});
test('Gardien +10 GAR = +5 arrêt sur cadré mais aucune modification du cadrage',()=>{
 const low=finish({keeper:{stats:{GAR:70}}});
 const high=finish({keeper:{stats:{GAR:80}}});
 near(low.accuracy,high.accuracy);
 near(high.saveIfOnTarget-low.saveIfOnTarget,5);
});
test('Bornes 5–95 cadrage et 5–90 arrêt, toutes probabilités non négatives',()=>{
 for(const gesture of CORNER_GESTURES)for(const force of [0,50,75,100])for(const gar of [0,75,100]){
  const c=finish({gesture,receiver:{stats:{TEC:force,PUI:force,VIT:force}},keeper:{stats:{GAR:gar}}});
  assert.ok(c.accuracy>=5&&c.accuracy<=95);
  assert.ok(c.saveIfOnTarget>=5&&c.saveIfOnTarget<=90);
  assert.ok(c.goalProbability>=0&&c.saveProbability>=0&&c.missProbability>=0);
  near(c.goalProbability+c.saveProbability+c.missProbability,100);
 }
 near(finish({gesture:'RETOURNE',receiver:{stats:{TEC:0,VIT:0}},keeper:{stats:{GAR:0}}}).accuracy,5);
});
test('Tirage final unique : raté / arrêt / but, aucune réaction de gardien à choisir',()=>{
 const c=finish();
 assert.deepEqual(resolveCornerFinish(c,0),{outcome:'miss',onTarget:false,isGoal:false});
 assert.deepEqual(resolveCornerFinish(c,(c.missProbability+c.saveProbability/2)/100),
  {outcome:'save',onTarget:true,isGoal:false});
 assert.deepEqual(resolveCornerFinish(c,.999999),
  {outcome:'goal',onTarget:true,isGoal:true});
 assert.equal(Object.hasOwn(c,'keeperReaction'),false);
});
test('Rejet explicite des saisies et états invalides',()=>{
 assert.throws(()=>duel({attackZone:'COTE'}),/Zone/);
 assert.throws(()=>duel({defenseZone:null}),/Zone/);
 assert.throws(()=>duel({chemistryBonus:6}),/entente/);
 assert.throws(()=>duel({taker:{stats:{PAS:101}}}),/Statistique/);
 assert.throws(()=>duel({receiver:{cardId:'nami',stats:{PUI:70}}}),/identique/);
 assert.throws(()=>finish({gesture:'CISÉLÉ'}),/Geste/);
 assert.throws(()=>finish({keeper:{stats:{GAR:NaN}}}),/Statistique/);
 assert.throws(()=>finish({receiver:{stats:{PUI:-1,TEC:80}}}),/Statistique/);
 assert.throws(()=>resolveCornerDuel({},.5),/Calcul/);
 assert.throws(()=>resolveCornerDuel(duel(),-1),/Tirage/);
 assert.throws(()=>resolveCornerFinish(null,.5),/Finition/);
 assert.throws(()=>resolveCornerFinish(finish(),1),/Tirage/);
 assert.throws(()=>prepareCornerActors(teamA,teamB,'inconnu',()=>0),/absent/);
 assert.throws(()=>prepareCornerActors(teamA,teamB,'nami',()=>1),/Tirage/);
});
