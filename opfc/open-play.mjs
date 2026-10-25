/**
 * OPMercato FC v0.8 — jeu ouvert (§§19, 20, 22, 23).
 * Moteur pur partagé : les deux choix doivent être récupérés secrètement PAR
 * LE CONTROLEUR avant l'appel à calculateOpenPlay. Aucun réseau ici.
 *
 * Chaque acteur fournit ses statistiques DE MATCH, après éventuel malus
 * hors poste (cf. matchStats dans rules.mjs). Aucun nouveau malus ici.
 */
export const ATTACK_CHOICES=Object.freeze(['COMBINER','LANCER','PERCER']);
export const DEFENSE_CHOICES=Object.freeze(['PRESSER','INTERCEPTER','CONTENIR']);
export const CONTEXTS=Object.freeze({
  FRANCHE:Object.freeze({id:'FRANCHE',color:'vert',zone:'surface',setPiece:'penalty',weight:0.25}),
  BONNE:Object.freeze({id:'BONNE',color:'ambre',zone:'abords',setPiece:'free-kick',weight:0.50}),
  DIFFICILE:Object.freeze({id:'DIFFICILE',color:'rouge',zone:'loin',setPiece:'free-kick',weight:0.25}),
});
const ADVANTAGE=Object.freeze({
  COMBINER:Object.freeze({PRESSER:8,INTERCEPTER:0,CONTENIR:-8}),
  LANCER:Object.freeze({PRESSER:0,INTERCEPTER:-8,CONTENIR:8}),
  PERCER:Object.freeze({PRESSER:-8,INTERCEPTER:8,CONTENIR:0}),
});
const FOUL_BASE=Object.freeze({PRESSER:8,INTERCEPTER:3,CONTENIR:1});
const clamp=(v,low,high)=>Math.max(low,Math.min(high,v));
const assertChoice=(choice,choices)=>{if(!choices.includes(choice))throw Error('Tactique inconnue');};
const stat=(actor,key)=>{
  const value=actor?.stats?.[key];
  if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>100)throw Error('Statistique de match invalide : '+key);
  return value;
};
const assertDraw=draw=>{if(typeof draw!=='number'||!Number.isFinite(draw)||draw<0||draw>=1)throw Error('Tirage aléatoire invalide');return draw;};
export function drawOpenPlayContext(rng=Math.random){
  if(typeof rng!=='function')throw Error('Générateur aléatoire invalide');
  const n=assertDraw(rng());
  return n<0.25?'FRANCHE':n<0.75?'BONNE':'DIFFICILE';
}
export function calculateOpenPlay({carrier,partner,defender,attack,defense,chemistryBonus=0}){
  assertChoice(attack,ATTACK_CHOICES);assertChoice(defense,DEFENSE_CHOICES);
  if(!Number.isFinite(chemistryBonus)||chemistryBonus< -5||chemistryBonus>5)throw Error('Différentiel d’entente invalide');
  // Les statuts de porteur / partenaire sont tirés avant le choix (section 21).
  let attackStrength;
  if(attack==='COMBINER')attackStrength=0.6*((stat(carrier,'PAS')+stat(partner,'PAS'))/2)+0.4*stat(carrier,'TEC');
  else if(attack==='LANCER')attackStrength=0.65*stat(carrier,'PAS')+0.35*stat(partner,'VIT');
  else attackStrength=0.6*stat(carrier,'VIT')+0.4*stat(carrier,'TEC');
  const defenderDef=stat(defender,'DEF'),defenderVit=stat(defender,'VIT');
  const defenseStrength=defense==='PRESSER'?0.6*defenderDef+0.4*defenderVit:
    defense==='INTERCEPTER'?0.75*defenderDef+0.25*defenderVit:0.7*defenderDef+0.3*defenderVit;
  const tacticalAdvantage=ADVANTAGE[attack][defense];
  // +5 fixe : un choix défensif qui contre l'attaque réduit réellement ses chances.
  // Borne 15–85 %, entente uniquement pour la construction collective.
  const appliedChemistry=attack==='PERCER'?0:chemistryBonus;
  const successConditional=clamp(50+attackStrength-defenseStrength+tacticalAdvantage+appliedChemistry+5,15,85);
  const foulProbability=FOUL_BASE[defense]*(1+(75-defenderDef)/100);
  return Object.freeze({
    attack,defense,attackStrength,defenseStrength,tacticalAdvantage,
    chemistryBonus:appliedChemistry,successConditional,foulProbability,
    successProbability:(100-foulProbability)*successConditional/100,
    stoppedProbability:(100-foulProbability)*(100-successConditional)/100,
  });
}
export function resolveOpenPlay(calculation,context,draw){
  if(!calculation || !ATTACK_CHOICES.includes(calculation.attack)||!DEFENSE_CHOICES.includes(calculation.defense)||
    !Number.isFinite(calculation.foulProbability)||!Number.isFinite(calculation.successConditional)||
    calculation.foulProbability<0||calculation.foulProbability>100||
    calculation.successConditional<0||calculation.successConditional>100)throw Error('Calcul de duel invalide');
  const zone=CONTEXTS[context];if(!zone)throw Error('Contexte d’occasion inconnu');
  const n=assertDraw(draw)*100;
  if(n<calculation.foulProbability)return Object.freeze({outcome:'foul',setPiece:zone.setPiece,context:zone.id});
  if(n<calculation.foulProbability+calculation.successProbability)return Object.freeze({outcome:'chance',context:zone.id});
  return Object.freeze({outcome:'stopped',context:zone.id});
}
