/** Validation du décor premium, aucune dépendance réseau. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {labPitchGraphic,labBallGraphic} from '../penalty-lab-visual.mjs';

test('Cage en profondeur, filets détaillés et surfaces officielles',()=>{
 const svg=labPitchGraphic();
 assert.ok(svg.includes('plab-net-mesh'));
 assert.ok(svg.includes('plab-metal'));
 assert.ok(svg.includes('plab-blades'));
 assert.ok(svg.includes('M65 108 L7 297'));
 assert.ok(svg.includes('M118 108 L100 169'));
 assert.ok(svg.includes('cx="180" cy="248"'));
 assert.ok((svg.match(/<path/g)||[]).length>=33);
});
test('Ballon SVG aux panneaux noirs et blancs, courbure et couture',()=>{
 const svg=labBallGraphic();
 assert.ok(svg.includes('plab-ball-mat'));
 assert.ok(svg.includes('plab-ball-mask'));
 assert.ok(svg.includes('plab-ball-light'));
 assert.ok(svg.includes('M33 21 L47 13 L67 22'));
 assert.ok(svg.includes('M34 46 L65 46 L78 65'));
 assert.ok(svg.includes('stroke-dasharray'));
 assert.ok((svg.match(/<path/g)||[]).length>=9);
 assert.ok(svg.includes('viewBox="0 0 100 100"'));
});
test('Décor sans données de jeu ni accès distant',()=>{
 const graphics=labPitchGraphic()+labBallGraphic();
 assert.ok(!/supabase|localStorage|fetch\(|sessionStorage|https?:\/\//i.test(graphics));
});
