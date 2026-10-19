/**
 * OPFC 10A3B2c — Autorité serveur pour la mi-temps et les tirs au but.
 * Jamais de direction, résultat, composition adverse ou hasard librement
 * fourni par le client : le club est authentifié avant cet appel.
 */
import {chooseFormation,place,ready} from './engine.mjs';
import {resumeMatch,beginShootout,advanceShootout} from './match.mjs';
import {nextShootoutShooter} from './shootout.mjs';

const fail=message=>{throw Error(message);};
const clubs=['PSG','OM'],other=club=>club==='PSG'?'OM':'PSG';
const directions=['GAUCHE','CENTRE','DROITE'];
export const ONLINE_ENDGAME_COMMANDS=Object.freeze({
 'half-formation':['type','formation'],
 'half-place':['type','cardId','slot'],
 'half-ready':['type'],
 'resume':['type'],
 'begin-shootout':['type'],
 'shootout-choose':['type','choice'],
 'shootout-reveal':['type'],
 'shootout-continue':['type']
});
const clone=s=>structuredClone(s);
function activeShooter(s){
 const next=nextShootoutShooter(s.match?.shootout);
 if(!next)fail('Aucun tireur disponible');
 return next;
}
function pendingValid(pending,shooter){
 return pending?.club===shooter.club&&pending?.shooterId===shooter.cardId;
}
function cleanAttempt(a){
 if(!a)return null;
 return {
  club:a.club,shotNumber:a.shotNumber,shooterId:a.shooterId,
  keeperId:a.keeperId,shotDirection:a.shotDirection,
  keeperDirection:a.keeperDirection,result:a.result,scored:a.scored
 };
}
/** Projection AUTORISÉE d'une séance, sans probabilités ni classements
 * secrets; les directions ne paraissent qu'APRÈS le tir résolu. */
export function onlineShootoutView(state){
 const s=state?.match?.shootout;
 if(!s)return null;
 const pending=state.match.shootoutPending;
 const shooter=s.phase==='active'?nextShootoutShooter(s):null;
 if(pending&&(!shooter||!pendingValid(pending,shooter)))
  fail('Directions en attente incompatibles avec le tour');
 return {
  phase:s.phase,stage:s.stage,winner:s.winner,
  firstClub:s.firstClub,nextClub:s.nextClub,
  score:{...s.score},
  attempts:{PSG:s.attempts.PSG.length,OM:s.attempts.OM.length},
  timeline:s.timeline.map(cleanAttempt),
  active:shooter?{
   club:shooter.club,shotNumber:shooter.shotNumber,
   shooterId:shooter.cardId,
   keeperId:s.keepers[other(shooter.club)].cardId
  }:null,
  confirmed:{
   shooter:!!pending?.shotDirection,
   keeper:!!pending?.keeperDirection
  },
  lastResult:cleanAttempt(state.match.shootoutLastResult)
 };
}
export function applyOnlineEndgameTransition(state,club,command,{hostClub,rng}={}){
 if(!clubs.includes(club)||!clubs.includes(hostClub))fail('Club authentifié invalide');
 const type=command.type;
 if(!Object.hasOwn(ONLINE_ENDGAME_COMMANDS,type))
  fail('Commande de fin de match inconnue');
 const fields=ONLINE_ENDGAME_COMMANDS[type];
 if(Object.keys(command).some(k=>!fields.includes(k))||
  fields.some(k=>!Object.hasOwn(command,k)))
  fail('Paramètre de fin de match interdit');
 const phase=state?.phase;
 let next;
 if(type.startsWith('half-')){
  if(phase!=='half-time')fail('Ce n’est pas la mi-temps');
  const t=state.teams.find(t=>t.club===club);
  if(!t)fail('Équipe du joueur introuvable');
  if(t.ready)fail('Composition déjà validée');
  if(type==='half-formation'){
   if(typeof command.formation!=='string'||command.formation.length>12)
    fail('Formation invalide');
   next=chooseFormation(state,club,command.formation);
  }else if(type==='half-place'){
   if(typeof command.cardId!=='string'||command.cardId.length>80||
    !Number.isInteger(command.slot)||command.slot<0||command.slot>6)
    fail('Placement invalide');
   next=place(state,club,command.cardId,command.slot);
  }else if(type==='half-ready')next=ready(state,club);
 }else if(type==='resume'){
  if(phase!=='resume-ready')fail('Reprise indisponible');
  if(club!==hostClub)fail('Seul l’hôte reprend le match');
  next=resumeMatch(state);
 }else if(type==='begin-shootout'){
  if(phase!=='shootout-ready')fail('Départage indisponible');
  if(club!==hostClub)fail('Seul l’hôte lance les tirs au but');
  next=beginShootout(state,rng());
  next.match.shootoutPending=null;
  next.match.shootoutLastResult=null;
 }else if(type==='shootout-continue'){
  if(!['shootout','finished'].includes(phase)||!state.match?.shootoutLastResult)
   fail('Aucun tir à continuer');
  if(state.match.shootoutLastResult.club!==club)
   fail('Seul le tireur valide le résultat');
  next=clone(state);
  next.match.shootoutLastResult=null;
 }else{
  if(phase!=='shootout'||state.match?.shootout?.phase!=='active')
   fail('Aucune séance active');
  if(state.match.shootoutLastResult)
   fail('Le résultat doit être validé avant le tir suivant');
  const shooter=activeShooter(state);
  const pending=state.match.shootoutPending;
  if(pending&&!pendingValid(pending,shooter))
   fail('Tir en attente incompatible');
  if(type==='shootout-choose'){
   if(!directions.includes(command.choice))fail('Direction invalide');
   const actor=!pending?shooter.club:
    pending.shotDirection&&!pending.keeperDirection?other(shooter.club):null;
   if(actor!==club)fail('Ce n’est pas au tour de ce club');
   next=clone(state);
   if(!pending)next.match.shootoutPending={
    club:shooter.club,shooterId:shooter.cardId,
    shotDirection:command.choice,keeperDirection:null
   };
   else next.match.shootoutPending.keeperDirection=command.choice;
  }else if(type==='shootout-reveal'){
   if(club!==shooter.club)fail('Seul le tireur révèle le tir');
   if(!pending?.shotDirection||!pending?.keeperDirection)
    fail('Deux directions sont nécessaires');
   next=advanceShootout(state,{
    club:shooter.club,shooterId:shooter.cardId,
    shotDirection:pending.shotDirection,
    keeperDirection:pending.keeperDirection,draw:rng()
   });
   next.match.shootoutPending=null;
   next.match.shootoutLastResult=structuredClone(
    next.match.shootout.timeline.at(-1)
   );
  }
 }
 if(!next)fail('Transition de fin de match impossible');
 return next;
}
