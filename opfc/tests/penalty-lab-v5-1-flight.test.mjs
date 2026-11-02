import test from 'node:test';
import assert from 'node:assert/strict';
import {LAB_V51_CAMERA} from '../penalty-lab-v5-1.mjs';
import {labV51ImpactPoint,labV51FlightFrames} from '../penalty-lab-v5-1-flight.mjs';
import {flightFrames} from '../penalty-lab-v4.mjs';
import {createLabSession,prepareLabKick,trajectoryFor} from '../penalty-lab-core.mjs';
const directions=['GAUCHE','CENTRE','DROITE'];
const outcomes=['goal','save','miss'];
const c=LAB_V51_CAMERA;
const attempt=(shotDirection,keeperDirection,outcome,shooterId='roger',shotNumber=1)=>
 ({shotDirection,keeperDirection,outcome,shooterId,shotNumber});
test('Les 27 combinaisons direction/issue finissent dans la bonne zone de la cage V5.1',()=>{
 for(const shotDirection of directions)for(const keeperDirection of directions)for(const outcome of outcomes){
  const a=attempt(shotDirection,keeperDirection,outcome),before=structuredClone(a);
  const p=labV51ImpactPoint(a);
  assert.deepEqual(a,before,'Le résultat officiel ne doit jamais être modifié');
  const inside=p.x>=c.frontXLeft+12&&p.x<=c.frontXRight-12&&
   p.y>=c.frontCrossbarY+12&&p.y<=c.frontBaseY-12;
  if(outcome==='goal'){
   assert.ok(inside,'Un but doit finir complètement dans le filet : '+JSON.stringify(a)+' => '+JSON.stringify(p));
   if(shotDirection==='GAUCHE')assert.ok(p.x<180,'Tir à gauche doit rester à gauche');
   if(shotDirection==='DROITE')assert.ok(p.x>180,'Tir à droite doit rester à droite');
  }else if(outcome==='miss'){
   assert.ok(!inside,'Un raté ne doit jamais entrer dans le filet');
   if(shotDirection==='CENTRE')assert.ok(p.y<c.frontCrossbarY-12,'Raté central au-dessus de la barre');
   if(shotDirection==='GAUCHE')assert.ok(p.x<c.frontXLeft-12,'Raté gauche hors montant');
   if(shotDirection==='DROITE')assert.ok(p.x>c.frontXRight+12,'Raté droite hors montant');
  }else{
   assert.equal(p.x,Math.round((trajectoryFor(a).keeperX/100)*3600)/10);
   assert.ok(Math.abs(p.y-c.keeperYPercent*365/100)<1,'Arrêt aligné avec le gardien');
  }
 }
});
test('Les hauteurs visuelles basse/moyenne/haute ne sortent plus du cadre sur un BUT',()=>{
 const points=[];
 for(let i=0;i<300;i++){
  const p=labV51ImpactPoint(attempt('GAUCHE','DROITE','goal','tireur'+i,i));
  points.push(p);
  assert.ok(p.y>=85&&p.y<=126,'hauteur bien à l interieur : '+p.y);
 }
 assert.equal(new Set(points.map(x=>x.flight)).size,3);
 assert.equal(new Set(points.map(x=>x.y)).size,3);
});
test('Cadrage 390 px : toute animation garde son point final dans la cage et les mêmes directions',()=>{
 const width=350,height=331;
 for(const shotDirection of directions)for(const keeperDirection of directions)for(const outcome of outcomes){
  const a=attempt(shotDirection,keeperDirection,outcome);
  const p=labV51FlightFrames(a,width,height);
  assert.equal(p.frames[0].offset,0);
  assert.equal(p.frames.at(-1).offset,1);
  assert.equal(p.frames.length,5);
  assert.ok(p.frames.every(f=>Number.isFinite(f.offset)&&!f.transform.includes('NaN')));
  for(let i=1;i<p.frames.length;i++)assert.ok(p.frames[i].offset>p.frames[i-1].offset);
  const expected=labV51ImpactPoint(a);
  assert.deepEqual(p.impact,expected);
  assert.ok(Math.abs(p.x-width*(expected.x/360-.5))<.01);
  assert.ok(Math.abs(p.y-height*(expected.y/365-.68))<.01);
  assert.equal(p.keeperX,width*(trajectoryFor(a).keeperX/100-.5));
 }
});
test('L’ancien bug de but au-dessus de la barre est reproduit puis éliminé',()=>{
 const a=attempt('DROITE','GAUCHE','goal');
 const old=trajectoryFor(a);
 assert.equal(old.ballY,20,'Ancienne cible était à 20 % du terrain');
 assert.ok(old.ballY*365/100<LAB_V51_CAMERA.frontCrossbarY+12);
 const fixed=labV51ImpactPoint(a);
 assert.ok(fixed.y>LAB_V51_CAMERA.frontCrossbarY+12,'Nouveau tir dans les filets');
 const v4=flightFrames(a,350,331);
 const v51=labV51FlightFrames(a,350,331);
 assert.notEqual(v4.y,v51.y,'La trajectoire doit réellement changer à l écran');
});
test('Aucune modification du calcul : forcer but/arrêt/raté garde les issues officielles',()=>{
 const s=createLabSession({type:'penalty'});
 for(const mode of outcomes){
  const prepared=prepareLabKick(s,{shotDirection:'DROITE',keeperDirection:'GAUCHE',mode});
  assert.equal(prepared.attempt.outcome,mode);
  const projection=labV51FlightFrames(prepared.attempt,350,331);
  assert.equal(projection.impact.outcome,mode);
 }
});
test('Le correctif ne sauvegarde rien et ne dépend pas des états de match',async()=>{
 const {readFileSync}=await import('node:fs');
 const code=readFileSync(new URL('../penalty-lab-v5-1-flight.mjs',import.meta.url),'utf8');
 assert.ok(!/\\b(fetch|localStorage|sessionStorage|Math\\.random|Supabase|applyShootoutKick|resolvePenalty)\\b/.test(code));
});
