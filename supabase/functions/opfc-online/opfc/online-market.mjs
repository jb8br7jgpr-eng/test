/**
 * OPFC v0.8 — bloc 10A3A : autorité serveur du mercato.
 *
 * Le serveur déduit TOUJOURS le club du jeton de session, jamais du POST.
 * Le paquet, cursor, secrets et états internes ne sont JAMAIS envoyés.
 * La persistance concurrente (CAS sur room.version) appartient à Edge.
 */
import {bid,pass,useKings,useObservation,acceptSolo,place,chooseFormation} from './engine.mjs';
import {formationPositions} from './rules.mjs';
import {CARDS} from './catalog.mjs';

const FAIL=message=>{throw Error(message);};
const CLUBS=['PSG','OM'],ACTIONS=['bid','pass','kings','observation','solo','place','formation'];
const copy=x=>structuredClone(x);
function validateClub(club){
 if(!CLUBS.includes(club))FAIL('Club de joueur invalide');
 return club;
}
function ensureMercato(state){
 if(!state||state.version!==1||state.phase!=='mercato'||!state.auction||
  !Array.isArray(state.teams)||state.teams.length!==2||
  !Array.isArray(state.deck)||![50,65,CARDS.length].includes(state.deck.length)||
  !Number.isInteger(state.cursor)||!Array.isArray(state.history))
  FAIL('Le mercato n’est pas actif');
}
function safeCardList(ids){
 if(!Array.isArray(ids))FAIL('Liste de cartes invalide');
 return ids.map(id=>{
  if(typeof id!=='string'||id.length>80)FAIL('Identifiant de carte invalide');
  return id;
 });
}
function safeTeam(team){
 return {
  club:team.club,identityId:team.identityId??team.club,budget:team.budget,refusals:team.refusals,
  roster:safeCardList(team.roster),formation:team.formation,
  slots:[...team.slots],ready:team.ready,
  hakis:{observation:Boolean(team.hakis?.observation),kings:Boolean(team.hakis?.kings)}
 };
}
/** Liste blanche stricte, distincte de engine.publicView qui est local. */
export function onlineMarketPublicView(state,club){
 validateClub(club);
 if(!state||!['mercato','lineup','kickoff-ready'].includes(state.phase))
  FAIL('La vue de mercato est indisponible');
 if(!Array.isArray(state.teams)||state.teams.length!==2)FAIL('Équipes invalides');
 const currentAuction=state.auction;
 const known=state.onlinePrivate?.observations?.[club];
 return {
  version:state.version,phase:state.phase,
  ...(state.stadiumId?{stadiumId:state.stadiumId,competition:state.competition??'grandline'}:{}),
  ...(state.phase==='kickoff-ready'&&state.playerStatsVersion===2?
   {prematchReady:{PSG:state.prematchReady?.PSG===true,
    OM:state.prematchReady?.OM===true}}:{}),
  teams:state.teams.map(safeTeam),
  dice:[...state.dice],
  ...(state.recruitmentMode==='random'&&state.phase==='lineup'&&state.randomReveal?.step<7?
   {reveal:{step:state.randomReveal.step,ready:{PSG:!!state.randomReveal.ready.PSG,OM:!!state.randomReveal.ready.OM}}}:{}),
  auction:currentAuction?{
   cardId:currentAuction.cardId,
   priority:currentAuction.priority,turn:currentAuction.turn,
   highestBid:currentAuction.highestBid,
   highestClub:currentAuction.highestClub,
   passed:[...currentAuction.passed],offered:[...currentAuction.offered],
   king:currentAuction.king?copy(currentAuction.king):null,solo:currentAuction.solo
  }:null,
  lastResult:state.lastResult?{
   cardId:state.lastResult.cardId,winner:state.lastResult.winner,
   price:state.lastResult.price,reason:state.lastResult.reason
  }:null,
  // Révélations persistées dans l'état privé, fournies UNIQUEMENT à leur club.
  myObservation:known?safeCardList(known):null
 };
}
/** Mutation pure : même fonctions que le mode local. Ne renvoie jamais le deck.
 * Réservé au serveur authentifié; l'acteur ne peut pas imposer actorClub.
 */
export function applyOnlineMarketCommand(state,actorClub,command){
 ensureMercato(state);
 validateClub(actorClub);
 if(!command||typeof command!=='object'||Array.isArray(command))
  FAIL('Commande de mercato invalide');
 const type=command.type;
 if(!ACTIONS.includes(type))FAIL('Commande de mercato inconnue');
 // Aucun argument supplémentaire n'est accepté pour empêcher les commandes
 // déguisées et décourager tout stockage arbitraire via le client.
 const allowed=type==='bid'?['type','amount']:
   type==='place'?['type','cardId','slot']:
   type==='formation'?['type','formation']:['type'];
 if(Object.keys(command).some(k=>!allowed.includes(k)))
  FAIL('Paramètre de mercato interdit');
 const before=state;
 const pending=before.teams.find(t=>t.roster.some(id=>!t.slots.includes(id)));
 if(pending&&type!=='place')
  FAIL('Place d’abord la recrue de '+pending.club+' avant de poursuivre les enchères');
 let next;
 if(type==='place'){
  if(typeof command.cardId!=='string'||command.cardId.length>80||
    !Number.isInteger(command.slot)||command.slot<0||command.slot>6)
   FAIL('Placement de recrue invalide');
  const team=before.teams.find(t=>t.club===actorClub);
  if(!team?.roster.includes(command.cardId))FAIL('Cette recrue ne fait pas partie de ton club');
  // Un recrutement en attente doit être placé en priorité comme en local.
  if(pending&&(!pending.roster.includes(command.cardId)||
    pending.slots.includes(command.cardId)||pending.club!==actorClub))
   FAIL('Place d’abord ta nouvelle recrue');
  next=place(before,actorClub,command.cardId,command.slot);
 }else if(type==='formation'){
  if(typeof command.formation!=='string'||command.formation.length>12)
   FAIL('Formation invalide');
  formationPositions(command.formation);
  next=chooseFormation(before,actorClub,command.formation);
 }else if(type==='bid'){
  if(!Number.isSafeInteger(command.amount))FAIL('Montant d’enchère invalide');
  next=bid(before,actorClub,command.amount);
 }else if(type==='pass')next=pass(before,actorClub);
 else if(type==='kings')next=useKings(before,actorClub);
 else if(type==='solo')next=acceptSolo(before,actorClub);
 else{
  const result=useObservation(before,actorClub);
  next=result.state;
  // Les cartes privées appartiennent au club ayant utilisé son Haki.
  next.onlinePrivate??={observations:{}};
  next.onlinePrivate.observations??={};
  next.onlinePrivate.observations[actorClub]=safeCardList(result.peek);
 }
 return {
  state:next,
  publicForActor:onlineMarketPublicView(next,actorClub)
 };
}
/** Avant toute mutation, le serveur peut vérifier l'état du tour pour
 * la requête donnée, mais les fonctions moteur restent source de vérité. */
export function marketCommandActor(state,command){
 ensureMercato(state);
 const type=command?.type;
 if(type==='bid'||type==='pass'||type==='kings'||type==='solo')
  return state.auction.turn;
 if(['observation','place','formation'].includes(type))return null; // Le serveur valide la propriété du club.
 FAIL('Commande de mercato inconnue');
}
