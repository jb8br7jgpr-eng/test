/** Contrats de répartition OPFC — 10/11/12 séquences et 19 configurations. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CARDS} from '../opfc/catalog.mjs';
import {attackingProbability,buildSchedule} from '../opfc/rules.mjs';
import {buildSchedule as onlineBuildSchedule} from '../supabase/functions/opfc-online/opfc/rules.mjs';
const rng=seed=>{let x=seed>>>0;return ()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296}};
const positions=['GAR','DEF','DEF','MIL','MIL','ATT','ATT'],used=new Set();
const team=(club,strong)=>{const slots=positions.map(p=>{const a=CARDS.filter(c=>c.position===p&&!used.has(c.id)).sort((x,y)=>strong?y.rating-x.rating:x.rating-y.rating);assert.ok(a.length);used.add(a[0].id);return a[0].id});return {club,formation:'2-2-2',slots,roster:slots}};
const [strong,weak]=[team('PSG',true),team('OM',false)];
function validate(m){
 const n=m.length;assert.ok(n>=10&&n<=12);
 assert.equal(new Set(m.map(x=>x.minute)).size,n);
 assert.deepEqual(m.map(x=>x.minute),m.map(x=>x.minute).sort((a,b)=>a-b));
 assert.ok(m.every(x=>x.minute!==45&&x.period===(x.minute<45?1:2)));
 const per=period=>m.filter(x=>x.period===period),h1=per(1),h2=per(2);
 assert.ok(Math.abs(h1.length-h2.length)<=1);
 for(const half of [h1,h2]){
  const a=half.filter(x=>x.attacker==='PSG').length,b=half.length-a;
  assert.ok(a>=2&&b>=2&&Math.abs(a-b)<=2);
 }
 const a=m.filter(x=>x.attacker==='PSG').length,b=n-a;
 assert.ok(Math.abs(a-b)<=2);
 return [n,...[h1,h2].flatMap(half=>[half.filter(x=>x.attacker==='PSG').length,half.filter(x=>x.attacker==='OM').length])].join(':');
}
test('4 500 calendriers : 19 configurations, calendrier serveur identique et actions consécutives possibles',()=>{
 const seen=new Set(),counts=new Set();let consecutive=false;
 for(let i=1;i<=4500;i++){
  const m=buildSchedule(strong,weak,rng(97*i+231));
  const online=onlineBuildSchedule(strong,weak,rng(97*i+231));
  assert.deepEqual(online,m);seen.add(validate(m));counts.add(m.length);
  if(m.some((x,j)=>j&&x.attacker===m[j-1].attacker))consecutive=true;
 }
 assert.equal(seen.size,19);assert.deepEqual([...counts].sort(),[10,11,12]);
 assert.ok(consecutive);
});
test('La force collective garde un effet sur le tirage',()=>{
 assert.ok(attackingProbability(strong,weak)>50);
 let chances=0,total=0;
 for(let i=1;i<=2200;i++){
  const m=buildSchedule(strong,weak,rng(10903+i));
  chances+=m.filter(x=>x.attacker==='PSG').length;total+=m.length;
 }
 assert.ok(chances/total>.51);
});
test('Le code de la règle est le même côté navigateur et Edge Function',()=>{
 const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
 const local=read('opfc/rules.mjs').replace(/\?v=[\w-]+/g,'');
 const server=read('supabase/functions/opfc-online/opfc/rules.mjs').replace(/\?v=[\w-]+/g,'');
 assert.equal(local,server);
 assert.ok(read('opfc/match.mjs').includes('rules.mjs?v=opfc-half-balance-20261027'));
 assert.ok(read('opfc/ui-match.mjs').includes('match.mjs?v=opfc-half-balance-20261027'));
 assert.ok(read('opfc/ui.mjs').includes('ui-match.mjs?v=opfc-half-balance-20261027'));
});
