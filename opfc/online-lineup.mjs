/**
 * OPFC v0.8 — bloc 10A3B1 : compositions et coup d'envoi côté serveur.
 * Jamais de paramètres de club, de calendrier ou de résultat fournis
 * par l'iPhone. Le club vient exclusivement du jeton authentifié.
 */
import {chooseFormation,place,ready} from './engine.mjs';
import {kickoffMatch,currentMatchMoment} from './match.mjs';
import {onlineMarketPublicView} from './online-market.mjs';
import {secureRandomBytes} from './online-protocol.mjs';

const fail=m=>{throw new Error(m);};
const clubs=['PSG','OM'];
function checkClub(id){if(!clubs.includes(id))fail('Club invalide');return id;}
function secureRng(){
 const bytes=secureRandomBytes(4);
 return new DataView(bytes.buffer,bytes.byteOffset,4).getUint32(0)/4294967296;
}
function copyTeam(team){
 return {
  club:team.club,budget:team.budget,refusals:team.refusals,
  roster:[...team.roster],formation:team.formation,
  slots:[...team.slots],ready:team.ready,
  hakis:{observation:!!team.hakis.observation,kings:!!team.hakis.kings}
 };
}
/** Une vue minimale du match nouvellement démarré.
 * Ni deck, ni cursor, ni historique privé, ni calendrier complet. */
export function onlineKickoffView(state){
 if(state?.phase!=='match'||!state.match)fail('Coup d’envoi non effectué');
 const m=state.match;
 if(m.index!==0||m.history.length!==0||m.action)fail('Match déjà engagé');
 return {
  version:state.version,phase:'match',
  teams:state.teams.map(copyTeam),dice:[...state.dice],
  match:{
   index:m.index,minute:m.minute,score:{...m.score},
   statistics:structuredClone(m.statistics),
   goals:[],currentMoment:currentMatchMoment(state)
  }
 };
}
/** Projection par joueur. Utilisée aussi dans GET après reconnexion. */
export function onlinePreMatchView(state,club){
 checkClub(club);
 if(['mercato','lineup','kickoff-ready'].includes(state?.phase))
  return onlineMarketPublicView(state,club);
 if(state?.phase==='match'&&state.match?.index===0&&state.match?.history?.length===0)
  return onlineKickoffView(state);
 return null; // Prochains sous-blocs du match.
}
export function applyOnlineLineupCommand(state,actorClub,command,{hostClub,rng=secureRng}={}){
 checkClub(actorClub);checkClub(hostClub);
 if(!state||!['lineup','kickoff-ready'].includes(state.phase))
  fail('Phase de composition indisponible');
 if(!command||typeof command!=='object'||Array.isArray(command))
  fail('Commande de composition invalide');
 const type=command.type;
 const expected={
  formation:['type','formation'],
  place:['type','cardId','slot'],
  ready:['type'],
  kickoff:['type']
 }[type];
 if(!expected||Object.keys(command).some(key=>!expected.includes(key))||
  expected.some(key=>!Object.hasOwn(command,key)))
  fail('Paramètres de composition interdits');
 if(type==='kickoff'){
  if(state.phase!=='kickoff-ready')fail('Les deux équipes doivent être prêtes');
  if(actorClub!==hostClub)fail('Seul l’hôte lance le coup d’envoi');
  const next=kickoffMatch(state,rng);
  return {state:next,publicForActor:onlineKickoffView(next)};
 }
 if(state.phase!=='lineup')fail('Les compositions sont verrouillées');
 const team=state.teams.find(t=>t.club===actorClub);
 if(!team)fail('Club absent de la partie');
 if(team.ready)fail('Équipe déjà validée : composition verrouillée');
 let next;
 if(type==='formation'){
  if(typeof command.formation!=='string'||command.formation.length>12)
   fail('Formation invalide');
  next=chooseFormation(state,actorClub,command.formation);
 }else if(type==='place'){
  if(typeof command.cardId!=='string'||command.cardId.length>80||
   !Number.isInteger(command.slot)||command.slot<0||command.slot>6)
   fail('Placement invalide');
  next=place(state,actorClub,command.cardId,command.slot);
 }else if(type==='ready'){
  next=ready(state,actorClub);
 }else fail('Commande de composition inconnue');
 return {state:next,publicForActor:onlineMarketPublicView(next,actorClub)};
}
