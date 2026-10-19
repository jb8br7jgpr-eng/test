import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../engine.mjs';
import {matchPublicView} from '../match.mjs';
import {calculateOpenPlay} from '../open-play.mjs';
import {lineupDetails} from '../rules.mjs';
import {renderMatchScreen,dispatchOpenMatch,matchTurnOwner,matchRequiresPrivacy} from '../ui-match.mjs';

const PSG=['chopper','jinbe','kaido','shanks','nami','luffy','zoro'];
const OM=['loki','mihawk','monkey-d-garp','katakuri','sabo','sanji','kizaru'];
const random=seed=>()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);
function teamsReady(){
 const s=createGame({dice:[5,2],rng:random(3)});
 s.phase='kickoff-ready';s.auction=null;
 for(const t of s.teams){t.roster=[...(t.club==='PSG'?PSG:OM)];t.slots=[...t.roster];t.formation='2-2-2';t.ready=true;}
 return s;
}
function openFirst(){
 for(let seed=1;seed<=150;seed++){
  const s=dispatchOpenMatch(teamsReady(),'kickoff',{rng:random(seed)});
  if(s.match.schedule[0].type==='open')return s;
 }
 throw Error('Impossible de trouver un premier moment de jeu ouvert');
}
const prepped=()=>dispatchOpenMatch(openFirst(),'begin-open',{rng:()=>.3});
test('Le bouton du coup d’envoi utilise le vrai moteur et conserve un calendrier secret',()=>{
 const initial=teamsReady();
 assert.match(renderMatchScreen(initial),/Donner le coup d’envoi/);
 const s=dispatchOpenMatch(initial,'kickoff',{rng:random(8)});
 assert.equal(s.phase,'match');
 assert.equal(s.match.score.PSG,0);
 assert.ok(s.match.schedule.length>=10);
 assert.doesNotMatch(renderMatchScreen(s),/schedule|cursor|deck/);
 assert.equal(matchPublicView(s).match.schedule,undefined);
});
test('Affichage de match : minute, score, club qui attaque, sans score inventé',()=>{
 const s=openFirst(),out=renderMatchScreen(s);
 assert.match(out,/0 – 0/);
 assert.match(out,/e minute/);
 assert.match(out,/Commencer cette action/);
 assert.match(out,/Jeu ouvert/);
 assert.equal(s.match.history.length,0);
});
test('Les trois types de situations du moteur sont annoncés en vert, orange et rouge, avec le club attaquant',()=>{
 for(const [draw,context,grade,label] of [
  [.1,'FRANCHE','franche','OCCASION FRANCHE'],
  [.4,'BONNE','bonne','BONNE OCCASION'],
  [.9,'DIFFICILE','difficile','ACTION DIFFICILE']
 ]){
  const s=dispatchOpenMatch(openFirst(),'begin-open',{rng:()=>draw});
  assert.equal(s.match.action.context,context);
  const out=renderMatchScreen(s);
  assert.match(out,new RegExp('match-action-type type-'+grade));
  assert.ok(out.includes(label));
  assert.ok(out.includes('aria-label="Équipe attaquante : '+s.match.action.attacker+'"'));
  assert.match(out,/À L’ATTAQUE/);
  assert.match(out,/EN DÉFENSE/);
  assert.doesNotMatch(out,/data-choice=/);
  const duelist=dispatchOpenMatch(
   dispatchOpenMatch(s,'choose',{choice:'COMBINER'}),'choose',{choice:'CONTENIR'});
  const duel=renderMatchScreen(duelist);
  assert.ok(duel.includes(label),'Le contexte coloré doit persister durant le duel');
 }
});
test('Les deux portraits de duel affichent leur club, poste et note effective, sans révéler les tactiques',()=>{
 let s=prepped();
 s=dispatchOpenMatch(s,'choose',{choice:'COMBINER'});
 s=dispatchOpenMatch(s,'choose',{choice:'INTERCEPTER'});
 const out=renderMatchScreen(s),a=s.match.action;
 assert.match(out,/match-duel-ready-heading/);
 assert.match(out,/match-faceoff/);
 assert.match(out,/match-duelist-position/);
 assert.match(out,/match-duelist-rating/);
 assert.equal((out.match(/class="match-duelist /g)||[]).length,2);
 for(const [role,club] of [[a.roles.carrier,a.attacker],[a.roles.defender,a.defender]]){
  const team=s.teams.find(t=>t.club===club);
  const player=lineupDetails(team).find(p=>p?.cardId===role.cardId);
  assert.ok(player);
  assert.ok(out.includes(player.position));
  assert.ok(out.includes('NOTE '+player.rating));
 }
 assert.doesNotMatch(out,/COMBINER|INTERCEPTER/);
});
test('Transmission obligatoire en local pour une tactique secrète',()=>{
 const s=prepped();
 assert.equal(s.match.action.stage,'attack-choice');
 assert.equal(matchRequiresPrivacy(s),true);
 assert.equal(matchTurnOwner(s),s.match.action.attacker);
 const covered=renderMatchScreen(s);
 assert.match(covered,/Passe le téléphone/);
 assert.doesNotMatch(covered,/data-choice=/);
 assert.doesNotMatch(covered,/PERCER|LANCER|COMBINER/);
 const uncovered=renderMatchScreen(s,{uncovered:true});
 assert.match(uncovered,/data-choice="COMBINER"/);
 assert.match(uncovered,/Porteur/);
 assert.doesNotMatch(uncovered,/schedule/);
});
test('Après confirmation offensive : la tactique privée ne fuite pas au défenseur',()=>{
 let s=prepped();
 const attacker=s.match.action.attacker;
 s=dispatchOpenMatch(s,'choose',{choice:'COMBINER'});
 assert.equal(s.match.action.stage,'defense-choice');
 assert.notEqual(matchTurnOwner(s),attacker);
 assert.equal(s.match.action.choices.attack,'COMBINER');
 const covered=renderMatchScreen(s);
 assert.match(covered,/Passe le téléphone/);
 assert.doesNotMatch(covered,/COMBINER/);
 const defender=renderMatchScreen(s,{uncovered:true});
 assert.match(defender,/data-choice="PRESSER"/);
 assert.doesNotMatch(defender,/COMBINER/);
 s=dispatchOpenMatch(s,'choose',{choice:'CONTENIR'});
 assert.equal(s.match.action.stage,'duel-ready');
 assert.equal(matchTurnOwner(s),null);
 assert.doesNotMatch(renderMatchScreen(s),/COMBINER/);
 assert.match(renderMatchScreen(s),/Révéler et résoudre/);
});
test('Duels révélés ensemble et résultat gardé jusqu’à Continuer',()=>{
 let s=prepped();
 s=dispatchOpenMatch(s,'choose',{choice:'COMBINER'});
 s=dispatchOpenMatch(s,'choose',{choice:'CONTENIR'});
 const a=s.match.action;
 const calculation=calculateOpenPlay({...a.roles,attack:'COMBINER',defense:'CONTENIR',chemistryBonus:a.chemistryBonus});
 const chanceDraw=(calculation.foulProbability+calculation.successProbability/2)/100;
 s=dispatchOpenMatch(s,'reveal-duel',{rng:()=>chanceDraw});
 assert.equal(s.match.action.duel.outcome.outcome,'chance');
 assert.match(renderMatchScreen(s),/Occasion créée/);
 assert.match(renderMatchScreen(s),/COMBINER/);
 assert.equal(s.match.statistics.PSG.shots+s.match.statistics.OM.shots,0);
 s=dispatchOpenMatch(s,'continue-duel');
 assert.equal(s.match.action.stage,'shot-attack-choice');
 assert.equal(matchRequiresPrivacy(s),true);
 assert.match(renderMatchScreen(s),/Passe le téléphone/);
});
test('Du choix de frappe au but réel, puis bouton Continuer',()=>{
 let s=prepped();
 s=dispatchOpenMatch(s,'choose',{choice:'COMBINER'});
 s=dispatchOpenMatch(s,'choose',{choice:'CONTENIR'});
 const a=s.match.action;
 const c=calculateOpenPlay({...a.roles,attack:'COMBINER',defense:'CONTENIR',chemistryBonus:a.chemistryBonus});
 s=dispatchOpenMatch(s,'reveal-duel',{rng:()=>(c.foulProbability+c.successProbability/2)/100});
 s=dispatchOpenMatch(s,'continue-duel');
 s=dispatchOpenMatch(s,'choose',{choice:'PLACEE'});
 const keeperView=renderMatchScreen(s,{uncovered:true});
 assert.doesNotMatch(keeperView,/data-choice="PLACEE"/);
 assert.match(keeperView,/data-choice="LIGNE"/);
 s=dispatchOpenMatch(s,'choose',{choice:'LIGNE'});
 assert.match(renderMatchScreen(s),/Résoudre la frappe/);
 const scheduled=structuredClone(s.match.schedule),attacker=s.match.action.attacker;
 s=dispatchOpenMatch(s,'reveal-shot',{rng:()=>.999999});
 assert.equal(s.phase,'moment-result');
 assert.equal(s.match.score[attacker],1);
 assert.equal(s.match.history.length,1);
 assert.match(renderMatchScreen(s),/BUUUUT/);
 assert.match(renderMatchScreen(s),/Buteur/);
 assert.match(renderMatchScreen(s),/Continuer/);
 s=dispatchOpenMatch(s,'continue-result');
 assert.equal(s.match.index,1);
 assert.deepEqual(s.match.schedule,scheduled);
});
test('Faute : affiche l’attente sans insérer de séquence artificielle',()=>{
 let s=prepped();
 s=dispatchOpenMatch(s,'choose',{choice:'COMBINER'});
 s=dispatchOpenMatch(s,'choose',{choice:'PRESSER'});
 s=dispatchOpenMatch(s,'reveal-duel',{rng:()=>0});
 assert.equal(s.match.action.duel.outcome.outcome,'foul');
 s=dispatchOpenMatch(s,'continue-duel');
 assert.equal(s.match.action.stage,'set-piece-pending');
 assert.match(renderMatchScreen(s),/phase arrêtée/);
 assert.equal(s.match.history.length,0);
 assert.throws(()=>dispatchOpenMatch(s,'continue-result'),/résultat|Aucun/);
});
test('Les actions hors étape et les choix inconnus sont refusés',()=>{
 const s=prepped();
 assert.throws(()=>dispatchOpenMatch(s,'choose',{choice:'CORNER'}),/inconnu/);
 assert.throws(()=>dispatchOpenMatch(s,'reveal-shot',{rng:()=>.5}),/Étape/);
 assert.throws(()=>dispatchOpenMatch(s,'reveal-duel',{rng:()=>.5}),/Étape/);
 assert.throws(()=>dispatchOpenMatch(s,'foobar'),/inconnue/);
});
