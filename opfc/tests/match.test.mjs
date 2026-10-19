import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,chooseFormation,place,ready} from '../engine.mjs';
import {lineupDetails} from '../rules.mjs';
import {nextShootoutShooter} from '../shootout.mjs';
import {
 kickoffMatch,currentMatchMoment,resolveMatchMoment,continueMatch,
 resumeMatch,beginShootout,advanceShootout,matchPublicView
} from '../match.mjs';

const P=['chopper','jinbe','kaido','shanks','nami','luffy','zoro'];
const O=['loki','mihawk','monkey-d-garp','katakuri','sabo','sanji','kizaru'];
const rng=(seed=45)=>()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);
function teamsReady(firstClub='PSG'){
 const s=createGame({firstClub,dice:[5,2],rng:rng(8)});
 s.phase='kickoff-ready';s.auction=null;
 for(const t of s.teams){
  t.roster=[...(t.club==='PSG'?P:O)];
  t.slots=[...t.roster];
  t.ready=true;t.formation='2-2-2';
 }
 return s;
}
const start=(seed=45,firstClub='PSG')=>kickoffMatch(teamsReady(firstClub),rng(seed));
function playToHalf(state){
 let s=state,limit=0;
 while(s.phase==='match'){
  if(++limit>15)throw Error('Boucle non terminée');
  s=resolveMatchMoment(s,{outcome:'stopped'});
  assert.equal(s.phase,'moment-result');
  s=continueMatch(s);
 }
 assert.equal(s.phase,'half-time');
 return s;
}
function resume(s){
 for(const club of ['PSG','OM'])s=ready(s,club);
 assert.equal(s.phase,'resume-ready');
 return resumeMatch(s);
}
function finishRegulation(state,decide){
 let s=state,limit=0;
 while(['match','moment-result','half-time','resume-ready'].includes(s.phase)){
  if(++limit>35)throw Error('Match non terminé');
  if(s.phase==='half-time'){s=resume(s);continue;}
  if(s.phase==='moment-result'){s=continueMatch(s);continue;}
  if(s.phase==='resume-ready'){s=resumeMatch(s);continue;}
  s=resolveMatchMoment(s,decide(currentMatchMoment(s)));
 }
 return s;
}

test('Coup d’envoi uniquement avec deux clubs réellement prêts et sept joueurs uniques',()=>{
 const base=teamsReady();
 assert.equal(base.phase,'kickoff-ready');
 assert.equal(kickoffMatch(base,rng(2)).phase,'match');
 assert.equal(base.phase,'kickoff-ready');
 const unready=teamsReady();unready.teams[0].ready=false;
 assert.throws(()=>kickoffMatch(unready,rng(2)),/prête/);
 const duplicate=teamsReady();duplicate.teams[1].roster[0]='chopper';duplicate.teams[1].slots[0]='chopper';
 assert.throws(()=>kickoffMatch(duplicate,rng(2)),/Doublon/);
 assert.throws(()=>kickoffMatch({...base,phase:'mercato'},rng(2)),/indisponible/);
});
test('Calendrier 10–12 : préétabli au coup d’envoi, PSG ou OM peut être premier joueur',()=>{
 for(const firstClub of ['PSG','OM']){
  const s=start(5,firstClub);
  assert.ok(s.match.schedule.length>=10&&s.match.schedule.length<=12);
  assert.deepEqual(Object.keys(s.match.score),['PSG','OM']);
  assert.deepEqual(s.match.score,{PSG:0,OM:0});
  for(const club of ['PSG','OM']){
   assert.ok(s.match.schedule.filter(e=>e.attacker===club).length>=3);
   for(const period of [1,2])assert.ok(s.match.schedule.some(e=>e.attacker===club&&e.period===period));
  }
 }
});
test('Vue publique masque TOUTES les séquences futures et le paquet du mercato',()=>{
 const s=start();
 const v=matchPublicView(s);
 assert.equal(v.match.currentMoment.minute,s.match.schedule[0].minute);
 assert.equal(v.match.currentMoment.attacker,s.match.schedule[0].attacker);
 assert.equal(Object.hasOwn(v.match,'schedule'),false);
 assert.equal(Object.hasOwn(v,'deck'),false);
 assert.equal(Object.hasOwn(v,'cursor'),false);
 assert.equal(v.match.history.length,0);
 assert.equal(s.match.schedule.length>0,true);
});
test('Une action arrêtée consomme une séquence mais aucun tir',()=>{
 let s=start();
 s=resolveMatchMoment(s,{outcome:'stopped'});
 const club=s.match.history[0].attacker;
 assert.equal(s.match.statistics[club].sequences,1);
 assert.equal(s.match.statistics[club].shots,0);
 assert.equal(s.match.score[club],0);
 assert.equal(s.phase,'moment-result');
 assert.equal(s.match.history[0].outcome,'stopped');
});
test('Le résultat reste affiché jusqu’au bouton Continuer; pas de double résolution',()=>{
 let s=start(),first=currentMatchMoment(s);
 assert.throws(()=>continueMatch(s),/Aucun résultat/);
 const next=resolveMatchMoment(s,{outcome:'stopped'});
 assert.equal(currentMatchMoment(next).minute,first.minute);
 assert.throws(()=>resolveMatchMoment(next,{outcome:'stopped'}),/Aucune action/);
 const cont=continueMatch(next);
 assert.equal(cont.match.history.length,1);
 assert.equal(cont.match.index,1);
 assert.equal(cont.phase,'match');
 assert.equal(s.match.index,0);
 assert.equal(s.match.history.length,0);
});
test('But : score +1, tir +1, tir cadré +1, buteur et minute conservés',()=>{
 let s=start();const attacker=currentMatchMoment(s).attacker;
 const shooter=s.teams.find(t=>t.club===attacker).slots[5];
 const event=currentMatchMoment(s);
 s=resolveMatchMoment(s,{outcome:'goal',scorerId:shooter});
 assert.equal(s.match.score[attacker],1);
 assert.equal(s.match.statistics[attacker].sequences,1);
 assert.equal(s.match.statistics[attacker].shots,1);
 assert.equal(s.match.statistics[attacker].onTarget,1);
 assert.deepEqual(s.match.goals[0],{club:attacker,cardId:shooter,minute:event.minute});
 assert.throws(()=>resolveMatchMoment(start(),{outcome:'goal',scorerId:'intrus'}),/Buteur/);
});
test('Arrêt : tir cadré et arrêt du gardien adverse, sans but',()=>{
 let s=start(),a=currentMatchMoment(s).attacker;
 s=resolveMatchMoment(s,{outcome:'save'});
 const d=a==='PSG'?'OM':'PSG';
 assert.equal(s.match.statistics[a].shots,1);
 assert.equal(s.match.statistics[a].onTarget,1);
 assert.equal(s.match.statistics[d].saves,1);
 assert.equal(s.match.score[a],0);
});
test('Tir manqué : tir, mais ni tir cadré ni arrêt',()=>{
 let s=start(),a=currentMatchMoment(s).attacker;
 s=resolveMatchMoment(s,{outcome:'miss'});
 assert.equal(s.match.statistics[a].shots,1);
 assert.equal(s.match.statistics[a].onTarget,0);
 assert.equal(s.match.statistics.PSG.saves+s.match.statistics.OM.saves,0);
});
test('Buteur interdit sur arrêt et sur tir manqué; résultats erronés refusés',()=>{
 const s=start();
 assert.throws(()=>resolveMatchMoment(s,{outcome:'save',scorerId:'luffy'}),/Buteur/);
 assert.throws(()=>resolveMatchMoment(s,{outcome:'miss',scorerId:'luffy'}),/Buteur/);
 assert.throws(()=>resolveMatchMoment(s,{outcome:'foul'}),/Résultat/);
 assert.throws(()=>resolveMatchMoment(s,{}),/Résultat/);
});
test('Mi-temps déclenchée APRÈS la dernière séquence 1re période, score mémorisé',()=>{
 let s=start(22);
 const source=structuredClone(s.match.schedule);
 const firstHalf=source.filter(e=>e.period===1).length;
 s=playToHalf(s);
 assert.equal(s.match.index,firstHalf);
 assert.equal(s.match.minute,45);
 assert.deepEqual(s.match.score,{PSG:0,OM:0});
 assert.equal(s.match.history.length,firstHalf);
 assert.ok(s.teams.every(t=>t.ready===false));
 assert.deepEqual(s.match.schedule,source);
 assert.equal(currentMatchMoment(s),null);
});
test('Pas de reprise avant deux confirmations « Équipe prête »',()=>{
 let s=playToHalf(start(32));
 assert.throws(()=>resumeMatch(s),/Reprise/);
 s=ready(s,'PSG');
 assert.equal(s.phase,'half-time');
 assert.throws(()=>resumeMatch(s),/Reprise/);
 s=ready(s,'OM');
 assert.equal(s.phase,'resume-ready');
 s=resumeMatch(s);
 assert.equal(s.phase,'match');
});
test('Changement de formation à la pause change les stats, PAS le calendrier',()=>{
 let s=playToHalf(start(42));
 const original=structuredClone(s.match.schedule);
 const before=lineupDetails(s.teams.find(t=>t.club==='PSG'));
 const originalLuffy=before.find(p=>p.cardId==='luffy');
 const originalRating=originalLuffy.rating;
 s=chooseFormation(s,'PSG','3-1-2');
 for(const [i,id] of [P[0],'luffy',P[2],P[3],P[4],'jinbe',P[6]].entries())s=place(s,'PSG',id,i);
 const after=lineupDetails(s.teams.find(t=>t.club==='PSG'));
 assert.notDeepEqual(after.map(x=>x.position),before.map(x=>x.position));
 assert.notEqual(after.find(p=>p.cardId==='luffy').rating,originalRating);
 s=resume(s);
 assert.deepEqual(s.match.schedule,original);
 assert.equal(s.match.minute,original[s.match.index].minute);
});
test('À 90 minutes : victoire PSG ou OM détectée, aucune prolongation',()=>{
 let s=finishRegulation(start(19),event=>({
   outcome:event.attacker==='PSG'?'goal':'stopped',
   scorerId:event.attacker==='PSG'?'luffy':null
 }));
 assert.equal(s.phase,'finished');assert.equal(s.match.minute,90);
 assert.equal(s.match.winner,'PSG');assert.equal(s.match.victory,'regulation');
 assert.equal(s.match.history.length,s.match.schedule.length);
 assert.throws(()=>continueMatch(s),/Aucun résultat/);
});
test('Égalité à 90 : séance requise et lanceur de pièce via moteur officiel',()=>{
 let s=finishRegulation(start(60),()=>({outcome:'stopped'}));
 assert.equal(s.phase,'shootout-ready');
 assert.equal(s.match.minute,90);
 assert.deepEqual(s.match.score,{PSG:0,OM:0});
 assert.equal(s.match.history.length,s.match.schedule.length);
 assert.throws(()=>beginShootout(s,1),/pièce/);
 s=beginShootout(s,0);
 assert.equal(s.phase,'shootout');assert.equal(s.match.shootout.firstClub,'PSG');
 assert.equal(s.match.shootout.phase,'active');
 assert.deepEqual(s.match.score,{PSG:0,OM:0});
});
test('Une séance peut départager le match sans altérer ses statistiques réglementaires',()=>{
 let s=finishRegulation(start(71),()=>({outcome:'stopped'}));
 const regulationStats=structuredClone(s.match.statistics);
 const original=structuredClone(s.match.score);
 s=beginShootout(s,0);
 for(let i=0;i<12;i++){
  const turn=nextShootoutShooter(s.match.shootout);
  const draw=i===10?0:.99999; // PSG rate en mort subite, OM marque.
  s=advanceShootout(s,{club:turn.club,shooterId:turn.cardId,
    shotDirection:'GAUCHE',keeperDirection:'GAUCHE',draw});
 }
 assert.equal(s.phase,'finished');
 assert.equal(s.match.winner,'OM');
 assert.equal(s.match.victory,'shootout');
 assert.deepEqual(s.match.score,original);
 assert.deepEqual(s.match.statistics,regulationStats);
 assert.deepEqual(s.match.shootout.score,{PSG:5,OM:6});
 assert.throws(()=>advanceShootout(s,{}),/Aucune séance/);
});
test('Une série de calendriers atteint 45 et 90 sans modifier le calendrier',()=>{
 for(let seed=1;seed<=100;seed++){
  let s=start(seed);
  const initial=structuredClone(s.match.schedule);
  s=finishRegulation(s,()=>({outcome:'stopped'}));
  assert.equal(s.phase,'shootout-ready');
  assert.equal(s.match.minute,90);
  assert.equal(s.match.history.length,initial.length);
  assert.deepEqual(s.match.schedule,initial);
  const total=s.match.statistics.PSG.sequences+s.match.statistics.OM.sequences;
  assert.equal(total,initial.length);
 }
});
