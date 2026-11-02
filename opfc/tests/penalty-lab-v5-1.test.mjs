import test from 'node:test';
import assert from 'node:assert/strict';
import {labV4PitchGraphic} from '../penalty-lab-v4.mjs';
import {labV5PitchGraphic} from '../penalty-lab-v5.mjs';
import {LAB_V51_CAMERA,labV51PitchGraphic} from '../penalty-lab-v5-1.mjs';

test('Cadrage TV: but +5 à +7%, décor 33%, gardien plus bas, ballon et tireur identiques',()=>{
 const c=LAB_V51_CAMERA;
 assert.ok(c.goalWidth/c.v5GoalWidth>=1.05 && c.goalWidth/c.v5GoalWidth<=1.075);
 assert.equal(c.backgroundHeightPercent,33);
 assert.equal(c.keeperYPercent,30.1);
 assert.equal(c.ballYPercent,68);
 assert.equal(c.shooterYPercent,85);
 assert.equal(c.frontXLeft+c.frontXRight,360);
 assert.equal(c.frontBaseY,145);
 assert.equal(c.frontCrossbarY-c.rearCrossbarY,12);
});
test('Perspective plus frontale : but SVG natif sans zoom du moteur, filet V4 en 3 parties',()=>{
 const v51=labV51PitchGraphic(),v5=labV5PitchGraphic(),v4=labV4PitchGraphic();
 assert.ok(v5.includes('plab-v5-goal-group'));
 assert.ok(!v51.includes('plab-v5-goal-group'));
 assert.ok(v51.includes('plab-v51-front-frame'));
 assert.ok(v51.includes('M43 145 V67 H317 V145'));
 assert.equal((v51.match(/class="plab-net-mesh plab-v4-net-/g)||[]).length,3);
 for(const region of ['left','center','right']){
  assert.ok(v4.includes('plab-v4-net-'+region));
  assert.ok(v51.includes('plab-v4-net-'+region));
  assert.ok(v51.includes('clipPath id="plab-v4-net-'+region+'"'));
 }
 assert.equal((v51.match(/clipPath id="plab-v4-net-/g)||[]).length,3);
 assert.ok(v51.includes('M43 145 L7 297 H353 L317 145'));
 assert.equal(v51.split('M43 145 L7 297 H353 L317 145').length-1,2);
 assert.ok(v51.includes('circle cx="180" cy="248" r="4"'));
 assert.ok(v51.includes('viewBox="0 0 360 365"'));
});
test('La hauteur supplémentaire du stade est réellement visible et non cachée par le dessin de la pelouse',()=>{
 const v51=labV51PitchGraphic();
 assert.ok(v51.includes('<rect x="0" y="120" width="360" height="245" fill="url(#plab-blades)"/>'));
 assert.ok(!v51.includes('<rect x="0" y="57" width="360" height="308"'));
 assert.ok(v51.includes('M43 67 L78 55 H282 L317 67'));
});
test('V5.1 reste une transformation décorative sans sauvegarde ni simulation',async()=>{
 const {readFileSync}=await import('node:fs');
 const code=readFileSync(new URL('../penalty-lab-v5-1.mjs',import.meta.url),'utf8');
 assert.ok(!/\b(fetch|localStorage|sessionStorage|Math\.random|resolvePenalty|applyShootoutKick|Supabase)\b/.test(code));
});
