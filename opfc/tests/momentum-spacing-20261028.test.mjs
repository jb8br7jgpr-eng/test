/** OPFC V4 — regressions purely visual, no live matches or persisted stats. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {momentumBarLayout,momentumEntries,renderMatchMomentum} from '../v4-momentum.mjs';

const minToX=m=>43+m*(335-43)/90;
const entry=(minute,club='PSG',outcome='stopped',index=0)=>({minute,club,outcome,index});
const checkBounds=bars=>{
 for(const b of bars){
  assert.ok(Number.isFinite(b.x)&&Number.isFinite(b.realX));
  assert.ok(b.width>=12&&b.width<=18);
  assert.ok(b.x-b.width/2>=43-1e-6, 'left plot boundary: '+b.minute+' '+b.club);
  assert.ok(b.x+b.width/2<=335+1e-6, 'right plot boundary: '+b.minute+' '+b.club);
  assert.ok(Math.abs(b.realX-minToX(b.minute))<1e-6,'exact minute anchor');
 }
};
const noSameSideOverlaps=bars=>{
 for(const club of ['PSG','OM']){
  const side=bars.filter(e=>e.club===club).sort((a,b)=>a.minute-b.minute||a.pos-b.pos);
  for(let i=1;i<side.length;i++){
   const previous=side[i-1],current=side[i];
   const distance=current.x-previous.x;
   const required=(current.width+previous.width)/2+2.5-1e-6;
   assert.ok(distance>=required,
    club+' bars at '+previous.minute+' and '+current.minute+' overlap: '+distance+' < '+required);
  }
 }
};

test('One isolated attack stays centered at its true minute with original width',()=>{
 const [bar]=momentumBarLayout([entry(45,'PSG','goal')]);
 checkBounds([bar]);assert.equal(bar.width,18);
 assert.ok(Math.abs(bar.x-minToX(45))<1e-6);
});

test('Two attacks in the same minute have separate visible rectangles',()=>{
 const bars=momentumBarLayout([entry(32,'PSG','save',0),entry(32,'PSG','stopped',1)]);
 checkBounds(bars);noSameSideOverlaps(bars);
 assert.equal(bars[0].width,12);assert.equal(bars[1].width,12);
 assert.ok(bars[0].x<bars[1].x);
 assert.equal(bars[0].minute,32);assert.equal(bars[1].minute,32);
 assert.ok(Math.abs((bars[0].x+bars[1].x)/2-minToX(32))<1e-6,
  'cluster remains centered on true minute');
});

test('Three near-simultaneous actions keep their proper order and spacing',()=>{
 const bars=momentumBarLayout([
  entry(32,'PSG','save',0),entry(33,'PSG','miss',1),entry(34,'PSG','goal',2)
 ]);
 checkBounds(bars);noSameSideOverlaps(bars);
 assert.deepEqual(bars.map(b=>b.minute),[32,33,34]);
});

test('Opposing clubs can share a minute because they have separate half-planes',()=>{
 const bars=momentumBarLayout([entry(45,'PSG','save',0),entry(45,'OM','goal',1)]);
 checkBounds(bars);noSameSideOverlaps(bars);
 assert.ok(Math.abs(bars[0].x-bars[1].x)<1e-6,
  'do not offset unrelated opposing attacks');
 assert.deepEqual(bars.map(b=>b.width),[18,18]);
});

test('Twelve attacks all at kickoff remain legible and inside plot',()=>{
 const bars=momentumBarLayout(Array.from({length:12},(_,i)=>entry(0,'PSG','stopped',i)));
 assert.equal(bars.length,12);checkBounds(bars);noSameSideOverlaps(bars);
});

test('Twelve attacks all in the 90th minute remain legible and inside plot',()=>{
 const bars=momentumBarLayout(Array.from({length:12},(_,i)=>entry(90,'OM','miss',i)));
 assert.equal(bars.length,12);checkBounds(bars);noSameSideOverlaps(bars);
});

test('Dense realistic alternating sequence never overlaps or crosses plot edges',()=>{
 const minutes=[0,1,2,2,15,16,45,45,46,88,89,90];
 const clubs=['PSG','PSG','OM','OM','PSG','PSG','PSG','OM','PSG','OM','OM','PSG'];
 const bars=momentumBarLayout(minutes.map((m,i)=>entry(m,clubs[i],'stopped',i)));
 checkBounds(bars);noSameSideOverlaps(bars);
 for(let i=0;i<bars.length;i++)assert.equal(bars[i].minute,minutes[i]);
});

test('Non-chronological input is positioned chronologically without mutating the input',()=>{
 const entries=[entry(90,'PSG','goal',0),entry(0,'PSG','miss',1),entry(44,'PSG','save',2)];
 const original=structuredClone(entries);
 const bars=momentumBarLayout(entries);
 checkBounds(bars);noSameSideOverlaps(bars);
 assert.deepEqual(entries,original);
 assert.ok(bars[1].x<bars[2].x&&bars[2].x<bars[0].x);
});

test('Rendering retains real minutes, result levels, colors and 12-event limit',()=>{
 const hist=Array.from({length:14},(_,i)=>entry(i<3?33:i*6,i%2?'OM':'PSG',
  ['stopped','miss','save','goal'][i%4],i));
 const state={minute:70,history:hist.map(e=>({...e,attacker:e.club}))};
 assert.equal(momentumEntries(state).length,12);
 const html=renderMatchMomentum(state,{open:true,clubA:'PSG',clubB:'OM'});
 assert.ok(html.includes('DYNAMIQUE DU MATCH'));
 assert.ok(html.includes('12 actions jouées'));
 for(const label of ['Attaque stoppée','Tir non cadré','Tir cadré arrêté','But marqué'])
  assert.ok(html.includes(label),label);
 for(const fill of ['#36C77A','#8996F4'])assert.ok(html.includes(fill));
 assert.ok(html.includes('33e min.')); // tooltips still show true minute
 assert.ok(html.includes('stroke-dasharray="2 2"'), 'timing connector exists');
 assert.equal((html.match(/<rect x="[^"]+" y="[^"]+" width="[^"]+" height="[^"]+" rx="1.8" fill=/g)||[]).length,12);
 assert.ok(renderMatchMomentum(state,{open:false}).includes('Voir le momentum'));
});

test('No future action, randomness, match score or history changes',()=>{
 const hist=[entry(32,'PSG','goal',0),entry(33,'PSG','miss',1)];
 const state={minute:33,history:hist.map(e=>({...e,attacker:e.club})),score:{PSG:1,OM:0},index:2};
 const before=structuredClone(state);
 renderMatchMomentum(state,{open:true});
 assert.deepEqual(state,before,'render only; never changes match state');
});
