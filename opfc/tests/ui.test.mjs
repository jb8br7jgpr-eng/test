import test from 'node:test';
import assert from 'node:assert/strict';

const storage=new Map(),listeners=new Map();
let manualBidText=null;
const app={innerHTML:'',addEventListener(type,handler){listeners.set(type,handler);}};
globalThis.localStorage={
 getItem(key){return storage.has(key)?storage.get(key):null;},
 setItem(key,value){storage.set(key,value);},
 removeItem(key){storage.delete(key);}
};
globalThis.document={
 getElementById(id){
  if(id==='opfc-app')return app;
  if(id==='bid-value'){
   const state=stateOf();
   return {value:manualBidText??String((state?.auction?.highestBid===5?6:5)*1000000)};
  }
  return null;
 }
};
const stateOf=()=>JSON.parse(storage.get('opfc-v08-local-dev')??'{}')?.game??null;
const click=(action,data={})=>{
 const btn={dataset:{action,...data},disabled:false};
 listeners.get('click')({target:{closest(){return btn;}}});
};
const change=(action,club,value)=>{
 listeners.get('change')({target:{dataset:{action,club},value}});
};
await import('../ui.mjs');

test('Accueil : club au choix, deux formations, mode en ligne annoncé non prêt',()=>{
 assert.match(app.innerHTML,/La Grandline Cup/);
 assert.match(app.innerHTML,/Jouer en local/);
 assert.match(app.innerHTML,/Mode en ligne · salons privés/);
 assert.equal(stateOf(),null);
 click('online');
 assert.match(app.innerHTML,/Créer une partie/);
 assert.match(app.innerHTML,/Rejoindre une partie/);
 click('online-create-screen');
 assert.match(app.innerHTML,/n’est pas encore déployé/);
 assert.match(app.innerHTML,/disabled aria-disabled="true"/);
 click('online-back');
 click('online-back');
 assert.match(app.innerHTML,/La Grandline Cup/);
 click('club',{club:'OM'});
 change('initial-formation','OM','3-2-1');
 click('start');
 const s=stateOf();
 assert.equal(s.phase,'mercato');
 assert.equal(s.teams[0].club,'OM');
 assert.equal(s.teams.find(t=>t.club==='OM').formation,'3-2-1');
 assert.match(app.innerHTML,/Départ du mercato/);
 click('close');
 assert.match(app.innerHTML,/Mercato des légendes/);
 assert.doesNotMatch(app.innerHTML,/slot-field/);
 assert.match(app.innerHTML,/Voir les équipes/);
 click('toggle-teams');
 assert.match(app.innerHTML,/slot-field/);
 assert.match(app.innerHTML,new RegExp('data-top-club="'+stateOf().auction.turn+'"'));
 click('pitch-view',{club:stateOf().auction.turn==='PSG'?'OM':'PSG'});
 assert.match(app.innerHTML,new RegExp('data-top-club="'+(stateOf().auction.turn==='PSG'?'OM':'PSG')+'"'));
 click('toggle-teams');
 assert.doesNotMatch(app.innerHTML,/slot-field/);
 assert.match(app.innerHTML,/Berrys/);
 assert.match(app.innerHTML,/Refus utilisés :/);
 assert.match(app.innerHTML,/Restants :/);
 assert.match(app.innerHTML,/Refuser ce personnage · 5\/5 restants/);
 assert.match(app.innerHTML,/👁 Observation/);
 assert.match(app.innerHTML,/👑 Haki des Rois/);
 assert.match(app.innerHTML,/data-amount="6"/);
 assert.match(app.innerHTML,/data-amount="10"/);
 assert.match(app.innerHTML,/data-amount="15"/);
 assert.match(app.innerHTML,/Autre montant \\(฿\\)/);
 assert.match(app.innerHTML,/250 000 000 ฿/);
 assert.match(app.innerHTML,/5 000 000 ฿/);
 assert.match(app.innerHTML,/6 000 000 ฿/);
 assert.match(app.innerHTML,/\\+1 palier\\(s\\)/);
 assert.match(app.innerHTML,/value="5000000"/);
 // Ordre précis du modèle : saisie, refus pleine largeur, deux pouvoirs.
 const html=app.innerHTML,custom=html.indexOf('class="custom-bid"'),
  refusal=html.indexOf('class="pass-btn"'),
  hakis=html.indexOf('class="auction-hakis"');
 assert.ok(custom>0&&custom<refusal&&refusal<hakis);
 assert.equal((html.match(/class="haki-btn"/g)||[]).length,1);
 assert.equal((html.match(/class="extra-power"/g)||[]).length,1);
 manualBidText='5500000';
 click('bid');
 assert.equal(stateOf().auction.highestBid,0);
 assert.match(app.innerHTML,/multiple de 1 000 000/);
 manualBidText=null;
});
test('Un Haki Observation est privé avant la transmission puis masqué',()=>{
 let s=stateOf();
 const club=s.auction.turn;
 click('observation');
 s=stateOf();
 assert.equal(s.teams.find(t=>t.club===club).hakis.observation,true);
 assert.match(app.innerHTML,/Donne le téléphone/);
 assert.doesNotMatch(app.innerHTML,/Les cinq prochaines cartes dans leur ordre réel\./);
 click('observation-show');
 assert.match(app.innerHTML,/preview-list/);
 click('close');
 assert.doesNotMatch(app.innerHTML,/preview-list/);
});
test('Mercato réel et placement immédiat de chaque recrue : atteint kickoff-ready',()=>{
 const finishPlacement=()=>{
  const s=stateOf(),result=s.lastResult;
  if(!result?.winner)return;
  const club=result.winner,team=s.teams.find(t=>t.club===club);
  const slot=team.slots.indexOf(null);
  assert.ok(slot>=0);
  assert.match(app.innerHTML,/placement-intro/);
  assert.match(app.innerHTML,new RegExp('data-top-club="'+club+'"'));
  assert.match(app.innerHTML,/slot-field-single/);
  assert.equal((app.innerHTML.match(/class="field-half"/g)||[]).length,1);
  assert.match(app.innerHTML,/placement-metadata/);
  assert.match(app.innerHTML,/Note /);
  assert.match(app.innerHTML,/roster-tier/);
  assert.match(app.innerHTML,/team-chip-details/);
  assert.match(app.innerHTML,/continue-placement/);
  click('slot',{club,slot:String(slot)});
  assert.equal(stateOf().teams.find(t=>t.club===club).slots[slot],result.cardId);
  click('continue-placement');
  assert.doesNotMatch(app.innerHTML,/placement-intro/);
 };
 let rounds=0;
 while(stateOf().phase==='mercato'){
  if(++rounds>50)throw Error('Mercato local bloqué');
  const s=stateOf();
  if(s.auction.solo){click('solo');click('close');finishPlacement();continue;}
  click('bid'); // 5 M
  let after=stateOf();
  if(after.phase==='mercato'&&after.auction.highestBid===5){
   click('bid'); // 6 M
   after=stateOf();
   if(after.phase==='mercato'&&after.auction.highestBid===6)click('pass');
  }
  click('close'); // résultat d'enchère
  finishPlacement();
 }
 assert.equal(stateOf().phase,'lineup');
 assert.match(app.innerHTML,/Prépare le Classique/);
 assert.equal(stateOf().teams.reduce((n,t)=>n+t.roster.length,0),14);
 assert.equal(stateOf().teams.reduce((n,t)=>n+t.slots.filter(Boolean).length,0),14);
 assert.equal(new Set(stateOf().teams.flatMap(t=>t.roster)).size,14);
 for(const team of stateOf().teams){
  const club=team.club;
  for(let index=0;index<7;index++){
   const id=team.roster[index];
   click('pick',{club,card:id});
   click('slot',{club,slot:String(index)});
  }
  const positioned=stateOf().teams.find(t=>t.club===club);
  assert.deepEqual(positioned.slots,positioned.roster);
  click('ready',{club});
 }
 assert.equal(stateOf().phase,'kickoff-ready');
 assert.match(app.innerHTML,/Les équipes sont prêtes/);
 assert.match(app.innerHTML,/Donner le coup d’envoi/);
});
test('Depuis l’interface réelle, le coup d’envoi affiche le score et conserve le calendrier privé',()=>{
 click('match-kickoff');
 const next=stateOf();
 assert.equal(next.phase,'match');
 assert.equal(next.match.score.PSG,0);
 assert.equal(next.match.score.OM,0);
 assert.match(app.innerHTML,/match-scoreboard/);
 assert.match(app.innerHTML,/0 – 0/);
 assert.doesNotMatch(app.innerHTML,/schedule/);
});
test('La réinitialisation est confirmée et revient à l’accueil',()=>{
 click('confirm-reset');
 assert.match(app.innerHTML,/Nouvelle partie/);
 click('reset');
 assert.equal(stateOf(),null);
 assert.match(app.innerHTML,/La Grandline Cup/);
});
