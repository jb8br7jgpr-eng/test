/**
 * OPFC v0.8 — bloc 10A3B1 : compositions et coup d'envoi côté serveur.
 * Jamais de paramètres de club, de calendrier ou de résultat fournis
 * par l'iPhone. Le club vient exclusivement du jeton authentifié.
 */
import {chooseFormation,place,ready} from './engine.mjs';
import {kickoffMatch,currentMatchMoment} from './match.mjs';
import {onlineMarketPublicView} from './online-market.mjs';
import {secureRandomBytes} from './online-protocol.mjs';
import {onlineMatchView} from './online-match.mjs';

const fail=m=>{throw new Error(m);};
const clubs=['PSG','OM'];
function checkClub(id){if(!clubs.includes(id))fail('Club invalide');return id;}
function secureRng(){
 const bytes=secureRandomBytes(4);
 return new DataView(bytes.buffer,bytes.byteOffset,4).getUint32(0)/4294967296;
}
function copyTeam(team){
 return {
  club:team.club,identityId:team.identityId??team.club,budget:team.budget,refusals:team.refusals,
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
  ...(state.stadiumId?{stadiumId:state.stadiumId}:{}),
  teams:state.teams.map(copyTeam),dice:[...state.dice],
  match:{
   index:m.index,minute:m.minute,competition:state.competition??null,score:{...m.score},
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
 if(state?.phase==='match'&&state.match?.index===0&&state.match?.history?.length===0&&!state.match.action)
  return onlineKickoffView(state);
 if(['match','moment-result','half-time','resume-ready','shootout-ready','shootout','finished'].includes(state?.phase))
  return onlineMatchView(state,club);
 return null;
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
  'reveal-next':['type'],
  kickoff:['type'],
  'prematch-next':['type']
 }[type];
 if(!expected||Object.keys(command).some(key=>!expected.includes(key))||
  expected.some(key=>!Object.hasOwn(command,key)))
  fail('Paramètres de composition interdits');
 if(state.phase==='lineup'&&state.recruitmentMode==='random'&&state.randomReveal?.step<7){
  if(type!=='reveal-next')fail('Termine la révélation des sept duos avant les compositions');
  const previous=state.randomReveal;
  if(!Number.isInteger(previous.step)||previous.step<0||previous.step>6||
   !previous.ready||typeof previous.ready.PSG!=='boolean'||typeof previous.ready.OM!=='boolean')
   fail('Progression du tirage invalide');
  if(previous.ready[actorClub])fail('Tu as déjà validé ce duo : attends ton adversaire');
  const next=structuredClone(state);
  next.randomReveal.ready[actorClub]=true;
  if(next.randomReveal.ready.PSG&&next.randomReveal.ready.OM){
   next.randomReveal.step++;
   next.randomReveal.ready={PSG:false,OM:false};
  }
  return {state:next,publicForActor:onlineMarketPublicView(next,actorClub)};
 }
 if(type==='reveal-next')fail('Révélation terminée');
 if(type==='prematch-next'){
  if(state.phase!=='kickoff-ready'||state.playerStatsVersion!==2||!state.stadiumId)
   fail('Présentation d’avant-match indisponible');
  if(state.prematchReady?.[actorClub]===true)fail('Présentation déjà confirmée');
  const next=structuredClone(state);
  next.prematchReady={PSG:!!state.prematchReady?.PSG,OM:!!state.prematchReady?.OM};
  next.prematchReady[actorClub]=true;
  return {state:next,publicForActor:onlineMarketPublicView(next,actorClub)};
 }
 if(type==='kickoff'){
  if(state.phase!=='kickoff-ready')fail('Les deux équipes doivent être prêtes');
  if(actorClub!==hostClub)fail('Seul l’hôte lance le coup d’envoi');
  if(state.playerStatsVersion===2&&
    (state.prematchReady?.PSG!==true||state.prematchReady?.OM!==true))
   fail('Les deux joueurs doivent confirmer la présentation d’avant-match');
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
  if(next.phase==='kickoff-ready'&&next.playerStatsVersion===2)
   next.prematchReady={PSG:false,OM:false};
 }else fail('Commande de composition inconnue');
 return {state:next,publicForActor:onlineMarketPublicView(next,actorClub)};
}
