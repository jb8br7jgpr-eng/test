/** Régression OPFC : penalty en ligne, mêmes tribunes chez tireur et gardien.
 * On part de la VRAIE projection publique de serveur pour chacun des iPhone,
 * sans toucher aux probabilités ou à la gestion des choix confidentiels.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createLabSession} from '../penalty-lab-core.mjs';
import {applyOnlineSetPieceTransition} from '../online-set-piece.mjs';
import {onlineMatchView} from '../online-match.mjs';
import {renderOnlineGame} from '../ui-online-game.mjs';
import {createPenaltySceneController} from '../penalty-scene.mjs';
import {STADIUMS} from '../stadiums.mjs';

const teams=createLabSession().teams;
const other=c=>c==='PSG'?'OM':'PSG';
const zeroStats=()=>({sequences:0,shots:0,onTarget:0,saves:0});
const makeState=(stadiumId,attacker)=>({
 version:1,phase:'match',stadiumId,competition:'league',dice:[2,3],
 teams:structuredClone(teams),
 match:{
  index:0,minute:36,score:{PSG:0,OM:0},goals:[],history:[],
  statistics:{PSG:zeroStats(),OM:zeroStats()},
  schedule:[{minute:36,period:1,attacker,type:'penalty'}],
  currentMoment:null,action:null,lastResult:null,competition:'league'
 }
});
const transition=(s,club,cmd)=>applyOnlineSetPieceTransition(s,club,cmd,()=>.98);
const renderTwoPhones=s=>['PSG','OM'].map(club=>{
 const publicView=onlineMatchView(s,club);
 return {club,view:publicView,html:renderOnlineGame(publicView,{
  myClub:club,hostClub:'PSG',competition:'league'
 })};
});
const expectCorrectStadium=(phones,id)=>{
 for(const p of phones){
  assert.equal(p.view.stadiumId,id,'Le serveur transmet le stade à '+p.club);
  assert.ok(p.html.includes('opfc-penalty-scene'),'Penalty visible sur '+p.club);
  assert.ok(p.html.includes('data-stadium="'+id+'"'),'Bon décor sur '+p.club+' : '+id);
  if(id!=='mugiwara')assert.ok(!p.html.includes('data-stadium="mugiwara"'),
   'Jamais Mugiwara comme décor de secours sur '+p.club);
 }
};

for(const [index,{id}] of STADIUMS.entries()){
 test('Stade '+id+' : même décor sur les 2 téléphones pendant les 2 choix du penalty',()=>{
  // Alterner l'équipe qui tire pour couvrir les deux sens de circulation.
  const attacking=index%2===0?'PSG':'OM',defending=other(attacking);
  const taker=teams.find(t=>t.club===attacking).slots[5];
  let state=makeState(id,attacking);
  state=transition(state,attacking,{type:'begin-setpiece'});
  state=transition(state,attacking,{type:'select-taker',takerId:taker});
  assert.equal(state.match.action.stage,'attack-choice');
  let phones=renderTwoPhones(state);
  expectCorrectStadium(phones,id);
  assert.equal((phones.find(x=>x.club===attacking).html.match(/data-action="online-choice"/g)||[]).length,3);
  assert.ok(phones.find(x=>x.club===defending).html.includes('online-turn-wait'));
  assert.equal((phones.find(x=>x.club===defending).html.match(/data-action="online-choice"/g)||[]).length,0);
  assert.ok(!phones.some(p=>p.html.includes('shotDirection')),'Choix caché avant résolution');
  state=transition(state,attacking,{type:'choose',choice:'GAUCHE'});
  assert.equal(state.match.action.stage,'defense-choice');
  phones=renderTwoPhones(state);
  expectCorrectStadium(phones,id);
  assert.equal((phones.find(x=>x.club===defending).html.match(/data-action="online-choice"/g)||[]).length,3);
  assert.ok(phones.find(x=>x.club===attacking).html.includes('online-turn-wait'));
  assert.equal((phones.find(x=>x.club===attacking).html.match(/data-action="online-choice"/g)||[]).length,0);
  assert.ok(!phones.some(p=>p.html.includes('shotDirection')),'Aucun secret dans l attente');
  state=transition(state,defending,{type:'choose',choice:'DROITE'});
  assert.equal(state.phase,'moment-result');
  for(const p of renderTwoPhones(state)){
   const ctrl=createPenaltySceneController({clock:()=>0,schedule:()=>1,cancel:()=>{}});
   const animation=ctrl.decorate(p.html,p.view);
   assert.ok(animation.includes('opfc-penalty-animation'));
   assert.ok(animation.includes('data-stadium="'+id+'"'),
    'Décor encore correct au moment de la frappe sur '+p.club);
   assert.ok(!animation.includes('data-stadium="'+other(id)+'"'));
   assert.ok(p.html.includes('shot-result-unified'),
    'Les écrans de résultats officiels demeurent inchangés');
  }
 });
}
test('Régression expliquée : si Wanodrome, le défenseur qui attend voit Wanodrome, jamais Mugiwara',()=>{
 let s=makeState('wanodrome','PSG');
 s=transition(s,'PSG',{type:'begin-setpiece'});
 s=transition(s,'PSG',{type:'select-taker',takerId:teams.find(t=>t.club==='PSG').slots[5]});
 const defender=renderTwoPhones(s).find(p=>p.club==='OM');
 assert.ok(defender.html.includes('online-turn-wait'));
 assert.ok(defender.html.includes('data-stadium="wanodrome"'));
 assert.ok(!defender.html.includes('data-stadium="mugiwara"'));
});
