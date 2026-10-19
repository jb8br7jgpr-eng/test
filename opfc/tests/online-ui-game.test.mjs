import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,ready} from '../engine.mjs';
import {CARD_BY_ID} from '../catalog.mjs';
import {kickoffMatch,resolveMatchMoment,continueMatch,resumeMatch} from '../match.mjs';
import {onlineMarketPublicView} from '../online-market.mjs';
import {onlinePreMatchView} from '../online-lineup.mjs';
import {applyOnlineOpenPlayCommand} from '../online-match.mjs';
import {renderOnlineGame} from '../ui-online-game.mjs';
import {renderOnlineLobby} from '../ui-online.mjs';

const PSG=['chopper','jinbe','kaido','shanks','nami','luffy','zoro'];
const OM=['loki','mihawk','monkey-d-garp','katakuri','sabo','sanji','kizaru'];
const rng=seed=>()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);
const ui=(g,club='PSG')=>renderOnlineGame(g,{myClub:club,hostClub:'PSG'});
const command=(s,club,type,extra={})=>applyOnlineOpenPlayCommand(s,club,{type,...extra},
 {hostClub:'PSG',rng:()=>.55}).state;
function beforeMatch(){
 const s=createGame({dice:[5,2],rng:rng(1)});
 s.phase='kickoff-ready';s.auction=null;
 for(const team of s.teams){
  team.roster=[...(team.club==='PSG'?PSG:OM)];
  team.slots=[...team.roster];team.formation='2-2-2';team.ready=true;
 }
 return s;
}
function opening(kind){
 for(let seed=1;seed<1500;seed++){
  const s=kickoffMatch(beforeMatch(),rng(seed));
  if(s.match.schedule[0].type===kind)return s;
 }
 throw Error('Aucune action '+kind);
}
test('Le mercato sur deux iPhone utilise le vrai état filtré et les mêmes boutons de mise',()=>{
 const s=createGame({dice:[5,2],rng:rng(1)});
 const snapshotP=onlineMarketPublicView(s,'PSG');
 const snapshotO=onlineMarketPublicView(s,'OM');
 assert.equal(snapshotP.deck,undefined);
 assert.equal(snapshotO.deck,undefined);
 const htmlP=ui(snapshotP,'PSG'),htmlO=ui(snapshotO,'OM');
 assert.match(htmlP,/Grandline Cup · Mode en ligne/);
 assert.match(htmlP,/opfc-auction/);
 assert.match(htmlP,/portrait-card/);
 assert.match(htmlP,/MERCATO EN LIGNE/);
 assert.match(htmlP,/Meilleure offre/);
 assert.match(htmlP,/data-action="online-bid"/);
 assert.match(htmlP,/data-action="online-bid-custom"/);
 assert.match(htmlP,/data-type="pass"/);
 assert.match(htmlP,/data-type="kings"/);
 assert.match(htmlP,/data-type="observation"/);
 assert.doesNotMatch(htmlO,/data-action="online-bid"/,'Pas de contrôle d’enchère adverse');
 assert.doesNotMatch(htmlO,/data-type="pass"/);
 assert.match(htmlO,/Utiliser ton Observation/);
 assert.doesNotMatch(htmlP,/host_token|secret_key|session_token|data-token|private_state/);
 assert.equal(CARD_BY_ID.has(snapshotP.auction.cardId),true);
});
test('La révélation Observation reste uniquement sur le téléphone de son club',()=>{
 const s=createGame({dice:[5,2],rng:rng(1)});
 s.onlinePrivate={observations:{PSG:['luffy','zoro','sanji','nami','robin']}};
 const mine=ui(onlineMarketPublicView(s,'PSG'),'PSG');
 const opponent=ui(onlineMarketPublicView(s,'OM'),'OM');
 assert.match(mine,/Tes cinq révélations/);
 assert.match(mine,/Luffy/);
 assert.doesNotMatch(opponent,/Tes cinq révélations/);
 assert.doesNotMatch(opponent,/Luffy/);
});
test('Composition réseau : instructions et coup d’envoi limité à l’hôte',()=>{
 const s=beforeMatch();
 s.phase='lineup';s.teams.forEach(t=>{t.ready=false;t.slots=Array(7).fill(null);});
 let g=onlinePreMatchView(s,'PSG');
 assert.match(ui(g),/Prépare ta composition/);
 assert.doesNotMatch(ui(g),/Donner le coup d’envoi/);
 s.phase='kickoff-ready';s.teams.forEach(t=>{t.ready=true;t.slots=[...t.roster];});
 g=onlinePreMatchView(s,'PSG');
 assert.match(ui(g),/data-type="kickoff"/);
 assert.doesNotMatch(ui(g,'OM'),/data-type="kickoff"/);
});
test('Duels réseau : les choix ne sortent que sur le bon téléphone et restent secrets',()=>{
 let s=opening('open');
 s=command(s,s.match.schedule[0].attacker,'begin-open');
 const a=s.match.action,attack=a.attacker,defense=a.defender;
 const attackView=onlinePreMatchView(s,attack),defenseView=onlinePreMatchView(s,defense);
 const attackerHtml=ui(attackView,attack),defenderHtml=ui(defenseView,defense);
 assert.match(attackerHtml,/Choisis ta construction/);
 assert.match(attackerHtml,/data-action="online-choice"/);
 assert.match(attackerHtml,/data-choice="COMBINER"/);
 assert.match(attackerHtml,/PARTENAIRE POTENTIEL À LA RÉCEPTION/);
 assert.match(defenderHtml,/Au tour de/);
 assert.doesNotMatch(defenderHtml,/data-action="online-choice"/);
 assert.equal(attackView.match.action.choices,undefined);
 assert.doesNotMatch(attackerHtml,/shotDirection|keeperDirection|data-private/);
 s=command(s,attack,'choose',{choice:'COMBINER'});
 const attackWaiting=ui(onlinePreMatchView(s,attack),attack);
 const defenderTurn=ui(onlinePreMatchView(s,defense),defense);
 assert.doesNotMatch(attackWaiting,/data-action="online-choice"/);
 assert.match(defenderTurn,/Réponse défensive/);
 assert.match(defenderTurn,/data-choice="PRESSER"/);
 assert.doesNotMatch(defenderTurn,/COMBINER/);
 s=command(s,defense,'choose',{choice:'PRESSER'});
 assert.match(ui(onlinePreMatchView(s,attack),attack),/data-type="reveal-duel"/);
});
for(const kind of ['corner','free-kick','penalty']){
 test('Phase arrêtée réseau '+kind+' : bon tireur, bonnes tactiques et aucune commande adverse',()=>{
  let s=opening(kind);
  const attacker=s.match.schedule[0].attacker,defender=attacker==='PSG'?'OM':'PSG';
  s=command(s,attacker,'begin-setpiece');
  const attackerHtml=ui(onlinePreMatchView(s,attacker),attacker);
  assert.match(attackerHtml,/Choisis le tireur/);
  assert.match(attackerHtml,/data-type="select-taker"/);
  assert.match(attackerHtml,/setpiece-taker-portrait/);
  assert.doesNotMatch(ui(onlinePreMatchView(s,defender),defender),/data-type="select-taker"/);
  const taker=s.teams.find(t=>t.club===attacker).slots[5];
  s=command(s,attacker,'select-taker',{takerId:taker});
  const attack=ui(onlinePreMatchView(s,attacker),attacker);
  assert.match(attack,/data-type="choose"/);
  assert.match(attack,/data-choice=/);
  if(kind==='corner'||kind==='free-kick')assert.match(attack,/receiver-card/);
  else assert.doesNotMatch(attack,/receiver-card/);
  s=command(s,attacker,'choose',{choice:kind==='corner'?'PREMIER':kind==='free-kick'?'DIRECT':'GAUCHE'});
  assert.doesNotMatch(ui(onlinePreMatchView(s,attacker),attacker),/data-type="choose"/);
  const defense=ui(onlinePreMatchView(s,defender),defender);
  assert.match(defense,/data-type="choose"/);
  assert.match(defense,/Réponse défensive/);
 }
}
test('Réseau : mi-temps, reprise, mort subite et score final sans fuite de calendrier',()=>{
 let s=opening('open');
 while(s.phase==='match')s=continueMatch(resolveMatchMoment(s,{outcome:'stopped'}));
 assert.equal(s.phase,'half-time');
 let view=onlinePreMatchView(s,'PSG');
 let html=ui(view,'PSG');
 assert.match(html,/MI-TEMPS/);
 assert.match(html,/Ajustements tactiques/);
 assert.match(html,/Tirs cadrés/);
 assert.doesNotMatch(html,/data-type="resume"/);
 assert.equal(view.match.schedule,undefined);
 s=ready(ready(s,'PSG'),'OM');
 assert.equal(s.phase,'resume-ready');
 html=ui(onlinePreMatchView(s,'PSG'),'PSG');
 assert.match(html,/data-type="resume"/);
 assert.doesNotMatch(ui(onlinePreMatchView(s,'OM'),'OM'),/data-type="resume"/);
 s=resumeMatch(s);
 while(s.phase==='match')s=continueMatch(resolveMatchMoment(s,{outcome:'stopped'}));
 assert.equal(s.phase,'shootout-ready');
 assert.match(ui(onlinePreMatchView(s,'PSG'),'PSG'),/data-type="begin-shootout"/);
 assert.doesNotMatch(ui(onlinePreMatchView(s,'OM'),'OM'),/data-type="begin-shootout"/);
 s=command(s,'PSG','begin-shootout');
 let publicShot=onlinePreMatchView(s,'PSG');
 assert.match(ui(publicShot,'PSG'),/shootout-tracker/);
 assert.match(ui(publicShot,'PSG'),/data-shootout="true"/);
 assert.doesNotMatch(ui(publicShot,'OM'),/data-shootout="true"/);
 s=command(s,'PSG','shootout-choose',{choice:'GAUCHE'});
 publicShot=onlinePreMatchView(s,'OM');
 assert.match(ui(publicShot,'OM'),/data-shootout="true"/);
 assert.doesNotMatch(ui(onlinePreMatchView(s,'PSG'),'PSG'),/data-shootout="true"/);
 assert.equal(publicShot.match.shootout.orders,undefined);
 assert.equal(publicShot.match.shootout.keepers,undefined);
 s=command(s,'OM','shootout-choose',{choice:'DROITE'});
 assert.match(ui(onlinePreMatchView(s,'PSG'),'PSG'),/data-type="shootout-reveal"/);
});
test('Salon : la partie n’est plus annoncée comme une maquette quand les deux sont présents',()=>{
 const room={role:'host',myClub:'PSG',status:'ready',code:'ABCD23',
  opponentConnected:true};
 const html=renderOnlineLobby({stage:'room',room,configured:true,gameActive:true});
 assert.match(html,/La partie continue juste en dessous/);
 assert.doesNotMatch(html,/sera ajoutée au prochain bloc/);
});
