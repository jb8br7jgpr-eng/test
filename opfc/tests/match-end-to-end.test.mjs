/**
 * OPFC v0.8 — bloc 8C : essais d'intégration du jeu complet, en
 * faisant réellement passer les décisions par les moteurs validés.
 * Pas de but/résultat injecté artificiellement dans resolveMatchMoment.
 * Ni interface ni communication réseau : c'est la validation du moteur pur.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,bid,pass,acceptSolo,place,chooseFormation,ready} from '../engine.mjs';
import {FORMATIONS} from '../rules.mjs';
import {kickoffMatch,currentMatchMoment,continueMatch,resumeMatch,
 beginShootout,advanceShootout,matchPublicView} from '../match.mjs';
import {beginOpenPlayAction,lockOpenPlayChoice,revealOpenPlayDuel,
 continueOpenPlayDuel,revealOpenPlayShot} from '../match-actions.mjs';
import {beginSetPieceAction,selectSetPieceTaker,lockSetPieceChoice,
 revealSetPieceDuel,continueSetPieceDuel,finishSetPieceCorner,revealSetPiecePenalty}
 from '../set-piece-actions.mjs';
import {nextShootoutShooter} from '../shootout.mjs';

function random(seed){
 let n=seed>>>0;
 return ()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296);
}
const choose=(rng,array)=>array[Math.floor(rng()*array.length)];
const other=club=>club==='PSG'?'OM':'PSG';
const sum=(obj,key)=>obj.PSG[key]+obj.OM[key];

function fromRealMercato(seed){
 const r=random(seed);
 let s=createGame({rng:r,dice:[4,2]}),auctions=0;
 // Même enchère légale que les tests du moteur, sans recrutement artificiel.
 while(s.phase==='mercato'){
  if(++auctions>50)throw Error('Mercato bloqué');
  if(s.auction.solo){s=acceptSolo(s,s.auction.turn);continue;}
  s=bid(s,s.auction.turn,5);
  if(s.phase==='mercato'&&s.auction.highestBid===5){
   s=bid(s,s.auction.turn,6);
   if(s.phase==='mercato'&&s.auction.highestBid===6)s=pass(s,s.auction.turn);
  }
 }
 assert.equal(s.phase,'lineup');
 assert.equal(new Set(s.teams.flatMap(t=>t.roster)).size,14);
 for(const team of [...s.teams]){
  for(let i=0;i<7;i++)s=place(s,team.club,team.roster[i],i);
  s=ready(s,team.club);
 }
 assert.equal(s.phase,'kickoff-ready');
 return {state:s,auctionRounds:auctions};
}
function halftime(s,rng,{change=true}={}){
 const calendar=structuredClone(s.match.schedule),oldIndex=s.match.index;
 assert.equal(s.phase,'half-time');
 assert.equal(s.match.minute,45);
 for(const club of ['PSG','OM']){
  if(change){
   const team=s.teams.find(x=>x.club===club);
   const formations=Object.keys(FORMATIONS);
   const newFormation=choose(rng,formations);
   const rotation=Math.floor(rng()*7);
   const order=team.roster.map((_,i)=>team.roster[(i+rotation)%7]);
   s=chooseFormation(s,club,newFormation);
   for(let index=0;index<7;index++)s=place(s,club,order[index],index);
  }
  s=ready(s,club);
 }
 assert.equal(s.phase,'resume-ready');
 assert.deepEqual(s.match.schedule,calendar);
 s=resumeMatch(s);
 assert.equal(s.phase,'match');
 assert.equal(s.match.index,oldIndex);
 assert.equal(s.match.minute,calendar[oldIndex].minute);
 assert.deepEqual(s.match.schedule,calendar);
 return s;
}
function privateViewSafe(s){
 const view=matchPublicView(s);
 assert.ok(view.match);
 assert.equal(Object.hasOwn(view.match,'schedule'),false);
 assert.equal(Object.hasOwn(view,'deck'),false);
 assert.equal(Object.hasOwn(view,'cursor'),false);
 if(s.match?.action){
  const a=view.match.action;
  assert.equal(Object.hasOwn(a,'choices'),false);
  assert.equal(Object.hasOwn(a,'chemistryBonus'),false);
  assert.equal(Object.hasOwn(a,'originalDuel'),false);
  if(s.match.action.stage==='attack-choice' ||
     s.match.action.stage==='defense-choice' ||
     s.match.action.stage==='duel-ready' ||
     s.match.action.stage==='penalty-ready'){
   assert.equal(Object.hasOwn(a,'duel'),false);
  }
 }
 return view;
}
function setPiece(s,rng,counters){
 const a=s.match.action;
 assert.ok(['corner','free-kick','penalty'].includes(a.kind));
 counters[a.kind]++;
 const t=s.teams.find(t=>t.club===a.attacker);
 const id=choose(rng,t.slots);
 s=selectSetPieceTaker(s,a.attacker,id,rng);
 privateViewSafe(s);
 const attackChoices=a.kind==='corner'?['PREMIER','PENALTY','SECOND']:
  a.kind==='free-kick'?['DIRECT','CENTRE','COMBINAISON']:
  ['GAUCHE','CENTRE','DROITE'];
 const defenseChoices=a.kind==='corner'?['PREMIER','PENALTY','SECOND']:
  a.kind==='free-kick'?['MUR','MARQUAGE','ANTICIPER']:
  ['GAUCHE','CENTRE','DROITE'];
 s=lockSetPieceChoice(s,a.attacker,choose(rng,attackChoices));
 privateViewSafe(s);
 s=lockSetPieceChoice(s,a.defender,choose(rng,defenseChoices));
 privateViewSafe(s);
 if(a.kind==='penalty')return revealSetPiecePenalty(s,rng());
 s=revealSetPieceDuel(s,rng());
 assert.equal(s.match.action.stage,'duel-revealed');
 privateViewSafe(s);
 if(s.match.action.duel.outcome.outcome==='chance')counters.chances++;
 s=continueSetPieceDuel(s,rng());
 if(s.phase==='moment-result')return s;
 assert.equal(a.kind,'corner');
 assert.equal(s.match.action.stage,'corner-gesture-choice');
 s=lockSetPieceChoice(s,a.attacker,choose(rng,['TETE','VOLEE','RETOURNE']));
 return finishSetPieceCorner(s,rng());
}
function doMoment(s,rng,counters){
 const event=currentMatchMoment(s);
 assert.ok(event);
 assert.equal(s.match.action,undefined);
 const before=structuredClone(s.match.schedule);
 const beforeIndex=s.match.index;
 privateViewSafe(s);
 if(event.type==='open'){
  counters.open++;
  s=beginOpenPlayAction(s,rng);
  privateViewSafe(s);
  const a=s.match.action;
  s=lockOpenPlayChoice(s,a.attacker,choose(rng,['COMBINER','LANCER','PERCER']));
  privateViewSafe(s);
  // Inclure de nombreuses situations de pressing et fautes possibles.
  s=lockOpenPlayChoice(s,a.defender,choose(rng,['PRESSER','PRESSER','INTERCEPTER','CONTENIR']));
  privateViewSafe(s);
  s=revealOpenPlayDuel(s,rng());
  const construction=s.match.action.duel.outcome.outcome;
  assert.ok(['stopped','chance','foul'].includes(construction));
  privateViewSafe(s);
  if(construction==='foul')counters.fouls++;
  if(construction==='chance')counters.chances++;
  s=continueOpenPlayDuel(s);
  if(s.match.action?.stage==='shot-attack-choice'){
   const at=s.match.action;
   s=lockOpenPlayChoice(s,at.attacker,choose(rng,['PLACEE','PUISSANTE','PIQUEE']));
   privateViewSafe(s);
   s=lockOpenPlayChoice(s,at.defender,choose(rng,['LIGNE','SORTIE','PLONGEON']));
   privateViewSafe(s);
   s=revealOpenPlayShot(s,rng());
  }else if(s.match.action?.stage==='set-piece-pending'){
   // La faute NE clôture PAS la séquence et NE crée PAS un nouveau créneau.
   assert.equal(s.match.history.length,beforeIndex);
   s=beginSetPieceAction(s);
   assert.equal(s.match.action.source,'foul');
   s=setPiece(s,rng,counters);
  }
 }else{
  s=beginSetPieceAction(s);
  assert.equal(s.match.action.source,'calendar');
  s=setPiece(s,rng,counters);
 }
 assert.equal(s.phase,'moment-result');
 assert.equal(s.match.index,beforeIndex);
 assert.deepEqual(s.match.schedule,before);
 assert.equal(s.match.history.length,beforeIndex+1);
 assert.equal(s.match.lastResult.minute,event.minute);
 assert.equal(s.match.lastResult.type,event.type);
 assert.ok(['stopped','miss','save','goal'].includes(s.match.lastResult.outcome));
 assert.equal(s.match.action,undefined);
 privateViewSafe(s);
 counters[s.match.lastResult.outcome]++;
 // Le résultat attend explicitement Continuer.
 assert.equal(s.match.index,beforeIndex);
 return s;
}
function validateRegulation(s,calendar){
 const m=s.match;
 assert.equal(m.history.length,calendar.length);
 assert.equal(m.minute,90);
 assert.deepEqual(m.schedule,calendar);
 assert.equal(sum(m.statistics,'sequences'),calendar.length);
 assert.equal(sum(m.statistics,'shots'),
  m.history.filter(h=>h.outcome!=='stopped').length);
 assert.equal(sum(m.statistics,'onTarget'),
  m.history.filter(h=>['goal','save'].includes(h.outcome)).length);
 assert.equal(sum(m.statistics,'saves'),
  m.history.filter(h=>h.outcome==='save').length);
 assert.equal(m.score.PSG+m.score.OM,m.goals.length);
 assert.equal(m.goals.length,m.history.filter(h=>h.outcome==='goal').length);
 for(const h of m.history){
  const e=calendar[h.index];
  assert.ok(e);assert.equal(h.minute,e.minute);
  assert.equal(h.attacker,e.attacker);assert.equal(h.type,e.type);
  if(h.outcome==='goal'){
   const goal=m.goals.find(g=>g.club===h.attacker&&g.minute===h.minute&&g.cardId===h.scorerId);
   assert.ok(goal);
  }
  assert.ok(h.details);
  if(h.details.source==='foul'){
   assert.equal(h.type,'open');
   assert.equal(h.details.originalDuel.outcome.outcome,'foul');
  }
 }
 const shotsFromHistory=m.history.filter(h=>h.details?.shot);
 assert.equal(shotsFromHistory.length,sum(m.statistics,'shots'));
}
function simulatedShootout(s,rng){
 assert.equal(s.phase,'shootout-ready');
 const fixedStats=structuredClone(s.match.statistics);
 const fixedScore=structuredClone(s.match.score);
 s=beginShootout(s,rng());
 let kicks=0;
 while(s.phase==='shootout'){
  if(++kicks>150)throw Error('Séance de tirs au but trop longue');
  const pick=nextShootoutShooter(s.match.shootout);
  assert.ok(pick);
  s=advanceShootout(s,{club:pick.club,shooterId:pick.cardId,
   shotDirection:choose(rng,['GAUCHE','CENTRE','DROITE']),
   keeperDirection:choose(rng,['GAUCHE','CENTRE','DROITE']),draw:rng()});
  privateViewSafe(s);
 }
 assert.equal(s.phase,'finished');
 assert.equal(s.match.victory,'shootout');
 assert.equal(s.match.shootout.phase,'finished');
 assert.equal(s.match.shootout.timeline.length,kicks);
 assert.equal(s.match.winner,s.match.shootout.winner);
 assert.deepEqual(s.match.statistics,fixedStats);
 assert.deepEqual(s.match.score,fixedScore);
 return {state:s,kicks};
}
function simulate(seed,{changeAtHalf=true}={}){
 const base=fromRealMercato(seed);
 const rng=random(seed*33+71);
 let s=kickoffMatch(base.state,rng);
 const calendar=structuredClone(s.match.schedule);
 const before=structuredClone(s.teams.map(t=>({club:t.club,roster:t.roster})));
 let changes=0;
 const counters={open:0,corner:0,'free-kick':0,penalty:0,
  fouls:0,chances:0,stopped:0,miss:0,save:0,goal:0};
 let turns=0;
 while(!['shootout-ready','finished'].includes(s.phase)){
  if(++turns>60)throw Error('Progression du match bloquée : '+s.phase);
  if(s.phase==='half-time'){
   changes++;
   s=halftime(s,rng,{change:changeAtHalf});
   continue;
  }
  assert.equal(s.phase,'match');
  s=doMoment(s,rng,counters);
  s=continueMatch(s);
 }
 assert.equal(changes,1);
 assert.equal(counters.open+counters.corner+counters['free-kick']+counters.penalty-counters.fouls,
  // Les fautes font une phase arrêtée supplémentaire qui reste dans
  // leur séquence d'origine, jamais un événement planifié.
  calendar.length);
 validateRegulation(s,calendar);
 assert.deepEqual(s.teams.map(t=>({club:t.club,roster:t.roster})),before);
 let kicks=0;
 if(s.phase==='shootout-ready'){
  ({state:s,kicks}=simulatedShootout(s,rng));
 }else{
  assert.equal(s.match.victory,'regulation');
  assert.equal(s.match.winner,s.match.score.PSG>s.match.score.OM?'PSG':'OM');
 }
 assert.equal(s.phase,'finished');
 privateViewSafe(s);
 return {state:s,calendar,counters,kicks,auctions:base.auctionRounds};
}
test('Du vrai mercato au résultat : deux clubs recrutent, se placent et jouent',()=>{
 const run=simulate(14);
 assert.equal(run.state.phase,'finished');
 assert.equal(run.state.teams[0].roster.length,7);
 assert.equal(run.state.teams[1].roster.length,7);
 assert.ok(run.auctions>=14&&run.auctions<=50);
 assert.equal(run.state.match.statistics.PSG.sequences+run.state.match.statistics.OM.sequences,
  run.calendar.length);
});
test('Deux joueurs peuvent changer réellement de formation à 45 minutes sans modifier le calendrier',()=>{
 const run=simulate(58,{changeAtHalf:true});
 assert.ok(run.state.teams.every(t=>Object.hasOwn(FORMATIONS,t.formation)));
 assert.equal(run.state.match.minute,90);
 assert.deepEqual(run.state.match.schedule,run.calendar);
});
test('Les choix secrets ne sont jamais présents dans les vues publiques avant les révélations',()=>{
 for(const seed of [2,13,22,47,75]){
  const r=simulate(seed);
  assert.equal(r.state.phase,'finished');
 }
});
test('120 matchs de bout en bout, avec les quatre types de séquences et toutes les issues',()=>{
 const totals={open:0,corner:0,'free-kick':0,penalty:0,
  fouls:0,chances:0,stopped:0,miss:0,save:0,goal:0};
 let shootoutGames=0,regulationGames=0,totalKicks=0;
 let psgVictories=0,omVictories=0;
 const lengths=new Set();
 for(let seed=1;seed<=120;seed++){
  const r=simulate(seed);
  lengths.add(r.calendar.length);
  for(const key of Object.keys(totals))totals[key]+=r.counters[key];
  if(r.state.match.victory==='shootout'){shootoutGames++;totalKicks+=r.kicks;}
  else regulationGames++;
  if(r.state.match.winner==='PSG')psgVictories++;else omVictories++;
 }
 assert.deepEqual([...lengths].sort(),[10,11,12]);
 assert.ok(shootoutGames>0);
 assert.ok(regulationGames>0);
 assert.ok(totalKicks>=shootoutGames*6);
 assert.ok(psgVictories>0&&omVictories>0);
 for(const key of Object.keys(totals))assert.ok(totals[key]>0,key);
 assert.ok(totals.fouls>0);
 // Le nombre de fautes consécutives n'augmente jamais les séquences.
 assert.equal(totals.stopped+totals.miss+totals.save+totals.goal,
  totals.open+totals.corner+totals['free-kick']+totals.penalty-totals.fouls);
});
