import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../v4-premium-skin.css',import.meta.url),'utf8');
const entry=readFileSync(new URL('../../opfc.html',import.meta.url),'utf8');
const basePalette=readFileSync(new URL('../v3-match.css',import.meta.url),'utf8');

test('Premium skin is isolated AFTER compact and established palettes',()=>{
 const compact=entry.indexOf('v4-action-compact.css');
 const premium=entry.indexOf('v4-premium-skin.css?v=opfc-premium-cosmetic-20261028');
 const script=entry.search(/opfc\/ui\.mjs\?v=opfc-(?:fluidity-20261028|momentum-premium-v2-20261028|shootout-scroll-20261029)/);
 assert.ok(compact>=0&&premium>compact&&script>premium);
});

test('All eight established stadium color palettes remain the only source of color identities',()=>{
 for(const id of ['mugiwara','wanodrome','erbaf','skypiea','alabasta','marineford','dressrosa','whole-cake']){
  assert.ok(basePalette.includes('data-v3-stadium="'+id+'"'));
  assert.ok(!css.includes('data-v3-stadium="'+id+'"'),id+' cannot be individually overridden');
 }
 assert.ok(css.includes('--v3-primary'));
 assert.ok(css.includes('--v3-secondary'));
 assert.ok(css.includes('--v3-accent'));
});

test('No layout, font, input, game logic or hitbox dimension changes',()=>{
 const cleaned=css.replace(/\/\*[\s\S]*?\*\//g,'');
 const props=[...cleaned.matchAll(/[;{]\s*([a-z-]+)\s*:/g)].map(x=>x[1]);
 const blocked=new Set([
  'width','height','min-width','max-width','min-height','max-height',
  'margin','margin-top','margin-right','margin-bottom','margin-left',
  'padding','padding-top','padding-right','padding-bottom','padding-left',
  'gap','row-gap','column-gap','grid','grid-template','grid-template-columns',
  'grid-template-rows','flex','flex-basis','flex-grow','flex-shrink',
  'display','align-items','justify-content','overflow','font-size',
  'font-family','font-weight','line-height','letter-spacing','box-sizing',
  'cursor','touch-action','user-select','pointer-events-block'
 ]);
 for(const property of props)assert.ok(!blocked.has(property),'Geometry-affecting declaration: '+property);
 assert.ok(props.length>30,'Guard must examine actual CSS declarations');
 assert.ok(!css.includes('.match-tactical-choices>.match-choice'),'button markup and geometry not touched');
 assert.ok(!css.includes('score-digit-goal'),'existing scored-goal pulse remains untouched');
});

test('All action entry effects are short, have no timing delay and respect reduced motion',()=>{
 assert.match(css,/@keyframes opfc-premium-action-enter/);
 assert.match(css,/animation:opfc-premium-action-enter \.18s/);
 assert.match(css,/animation:opfc-premium-action-enter \.16s/);
 assert.ok(!/animation-delay\s*:|transition-delay\s*:/.test(css));
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.ok(css.includes('animation:none!important'));
});

test('Goal, shot result and final screen existing premium motion stays intact',()=>{
 assert.ok(css.includes('.match-stage:not(.shot-result-panel)'));
 assert.ok(!/\.shot-result-(?:unified|goal|save|miss|stopped|panel)\s*\{/.test(css));
 assert.ok(!css.includes('.final-screen{'));
 assert.ok(basePalette.includes('.score-digit-goal{animation:opfc-score-pulse'));
});

test('Premium effects emphasize attacker, VS, card depth and stadium',()=>{
 for(const marker of [
  '.match-duelist:first-child .character-portrait.faceoff-portrait',
  '.match-faceoff-immersive .faceoff-vs::before',
  '.match-faceoff-immersive .match-duelist{',
  '.match-attack-banner{',
  '.halftime-stat-rows,',
  '.match-scoreboard{'
 ])assert.ok(css.includes(marker),'Missing premium detail: '+marker);
});
