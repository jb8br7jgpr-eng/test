import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../engine.mjs';
import {kickoffMatch} from '../match.mjs';
import {calculateOpenPlay} from '../open-play.mjs';
import {applyOnlineOpenPlayCommand,onlineMatchView} from '../online-match.mjs';
import {onlinePreMatchView} from '../online-lineup.mjs';
const PSG=['chopper','jinbe','kaido','shanks','nami','luffy','zoro'];
const OM=['loki','mihawk','monkey-d-garp','katakuri','sabo','sanji','kizaru'];
const rng=seed=>()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);
function ready(){
 const s=createGame({dice:[5,2],rng:rng(1)});
 s.phase='kickoff-ready';s.auction=null;
 for(const t of s.teams){
  t.roster=[...(t.club==='PSG'?PSG:OM)];
  t.slots=[...t.roster];t.formation='2-2-2';t.ready=true;
 }
 return s;
}
const firsts=(()=>{
 const found={};
 for(let i=1;i<=1500&&Object.keys(found).length<4;i++){
  const s=kickoffMatch(ready(),rng(i)),kind=s.match.schedule[0].type;
  found[kind]??=s;
 }
 return found;
})();
const initial=kind=>{
 if(!firsts[kind])throw Error('Séquence initiale absente : '+kind);
 return structuredClone(firsts[kind]);
};
const other=c=>c==='PSG'?'OM':'PSG';
const act=(s,club,type,attrs={},draw=.3)=>
 applyOnlineOpenPlayCommand(s,club,{type,...attrs},{rng:()=>draw}).state;
const begin=kind=>{
 const s=initial(kind);
 return act(s,s.match.schedule[0].attacker,'begin-setpiece');
};
const chooseTaker=(s,id=null)=>{
 const a=s.match.action;
 const taker=id??s.teams.find(t=>t.club===a.attacker).slots[4];
 return act(s,a.attacker,'select-taker',{takerId:taker},.2);
};
const decisions=(s,attack,defense)=>{
 const a=s.match.action;
 s=act(s,a.attacker,'choose',{choice:attack});
 return act(s,a.defender,'choose',{choice:defense});
};
const visible=(s,club)=>onlinePreMatchView(s,club);
const noPrivate=s=>{
 for(const club of ['PSG','OM']){
  const v=visible(s,club);
  assert.equal(v.deck,undefined);
  assert.equal(v.onlinePrivate,undefined);
  assert.equal(v.match.schedule,undefined);
  assert.equal(v.match.action?.choices,undefined);
  assert.equal(v.match.action?.chemistryBonus,undefined);
  assert.equal(v.match.action?.originalDuel,undefined);
  assert.equal(v.match.action?.shotResult,undefined);
 }
};
test('Les trois phases directes démarrent à la bonne minute sur le club attaquant',()=>{
 for(const kind of ['corner','free-kick','penalty']){
  const s=initial(kind),start=s.match.schedule[0],schedule=structuredClone(s.match.schedule);
  assert.throws(()=>act(s,other(start.attacker),'begin-setpiece'),/attaquant/);
  const next=act(s,start.attacker,'begin-setpiece');
  assert.equal(next.match.action.kind,kind);
  assert.equal(next.match.action.stage,'taker-choice');
  assert.equal(next.match.action.source,'calendar');
  assert.equal(next.match.action.minute,start.minute);
  assert.deepEqual(next.match.schedule,schedule);
  assert.equal(next.match.history.length,0);
  noPrivate(next);
  assert.throws(()=>act(next,start.attacker,'begin-setpiece'),/active/);
 }
});
test('Seul l’attaquant choisit le tireur, y compris parmi les gardiens',()=>{
 for(const kind of ['corner','free-kick','penalty']){
  let s=begin(kind),a=s.match.action;
  const keeper=s.teams.find(t=>t.club===a.attacker).slots[0];
  assert.throws(()=>act(s,a.defender,'select-taker',{takerId:keeper}),/tour/);
  assert.throws(()=>act(s,a.attacker,'select-taker',{takerId:'intrus'}),/absent/);
  s=chooseTaker(s,keeper);
  assert.equal(s.match.action.actors.taker.cardId,keeper);
  assert.equal(s.match.action.stage,'attack-choice');
  const v=visible(s,a.defender);
  assert.equal(v.match.action.actors.taker.cardId,keeper);
  assert.equal(v.match.action.choices,undefined);
 }
});
test('Choix tactique du corner confidentiel jusqu’aux deux confirmations',()=>{
 let s=chooseTaker(begin('corner')),a=s.match.action;
 assert.throws(()=>act(s,a.defender,'choose',{choice:'SECOND'}),/tour/);
 s=act(s,a.attacker,'choose',{choice:'PREMIER'});
 assert.equal(s.match.action.choices.attack,'PREMIER');
 assert.equal(s.match.action.stage,'defense-choice');
 let pub=visible(s,a.defender).match.action;
 assert.equal(pub.choices,undefined);
 assert.equal(pub.confirmed.attacker,true);
 assert.equal(pub.confirmed.defender,false);
 assert.equal(pub.duel,undefined);
 assert.throws(()=>act(s,a.attacker,'choose',{choice:'SECOND'}),/tour/);
 s=act(s,a.defender,'choose',{choice:'SECOND'});
 assert.equal(s.match.action.stage,'duel-ready');
 pub=visible(s,a.attacker).match.action;
 assert.equal(pub.choices,undefined);
 assert.equal(pub.duel,undefined);
 assert.equal(pub.confirmed.defender,true);
 noPrivate(s);
 s=act(s,a.attacker,'reveal-setpiece-duel',{},0);
 assert.equal(s.match.action.stage,'duel-revealed');
 assert.equal(s.match.action.duel.outcome.outcome,'chance');
 assert.equal(visible(s,a.defender).match.action.duel.outcome.outcome,'chance');
 noPrivate(s);
});
test('Corner réussi puis tête et but réel : une seule séquence, un seul but',()=>{
 let s=chooseTaker(begin('corner')),a=s.match.action;
 const schedule=structuredClone(s.match.schedule),receiver=null;
 s=decisions(s,'PREMIER','SECOND');
 assert.throws(()=>act(s,a.defender,'reveal-setpiece-duel',{},0),/tour/);
 s=act(s,a.attacker,'reveal-setpiece-duel',{},0);
 s=act(s,a.attacker,'continue-setpiece-duel');
 assert.equal(s.match.action.stage,'corner-gesture-choice');
 const finisher=s.match.action.actors.receiver.cardId;
 assert.throws(()=>act(s,a.defender,'choose',{choice:'TETE'}),/tour/);
 s=act(s,a.attacker,'choose',{choice:'TETE'});
 assert.equal(s.match.action.stage,'corner-finish-ready');
 assert.equal(visible(s,a.defender).match.action.choices,undefined);
 s=act(s,a.attacker,'finish-corner',{},.99999);
 assert.equal(s.phase,'moment-result');
 assert.equal(s.match.lastResult.outcome,'goal');
 assert.equal(s.match.lastResult.scorerId,finisher);
 assert.equal(s.match.score[a.attacker],1);
 assert.equal(s.match.history.length,1);
 assert.deepEqual(s.match.schedule,schedule);
 const pre=onlinePreMatchView(s,a.defender);
 assert.equal(pre.match.lastResult.scorerId,finisher);
 s=act(s,a.attacker,'continue-result');
 assert.equal(s.match.index,1);
 assert.deepEqual(s.match.schedule,schedule);
});
test('Corner défendu : aucun tir et un seul résultat',()=>{
 let s=chooseTaker(begin('corner')),a=s.match.action;
 s=decisions(s,'PREMIER','PREMIER');
 s=act(s,a.attacker,'reveal-setpiece-duel',{},.999999);
 assert.equal(s.match.action.duel.outcome.outcome,'stopped');
 s=act(s,a.attacker,'continue-setpiece-duel');
 assert.equal(s.phase,'moment-result');
 assert.equal(s.match.lastResult.outcome,'stopped');
 assert.equal(s.match.statistics.PSG.shots+s.match.statistics.OM.shots,0);
 assert.equal(s.match.history.length,1);
});
test('Coup franc : l’adversaire ne voit pas la stratégie directe, finition du moteur',()=>{
 let s=chooseTaker(begin('free-kick')),a=s.match.action;
 const schedule=structuredClone(s.match.schedule);
 s=act(s,a.attacker,'choose',{choice:'CENTRE'});
 assert.equal(visible(s,a.defender).match.action.choices,undefined);
 assert.equal(visible(s,a.defender).match.action.duel,undefined);
 s=act(s,a.defender,'choose',{choice:'MUR'});
 assert.equal(visible(s,a.attacker).match.action.choices,undefined);
 s=act(s,a.attacker,'reveal-setpiece-duel',{},0);
 assert.equal(s.match.action.duel.outcome.outcome,'chance');
 const receiver=s.match.action.actors.receiver.cardId;
 s=act(s,a.attacker,'continue-setpiece-duel',{},.99999);
 assert.equal(s.phase,'moment-result');
 assert.equal(s.match.lastResult.outcome,'goal');
 assert.equal(s.match.lastResult.scorerId,receiver);
 assert.equal(s.match.statistics[a.attacker].shots,1);
 assert.equal(s.match.history.length,1);
 assert.deepEqual(s.match.schedule,schedule);
});
test('Penalty : directions cachées, puis résolution unique et résultat commun',()=>{
 let s=chooseTaker(begin('penalty')),a=s.match.action;
 const schedule=structuredClone(s.match.schedule),taker=a.actors.taker.cardId;
 s=act(s,a.attacker,'choose',{choice:'GAUCHE'});
 assert.equal(visible(s,a.defender).match.action.choices,undefined);
 assert.equal(visible(s,a.defender).match.action.duel,undefined);
 s=act(s,a.defender,'choose',{choice:'DROITE'});
 assert.equal(s.match.action.stage,'penalty-ready');
 assert.equal(visible(s,a.attacker).match.action.choices,undefined);
 assert.throws(()=>act(s,a.defender,'reveal-penalty',{},.5),/tour/);
 s=act(s,a.attacker,'reveal-penalty',{},.99999);
 assert.equal(s.phase,'moment-result');
 assert.equal(s.match.lastResult.outcome,'goal');
 assert.equal(s.match.lastResult.scorerId,taker);
 assert.equal(s.match.score[a.attacker],1);
 assert.equal(s.match.history.length,1);
 assert.deepEqual(s.match.schedule,schedule);
 noPrivate(s);
});
test('Faute du jeu ouvert : penalty et coup franc conservent minute/index/statistiques',()=>{
 for(const [context,kind] of [[.1,'penalty'],[.9,'free-kick']]){
  let s=initial('open');
  const calendar=structuredClone(s.match.schedule),a=s.match.schedule[0].attacker,d=other(a);
  s=act(s,a,'begin-open',{},context);
  s=act(s,a,'choose',{choice:'COMBINER'});
  s=act(s,d,'choose',{choice:'PRESSER'});
  s=act(s,a,'reveal-duel',{},0);
  assert.equal(s.match.action.duel.outcome.outcome,'foul');
  s=act(s,a,'continue-duel');
  assert.equal(s.match.action.stage,'set-piece-pending');
  assert.throws(()=>act(s,d,'begin-setpiece'),/attaquant/);
  s=act(s,a,'begin-setpiece');
  assert.equal(s.match.action.kind,kind);
  assert.equal(s.match.action.source,'foul');
  assert.equal(s.match.index,0);
  assert.equal(s.match.history.length,0);
  noPrivate(s);
  s=chooseTaker(s);
  if(kind==='penalty'){
   s=decisions(s,'GAUCHE','DROITE');
   s=act(s,a,'reveal-penalty',{},.99999);
  }else{
   s=decisions(s,'CENTRE','MUR');
   s=act(s,a,'reveal-setpiece-duel',{},0);
   s=act(s,a,'continue-setpiece-duel',{},.99999);
  }
  assert.equal(s.phase,'moment-result');
  assert.equal(s.match.history.length,1);
  assert.equal(s.match.history[0].type,'open');
  assert.equal(s.match.history[0].details.kind,kind);
  assert.equal(s.match.statistics.PSG.sequences+s.match.statistics.OM.sequences,1);
  assert.deepEqual(s.match.schedule,calendar);
 }
});
test('Toutes les actions malformées, étapes sautées et identités usurpées échouent',()=>{
 let s=begin('penalty'),a=s.match.action;
 const illegal=[
  {type:'select-taker',takerId:'luffy',club:'OM'},
  {type:'select-taker',takerId:'luffy',rng:0},
  {type:'begin-setpiece',score:10},
  {type:'reveal-penalty',shotDirection:'GAUCHE'},
  {type:'reveal-setpiece-duel',draw:0},
  {type:'finish-corner',outcome:'goal'},
  {type:'choose',choice:42},
  {type:'choose',choice:'DROITE',actor:'OM'},
  {type:'select-taker',takerId:123}
 ];
 for(const command of illegal)
  assert.throws(()=>applyOnlineOpenPlayCommand(s,a.attacker,command),/./);
 assert.throws(()=>act(s,a.attacker,'reveal-penalty'),/Étape/);
 assert.throws(()=>act(s,a.attacker,'finish-corner'),/Étape/);
 assert.throws(()=>act(s,'PIRATE','select-taker',{takerId:'luffy'}),/Club/);
 s=chooseTaker(s);
 assert.throws(()=>act(s,a.attacker,'choose',{choice:'PREMIER'}),/invalide/);
 assert.throws(()=>act(s,a.attacker,'select-taker',{takerId:'luffy'}),/Étape/);
});
test('Après une phase arrêtée, un rechargement publie toujours une vue filtrée',()=>{
 let s=begin('corner');s=chooseTaker(s);
 const a=s.match.action;
 s=act(s,a.attacker,'choose',{choice:'SECOND'});
 const view1=onlineMatchView(s,a.defender);
 const view2=onlinePreMatchView(s,a.defender);
 assert.deepEqual(view1,view2);
 assert.equal(view2.match.action.confirmed.attacker,true);
 assert.equal(view2.match.action.choices,undefined);
 assert.equal(view2.match.action.duel,undefined);
 assert.equal(view2.match.schedule,undefined);
 assert.equal(view2.deck,undefined);
});
