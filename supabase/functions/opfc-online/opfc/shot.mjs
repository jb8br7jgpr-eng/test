/**
 * OPMercato FC — Bloc 4 : finitions interactives de jeu ouvert (§§23–25, v0.8).
 * Les personnages et le contexte ont été sélectionnés AVANT les décisions
 * secrètes. Le serveur / contrôleur attend ensuite les deux choix, révèle
 * le calcul et effectue UN SEUL tirage pour raté, arrêt ou but.
 *
 * Entrées : statistiques EFFECTIVES (matchStats / lineupDetails), sans
 * appliquer à nouveau les malus de poste. Pas de bonus d'entente à la finition.
 */
export const SHOT_CHOICES=Object.freeze(['PLACEE','PUISSANTE','PIQUEE']);
export const KEEPER_CHOICES=Object.freeze(['LIGNE','SORTIE','PLONGEON']);
export const SHOT_CONTEXTS=Object.freeze({
  FRANCHE:Object.freeze({accuracyBase:85,saveBase:3000/85}),
  BONNE:Object.freeze({accuracyBase:200/3,saveBase:50}),
  DIFFICILE:Object.freeze({accuracyBase:45,saveBase:3000/45}),
});
const SHOT_EFFECTS=Object.freeze({
  PLACEE:Object.freeze({accuracy:6,save:5,stopStat:'PUI'}),
  PUISSANTE:Object.freeze({accuracy:-6,save:-5,stopStat:'PUI'}),
  PIQUEE:Object.freeze({accuracy:-12,save:-10,stopStat:'TEC'}),
});
/** Positif = davantage d'arrêts pour le gardien, négatif = avantage tireur. */
const SAVE_TACTICS=Object.freeze({
  PLACEE:Object.freeze({LIGNE:0,SORTIE:8,PLONGEON:-8}),
  PUISSANTE:Object.freeze({LIGNE:-8,SORTIE:0,PLONGEON:8}),
  PIQUEE:Object.freeze({LIGNE:8,SORTIE:-8,PLONGEON:0}),
});
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
function stat(player,key){
  const value=player?.stats?.[key];
  if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>100)throw Error('Statistique effective invalide : '+key);
  return value;
}
function choice(value,options,description){
  if(!options.includes(value))throw Error(description+' inconnu');
}
function roll(draw){
  if(typeof draw!=='number'||!Number.isFinite(draw)||draw<0||draw>=1)throw Error('Tirage invalide');
  return draw*100;
}
/** Toutes les valeurs sont des pourcentages; aucune consommation de hasard. */
export function calculateOpenShot({finisher,keeper,context,shot,keeperReaction}={}){
  const setting=SHOT_CONTEXTS[context];
  if(!setting)throw Error('Contexte de finition inconnu');
  choice(shot,SHOT_CHOICES,'Geste');
  choice(keeperReaction,KEEPER_CHOICES,'Réaction');
  const effects=SHOT_EFFECTS[shot];
  const technique=stat(finisher,'TEC');
  const power=stat(finisher,effects.stopStat);
  const goalkeeper=stat(keeper,'GAR');
  const tacticalAdjustment=SAVE_TACTICS[shot][keeperReaction];
  const accuracy=clamp(setting.accuracyBase+effects.accuracy+0.4*(technique-75)+8,5,95);
  const saveIfOnTarget=clamp(
    setting.saveBase+effects.save+tacticalAdjustment+
    0.5*(goalkeeper-75)-0.2*(power-75),5,90
  );
  const missProbability=100-accuracy;
  const saveProbability=accuracy*saveIfOnTarget/100;
  const goalProbability=accuracy-saveProbability;
  return Object.freeze({
    context,shot,keeperReaction,accuracy,saveIfOnTarget,tacticalAdjustment,
    missProbability,saveProbability,goalProbability,
  });
}
/** Tirage final UNIQUE. 'save' signifie cadré et arrêté; 'goal' cadré. */
export function resolveOpenShot(calculation,draw){
  const c=calculation;
  if(!c || !Number.isFinite(c.missProbability)||!Number.isFinite(c.saveProbability)||
    !Number.isFinite(c.goalProbability)||c.missProbability<0||c.saveProbability<0||
    c.goalProbability<0||Math.abs(c.missProbability+c.saveProbability+c.goalProbability-100)>1e-7
  )throw Error('Calcul de finition invalide');
  const n=roll(draw);
  if(n<c.missProbability)return Object.freeze({outcome:'miss',onTarget:false,isGoal:false});
  if(n<c.missProbability+c.saveProbability)return Object.freeze({outcome:'save',onTarget:true,isGoal:false});
  return Object.freeze({outcome:'goal',onTarget:true,isGoal:true});
}
