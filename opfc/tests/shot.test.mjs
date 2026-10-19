import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateOpenShot,resolveOpenShot,SHOT_CHOICES,KEEPER_CHOICES,SHOT_CONTEXTS} from '../shot.mjs';
import {matchStats} from '../rules.mjs';
const luffy={stats:matchStats('luffy','ATT')};
const loki={stats:matchStats('loki','GAR')};
const baselineFinisher={stats:{TEC:75,PUI:75}};
const baselineKeeper={stats:{GAR:75}};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,String(a)+' != '+String(b));
const shot=(details={})=>calculateOpenShot({
  finisher:baselineFinisher,keeper:baselineKeeper,
  context:'BONNE',shot:'PLACEE',keeperReaction:'LIGNE',...details
});
test('Trois gestes, trois réactions et trois niveaux d’occasion v0.8',()=>{
 assert.deepEqual(SHOT_CHOICES,['PLACEE','PUISSANTE','PIQUEE']);
 assert.deepEqual(KEEPER_CHOICES,['LIGNE','SORTIE','PLONGEON']);
 assert.deepEqual(Object.keys(SHOT_CONTEXTS),['FRANCHE','BONNE','DIFFICILE']);
});
test('Exemple officiel : Luffy vs Loki, bonne occasion / puissante / plongeon',()=>{
 const result=shot({finisher:luffy,keeper:loki,shot:'PUISSANTE',keeperReaction:'PLONGEON'});
 near(result.accuracy,76+2/3);
 near(result.saveIfOnTarget,57.5);
 near(result.goalProbability,32.583333333333336);
 near(result.saveProbability,44.08333333333333);
 near(result.missProbability,23+1/3);
});
test('Matrice complète des 9 effets tactiques sur l’arrêt cadré',()=>{
 const shifts=[[0,8,-8],[-8,0,8],[8,-8,0]];
 SHOT_CHOICES.forEach((s,i)=>KEEPER_CHOICES.forEach((r,j)=>{
  assert.equal(shot({shot:s,keeperReaction:r}).tacticalAdjustment,shifts[i][j]);
 }));
});
test('Ajustements par geste +6/+5, -6/-5, -12/-10 sans bonus de tactique',()=>{
 for(const [s,a,b] of [['PLACEE',6,5],['PUISSANTE',-6,-5],['PIQUEE',-12,-10]]){
  const setting=shot({shot:s,keeperReaction:s==='PLACEE'?'LIGNE':s==='PUISSANTE'?'SORTIE':'PLONGEON'});
  near(setting.accuracy,200/3+a+8);
  near(setting.saveIfOnTarget,50+b);
 }
});
test('La TEC ajoute 4 points de cadrage pour +10, sans changer la GAR',()=>{
 const a=shot({finisher:{stats:{TEC:65,PUI:75}}});
 const b=shot({finisher:{stats:{TEC:75,PUI:75}}});
 near(b.accuracy-a.accuracy,4);
 near(a.saveIfOnTarget,b.saveIfOnTarget);
});
test('La GAR ne modifie JAMAIS le cadrage, mais +10 GAR ajoute +5 à l’arrêt cadré',()=>{
 const a=shot({keeper:{stats:{GAR:65}}});
 const b=shot({keeper:{stats:{GAR:75}}});
 near(a.accuracy,b.accuracy);
 near(b.saveIfOnTarget-a.saveIfOnTarget,5);
});
test('La puissance retire 2 points d’arrêt conditionnel par +10 PUI',()=>{
 const a=shot({finisher:{stats:{TEC:75,PUI:70}}});
 const b=shot({finisher:{stats:{TEC:75,PUI:80}}});
 near(a.accuracy,b.accuracy);
 near(a.saveIfOnTarget-b.saveIfOnTarget,2);
});
test('Le ballon piqué utilise TEC et non PUI pour la difficulté de l’arrêt',()=>{
 const a=shot({finisher:{stats:{TEC:80,PUI:0}},shot:'PIQUEE',keeperReaction:'PLONGEON'});
 const b=shot({finisher:{stats:{TEC:80,PUI:100}},shot:'PIQUEE',keeperReaction:'PLONGEON'});
 near(a.saveIfOnTarget,b.saveIfOnTarget);
 near(a.accuracy,b.accuracy);
 const c=shot({finisher:{stats:{TEC:90,PUI:0}},shot:'PIQUEE',keeperReaction:'PLONGEON'});
 near(a.saveIfOnTarget-c.saveIfOnTarget,2);
});
test('Contextes officiels et bonus +8, sans ajouter l’entente au tir',()=>{
 const cases=[['FRANCHE',85,3000/85],['BONNE',200/3,50],['DIFFICILE',45,3000/45]];
 for(const [context,accuracyBase,saveBase] of cases){
  const r=shot({context,shot:'PLACEE',keeperReaction:'LIGNE'});
  near(r.accuracy,Math.min(95,accuracyBase+6+8));
  near(r.saveIfOnTarget,saveBase+5);
 }
 // Références officielles AVANT bonus de geste/statistique/+8.
 near(85*(1-(3000/85)/100),55);
 near((200/3)*(1-0.5),100/3);
 near(45*(1-(3000/45)/100),15);
});
test('Bornes précision 5–95 et arrêt conditionnel 5–90 appliquées',()=>{
 const high=shot({context:'FRANCHE',shot:'PLACEE',finisher:{stats:{TEC:100,PUI:0}},keeper:{stats:{GAR:100}},keeperReaction:'SORTIE'});
 near(high.accuracy,95);near(high.saveIfOnTarget,3000/85+5+8+12.5+15);
 const lowSave=shot({context:'FRANCHE',shot:'PIQUEE',finisher:{stats:{TEC:100,PUI:100}},keeper:{stats:{GAR:0}},keeperReaction:'SORTIE'});
 near(lowSave.saveIfOnTarget,5);
 const highSave=shot({context:'DIFFICILE',shot:'PLACEE',finisher:{stats:{TEC:0,PUI:0}},keeper:{stats:{GAR:100}},keeperReaction:'SORTIE'});
 near(highSave.saveIfOnTarget,90);
 for(const r of [high,lowSave,highSave]){
  assert.ok(r.accuracy>=5&&r.accuracy<=95);
  assert.ok(r.saveIfOnTarget>=5&&r.saveIfOnTarget<=90);
 }
});
test('Les issues raté / arrêt / but restent exclusives et leur somme fait 100 %',()=>{
 const r=shot({finisher:luffy,keeper:loki,shot:'PUISSANTE',keeperReaction:'PLONGEON'});
 near(r.missProbability+r.saveProbability+r.goalProbability,100);
 const miss=resolveOpenShot(r,0);
 const save=resolveOpenShot(r,(r.missProbability+r.saveProbability/2)/100);
 const goal=resolveOpenShot(r,0.999999);
 assert.deepEqual(miss,{outcome:'miss',onTarget:false,isGoal:false});
 assert.deepEqual(save,{outcome:'save',onTarget:true,isGoal:false});
 assert.deepEqual(goal,{outcome:'goal',onTarget:true,isGoal:true});
});
test('Les extrêmes et toutes les combinaisons de choix restent à 100 %',()=>{
 for(const context of Object.keys(SHOT_CONTEXTS)){
  for(const s of SHOT_CHOICES)for(const reaction of KEEPER_CHOICES){
   for(const pair of [[0,100,0],[100,0,100],[75,75,75]]){
    const r=shot({context,shot:s,keeperReaction:reaction,
      finisher:{stats:{TEC:pair[0],PUI:pair[1]}},
      keeper:{stats:{GAR:pair[2]}}});
    near(r.goalProbability+r.saveProbability+r.missProbability,100);
    assert.ok(r.goalProbability>=0 && r.saveProbability>=0 && r.missProbability>=0);
   }
  }
 }
});
test('Rejette gestes, contextes, acteurs et tirages invalides',()=>{
 assert.throws(()=>shot({context:'PENALTY'}),/Contexte/);
 assert.throws(()=>shot({shot:'VOLEE'}),/Geste/);
 assert.throws(()=>shot({keeperReaction:'GAUCHE'}),/Réaction/);
 assert.throws(()=>shot({finisher:{stats:{TEC:101,PUI:75}}}),/Statistique/);
 assert.throws(()=>shot({keeper:{stats:{GAR:NaN}}}),/Statistique/);
 assert.throws(()=>shot({keeper:null}),/Statistique/);
 assert.throws(()=>resolveOpenShot(null,0.5),/Calcul/);
 assert.throws(()=>resolveOpenShot(shot(),1),/Tirage/);
 assert.throws(()=>resolveOpenShot(shot(),-.01),/Tirage/);
});
