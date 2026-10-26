import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../opfc/engine.mjs';
import {generateRandomTeams} from '../opfc/random-rosters.mjs';
import {kickoffMatch,matchPublicView,resolveMatchMoment} from '../opfc/match.mjs';
import {beginOpenPlayAction} from '../opfc/match-actions.mjs';
import {renderMatchScreen,renderOnlineMatchScreen} from '../opfc/ui-match.mjs';
let seed=12345;
const rng=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
function fixture(){
 const s=generateRandomTeams(createGame(),{PSG:'2-2-2',OM:'2-2-2'},{rng:()=>.4});
 s.phase='kickoff-ready';s.teams.forEach(t=>t.ready=true);
 const m=kickoffMatch(s,rng);
 m.match.schedule[0]={...m.match.schedule[0],type:'open',attacker:'PSG'};
 return m;
}
test('Immersive duel uses actual actors in both modes and preserves confidential handover',()=>{
 const s=beginOpenPlayAction(fixture(),rng);
 const before=JSON.stringify(s);
 const local=renderMatchScreen(s,{uncovered:true});
 const online=renderOnlineMatchScreen(matchPublicView(s),{myClub:'PSG',hostClub:'PSG'});
 for(const html of [local,online]){
  assert.ok(html.includes('match-faceoff-immersive'));
  assert.ok(html.includes('Porteur'));
  assert.ok(html.includes('Défenseur'));
  assert.ok(html.includes('match-duelist-rating'));
  assert.ok(html.includes('receiver-card'));
  assert.ok(!html.includes('class="match-actors"'));
 }
 assert.ok(!renderMatchScreen(s).includes('match-faceoff-immersive'));
 assert.ok(!renderOnlineMatchScreen(matchPublicView(s),{myClub:'OM',hostClub:'PSG'}).includes('match-faceoff-immersive'));
 assert.equal(JSON.stringify(s),before);
});
test('Goal pulses only scoring digits, once per local/online display, without state mutations',()=>{
 const base=fixture();
 const s=resolveMatchMoment(base,{outcome:'goal',scorerId:base.teams[0].slots[5]});
 const before=JSON.stringify(s);
 const local=renderMatchScreen(s);
 assert.equal((local.match(/class="score-digit score-digit-goal">1/g)||[]).length,2);
 assert.ok(!local.includes('score-digit-goal">0'));
 assert.ok(!renderMatchScreen(s).includes('score-digit-goal'));
 const view=matchPublicView(s);
 const online=renderOnlineMatchScreen(view,{myClub:'PSG',hostClub:'PSG'});
 assert.equal((online.match(/class="score-digit score-digit-goal">1/g)||[]).length,2);
 assert.ok(!renderOnlineMatchScreen(view,{myClub:'PSG',hostClub:'PSG'}).includes('score-digit-goal'));
 assert.equal(JSON.stringify(s),before);
});
