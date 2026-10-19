import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame, bid, pass, acceptSolo, place, ready} from '../engine.mjs';
import {kickoffMatch, currentMatchMoment, resolveMatchMoment, continueMatch, resumeMatch, beginShootout, advanceShootout, matchPublicView} from '../match.mjs';
import {nextShootoutShooter} from '../shootout.mjs';
import {renderMatchScreen} from '../ui-match.mjs';
import {renderFinalResult} from '../ui-final.mjs';

const random = seed => () => ((seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296);
function fullMercato() {
  let s=createGame({dice:[5,2],rng:random(7)});
  for(let n=0;s.phase==='mercato';n++){
    assert.ok(n<100,'Le mercato doit se terminer');
    if(s.auction.solo){s=acceptSolo(s,s.auction.turn);continue;}
    const actor=s.auction.turn;
    // Chaque enchère reçoit deux offres réelles avant le retrait.
    // Le retrait n'utilise donc aucun des cinq refus gratuits.
    if(s.auction.highestBid===0)s=bid(s,actor,5);
    else if(s.auction.highestBid===5)s=bid(s,actor,6);
    else s=pass(s,actor);
  }
  assert.equal(s.phase,'lineup');
  assert.deepEqual(s.teams.map(t=>t.roster.length),[7,7]);
  for(const team of s.teams){
    for(let i=0;i<7;i++)s=place(s,team.club,team.roster[i],i);
    s=ready(s,team.club);
  }
  assert.equal(s.phase,'kickoff-ready');
  return s;
}
function advanceToEnd(state, outcome='stopped') {
  let s=state;
  for(let n=0;n<40;n++){
    if(s.phase==='half-time'){
      for(const team of s.teams)s=ready(s,team.club);
      assert.equal(s.phase,'resume-ready');
      s=resumeMatch(s);continue;
    }
    if(s.phase==='moment-result'){s=continueMatch(s);continue;}
    if(s.phase!=='match')return s;
    const event=currentMatchMoment(s);
    const actualOutcome=outcome==='psg-wins'?(event.attacker==='PSG'?'goal':'stopped'):outcome;
    const scorer=actualOutcome==='goal'?s.teams.find(t=>t.club===event.attacker).slots[5]:null;
    s=resolveMatchMoment(s,{outcome:actualOutcome,scorerId:scorer});
  }
  throw Error('Le match ne se termine pas');
}
test('Parcours moteur complet : mercato réel, compositions, coup d’envoi, mi-temps et feuille finale',()=>{
  const prepared=fullMercato();
  let s=kickoffMatch(prepared,random(11));
  const schedule=structuredClone(s.match.schedule);
  assert.match(renderMatchScreen(s),/match-scoreboard/);
  s=advanceToEnd(s,'psg-wins');
  assert.equal(s.phase,'finished');
  assert.equal(s.match.history.length,schedule.length);
  assert.equal(s.match.minute,90);
  assert.equal(s.match.goals.length,schedule.filter(event=>event.attacker==='PSG').length);
  assert.equal(s.match.winner,'PSG');
  const screen=renderFinalResult(s);
  assert.match(screen,/Grandline Cup/);
  assert.match(screen,/Buteurs du match/);
  assert.match(screen,/Statistiques comparées/);
  assert.equal(matchPublicView(s).match.schedule,undefined);
});
test('Égalité à 90 minutes : séance complète et historique final distinct',()=>{
  let s=advanceToEnd(kickoffMatch(fullMercato(),random(19)));
  assert.equal(s.phase,'shootout-ready');
  s=beginShootout(s,0);
  for(let n=0;s.phase==='shootout';n++){
    assert.ok(n<30,'La séance doit se terminer');
    const t=nextShootoutShooter(s.match.shootout);
    s=advanceShootout(s,{club:t.club,shooterId:t.cardId,shotDirection:'GAUCHE',keeperDirection:'GAUCHE',draw:t.club==='PSG'?.99999:0});
  }
  assert.equal(s.phase,'finished');
  assert.ok(s.match.winner);
  assert.deepEqual(s.match.score,{PSG:0,OM:0});
  assert.match(renderFinalResult(s),/Tirs au but/);
  assert.match(renderFinalResult(s),/Statistiques comparées/);
});
test('Sauvegarde JSON et secrets : reprise identique et calendrier invisible dans la vue publique',()=>{
  let s=kickoffMatch(fullMercato(),random(21));
  const restored=JSON.parse(JSON.stringify(s));
  assert.deepEqual(restored,s);
  assert.equal(matchPublicView(restored).match.schedule,undefined);
  assert.equal(matchPublicView(restored).deck,undefined);
  assert.equal(matchPublicView(restored).cursor,undefined);
  s=advanceToEnd(restored);
  assert.ok(['finished','shootout-ready'].includes(s.phase));
});
