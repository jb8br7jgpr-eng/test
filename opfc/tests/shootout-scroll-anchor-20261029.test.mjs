/** OPFC: shootout scroll aligns the official tracker under the sticky header.
 * DOM/navigation only. Does not play games, call online services or store finals.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 matchFocusScrollTarget,shootoutTrackerScrollTarget,scrollToMatchFocus
} from '../v3-match-ux.mjs';

test('Shootout target anchors the TOP of the tracker, irrespective of its height',()=>{
 assert.equal(shootoutTrackerScrollTarget({
  top:330,scrollY:250,viewportOffset:0,topInset:152,maxScrollY:2000
 }),428);
 assert.equal(shootoutTrackerScrollTarget({
  top:330,scrollY:250,viewportOffset:0,topInset:152,maxScrollY:2000
 }),shootoutTrackerScrollTarget({
  top:330,scrollY:250,viewportOffset:0,topInset:152,maxScrollY:2000
 }));
 assert.equal(shootoutTrackerScrollTarget({
  top:330,scrollY:250,viewportOffset:13,topInset:152,maxScrollY:2000
 }),415,'Safari visual viewport offset');
 assert.equal(shootoutTrackerScrollTarget({
  top:40,scrollY:0,topInset:152,maxScrollY:2000
 }),0,'never scroll above document');
 assert.equal(shootoutTrackerScrollTarget({
  top:2500,scrollY:250,topInset:152,maxScrollY:1200
 }),1200,'clamp to available page height');
 assert.equal(matchFocusScrollTarget({
  top:330,height:180,scrollY:250,viewportHeight:800,topInset:152,bottomInset:16,maxScrollY:2000
 }),0,'other phases retain their existing bottom-aligned algorithm');
});

function simulate(phase,{tracker=true,result=true,final=true,viewportOffset=0,reduced=true}={}){
 const originalWindow=globalThis.window,originalDocument=globalThis.document;
 const select=[];
 const scrolls=[];
 const makeRect=(top,height,selector)=>({
  selector,
  getBoundingClientRect:()=>({top,height,bottom:top+height})
 });
 const trackerEl=tracker?makeRect(330,470,'.shootout-tracker'):null;
 const resultEl=result?makeRect(820,710,'.shot-result-unified'):null;
 const finalEl=final?makeRect(340,540,'.final-screen'):null;
 const header=makeRect(90,54,'.opfc-match-topbar');
 const root={
  dataset:{v3Phase:phase},
  querySelector(selector){
   select.push(selector);
   if(selector==='.shootout-tracker')return trackerEl;
   if(selector==='.opfc-match-topbar')return header;
   if(selector.includes('.final-screen'))return finalEl??trackerEl;
   if(selector.includes('.shot-result-unified'))return resultEl??makeRect(360,290,'.match-stage');
   if(selector.includes('.online-turn-wait'))return makeRect(370,260,'.online-turn-wait');
   return null;
  }
 };
 try{
  globalThis.window={
   scrollY:250,visualViewport:{height:800,offsetTop:viewportOffset},
   innerHeight:800,
   getComputedStyle(el){return el===root?{paddingBottom:'28px'}:{scrollMarginTop:'74px'};},
   matchMedia:()=>({matches:reduced}),
   scrollTo(options){scrolls.push(options)}
  };
  globalThis.document={scrollingElement:{scrollHeight:3500,clientHeight:800}};
  scrollToMatchFocus(root);
  return {scrolls,select,trackerEl,resultEl,finalEl};
 }finally{
  if(originalWindow===undefined)delete globalThis.window;else globalThis.window=originalWindow;
  if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;
 }
}

test('Local penalty result: tracker top is placed directly below the sticky header',()=>{
 const r=simulate('shootout',{tracker:true,result:true});
 assert.equal(r.scrolls.length,1);
 assert.deepEqual(r.scrolls[0],{top:428,behavior:'instant'});
 // Viewport target: rect.top + original scrollY - target = 330+250-428=152.
 assert.equal(330+250-r.scrolls[0].top,152);
});

test('Online penalty choices and results use the same tracker-first anchor',()=>{
 const r=simulate('shootout',{tracker:true,result:true,viewportOffset:11,reduced:false});
 assert.deepEqual(r.scrolls,[{top:417,behavior:'smooth'}]);
 assert.equal(330+250-r.scrolls[0].top,163);
 assert.equal(r.select[0],'.shootout-tracker');
});

test('Shootout final confirmation keeps tracker on top, normal final still shows final screen',()=>{
 assert.deepEqual(simulate('finished',{tracker:true,result:true}).scrolls,[{top:428,behavior:'instant'}]);
 const normal=simulate('finished',{tracker:false,result:false,final:true});
 assert.equal(normal.scrolls.length,1);
 assert.notEqual(normal.scrolls[0].top,428);
 assert.ok(normal.select.some(x=>x.includes('.final-screen')));
});

test('Regular match result and pre-shootout intro use old framing, with no forced tracker',()=>{
 const r=simulate('moment-result',{tracker:false,result:true});
 assert.ok(r.select.some(x=>x.includes('.shot-result-unified')));
 const pre=simulate('shootout-ready',{tracker:false,result:false});
 assert.ok(pre.select.some(x=>x.includes('.online-turn-wait')));
 assert.equal(pre.scrolls.length,1);
});

test('Existing synchronization guards, show/hide and CSS sizes are unchanged',()=>{
 const ui=readFileSync(new URL('../ui.mjs',import.meta.url),'utf8');
 const html=readFileSync(new URL('../../opfc.html',import.meta.url),'utf8');
 const tracker=readFileSync(new URL('../ui-shootout.mjs',import.meta.url),'utf8');
 assert.ok(ui.includes('onlineOwnTurnHasAction(app,snapshot?.phase)'));
 assert.ok(ui.includes('if(lastMatchStepKey===key)scrollToMatchFocus(app)'));
 assert.ok(ui.includes("if(action==='match-scroll-to-action'){scrollToMatchFocus(app);return;}"));
 assert.ok(html.includes('ui.mjs?v=opfc-shootout-scroll-20261029')||html.includes('ui.mjs?v=opfc-attack-stats-alignment-20261029'));
 assert.ok(ui.includes('v3-match-ux.mjs?v=opfc-shootout-scroll-20261029'));
 assert.ok(tracker.includes('<section class="panel shootout-tracker"'));
});
