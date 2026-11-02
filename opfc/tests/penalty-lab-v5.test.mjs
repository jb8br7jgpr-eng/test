import test from 'node:test';
import assert from 'node:assert/strict';
import {labV4PitchGraphic} from '../penalty-lab-v4.mjs';
import {LAB_V5_CAMERA,labV5PitchGraphic} from '../penalty-lab-v5.mjs';

test('La caméra rapproche le but de 11 % et abaisse sa base, sans toucher au ballon',()=>{
 assert.ok(LAB_V5_CAMERA.goalScaleX>=1.1&&LAB_V5_CAMERA.goalScaleX<1.14);
 assert.ok(LAB_V5_CAMERA.goalScaleY>=1.07&&LAB_V5_CAMERA.goalScaleY<1.12);
 assert.equal(LAB_V5_CAMERA.ballYPercent,68);
 assert.equal(LAB_V5_CAMERA.shooterYPercent,85);
 assert.equal(LAB_V5_CAMERA.backgroundHeightPercent,28);
 assert.equal(LAB_V5_CAMERA.goalLeft+LAB_V5_CAMERA.goalRight,360);
});

test('Un seul groupe d agrandissement sur la cage : 3 filets V4 inchangés',()=>{
 const v4=labV4PitchGraphic();
 const v5=labV5PitchGraphic();
 assert.equal((v5.match(/class="plab-v5-goal-group"/g)||[]).length,1);
 assert.ok(v5.includes('scale(1.115 1.105)'));
 for(const p of ['plab-v4-net-left','plab-v4-net-center','plab-v4-net-right']){
  assert.ok(v4.includes(p)); assert.ok(v5.includes(p));
 }
 assert.equal((v5.match(/plab-v4-net-(left|center|right)/g)||[]).length,
  (v4.match(/plab-v4-net-(left|center|right)/g)||[]).length);
 assert.ok(v5.includes('M52 119 L7 297 H353 L308 119'));
 assert.equal(v5.split('M52 119 L7 297 H353 L308 119').length-1,2);
 assert.ok(!v5.includes('M65 108 L7 297 H353 L295 108'));
 assert.ok(v5.includes('<circle cx="180" cy="248" r="4"'));
 assert.ok(v5.includes('viewBox="0 0 360 365"'));
});

test('Le rectangle du futur décor n ajoute aucune dépendance au moteur ou au serveur',async()=>{
 const {readFileSync}=await import('node:fs');
 const src=readFileSync(new URL('../penalty-lab-v5.mjs',import.meta.url),'utf8');
 assert.ok(!/\b(fetch|localStorage|sessionStorage|Math\.random|resolvePenalty|advanceShootout|Supabase)\b/.test(src));
});
