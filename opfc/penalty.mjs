/**
 * OPFC v0.8 §§30-31 : penalty réglementaire et tir de départage.
 * Mêmes règles pour les deux. Les directions sont recueillies SECRÈTEMENT
 * par l'orchestrateur avant de calculer puis révéler les probabilités.
 * Stats effectives par poste déjà calculées; aucun +8/+11 ni entente.
 */
import {resolveOpenShot} from './shot.mjs';

export const PENALTY_DIRECTIONS=Object.freeze(['GAUCHE','CENTRE','DROITE']);
const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));
const effective=(actor,key)=>{
  const val=actor?.stats?.[key];
  if(typeof val!=='number'||!Number.isFinite(val)||val<0||val>100)
    throw Error('Statistique effective invalide : '+key);
  return val;
};
/** Un calcul déterministe en pourcentages; aucun tirage ici. */
export function calculatePenalty({taker,keeper,shotDirection,keeperDirection}={}){
  if(!PENALTY_DIRECTIONS.includes(shotDirection)||!PENALTY_DIRECTIONS.includes(keeperDirection))
    throw Error('Direction de penalty invalide');
  const tec=effective(taker,'TEC'),pui=effective(taker,'PUI'),gar=effective(keeper,'GAR');
  const sameDirection=shotDirection===keeperDirection;
  const missProbability=clamp(10-.4*(tec-75),2,25);
  // 2 / 90 est une probabilité conditionnelle; elle n'est PAS 2 points de cadrage.
  const saveIfOnTarget=sameDirection?
    clamp(200/3+.5*(gar-75)-.2*(pui-75),20,85):
    200/90;
  const saveProbability=(100-missProbability)*saveIfOnTarget/100;
  const goalProbability=100-missProbability-saveProbability;
  return Object.freeze({
    shotDirection,keeperDirection,sameDirection,accuracy:100-missProbability,
    saveIfOnTarget,missProbability,saveProbability,goalProbability
  });
}
/** Un seul tirage final après révélation des deux directions. */
export function resolvePenalty(calculation,draw){
  if(!PENALTY_DIRECTIONS.includes(calculation?.shotDirection) ||
    !PENALTY_DIRECTIONS.includes(calculation?.keeperDirection) ||
    calculation.sameDirection!==(calculation.shotDirection===calculation.keeperDirection))
    throw Error('Calcul de penalty invalide');
  return resolveOpenShot(calculation,draw);
}
/** §32B : moyenne théorique de la probabilité de marquer lorsque les
 * trois directions sont équiprobables; GAR adverse figée à la 90e. */
export function averagePenaltyGoal(taker,keeper){
  const same=calculatePenalty({taker,keeper,shotDirection:'GAUCHE',keeperDirection:'GAUCHE'});
  const different=calculatePenalty({taker,keeper,shotDirection:'GAUCHE',keeperDirection:'DROITE'});
  return (same.goalProbability+2*different.goalProbability)/3;
}
