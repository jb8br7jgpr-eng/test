/** OPFC Momentum Premium V2: pure decoration / no match or saved finals. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {renderMatchMomentum,momentumEntries,momentumBarLayout} from '../v4-momentum.mjs';

const skin=readFileSync(new URL('../v4-momentum-premium.css',import.meta.url),'utf8');
const svgSource=readFileSync(new URL('../v4-momentum.mjs',import.meta.url),'utf8');
const entry=readFileSync(new URL('../../opfc.html',import.meta.url),'utf8');
const localUI=readFileSync(new URL('../ui-match.mjs',import.meta.url),'utf8');
const onlineUI=readFileSync(new URL('../ui-online-game.mjs',import.meta.url),'utf8');
const appUI=readFileSync(new URL('../ui.mjs',import.meta.url),'utf8');
const theme=readFileSync(new URL('../v3-match.css',import.meta.url),'utf8');

const match={
 minute:62,
 history:[
  {attacker:'PSG',minute:10,outcome:'stopped'},
  {attacker:'OM',minute:33,outcome:'goal'},
  {attacker:'PSG',minute:49,outcome:'goal'},
  {attacker:'OM',minute:55,outcome:'save'}
 ]
};
const html=renderMatchMomentum(match,{open:true,clubA:'BW',clubB:'RM'});
const at=minute=>43+minute*(335-43)/90;

test('The original SVG 360x210, time anchors, stats and bar heights stay exactly the same',()=>{
 assert.match(html,/viewBox="0 0 360 210"/);
 assert.match(html,/x="43" y="48" width="292" height="104"/);
 assert.match(html,/height="13"/);
 assert.match(html,/height="37"/);
 assert.match(html,/height="49"/);
 assert.match(html,/62e min\./);
 assert.match(html,/DYNAMIQUE DU MATCH/);
 assert.match(html,/4 actions jouées/);
 assert.match(html,/BW/);
 assert.match(html,/RM/);
 assert.match(html,/x1="189\.00" y1="46" x2="189\.00" y2="154"/);
 assert.ok(html.includes('x1="'+at(62).toFixed(2)+'" y1="45"'));
 const values=momentumEntries(match);
 assert.equal(values.length,4);
 assert.deepEqual(values.map(e=>e.minute),[10,33,49,55]);
 assert.equal(momentumBarLayout(values).length,4);
});

test('Premium gradients have the same team colors and only decorate existing bar rectangles',()=>{
 assert.match(html,/id="opfc-momentum-bar-psg-gradient"/);
 assert.match(html,/id="opfc-momentum-bar-om-gradient"/);
 assert.match(html,/class="opfc-momentum-bar opfc-momentum-bar-psg"/);
 assert.match(html,/class="opfc-momentum-bar opfc-momentum-bar-om"/);
 assert.ok(html.includes('fill="#36C77A"'));
 assert.ok(html.includes('fill="#8996F4"'));
 assert.ok(skin.includes('fill:url(#opfc-momentum-bar-psg-gradient)'));
 assert.ok(skin.includes('fill:url(#opfc-momentum-bar-om-gradient)'));
 assert.ok(html.includes('<title>10e min. · BW · Attaque stoppée</title>'));
 assert.ok(html.includes('<title>33e min. · RM · But marqué</title>'));
});

test('Goal rings keep the exact original goal marker centers and size',()=>{
 const rings=[...html.matchAll(/<circle class="opfc-momentum-goal-ring [^"]+" cx="([^"]+)" cy="([^"]+)" r="11\.7"/g)];
 const circles=[...html.matchAll(/<circle class="opfc-momentum-goal-marker [^"]+" cx="([^"]+)" cy="([^"]+)" r="10"/g)];
 assert.equal(rings.length,2);
 assert.equal(circles.length,2);
 for(let i=0;i<rings.length;i++){
  assert.equal(rings[i][1],circles[i][1]);
  assert.equal(rings[i][2],circles[i][2]);
 }
 assert.ok(html.includes('33′'));
 assert.ok(html.includes('49′'));
});

test('An unopened Momentum remains exactly a compact toggle (no SVG or additional layout)',()=>{
 const closed=renderMatchMomentum(match,{open:false});
 assert.ok(closed.startsWith('<div class="opfc-momentum-wrap">'));
 assert.ok(closed.includes('Voir le momentum'));
 assert.ok(!closed.includes('<svg'));
 assert.ok(!closed.includes('opfc-momentum-panel"'));
});

test('Skin cannot alter screen, portrait, button, chart or hitbox dimensions',()=>{
 const stripped=skin.replace(/\/\*[\s\S]*?\*\//g,'');
 const props=[...stripped.matchAll(/(?:^|[;{])\s*([a-z-]+)\s*:/gm)].map(x=>x[1]);
 const forbidden=new Set([
  'width','height','min-width','max-width','min-height','max-height',
  'margin','margin-top','margin-right','margin-bottom','margin-left',
  'padding','padding-top','padding-right','padding-bottom','padding-left',
  'display','position','top','right','bottom','left','inset','gap','grid',
  'grid-template-columns','grid-template-rows','flex','flex-basis',
  'align-items','justify-content','transform','translate','scale',
  'font-size','line-height','font-family','letter-spacing','touch-action',
  'pointer-events','overflow','z-index','box-sizing'
 ]);
 for(const prop of props)assert.ok(!forbidden.has(prop), 'forbidden geometry/layout CSS: '+prop);
 assert.ok(props.length>20, 'expect enough paint-only declarations checked');
 assert.ok(!skin.includes('.shot-result-panel'),'no goal / result screen restyle');
 assert.ok(!skin.includes('.match-stage'),'no action screen restyle');
});

test('Animations are paint-only, tiny, accessible and do not block clicks or network',()=>{
 assert.ok(skin.includes('animation:opfc-momentum-premium-appear .16s ease-out both'));
 assert.ok(skin.includes('from{opacity:.88}'));
 assert.ok(skin.includes('@media(prefers-reduced-motion:reduce)'));
 assert.ok(skin.includes('animation:none!important'));
 assert.ok(!/animation-delay\s*:|transition-delay\s*:|pointer-events\s*:|setTimeout\(/.test(skin));
});

test('All eight existing stadium palettes flow through CSS variables',()=>{
 for(const id of ['mugiwara','wanodrome','erbaf','skypiea','alabasta','marineford','dressrosa','whole-cake']){
  assert.ok(theme.includes('data-v3-stadium="'+id+'"'));
  assert.ok(!skin.includes('data-v3-stadium="'+id+'"'),'the established palettes must not change');
 }
 assert.ok(skin.includes('var(--v3-primary'));
 assert.ok(skin.includes('var(--v3-secondary'));
 assert.ok(skin.includes('var(--v3-accent'));
});

test('Only the graph markup in the visual module changes; historical calculation stays byte-for-byte identical',()=>{
 const original=execFileSync('git',['show','origin/main:opfc/v4-momentum.mjs'],{encoding:'utf8'});
 const before=(src)=>src.slice(0,src.indexOf('export function renderMatchMomentum'));
 assert.equal(before(svgSource),before(original),'no bar layout, score, history or engine changes');
});

test('The local, online and standalone toggle share a fresh module and the new stylesheet',()=>{
 const key='v=opfc-momentum-premium-v2-20261028';
 assert.ok(entry.includes('v4-momentum-premium.css?'+key));
 assert.ok(entry.includes('opfc/ui.mjs?'+key));
 for(const [src,label] of [[appUI,'main UI'],[localUI,'local'],[onlineUI,'online']]){
  assert.ok(src.includes('v4-momentum.mjs?'+key),label+' uses same updated renderer');
 }
 assert.ok(appUI.includes('ui-match.mjs?'+key));
 assert.ok(appUI.includes('ui-online-game.mjs?'+key));
 assert.ok(onlineUI.includes('ui-match.mjs?'+key));
 assert.ok(appUI.includes('if(!patchOpenedMomentum())render()'),'efficient toggle stays in place');
});
