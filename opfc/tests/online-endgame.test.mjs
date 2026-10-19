import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,ready} from '../engine.mjs';
import {kickoffMatch,resolveMatchMoment,continueMatch,resumeMatch} from '../match.mjs';
import {nextShootoutShooter} from '../shootout.mjs';
import {applyOnlineOpenPlayCommand,onlineMatchView} from '../online-match.mjs';
import {onlinePreMatchView} from '../online-lineup.mjs';
import {ONLINE_ENDGAME_COMMANDS} from '../online-endgame.mjs';

const PSG=['chopper','jinbe','kaido','shanks','nami','luffy','zoro'];
const OM=['loki','mihawk','monkey-d-garp','katakuri','sabo','sanji','kizaru'];
const rng=seed=>()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);
function kick(){
 const s=createGame({dice:[5,2],rng:rng(1)});
 s.phase='kickoff-ready';s.auction=null;
 for(const t of s.teams){
  t.roster=[...(t.club==='PSG'?PSG:OM)];
  t.slots=[...t.roster];t.formation='2-2-2';t.ready=true;
 }
 s.onlinePrivate={observations:{PSG:['HIDDEN-PSG'],OM:['HIDDEN-OM']}};
 return kickoffMatch(s,rng(24));
}
const act=(s,club,type,fields={},draw=.1)=>
 applyOnlineOpenPlayCommand(s,club,{type,...fields},{hostClub:'PSG',rng:()=>draw}).state;
function halftime(){
 let s=kick();
 while(s.phase==='match'){
  s=continueMatch(resolveMatchMoment(s,{outcome:'stopped'}));
 }
 assert.equal(s.phase,'half-time');
 return s;
}
function after90(){
 let s=halftime();
 s=ready(s,'PSG');s=ready(s,'OM');
 s=resumeMatch(s);
 while(s.phase==='match'){
  s=continueMatch(resolveMatchMoment(s,{outcome:'stopped'}));
 }
 assert.equal(s.phase,'shootout-ready');
 return s;
}
function validatedShootout(){
 return act(after90(),'PSG','begin-shootout',{},.1);
}
function attempt(s,draw=.999999){
 const pick=nextShootoutShooter(s.match.shootout);
 const defender=pick.club==='PSG'?'OM':'PSG';
 s=act(s,pick.club,'shootout-choose',{choice:'GAUCHE'});
 s=act(s,defender,'shootout-choose',{choice:'DROITE'});
 s=act(s,pick.club,'shootout-reveal',{},draw);
 assert.equal(s.match.shootoutLastResult.shooterId,pick.cardId);
 s=act(s,pick.club,'shootout-continue');
 return s;
}
function privateFieldsHidden(view){
 for(const k of ['deck','cursor','onlinePrivate','history','schedule'])
  assert.equal(view[k],undefined);
 assert.equal(view.match.schedule,undefined);
 assert.equal(JSON.stringify(view).includes('HIDDEN-PSG'),false);
 assert.equal(JSON.stringify(view).includes('HIDDEN-OM'),false);
}
test('Mi-temps : modifier uniquement son équipe, puis 2 validations',()=>{
 let s=halftime(),schedule=structuredClone(s.match.schedule),pos=s.match.index;
 assert.equal(s.match.minute,45);
 assert.equal(s.teams.every(t=>t.ready===false),true);
 assert.equal(onlinePreMatchView(s,'OM').match.currentMoment,null);
 assert.throws(()=>act(s,'OM','resume'),/Reprise indisponible/);
 assert.throws(()=>act(s,'OM','half-place',{cardId:'luffy',slot:1}),/ton club/);
 s=act(s,'PSG','half-formation',{formation:'3-2-1'});
 assert.deepEqual(s.teams.find(t=>t.club==='PSG').slots,Array(7).fill(null));
 const team=s.teams.find(t=>t.club==='PSG');
 for(let i=0;i<7;i++)s=act(s,'PSG','half-place',{cardId:team.roster[i],slot:i});
 assert.throws(()=>act(s,'PSG','half-ready',{winner:'PSG'}),/interdit/);
 s=act(s,'PSG','half-ready');
 assert.equal(s.phase,'half-time');
 assert.throws(()=>act(s,'PSG','half-formation',{formation:'2-2-2'}),/déjà validée/);
 assert.equal(onlineMatchView(s,'OM').teams.find(t=>t.club==='PSG').ready,true);
 s=act(s,'OM','half-ready');
 assert.equal(s.phase,'resume-ready');
 assert.throws(()=>act(s,'OM','resume'),/hôte/);
 s=act(s,'PSG','resume');
 assert.equal(s.phase,'match');
 assert.equal(s.match.index,pos);
 assert.deepEqual(s.match.schedule,schedule);
 privateFieldsHidden(onlineMatchView(s,'PSG'));
});
test('La mi-temps refuse usurpation, placements invalides et confirmations prématurées',()=>{
 const base=halftime();
 for(const command of [
  {type:'half-place',cardId:'luffy',slot:7},
  {type:'half-place',cardId:'luffy',slot:1,club:'OM'},
  {type:'half-place',cardId:'luffy',slot:'1'},
  {type:'half-formation',formation:'4-4-2'},
  {type:'half-formation',formation:'2-2-2',score:10},
  {type:'half-ready',ready:true},
  {type:'half-unknown'},
  {type:'half-place',cardId:'bad-card',slot:0}
 ]){
  assert.throws(()=>applyOnlineOpenPlayCommand(base,'PSG',command,{hostClub:'PSG',rng:()=>.1}),/./);
 }
 const game=act(base,'PSG','half-ready');
 assert.throws(()=>act(game,'PSG','half-ready'),/déjà validée/);
 assert.equal(base.teams.find(t=>t.club==='PSG').ready,false);
});
test('Lancement des TAB réservé à l’hôte, compositions de la 90e immuables',()=>{
 let s=after90(),roster=structuredClone(s.teams),score={...s.match.score};
 assert.throws(()=>act(s,'OM','begin-shootout'),/hôte/);
 assert.throws(()=>act(s,'PSG','half-formation',{formation:'3-2-1'}),/mi-temps/);
 s=act(s,'PSG','begin-shootout',{},.1);
 assert.equal(s.phase,'shootout');
 assert.equal(s.match.shootout.firstClub,'PSG');
 assert.deepEqual(s.teams,roster);
 assert.deepEqual(s.match.score,score);
 const pub=onlineMatchView(s,'OM');
 assert.equal(pub.match.shootout.active.club,'PSG');
 assert.equal(pub.match.shootout.score.PSG,0);
 assert.equal(pub.match.shootout.score.OM,0);
 assert.equal(pub.match.shootout.orders,undefined);
 assert.equal(pub.match.shootout.keepers,undefined);
 assert.equal(pub.match.shootout.timeline.length,0);
 privateFieldsHidden(pub);
});
test('Directions du tireur et gardien scellées jusqu’à révélation',()=>{
 let s=validatedShootout();
 assert.equal(s.match.shootoutPending,null);
 assert.throws(()=>act(s,'OM','shootout-choose',{choice:'GAUCHE'}),/tour/);
 s=act(s,'PSG','shootout-choose',{choice:'GAUCHE'});
 assert.equal(s.match.shootoutPending.shotDirection,'GAUCHE');
 let v=onlineMatchView(s,'OM').match.shootout;
 assert.deepEqual(v.confirmed,{shooter:true,keeper:false});
 assert.equal(v.shotDirection,undefined);
 assert.equal(v.pending,undefined);
 assert.equal(JSON.stringify(v).includes('"shotDirection":"GAUCHE"'),false);
 assert.throws(()=>act(s,'PSG','shootout-choose',{choice:'DROITE'}),/tour/);
 assert.throws(()=>act(s,'PSG','shootout-reveal'),/directions/);
 s=act(s,'OM','shootout-choose',{choice:'DROITE'});
 v=onlineMatchView(s,'PSG').match.shootout;
 assert.deepEqual(v.confirmed,{shooter:true,keeper:true});
 assert.equal(v.timeline.length,0);
 assert.equal(JSON.stringify(v).includes('"shotDirection":"GAUCHE"'),false);
 assert.equal(JSON.stringify(v).includes('"keeperDirection":"DROITE"'),false);
 assert.throws(()=>act(s,'OM','shootout-reveal'),/tireur/);
 s=act(s,'PSG','shootout-reveal',{},.999999);
 assert.equal(s.match.shootout.timeline.length,1);
 assert.equal(s.match.shootout.score.PSG,1);
 assert.equal(s.match.score.PSG,0);
 assert.equal(s.match.shootoutLastResult.scored,true);
 const disclosed=onlineMatchView(s,'OM').match.shootout;
 assert.equal(disclosed.timeline[0].shotDirection,'GAUCHE');
 assert.equal(disclosed.timeline[0].keeperDirection,'DROITE');
 assert.equal(disclosed.timeline[0].probabilities,undefined);
 assert.equal(disclosed.lastResult.probabilities,undefined);
 assert.throws(()=>act(s,'OM','shootout-continue'),/tireur/);
 assert.throws(()=>act(s,'OM','shootout-choose',{choice:'CENTRE'}),/validé/);
 s=act(s,'PSG','shootout-continue');
 assert.equal(s.match.shootoutLastResult,null);
 assert.equal(onlineMatchView(s,'OM').match.shootout.active.club,'OM');
});
test('Séance entière, mort subite puis victoire finale, statistiques séparées',()=>{
 let s=validatedShootout(),original=structuredClone(s.match.schedule);
 for(let i=0;i<10;i++)s=attempt(s,.999999);
 assert.equal(s.phase,'shootout');
 assert.equal(s.match.shootout.stage,'sudden-death');
 assert.deepEqual(s.match.shootout.score,{PSG:5,OM:5});
 assert.deepEqual(s.match.score,{PSG:0,OM:0});
 s=attempt(s,0);
 assert.deepEqual(s.match.shootout.score,{PSG:5,OM:5});
 assert.equal(s.phase,'shootout');
 const pick=nextShootoutShooter(s.match.shootout);
 assert.equal(pick.club,'OM');
 s=act(s,'OM','shootout-choose',{choice:'GAUCHE'});
 s=act(s,'PSG','shootout-choose',{choice:'DROITE'});
 s=act(s,'OM','shootout-reveal',{},.999999);
 assert.equal(s.phase,'finished');
 assert.equal(s.match.winner,'OM');
 assert.equal(s.match.victory,'shootout');
 assert.deepEqual(s.match.score,{PSG:0,OM:0});
 assert.deepEqual(s.match.shootout.score,{PSG:5,OM:6});
 assert.equal(s.match.shootout.timeline.length,12);
 assert.equal(s.match.shootoutLastResult.club,'OM');
 let v=onlinePreMatchView(s,'PSG');
 assert.equal(v.match.winner,'OM');
 assert.equal(v.match.shootout.timeline.length,12);
 assert.equal(v.match.shootout.lastResult.scored,true);
 assert.equal(v.match.shootout.timeline.some(t=>t.probabilities!==undefined),false);
 assert.deepEqual(s.match.schedule,original);
 assert.throws(()=>act(s,'PSG','shootout-continue'),/tireur/);
 s=act(s,'OM','shootout-continue');
 assert.equal(s.phase,'finished');
 assert.equal(s.match.shootoutLastResult,null);
 v=onlineMatchView(s,'OM');
 assert.deepEqual(v.match.score,{PSG:0,OM:0});
 assert.equal(v.match.shootout.lastResult,null);
 assert.throws(()=>act(s,'OM','shootout-choose',{choice:'GAUCHE'}),/séance active/);
});
test('Les serveurs ne prennent jamais de tirages ou scores fournis par les clients',()=>{
 let s=validatedShootout();
 const bad=[
  {type:'shootout-choose',choice:'HAUT'},
  {type:'shootout-choose',choice:'GAUCHE',club:'OM'},
  {type:'shootout-reveal',draw:.99},
  {type:'shootout-reveal',scored:true},
  {type:'begin-shootout',firstClub:'OM'},
  {type:'shootout-continue',outcome:'goal'},
  {type:'shootout-choose',choice:5},
  {type:'half-place',cardId:'luffy',slot:0}
 ];
 for(const command of bad)
  assert.throws(()=>applyOnlineOpenPlayCommand(s,'PSG',command,{hostClub:'PSG',rng:()=>.1}),/./);
 assert.equal(s.match.shootout.timeline.length,0);
 assert.equal(s.match.shootoutPending,null);
});
test('Réponse du match jamais porteuse de probabilités privées ni de tableau des tireurs',()=>{
 let s=validatedShootout(),v=onlineMatchView(s,'OM');
 const forbidden=['schedule','orders','keepers','shotDirection','keeperDirection',
  'probabilities','onlinePrivate','shootoutPending','shootoutLastResult'];
 for(const field of forbidden)
  assert.equal(Object.hasOwn(v.match.shootout,field),false);
 assert.equal(v.match.shootout.active.shooterId,
  s.match.shootout.orders.PSG[0].cardId);
 assert.equal(v.match.shootout.timeline.length,0);
 assert.equal(v.match.currentMoment,null);
 privateFieldsHidden(v);
 assert.equal(Object.keys(ONLINE_ENDGAME_COMMANDS).includes('shootout-reveal'),true);
});
