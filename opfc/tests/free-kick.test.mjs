import test from 'node:test';
import assert from 'node:assert/strict';
import {matchStats} from '../rules.mjs';
import {
 FREE_KICK_ATTACKS,FREE_KICK_DEFENSES,prepareFreeKickActors,freeKickFinisherId,
 calculateFreeKickDuel,resolveFreeKickDuel,calculateFreeKickFinish,resolveFreeKickFinish
} from '../free-kick.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,String(a)+' ≠ '+String(b));
const athlete=(id,position)=>({cardId:id,stats:matchStats(id,position)});
const nami=athlete('nami','MIL'),luffy=athlete('luffy','ATT'),jinbe=athlete('jinbe','DEF');
const loki=athlete('loki','GAR');
const a={formation:'2-2-2',slots:['chopper','jinbe','kaido','shanks','nami','luffy','zoro']};
const b={formation:'2-2-2',slots:['loki','mihawk','monkey-d-garp','katakuri','sabo','sanji','kizaru']};
const draw=(...values)=>()=>{if(!values.length)throw Error('Tirage supplémentaire');return values.shift();};
const duel=(patch={})=>calculateFreeKickDuel({taker:nami,receiver:luffy,defender:jinbe,attack:'CENTRE',defense:'MARQUAGE',...patch});
const finish=(patch={})=>calculateFreeKickFinish({taker:nami,receiver:luffy,keeper:loki,attack:'CENTRE',...patch});
const ref=(id)=>({cardId:id,stats:{TEC:75,PUI:75,PAS:75,VIT:75,DEF:75,GAR:75}});
test('Trois stratégies offensives et trois défensives du dossier §28',()=>{
 assert.deepEqual(FREE_KICK_ATTACKS,['DIRECT','CENTRE','COMBINAISON']);
 assert.deepEqual(FREE_KICK_DEFENSES,['MUR','MARQUAGE','ANTICIPER']);
});
test('Choix anticipé du tireur (gardien inclus), réceptionneur distinct et défenseur pondéré',()=>{
 const x=prepareFreeKickActors(a,b,'nami',draw(.6,0));
 assert.equal(x.taker.cardId,'nami');
 assert.equal(x.receiver.cardId,'luffy');
 assert.equal(x.defender.cardId,'mihawk');
 assert.ok(Object.isFrozen(x)&&Object.isFrozen(x.receiver.stats));
 const y=prepareFreeKickActors(a,b,'chopper',draw(0,0));
 assert.equal(y.taker.cardId,'chopper');
 assert.notEqual(y.receiver.cardId,'chopper');
 assert.equal(y.defender.cardId,'mihawk');
});
test('Tireur direct conservé ; centre et combinaison attribués au même finisseur annoncé',()=>{
 const actors=prepareFreeKickActors(a,b,'nami',draw(.6,0));
 assert.equal(freeKickFinisherId(actors,'DIRECT'),'nami');
 assert.equal(freeKickFinisherId(actors,'CENTRE'),'luffy');
 assert.equal(freeKickFinisherId(actors,'COMBINAISON'),'luffy');
});
test('Force offensive exacte des trois options et distinction du porteur',()=>{
 near(duel({attack:'DIRECT'}).attackStrength,.6*80+.4*30);
 near(duel({attack:'CENTRE'}).attackStrength,.7*89+.3*100);
 near(duel({attack:'COMBINAISON'}).attackStrength,.6*((89+77)/2)+.4*80);
});
test('Deux calculs de défense : mur/marquage PUI, anticipation VIT',()=>{
 near(duel({defense:'MUR'}).defenseStrength,.7*91+.3*88);
 near(duel({defense:'MARQUAGE'}).defenseStrength,.7*91+.3*88);
 near(duel({defense:'ANTICIPER'}).defenseStrength,.7*91+.3*60);
});
test('Neuf confrontations : la bonne anticipation coûte −12 contre +6 sinon',()=>{
 for(const attack of FREE_KICK_ATTACKS)for(const defense of FREE_KICK_DEFENSES){
  const c=duel({attack,defense});
  const matching=attack==='DIRECT'?'MUR':attack==='CENTRE'?'MARQUAGE':'ANTICIPER';
  assert.equal(c.tacticalAdjustment,defense===matching?-12:6);
  near(c.successProbability,Math.min(85,Math.max(15,50+c.attackStrength-c.defenseStrength+c.tacticalAdjustment+11)));
 }
});
test('Centre Nami vers Luffy face à Jinbe : duel 51,2 % si marquage, 69,2 % si mur',()=>{
 near(duel().attackStrength,92.3);
 near(duel().defenseStrength,90.1);
 near(duel().successProbability,51.2);
 near(duel({defense:'MUR'}).successProbability,69.2);
});
test('Entente pour centre / combinaison uniquement, pas le tir direct',()=>{
 near(duel({chemistryBonus:5}).successProbability-duel().successProbability,5);
 near(duel({attack:'COMBINAISON',chemistryBonus:-4}).successProbability-
      duel({attack:'COMBINAISON'}).successProbability,-4);
 near(duel({attack:'DIRECT',chemistryBonus:5}).successProbability,
      duel({attack:'DIRECT'}).successProbability);
 assert.equal(duel({attack:'DIRECT',chemistryBonus:5}).chemistryBonus,0);
});
test('Duels bornés à 15–85 et +11 appliqué avant le plafonnement',()=>{
 const weak=ref('weak'),strong=ref('strong');
 for(const key of Object.keys(weak.stats))weak.stats[key]=0;
 for(const key of Object.keys(strong.stats))strong.stats[key]=100;
 assert.equal(duel({taker:weak,receiver:ref('otherweak'),defender:strong,attack:'DIRECT',defense:'MUR'}).successProbability,15);
 assert.equal(duel({taker:strong,receiver:ref('otherstrong'),defender:weak,attack:'DIRECT',defense:'MARQUAGE'}).successProbability,85);
 const m=ref('m');
 near(duel({taker:m,receiver:ref('otherm'),defender:m,attack:'CENTRE',defense:'MARQUAGE'}).successProbability,49);
 near(duel({taker:m,receiver:ref('otherm'),defender:m,attack:'CENTRE',defense:'MUR'}).successProbability,67);
});
test('Un duel produit occasion OU interception : pas de deuxième qualité ni faute',()=>{
 const c=duel();
 assert.deepEqual(resolveFreeKickDuel(c,0),{outcome:'chance'});
 assert.deepEqual(resolveFreeKickDuel(c,.511999),{outcome:'chance'});
 assert.deepEqual(resolveFreeKickDuel(c,.512),{outcome:'stopped'});
 assert.equal(Object.hasOwn(c,'foulProbability'),false);
});
test('Références officielles à 75 avant +8 : 30/30/40, 32,5/32,5/35, 31,5/38,5/30',()=>{
 const t=ref('t'),receiver=ref('r'),keeper=ref('g');
 for(const [attack,frame,save] of [['DIRECT',60,50],['CENTRE',65,50],['COMBINAISON',70,55]]){
  const c=finish({taker:t,receiver,keeper,attack});
  near(c.accuracy,frame+8);near(c.saveIfOnTarget,save);
  near(c.goalProbability,(frame+8)*(100-save)/100);
  near(c.saveProbability,(frame+8)*save/100);
  near(c.missProbability,100-(frame+8));
 }
 // Dossier v0.8 : valeurs des tableaux sans le bonus +8 de précision conservé.
 near(60*(1-0.50),30);near(65*(1-0.50),32.5);near(70*(1-.55),31.5);
});
test('La finition directe utilise le tireur ; centre/combinaison le réceptionneur',()=>{
 const d=finish({attack:'DIRECT'});
 const c=finish({attack:'CENTRE'});
 const combination=finish({attack:'COMBINAISON'});
 assert.equal(d.finisherId,'nami');
 assert.equal(c.finisherId,'luffy');
 assert.equal(combination.finisherId,'luffy');
 near(d.accuracy,60+.4*(80-75)+8);
 near(c.accuracy,65+.4*(95-75)+8);
 near(combination.accuracy,70+.4*(95-75)+8);
});
test('TEC influe seulement sur la précision, GAR uniquement sur arrêt si cadré',()=>{
 const t=ref('t'),r=ref('r'),g=ref('g');
 const low=finish({taker:t,receiver:r,keeper:g});
 const improved=finish({taker:t,receiver:{...r,stats:{...r.stats,TEC:85}},keeper:g});
 near(improved.accuracy-low.accuracy,4);
 near(improved.saveIfOnTarget,low.saveIfOnTarget);
 const greatKeeper=finish({taker:t,receiver:r,keeper:{...g,stats:{...g.stats,GAR:85}}});
 near(greatKeeper.accuracy,low.accuracy);
 near(greatKeeper.saveIfOnTarget-low.saveIfOnTarget,5);
});
test('PUI +10 baisse les arrêts si cadré de 2 points',()=>{
 const low=finish({receiver:{...luffy,stats:{...luffy.stats,PUI:80}}});
 const high=finish({receiver:{...luffy,stats:{...luffy.stats,PUI:90}}});
 near(low.accuracy,high.accuracy);
 near(low.saveIfOnTarget-high.saveIfOnTarget,2);
});
test('Tirage final exclusif : raté, arrêt, but sans choix supplémentaire',()=>{
 const c=finish();
 const miss=resolveFreeKickFinish(c,0);
 const saved=resolveFreeKickFinish(c,(c.missProbability+c.saveProbability/2)/100);
 const goal=resolveFreeKickFinish(c,.99999);
 assert.deepEqual(miss,{outcome:'miss',onTarget:false,isGoal:false});
 assert.deepEqual(saved,{outcome:'save',onTarget:true,isGoal:false});
 assert.deepEqual(goal,{outcome:'goal',onTarget:true,isGoal:true});
 assert.equal(Object.hasOwn(c,'keeperReaction'),false);
});
test('Tous les cas extrêmes totalisent 100 % et respectent les bornes',()=>{
 for(const attack of FREE_KICK_ATTACKS)for(const rating of [0,25,75,100])
 for(const gar of [0,75,100]){
  const x=ref('t'),y=ref('r'),keeper=ref('g');
  x.stats.TEC=x.stats.PUI=rating;
  y.stats.TEC=y.stats.PUI=rating;
  keeper.stats.GAR=gar;
  const r=finish({taker:x,receiver:y,keeper,attack});
  assert.ok(r.accuracy>=5&&r.accuracy<=95);
  assert.ok(r.saveIfOnTarget>=5&&r.saveIfOnTarget<=90);
  assert.ok(r.goalProbability>=0&&r.saveProbability>=0&&r.missProbability>=0);
  near(r.goalProbability+r.saveProbability+r.missProbability,100);
 }
});
test('Rejets : stratégies, états incomplets, entente et tirages invalides',()=>{
 assert.throws(()=>duel({attack:'PIQUE'}),/Stratégie/);
 assert.throws(()=>duel({defense:'SORTIE'}),/Réponse/);
 assert.throws(()=>duel({chemistryBonus:6}),/entente/);
 assert.throws(()=>duel({receiver:{...nami}}),/identique/);
 assert.throws(()=>duel({defender:null}),/Statistique/);
 assert.throws(()=>duel({taker:{stats:{PAS:80,TEC:NaN,PUI:75}}}),/Statistique/);
 assert.throws(()=>finish({attack:'VOLEE'}),/Stratégie/);
 assert.throws(()=>finish({keeper:{stats:{GAR:101}}}),/Statistique/);
 assert.throws(()=>resolveFreeKickDuel(null,.5),/Calcul/);
 assert.throws(()=>resolveFreeKickDuel(duel(),1),/Tirage/);
 assert.throws(()=>resolveFreeKickFinish(null,.5),/Finition/);
 assert.throws(()=>resolveFreeKickFinish(finish(),-1),/Tirage/);
 assert.throws(()=>prepareFreeKickActors(a,b,'intrus',()=>0),/absent/);
 assert.throws(()=>prepareFreeKickActors(a,b,'nami',()=>1),/Tirage/);
 assert.throws(()=>freeKickFinisherId(null,'DIRECT'),/absent/);
});
