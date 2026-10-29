/** OPFC - affichage du bandeau d'attaque uniquement.
 * Aucune simulation de match, aucune donnée enregistrée.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {scoreStats,renderOnlineMatchScreen,renderMatchScreen} from '../ui-match.mjs';
import {setDisplayedClubs,setDisplayedChoices} from '../club-identities.mjs';

const stats=()=>({
 PSG:{shots:3,onTarget:3,saves:0,sequences:2},
 OM:{shots:1,onTarget:1,saves:0,sequences:1}
});
const teams=[
 {club:'PSG',identityId:'RBE'},
 {club:'OM',identityId:'OM'}
];
const game=(attacker)=>({
 phase:'match',teams,
 match:{
  minute:50,index:5,
  score:{PSG:0,OM:0},statistics:stats(),
  history:[],schedule:[{attacker,minute:50,type:'open',period:2}],
  currentMoment:{attacker,minute:50,type:'open'}
 }
});
function verifyStatsOrder(markup,attackLabel,defenseLabel){
 const statsIndex=markup.indexOf('<div class="match-mini-stats">');
 assert.ok(statsIndex>=0,'shooting stats grid must exist');
 const section=markup.slice(statsIndex,markup.indexOf('</div></section>',statsIndex));
 const first=section.indexOf('<strong>'+attackLabel+'</strong>');
 const second=section.indexOf('<strong>'+defenseLabel+'</strong>');
 assert.ok(first>=0&&second>first,'attacker shots must appear in the LEFT box');
}

test('OM attacks on left: OM shots appear left, RBE shots appear right, numbers unchanged',()=>{
 setDisplayedClubs(teams);
 const m=game('OM').match;
 const actual=scoreStats(m,'OM');
 verifyStatsOrder(actual,'OM','RBE');
 assert.match(actual,/<strong>OM<\/strong><span>1 tir · 1 cadré<\/span>/);
 assert.match(actual,/<strong>RBE<\/strong><span>3 tirs · 3 cadrés<\/span>/);
 assert.deepEqual(m.statistics,stats(),'the actual stats remain unchanged');
});

test('RBE attacks on left: its shots appear left, OM shoots right, numbers unchanged',()=>{
 setDisplayedClubs(teams);
 const m=game('PSG').match;
 const actual=scoreStats(m,'PSG');
 verifyStatsOrder(actual,'RBE','OM');
 assert.match(actual,/<strong>RBE<\/strong><span>3 tirs · 3 cadrés<\/span>/);
 assert.match(actual,/<strong>OM<\/strong><span>1 tir · 1 cadré<\/span>/);
});

test('Online modes show same order on attacker and defender iPhone',()=>{
 for(const attacker of ['PSG','OM']){
  const state=game(attacker);
  const toLabel=x=>x==='PSG'?'RBE':'OM';
  const defender=attacker==='PSG'?'OM':'PSG';
  for(const myClub of ['PSG','OM']){
   const before=structuredClone(state);
   const markup=renderOnlineMatchScreen(state,{myClub,hostClub:'PSG',competition:'league'});
   assert.ok(markup.includes('<div class="match-attacking-team">'));
   verifyStatsOrder(markup,toLabel(attacker),toLabel(defender));
   assert.deepEqual(state,before,'UI cannot mutate match stats or saved state');
  }
 }
});

test('Local match shares the same banner and correctly aligned stats',()=>{
 for(const attacker of ['PSG','OM']){
  const state=game(attacker);
  const defender=attacker==='PSG'?'OM':'PSG';
  const lab=x=>x==='PSG'?'RBE':'OM';
  const markup=renderMatchScreen(state,{uncovered:false});
  verifyStatsOrder(markup,lab(attacker),lab(defender));
 }
});

test('No change in grid dimensions, order logic or versioned local / online imports',()=>{
 const source=readFileSync(new URL('../ui-match.mjs',import.meta.url),'utf8');
 const online=readFileSync(new URL('../ui-online-game.mjs',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../ui.mjs',import.meta.url),'utf8');
 const html=readFileSync(new URL('../../opfc.html',import.meta.url),'utf8');
 assert.match(source,/\(m\?\.statistics\?scoreStats\(m,attacker\):''\)/);
 assert.ok(source.includes("const order=[attacker,attacker==='PSG'?'OM':'PSG']"));
 assert.ok(!source.includes("['PSG','OM'].map(id=>'<div><strong>'"));
 assert.ok(ui.includes("ui-match.mjs?v=opfc-attack-stats-alignment-20261029"));
 assert.ok(ui.includes("ui-online-game.mjs?v=opfc-attack-stats-alignment-20261029"));
 assert.ok(online.includes("ui-match.mjs?v=opfc-attack-stats-alignment-20261029"));
 assert.ok(html.includes('ui.mjs?v=opfc-attack-stats-alignment-20261029'));
});
