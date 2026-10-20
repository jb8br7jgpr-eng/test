/**
 * OPFC 10A3B2a — Orchestration serveur du jeu ouvert.
 * L'action HTTP ne contient qu'un type et, pour un choix, sa valeur.
 * Acteur = club reconnu par le jeton serveur, jamais une clé du client.
 * Tirages, calendrier et décisions sont toujours conservés côté serveur.
 */
import {continueMatch,matchPublicView,currentMatchMoment} from './match.mjs';
import {
 beginOpenPlayAction,lockOpenPlayChoice,revealOpenPlayDuel,
 continueOpenPlayDuel,revealOpenPlayShot
} from './match-actions.mjs';
import {secureRandomBytes} from './online-protocol.mjs';
import {SET_PIECE_TYPES,handlesOnlineSetPiece,applyOnlineSetPieceTransition} from './online-set-piece.mjs';
import {continueSetPieceDuel} from './set-piece-actions.mjs';
import {ONLINE_ENDGAME_COMMANDS,applyOnlineEndgameTransition,onlineShootoutView} from './online-endgame.mjs';

const fail=message=>{throw Error(message);};
const other=c=>c==='PSG'?'OM':'PSG';
const CLUBS=['PSG','OM'];
const PHASES=['match','moment-result','half-time','resume-ready',
 'shootout-ready','shootout','finished'];
/** Identifiant immuable de chaque annonce affichée sur les deux téléphones. */
function acknowledgementKey(state){
 const match=state.match;
 if(state.phase==='moment-result'&&match?.lastResult)
  return 'result:'+match.index;
 if(state.phase==='match'&&match?.action?.stage==='duel-revealed')
  return 'duel:'+match.index+':'+match.action.kind;
 if(['shootout','finished'].includes(state.phase)&&match?.shootoutLastResult){
  const a=match.shootoutLastResult;
  return 'shootout:'+a.club+':'+a.shotNumber;
 }
 return null;
}
function acknowledgeScreen(state,club,rng){
 const key=acknowledgementKey(state);
 if(!key)fail('Aucun écran de résultat à valider');
 const next=structuredClone(state);
 const old=next.match.resultAcks;
 const ack=old?.key===key?old:{key,PSG:false,OM:false};
 if(ack[club])return next; // Requête idempotente d'un téléphone déjà prêt.
 ack[club]=true;
 next.match.resultAcks=ack;
 if(!ack.PSG||!ack.OM)return next;
 delete next.match.resultAcks;
 if(state.phase==='moment-result')return continueMatch(next);
 if(state.match.action?.stage==='duel-revealed'){
  if(state.match.action.kind==='open')return continueOpenPlayDuel(next);
  return continueSetPieceDuel(next,rng());
 }
 // Résultat d'un tir au but : passage uniquement quand les deux sont prêts.
 next.match.shootoutLastResult=null;
 return next;
}
function clubValid(club){if(!CLUBS.includes(club))fail('Club authentifié invalide');}
function cryptoRng(){
 const b=secureRandomBytes(4);
 return new DataView(b.buffer,b.byteOffset,4).getUint32(0)/4294967296;
}
function safeTeams(teams){
 return teams.map(t=>({
  club:t.club,identityId:t.identityId??t.club,budget:t.budget,refusals:t.refusals,
  roster:[...t.roster],formation:t.formation,slots:[...t.slots],
  ready:t.ready,
  hakis:{observation:!!t.hakis?.observation,kings:!!t.hakis?.kings}
 }));
}
/** Liste blanche explicite et indépendante de l'état maître.
 * Les calculs restent invisibles jusqu'à la révélation officielle. */
export function onlineMatchView(state,club){
 clubValid(club);
 if(!PHASES.includes(state?.phase)||!state.match)fail('Aucun match à afficher');
 const publicState=matchPublicView(state);
 const m=publicState.match;
 return {
  version:state.version,phase:state.phase,
  teams:safeTeams(state.teams),dice:[...state.dice],
  match:{
   index:m.index,minute:m.minute,
   score:structuredClone(m.score),
   statistics:structuredClone(m.statistics),
   goals:structuredClone(m.goals),
   history:structuredClone(m.history),
   lastResult:m.lastResult?structuredClone(m.lastResult):null,
   resultAcks:acknowledgementKey(state)&&state.match.resultAcks?.key===acknowledgementKey(state)?
    {PSG:!!state.match.resultAcks.PSG,OM:!!state.match.resultAcks.OM}:
    {PSG:false,OM:false},
   winner:m.winner??null,victory:m.victory??null,
   currentMoment:m.currentMoment??null,
   action:m.action?structuredClone(m.action):null,
   ...(state.match.shootout?{shootout:onlineShootoutView(state)}:{})
  }
 };
}
function actionOwner(a){
 if(!a||a.kind!=='open')fail('Aucune action de jeu ouvert active');
 const stage=a.stage;
 if(['attack-choice','shot-attack-choice'].includes(stage))return a.attacker;
 if(['defense-choice','shot-defense-choice'].includes(stage))return a.defender;
 if(['duel-ready','duel-revealed','shot-ready'].includes(stage))return a.attacker;
 fail('Étape de jeu ouvert non prise en charge');
}
const TYPES={
 'begin-open':['type'],
 'choose':['type','choice'],
 'reveal-duel':['type'],
 'continue-duel':['type'],
 'reveal-shot':['type'],
 'continue-result':['type'],
 'ack':['type'],
 ...SET_PIECE_TYPES,
 ...ONLINE_ENDGAME_COMMANDS
};
export function applyOnlineOpenPlayCommand(state,club,command,{rng=cryptoRng,hostClub=null}={}){
 clubValid(club);
 if(!state||!PHASES.includes(state.phase)||!state.match)
  fail('Aucune action de match disponible');
 if(!command||typeof command!=='object'||Array.isArray(command)||
  !Object.hasOwn(TYPES,command.type))
  fail('Commande de match invalide');
 const keys=TYPES[command.type];
 if(Object.keys(command).some(k=>!keys.includes(k))||
  keys.some(k=>!Object.hasOwn(command,k)))
  fail('Paramètre de match interdit');
 const type=command.type;
 let next;
 if(Object.hasOwn(ONLINE_ENDGAME_COMMANDS,type)){
  next=applyOnlineEndgameTransition(state,club,command,{hostClub,rng});
 }else if(type==='ack'){
  next=acknowledgeScreen(state,club,rng);
 }else if(type==='continue-result'){
  if(state.phase!=='moment-result'||state.match.lastResult?.attacker!==club)
   fail('Seul le club attaquant peut continuer ce résultat');
  next=continueMatch(state);
 }else if(type==='begin-open'){
  const event=currentMatchMoment(state);
  if(state.phase!=='match'||state.match.action||
   event?.type!=='open'||event.attacker!==club)
   fail('Seul le club attaquant peut commencer son jeu ouvert');
  next=beginOpenPlayAction(state,rng);
 }else{
  if(state.phase!=='match')fail('Le match attend un autre écran');
  const a=state.match.action;
  if(handlesOnlineSetPiece(state,type)){
   // Le moteur de phase arrêtée vérifie son acteur et l'étape exacte.
   // Une faute en jeu ouvert conserve l'index et la minute de la séquence.
   next=applyOnlineSetPieceTransition(state,club,command,rng);
  }else{
   if(a?.kind!=='open'||a.index!==state.match.index)
    fail('Aucune action de jeu ouvert active');
   if(actionOwner(a)!==club)fail('Ce n’est pas au tour de ce club');
   if(type==='choose'){
    if(typeof command.choice!=='string'||command.choice.length>32)
     fail('Choix de match invalide');
    next=lockOpenPlayChoice(state,club,command.choice);
    // Deuxième choix validé : résultat calculé automatiquement côté serveur.
    if(next.match.action?.stage==='duel-ready')
     next=revealOpenPlayDuel(next,rng());
    else if(next.match.action?.stage==='shot-ready')
     next=revealOpenPlayShot(next,rng());
   }else if(type==='reveal-duel'){
    next=revealOpenPlayDuel(state,rng());
   }else if(type==='continue-duel'){
    next=continueOpenPlayDuel(state);
   }else if(type==='reveal-shot'){
    next=revealOpenPlayShot(state,rng());
   }
  }
 }
 if(!next)fail('Action de match non prise en charge');
 return {state:next,publicForActor:onlineMatchView(next,club)};
}
