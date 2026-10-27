/** OPFC — anti-régression du défilement intelligent iPhone.
 * La fonction de calcul est indépendante du DOM : aucune partie, finale,
 * statistique ou donnée persistante n'est créée pendant les tests.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 matchFocusScrollTarget,scrollToMatchFocus,onlineOwnTurnHasAction
} from '../opfc/v3-match-ux.mjs';

const base={
 top:500,height:340,scrollY:200,viewportHeight:750,
 viewportOffset:0,topInset:105,bottomInset:50,maxScrollY:1800
};
const target=o=>matchFocusScrollTarget({...base,...o});

test('Encart court : bas du résultat/action à la marge de sécurité du bas du téléphone',()=>{
 // 200 + (500 + 340) - (750 - 50) = 340
 assert.equal(target(),340);
 // Le haut reste visible sous les 105px réservés à l'en-tête.
 assert.ok(base.top-(340-base.scrollY)>=base.topInset);
});

test('Encart trop haut : garder son début lisible sous l’en-tête fixe',()=>{
 assert.equal(target({height:680}),595); // 200 + 500 - 105
 assert.equal(target({height:595}),595); // au-dessus de la zone utile
 assert.equal(target({height:594}),544); // tient tout juste : priorité au bas
});

test('Petits écrans, safe areas et bandeau navigateur Safari',()=>{
 assert.equal(target({viewportHeight:568,topInset:95,bottomInset:50,height:260}),392);
 assert.equal(target({viewportHeight:750,viewportOffset:20}),320);
 assert.equal(target({viewportHeight:700,topInset:120,bottomInset:70,height:400}),600);
});

test('Jamais de scroll négatif ou au-delà de la fin du document',()=>{
 assert.equal(target({top:30,scrollY:0,height:200}),0);
 assert.equal(target({maxScrollY:240}),240);
 assert.equal(target({maxScrollY:0}),0);
});

test('Véritable sélection de résultat et défilement fluide — sans lecture/écriture métier',()=>{
 const previousWindow=globalThis.window;
 const previousDocument=globalThis.document;
 let call=null;
 const focus={getBoundingClientRect:()=>({top:400,bottom:700,height:300})};
 const header={getBoundingClientRect:()=>({bottom:58})};
 const root={
  dataset:{v3Phase:'moment-result'},
  querySelector:s=>s==='.opfc-match-topbar'?header:
   s.includes('.shot-result-unified')?focus:null
 };
 globalThis.window={
  scrollY:200,innerHeight:720,visualViewport:{height:700,offsetTop:0},
  getComputedStyle:el=>el===root?{paddingBottom:'62px'}:{scrollMarginTop:'108px'},
  matchMedia:()=>({matches:false}),
  scrollTo:params=>{call=params;}
 };
 globalThis.document={scrollingElement:{scrollHeight:2200,clientHeight:800}};
 try{
  scrollToMatchFocus(root);
  assert.deepEqual(call,{top:250,behavior:'smooth'});
  // Zone trop courte : revenir à l'ancrage sûr sous l'en-tête.
  focus.getBoundingClientRect=()=>({top:400,bottom:1100,height:700});
  scrollToMatchFocus(root);
  assert.deepEqual(call,{top:492,behavior:'smooth'});
  globalThis.window.matchMedia=()=>({matches:true});
  scrollToMatchFocus(root);
  assert.deepEqual(call,{top:492,behavior:'instant'});
 }finally{
  if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;
  if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;
 }
});

test('En ligne, on ne défile toujours que lorsqu’un bouton de ce téléphone est actif',()=>{
 const content={
  querySelectorAll:()=>[{disabled:true,getAttribute:()=>null},
   {disabled:false,getAttribute:k=>k==='aria-disabled'?'true':null}]
 };
 const root={querySelector:s=>s==='.online-game-content.opfc-online-playing'?content:null};
 assert.equal(onlineOwnTurnHasAction(root,'match'),false);
 content.querySelectorAll=()=>[{disabled:false,getAttribute:()=>null}];
 assert.equal(onlineOwnTurnHasAction(root,'match'),true);
 assert.equal(onlineOwnTurnHasAction(root,'mercato'),false);
});

test('Bouton de retour manuel conservé, liens de cache mis à jour et moteur intact',()=>{
 const file=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
 const ui=file('opfc/ui.mjs'),html=file('opfc.html');
 assert.ok(ui.includes('onlineOwnTurnHasAction(app,snapshot?.phase)'));
 assert.ok(ui.includes("if(action==='match-scroll-to-action'){scrollToMatchFocus(app);return;}"));
 assert.ok(ui.includes('v3-match-ux.mjs?v=opfc-intelligent-scroll-20261028'));
 assert.ok(html.includes('ui.mjs?v=opfc-intelligent-scroll-20261028'));
 assert.ok(file('opfc/v3-palette-boost.css').includes('scroll-margin-top:calc(env(safe-area-inset-top) + 74px)'));
});
