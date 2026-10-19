import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,ready} from '../engine.mjs';
import {kickoffMatch,resolveMatchMoment,continueMatch,resumeMatch,beginShootout,advanceShootout} from '../match.mjs';
import {beginOpenPlayAction,lockOpenPlayChoice} from '../match-actions.mjs';
import {beginSetPieceAction,selectSetPieceTaker,lockSetPieceChoice} from '../set-piece-actions.mjs';
import {onlineMarketPublicView} from '../online-market.mjs';
import {onlinePreMatchView} from '../online-lineup.mjs';
import {onlineMatchView} from '../online-match.mjs';
import {renderOnlineGame} from '../ui-online-game.mjs';

const PSG=['chopper','jinbe','kaido','shanks','nami','luffy','zoro'];
const OM=['loki','mihawk','monkey-d-garp','katakuri','sabo','sanji','kizaru'];
const rng=seed=>()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);
const view=(state,club)=>state.phase==='mercato'?onlineMarketPublicView(state,club):
 onlinePreMatchView(state,club);
const ui=(state,club)=>renderOnlineGame(view(state,club),{myClub:club,hostClub:'PSG'});
function prepared(){
 const s=createGame({dice:[5,2],rng:rng(8)});
 s.phase='kickoff-ready';s.auction=null;
 for(const t of s.teams){t.roster=[...(t.club==='PSG'?PSG:OM)];
  t.slots=[...t.roster];t.ready=true;t.formation='2-2-2';}
 return s;
}
function started(type='open'){
 for(let i=1;i<2500;i++){
  const s=kickoffMatch(prepared(),rng(i));
  if(s.match.schedule[0].type===type)return s;
 }
 throw Error('Événement absent '+type);
}
function halftime(){
 let s=started();
 while(s.phase==='match')s=continueMatch(resolveMatchMoment(s,{outcome:'stopped'}));
 assert.equal(s.phase,'half-time');
 return s;
}
function shootoutReady(){
 let s=halftime();
 s=resumeMatch(ready(ready(s,'PSG'),'OM'));
 while(s.phase==='match')s=continueMatch(resolveMatchMoment(s,{outcome:'stopped'}));
 assert.equal(s.phase,'shootout-ready');
 return s;
}
test('L’interface de mercato en ligne montre le catalogue sans jamais le paquet caché',()=>{
 const master=createGame({dice:[5,2],rng:rng(3)});
 const current=master.auction.turn,other=current==='PSG'?'OM':'PSG';
 const own=ui(master,current),opponent=ui(master,other);
 assert.match(own,/opfc-auction-stage online-market/);
 assert.match(own,/data-action="online-bid"/);
 assert.match(own,/data-type="pass"/);
 assert.match(own,/data-type="observation"/);
 assert.match(opponent,/décide de sa prochaine enchère/);
 assert.doesNotMatch(opponent,/data-action="online-bid"/);
 assert.doesNotMatch(opponent,/data-type="pass"/);
 assert.doesNotMatch(own,/deck|cursor|onlinePrivate|sessionToken/);
 assert.doesNotMatch(opponent,/deck|cursor|onlinePrivate|sessionToken/);
 assert.equal(master.auction.cardId,view(master,current).auction.cardId);
});
test('Compositions synchronisées : chaque équipe attend la validation de ses joueurs',()=>{
 const master=prepared();master.phase='lineup';
 master.teams[0].ready=false;master.teams[1].ready=false;
 for(const club of ['PSG','OM']){
  const html=ui(master,club);
  assert.match(html,/Prépare ta composition/);
  assert.doesNotMatch(html,/data-action="online-game"/);
  assert.doesNotMatch(html,/deck|schedule/);
 }
 master.phase='kickoff-ready';master.teams.forEach(t=>t.ready=true);
 const host=ui(master,'PSG'),guest=ui(master,'OM');
 assert.match(host,/data-type="kickoff"/);
 assert.doesNotMatch(guest,/data-type="kickoff"/);
 assert.match(guest,/Au tour de PSG/);
});
test('Jeu ouvert réseau : tactiques uniquement du club acteur et directions secrètes',()=>{
 let s=beginOpenPlayAction(started('open'),()=>.4);
 const attacker=s.match.action.attacker,defender=s.match.action.defender;
 const first=ui(s,attacker),other=ui(s,defender);
 assert.match(first,/data-action="online-choice"/);
 assert.match(first,/data-choice="COMBINER"/);
 assert.match(first,/PARTENAIRE POTENTIEL À LA RÉCEPTION/);
 assert.doesNotMatch(other,/data-choice=/);
 assert.match(other,/Au tour de/);
 s=lockOpenPlayChoice(s,attacker,'COMBINER');
 const defense=ui(s,defender),waiting=ui(s,attacker);
 assert.match(defense,/data-choice="INTERCEPTER"/);
 assert.doesNotMatch(defense,/data-choice="COMBINER"/);
 assert.doesNotMatch(waiting,/data-choice=/);
 assert.doesNotMatch(defense,/schedule|chemistryBonus|shotDirection|private_state/);
 s=lockOpenPlayChoice(s,defender,'CONTENIR');
 const reveal=ui(s,attacker);
 assert.match(reveal,/data-type="reveal-duel"/);
 assert.doesNotMatch(ui(s,defender),/data-type="reveal-duel"/);
});
test('Phases arrêtées : tireur puis zones secrètes avec boutons envoyés à Edge',()=>{
 for(const type of ['corner','free-kick','penalty']){
  let s=beginSetPieceAction(started(type));
  const attacker=s.match.action.attacker,defender=s.match.action.defender;
  const pick=ui(s,attacker);
  assert.match(pick,/data-type="select-taker"/);
  assert.equal((pick.match(/data-action="online-game" data-type="select-taker"/g)||[]).length,7);
  assert.doesNotMatch(ui(s,defender),/data-type="select-taker"/);
  const taker=s.teams.find(t=>t.club===attacker).slots[5];
  s=selectSetPieceTaker(s,attacker,taker,()=>.25);
  assert.match(ui(s,attacker),/data-type="choose"/);
  if(type!=='penalty')assert.match(ui(s,attacker),/receiver-card/);
  assert.doesNotMatch(ui(s,defender),/data-type="choose"/);
  const strategy=type==='corner'?'PREMIER':type==='free-kick'?'CENTRE':'GAUCHE';
  s=lockSetPieceChoice(s,attacker,strategy);
  assert.match(ui(s,defender),/data-type="choose"/);
  assert.doesNotMatch(ui(s,attacker),/data-type="choose"/);
  assert.doesNotMatch(ui(s,defender),/shotDirection|keeperDirection|private_state/);
 }
});
test('Mi-temps réseau : état des équipes, chiffres exacts et reprise réservée à l’hôte',()=>{
 let s=halftime();
 assert.match(ui(s,'PSG'),/MI-TEMPS/);
 assert.match(ui(s,'OM'),/halftime-stats/);
 assert.doesNotMatch(ui(s,'OM'),/data-type="resume"/);
 s=ready(s,'PSG');
 assert.match(ui(s,'OM'),/PSG : prêt/);
 assert.doesNotMatch(ui(s,'PSG'),/data-type="resume"/);
 s=ready(s,'OM');
 assert.equal(s.phase,'resume-ready');
 assert.match(ui(s,'PSG'),/data-type="resume"/);
 assert.doesNotMatch(ui(s,'OM'),/data-type="resume"/);
});
test('TAB réseau : 5 cases, mort subite et résultat final protégé jusqu’à validation',()=>{
 let s=beginShootout(shootoutReady(),.1);
 s.match.shootoutPending=null;
 s.match.shootoutLastResult=null;
 const first=ui(s,'PSG'),second=ui(s,'OM');
 assert.equal((first.match(/shootout-mark--pending/g)||[]).length,10);
 assert.match(first,/data-shootout="true"/);
 assert.doesNotMatch(second,/data-shootout="true"/);
 const p=s.match.shootout.nextClub;
 s.match.shootoutPending={club:p,shooterId:s.match.shootout.orders[p][0].cardId,
  shotDirection:'GAUCHE',keeperDirection:null};
 const keeper=ui(s,'OM');
 assert.match(keeper,/data-shootout="true"/);
 assert.doesNotMatch(keeper,/shotDirection|keeperDirection|probabilities|orders/);
 s.match.shootoutPending.keeperDirection='DROITE';
 assert.match(ui(s,'PSG'),/data-type="shootout-reveal"/);
 assert.doesNotMatch(ui(s,'OM'),/data-type="shootout-reveal"/);
 let finished=null;
 for(let i=0;i<12;i++){
  const club=s.match.shootout.nextClub;
  const shooter=s.match.shootout.orders[club][s.match.shootout.attempts[club].length%7];
  s=advanceShootout(s,{club,shooterId:shooter.cardId,shotDirection:'GAUCHE',
   keeperDirection:'DROITE',draw:i===10?0:.999999});
  const last=s.match.shootout.timeline.at(-1);
  s.match.shootoutPending=null;s.match.shootoutLastResult=last;
  if(i===11){finished=structuredClone(s);break;}
  s.match.shootoutLastResult=null;
 }
 assert.equal(finished.phase,'finished');
 const finalShot=ui(finished,'OM');
 assert.match(finalShot,/data-type="shootout-continue"/);
 assert.doesNotMatch(finalShot,/class="final-screen"/);
 finished.match.shootoutLastResult=null;
 const final=ui(finished,'PSG');
 assert.match(final,/class="final-screen"/);
 assert.match(final,/final-penalty-score/);
 assert.match(final,/Score à 90 minutes/);
 assert.match(final,/5 – 6/);
 assert.doesNotMatch(final,/probabilities|orders|service_role|deck/);
});
