import test from 'node:test';
import assert from 'node:assert/strict';
import {labV52PitchGraphic,NET_GRID,continuousNetPoints,continuousNetPaths} from '../penalty-lab-v5-2-net.mjs';
import {labV51ImpactPoint} from '../penalty-lab-v5-1-flight.mjs';
import {createLabSession,prepareLabKick} from '../penalty-lab-core.mjs';
test('Un seul filet sans découpage ni masques, toutes les lignes sont reliées',()=>{
 const html=labV52PitchGraphic();
 assert.equal((html.match(/class="plab-net-mesh/g)||[]).length,1);
 assert.ok(html.includes('class="plab-net-mesh plab-v52-net"'));
 assert.equal((html.match(/data-net-line=/g)||[]).length,NET_GRID.columns+NET_GRID.rows);
 assert.ok(!html.includes('clipPath id="plab-v4-net-'));
 assert.ok(!html.includes('clip-path="url(#plab-v4-net-'));
 assert.ok(!html.includes('class="plab-v4-net-'));
 assert.ok(html.includes('plab-v51-front-frame'));
});
test('Toutes les mailles sont cousues : lignes verticales/horizontales partagent exactement leurs sommets',()=>{
 for(const progress of [0,.13,.32,.55,.78,1]){
  const grid=continuousNetPoints({x:112,y:105},progress);
  assert.equal(grid.length,NET_GRID.rows);
  assert.equal(grid[0].length,NET_GRID.columns);
  const lines=continuousNetPaths({x:112,y:105},progress);
  assert.equal(lines.length,NET_GRID.columns+NET_GRID.rows);
  for(let j=0;j<NET_GRID.rows;j++)for(let i=0;i<NET_GRID.columns;i++){
   const token=(Math.round(grid[j][i].x*100)/100)+' '+(Math.round(grid[j][i].y*100)/100);
   assert.ok(lines[i].includes(token),'verticale '+i+' rejoint noeud '+j);
   assert.ok(lines[NET_GRID.columns+j].includes(token),'horizontale '+j+' rejoint noeud '+i);
  }
 }
});
test('Aucun bord ne se détache du cadre pendant une onde, quelle que soit la zone',()=>{
 for(const x of [105,180,255])for(const y of [91,105,122])for(const p of [.03,.15,.32,.58,.82,.95]){
  const initial=continuousNetPoints({x,y},0);
  const moving=continuousNetPoints({x,y},p);
  for(let i=0;i<NET_GRID.columns;i++){
   assert.deepEqual(moving[0][i],initial[0][i],'bord supérieur fixé');
   assert.deepEqual(moving.at(-1)[i],initial.at(-1)[i],'bord inférieur fixé');
  }
  for(let j=0;j<NET_GRID.rows;j++){
   assert.deepEqual(moving[j][0],initial[j][0],'montant gauche fixé');
   assert.deepEqual(moving[j].at(-1),initial[j].at(-1),'montant droit fixé');
  }
 }
});
test('Ondes locales continues, sans coupure à 1/3 ou 2/3 du but',()=>{
 const impact={x:111,y:106};
 const initial=continuousNetPoints(impact,0);
 const moving=continuousNetPoints(impact,.25);
 const len=(i,j)=>Math.hypot(moving[j][i].x-initial[j][i].x,moving[j][i].y-initial[j][i].y);
 const peak=Math.max(...moving.flatMap((row,j)=>row.map((_,i)=>len(i,j))));
 assert.ok(peak>1,'Déformation visible à l impact');
 assert.ok(peak<12,'Pas de saut exagéré');
 const close=len(5,6),far=len(17,6);
 assert.ok(close>far+.5,'Onde plus forte près du choc');
 for(const p of [.05,.17,.31,.42,.61,.84]){
  const grid=continuousNetPoints(impact,p);
  for(let j=0;j<NET_GRID.rows;j++)for(let i=1;i<NET_GRID.columns;i++){
   const dx=grid[j][i].x-grid[j][i-1].x;
   assert.ok(dx>6,'Aucune maille croisée/déchirée : '+dx+' à '+p);
  }
 }
});
test('Retour sans claquement, position finale identique au filet avant le tir',()=>{
 const impact={x:244,y:99};
 const base=continuousNetPaths(impact,0);
 const final=continuousNetPaths(impact,1);
 assert.deepEqual(final,base);
 const near=continuousNetPoints(impact,.98);
 const rest=continuousNetPoints(impact,0);
 const maxDiff=Math.max(...near.flatMap((line,j)=>line.map((p,i)=>
  Math.hypot(p.x-rest[j][i].x,p.y-rest[j][i].y))));
 assert.ok(maxDiff<.12,'Pas de grand saut à la toute dernière image : '+maxDiff);
});
test('Moteur OPFC inchangé pour les 3 directions et tous les résultats',()=>{
 const s=createLabSession({type:'penalty'});
 const before=structuredClone(s);
 for(const shotDirection of ['GAUCHE','CENTRE','DROITE'])
  for(const outcome of ['goal','save','miss']){
   const prepared=prepareLabKick(s,{shotDirection,keeperDirection:'CENTRE',mode:outcome});
   const a=prepared.attempt;
   assert.equal(a.outcome,outcome);
   if(outcome==='goal'){
    const p=labV51ImpactPoint(a);
    const html=labV52PitchGraphic();
    assert.ok(html.includes('plab-v52-net'));
    assert.ok(p.x>NET_GRID.left&&p.x<NET_GRID.right);
   }
  }
 assert.deepEqual(s,before);
});
test('Pas de réseau, stockage, hasard sportif ni calcul de résultat dans le filet',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('../penalty-lab-v5-2-net.mjs',import.meta.url),'utf8');
 assert.ok(!/\b(fetch|localStorage|sessionStorage|Math\.random|resolvePenalty|Supabase|applyShootoutKick)\b/.test(source));
});
