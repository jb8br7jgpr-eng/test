/** OPFC V5.5 — préchargement du seul décor de penalty lié au stade joué. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 STADIUMS,RESULT_STADIUM_BACKDROPS,PENALTY_STADIUM_BACKDROPS,
 preloadPenaltyBackdrop
} from '../stadiums.mjs';

test('Huit WebP correspondants exactement aux URL du décor de penalty CSS',()=>{
 const css=readFileSync(new URL('../penalty-scene-v5-5.css',import.meta.url),'utf8');
 assert.equal(Object.keys(PENALTY_STADIUM_BACKDROPS).length,8);
 for(const {id}of STADIUMS){
  const path='./opfc/assets/penalty-backgrounds/'+id+'.webp';
  assert.equal(PENALTY_STADIUM_BACKDROPS[id],path);
  assert.ok(css.includes('data-stadium="'+id+'"'));
  assert.ok(css.includes('url("./assets/penalty-backgrounds/'+id+'.webp")'));
  assert.notEqual(RESULT_STADIUM_BACKDROPS[id],path,'Ne pas confondre décor penalty et décor final');
 }
});

test('Le préchargement ne télécharge que le stade demandé, une seule fois par session',()=>{
 const saved=globalThis.Image;
 const created=[];
 class FakeImage{
  constructor(){this._src=null;created.push(this);}
  set src(src){this._src=src;}
  get src(){return this._src;}
 }
 try{
  globalThis.Image=FakeImage;
  preloadPenaltyBackdrop('faux-stade');
  preloadPenaltyBackdrop(null);
  assert.equal(created.length,0);
  preloadPenaltyBackdrop('marineford');
  assert.equal(created.length,1);
  assert.equal(created[0].src,'./opfc/assets/penalty-backgrounds/marineford.webp');
  assert.equal(created[0].decoding,'async');
  assert.equal(created[0].fetchPriority,'low');
  preloadPenaltyBackdrop('marineford');
  assert.equal(created.length,1,'Actualisations / polls ne déclenchent aucun second téléchargement');
  preloadPenaltyBackdrop('whole-cake');
  assert.equal(created.length,2);
  assert.ok(created[1].src.endsWith('/whole-cake.webp'));
 }finally{if(saved===undefined)delete globalThis.Image;else globalThis.Image=saved;}
});
test('Le jeu local et le jeu en ligne déclenchent le preload à la création / composition',()=>{
 const ui=readFileSync(new URL('../ui.mjs',import.meta.url),'utf8');
 assert.ok(ui.includes('preloadPenaltyBackdrop(localStadium);'));
 assert.ok(ui.includes('preloadPenaltyBackdrop(v3State.stadiumId);'));
 assert.ok(ui.includes('const v3State=onlineVisible?(showingGame?snapshot:null)'));
 assert.ok(ui.includes("const themePhases=['lineup','kickoff-ready'"));
 assert.ok(ui.includes('preloadStadiumBackdrop(v3State.stadiumId)'));
});
