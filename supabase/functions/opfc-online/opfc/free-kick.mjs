/**
 * OPMercato FC — bloc 6 : coups francs dangereux, v0.8 §§28–29.
 * Les choix offensif / défensif sont secrets jusqu'à validation des deux.
 * Le tireur est choisi parmi les sept titulaires (GAR inclus).
 * Le réceptionneur (centre/combinaison) est choisi AVANT les tactiques,
 * pondéré par poste réel, et sera aussi le finisseur.
 *
 * Les statistiques d'entrée sont déjà corrigées du poste occupé.
 */
import {lineupDetails} from './rules.mjs';
import {selectRole,selectSetPieceReceiver} from './roles.mjs';
import {resolveOpenShot} from './shot.mjs';

export const FREE_KICK_ATTACKS=Object.freeze(['DIRECT','CENTRE','COMBINAISON']);
export const FREE_KICK_DEFENSES=Object.freeze(['MUR','MARQUAGE','ANTICIPER']);
const COUNTERS=Object.freeze({DIRECT:'MUR',CENTRE:'MARQUAGE',COMBINAISON:'ANTICIPER'});
const FINISH_BASE=Object.freeze({
  DIRECT:Object.freeze({accuracy:60,save:50}),
  CENTRE:Object.freeze({accuracy:65,save:50}),
  COMBINAISON:Object.freeze({accuracy:70,save:55}),
});
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
function effective(actor,key){
  const value=actor?.stats?.[key];
  if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>100)
    throw Error('Statistique effective invalide : '+key);
  return value;
}
function choice(value,allowed,kind){
  if(!allowed.includes(value))throw Error(kind+' invalide');
}
function chance(draw){
  if(typeof draw!=='number'||!Number.isFinite(draw)||draw<0||draw>=1)
    throw Error('Tirage invalide');
  return draw*100;
}
/** Tirage des acteurs déterministe pour RNG donné, sans tirage de duel.
 * Le réceptionneur est toujours anticipé avant le choix CENTRE ou COMBINAISON.
 * En DIRECT, seul le tireur sélectionné finit, même si un receveur est prévu.
 */
export function prepareFreeKickActors(attackingTeam,defendingTeam,takerId,rng=Math.random){
  const chosen=lineupDetails(attackingTeam).find(p=>p?.cardId===takerId);
  if(!chosen)throw Error('Tireur absent des titulaires');
  const taker=Object.freeze({cardId:chosen.cardId,position:chosen.position,stats:Object.freeze({...chosen.stats})});
  const receiver=selectSetPieceReceiver(attackingTeam,takerId,rng);
  const defender=selectRole(defendingTeam,'defender',{rng});
  return Object.freeze({taker,receiver,defender});
}
export function freeKickFinisherId(actors,attack){
  choice(attack,FREE_KICK_ATTACKS,'Stratégie offensive');
  const target=attack==='DIRECT'?actors?.taker:actors?.receiver;
  if(!target?.cardId)throw Error('Finisseur absent');
  return target.cardId;
}
/** Duel tactique §28. +11 inclus AVANT plafonnement; entente pour les
 * actions collectives seulement. Le succès crée directement un tir. */
export function calculateFreeKickDuel({taker,receiver,defender,attack,defense,chemistryBonus=0}={}){
  choice(attack,FREE_KICK_ATTACKS,'Stratégie offensive');
  choice(defense,FREE_KICK_DEFENSES,'Réponse défensive');
  if(typeof chemistryBonus!=='number'||!Number.isFinite(chemistryBonus)||
    chemistryBonus< -5||chemistryBonus>5)throw Error('Bonus entente invalide');
  if(taker?.cardId && receiver?.cardId && taker.cardId===receiver.cardId)
    throw Error('Réceptionneur identique au tireur');
  let attackStrength;
  if(attack==='DIRECT')attackStrength=.6*effective(taker,'TEC')+.4*effective(taker,'PUI');
  else if(attack==='CENTRE')attackStrength=.7*effective(taker,'PAS')+.3*effective(receiver,'PUI');
  else attackStrength=.6*((effective(taker,'PAS')+effective(receiver,'PAS'))/2)+.4*effective(taker,'TEC');
  const defenseStrength=defense==='ANTICIPER'?
    .7*effective(defender,'DEF')+.3*effective(defender,'VIT'):
    .7*effective(defender,'DEF')+.3*effective(defender,'PUI');
  const tacticalAdjustment=COUNTERS[attack]===defense?-20:16;
  const appliedChemistry=attack==='DIRECT'?0:chemistryBonus;
  const successProbability=clamp(
    50+attackStrength-defenseStrength+tacticalAdjustment+appliedChemistry+11,15,85
  );
  return Object.freeze({
    attack,defense,attackStrength,defenseStrength,tacticalAdjustment,
    chemistryBonus:appliedChemistry,successProbability,stoppedProbability:100-successProbability
  });
}
export function resolveFreeKickDuel(calculation,draw){
  const c=calculation;
  if(!c||!FREE_KICK_ATTACKS.includes(c.attack)||!FREE_KICK_DEFENSES.includes(c.defense)||
    !Number.isFinite(c.successProbability)||c.successProbability<0||c.successProbability>100)
    throw Error('Calcul de coup franc invalide');
  return Object.freeze({outcome:chance(draw)<c.successProbability?'chance':'stopped'});
}
/** §29. Aucune seconde qualité d'occasion, aucune tactique de gardien.
 * Bonus +18 sur CADRE seulement et un seul tirage final (via shot.mjs).
 */
export function calculateFreeKickFinish({taker,receiver,keeper,attack}={}){
  choice(attack,FREE_KICK_ATTACKS,'Stratégie offensive');
  const finisher=attack==='DIRECT'?taker:receiver;
  const base=FINISH_BASE[attack];
  const technique=effective(finisher,'TEC'),power=effective(finisher,'PUI');
  const goalkeeper=effective(keeper,'GAR');
  const accuracy=clamp(base.accuracy+.4*(technique-75)+18,5,95);
  const saveIfOnTarget=clamp(base.save-4+.5*(goalkeeper-75)-.2*(power-75),5,90);
  const missProbability=100-accuracy;
  const saveProbability=accuracy*saveIfOnTarget/100;
  const goalProbability=accuracy-saveProbability;
  return Object.freeze({
    attack,finisherId:finisher.cardId??null,accuracy,saveIfOnTarget,
    missProbability,saveProbability,goalProbability
  });
}
/** À invoquer seulement après duel réussi : le contrôleur gère le flux. */
export function resolveFreeKickFinish(calculation,draw){
  if(!FREE_KICK_ATTACKS.includes(calculation?.attack))throw Error('Finition de coup franc invalide');
  return resolveOpenShot(calculation,draw);
}
