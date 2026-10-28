/** OPFC UI-only fluidity. Fake DOM: no actual matches or server access. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createStableMarkupCommitter,patchMomentumOnly,matchUiStepKey,matchFocusScrollTarget} from '../v3-match-ux.mjs';

function root(){
 let html='',writes=0,child=null;
 return {
  get innerHTML(){return html},
  set innerHTML(value){html=value;writes++;child=value?{}:null},
  get firstElementChild(){return child},
  get writes(){return writes}
 };
}

test('First UI render commits normally and repeated identical markup is a no-op',()=>{
 const target=root(),commit=createStableMarkupCommitter();
 assert.equal(commit.commit(target,'<main><button>Play</button></main>'),true);
 assert.equal(target.writes,1);
 for(let i=0;i<1000;i++)assert.equal(commit.commit(target,'<main><button>Play</button></main>'),false);
 assert.equal(target.writes,1,'1000 identical updates cause zero extra DOM rebuilds');
});

test('Actual scoreboard, pending state or opponent updates still render immediately',()=>{
 const target=root(),commit=createStableMarkupCommitter();
 const initial='<main><strong>1 – 0</strong></main>';
 assert.equal(commit.commit(target,initial),true);
 assert.equal(commit.commit(target,'<main><strong>1 – 1</strong></main>'),true);
 assert.equal(commit.commit(target,'<main>En attente adversaire</main>'),true);
 assert.equal(commit.commit(target,'<main>Ton tour</main>'),true);
 assert.equal(target.writes,4);
});

test('Keep live DOM input and images intact on visually unchanged update',()=>{
 const target=root(),commit=createStableMarkupCommitter();
 const html='<input value=""><img src="portrait.webp">';
 commit.commit(target,html);
 // Simulate native user editing value / focus without a source markup change.
 target.currentInput='22000000';
 const image={loaded:true};
 target.image=image;
 assert.equal(commit.commit(target,html),false);
 assert.equal(target.currentInput,'22000000');
 assert.equal(target.image,image);
 assert.equal(target.writes,1);
});

test('The cache is per-root and can be invalidated by a partial DOM patch',()=>{
 const a=root(),b=root(),commit=createStableMarkupCommitter();
 assert.equal(commit.commit(a,'<section>Match</section>'),true);
 assert.equal(commit.commit(b,'<section>Match</section>'),true);
 assert.equal(commit.commit(b,'<section>Match</section>'),false);
 commit.invalidate();
 assert.equal(commit.commit(b,'<section>Match</section>'),true);
 assert.equal(b.writes,2);
});

test('Empty DOM is reconstructed even if markup string was previously committed',()=>{
 const target=root(),commit=createStableMarkupCommitter();
 assert.equal(commit.commit(target,''),true);
 assert.equal(commit.commit(target,''),true);
 assert.equal(target.writes,2);
});

test('Only Momentum changes, all other DOM element identities stay the same',()=>{
 const score={textContent:'2 – 1'},faceoff={id:'faceoff'},buttons={id:'buttons'};
 let nextPanel=null,patched='';
 const initialPanel={
   contains:()=>false,
   set outerHTML(value){patched=value;nextPanel={newPanel:true};}
 };
 const tree={
  score,faceoff,buttons,
  querySelector(selector){
   if(selector==='.opfc-momentum-wrap')return nextPanel??initialPanel;
   return null;
  }
 };
 assert.equal(patchMomentumOnly(tree,'<div class="opfc-momentum-wrap">Opened</div>'),true);
 assert.equal(patched,'<div class="opfc-momentum-wrap">Opened</div>');
 assert.equal(tree.score,score);
 assert.equal(tree.faceoff,faceoff);
 assert.equal(tree.buttons,buttons);
 assert.equal(nextPanel.newPanel,true);
});

test('Momentum patch preserves keyboard focus when toggle was focused',()=>{
 const original=globalThis.document,focus={id:'active'};
 const newToggle={focused:0,options:null,focus(options){this.focused++;this.options=options;}};
 let swapped=false;
 const oldPanel={contains:x=>x===focus,set outerHTML(v){swapped=!!v;}};
 const target={querySelector:selector=>selector==='.opfc-momentum-wrap'?oldPanel:
       selector==='.opfc-momentum-toggle'?newToggle:null};
 try {
  globalThis.document={activeElement:focus};
  assert.equal(patchMomentumOnly(target,'<section>Expanded</section>'),true);
  assert.equal(swapped,true);
  assert.equal(newToggle.focused,1);
  assert.deepEqual(newToggle.options,{preventScroll:true});
 }finally{
  if(original===undefined)delete globalThis.document;
  else globalThis.document=original;
 }
});

test('If Momentum is not visible, patch asks for fallback full render',()=>{
 assert.equal(patchMomentumOnly({querySelector:()=>null},'<div></div>'),false);
 assert.equal(patchMomentumOnly(null,'<div></div>'),false);
});

test('Pure scroll and current-stage helpers remain compatible',()=>{
 const match={phase:'match',match:{index:3,action:{kind:'open',stage:'attack-choice',minute:38}}};
 assert.equal(matchUiStepKey(match),'match:3:open:attack-choice:38::::::');
 assert.equal(matchFocusScrollTarget({top:100,height:300,scrollY:400,viewportHeight:600,maxScrollY:1000}),216);
});

test('Browser boot path cache-busts the fluidity helpers (local + online)',()=>{
 const entry=readFileSync(new URL('../../opfc.html',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../ui.mjs',import.meta.url),'utf8');
 assert.ok(/ui\.mjs\?v=opfc-(?:fluidity|momentum-premium-v2)-20261028/.test(entry),'entry cache must refresh');
 assert.ok(ui.includes("v3-match-ux.mjs?v=opfc-fluidity-20261028"));
 assert.ok(ui.includes("const nextMarkup="));
 assert.ok(ui.includes('const domChanged=uiMarkupCommitter.commit(app,nextMarkup)'));
 assert.ok(ui.includes('}else if(key&&domChanged){'),'avoid no-op scroll calls');
 assert.ok(ui.includes('if(!patchOpenedMomentum())render()'));
 assert.ok(!ui.includes('app.innerHTML='));
});
