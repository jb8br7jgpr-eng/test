import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../engine.mjs';
import {kickoffMatch,currentMatchMoment,resolveMatchMoment,continueMatch,matchPublicView} from '../match.mjs';
import {beginOpenPlayAction,lockOpenPlayChoice,revealOpenPlayDuel,continueOpenPlayDuel,pendingOpenPlayFoul} from '../match-actions.mjs';
import {beginSetPieceAction,selectSetPieceTaker,lockSetPieceChoice,
 revealSetPieceDuel,continueSetPieceDuel,finishSetPieceCorner,revealSetPiecePenalty} from '../set-piece-actions.mjs';

const PSG=['chopper','jinbe','kaido','shanks','nami','luffy','zoro'];
const OM=['loki','mihawk','monkey-d-garp','katakuri','sabo','sanji','kizaru'];
const rng=(seed=9)=>()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);
function kickoff(seed){
 const state=createGame({dice:[5,2],rng:rng(2)});
 state.phase='kickoff-ready';state.auction=null;
 for(const team of state.teams){
  team.roster=[...(team.club==='PSG'?PSG:OM)];
  team.slots=[...team.roster];team.formation='2-2-2';team.ready=true;
 }
 return kickoffMatch(state,rng(seed));
}
const byKind=(()=>{
 const found={};
 for(let seed=1;seed<=2000&&Object.keys(found).length<4;seed++){
  const s=kickoff(seed);
  const kind=currentMatchMoment(s).type;
  if(!(kind in found))found[kind]=s;
 }
 return kind=>{
  if(!found[kind])throw Error('Aucune séquence initiale '+kind);
  return structuredClone(found[kind]);
 };
})();
const prepare=(kind,takerId,rolls=()=>0)=>{
 let s=beginSetPieceAction(byKind(kind));
 const event=currentMatchMoment(s);
 assert.equal(s.match.action.kind,kind);
 assert.equal(s.match.action.index,s.match.index);
 assert.equal(s.match.action.minute,event.minute);
 assert.equal(s.match.action.stage,'taker-choice');
 const attacker=s.match.action.attacker;
 if(!takerId)takerId=s.teams.find(t=>t.club===attacker).slots[4];
 return selectSetPieceTaker(s,attacker,takerId,rolls);
};
function choose(s,attack,defense){
 let x=s.match.action;
 s=lockSetPieceChoice(s,x.attacker,attack);
 s=lockSetPieceChoice(s,x.defender,defense);
 return s;
}
function showDuel(s,attack,defense,draw=0){
 return revealSetPieceDuel(choose(s,attack,defense),draw);
}
function foul(context){
 let s=byKind('open');
 const event=currentMatchMoment(s);
 s=beginOpenPlayAction(s,()=>context==='FRANCHE'?.1:.9);
 const a=s.match.action;
 s=lockOpenPlayChoice(s,a.attacker,'COMBINER');
 s=lockOpenPlayChoice(s,a.defender,'PRESSER');
 s=revealOpenPlayDuel(s,0);
 assert.equal(s.match.action.duel.outcome.outcome,'foul');
 s=continueOpenPlayDuel(s);
 assert.equal(s.match.action.stage,'set-piece-pending');
 const pending=pendingOpenPlayFoul(s);
 const previous=structuredClone(s.match.schedule);
 const index=s.match.index;
 s=beginSetPieceAction(s);
 assert.equal(s.match.index,index);
 assert.equal(s.match.action.minute,event.minute);
 assert.deepEqual(s.match.schedule,previous);
 assert.equal(s.match.action.source,'foul');
 assert.equal(s.match.action.originContext,context);
 return s;
}
function chooseTaker(s,takerId){
 const attacker=s.match.action.attacker;
 const selected=takerId??s.teams.find(t=>t.club===attacker).slots[4];
 return selectSetPieceTaker(s,attacker,selected,()=>.2);
}
function checkOneMoment(s,original){
 assert.equal(s.phase,'moment-result');
 assert.equal(s.match.index,original.match.index);
 assert.equal(s.match.history.length,original.match.history.length+1);
 assert.equal(s.match.statistics.PSG.sequences+s.match.statistics.OM.sequences,original.match.statistics.PSG.sequences+original.match.statistics.OM.sequences+1);
 assert.deepEqual(s.match.schedule,original.match.schedule);
 assert.equal(s.match.lastResult.minute,original.match.schedule[original.match.index].minute);
 const advanced=continueMatch(s);
 assert.equal(advanced.match.index,original.match.index+1);
 assert.deepEqual(advanced.match.schedule,original.match.schedule);
}
test('Initialisation uniquement pour une vraie séquence corner / CF / penalty',()=>{
 const open=byKind('open');
 assert.throws(()=>beginSetPieceAction(open),/ne contient pas/);
 for(const kind of ['corner','free-kick','penalty']){
  const s=beginSetPieceAction(byKind(kind));
  assert.equal(s.match.action.kind,kind);
  assert.equal(s.match.action.source,'calendar');
  assert.equal(s.match.action.stage,'taker-choice');
  assert.equal(s.match.history.length,0);
  assert.throws(()=>beginSetPieceAction(s),/en cours/);
 }
});
test('Tireur choisi parmi 7 (gardien compris), réceptionneur automatique distinct',()=>{
 for(const kind of ['corner','free-kick','penalty']){
  let s=byKind(kind);s=beginSetPieceAction(s);
  const club=s.match.action.attacker;
  assert.throws(()=>selectSetPieceTaker(s,club,'intrus'),/absent/);
  assert.throws(()=>selectSetPieceTaker(s,s.match.action.defender,'chopper'),/club attaquant/);
  const gk=s.teams.find(t=>t.club===club).slots[0];
  s=selectSetPieceTaker(s,club,gk,()=>.2);
  assert.equal(s.match.action.actors.taker.cardId,gk);
  assert.equal(s.match.action.stage,'attack-choice');
  if(kind!=='penalty'){
   assert.notEqual(s.match.action.actors.receiver.cardId,gk);
   assert.notEqual(s.match.action.actors.defender.position,'GAR');
  }else assert.equal(s.match.action.actors.receiver,undefined);
  assert.throws(()=>selectSetPieceTaker(s,club,gk),/Étape/);
 }
});
test('Les choix tactiques restent confidentiels jusqu’aux deux validations',()=>{
 for(const [kind,attack,defense] of [
  ['corner','PREMIER','SECOND'],['free-kick','CENTRE','MUR'],['penalty','GAUCHE','DROITE']
 ]){
  let s=prepare(kind);const actor=s.match.action.attacker,other=s.match.action.defender;
  let view=matchPublicView(s);
  assert.equal(view.match.action.stage,'attack-choice');
  assert.equal(view.match.action.choices,undefined);
  assert.equal(view.match.action.chemistryBonus,undefined);
  assert.equal(view.match.action.duel,undefined);
  assert.equal(view.match.action.actors.taker.cardId,s.match.action.actors.taker.cardId);
  assert.equal(view.match.schedule,undefined);
  assert.throws(()=>lockSetPieceChoice(s,other,defense),/tour/);
  s=lockSetPieceChoice(s,actor,attack);
  view=matchPublicView(s);
  assert.equal(view.match.action.confirmed.attacker,true);
  assert.equal(view.match.action.confirmed.defender,false);
  assert.equal(view.match.action.choices,undefined);
  assert.equal(view.match.action.duel,undefined);
  assert.throws(()=>lockSetPieceChoice(s,actor,attack),/tour/);
  s=lockSetPieceChoice(s,other,defense);
  view=matchPublicView(s);
  assert.equal(view.match.action.confirmed.defender,true);
  assert.equal(view.match.action.choices,undefined);
  assert.equal(view.match.action.duel,undefined);
 }
});
test('Corner contré : un résultat et zéro tir',()=>{
 const original=byKind('corner');
 let s=prepare('corner');
 s=showDuel(s,'PREMIER','PREMIER',.999999);
 assert.equal(s.match.action.duel.outcome.outcome,'stopped');
 assert.equal(matchPublicView(s).match.action.duel.calculation.tacticalAdjustment,-12);
 s=continueSetPieceDuel(s);
 assert.equal(s.match.lastResult.outcome,'stopped');
 assert.equal(s.match.lastResult.details.kind,'corner');
 assert.equal(s.match.statistics.PSG.shots+s.match.statistics.OM.shots,0);
 checkOneMoment(s,original);
});
test('Corner réussi : tête du réceptionneur, aucune deuxième tactique du gardien',()=>{
 const original=byKind('corner');
 let s=prepare('corner'),a=s.match.action;
 s=showDuel(s,'PREMIER','SECOND',0);
 assert.equal(s.match.action.duel.outcome.outcome,'chance');
 s=continueSetPieceDuel(s);
 assert.equal(s.match.action.stage,'corner-gesture-choice');
 assert.throws(()=>finishSetPieceCorner(s,.99999),/Étape/);
 const shooter=s.match.action.actors.receiver.cardId;
 s=lockSetPieceChoice(s,a.attacker,'TETE');
 assert.equal(matchPublicView(s).match.action.confirmed.gesture,true);
 s=finishSetPieceCorner(s,.999999);
 assert.equal(s.match.lastResult.outcome,'goal');
 assert.equal(s.match.goals.at(-1).cardId,shooter);
 assert.equal(s.match.lastResult.details.shot.calculation.gesture,'TETE');
 assert.equal(s.match.lastResult.details.shot.calculation.keeperReaction,undefined);
 assert.equal(s.match.statistics[a.attacker].shots,1);
 checkOneMoment(s,original);
});
test('Corner volée et retourné utilisent exactement leur moteur de finition',()=>{
 for(const gesture of ['VOLEE','RETOURNE']){
  let s=prepare('corner');
  s=continueSetPieceDuel(showDuel(s,'PENALTY','SECOND',0));
  s=lockSetPieceChoice(s,s.match.action.attacker,gesture);
  s=finishSetPieceCorner(s,0);
  assert.equal(s.match.lastResult.outcome,'miss');
  assert.equal(s.match.lastResult.details.shot.calculation.gesture,gesture);
 }
});
test('Coup franc contré : duel échoué, pas de finition, aucun tir',()=>{
 const original=byKind('free-kick');
 let s=prepare('free-kick');
 s=showDuel(s,'DIRECT','MUR',.999999);
 assert.equal(s.match.action.duel.outcome.outcome,'stopped');
 s=continueSetPieceDuel(s);
 assert.equal(s.match.lastResult.outcome,'stopped');
 assert.equal(s.match.statistics.PSG.shots+s.match.statistics.OM.shots,0);
 checkOneMoment(s,original);
});
test('Coup franc direct réussi : tireur aussi finisseur, but automatique sans choix du gardien',()=>{
 const original=byKind('free-kick');
 let s=prepare('free-kick'),id=s.match.action.actors.taker.cardId;
 s=showDuel(s,'DIRECT','MARQUAGE',0);
 assert.equal(s.match.action.duel.outcome.outcome,'chance');
 s=continueSetPieceDuel(s,.999999);
 assert.equal(s.match.lastResult.outcome,'goal');
 assert.equal(s.match.goals.at(-1).cardId,id);
 assert.equal(s.match.lastResult.details.shot.calculation.attack,'DIRECT');
 assert.equal(s.match.lastResult.details.shot.calculation.keeperReaction,undefined);
 checkOneMoment(s,original);
});
test('Coup franc centre/combinaison : même receveur prédésigné et finisseur',()=>{
 for(const [attack,defense] of [['CENTRE','MUR'],['COMBINAISON','MARQUAGE']]){
  let s=prepare('free-kick');
  const receiver=s.match.action.actors.receiver.cardId;
  s=showDuel(s,attack,defense,0);
  s=continueSetPieceDuel(s,.999999);
  assert.equal(s.match.lastResult.outcome,'goal');
  assert.equal(s.match.goals.at(-1).cardId,receiver);
  assert.equal(s.match.lastResult.details.finisherId,receiver);
  assert.equal(s.match.lastResult.details.shot.calculation.attack,attack);
 }
});
test('Penalty direct : seules les directions simultanément révélées déterminent l’issue',()=>{
 const original=byKind('penalty');
 let s=prepare('penalty');const a=s.match.action;
 assert.throws(()=>revealSetPiecePenalty(s,.9999),/Étape/);
 s=choose(s,'GAUCHE','GAUCHE');
 assert.equal(s.match.action.stage,'penalty-ready');
 assert.equal(matchPublicView(s).match.action.choices,undefined);
 s=revealSetPiecePenalty(s,.999999);
 assert.equal(s.match.lastResult.outcome,'goal');
 assert.equal(s.match.lastResult.details.shot.calculation.sameDirection,true);
 assert.equal(s.match.lastResult.details.shot.calculation.accuracy>0,true);
 assert.equal(s.match.goals.at(-1).cardId,a.actors.taker.cardId);
 checkOneMoment(s,original);
});
test('Penalty raté et arrêté : statistiques officielles par issue',()=>{
 for(const draw of [0,.3]){
  let s=choose(prepare('penalty'),'CENTRE','CENTRE');
  const a=s.match.action.attacker,d=s.match.action.defender;
  s=revealSetPiecePenalty(s,draw);
  assert.equal(s.match.lastResult.outcome,draw===0?'miss':'save');
  assert.equal(s.match.statistics[a].shots,1);
  assert.equal(s.match.statistics[a].onTarget,draw===0?0:1);
  assert.equal(s.match.statistics[d].saves,draw===0?0:1);
 }
});
test('Faute dans la surface : penalty dans la MEME séquence de jeu ouvert',()=>{
 const original=byKind('open');
 let s=foul('FRANCHE');
 assert.equal(s.match.action.kind,'penalty');
 assert.equal(s.match.action.originalDuel.outcome.outcome,'foul');
 assert.equal(matchPublicView(s).match.action.originalDuel,undefined);
 s=choose(chooseTaker(s),'GAUCHE','DROITE');
 s=revealSetPiecePenalty(s,.999999);
 assert.equal(s.match.history.at(-1).type,'open');
 assert.equal(s.match.lastResult.details.kind,'penalty');
 assert.equal(s.match.lastResult.details.source,'foul');
 assert.equal(s.match.lastResult.details.originContext,'FRANCHE');
 assert.equal(s.match.lastResult.details.originalDuel.outcome.outcome,'foul');
 checkOneMoment(s,original);
});
test('Faute hors surface : coup franc dans la MEME séquence',()=>{
 const original=byKind('open');
 let s=foul('DIFFICILE');
 assert.equal(s.match.action.kind,'free-kick');
 assert.equal(s.match.action.originalDuel.outcome.setPiece,'free-kick');
 s=showDuel(chooseTaker(s),'CENTRE','MUR',0);
 s=continueSetPieceDuel(s,.999999);
 assert.equal(s.match.history.at(-1).type,'open');
 assert.equal(s.match.lastResult.details.kind,'free-kick');
 assert.equal(s.match.lastResult.details.source,'foul');
 assert.equal(s.match.lastResult.details.originContext,'DIFFICILE');
 checkOneMoment(s,original);
});
test('Faute en situation BONNE : coup franc même séquence et aucun re-tirage de contexte',()=>{
 let s=byKind('open');
 s=beginOpenPlayAction(s,()=>.3);
 const a=s.match.action;
 s=lockOpenPlayChoice(s,a.attacker,'PERCER');
 s=lockOpenPlayChoice(s,a.defender,'PRESSER');
 s=continueOpenPlayDuel(revealOpenPlayDuel(s,0));
 assert.equal(pendingOpenPlayFoul(s).context,'BONNE');
 s=beginSetPieceAction(s);
 assert.equal(s.match.action.kind,'free-kick');
 assert.equal(s.match.action.originContext,'BONNE');
 assert.equal(s.match.action.stage,'taker-choice');
});
test('Aucun double comptage ni seconde faute pendant un coup de pied arrêté',()=>{
 let s=foul('FRANCHE'),base=structuredClone(s.match.schedule);
 const originalIndex=s.match.index;
 assert.throws(()=>beginSetPieceAction(s),/en cours/);
 s=choose(chooseTaker(s),'GAUCHE','DROITE');
 assert.throws(()=>resolveMatchMoment(s,{outcome:'goal',scorerId:'luffy'}),/Action tactique/);
 s=revealSetPiecePenalty(s,.999999);
 assert.equal(s.match.history.length,1);
 assert.equal(s.match.statistics.PSG.sequences+s.match.statistics.OM.sequences,1);
 assert.equal(s.match.index,originalIndex);
 assert.deepEqual(s.match.schedule,base);
 assert.equal(s.match.lastResult.details.shot.result.outcome,'goal');
});
test('Gardiens, tireurs et choix illégaux refusés sans modifier l’état',()=>{
 for(const kind of ['corner','free-kick','penalty']){
  const s=prepare(kind);
  assert.throws(()=>lockSetPieceChoice(s,s.match.action.attacker,'INCONNU'),/invalide/);
  assert.equal(s.match.action.choices.attack,null);
  assert.throws(()=>resolveMatchMoment(s,{outcome:'goal',scorerId:'luffy'}),/Action tactique/);
 }
 assert.throws(()=>revealSetPieceDuel(prepare('corner'),0),/Étape/);
 assert.throws(()=>revealSetPiecePenalty(prepare('free-kick'),0),/Étape/);
 assert.throws(()=>finishSetPieceCorner(prepare('corner'),0),/Étape/);
});
test('Les tirages invalides sont refusés après les confirmations',()=>{
 let corner=showDuel(prepare('corner'),'PREMIER','SECOND',0);
 corner=continueSetPieceDuel(corner);
 corner=lockSetPieceChoice(corner,corner.match.action.attacker,'VOLEE');
 assert.throws(()=>finishSetPieceCorner(corner,1),/Tirage/);
 let fk=showDuel(prepare('free-kick'),'CENTRE','MUR',0);
 assert.throws(()=>continueSetPieceDuel(fk,-.01),/Tirage/);
 let penalty=choose(prepare('penalty'),'GAUCHE','DROITE');
 assert.throws(()=>revealSetPiecePenalty(penalty,1),/Tirage/);
 assert.throws(()=>revealSetPieceDuel(choose(prepare('corner'),'PREMIER','SECOND'),1),/Tirage/);
});
