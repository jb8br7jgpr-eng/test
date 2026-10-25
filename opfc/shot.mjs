/** OPFC — Finitions de jeu ouvert (uniquement).
 * Tirage unique ; statistiques effectives déjà corrigées pour le poste réel.
 * Ne concerne ni corners, ni coups francs, ni penalties, ni tirs au but.
 */
export const SHOT_CHOICES=Object.freeze(['PLACEE','PUISSANTE','PIQUEE']);
export const KEEPER_CHOICES=Object.freeze(['LIGNE','SORTIE','PLONGEON']);
export const SHOT_CONTEXTS=Object.freeze({
 FRANCHE:Object.freeze({accuracy:[86,82,80],goal:[64,61,64],k:[.11,.36,.14]}),
 BONNE:Object.freeze({accuracy:[77,72,70],goal:[41,40,39],k:[.23,.43,.27]}),
 DIFFICILE:Object.freeze({accuracy:[56,53,52],goal:[19,22,18],k:[.44,.61,.49]})
});
const SAVE_TACTICS=Object.freeze({
 PLACEE:Object.freeze({LIGNE:0,SORTIE:8,PLONGEON:-8}),
 PUISSANTE:Object.freeze({LIGNE:-8,SORTIE:0,PLONGEON:8}),
 PIQUEE:Object.freeze({LIGNE:8,SORTIE:-8,PLONGEON:0})
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
/** Toutes les valeurs sont des pourcentages, sans aucune consommation de hasard. */
export function calculateOpenShot({finisher,keeper,context,shot,keeperReaction}={}){
 const setting=SHOT_CONTEXTS[context];
 if(!setting)throw Error('Contexte de finition inconnu');
 choice(shot,SHOT_CHOICES,'Geste');
 choice(keeperReaction,KEEPER_CHOICES,'Réaction');
 const si=SHOT_CHOICES.indexOf(shot),technique=stat(finisher,'TEC'),power=stat(finisher,'PUI');
 const goalkeeper=stat(keeper,'GAR'),dt=technique-75,dp=power-75,dg=goalkeeper-75;
 const accuracyBase=setting.accuracy[si],goalBase=setting.goal[si];
 const tacticalAdjustment=SAVE_TACTICS[shot][keeperReaction];
 let accuracy=accuracyBase;
 let saveIfOnTarget=100*(1-goalBase/accuracyBase)+.60*dg+tacticalAdjustment;
 if(shot==='PLACEE'){
  accuracy+=.36*dt;
  saveIfOnTarget-=setting.k[si]*dt+.08*dp;
 }else if(shot==='PUISSANTE'){
  accuracy+=.20*dt+.10*dp;
  saveIfOnTarget-=setting.k[si]*dp;
 }else{
  accuracy+=.32*dt;
  saveIfOnTarget-=setting.k[si]*dt+.04*dp;
 }
 accuracy=clamp(accuracy,5,95);
 saveIfOnTarget=clamp(saveIfOnTarget,5,90);
 const missProbability=100-accuracy;
 const saveProbability=accuracy*saveIfOnTarget/100;
 const goalProbability=accuracy-saveProbability;
 return Object.freeze({
  context,shot,keeperReaction,accuracy,saveIfOnTarget,tacticalAdjustment,
  missProbability,saveProbability,goalProbability
 });
}
/** Recommandation purement informative, calculée AVANT le choix de la réaction secrète.
 * Les trois réactions du gardien sont considérées équiprobables, jamais révélées.
 * En cas d'égalité, le premier geste de SHOT_CHOICES gagne de façon stable.
 */
export function recommendOpenShot({finisher,keeper,context}={}){
 let best=null,bestChance=-Infinity;
 for(const shot of SHOT_CHOICES){
  let sum=0;
  for(const keeperReaction of KEEPER_CHOICES)
   sum+=calculateOpenShot({finisher,keeper,context,shot,keeperReaction}).goalProbability;
  const expectation=sum/KEEPER_CHOICES.length;
  if(expectation>bestChance+1e-10){best=shot;bestChance=expectation;}
 }
 return best;
}
/** Tirage final unique : raté, arrêt ou but, sans issue supplémentaire. */
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
