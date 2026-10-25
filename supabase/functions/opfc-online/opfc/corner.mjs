/**
 * OPMercato FC v0.8 — bloc 5 : corners (§§21, 26 et 27).
 * Les acteurs sont choisis avant les décisions secrètes. Le duel de zone
 * ne fait que créer une occasion ; si réussi, l'attaquant choisit tête,
 * volée ou retourné, sans second choix défensif.
 * Les stats fournies sont déjà corrigées pour les postes occupés.
 */
import {lineupDetails} from './rules.mjs';
import {selectRole,selectSetPieceReceiver} from './roles.mjs';
import {resolveOpenShot} from './shot.mjs';

export const CORNER_ZONES=Object.freeze(['PREMIER','PENALTY','SECOND']);
export const CORNER_GESTURES=Object.freeze(['TETE','VOLEE','RETOURNE']);
const GESTURES=Object.freeze({
  TETE:Object.freeze({accuracy:72,save:52,sensitivity:.35}),
  VOLEE:Object.freeze({accuracy:55,save:45,sensitivity:.55}),
  RETOURNE:Object.freeze({accuracy:38,save:35,sensitivity:.90}),
});
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
function stat(player,key){
  const value=player?.stats?.[key];
  if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>100){
    throw Error('Statistique effective invalide : '+key);
  }
  return value;
}
function validRngDraw(draw){
  if(typeof draw!=='number'||!Number.isFinite(draw)||draw<0||draw>=1)throw Error('Tirage invalide');
  return draw;
}
/** Retourne un tireur fourni et deux acteurs pondérés (réception et défense). */
export function prepareCornerActors(attackingTeam,defendingTeam,takerId,rng=Math.random){
  const takerInfo=lineupDetails(attackingTeam).find(p=>p?.cardId===takerId);
  if(!takerInfo)throw Error('Tireur absent de la composition');
  const taker=Object.freeze({
    cardId:takerInfo.cardId,position:takerInfo.position,
    stats:Object.freeze({...takerInfo.stats})
  });
  const receiver=selectSetPieceReceiver(attackingTeam,takerId,rng);
  const defender=selectRole(defendingTeam,'defender',{rng});
  return Object.freeze({taker,receiver,defender});
}
/** §26. Ne pas révéler cette probabilité avant la validation des DEUX zones. */
export function calculateCornerDuel({taker,receiver,defender,attackZone,defenseZone,chemistryBonus=0}={}){
  if(!CORNER_ZONES.includes(attackZone)||!CORNER_ZONES.includes(defenseZone))throw Error('Zone de corner invalide');
  if(!Number.isFinite(chemistryBonus)||chemistryBonus < -5||chemistryBonus > 5)throw Error('Bonus entente invalide');
  if(taker?.cardId && receiver?.cardId && taker.cardId===receiver.cardId)throw Error('Réceptionneur identique au tireur');
  const attackStrength=.65*stat(taker,'PAS')+.35*stat(receiver,'PUI');
  const defenseStrength=.75*stat(defender,'DEF')+.25*stat(defender,'PUI');
  const tacticalAdjustment=attackZone===defenseZone?-19:19;
  const successProbability=clamp(
    50+attackStrength-defenseStrength+tacticalAdjustment+chemistryBonus+11,15,85
  );
  return Object.freeze({
    attackZone,defenseZone,attackStrength,defenseStrength,tacticalAdjustment,
    chemistryBonus,successProbability,stoppedProbability:100-successProbability
  });
}
/** Un tirage seulement. Une réussite mène au choix du geste, pas au but. */
export function resolveCornerDuel(calculation,draw){
  if(!calculation||!CORNER_ZONES.includes(calculation.attackZone)||
    !CORNER_ZONES.includes(calculation.defenseZone)||
    !Number.isFinite(calculation.successProbability)||
    calculation.successProbability<0||calculation.successProbability>100
  )throw Error('Calcul de corner invalide');
  const outcome=validRngDraw(draw)*100<calculation.successProbability?'chance':'stopped';
  return Object.freeze({outcome});
}
/** §27. Le +20 de précision s'ajoute APRÈS l'effet des statistiques,
 * puis est soumis à la borne de cadrage 5–95 %. */
export function calculateCornerFinish({receiver,keeper,gesture}={}){
  const conf=GESTURES[gesture];if(!conf)throw Error('Geste de corner inconnu');
  const goalkeeper=stat(keeper,'GAR');
  let force;
  if(gesture==='TETE')force=.70*stat(receiver,'PUI')+.30*stat(receiver,'TEC');
  else if(gesture==='VOLEE')force=.65*stat(receiver,'TEC')+.35*stat(receiver,'PUI');
  else force=.70*stat(receiver,'TEC')+.30*stat(receiver,'VIT');
  const accuracy=clamp(conf.accuracy+conf.sensitivity*(force-75)+20,5,95);
  const saveIfOnTarget=clamp(conf.save-5+.5*(goalkeeper-75)-.2*(force-75),5,90);
  const missProbability=100-accuracy;
  const saveProbability=accuracy*saveIfOnTarget/100;
  const goalProbability=accuracy-saveProbability;
  return Object.freeze({
    gesture,force,accuracy,saveIfOnTarget,
    missProbability,saveProbability,goalProbability
  });
}
/** Réutilise le tirage final exclusif commun aux finitions. */
export function resolveCornerFinish(calculation,draw){
  if(!CORNER_GESTURES.includes(calculation?.gesture))throw Error('Finition de corner invalide');
  return resolveOpenShot(calculation,draw);
}
