import test from 'node:test';
import assert from 'node:assert/strict';
import {LAB_V55_TURF,labV55PitchGraphic,labV55TurfGraphic} from '../penalty-lab-v5-5-turf.mjs';
import {labV52PitchGraphic} from '../penalty-lab-v5-2-net.mjs';

test('Pelouse réaliste V5.5 : hauteur précise 120..365, tonte en perspective',()=>{
 const s=labV55TurfGraphic();
 assert.ok(s.startsWith('<svg class="plab-v55-turf"'));
 assert.ok(s.includes('viewBox="0 0 360 365"'));
 assert.ok(s.includes('<clipPath id="plab-v55-grass-clip"><rect x="0" y="120" width="360" height="245"/></clipPath>'));
 assert.equal(LAB_V55_TURF.horizonY,120);
 assert.equal(LAB_V55_TURF.pitchEndY,365);
 assert.equal(LAB_V55_TURF.stripes.length,9);
 assert.equal(LAB_V55_TURF.grassBlades,2400);
 for(let i=1;i<LAB_V55_TURF.stripes.length;i++){
  assert.ok(LAB_V55_TURF.stripes[i]>LAB_V55_TURF.stripes[i-1]);
 }
 assert.ok(s.includes('plab-v55-grain'));
 assert.ok(s.includes('plab-v55-pitch-light'));
 assert.ok(s.includes('plab-v55-depth'));
});
test('2 400 brins dessinés en quatre chemins SVG : rendu stable sans hasard',()=>{
 const first=labV55TurfGraphic(),second=labV55TurfGraphic();
 assert.equal(first,second);
 const strokes=[...first.matchAll(/<path d="(M[\d. ].*?)" stroke="#(?:d0efb5|0b3926|a0d68a|052b22)"/g)];
 assert.equal(strokes.length,4,'Seulement quatre paths pour les brins');
 const count=strokes.reduce((sum,m)=>sum+(m[1].match(/M/g)||[]).length,0);
 assert.equal(count,LAB_V55_TURF.grassBlades,'Tous les 2 400 brins présents');
 assert.ok(first.length<125000,'Pas de DOM gonflé ni texture lourde');
});
test('Pelouse V5.5 : enlever UNIQUEMENT le pavage d herbe précédent',()=>{
 const old=labV52PitchGraphic(),current=labV55PitchGraphic();
 const tile='<rect x="0" y="120" width="360" height="245" fill="url(#plab-blades)"/>';
 assert.ok(old.includes(tile));
 assert.equal(current,old.replace(tile,''));
 assert.ok(current.includes('plab-v51-front-frame'));
 assert.equal((current.match(/data-net-line=/g)||[]).length,33);
 assert.ok(current.includes('M43 145 L7 297 H353 L317 145'));
 assert.ok(current.includes('cx="180" cy="248"'));
});
test('Aucun mouvement, sauvegarde ni impact sur les probabilités',async()=>{
 const {readFileSync}=await import('node:fs');
 const src=readFileSync(new URL('../penalty-lab-v5-5-turf.mjs',import.meta.url),'utf8');
 assert.ok(!/\b(fetch|localStorage|sessionStorage|Math\.random|resolvePenalty|Supabase|applyShootoutKick)\b/.test(src));
 assert.ok(!src.includes('requestAnimationFrame'));
});
