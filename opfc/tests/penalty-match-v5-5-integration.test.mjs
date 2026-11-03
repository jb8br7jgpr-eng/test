/** OPFC : inclusion strictement visuelle de la caméra et du terrain V5.5.
 * Le moteur local, le serveur en ligne et les écrans de résultats ne changent pas.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createLabSession} from '../penalty-lab-core.mjs';
import {renderMatchPenaltyScene,resolvedPenaltyForPresentation,createPenaltySceneController} from '../penalty-scene.mjs';
import {labV55TurfGraphic,labV55PitchGraphic} from '../penalty-lab-v5-5-turf.mjs';
import {labV51FlightFrames} from '../penalty-lab-v5-1-flight.mjs';
import {renderShootoutScreen,renderOnlineShootoutScreen} from '../ui-shootout.mjs';
import {renderSetPieceAction} from '../ui-set-piece.mjs';
import {matchUiStepKey,shootoutTrackerScrollTarget} from '../v3-match-ux.mjs';

const session=createLabSession({type:'shootout'});
const teams=session.teams;
const shooter=teams[0].slots[5],keeper=teams[1].slots[0];
const attempt={club:'PSG',shotNumber:1,shooterId:shooter,keeperId:keeper,shotDirection:'GAUCHE',
 keeperDirection:'DROITE',result:'goal',scored:true};
const otherClub=c=>c==='PSG'?'OM':'PSG';

test('L illustration des vrais matchs est exactement celle du labo V5.5 : gazon et SVG',()=>{
 const markup=renderMatchPenaltyScene({shooterId:shooter,keeperId:keeper,stadiumId:'alabasta'});
 assert.ok(markup.includes(labV55TurfGraphic()));
 assert.ok(markup.includes(labV55PitchGraphic()));
 assert.equal((markup.match(/data-net-line=/g)||[]).length,33);
 assert.ok(markup.includes('plab-v51-front-frame'));
 assert.ok(markup.includes('data-stadium="alabasta"'));
 assert.equal((markup.match(/plab-keeper-portrait/g)||[]).length,1);
 assert.equal((markup.match(/plab-shooter-portrait/g)||[]).length,1);
 assert.ok(markup.includes('data-penalty-ball'));
 assert.equal(renderMatchPenaltyScene({shooterId:'invalid',keeperId:keeper}),'');
});
test('Huit stades : mapping officiel et pixels de la même collection V5.4',()=>{
 const css=readFileSync(new URL('../penalty-scene-v5-5.css',import.meta.url),'utf8');
 const ids=['mugiwara','wanodrome','erbaf','skypiea','alabasta','marineford','dressrosa','whole-cake'];
 for(const id of ids){
  assert.ok(css.includes('data-stadium="'+id+'"'));
  assert.ok(css.includes('/'+id+'.webp'));
  assert.ok(renderMatchPenaltyScene({shooterId:shooter,keeperId:keeper,stadiumId:id}).includes('data-stadium="'+id+'"'));
 }
 assert.ok(css.includes('height:33%'));
 assert.ok(css.includes('top:30.1%'));
 assert.ok(css.includes('plab-v55-turf'));
 assert.ok(css.includes('.plab-v52-net'));
 assert.ok(!css.includes('.shot-result-unified'));
});
test('Un penalty de match et les TAB locaux héritent du stade de la partie',()=>{
 const state={phase:'shootout',stadiumId:'marineford',teams,match:{
  shootout:session.shootout,shootoutPending:null,shootoutLastResult:null
 }};
 const local=renderShootoutScreen(state,{uncovered:true});
 assert.ok(local.includes('data-stadium="marineford"'));
 assert.ok(local.includes('data-action="match-shootout-choose"'));
 assert.ok(local.includes('shootout-tracker'));
 const sc={phase:'match',stadiumId:'dressrosa',teams,match:{action:{kind:'penalty',
  stage:'attack-choice',attacker:'PSG',defender:'OM',
  actors:{taker:{cardId:shooter}},keeper:{cardId:keeper}}}};
 assert.ok(renderSetPieceAction(sc,sc.match.action,{uncovered:true}).includes('data-stadium="dressrosa"'));
});
test('Les deux téléphones reçoivent le même décor, pas les directions confidentielles',()=>{
 const first=session.shootout.firstClub;
 const scoring=first==='PSG'?teams[0]:teams[1],guarding=first==='PSG'?teams[1]:teams[0];
 const s={phase:'shootout',stadiumId:'whole-cake',teams,match:{shootout:{
  phase:'active',stage:'first-five',winner:null,firstClub:first,nextClub:first,
  score:{PSG:0,OM:0},timeline:[],active:{
   club:first,shotNumber:1,shooterId:scoring.slots[5],keeperId:guarding.slots[0]
  },confirmed:{shooter:false,keeper:false},lastResult:null
 }}};
 const shooterHtml=renderOnlineShootoutScreen(s,{myClub:first,hostClub:first});
 const keeperHtml=renderOnlineShootoutScreen(s,{myClub:otherClub(first),hostClub:first});
 for(const markup of [shooterHtml,keeperHtml]){
  assert.ok(markup.includes('data-stadium="whole-cake"'));
  assert.ok(markup.includes('plab-v55-turf'));
  assert.ok(!markup.includes('shotDirection'));
 }
});
test('Les trajectoires restent calculées par le module exact V5.1 après résultat officiel',()=>{
 const actual={phase:'shootout',stadiumId:'erbaf',match:{shootoutLastResult:attempt,shootout:{
  timeline:[attempt]}}};
 const before=structuredClone(actual),p=resolvedPenaltyForPresentation(actual);
 assert.equal(p.stadiumId,'erbaf');
 assert.equal(p.outcome,'goal');
 const traj=labV51FlightFrames(p,390,368);
 assert.equal(traj.impact.outcome,'goal');
 assert.ok(traj.impact.x>43&&traj.impact.x<317);
 assert.ok(traj.impact.y>67&&traj.impact.y<145);
 assert.deepEqual(actual,before);
});
test('Après un tir local et après un tir en ligne, clé différente : retour du suivi en haut',()=>{
 const base={phase:'shootout',match:{index:12,shootout:{
  stage:'first-five',timeline:[],score:{PSG:0,OM:0}
 }}};
 const localBefore=matchUiStepKey(base);
 const localAfter=matchUiStepKey({phase:'shootout',match:{...base.match,shootoutLastResult:attempt}});
 assert.notEqual(localBefore,localAfter,'Le résultat local doit déclencher le retour automatique');
 const onlineBefore=matchUiStepKey({phase:'shootout',match:{...base.match,shootout:{
  ...base.match.shootout,active:{shotNumber:1},lastResult:null
 }}});
 const onlineAfter=matchUiStepKey({phase:'shootout',match:{...base.match,shootout:{
  ...base.match.shootout,active:{shotNumber:2},lastResult:attempt
 }}});
 assert.notEqual(onlineBefore,onlineAfter,'Le résultat en ligne doit déclencher le retour automatique');
 const target=shootoutTrackerScrollTarget({top:330,scrollY:250,viewportOffset:0,topInset:152,maxScrollY:2000});
 assert.equal(target,428,'Le haut du suivi est à 152px sous le haut d écran');
 const ui=readFileSync(new URL('../ui.mjs',import.meta.url),'utf8');
 assert.ok(ui.includes("const animatedKickResult=!!app.querySelector('.opfc-penalty-animation')"));
 assert.ok(ui.includes('onlineOwnTurnHasAction(app,snapshot?.phase)||animatedKickResult'));
 assert.ok(ui.includes('scrollToMatchFocus(app)'));
});
test('La transition n affecte pas le résultat déjà résolu, ni le moteur ou le serveur',()=>{
 const c=createPenaltySceneController({clock:()=>0,schedule:()=>1,cancel:()=>{}});
 const result='<section class="panel match-stage shot-result-panel"><h2>RESULTAT OFFICIEL</h2></section>';
 const state={phase:'shootout',stadiumId:'skypiea',match:{shootoutLastResult:attempt,shootout:{
  timeline:[attempt],score:{PSG:1,OM:0}
 }}};
 const original=structuredClone(state);
 const markup=c.decorate(result,state);
 assert.ok(markup.includes('opfc-penalty-animation'));
 assert.ok(markup.includes('data-stadium="skypiea"'));
 assert.ok(!markup.includes('RESULTAT OFFICIEL'));
 assert.deepEqual(state,original);
 const p=readFileSync(new URL('../penalty-scene.mjs',import.meta.url),'utf8');
 for(const symbol of ['advanceShootout','applyShootoutKick','resolvePenalty(','localStorage','sessionStorage','supabase.co']){
  assert.ok(!p.includes(symbol),'Aucun moteur / stockage dans la présentation : '+symbol);
 }
});
