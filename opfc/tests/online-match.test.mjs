import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../engine.mjs';
import {kickoffMatch} from '../match.mjs';
import {calculateOpenPlay} from '../open-play.mjs';
import {applyOnlineOpenPlayCommand,onlineMatchView} from '../online-match.mjs';
import {onlinePreMatchView} from '../online-lineup.mjs';

const P=['chopper','jinbe','kaido','shanks','nami','luffy','zoro'];
const O=['loki','mihawk','monkey-d-garp','katakuri','sabo','sanji','kizaru'];
const rng=seed=>()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);
function started(){
 const s=createGame({dice:[5,2],rng:rng(2)});
 s.phase='kickoff-ready';s.auction=null;
 for(const t of s.teams){
  t.roster=[...(t.club==='PSG'?P:O)];t.slots=[...t.roster];
  t.formation='2-2-2';t.ready=true;
 }
 for(let seed=1;seed<400;seed++){
  const game=kickoffMatch(s,rng(seed));
  if(game.match.schedule[0].type==='open')return game;
 }
 throw Error('Pas de première action ouverte');
}
const call=(state,club,type,extra={},draw=.3)=>
 applyOnlineOpenPlayCommand(state,club,{type,...extra},{rng:()=>draw});
function chooseDuel(state,attack='COMBINER',defense='CONTENIR'){
 const a=state.match.action;
 state=call(state,a.attacker,'choose',{choice:attack}).state;
 state=call(state,a.defender,'choose',{choice:defense}).state;
 return state;
}
test('Seul le club attaquant peut commencer la séquence annoncée',()=>{
 const s=started(),a=s.match.schedule[0].attacker,other=a==='PSG'?'OM':'PSG';
 assert.throws(()=>call(s,other,'begin-open'),/attaquant/);
 const result=call(s,a,'begin-open');
 assert.equal(result.state.match.action.stage,'attack-choice');
 assert.equal(result.state.match.action.attacker,a);
 assert.equal(result.publicForActor.match.action.stage,'attack-choice');
 assert.equal(result.publicForActor.match.action.choices,undefined);
 assert.equal(result.publicForActor.match.action.chemistryBonus,undefined);
 assert.deepEqual(result.state.match.schedule,s.match.schedule);
 assert.equal(s.match.action,undefined);
 assert.throws(()=>call(result.state,a,'begin-open'),/attaquant/);
});
test('Premier choix secret : le défenseur ne voit jamais la tactique validée',()=>{
 let s=started();s=call(s,s.match.schedule[0].attacker,'begin-open').state;
 const a=s.match.action;
 assert.throws(()=>call(s,a.defender,'choose',{choice:'PRESSER'}),/tour/);
 s=call(s,a.attacker,'choose',{choice:'COMBINER'}).state;
 assert.equal(s.match.action.choices.attack,'COMBINER');
 const defender=onlineMatchView(s,a.defender);
 assert.equal(defender.match.action.stage,'defense-choice');
 assert.equal(defender.match.action.confirmed.attacker,true);
 assert.equal(defender.match.action.duel,undefined);
 assert.equal(defender.match.action.choices,undefined);
 // COMBINER existe aussi comme clé publique de rôles possibles :
 // l'absence de choix privé se vérifie structurellement, pas par texte.
 assert.equal(defender.match.action.choices,undefined);
 assert.equal(defender.match.action.duel,undefined);
 assert.equal(defender.match.action.roles.carrier.cardId,a.roles.carrier.cardId);
 assert.throws(()=>call(s,a.attacker,'choose',{choice:'LANCER'}),/tour/);
});
test('Double confirmation : seuls les deux joueurs concernés peuvent choisir',()=>{
 let s=started();s=call(s,s.match.schedule[0].attacker,'begin-open').state;
 s=chooseDuel(s);
 const a=s.match.action;
 assert.equal(a.stage,'duel-ready');
 assert.equal(onlineMatchView(s,a.attacker).match.action.duel,undefined);
 assert.equal(onlineMatchView(s,a.defender).match.action.duel,undefined);
 assert.throws(()=>call(s,a.defender,'reveal-duel'),/tour/);
 const calculation=calculateOpenPlay({...a.roles,attack:'COMBINER',defense:'CONTENIR',chemistryBonus:a.chemistryBonus});
 const chanceDraw=(calculation.foulProbability+calculation.successProbability/2)/100;
 s=call(s,a.attacker,'reveal-duel',{},chanceDraw).state;
 assert.equal(s.match.action.duel.outcome.outcome,'chance');
 const view=onlineMatchView(s,a.defender);
 assert.equal(view.match.action.duel.calculation.attack,'COMBINER');
 assert.equal(view.match.action.duel.calculation.defense,'CONTENIR');
 assert.equal(view.match.action.choices,undefined);
});
test('Du duel jusqu’au résultat du tir, aucune issue ne peut être imposée par le client',()=>{
 let s=started();const a=s.match.schedule[0].attacker;
 s=call(s,a,'begin-open').state;
 s=chooseDuel(s);
 const m=s.match.action;
 const c=calculateOpenPlay({...m.roles,attack:'COMBINER',defense:'CONTENIR',chemistryBonus:m.chemistryBonus});
 s=call(s,a,'reveal-duel',{},(c.foulProbability+c.successProbability/2)/100).state;
 assert.equal(s.match.action.stage,'duel-revealed');
 s=call(s,a,'continue-duel').state;
 assert.equal(s.match.action.stage,'shot-attack-choice');
 const defender=s.match.action.defender;
 s=call(s,a,'choose',{choice:'PLACEE'}).state;
 assert.equal(s.match.action.stage,'shot-defense-choice');
 assert.equal(JSON.stringify(onlineMatchView(s,defender)).includes('"PLACEE"'),false);
 s=call(s,defender,'choose',{choice:'LIGNE'}).state;
 assert.equal(s.match.action.stage,'shot-ready');
 assert.throws(()=>call(s,defender,'reveal-shot'),/tour/);
 assert.equal(onlineMatchView(s,a).match.action.choices,undefined);
 const schedule=structuredClone(s.match.schedule);
 s=call(s,a,'reveal-shot',{},.999999).state;
 assert.equal(s.phase,'moment-result');
 assert.equal(s.match.lastResult.outcome,'goal');
 assert.equal(s.match.score[a],1);
 assert.equal(s.match.history.length,1);
 assert.equal(onlineMatchView(s,defender).match.action,null);
 assert.equal(onlineMatchView(s,defender).match.lastResult.outcome,'goal');
 assert.equal(onlineMatchView(s,defender).match.schedule,undefined);
 assert.throws(()=>call(s,defender,'continue-result'),/attaquant/);
 s=call(s,a,'continue-result').state;
 assert.equal(s.match.index,1);
 assert.deepEqual(s.match.schedule,schedule);
 assert.deepEqual(onlinePreMatchView(s,defender).match.score,s.match.score);
});
test('Duel stoppé : un seul résultat, zéro tir, bouton continuer attendu',()=>{
 let s=started(),a=s.match.schedule[0].attacker;
 s=call(s,a,'begin-open').state;s=chooseDuel(s);
 s=call(s,a,'reveal-duel',{},.999999).state;
 assert.equal(s.match.action.duel.outcome.outcome,'stopped');
 s=call(s,a,'continue-duel').state;
 assert.equal(s.phase,'moment-result');
 assert.equal(s.match.history.length,1);
 assert.equal(s.match.statistics.PSG.shots+s.match.statistics.OM.shots,0);
 assert.equal(s.match.statistics.PSG.sequences+s.match.statistics.OM.sequences,1);
 assert.throws(()=>call(s,a,'continue-duel'),/attend un autre écran|Aucune action/);
});
test('Faute : coup franc ou penalty reste dans la séquence initiale',()=>{
 let s=started(),a=s.match.schedule[0].attacker;
 const schedule=structuredClone(s.match.schedule);
 s=call(s,a,'begin-open',{},.1).state;
 s=chooseDuel(s,'COMBINER','PRESSER');
 s=call(s,a,'reveal-duel',{},0).state;
 assert.equal(s.match.action.duel.outcome.outcome,'foul');
 s=call(s,a,'continue-duel').state;
 assert.equal(s.match.action.stage,'set-piece-pending');
 assert.equal(s.match.history.length,0);
 assert.equal(s.match.score.PSG+s.match.score.OM,0);
 assert.equal(s.match.index,0);
 assert.deepEqual(s.match.schedule,schedule);
 assert.throws(()=>call(s,a,'begin-open'),/attaquant/);
 assert.throws(()=>call(s,a,'reveal-shot'),/prise en charge/);
});
test('Toute tentative d’injecter un score, le hasard ou une identité est rejetée',()=>{
 let s=started();const a=s.match.schedule[0].attacker;
 const bad=[
  {type:'begin-open',club:a},{type:'begin-open',rng:()=>0},
  {type:'reveal-shot',outcome:'goal'},{type:'continue-result',score:123},
  {type:'choose',choice:'COMBINER',actor:'PSG'},
  {type:'unknown'},null,[],{},'begin-open'
 ];
 for(const command of bad)
  assert.throws(()=>applyOnlineOpenPlayCommand(s,a,command),/./);
 s=call(s,a,'begin-open').state;
 assert.throws(()=>call(s,a,'choose',{choice:'DIRECT'}),/inconnu/);
 assert.throws(()=>call(s,'INTRUS','choose',{choice:'COMBINER'}),/Club/);
});
test('La vue du match ignore les données internes et les observations antérieures',()=>{
 const s=started();s.onlinePrivate={observations:{PSG:['PRIVATECARD-X']}};
 const v=onlineMatchView(s,'OM');
 assert.deepEqual(Object.keys(v),['version','phase','teams','dice','match']);
 for(const secret of ['deck','cursor','onlinePrivate','auction','nextPriority'])
  assert.equal(v[secret],undefined);
 for(const secret of ['schedule','shootoutPending','chemistryBonus'])
  assert.equal(v.match[secret],undefined);
 assert.equal(JSON.stringify(v).includes('PRIVATECARD-X'),false);
 assert.equal(JSON.stringify(v).includes(s.deck.slice(s.cursor).join(',')),false);
});
