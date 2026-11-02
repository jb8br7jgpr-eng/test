import test from 'node:test';
import assert from 'node:assert/strict';
import {labPitchGraphic} from '../penalty-lab-visual.mjs';
import {createLabSession,prepareLabKick,commitLabKick} from '../penalty-lab-core.mjs';
import {V4_STADIUMS,stadiumLight,labV4PitchGraphic,flightStyle,flightFrames,potentiallyDecisive} from '../penalty-lab-v4.mjs';
test('Les huit stades reprennent exactement leurs huit palettes OPFC existantes',()=>{
 assert.equal(Object.keys(V4_STADIUMS).length,8);
 for(const id of Object.keys(V4_STADIUMS)){
  assert.match(stadiumLight(id).light,/^#[0-9a-f]{6}$/i);
  assert.match(stadiumLight(id).secondary,/^#[0-9a-f]{6}$/i);
 }
 assert.deepEqual(stadiumLight('unk'),stadiumLight('mugiwara'));
});
test('Le terrain et le ballon V3 sont conservés ; seules trois zones du filet sont ajoutées',()=>{
 const base=labPitchGraphic(),v4=labV4PitchGraphic();
 assert.ok(base.includes('plab-net-mesh'));
 assert.equal((v4.match(/class="plab-net-mesh/g)||[]).length,3);
 for(const dir of ['left','center','right']){
  assert.ok(v4.includes('clipPath id="plab-v4-net-'+dir+'"'));
  assert.ok(v4.includes('plab-v4-net-'+dir));
 }
 assert.ok(!v4.includes('<defs><defs>'));
 const outline='M65 108 L7 297 H353 L295 108';
 assert.ok(base.includes(outline)&&v4.includes(outline));
});
test('Les trois hauteurs perçues changent seulement la trajectoire visuelle, pas la destination officielle',()=>{
 for(const outcome of ['goal','save','miss'])for(const shotDirection of ['GAUCHE','CENTRE','DROITE']){
  const a={shooterId:'test',shotNumber:3,shotDirection,keeperDirection:'CENTRE',outcome};
  const before=structuredClone(a);
  const p=flightFrames(a,360,365);
  assert.ok(['low','medium','high'].includes(p.flight));
  assert.equal(p.frames.length,5);
  assert.equal(p.frames[0].offset,0);
  assert.equal(p.frames.at(-1).offset,1);
  for(let i=1;i<p.frames.length;i++)assert.ok(p.frames[i].offset>p.frames[i-1].offset);
  assert.deepEqual(a,before);
  assert.equal(flightStyle(a),flightStyle(a));
 }
});
test('Un tir décisif est identifié AVANT de connaître son résultat',()=>{
 assert.equal(potentiallyDecisive(createLabSession({type:'penalty'})),false);
 const session=createLabSession({type:'shootout'});
 assert.equal(potentiallyDecisive(session),false);
 const near={type:'shootout',shootout:{
  phase:'active',nextClub:'OM',stage:'first-five',
  score:{PSG:4,OM:3},attempts:{PSG:[{},{},{},{}],OM:[{},{},{},{}]}
 }};
 assert.equal(potentiallyDecisive(near),true);
 const initial={type:'shootout',shootout:{
  phase:'active',nextClub:'PSG',stage:'first-five',
  score:{PSG:0,OM:0},attempts:{PSG:[],OM:[]}
 }};
 assert.equal(potentiallyDecisive(initial),false);
});
test('Le laboratoire V4 n altère aucun calcul de probabilité ni la sauvegarde',()=>{
 const session=createLabSession({type:'shootout'});
 const original=structuredClone(session);
 const forced=prepareLabKick(session,{shotDirection:'GAUCHE',keeperDirection:'DROITE',mode:'goal'});
 assert.equal(forced.attempt.scored,true);
 assert.deepEqual(session,original);
 const c=commitLabKick(session,forced);
 assert.equal(c.shootout.timeline.length,1);
 assert.equal(session.shootout.timeline.length,0);
});
