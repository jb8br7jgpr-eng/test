import test from 'node:test';
import assert from 'node:assert/strict';
import {ATTACK_CHOICES,DEFENSE_CHOICES,CONTEXTS,drawOpenPlayContext,calculateOpenPlay,resolveOpenPlay} from '../open-play.mjs';
const carrier={stats:{PAS:67,TEC:73,VIT:100}}; // Kizaru au poste ATT (PDF §20)
const partner={stats:{PAS:90,VIT:82}};
const defender={stats:{DEF:91,VIT:60}}; // Jinbe au poste DEF (PDF §20)
const calc=(attack='PERCER',defense='CONTENIR',extra={})=>calculateOpenPlay({carrier,partner,defender,attack,defense,...extra});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,String(a)+' ≠ '+String(b));
test('Trois tactiques par camp et la grille 25 / 50 / 25',()=>{
 assert.deepEqual(ATTACK_CHOICES,['COMBINER','LANCER','PERCER']);
 assert.deepEqual(DEFENSE_CHOICES,['PRESSER','INTERCEPTER','CONTENIR']);
 assert.deepEqual(Object.values(CONTEXTS).map(c=>c.weight),[.25,.5,.25]);
 assert.deepEqual([0,.249999,.25,.749999,.75,.99999].map(n=>drawOpenPlayContext(()=>n)),['FRANCHE','FRANCHE','BONNE','BONNE','DIFFICILE','DIFFICILE']);
});
test('Exemple officiel : Kizaru perce Jinbe qui contient => 60,5 % sans faute',()=>{
 const v=calc();near(v.attackStrength,89.2);near(v.defenseStrength,81.7);
 assert.equal(v.tacticalAdvantage,-8);near(v.successConditional,60.5);
});
test('Six forces de duel reproduisent §20',()=>{
 near(calc('COMBINER','PRESSER').attackStrength,0.6*((67+90)/2)+0.4*73);
 near(calc('LANCER','INTERCEPTER').attackStrength,.65*67+.35*82);
 near(calc('PERCER','CONTENIR').attackStrength,.6*100+.4*73);
 near(calc('COMBINER','PRESSER').defenseStrength,.6*91+.4*60);
 near(calc('COMBINER','INTERCEPTER').defenseStrength,.75*91+.25*60);
 near(calc('COMBINER','CONTENIR').defenseStrength,.7*91+.3*60);
});
test('Neuf correspondances de la matrice : bonus attaque, défense ou neutre',()=>{
 const expected=[[-8,0,8],[8,-8,0],[0,8,-8]];
 ATTACK_CHOICES.forEach((a,i)=>DEFENSE_CHOICES.forEach((d,j)=>assert.equal(calc(a,d).tacticalAdvantage,expected[i][j])));
});
test('Bonus collectif appliqué aux combinaisons/passes, pas aux percées',()=>{
 near(calc('COMBINER','CONTENIR',{chemistryBonus:5}).successConditional-calc('COMBINER','CONTENIR').successConditional,5);
 near(calc('LANCER','CONTENIR',{chemistryBonus:-4}).successConditional-calc('LANCER','CONTENIR').successConditional,-4);
 near(calc('PERCER','CONTENIR',{chemistryBonus:5}).successConditional,60.5);
 assert.equal(calc('PERCER','CONTENIR',{chemistryBonus:5}).chemistryBonus,0);
});
test('Bornes 15–85 % et correction tactique +11 incluses',()=>{
 const elite={stats:{PAS:100,TEC:100,VIT:100}};
 const weak={stats:{DEF:0,VIT:0}};
 const max=calculateOpenPlay({carrier:elite,partner:elite,defender:weak,attack:'PERCER',defense:'PRESSER'});
 const min=calculateOpenPlay({carrier:{stats:{PAS:0,TEC:0,VIT:0}},defender:{stats:{DEF:100,VIT:100}},attack:'PERCER',defense:'PRESSER'});
 assert.equal(max.successConditional,85);assert.equal(min.successConditional,15);
});
test('Fautes au DEF 75 : presser 8 %, intercepter 3 %, contenir 1 %',()=>{
 const d={stats:{DEF:75,VIT:50}};
 for(const [defense,p] of [['PRESSER',8],['INTERCEPTER',3],['CONTENIR',1]])near(calculateOpenPlay({carrier,partner,defender:d,attack:'LANCER',defense}).foulProbability,p);
});
test('DEF plus faible -> plus de fautes ; un seul tirage avec issues exclusives',()=>{
 const p=calc('PERCER','PRESSER');near(p.foulProbability,8*(1+(75-91)/100));
 near(p.foulProbability+p.successProbability+p.stoppedProbability,100);
 const f=resolveOpenPlay(p,'FRANCHE',0);assert.deepEqual(f,{outcome:'foul',setPiece:'penalty',context:'FRANCHE'});
 const fk=resolveOpenPlay(p,'BONNE',0);assert.deepEqual(fk,{outcome:'foul',setPiece:'free-kick',context:'BONNE'});
 assert.deepEqual(resolveOpenPlay(p,'DIFFICILE',(p.foulProbability+0.01)/100),{outcome:'chance',context:'DIFFICILE'});
 assert.deepEqual(resolveOpenPlay(p,'FRANCHE',.999),{outcome:'stopped',context:'FRANCHE'});
});
test('Une seule chance après une construction réussie, sans tir immédiat',()=>{
 const r=resolveOpenPlay(calc(),'BONNE',0.5);
 assert.equal(r.outcome,'chance');assert.ok(!Object.hasOwn(r,'goal'));
});
test('Rejet de choix, entente et tirages invalides',()=>{
 assert.throws(()=>calc('INCONNU','PRESSER'),/Tactique/);
 assert.throws(()=>calc('PERCER','AUTRE'),/Tactique/);
 assert.throws(()=>calc('COMBINER','PRESSER',{partner:null}),/Statistique/);
 assert.throws(()=>calc('PERCER','CONTENIR',{chemistryBonus:7}),/entente/);
 assert.throws(()=>drawOpenPlayContext(()=>1),/Tirage/);
 assert.throws(()=>resolveOpenPlay(calc(),'AUTRE',0),/Contexte/);
 assert.throws(()=>resolveOpenPlay(calc(),'BONNE',-0.01),/Tirage/);
});
