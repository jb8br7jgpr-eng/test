/** Regression de l'intégration visuelle OPFC : moteur, règles et serveur inchangés. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {CARDS} from '../catalog.mjs';
import {createLabSession} from '../penalty-lab-core.mjs';
import {renderSetPieceAction,dispatchSetPieceMatch} from '../ui-set-piece.mjs';
import {onlineMatchView} from '../online-match.mjs';
import {applyOnlineSetPieceTransition} from '../online-set-piece.mjs';
import {applyOnlineEndgameTransition,onlineShootoutView} from '../online-endgame.mjs';
import {renderShootoutScreen,renderOnlineShootoutScreen} from '../ui-shootout.mjs';
import {renderShotResult} from '../ui-match-widgets.mjs';
import {renderMatchPenaltyScene,resolvedPenaltyForPresentation,createPenaltySceneController} from '../penalty-scene.mjs';

const lab=createLabSession({type:'shootout'});
const teams=lab.teams;
const a=teams[0].slots[5],b=teams[1].slots[0];
const resultHTML=renderShotResult({
 teams,match:{index:0,score:{PSG:0,OM:0}},phase:'moment-result'
},{outcome:'goal',attacker:'PSG',shooterId:a,keeperId:b,score:{PSG:1,OM:0}});
const mkState=(stage)=>({
 phase:'match',teams,match:{index:0,minute:30,score:{PSG:0,OM:0},
 action:{kind:'penalty',stage,index:0,minute:30,attacker:'PSG',defender:'OM',
  actors:{taker:{cardId:a}},keeper:{cardId:b},choices:{attack:null,defense:null}}}
});
test('La scène validée conserve précisément le ballon, le but, les filets et les deux portraits',()=>{
 const html=renderMatchPenaltyScene({shooterId:a,keeperId:b});
 assert.ok(html.includes('plab-ball-art'));
 assert.ok(html.includes('plab-net-mesh'));
 assert.ok(html.includes('M33 21 L47 13 L67 22'));
 assert.equal((html.match(/plab-keeper-portrait/g)||[]).length,1);
 assert.equal((html.match(/plab-shooter-portrait/g)||[]).length,1);
 assert.equal(renderMatchPenaltyScene({shooterId:'bogus',keeperId:b}),'');
});
test('Penalty en match : scène visible lors des choix offensif et défensif ; boutons OPFC conservés',()=>{
 for(const stage of ['attack-choice','defense-choice']){
  const s=mkState(stage);
  const html=renderSetPieceAction(s,s.match.action,{uncovered:true});
  assert.ok(html.includes('opfc-penalty-scene'));
  assert.equal((html.match(/data-action="match-choose"/g)||[]).length,3);
  assert.ok(html.includes('data-choice="GAUCHE"'));
  assert.ok(html.includes('match-tactical-choices'));
 }
 const outside=mkState('attack-choice');
 outside.match.action.kind='free-kick';
 assert.ok(!renderSetPieceAction(outside,outside.match.action,{uncovered:true}).includes('opfc-penalty-scene'));
});
test('TAB local : tracker et boutons d origine + nouvelle scène, sans moteur modifié',()=>{
 const state={phase:'shootout',teams,match:{shootout:lab.shootout,shootoutPending:null,shootoutLastResult:null}};
 const html=renderShootoutScreen(state,{uncovered:true});
 assert.ok(html.includes('shootout-tracker'));
 assert.ok(html.includes('shootout-mark--pending'));
 assert.ok(html.includes('opfc-penalty-scene'));
 assert.equal((html.match(/data-action="match-shootout-choose"/g)||[]).length,3);
});
test('TAB en ligne : mêmes portraits et scène, aucun choix secret envoyé aux deux iPhone',()=>{
 const first=lab.shootout.firstClub,turn=lab.shootout.nextClub??first;
 const p=turn==='PSG'?teams[0]:teams[1];
 const k=turn==='PSG'?teams[1]:teams[0];
 const publicState={phase:'shootout',teams,match:{shootout:{
  phase:'active',stage:'initial',winner:null,firstClub:first,nextClub:turn,
  score:{PSG:0,OM:0},timeline:[],active:{
   club:turn,shotNumber:1,shooterId:p.slots[5],keeperId:k.slots[0]
  },confirmed:{shooter:false,keeper:false},lastResult:null
 }}};
 const owner=renderOnlineShootoutScreen(publicState,{myClub:turn,hostClub:'PSG'});
 assert.ok(owner.includes('opfc-penalty-scene'));
 assert.equal((owner.match(/data-action="online-choice"/g)||[]).length,3);
 assert.ok(!owner.includes('shotDirection'));
 const other=renderOnlineShootoutScreen(publicState,{myClub:turn==='PSG'?'OM':'PSG',hostClub:'PSG'});
 assert.ok(other.includes('online-turn-wait'));
 assert.ok(other.includes('opfc-penalty-scene'));
 assert.ok(!other.includes('shotDirection'));
 assert.ok(!other.includes('data-action="online-choice"'));
});
test('Avant résolution : les directions de penalty ne sont jamais rendues',()=>{
 const s=mkState('defense-choice');
 assert.equal(resolvedPenaltyForPresentation(s),null);
 s.phase='moment-result';
 s.match.lastResult={outcome:'goal',minute:30,attacker:'PSG',details:{kind:'penalty',takerId:a,keeperId:b}};
 assert.equal(resolvedPenaltyForPresentation(s),null);
});
test('Après résolution officielle : animation locale et en ligne déduite sans nouveau tirage',()=>{
 const state={phase:'moment-result',teams,match:{index:0,history:[],
  lastResult:{outcome:'save',minute:30,attacker:'PSG',details:{
   kind:'penalty',takerId:a,keeperId:b,shot:{calculation:{
    shotDirection:'DROITE',keeperDirection:'DROITE'
   }}
  }}}};
 const shot=resolvedPenaltyForPresentation(state);
 assert.equal(shot.outcome,'save');
 assert.equal(shot.shotDirection,'DROITE');
 assert.equal(shot.keeperDirection,'DROITE');
 assert.equal(resolvedPenaltyForPresentation({...state,match:{...state.match,lastResult:null}}),null);
});
test('TAB : seul le résultat déjà public est animé, local et projection réseau',()=>{
 const kick={club:'PSG',shotNumber:1,shooterId:a,keeperId:b,
  shotDirection:'GAUCHE',keeperDirection:'CENTRE',result:'goal',scored:true};
 const local={phase:'shootout',match:{shootoutLastResult:kick,shootout:{timeline:[kick]}}};
 const online={phase:'shootout',match:{shootout:{lastResult:kick,timeline:[kick]}}};
 assert.equal(resolvedPenaltyForPresentation(local).key,resolvedPenaltyForPresentation(online).key);
 assert.equal(resolvedPenaltyForPresentation({phase:'shootout',match:{shootout:{timeline:[]}}}),null);
});
test('Un résultat s anime exactement une fois, même si les polls reviennent, puis écran d origine',()=>{
 let now=0,fired=null,done=0;
 const controller=createPenaltySceneController({
  clock:()=>now,schedule:fn=>{fired=fn;return 1},
  cancel:()=>{},onFinish:()=>done++
 });
 const kick={club:'PSG',shotNumber:1,shooterId:a,keeperId:b,
  shotDirection:'GAUCHE',keeperDirection:'DROITE',result:'goal',scored:true};
 const state={phase:'shootout',match:{shootout:{lastResult:kick,timeline:[kick]}}};
 const before=structuredClone(state);
 let html=controller.decorate(resultHTML,state);
 assert.ok(html.includes('opfc-penalty-animation'));
 assert.ok(!html.includes('shot-result-panel'));
 now=300;
 assert.ok(controller.decorate(resultHTML,state).includes('opfc-penalty-animation'));
 fired();assert.equal(done,1);
 assert.equal(controller.decorate(resultHTML,state),resultHTML);
 assert.deepEqual(state,before);
 assert.equal(controller.decorate(resultHTML,{phase:'finished',match:{shootout:{lastResult:null}}}),resultHTML);
 assert.ok(controller.decorate(resultHTML,{...state,match:{shootout:{lastResult:{...kick,shotNumber:2}}}})
  .includes('opfc-penalty-animation'));
});
test('Le module ne contient aucun appel de validation, calcul de hasard ou sauvegarde',async()=>{
 const {readFileSync}=await import('node:fs');
 const code=readFileSync(new URL('../penalty-scene.mjs',import.meta.url),'utf8');
 assert.ok(!/\b(fetch|localStorage|sessionStorage|Math\.random|advanceShootout|resolvePenalty|Supabase)\b/.test(code));
});

const zeroStats=()=>({sequences:0,shots:0,onTarget:0,saves:0});
function penaltyMatch(){
 return {
  version:1,phase:'match',teams:structuredClone(teams),competition:'league',
  match:{
   index:0,minute:36,score:{PSG:0,OM:0},goals:[],history:[],
   statistics:{PSG:zeroStats(),OM:zeroStats()},
   schedule:[{minute:36,period:1,attacker:'PSG',type:'penalty'}],
   currentMoment:null,action:null,lastResult:null,competition:'league'
  }
 };
}
test('Vrai moteur en local : 2 choix confidentiels, 1 seul tir et animation avant résultat',()=>{
 let state=penaltyMatch();
 state=dispatchSetPieceMatch(state,'begin-setpiece');
 state=dispatchSetPieceMatch(state,'select-taker',{takerId:a});
 assert.ok(renderSetPieceAction(state,state.match.action,{uncovered:true}).includes('opfc-penalty-scene'));
 state=dispatchSetPieceMatch(state,'choose',{choice:'GAUCHE'});
 assert.equal(state.match.action.stage,'defense-choice');
 assert.equal(resolvedPenaltyForPresentation(state),null);
 const privateChoice=state.match.action.choices.attack;
 const before=state.match.history.length;
 state=dispatchSetPieceMatch(state,'choose',{choice:'DROITE',rng:()=>.99});
 assert.equal(state.phase,'moment-result');
 assert.equal(state.match.history.length,before+1);
 assert.equal(state.match.lastResult.details.shot.calculation.shotDirection,privateChoice);
 assert.ok(resolvedPenaltyForPresentation(state));
 assert.ok(resultHTML.includes('shot-result-unified'));
});
test('Vrai serveur de penalty : aucune direction révélée après le 1er choix ; résultat partagé après le second',()=>{
 const noRng=()=>.99;
 let state=penaltyMatch();
 state=applyOnlineSetPieceTransition(state,'PSG',{type:'begin-setpiece'},noRng);
 state=applyOnlineSetPieceTransition(state,'PSG',{type:'select-taker',takerId:a},noRng);
 state=applyOnlineSetPieceTransition(state,'PSG',{type:'choose',choice:'GAUCHE'},noRng);
 const aView=onlineMatchView(state,'PSG'),bView=onlineMatchView(state,'OM');
 assert.equal(aView.match.action.stage,'defense-choice');
 assert.equal(aView.match.action.confirmed.attacker,true);
 assert.ok(!JSON.stringify(aView.match.action).includes('"GAUCHE"'));
 assert.ok(!JSON.stringify(bView.match.action).includes('"GAUCHE"'));
 state=applyOnlineSetPieceTransition(state,'OM',{type:'choose',choice:'DROITE'},noRng);
 assert.equal(state.phase,'moment-result');
 assert.equal(state.match.history.length,1);
 for(const club of ['PSG','OM']){
  const view=onlineMatchView(state,club);
  assert.equal(view.match.lastResult.details.shot.calculation.shotDirection,'GAUCHE');
  assert.equal(view.match.lastResult.details.shot.calculation.keeperDirection,'DROITE');
  assert.ok(resolvedPenaltyForPresentation(view));
 }
});
test('Vrai serveur TAB : un choix caché, un résultat après le second, scène identique sur les deux téléphones',()=>{
 const first=lab.shootout.firstClub;
 const second=first==='PSG'?'OM':'PSG';
 let state={phase:'shootout',teams:structuredClone(teams),match:{
  score:{PSG:0,OM:0},shootout:structuredClone(lab.shootout),shootoutPending:null,shootoutLastResult:null
 }};
 state=applyOnlineEndgameTransition(state,first,{type:'shootout-choose',choice:'GAUCHE'},{hostClub:'PSG',rng:()=>.5});
 const before=onlineShootoutView(state);
 assert.equal(before.confirmed.shooter,true);
 assert.equal(before.confirmed.keeper,false);
 assert.ok(!JSON.stringify(before).includes('shotDirection'));
 state=applyOnlineEndgameTransition(state,second,{type:'shootout-choose',choice:'DROITE'},{hostClub:'PSG',rng:()=>.99});
 assert.equal(state.match.shootout.timeline.length,1);
 const attempt=onlineShootoutView(state);
 assert.equal(attempt.lastResult.shotDirection,'GAUCHE');
 assert.equal(attempt.lastResult.keeperDirection,'DROITE');
 const view={phase:'shootout',match:{shootout:attempt}};
 assert.ok(resolvedPenaltyForPresentation(view));
 assert.equal(renderOnlineShootoutScreen({...view,teams}, {myClub:first,hostClub:'PSG'}).includes('shot-result-unified'),true);
 assert.equal(renderOnlineShootoutScreen({...view,teams}, {myClub:second,hostClub:'PSG'}).includes('shot-result-unified'),true);
});
