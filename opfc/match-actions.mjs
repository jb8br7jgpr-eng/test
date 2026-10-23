/**
 * OPFC v0.8 — Bloc 8B1 : action de jeu ouvert, duels secrets et finition.
 * Contrôleur pur commun local/serveur, JAMAIS une API ouverte au client.
 * Serveur : conserver l'état complet privé et ne publier que matchPublicView.
 *
 * Les fautes sont mises en attente : leur résolution dans la MEME séquence
 * sera ajoutée au bloc 8B2, sans fabriquer de tir ou score anticipé.
 */
import {lineupDetails,chemistryAdvantage} from './rules.mjs';
import {prepareOpenPlayRoles,finisherFor} from './roles.mjs';
import {ATTACK_CHOICES,DEFENSE_CHOICES,drawOpenPlayContext,calculateOpenPlay,resolveOpenPlay} from './open-play.mjs?v=opfc-tactics-20261023';
import {SHOT_CHOICES,KEEPER_CHOICES,calculateOpenShot,resolveOpenShot} from './shot.mjs';
import {currentMatchMoment,resolveMatchMoment,continueMatch} from './match.mjs';
import {beginSetPieceAction} from './set-piece-actions.mjs';

const copy=s=>structuredClone(s);
const fail=message=>{throw Error(message);};
const opposite=club=>club==='PSG'?'OM':'PSG';
const safeTeam=(s,club)=>{
 const team=s?.teams?.find(t=>t.club===club);
 if(!team)fail('Club inconnu');
 return team;
};
const actionAt=(s,stage)=>{
 if(s?.phase!=='match'||!s.match?.action||s.match.action.index!==s.match.index)
  fail('Aucune action de jeu ouvert active');
 if(!stage.includes(s.match.action.stage))fail('Étape tactique invalide');
 return s.match.action;
};
function finishMoment(s,{outcome,scorerId=null},details){
 // Match engine's trusted scorer checks remain enforced. Do not allow actions
 // to be resolved directly when the private action is still attached.
 delete s.match.action;
 const next=resolveMatchMoment(s,{outcome,scorerId});
 next.match.lastResult.details=details;
 next.match.history.at(-1).details=details;
 return next;
}
/** Prépare contexte et acteurs publics AVANT de collecter les choix secrets. */
export function beginOpenPlayAction(state,rng=Math.random){
 if(state?.phase!=='match'||state.match?.action)fail('Une action est déjà en cours');
 const event=currentMatchMoment(state);
 if(!event||event.type!=='open')fail('Cette séquence n’est pas du jeu ouvert');
 const attacker=event.attacker,defender=opposite(attacker);
 const attackTeam=safeTeam(state,attacker),defenseTeam=safeTeam(state,defender);
 const context=drawOpenPlayContext(rng);
 const roles=prepareOpenPlayRoles(attackTeam,defenseTeam,rng);
 const goalkeeper=lineupDetails(defenseTeam).find(x=>x?.position==='GAR');
 if(!goalkeeper)fail('Gardien absent');
 const bonus=chemistryAdvantage(attackTeam.slots,defenseTeam.slots);
 const s=copy(state);
 s.match.action={
  kind:'open',index:s.match.index,minute:event.minute,attacker,defender,context,
  roles,keeper:{cardId:goalkeeper.cardId,stats:goalkeeper.stats},
  chemistryBonus:bonus,stage:'attack-choice',
  choices:{attack:null,defense:null,shot:null,keeper:null},
  duel:null,shotResult:null,shooterId:null
 };
 return s;
}
/** Vérification du club : attaquant puis défenseur, local ou en ligne.
 * Tous les choix sont irrévocables une fois confirmés. */
export function lockOpenPlayChoice(state,club,choice){
 const a=actionAt(state,['attack-choice','defense-choice','shot-attack-choice','shot-defense-choice']);
 const actor=['attack-choice','shot-attack-choice'].includes(a.stage)?a.attacker:a.defender;
 if(club!==actor)fail('Ce n’est pas au tour de ce club de choisir');
 const allowed={
  'attack-choice':ATTACK_CHOICES,
  'defense-choice':DEFENSE_CHOICES,
  'shot-attack-choice':SHOT_CHOICES,
  'shot-defense-choice':KEEPER_CHOICES
 }[a.stage];
 if(!allowed.includes(choice))fail('Choix tactique inconnu');
 const s=copy(state),x=s.match.action;
 const key={'attack-choice':'attack','defense-choice':'defense','shot-attack-choice':'shot','shot-defense-choice':'keeper'}[x.stage];
 if(x.choices[key]!==null)fail('Choix déjà enregistré');
 x.choices[key]=choice;
 x.stage={'attack-choice':'defense-choice','defense-choice':'duel-ready',
  'shot-attack-choice':'shot-defense-choice','shot-defense-choice':'shot-ready'}[x.stage];
 return s;
}
/** Réunion des joueurs : dévoile deux tactiques ensemble et résout un duel.
 * Aucun coefficient n'est publié avant cette révélation. */
export function revealOpenPlayDuel(state,draw){
 const a=actionAt(state,['duel-ready']);
 const calculation=calculateOpenPlay({
  ...a.roles,attack:a.choices.attack,defense:a.choices.defense,
  chemistryBonus:a.chemistryBonus
 });
 const outcome=resolveOpenPlay(calculation,a.context,draw);
 const s=copy(state),x=s.match.action;
 x.duel={calculation,outcome};
 x.shooterId=finisherFor(x.roles,x.choices.attack);
 x.stage='duel-revealed';
 return s;
}
/** Le bouton « Continuer » après le premier duel.
 * L'échec ferme la séquence; la réussite ouvre la finition. Une FAUTE
 * reste pendante en vue d'un penalty/coup franc dans la même séquence. */
export function continueOpenPlayDuel(state){
 const a=actionAt(state,['duel-revealed']);
 const s=copy(state),x=s.match.action;
 if(a.duel.outcome.outcome==='stopped'){
  // L'écran duel-révélé annonce déjà l'attaque stoppée, avec portrait.
  // En continuant, on enregistre le résultat puis on passe sans second écran.
  return continueMatch(finishMoment(s,{outcome:'stopped'},{
   kind:'open',context:a.context,duel:a.duel,roles:a.roles,
   defenderId:a.roles?.defender?.cardId??null
  }));
 }
 if(a.duel.outcome.outcome==='chance'){
  x.stage='shot-attack-choice';
  return s;
 }
 if(a.duel.outcome.outcome==='foul'){
  // L'annonce « Faute sifflée » est déjà affichée sur le duel.
  // Aller directement au choix du tireur, sans répéter « Faute sifflée ».
  x.stage='set-piece-pending';
  return beginSetPieceAction(s);
 }
 fail('Résultat de duel invalide');
}
/** Une seule résolution après choix secrets de frappe et de réaction. */
export function revealOpenPlayShot(state,draw){
 const a=actionAt(state,['shot-ready']);
 if(a.duel?.outcome?.outcome!=='chance')fail('Aucune occasion de tir disponible');
 const finisher=[a.roles.carrier,a.roles.partner].find(x=>x.cardId===a.shooterId);
 if(!finisher)fail('Finisseur inconnu');
 const calculation=calculateOpenShot({
  finisher,keeper:a.keeper,context:a.context,
  shot:a.choices.shot,keeperReaction:a.choices.keeper
 });
 const result=resolveOpenShot(calculation,draw);
 return finishMoment(copy(state),{
  outcome:result.outcome,
  scorerId:result.isGoal?a.shooterId:null
 },{
  kind:'open',context:a.context,duel:a.duel,
  finisherId:a.shooterId,shot:{calculation,result}
 });
}
/** Les actions en attente de phase arrêtée seront résolues au bloc suivant. */
export function pendingOpenPlayFoul(state){
 const a=actionAt(state,['set-piece-pending']);
 return Object.freeze({minute:a.minute,attacker:a.attacker,context:a.context,
  setPiece:a.duel.outcome.setPiece});
}
