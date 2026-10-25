/** Offline OPFC end-to-end lifecycle checks; no server or database mutations. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {CARDS} from '../catalog.mjs';
import {readFileSync} from 'node:fs';
import {onlineMarketPublicView} from '../online-market.mjs';
import {onlineKickoffView} from '../online-lineup.mjs';
import {lineupDetails} from '../rules.mjs';
import {kickoffMatch,resolveMatchMoment,continueMatch,resumeMatch} from '../match.mjs';
import {matchPerformances} from '../player-performance.mjs';
import {prepareRematch} from '../rematch.mjs';
import {onlineMatchView,applyOnlineOpenPlayCommand} from '../online-match.mjs';
import {renderOnlineMatchScreen,renderMatchScreen} from '../ui-match.mjs';

const id='1b270584-53a2-42ac-a3c4-8c28accd8158';
const used=new Set();
const choose=pos=>{const c=CARDS.find(c=>c.position===pos&&!used.has(c.id));assert.ok(c);used.add(c.id);return c.id;};
const mk=(club,identityId)=>{
 const slots=['GAR','DEF','DEF','MIL','MIL','ATT','ATT'].map(choose);
 return {club,identityId,formation:'2-2-2',roster:[...slots],slots,
  ready:true,budget:0,refusals:0,hakis:{observation:false,kings:false}};
};
const TEAMS=[mk('PSG','PSG'),mk('OM','BDW')];
function finished(){
 return {version:1,phase:'finished',competition:'league',stadiumId:'erbaf',playerStatsVersion:2,
  matchRecordId:id,teams:structuredClone(TEAMS),dice:[4,2],deck:[],history:[],auction:null,
  match:{index:11,minute:90,score:{PSG:2,OM:1},winner:'PSG',victory:'regulation',
   history:[],goals:[],statistics:{PSG:{shots:2,onTarget:2,saves:0,sequences:6},
    OM:{shots:1,onTarget:1,saves:1,sequences:5}},schedule:[],lastResult:null}};
}
function rng(seed){let state=seed>>>0;return ()=>{
 state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;
};}
function completeMatch(prepared){
 let s=kickoffMatch(prepared,rng(92024));
 const firstSchedule=structuredClone(s.match.schedule);
 while(s.phase==='match'){
  const event=s.match.schedule[s.match.index];
  const winnerCard=s.teams.find(t=>t.club===event.attacker).roster[5];
  s=resolveMatchMoment(s,{outcome:s.match.index===0?'goal':'stopped',
   scorerId:s.match.index===0?winnerCard:null});
  s=continueMatch(s);
  if(s.phase==='half-time'){
   s=resumeMatch({...s,phase:'resume-ready',teams:s.teams.map(t=>({...t,ready:true}))});
  }
 }
 assert.equal(s.phase,'finished');
 assert.equal(s.match.schedule.length,firstSchedule.length);
 assert.deepEqual(s.match.schedule,firstSchedule);
 assert.equal(s.match.goals.length,1);
 return s;
}
test('Deux revanches consécutives : calendriers, scores et statistiques ne se mélangent pas',()=>{
 const original=finished(),originalSnapshot=structuredClone(original);
 [original.teams[0].slots[5],original.teams[0].slots[6]]=
  [original.teams[0].slots[6],original.teams[0].slots[5]];
 const finalSlots=original.teams.map(t=>[...t.slots]);
 const ids=['a3eaa4d7-8eb3-4b38-92dd-a25597498543',
  'c7ed55b8-8aa7-4c16-a29b-3f7a27328019'];
 let current=original,completed=[];
 for(let i=0;i<2;i++){
  const next=prepareRematch(current,{matchRecordId:ids[i]});
  assert.deepEqual(next.teams.map(t=>t.slots),finalSlots);
  assert.equal(next.competition,'league');
  assert.equal(next.stadiumId,'erbaf');
  assert.notEqual(next.matchRecordId,current.matchRecordId);
  assert.equal(next.match,null);
  const final=completeMatch(next);
  assert.equal(final.matchRecordId,ids[i]);
  const stats=matchPerformances(final);
  assert.equal(Object.keys(stats.players).length,14);
  assert.equal(Object.values(stats.players).reduce((n,p)=>n+p.matches,0),14);
  assert.equal(Object.values(stats.players).reduce((n,p)=>n+p.goals,0),1);
  assert.equal(Object.values(stats.players).reduce((n,p)=>n+p.anchors,0),1);
  completed.push({uuid:final.matchRecordId,score:final.match.score,stats});
  current=final;
 }
 assert.equal(new Set([original.matchRecordId,...completed.map(x=>x.uuid)]).size,3);
 assert.deepEqual(originalSnapshot.match.score,{PSG:2,OM:1});
 assert.equal(original.phase,'finished');
});
test('Affichage du tir conseillé : uniquement à l’attaquant, pas au défenseur',()=>{
 const state=finished();
 state.phase='match';
 state.match.index=0;
 state.match.minute=22;
 state.match.schedule=[{minute:22,period:1,type:'open',attacker:'PSG'}];
 state.match.history=[];
 state.match.goals=[];
 const attack=state.teams[0],defense=state.teams[1];
 const roles={
  carrier:lineupDetails(attack)[5],partner:lineupDetails(attack)[6],
  defender:lineupDetails(defense)[1]
 };
 state.match.action={kind:'open',index:0,minute:22,attacker:'PSG',defender:'OM',
  context:'BONNE',stage:'shot-attack-choice',roles,
  shooterId:roles.carrier.cardId,keeper:lineupDetails(defense)[0],
  choices:{attack:'PERCER',defense:'PRESSER',shot:null,keeper:null},
  chemistryBonus:0,duel:{outcome:{outcome:'chance'}},shotResult:null};
 const publicAtt=onlineMatchView(state,'PSG');
 const publicDef=onlineMatchView(state,'OM');
 const attackerHtml=renderOnlineMatchScreen(publicAtt,{myClub:'PSG',hostClub:'PSG'});
 const defenderHtml=renderOnlineMatchScreen(publicDef,{myClub:'OM',hostClub:'PSG'});
 assert.ok(attackerHtml.includes('⭐ Tir conseillé'),'Conseil visible par le tireur');
 assert.ok(!defenderHtml.includes('⭐ Tir conseillé'),'Le gardien ne voit pas le conseil');
 assert.ok(!defenderHtml.includes('data-choice="PLACEE"'),'Le gardien ne voit pas les choix de tir');
 const localHidden=renderMatchScreen(state,{uncovered:false});
 assert.ok(!localHidden.includes('⭐ Tir conseillé'),'Téléphone masqué pendant la transmission');
 const localRevealed=renderMatchScreen(state,{uncovered:true});
 assert.ok(localRevealed.includes('⭐ Tir conseillé'),'Conseil visible après transmission');
});
test('Revanche en ligne : ancien résultat intact, désaccord puis double acceptation',()=>{
 const initial=finished();
 const first=applyOnlineOpenPlayCommand(initial,'PSG',{type:'rematch-accept'},{hostClub:'PSG'});
 const declined=applyOnlineOpenPlayCommand(first.state,'OM',{type:'rematch-decline'},{hostClub:'PSG'});
 assert.equal(declined.state.phase,'finished');
 assert.deepEqual(declined.state.match.score,initial.match.score);
 const reconsider=applyOnlineOpenPlayCommand(declined.state,'OM',{type:'rematch-accept'},{hostClub:'PSG'});
 const accepted=applyOnlineOpenPlayCommand(reconsider.state,'PSG',{type:'rematch-accept'},{hostClub:'PSG'});
 assert.equal(accepted.state.phase,'kickoff-ready');
 assert.deepEqual(accepted.state.prematchReady,{PSG:false,OM:false});
 const final=completeMatch(accepted.state);
 assert.notEqual(final.matchRecordId,initial.matchRecordId);
});

test('Ancienne commande réseau : historique conservé et nouvelle rencontre identifiée',()=>{
 const original=finished();
 original.onlineRequestIds={
  '5d2aefba-7102-4b0f-9d34-890c97f3d93b':{club:'PSG',signature:'match:ack'}
 };
 const first=prepareRematch(original,{matchRecordId:'e9db394e-d962-4c45-aa35-5b283024b084'});
 assert.deepEqual(first.onlineRequestIds,original.onlineRequestIds);
 const prematch=onlineMarketPublicView(first,'PSG');
 assert.equal(prematch.matchRecordId,first.matchRecordId);
 const started=kickoffMatch(first,rng(1298));
 assert.equal(onlineKickoffView(started).matchRecordId,first.matchRecordId);
 assert.equal(onlineMatchView(started,'PSG').matchRecordId,first.matchRecordId);
 const old=finished();
 assert.equal(onlineMatchView(old,'PSG').matchRecordId,undefined,
  'Premier match historique reste compatible sans nouveau champ');
 const edge=readFileSync(new URL('../../supabase/functions/opfc-online/index.ts',import.meta.url),'utf8');
 const client=readFileSync(new URL('../online-client.mjs',import.meta.url),'utf8');
 assert.match(edge,/state\.rematchNumber>0&&typeof state\.matchRecordId/);
 assert.match(client,/typeof state\?\.matchRecordId==='string'/);
 assert.match(edge,/\.\.\.\(row\.private_state\?\.onlineRequestIds\?\?\{\}\)/);
 assert.match(client,/ctx\.matchRecordId=state\.matchRecordId/);
});
