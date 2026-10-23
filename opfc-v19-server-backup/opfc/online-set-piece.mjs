/**
 * OPFC 10A3B2b — phases arrêtées sur le serveur OPFC.
 * L'authentification (club) et le verrou de version (CAS) ont lieu dans Edge.
 * Aucun résultat, tirage ni identité de club n'est accepté du téléphone.
 */
import {currentMatchMoment} from './match.mjs';
import {
 beginSetPieceAction,selectSetPieceTaker,lockSetPieceChoice,
 revealSetPieceDuel,continueSetPieceDuel,
 finishSetPieceCorner,revealSetPiecePenalty
} from './set-piece-actions.mjs';

const fail=m=>{throw Error(m);};
const kinds=['corner','free-kick','penalty'];
const types=Object.freeze({
 'begin-setpiece':['type'],
 'select-taker':['type','takerId'],
 'reveal-setpiece-duel':['type'],
 'continue-setpiece-duel':['type'],
 'finish-corner':['type'],
 'reveal-penalty':['type']
});
export const SET_PIECE_TYPES=types;
export function handlesOnlineSetPiece(state,type){
 return Object.hasOwn(types,type)||
   (type==='choose'&&kinds.includes(state?.match?.action?.kind));
}
export function applyOnlineSetPieceTransition(state,club,command,rng){
 const type=command.type;
 if(state?.phase!=='match'||!state.match)fail('Aucune phase arrêtée en cours');
 const a=state.match.action,event=currentMatchMoment(state);
 if(type==='begin-setpiece'){
  if(!event||event.attacker!==club)
   fail('Seul le club attaquant peut commencer cette phase arrêtée');
  if(a){
   if(a.kind!=='open'||a.stage!=='set-piece-pending')
    fail('Action précédente encore active');
  }else if(!kinds.includes(event.type))fail('Cette séquence ne contient pas de phase arrêtée');
  return beginSetPieceAction(state);
 }
 if(!a||!kinds.includes(a.kind)||a.index!==state.match.index)
  fail('Aucune phase arrêtée active');
 const actor=(a.stage==='defense-choice')?a.defender:a.attacker;
 if(actor!==club)fail('Ce n’est pas au tour de ce club');
 if(type==='select-taker'){
  if(a.stage!=='taker-choice')fail('Étape de tireur invalide');
  if(typeof command.takerId!=='string'||command.takerId.length>80)
   fail('Tireur invalide');
  return selectSetPieceTaker(state,club,command.takerId,rng);
 }
 if(type==='choose'){
  if(!['attack-choice','defense-choice','corner-gesture-choice'].includes(a.stage))
   fail('Étape de tactique invalide');
  if(typeof command.choice!=='string'||command.choice.length>32)
   fail('Choix tactique invalide');
  let next=lockSetPieceChoice(state,club,command.choice);
  // Comme en jeu ouvert, les deux tactiques verrouillées déclenchent
  // automatiquement le tirage officiel ; pas de bouton de résolution.
  if(next.match.action?.stage==='duel-ready')
   next=revealSetPieceDuel(next,rng(),rng);
  else if(next.match.action?.stage==='penalty-ready')
   next=revealSetPiecePenalty(next,rng());
  else if(next.match.action?.stage==='corner-finish-ready')
   next=finishSetPieceCorner(next,rng());
  return next;
 }
 if(type==='reveal-setpiece-duel'){
  if(a.stage!=='duel-ready')fail('Étape du duel invalide');
  return revealSetPieceDuel(state,rng(),rng);
 }
 if(type==='continue-setpiece-duel'){
  if(a.stage!=='duel-revealed')fail('Étape du duel invalide');
  return continueSetPieceDuel(state,rng());
 }
 if(type==='finish-corner'){
  if(a.stage!=='corner-finish-ready')fail('Étape de finition invalide');
  return finishSetPieceCorner(state,rng());
 }
 if(type==='reveal-penalty'){
  if(a.stage!=='penalty-ready')fail('Étape de penalty invalide');
  return revealSetPiecePenalty(state,rng());
 }
 fail('Commande de phase arrêtée inconnue');
}
