/** Tests du laboratoire — pure mémoire, aucun réseau ou état OPFC persistant. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {CARDS} from '../catalog.mjs';
import {PENALTY_DIRECTIONS} from '../penalty.mjs';
import {renderFinalResult} from '../ui-final.mjs';
import {
 defaultLineups,validateLineups,createLabSession,labTurn,
 prepareLabKick,commitLabKick,trajectoryFor
} from '../penalty-lab-core.mjs';

test('Deux compositions automatiques de 7 personnages, sans doublons, aux postes officiels',()=>{
 const teams=defaultLineups();
 assert.ok(validateLineups(teams));
 assert.equal(new Set([...teams.PSG,...teams.OM]).size,14);
 assert.equal(CARDS.length,75);
});
test('Un personnage remplacé doit correspondre au poste et ne pas être déjà titulaire',()=>{
 const teams=defaultLineups();
 const same=structuredClone(teams);
 same.OM[0]=same.PSG[0];
 assert.throws(()=>validateLineups(same),/doublon/);
 const wrong=structuredClone(teams);
 wrong.PSG[0]=wrong.PSG[5];
 assert.throws(()=>validateLineups(wrong),/Poste invalide/);
});
test('Les 9 combinaisons gauche/centre/droite sont prises en charge',()=>{
 const original=createLabSession();
 for(const shotDirection of PENALTY_DIRECTIONS)for(const keeperDirection of PENALTY_DIRECTIONS){
  const {attempt}=prepareLabKick(original,{shotDirection,keeperDirection,rng:()=>0.99});
  const coord=trajectoryFor({shotDirection,keeperDirection,outcome:attempt.outcome});
  assert.ok(coord.keeperX>=30&&coord.keeperX<=70);
  assert.equal(original.type,'penalty');
 }
});
test('Moteur officiel : but, arrêt et raté forcés uniquement avec un tirage de test',()=>{
 const session=createLabSession();
 for(const mode of ['goal','save','miss']){
  const prepared=prepareLabKick(session,{shotDirection:'GAUCHE',keeperDirection:'GAUCHE',mode});
  assert.equal(prepared.attempt.outcome,mode);
  assert.strictEqual(commitLabKick(session,prepared),session);
 }
});
test('Le gardien bouge dans le bon sens et un but contourne son portrait',()=>{
 const a=trajectoryFor({shotDirection:'DROITE',keeperDirection:'GAUCHE',outcome:'goal'});
 assert.equal(a.keeperX,30);
 assert.equal(a.ballX,70);
 const b=trajectoryFor({shotDirection:'DROITE',keeperDirection:'DROITE',outcome:'goal'});
 assert.notEqual(b.ballX,b.keeperX);
 const c=trajectoryFor({shotDirection:'CENTRE',keeperDirection:'CENTRE',outcome:'save'});
 assert.equal(c.ballX,c.keeperX);
});
test('TAB : tentative préparée sans changement du score ; seul Continuer la valide',()=>{
 const session=createLabSession({type:'shootout'});
 const turn=labTurn(session);
 assert.equal(turn.club,'PSG');
 const kick=prepareLabKick(session,{shotDirection:'GAUCHE',keeperDirection:'DROITE',mode:'goal'});
 assert.deepEqual(session.shootout.score,{PSG:0,OM:0});
 assert.equal(session.shootout.timeline.length,0);
 const replay=prepareLabKick(session,{shotDirection:'CENTRE',keeperDirection:'CENTRE',mode:'save'});
 assert.equal(replay.attempt.outcome,'save');
 assert.equal(session.shootout.timeline.length,0);
 const confirmed=commitLabKick(session,kick);
 assert.equal(confirmed.shootout.score.PSG,1);
 assert.equal(confirmed.shootout.timeline.length,1);
 assert.equal(labTurn(confirmed).club,'OM');
 assert.deepEqual(session.shootout.score,{PSG:0,OM:0});
});
test('TAB : ordre de tireurs officiel et arrêt anticipé de séance',()=>{
 let session=createLabSession({type:'shootout'});
 const first=labTurn(session);
 const used=new Set();
 for(let i=0;i<10&&session.shootout.phase==='active';i++){
  const turn=labTurn(session);
  assert.ok(turn);
  used.add(turn.shooterId);
  const result=prepareLabKick(session,{shotDirection:'DROITE',keeperDirection:'GAUCHE',
    mode:turn.club===first.club?'goal':'miss'});
  session=commitLabKick(session,result);
 }
 assert.equal(session.shootout.phase,'finished');
 assert.equal(session.shootout.winner,first.club);
 assert.ok(used.size>=6);
});
test('Un nouveau labo repart toujours à zéro et n expose aucun service distant',()=>{
 const a=createLabSession({type:'shootout'});
 const b=createLabSession({type:'shootout'});
 const result=prepareLabKick(a,{shotDirection:'GAUCHE',keeperDirection:'GAUCHE',mode:'goal'});
 const next=commitLabKick(a,result);
 assert.equal(next.shootout.timeline.length,1);
 assert.equal(b.shootout.timeline.length,0);
 assert.ok(!('room' in b)&&!('token' in b)&&!('matchRecordId' in b));
});

test('Fin du laboratoire : écran final officiel OPFC avec score TAB et aucune écriture',()=>{
 let session=createLabSession({type:'shootout'});
 const first=labTurn(session).club;
 while(session.shootout.phase==='active'){
  const turn=labTurn(session);
  const prepared=prepareLabKick(session,{
   shotDirection:'GAUCHE',keeperDirection:'DROITE',
   mode:turn.club===first?'goal':'miss'
  });
  session=commitLabKick(session,prepared);
 }
 const zero=()=>({sequences:0,shots:0,onTarget:0,saves:0});
 const html=renderFinalResult({
  phase:'finished',competition:'grandline',
  teams:session.teams.map(t=>({...t,identityId:t.club})),
  match:{
   winner:session.shootout.winner,victory:'shootout',
   score:{PSG:0,OM:0},goals:[],history:[],
   statistics:{PSG:zero(),OM:zero()},
   competition:'grandline',shootout:session.shootout
  }
 });
 assert.ok(html.includes('final-screen'));
 assert.ok(html.includes('final-penalty-score'));
 assert.ok(html.includes('final-shootout'));
 assert.ok(html.includes('VICTOIRE'));
});
