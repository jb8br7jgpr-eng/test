/**
 * OPFC v0.8 — Bloc 8B2 : phases arrêtées intégrées au match.
 * Aucune nouvelle séquence en cas de faute dans le jeu ouvert (§22).
 * Le contrôleur local / serveur conserve cet état PRIVÉ et n'expose que
 * matchPublicView(). Aucun choix adverse ne peut être modifié après validation.
 */
import {lineupDetails,chemistryAdvantage} from './rules.mjs?v=opfc-match-balance-20261025';
import {currentMatchMoment,resolveMatchMoment,continueMatch} from './match.mjs?v=opfc-match-balance-20261025';
import {CORNER_ZONES,CORNER_GESTURES,prepareCornerActors,calculateCornerDuel,resolveCornerDuel,calculateCornerFinish,resolveCornerFinish} from './corner.mjs?v=opfc-match-balance-20261025';
import {FREE_KICK_ATTACKS,FREE_KICK_DEFENSES,prepareFreeKickActors,freeKickFinisherId,calculateFreeKickDuel,resolveFreeKickDuel,calculateFreeKickFinish,resolveFreeKickFinish} from './free-kick.mjs?v=opfc-match-balance-20261025';
import {PENALTY_DIRECTIONS,calculatePenalty,resolvePenalty} from './penalty.mjs?v=opfc-match-balance-20261025';

const clone=state=>structuredClone(state);
const fail=message=>{throw Error(message);};
const opponent=id=>id==='PSG'?'OM':'PSG';
const teamOf=(state,club)=>{
 const team=state?.teams?.find(t=>t.club===club);
 if(!team)fail('Club inconnu');
 return team;
};
const active=(state,stages)=>{
 const a=state?.match?.action;
 if(state?.phase!=='match'||!a||a.kind==='open'||a.index!==state.match.index)
  fail('Aucune phase arrêtée active');
 if(!stages.includes(a.stage))fail('Étape de phase arrêtée invalide');
 return a;
};
function goalkeeperOf(team){
 const player=lineupDetails(team).find(p=>p?.position==='GAR');
 if(!player)fail('Gardien absent');
 return {cardId:player.cardId,position:player.position,stats:{...player.stats}};
}
function finish(s,outcome,scorerId,details){
 delete s.match.action;
 const next=resolveMatchMoment(s,{outcome,scorerId});
 if(outcome==='goal'&&details.assistId&&details.assistId!==scorerId)
  next.match.goals.at(-1).assistId=details.assistId;
 next.match.lastResult.details=details;
 next.match.history.at(-1).details=details;
 return next;
}
function detailsOf(a,extra={}){
 return {kind:a.kind,source:a.source,
  ...(a.source==='foul'?{originContext:a.originContext,originalDuel:a.originalDuel}:{}),
  takerId:a.actors?.taker?.cardId??null,
  receiverId:a.actors?.receiver?.cardId??null,
  keeperId:a.keeper?.cardId??null,
  assistId:(a.kind==='corner'||(a.kind==='free-kick'&&a.choices?.attack!=='DIRECT'))?
   (a.actors?.taker?.cardId??null):null,
  defenderId:a.actors?.defender?.cardId??null,
  ...extra};
}
/** Action directe : issue du calendrier secret. Après faute : conversion
 * uniquement d'une action de jeu ouvert ayant une vraie faute résolue. */
export function beginSetPieceAction(state){
 if(state?.phase!=='match'||!state.match)fail('Aucun match en cours');
 const event=currentMatchMoment(state);
 if(!event)fail('Aucune séquence active');
 const existing=state.match.action;
 let kind,source,originContext=null,originalDuel=null;
 if(existing){
  if(existing.kind!=='open'||existing.stage!=='set-piece-pending'||
     existing.index!==state.match.index||
     existing.duel?.outcome?.outcome!=='foul'||
     event.type!=='open')fail('Une autre action est en cours');
  kind=existing.duel.outcome.setPiece;
  if(!['penalty','free-kick'].includes(kind))fail('Phase de faute invalide');
  source='foul';originContext=existing.context;
  originalDuel=structuredClone(existing.duel);
 }else{
  if(!['corner','free-kick','penalty'].includes(event.type))
   fail('Cette séquence ne contient pas de phase arrêtée');
  kind=event.type;source='calendar';
 }
 const attacker=event.attacker,defender=opponent(attacker);
 const s=clone(state);
 s.match.action={
  kind,source,originContext,originalDuel,
  index:s.match.index,minute:event.minute,attacker,defender,
  keeper:goalkeeperOf(teamOf(s,defender)),
  chemistryBonus:chemistryAdvantage(teamOf(s,attacker).slots,teamOf(s,defender).slots),
  stage:'taker-choice',actors:null,
  choices:{attack:null,defense:null,gesture:null},
  duel:null
 };
 return s;
}
/** Le tireur est un des 7 titulaires, GAR compris. Les autres personnages
 * sont tirés automatiquement AVANT les tactiques et figés pour l'action. */
export function selectSetPieceTaker(state,club,takerId,rng=Math.random){
 const a=active(state,['taker-choice']);
 if(club!==a.attacker)fail('Seul le club attaquant choisit le tireur');
 const attackTeam=teamOf(state,a.attacker),defenseTeam=teamOf(state,a.defender);
 if(!lineupDetails(attackTeam).some(p=>p?.cardId===takerId))
  fail('Tireur absent de la composition');
 let actors;
 if(a.kind==='corner')actors=prepareCornerActors(attackTeam,defenseTeam,takerId,rng);
 else if(a.kind==='free-kick')actors=prepareFreeKickActors(attackTeam,defenseTeam,takerId,rng);
 else {
  const taker=lineupDetails(attackTeam).find(p=>p.cardId===takerId);
  actors={taker:{cardId:taker.cardId,position:taker.position,stats:taker.stats}};
 }
 const s=clone(state);
 s.match.action.actors=actors;
 s.match.action.stage='attack-choice';
 return s;
}
/** Les deux clubs choisissent successivement, les décisions restant privées
 * jusqu'à revealSetPieceDuel() / revealSetPiecePenalty(). */
export function lockSetPieceChoice(state,club,choice){
 const a=active(state,['attack-choice','defense-choice','corner-gesture-choice']);
 const attackerTurn=a.stage!=='defense-choice';
 if(club!==(attackerTurn?a.attacker:a.defender))fail('Ce n’est pas au tour de ce club');
 const valid=a.stage==='corner-gesture-choice'?CORNER_GESTURES:
   a.kind==='corner'?CORNER_ZONES:
   a.kind==='free-kick'?(attackerTurn?FREE_KICK_ATTACKS:FREE_KICK_DEFENSES):
   PENALTY_DIRECTIONS;
 if(!valid.includes(choice))fail('Choix de phase arrêtée invalide');
 const s=clone(state),x=s.match.action;
 const key=a.stage==='attack-choice'?'attack':a.stage==='defense-choice'?'defense':'gesture';
 if(x.choices[key]!==null)fail('Décision déjà confirmée');
 x.choices[key]=choice;
 x.stage=a.stage==='attack-choice'?'defense-choice':
   a.stage==='defense-choice'?(a.kind==='penalty'?'penalty-ready':'duel-ready'):
   'corner-finish-ready';
 return s;
}
/** Après LES DEUX confirmations, révèle tactiques, calcul et duel,
 * et attend le bouton Continuer. */
export function revealSetPieceDuel(state,draw,finishRng){
 const a=active(state,['duel-ready']);
 let calculation,result;
 if(a.kind==='corner'){
  calculation=calculateCornerDuel({
   ...a.actors,attackZone:a.choices.attack,defenseZone:a.choices.defense,
   chemistryBonus:a.chemistryBonus
  });
  result=resolveCornerDuel(calculation,draw);
 }else if(a.kind==='free-kick'){
  calculation=calculateFreeKickDuel({
   ...a.actors,attack:a.choices.attack,defense:a.choices.defense,
   chemistryBonus:a.chemistryBonus
  });
  result=resolveFreeKickDuel(calculation,draw);
 }else fail('Aucun duel de construction pour un penalty');
 const s=clone(state);
 s.match.action.duel={calculation,outcome:result};
 // Coup franc DIRECT : aucune seconde étape « Occasion créée ».
 // Après les deux tactiques, tirer ou arrêter immédiatement, avec tirage
 // de finition distinct uniquement lorsque le duel a été remporté.
 if(a.kind==='free-kick'&&a.choices.attack==='DIRECT'){
  if(result.outcome==='stopped')
   return finish(s,'stopped',null,detailsOf(a,{duel:s.match.action.duel}));
  if(typeof finishRng!=='function')fail('Tirage de finition indisponible');
  const calc=calculateFreeKickFinish({
   taker:a.actors.taker,receiver:a.actors.receiver,
   keeper:a.keeper,attack:a.choices.attack
  });
  const shot=resolveFreeKickFinish(calc,finishRng());
  const finisherId=freeKickFinisherId(a.actors,a.choices.attack);
  return finish(s,shot.outcome,shot.isGoal?finisherId:null,
   detailsOf(a,{duel:s.match.action.duel,finisherId,shot:{calculation:calc,result:shot}}));
 }
 s.match.action.stage='duel-revealed';
 return s;
}
/** Corner gagné -> choix de geste. CF gagné -> finition automatique avec
 * un tirage unique passé en paramètre; échec -> aucune frappe enregistrée. */
export function continueSetPieceDuel(state,finishDraw){
 const a=active(state,['duel-revealed']);
 if(a.duel?.outcome?.outcome==='stopped'){
  // Défenseur déjà célébré sur l'écran du duel : éviter le second résultat.
  return continueMatch(finish(clone(state),'stopped',null,detailsOf(a,{duel:a.duel})));
 }
 if(a.duel?.outcome?.outcome!=='chance')fail('Issue de duel invalide');
 if(a.kind==='corner'){
  const s=clone(state);
  s.match.action.stage='corner-gesture-choice';
  return s;
 }
 if(a.kind==='free-kick'){
  const calc=calculateFreeKickFinish({
   taker:a.actors.taker,receiver:a.actors.receiver,
   keeper:a.keeper,attack:a.choices.attack
  });
  const result=resolveFreeKickFinish(calc,finishDraw);
  const finisherId=freeKickFinisherId(a.actors,a.choices.attack);
  return finish(clone(state),result.outcome,result.isGoal?finisherId:null,
   detailsOf(a,{duel:a.duel,finisherId,shot:{calculation:calc,result}}));
 }
 fail('Phase arrêtée invalide');
}
/** Corner : pas de seconde décision du gardien après le geste. */
export function finishSetPieceCorner(state,draw){
 const a=active(state,['corner-finish-ready']);
 if(a.kind!=='corner'||a.duel?.outcome?.outcome!=='chance')
  fail('Aucune occasion de corner à finir');
 const calc=calculateCornerFinish({
  receiver:a.actors.receiver,keeper:a.keeper,gesture:a.choices.gesture
 });
 const result=resolveCornerFinish(calc,draw);
 const finisherId=a.actors.receiver.cardId;
 return finish(clone(state),result.outcome,result.isGoal?finisherId:null,
  detailsOf(a,{duel:a.duel,gesture:a.choices.gesture,
    finisherId,shot:{calculation:calc,result}}));
}
/** Penalty direct OU consécutif à une faute : direction tireur / gardien,
 * une seule résolution et aucune faute/phase supplémentaire. */
export function revealSetPiecePenalty(state,draw){
 const a=active(state,['penalty-ready']);
 if(a.kind!=='penalty')fail('La séquence n’est pas un penalty');
 const calc=calculatePenalty({
  taker:a.actors.taker,keeper:a.keeper,
  shotDirection:a.choices.attack,keeperDirection:a.choices.defense
 });
 const result=resolvePenalty(calc,draw);
 const finisherId=a.actors.taker.cardId;
 return finish(clone(state),result.outcome,result.isGoal?finisherId:null,
  detailsOf(a,{finisherId,shot:{calculation:calc,result}}));
}
