import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,ready} from '../engine.mjs';
import {kickoffMatch,currentMatchMoment,resolveMatchMoment,continueMatch,resumeMatch,matchPublicView} from '../match.mjs';
import {calculateOpenShot} from '../shot.mjs';
import {
 beginOpenPlayAction,lockOpenPlayChoice,revealOpenPlayDuel,continueOpenPlayDuel,
 revealOpenPlayShot,pendingOpenPlayFoul
} from '../match-actions.mjs';

const PSG=['chopper','jinbe','kaido','shanks','nami','luffy','zoro'];
const OM=['loki','mihawk','monkey-d-garp','katakuri','sabo','sanji','kizaru'];
const rng=(seed=9)=>()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);
function start(seed=9){
 let state=createGame({dice:[5,2],rng:rng(2)});
 state.phase='kickoff-ready';state.auction=null;
 for(const team of state.teams){
  team.roster=[...(team.club==='PSG'?PSG:OM)];
  team.slots=[...team.roster];team.formation='2-2-2';team.ready=true;
 }
 return kickoffMatch(state,rng(seed));
}
function atOpen(state){
 let s=state;
 for(let tries=0;tries<20;tries++){
  if(s.phase==='half-time'){
   s=ready(ready(s,'PSG'),'OM');
   s=resumeMatch(s);
  }
  if(s.phase!=='match')throw Error('Plus de séquence ouverte');
  if(currentMatchMoment(s).type==='open')return s;
  s=continueMatch(resolveMatchMoment(s,{outcome:'stopped'}));
 }
 throw Error('Aucune séquence ouverte');
}
const prepared=(seed=3,contextDraw=.3)=>beginOpenPlayAction(atOpen(start(seed)),()=>contextDraw);
function lockedDuel(s,attack='PERCER',defense='INTERCEPTER'){
 const a=s.match.action;
 s=lockOpenPlayChoice(s,a.attacker,attack);
 s=lockOpenPlayChoice(s,a.defender,defense);
 return s;
}
const chance=()=>continueOpenPlayDuel(revealOpenPlayDuel(lockedDuel(prepared()),.2));

test('Seules les séquences open démarrent une action; aucun doublon de préparation',()=>{
 let s=start();
 if(currentMatchMoment(s).type!=='open'){
  assert.throws(()=>beginOpenPlayAction(s,()=>.3),/pas du jeu ouvert/);
 }
 s=atOpen(s);
 const a=beginOpenPlayAction(s,()=>.3);
 assert.equal(a.match.action.index,a.match.index);
 assert.equal(a.match.action.minute,currentMatchMoment(s).minute);
 assert.equal(a.match.action.context,'BONNE');
 assert.equal(a.match.action.stage,'attack-choice');
 assert.throws(()=>beginOpenPlayAction(a,()=>.3),/en cours/);
 assert.equal(s.match.action,undefined);
});
test('Acteurs et future combinaison déterminés avant tactiques; pas de choix secret affiché',()=>{
 const s=prepared();
 const action=s.match.action;
 assert.notEqual(action.roles.carrier.cardId,action.roles.partner.cardId);
 assert.ok(action.roles.finishers.COMBINER);
 assert.ok(action.roles.finishers.PERCER);
 assert.ok(action.roles.finishers.LANCER);
 assert.equal(action.roles.defender.position!=='GAR',true);
 const publicState=matchPublicView(s);
 assert.equal(publicState.match.action.roles.carrier.cardId,action.roles.carrier.cardId);
 assert.equal(publicState.match.action.choices,undefined);
 assert.equal(publicState.match.action.duel,undefined);
 assert.equal(publicState.match.action.chemistryBonus,undefined);
 assert.equal(publicState.match.schedule,undefined);
 assert.equal(publicState.deck,undefined);
});
test('Choix offensif bloqué, puis choix défensif, sans fuite dans la vue publique',()=>{
 let s=prepared(),attack=s.match.action.attacker,defense=s.match.action.defender;
 assert.throws(()=>lockOpenPlayChoice(s,defense,'PRESSER'),/pas au tour/);
 assert.throws(()=>lockOpenPlayChoice(s,attack,'DIRECT'),/inconnu/);
 s=lockOpenPlayChoice(s,attack,'PERCER');
 assert.equal(s.match.action.stage,'defense-choice');
 assert.equal(s.match.action.choices.attack,'PERCER');
 let p=matchPublicView(s);
 assert.equal(p.match.action.choices,undefined);
 assert.equal(p.match.action.confirmed.attacker,true);
 assert.equal(p.match.action.confirmed.defender,false);
 assert.equal(p.match.action.duel,undefined);
 assert.throws(()=>lockOpenPlayChoice(s,attack,'LANCER'),/pas au tour/);
 s=lockOpenPlayChoice(s,defense,'INTERCEPTER');
 assert.equal(s.match.action.stage,'duel-ready');
 p=matchPublicView(s);
 assert.equal(p.match.action.choices,undefined);
 assert.equal(p.match.action.confirmed.defender,true);
 assert.equal(p.match.action.duel,undefined);
 assert.throws(()=>lockOpenPlayChoice(s,defense,'CONTENIR'),/Étape/);
});
test('Révélation des deux tactiques ET calcul seulement après confirmations',()=>{
 let s=prepared();
 assert.throws(()=>revealOpenPlayDuel(s,.3),/Étape/);
 s=lockedDuel(s);
 s=revealOpenPlayDuel(s,.2);
 const a=s.match.action;
 assert.equal(a.stage,'duel-revealed');
 assert.equal(a.duel.calculation.attack,'PERCER');
 assert.equal(a.duel.calculation.defense,'INTERCEPTER');
 assert.equal(a.duel.outcome.outcome,'chance');
 assert.equal(a.shooterId,a.roles.carrier.cardId);
 const view=matchPublicView(s).match.action;
 assert.equal(view.duel.calculation.attack,'PERCER');
 assert.equal(view.shooterId,a.shooterId);
 assert.equal(view.choices,undefined);
 assert.throws(()=>revealOpenPlayDuel(s,.2),/Étape/);
});
test('Défense victorieuse : fin de séquence, 0 tir, résultat bloqué jusqu’à Continuer',()=>{
 let s=revealOpenPlayDuel(lockedDuel(prepared()),.99999);
 assert.equal(s.match.action.duel.outcome.outcome,'stopped');
 s=continueOpenPlayDuel(s);
 assert.equal(s.phase,'moment-result');
 assert.equal(s.match.lastResult.outcome,'stopped');
 assert.equal(s.match.lastResult.details.duel.outcome.outcome,'stopped');
 const attacker=s.match.history.at(-1).attacker;
 assert.equal(s.match.statistics[attacker].sequences,1);
 assert.equal(s.match.statistics[attacker].shots,0);
 assert.equal(s.match.action,undefined);
 assert.throws(()=>revealOpenPlayShot(s,.5),/Aucune action/);
 const index=s.match.index;
 s=continueMatch(s);
 assert.equal(s.match.index,index+1);
});
test('Occasion créée : le duel ne marque pas de but et conserve la même séquence',()=>{
 let s=chance(),a=s.match.action;
 assert.equal(a.stage,'shot-attack-choice');
 assert.equal(a.duel.outcome.outcome,'chance');
 assert.equal(s.match.history.length,atOpen(start(3)).match.history.length);
 assert.equal(s.match.statistics.PSG.shots+s.match.statistics.OM.shots,0);
 assert.equal(s.match.score.PSG+s.match.score.OM,0);
 assert.equal(a.shooterId,a.roles.carrier.cardId);
 assert.throws(()=>continueMatch(s),/Aucun résultat/);
});
test('Tir : décisions irrévocables, aucune probabilité avant le choix du gardien',()=>{
 let s=chance(),a=s.match.action;
 assert.throws(()=>revealOpenPlayShot(s,.5),/Étape/);
 assert.throws(()=>lockOpenPlayChoice(s,a.defender,'LIGNE'),/pas au tour/);
 s=lockOpenPlayChoice(s,a.attacker,'PUISSANTE');
 let v=matchPublicView(s).match.action;
 assert.equal(v.choices,undefined);
 assert.equal(v.confirmed.shooter,true);
 assert.equal(v.confirmed.keeper,false);
 assert.equal(v.duel.outcome.outcome,'chance');
 s=lockOpenPlayChoice(s,a.defender,'PLONGEON');
 v=matchPublicView(s).match.action;
 assert.equal(v.choices,undefined);
 assert.equal(v.confirmed.keeper,true);
 assert.equal(s.match.action.stage,'shot-ready');
 assert.throws(()=>lockOpenPlayChoice(s,a.attacker,'PLACEE'),/Étape/);
});
test('Tir manqué, arrêt et but comptabilisés par le même moteur de match',()=>{
 for(const outcome of ['miss','save','goal']){
  let s=chance(),a=s.match.action;
  const shooter=[a.roles.carrier,a.roles.partner].find(x=>x.cardId===a.shooterId);
  const calc=calculateOpenShot({
   finisher:shooter,keeper:a.keeper,context:a.context,
   shot:'PUISSANTE',keeperReaction:'LIGNE'
  });
  const draw=outcome==='miss'?0:outcome==='save'?
   (calc.missProbability+calc.saveProbability/2)/100:.99999;
  s=lockOpenPlayChoice(s,a.attacker,'PUISSANTE');
  s=lockOpenPlayChoice(s,a.defender,'LIGNE');
  s=revealOpenPlayShot(s,draw);
  assert.equal(s.phase,'moment-result');
  assert.equal(s.match.lastResult.outcome,outcome);
  assert.equal(s.match.lastResult.details.finisherId,a.shooterId);
  assert.equal(s.match.history.at(-1).details.shot.result.outcome,outcome);
  const attacker=a.attacker,defender=a.defender;
  assert.equal(s.match.statistics[attacker].shots,1);
  assert.equal(s.match.statistics[attacker].onTarget,outcome==='miss'?0:1);
  assert.equal(s.match.statistics[defender].saves,outcome==='save'?1:0);
  assert.equal(s.match.score[attacker],outcome==='goal'?1:0);
  assert.equal(s.match.goals.length,outcome==='goal'?1:0);
  if(outcome==='goal')assert.equal(s.match.goals[0].cardId,a.shooterId);
  assert.equal(s.match.action,undefined);
 }
});
test('La finition ne laisse ni malus en double ni tirage supplémentaire',()=>{
 let s=chance(),a=s.match.action;
 assert.equal(a.context,'BONNE');
 s=lockOpenPlayChoice(s,a.attacker,'PLACEE');
 s=lockOpenPlayChoice(s,a.defender,'SORTIE');
 s=revealOpenPlayShot(s,.99999);
 const details=s.match.lastResult.details;
 assert.ok(details.shot.calculation.accuracy>0);
 assert.equal(details.shot.calculation.context,'BONNE');
 assert.equal(details.shot.calculation.shot,'PLACEE');
 assert.equal(details.shot.calculation.keeperReaction,'SORTIE');
 assert.equal(s.match.statistics[a.attacker].sequences,1);
});
test('Une faute franche reste en attente de penalty dans LA MÊME séquence',()=>{
 let s=prepared(3,.1);
 s=lockedDuel(s,'COMBINER','PRESSER');
 s=revealOpenPlayDuel(s,0);
 assert.equal(s.match.action.duel.outcome.outcome,'foul');
 assert.equal(s.match.action.duel.outcome.setPiece,'penalty');
 const index=s.match.index;
 s=continueOpenPlayDuel(s);
 assert.equal(s.match.action.stage,'set-piece-pending');
 assert.deepEqual(pendingOpenPlayFoul(s),{
  minute:s.match.action.minute,attacker:s.match.action.attacker,
  context:'FRANCHE',setPiece:'penalty'
 });
 assert.equal(s.match.index,index);
 assert.equal(s.match.history.length,atOpen(start(3)).match.history.length);
 assert.equal(s.match.statistics.PSG.sequences+s.match.statistics.OM.sequences,
  atOpen(start(3)).match.history.length);
 assert.throws(()=>continueMatch(s),/Aucun résultat/);
 assert.throws(()=>resolveMatchMoment(s,{outcome:'goal',scorerId:'luffy'}),/Action tactique/);
});
test('Une faute hors de la surface réserve un coup franc, sans double comptage',()=>{
 let s=prepared(3,.9);
 s=lockedDuel(s,'LANCER','PRESSER');
 s=continueOpenPlayDuel(revealOpenPlayDuel(s,0));
 assert.equal(s.match.action.stage,'set-piece-pending');
 assert.equal(pendingOpenPlayFoul(s).setPiece,'free-kick');
 assert.equal(pendingOpenPlayFoul(s).context,'DIFFICILE');
});
test('Aucune résolution arbitraire possible pendant un duel / tir',()=>{
 let s=prepared();
 for(const r of [{outcome:'goal',scorerId:'luffy'},{outcome:'stopped'}])
  assert.throws(()=>resolveMatchMoment(s,r),/Action tactique/);
 s=lockedDuel(s);
 assert.throws(()=>resolveMatchMoment(s,{outcome:'stopped'}),/Action tactique/);
 s=revealOpenPlayDuel(s,.2);
 assert.throws(()=>resolveMatchMoment(s,{outcome:'stopped'}),/Action tactique/);
 s=continueOpenPlayDuel(s);
 assert.throws(()=>resolveMatchMoment(s,{outcome:'goal',scorerId:'luffy'}),/Action tactique/);
});
test('Vérification des tirages invalides et des étapes non autorisées',()=>{
 let s=prepared();
 assert.throws(()=>revealOpenPlayDuel(s,-1),/Étape/);
 s=lockedDuel(s);
 assert.throws(()=>revealOpenPlayDuel(s,1),/Tirage/);
 s=revealOpenPlayDuel(s,.2);
 s=continueOpenPlayDuel(s);
 s=lockOpenPlayChoice(s,s.match.action.attacker,'PLACEE');
 s=lockOpenPlayChoice(s,s.match.action.defender,'LIGNE');
 assert.throws(()=>revealOpenPlayShot(s,1),/Tirage/);
});
test('La source du calendrier reste intacte quand l’action échoue ou réussit',()=>{
 let s=prepared(),calendar=structuredClone(s.match.schedule);
 s=revealOpenPlayDuel(lockedDuel(s),.2);
 s=continueOpenPlayDuel(s);
 s=lockOpenPlayChoice(s,s.match.action.attacker,'PLACEE');
 s=lockOpenPlayChoice(s,s.match.action.defender,'LIGNE');
 s=revealOpenPlayShot(s,.99999);
 s=continueMatch(s);
 assert.deepEqual(s.match.schedule,calendar);
});
