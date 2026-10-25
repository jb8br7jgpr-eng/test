/** Validation du rééquilibrage OPFC, branchée sur les vrais modules de jeu. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CARDS} from '../opfc/catalog.mjs';
import {attackingProbability,buildSchedule} from '../opfc/rules.mjs';
import {calculateOpenPlay,drawOpenPlayContext} from '../opfc/open-play.mjs';
import {calculateOpenShot} from '../opfc/shot.mjs';
import {calculateCornerDuel,calculateCornerFinish} from '../opfc/corner.mjs';
import {calculateFreeKickDuel,calculateFreeKickFinish} from '../opfc/free-kick.mjs';
import {calculatePenalty,averagePenaltyGoal} from '../opfc/penalty.mjs';

const close=(actual,expected,tolerance=.26)=>assert.ok(Math.abs(actual-expected)<=tolerance,
  'Attendu ≈ '+expected.toFixed(3)+' %, obtenu '+actual.toFixed(3)+' %');
const stats=Object.freeze(Object.fromEntries(['PUI','TEC','PAS','VIT','DEF','GAR'].map(key=>[key,75])));
const actor=id=>({cardId:id,stats});
const taker=actor('a'),receiver=actor('b'),defender=actor('c'),keeper=actor('g');

test('La répartition des contextes reste strictement 25 / 50 / 25',()=>{
 assert.equal(drawOpenPlayContext(()=>0),'FRANCHE');
 assert.equal(drawOpenPlayContext(()=>.2499999),'FRANCHE');
 assert.equal(drawOpenPlayContext(()=>.25),'BONNE');
 assert.equal(drawOpenPlayContext(()=>.7499999),'BONNE');
 assert.equal(drawOpenPlayContext(()=>.75),'DIFFICILE');
});

test('Duels ouverts : bonus fixe +5 ; désavantage / neutre / avantage à 47 / 55 / 63',()=>{
 const counter=[
  ['COMBINER','CONTENIR',47],['COMBINER','INTERCEPTER',55],['COMBINER','PRESSER',63],
  ['LANCER','INTERCEPTER',47],['LANCER','PRESSER',55],['LANCER','CONTENIR',63],
  ['PERCER','PRESSER',47],['PERCER','CONTENIR',55],['PERCER','INTERCEPTER',63]
 ];
 for(const [attack,defense,expected] of counter){
  const result=calculateOpenPlay({carrier:taker,partner:receiver,defender,attack,defense});
  assert.equal(result.successConditional,expected,attack+'/'+defense);
  assert.ok(result.successProbability<result.successConditional,'Fautes restent distinctes');
 }
});

test('Finitions du jeu ouvert : objectifs moyens ≈63 / 40 / 20 et gardien toujours déterminant',()=>{
 // Cible exacte de la nouvelle grille : (19+22+18)/3 pour difficile.
 const contexts={FRANCHE:63,BONNE:40,DIFFICILE:59/3};
 for(const [context,want] of Object.entries(contexts)){
  const all=[];
  for(const shot of ['PLACEE','PUISSANTE','PIQUEE'])
   for(const keeperReaction of ['LIGNE','SORTIE','PLONGEON']){
    const r=calculateOpenShot({finisher:taker,keeper,context,shot,keeperReaction});
    all.push(r.goalProbability);
    close(r.missProbability+r.saveProbability+r.goalProbability,100,.00001);
   }
  close(all.reduce((a,b)=>a+b,0)/all.length,want,.3);
  const good=calculateOpenShot({finisher:taker,keeper:{stats:{...stats,GAR:95}},context,shot:'PLACEE',keeperReaction:'LIGNE'});
  const poor=calculateOpenShot({finisher:taker,keeper:{stats:{...stats,GAR:55}},context,shot:'PLACEE',keeperReaction:'LIGNE'});
  assert.ok(good.goalProbability<poor.goalProbability,'GAR doit rester influent : '+context);
 }
});

test('Corners : bien anticipé 42 %, mal anticipé 80 % et buts 33 / 30 / 27 %',()=>{
 const argumentsBase={taker,receiver,defender,attackZone:'PREMIER'};
 const right=calculateCornerDuel({...argumentsBase,defenseZone:'PREMIER'});
 const wrong=calculateCornerDuel({...argumentsBase,defenseZone:'SECOND'});
 assert.equal(right.successProbability,42);
 assert.equal(wrong.successProbability,80);
 const avgDuel=(right.successProbability+2*wrong.successProbability)/3;
 for(const [gesture,goal] of [['TETE',33],['VOLEE',30],['RETOURNE',27]]){
  const f=calculateCornerFinish({receiver,keeper,gesture});
  close(avgDuel*f.goalProbability/100,goal,.35);
 }
});

test('Coups francs : bien défendu 41 %, mal défendu 77 %, buts 27 / 29 / 28 %',()=>{
 const counter={DIRECT:'MUR',CENTRE:'MARQUAGE',COMBINAISON:'ANTICIPER'};
 for(const [attack,want] of [['DIRECT',27],['CENTRE',29],['COMBINAISON',28]]){
  const a={taker,receiver,defender,attack};
  const right=calculateFreeKickDuel({...a,defense:counter[attack]});
  const wrong=calculateFreeKickDuel({...a,defense:counter[attack]==='MUR'?'MARQUAGE':'MUR'});
  assert.equal(right.successProbability,41);
  assert.equal(wrong.successProbability,77);
  const finish=calculateFreeKickFinish({taker,receiver,keeper,attack});
  close((right.successProbability+2*wrong.successProbability)/3*finish.goalProbability/100,want,.38);
 }
});

test('Penalty et TAB : 20 % gardien bien placé, 88 % sinon, moyenne ≈65,3 %',()=>{
 const same=calculatePenalty({taker,keeper,shotDirection:'GAUCHE',keeperDirection:'GAUCHE'});
 const different=calculatePenalty({taker,keeper,shotDirection:'GAUCHE',keeperDirection:'DROITE'});
 close(same.goalProbability,20,.00001);
 close(different.goalProbability,88,.00001);
 close(averagePenaltyGoal(taker,keeper),65.3333333333,.00001);
 const weakGK=calculatePenalty({taker,keeper:{stats:{...stats,GAR:50}},shotDirection:'GAUCHE',keeperDirection:'GAUCHE'});
 const strongGK=calculatePenalty({taker,keeper:{stats:{...stats,GAR:95}},shotDirection:'GAUCHE',keeperDirection:'GAUCHE'});
 assert.ok(strongGK.goalProbability<weakGK.goalProbability);
});

const positions=['GAR','DEF','DEF','MIL','MIL','ATT','ATT'];
const groupTeam=(strong,exclude=new Set())=>{
 const slots=positions.map(pos=>{
  const available=CARDS.filter(c=>c.position===pos&&!exclude.has(c.id))
   .sort((a,b)=>strong?b.rating-a.rating:a.rating-b.rating);
  assert.ok(available.length);
  exclude.add(available[0].id);
  return available[0].id;
 });
 return {club:strong?'PSG':'OM',formation:'2-2-2',slots,roster:[...slots]};
};
const seedRng=(seed)=>{
 let s=seed>>>0;
 return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};
};

test('Calendrier 10–12 : écart <=2, deux mi-temps couvertes, force collective conservée',()=>{
 const taken=new Set(),strong=groupTeam(true,taken),weak=groupTeam(false,taken);
 assert.ok(attackingProbability(strong,weak)>50);
 const p=attackingProbability(strong,weak);
 let strongMoments=0, total=0;
 const rng=seedRng(512345);
 for(let i=0;i<2500;i++){
  const schedule=buildSchedule(strong,weak,rng);
  assert.ok(schedule.length>=10&&schedule.length<=12);
  const a=schedule.filter(e=>e.attacker==='PSG').length;
  const b=schedule.filter(e=>e.attacker==='OM').length;
  assert.ok(Math.abs(a-b)<=2,'Séquences trop déséquilibrées : '+a+' – '+b);
  for(const club of ['PSG','OM'])
   for(const period of [1,2])
    assert.ok(schedule.some(e=>e.attacker===club&&e.period===period),'Club / mi-temps manquant');
  strongMoments+=a;
  total+=schedule.length;
 }
 assert.ok(strongMoments/total>.51,
  'La force collective doit rester influente malgré le plafond, attaque brute '+p);
});

test('Les six calculateurs et le calendrier sont identiques pour local et serveur',()=>{
 for(const file of ['rules.mjs','open-play.mjs','shot.mjs','corner.mjs','free-kick.mjs','penalty.mjs',
  'match.mjs','engine.mjs','shootout.mjs','match-actions.mjs','set-piece-actions.mjs']){
  const local=readFileSync(new URL('../opfc/'+file,import.meta.url),'utf8');
  const server=readFileSync(new URL('../supabase/functions/opfc-online/opfc/'+file,import.meta.url),'utf8');
  const withoutBrowserCache=s=>s.replace(/\?v=[\w-]+/g,'');
  assert.equal(withoutBrowserCache(local),server,'Écart local / serveur dans '+file);
 }
 assert.equal(CARDS.length,75,'Le catalogue de 75 personnages reste complet');
});


test('Le chargement iPhone utilise explicitement les modules rééquilibrés',()=>{
 const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
 const version='opfc-match-balance-20261025';
 for(const [file,dependency] of [
  ['opfc.html','./opfc/ui.mjs'],
  ['opfc/ui.mjs','./ui-match.mjs'],
  ['opfc/ui.mjs','./engine.mjs'],
  ['opfc/ui-match.mjs','./match.mjs'],
  ['opfc/ui-match.mjs','./match-actions.mjs'],
  ['opfc/ui-match.mjs','./ui-set-piece.mjs'],
  ['opfc/ui-match.mjs','./ui-shootout.mjs'],
  ['opfc/ui-set-piece.mjs','./set-piece-actions.mjs'],
  ['opfc/ui-shootout.mjs','./shootout.mjs'],
  ['opfc/match-actions.mjs','./open-play.mjs'],
  ['opfc/match-actions.mjs','./shot.mjs'],
  ['opfc/set-piece-actions.mjs','./corner.mjs'],
  ['opfc/set-piece-actions.mjs','./free-kick.mjs'],
  ['opfc/set-piece-actions.mjs','./penalty.mjs'],
  ['opfc/shootout.mjs','./penalty.mjs']
 ]){
  assert.ok(read(file).includes(dependency+'?v='+version),
   'Cache de '+dependency+' pas invalidé dans '+file);
 }
});
