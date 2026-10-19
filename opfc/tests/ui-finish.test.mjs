import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,ready,place,chooseFormation} from '../engine.mjs';
import {kickoffMatch,resolveMatchMoment,continueMatch,matchPublicView} from '../match.mjs';
import {nextShootoutShooter} from '../shootout.mjs';
import {dispatchOpenMatch,renderMatchScreen,matchTurnOwner,matchRequiresPrivacy} from '../ui-match.mjs';
import {renderFinalResult} from '../ui-final.mjs';
import {renderShootoutTracker} from '../ui-shootout.mjs';
const PSG=['chopper','jinbe','kaido','shanks','nami','luffy','zoro'];
const OM=['loki','mihawk','monkey-d-garp','katakuri','sabo','sanji','kizaru'];
const rng=seed=>()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);
function start(seed=4){
 const s=createGame({dice:[5,2],rng:rng(1)});s.auction=null;s.phase='kickoff-ready';
 for(const t of s.teams){t.roster=[...(t.club==='PSG'?PSG:OM)];t.slots=[...t.roster];t.formation='2-2-2';t.ready=true;}
 return kickoffMatch(s,rng(seed));
}
function halfTime(s){
 for(let i=0;i<20;i++){
  if(s.phase==='half-time')return s;
  assert.equal(s.phase,'match');
  s=continueMatch(resolveMatchMoment(s,{outcome:'stopped'}));
 }
 throw Error('Mi-temps introuvable');
}
function resumes(s){
 for(const club of ['PSG','OM'])s=ready(s,club);
 assert.equal(s.phase,'resume-ready');
 return dispatchOpenMatch(s,'resume');
}
function completeRegulation({goal=false}={}){
 let s=start();
 s=halfTime(s);
 s=resumes(s);
 let scored=false;
 while(s.phase==='match'){
  const e=s.match.schedule[s.match.index],canScore=goal&&!scored&&e.attacker==='PSG';
  s=resolveMatchMoment(s,{outcome:canScore?'goal':'stopped',scorerId:canScore?'luffy':null});
  scored ||=canScore;
  s=continueMatch(s);
 }
 return s;
}
const choose=(s,direction)=>dispatchOpenMatch(s,'shootout-choose',{choice:direction});
const reveal=(s,draw)=>dispatchOpenMatch(s,'shootout-reveal',{rng:()=>draw});
const next=(s)=>dispatchOpenMatch(s,'shootout-continue');
function kick(s,draw){
 const p=nextShootoutShooter(s.match.shootout);
 assert.ok(p);
 s=choose(s,'GAUCHE');
 s=choose(s,'GAUCHE');
 s=reveal(s,draw);
 assert.equal(s.match.shootoutLastResult.shooterId,p.cardId);
 return next(s);
}
test('Mi-temps : affichage à 45 minutes et état prêt des deux équipes',()=>{
 let s=halfTime(start(2));
 const calendar=structuredClone(s.match.schedule);
 let html=renderMatchScreen(s);
 assert.match(html,/Mi-temps · 45e minute/);
 assert.match(html,/composition à valider/g);
 assert.match(html,/⏸️ MI-TEMPS/);
 assert.match(html,/halftime-screen/);
 assert.match(html,/Bilan de la première période/);
 for(const stat of ['Tirs','Tirs cadrés','Arrêts'])assert.match(html,new RegExp(stat));
 assert.match(html,/Ajustements tactiques/);
 assert.equal((html.match(/class="halftime-stat-row"/g)||[]).length,3);
 assert.doesNotMatch(html,/data-action="match-resume"/);
 s=chooseFormation(s,'PSG','3-1-2');
 const roster=[...s.teams.find(t=>t.club==='PSG').roster];
 for(let i=0;i<7;i++)s=place(s,'PSG',roster[i],i);
 s=ready(s,'PSG');html=renderMatchScreen(s);
 assert.match(html,/<strong>PSG<\/strong> : ✓ composition validée/);
 assert.match(html,/<strong>OM<\/strong> : composition à valider/);
 assert.deepEqual(s.match.schedule,calendar);
 s=ready(s,'OM');
 assert.equal(s.phase,'resume-ready');
 const viewReady=renderMatchScreen(s);
 assert.match(viewReady,/Reprendre la deuxième mi-temps/);
 assert.match(viewReady,/halftime-stats/);
 assert.equal((viewReady.match(/is-ready/g)||[]).length,2);
 assert.equal((viewReady.match(/data-action="match-resume"/g)||[]).length,1);
 s=dispatchOpenMatch(s,'resume');
 assert.equal(s.phase,'match');
 assert.deepEqual(s.match.schedule,calendar);
});
test('Le bilan de la mi-temps affiche le score et les statistiques réels, sans inventer de tirs',()=>{
 let s=start(2);
 const first=s.match.schedule[0],attacker=first.attacker;
 const scorer=s.teams.find(t=>t.club===attacker).slots[5];
 s=resolveMatchMoment(s,{outcome:'goal',scorerId:scorer});
 s=continueMatch(s);
 s=halfTime(s);
 const html=renderMatchScreen(s);
 assert.equal(s.match.score[attacker],1);
 assert.ok(html.includes(s.match.score.PSG+' – '+s.match.score.OM));
 const stats=s.match.statistics;
 for(const [label,key] of [['Tirs','shots'],['Tirs cadrés','onTarget'],['Arrêts','saves']]){
  assert.ok(html.includes('<strong>'+stats.PSG[key]+'</strong><span>'+label+'</span><strong>'+
   stats.OM[key]+'</strong>'),'Bilan incorrect : '+label);
 }
 assert.doesNotMatch(html,/schedule|duel\.choice|shooutPending/);
});
test('Une victoire dans les 90 minutes affiche un résultat complet sans séance',()=>{
 const s=completeRegulation({goal:true});
 assert.equal(s.phase,'finished');assert.equal(s.match.winner,'PSG');
 const html=renderMatchScreen(s);
 assert.match(html,/Victoire de Pirates Saint-Grandline/);
 assert.match(html,/🏆 VICTOIRE !|🏆<\/div><h2 class="final-victory-title">VICTOIRE !/);
 assert.match(html,/Score à 90 minutes/);
 assert.doesNotMatch(html,/class="final-penalty-score"/);
 assert.match(html,/1 – 0/);
 assert.match(html,/Luffy/);
 assert.match(html,/Buteurs du match/);
 for(const label of ['Tirs','Tirs cadrés','Arrêts','Séquences offensives'])assert.match(html,new RegExp(label));
 assert.match(html,/final-portrait/);
 assert.doesNotMatch(html,/Historique des tentatives/);
 assert.equal(renderFinalResult(s),html);
});
test('Égalité à 90 : lancer de pièce, le score de séance est séparé',()=>{
 const s=completeRegulation();
 assert.equal(s.phase,'shootout-ready');assert.deepEqual(s.match.score,{PSG:0,OM:0});
 assert.match(renderMatchScreen(s),/Lancer la pièce/);
 const next=dispatchOpenMatch(s,'begin-shootout',{rng:()=>.1});
 assert.equal(next.phase,'shootout');
 assert.equal(next.match.shootout.firstClub,'PSG');
 assert.deepEqual(next.match.shootout.score,{PSG:0,OM:0});
 assert.deepEqual(next.match.score,{PSG:0,OM:0});
 assert.match(renderMatchScreen(next),/Cinq tirs initiaux/);
});
test('Confidentialité : l’attaquant confirme sa direction, elle ne fuit pas au gardien',()=>{
 let s=dispatchOpenMatch(completeRegulation(),'begin-shootout',{rng:()=>.1});
 const owner=matchTurnOwner(s);
 assert.equal(owner,'PSG');
 assert.equal(matchRequiresPrivacy(s),true);
 assert.match(renderMatchScreen(s),/Passe le téléphone/);
 assert.doesNotMatch(renderMatchScreen(s),/data-action="match-shootout-choose"/);
 const shooterScreen=renderMatchScreen(s,{uncovered:true});
 assert.match(shooterScreen,/data-choice="GAUCHE"/);
 assert.match(shooterScreen,/match-tactical-choices/);
 assert.equal((shooterScreen.match(/class="match-duelist /g)||[]).length,2);
 assert.match(shooterScreen,/match-shot-faceoff/);
 s=choose(s,'GAUCHE');
 assert.equal(matchTurnOwner(s),'OM');
 assert.equal(s.match.shootoutPending.shotDirection,'GAUCHE');
 assert.equal(matchPublicView(s).match.shootoutPending,undefined);
 const defender=renderMatchScreen(s,{uncovered:true});
 assert.match(defender,/gardien/i);
 assert.match(defender,/match-tactical-choices/);
 assert.equal((defender.match(/class="match-duelist /g)||[]).length,2);
 assert.doesNotMatch(defender,/Le tireur a choisi GAUCHE/);
 s=choose(s,'DROITE');
 assert.equal(matchTurnOwner(s),null);
 assert.match(renderMatchScreen(s),/Révéler et tirer/);
 assert.match(renderMatchScreen(s),/match-shot-faceoff/);
 assert.equal(matchPublicView(s).match.shootoutPending,undefined);
 assert.equal(s.match.shootout.timeline.length,0);
});
test('Suivi visuel TAB : cinq cases par équipe, progression réelle et confidentialité',()=>{
 let s=dispatchOpenMatch(completeRegulation(),'begin-shootout',{rng:()=>.1});
 const empty=renderShootoutTracker(s.match.shootout);
 assert.match(empty,/1re série de tirs/);
 assert.match(empty,/Cinq tirs initiaux/);
 assert.equal((empty.match(/shootout-mark--pending/g)||[]).length,10);
 assert.equal((empty.match(/shootout-mark--goal/g)||[]).length,0);
 assert.equal((empty.match(/shootout-mark--fail/g)||[]).length,0);
 assert.match(empty,/0<\/span><\/div>/);
 assert.doesNotMatch(empty,/shotDirection|keeperDirection|probabilities|sudden-death/);
 const before=structuredClone(s.match.shootout);
 const covered=renderMatchScreen(s);
 assert.match(covered,/class="panel shootout-tracker"/);
 assert.doesNotMatch(covered,/data-choice="GAUCHE"/);
 assert.deepEqual(s.match.shootout,before,'Le rendu doit rester purement cosmétique');
 s=kick(s,.999999);
 const first=renderShootoutTracker(s.match.shootout);
 assert.equal((first.match(/shootout-mark--goal/g)||[]).length,1);
 assert.equal((first.match(/shootout-mark--pending/g)||[]).length,9);
 assert.match(first,/PSG, tir 1 : But/);
 assert.match(first,/OM, tir 1 : À venir/);
 assert.match(first,/1re série de tirs/);
 s=kick(s,0);
 const second=renderShootoutTracker(s.match.shootout);
 assert.match(second,/2e série de tirs/);
 assert.equal((second.match(/shootout-mark--goal/g)||[]).length,1);
 assert.equal((second.match(/shootout-mark--fail/g)||[]).length,1);
 assert.equal((second.match(/shootout-mark--pending/g)||[]).length,8);
 assert.match(second,/OM, tir 1 : (Arrêt|Tir manqué)/);
});

test('Fin anticipée de séance : conserver les cases non tirées, sans faux échecs',()=>{
 let s=dispatchOpenMatch(completeRegulation(),'begin-shootout',{rng:()=>.1});
 for(const draw of [.999999,0,.999999,0,.999999,0])s=kick(s,draw);
 assert.equal(s.phase,'finished');
 assert.deepEqual(s.match.shootout.score,{PSG:3,OM:0});
 const board=renderShootoutTracker(s.match.shootout);
 assert.equal((board.match(/shootout-mark--goal/g)||[]).length,3);
 assert.equal((board.match(/shootout-mark--fail/g)||[]).length,3);
 assert.equal((board.match(/shootout-mark--pending/g)||[]).length,4);
 assert.match(board,/Non tiré/);
 assert.doesNotMatch(board,/MORT SUBITE/);
 assert.match(renderFinalResult(s),/3 – 0/);
});

test('Mort subite : colonnes symétriques, tentatives supplémentaires et deux scores finaux distincts',()=>{
 let s=dispatchOpenMatch(completeRegulation(),'begin-shootout',{rng:()=>.1});
 for(let i=0;i<10;i++)s=kick(s,.999999);
 const board=renderShootoutTracker(s.match.shootout);
 assert.match(board,/MORT SUBITE/);
 assert.equal((board.match(/shootout-mark--goal/g)||[]).length,10);
 assert.equal((board.match(/shootout-mark--pending/g)||[]).length,0);
 s=kick(s,0);
 const newRound=renderShootoutTracker(s.match.shootout);
 assert.equal((newRound.match(/class="shootout-mark /g)||[]).length,12);
 assert.equal((newRound.match(/shootout-marks-divider/g)||[]).length,2);
 assert.equal((newRound.match(/shootout-mark--pending/g)||[]).length,1);
 s=kick(s,.999999);
 assert.equal(s.phase,'finished');
 const final=renderFinalResult(s);
 assert.match(final,/🏆/);
 assert.match(final,/VICTOIRE !/);
 assert.match(final,/Victoire de Olympique de MaryGeoise/);
 assert.match(final,/class="final-score-numbers"/);
 assert.match(final,/Score à 90 minutes/);
 assert.match(final,/0 – 0/);
 assert.match(final,/class="final-penalty-score"/);
 assert.match(final,/5 – 6/);
 assert.match(final,/Vainqueur aux tirs au but/);
 assert.match(final,/Historique des tentatives|final-kicks/);
 assert.equal((final.match(/class="final-kick"/g)||[]).length,12);
 const visible=renderMatchScreen(s);
 assert.equal(visible,final);
});

test('Une séance garde le résultat jusqu’à Continuer et reprend sur le bon joueur',()=>{
 let s=dispatchOpenMatch(completeRegulation(),'begin-shootout',{rng:()=>.1});
 s=choose(s,'GAUCHE');s=choose(s,'DROITE');
 s=reveal(s,.999999);
 assert.equal(s.match.shootout.score.PSG,1);
 assert.equal(s.match.score.PSG,0);
 assert.equal(s.match.shootout.timeline.length,1);
 assert.match(renderMatchScreen(s),/BUUUUT !/);
 assert.match(renderMatchScreen(s),/shot-result-goal/);
 assert.match(renderMatchScreen(s),/shot-result-portrait/);
 assert.match(renderMatchScreen(s),/Continuer/);
 assert.equal(matchTurnOwner(s),null);
 assert.throws(()=>choose(s,'CENTRE'),/Valide le résultat/);
 s=next(s);
 assert.equal(s.match.shootoutLastResult,null);
 assert.equal(matchTurnOwner(s),'OM');
 assert.match(renderMatchScreen(s),/Passe le téléphone/);
});
test('Mort subite : cinq buts chacun puis départage, affichage du vainqueur et historique',()=>{
 let s=dispatchOpenMatch(completeRegulation(),'begin-shootout',{rng:()=>.1});
 for(let i=0;i<10;i++)s=kick(s,.999999);
 assert.equal(s.phase,'shootout');assert.equal(s.match.shootout.stage,'sudden-death');
 assert.deepEqual(s.match.shootout.score,{PSG:5,OM:5});
 assert.match(renderMatchScreen(s),/Mort subite/);
 s=kick(s,0); // PSG rate son sixième tir
 assert.equal(s.phase,'shootout');
 s=kick(s,.999999); // OM gagne
 assert.equal(s.phase,'finished');assert.equal(s.match.winner,'OM');
 assert.equal(s.match.victory,'shootout');
 assert.deepEqual(s.match.shootout.score,{PSG:5,OM:6});
 assert.deepEqual(s.match.score,{PSG:0,OM:0});
 assert.equal(s.match.shootout.timeline.length,12);
 const html=renderMatchScreen(s);
 assert.match(html,/Victoire de Olympique de MaryGeoise/);
 assert.match(html,/Vainqueur aux tirs au but/);
 assert.match(html,/Historique des tentatives|final-kicks/);
 assert.match(html,/PSG <strong>5 – 6<\/strong> OM/);
 assert.match(html,/Tirs cadrés/);
});
test('Dernier tir de la séance reste affiché avant l’écran final',()=>{
 let s=dispatchOpenMatch(completeRegulation(),'begin-shootout',{rng:()=>.1});
 for(let i=0;i<10;i++)s=kick(s,.999999);
 s=kick(s,0);
 const p=nextShootoutShooter(s.match.shootout);
 s=choose(s,'GAUCHE');s=choose(s,'GAUCHE');s=reveal(s,.999999);
 assert.equal(s.phase,'finished');
 assert.equal(s.match.shootoutLastResult.shooterId,p.cardId);
 assert.match(renderMatchScreen(s),/Voir le résultat final/);
 assert.doesNotMatch(renderMatchScreen(s),/Victoire de Olympique de MaryGeoise/);
 s=next(s);
 assert.match(renderMatchScreen(s),/Victoire de Olympique de MaryGeoise/);
});
test('Refus des directions invalides, des séquences sautées et des doubles validations',()=>{
 let s=dispatchOpenMatch(completeRegulation(),'begin-shootout',{rng:()=>.1});
 assert.throws(()=>reveal(s,.5),/Deux choix/);
 assert.throws(()=>choose(s,'HAUT'),/Direction/);
 s=choose(s,'CENTRE');
 assert.throws(()=>reveal(s,.5),/Deux choix/);
 s=choose(s,'DROITE');
 assert.throws(()=>choose(s,'GAUCHE'),/déjà choisies/);
 const before=JSON.stringify(s.match.shootout);
 assert.throws(()=>dispatchOpenMatch(s,'begin-shootout',{rng:()=>.1}),/Départage/);
 assert.equal(JSON.stringify(s.match.shootout),before);
});
