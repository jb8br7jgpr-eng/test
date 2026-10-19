import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,ready,place,chooseFormation} from '../engine.mjs';
import {kickoffMatch,resolveMatchMoment,continueMatch,matchPublicView} from '../match.mjs';
import {nextShootoutShooter} from '../shootout.mjs';
import {dispatchOpenMatch,renderMatchScreen,matchTurnOwner,matchRequiresPrivacy} from '../ui-match.mjs';
import {renderFinalResult} from '../ui-final.mjs';
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
 s=chooseFormation(s,'PSG','3-1-2');
 const roster=[...s.teams.find(t=>t.club==='PSG').roster];
 for(let i=0;i<7;i++)s=place(s,'PSG',roster[i],i);
 s=ready(s,'PSG');html=renderMatchScreen(s);
 assert.match(html,/PSG : ✓ composition validée/);
 assert.match(html,/OM : composition à valider/);
 assert.deepEqual(s.match.schedule,calendar);
 s=ready(s,'OM');
 assert.equal(s.phase,'resume-ready');
 assert.match(renderMatchScreen(s),/Reprendre la deuxième mi-temps/);
 s=dispatchOpenMatch(s,'resume');
 assert.equal(s.phase,'match');
 assert.deepEqual(s.match.schedule,calendar);
});
test('Une victoire dans les 90 minutes affiche un résultat complet sans séance',()=>{
 const s=completeRegulation({goal:true});
 assert.equal(s.phase,'finished');assert.equal(s.match.winner,'PSG');
 const html=renderMatchScreen(s);
 assert.match(html,/Victoire de Pirates Saint-Grandline/);
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
 assert.match(renderMatchScreen(s,{uncovered:true}),/data-choice="GAUCHE"/);
 s=choose(s,'GAUCHE');
 assert.equal(matchTurnOwner(s),'OM');
 assert.equal(s.match.shootoutPending.shotDirection,'GAUCHE');
 assert.equal(matchPublicView(s).match.shootoutPending,undefined);
 const defender=renderMatchScreen(s,{uncovered:true});
 assert.match(defender,/gardien/i);
 assert.doesNotMatch(defender,/Le tireur a choisi GAUCHE/);
 s=choose(s,'DROITE');
 assert.equal(matchTurnOwner(s),null);
 assert.match(renderMatchScreen(s),/Révéler et tirer/);
 assert.equal(matchPublicView(s).match.shootoutPending,undefined);
 assert.equal(s.match.shootout.timeline.length,0);
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
