/**
 * OPFC — animation de présentation des vrais penaltys et TAB.
 * Strictement visuel : ne lit que les résultats résolus officiellement.
 * Ne change ni moteur, ni état du match, ni écran de résultat, ni réseau.
 */
import {CARD_BY_ID} from './catalog.mjs?v=opfc-75-roster-20261022';
import {renderCharacterPortrait} from './ui-portraits.mjs';
import {labPitchGraphic,labBallGraphic} from './penalty-lab-visual.mjs?v=opfc-penalty-scene-20261102';
import {trajectoryFor} from './penalty-lab-core.mjs';
const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dirs=['GAUCHE','CENTRE','DROITE'];
const results=['goal','save','miss'];
/** Rendu identique à la scène validée dans le labo, portraits ronds officiels. */
export function renderMatchPenaltyScene({shooterId,keeperId}={}){
 if(!CARD_BY_ID.has(shooterId)||!CARD_BY_ID.has(keeperId))return '';
 return '<div class="opfc-penalty-scene">'+
  '<div class="plab-pitch" role="img" aria-label="Terrain de penalty avec ballon, but, filets et portraits du tireur et du gardien">'+
  '<div class="plab-grass"></div><div class="plab-stadium-glow"></div>'+labPitchGraphic()+
  '<div class="plab-keeper" data-penalty-keeper="true">'+renderCharacterPortrait(keeperId,'plab-keeper-portrait')+
   '<span class="plab-person-label">'+h(CARD_BY_ID.get(keeperId).name)+'</span></div>'+
  '<div class="plab-ball-shadow" data-penalty-shadow="true"></div>'+
  '<div class="plab-ball" data-penalty-ball="true">'+labBallGraphic()+'</div>'+
  '<div class="plab-shooter">'+renderCharacterPortrait(shooterId,'plab-shooter-portrait')+
   '<span class="plab-person-label">'+h(CARD_BY_ID.get(shooterId).name)+'</span></div>'+
  '</div></div>';
}
/** Les directions ne sont autorisées à sortir du jeu qu'APRÈS résolution. */
export function resolvedPenaltyForPresentation(state){
 const m=state?.match;
 if(!m)return null;
 let kick=null,kind=null,sequence='';
 const last=m.shootout?.lastResult??m.shootoutLastResult;
 if(['shootout','finished'].includes(state.phase)&&last){
  kind='shootout';sequence=last.club+':'+last.shotNumber;
  kick={shooterId:last.shooterId,keeperId:last.keeperId,
   shotDirection:last.shotDirection,keeperDirection:last.keeperDirection,
   outcome:last.scored?'goal':last.result==='save'?'save':'miss'};
 }else if(state.phase==='moment-result'&&m.lastResult?.details?.kind==='penalty'){
  const r=m.lastResult,d=r.details;
  const calc=d.shot?.calculation;
  kind='penalty';sequence=String(m.index)+':'+String(r.minute)+':'+String(m.history?.length??'');
  kick={shooterId:d.takerId??d.finisherId,
   keeperId:d.keeperId,shotDirection:calc?.shotDirection,
   keeperDirection:calc?.keeperDirection,outcome:r.outcome};
 }
 if(!kick||!CARD_BY_ID.has(kick.shooterId)||!CARD_BY_ID.has(kick.keeperId)||
  !dirs.includes(kick.shotDirection)||!dirs.includes(kick.keeperDirection)||
  !results.includes(kick.outcome))return null;
 return {...kick,kind,key:[state.matchRecordId??'initial',kind,sequence,
  kick.shotDirection,kick.keeperDirection,kick.outcome].join('|')};
}
const RESULT_PANEL=/<section class="panel match-stage shot-result-panel[^"]*"[^>]*>[\s\S]*?<\/section>/;
const TRANSITION_MS=1060;
/** UI-only transition: replace *rendered markup* temporarily, never underlying game state.
 * One key per real kick; online polling and acknowledgements must not replay it.
 */
export function createPenaltySceneController({onFinish,clock=()=>Date.now(),schedule=(fn,ms)=>setTimeout(fn,ms),cancel=clearTimeout}={}){
 let active=null,seen=new Set(),timer=null;
 function reset(){
  if(timer!==null){cancel(timer);timer=null;}
  active=null;
 }
 function decorate(markup,state){
  const kick=resolvedPenaltyForPresentation(state);
  if(!kick){reset();return markup;}
  if(!active||active.key!==kick.key){
   reset();
   if(seen.has(kick.key))return markup;
   if(seen.size>200)seen.clear();
   seen.add(kick.key);
   active={...kick,started:clock()};
   timer=schedule(()=>{
    timer=null;
    if(active?.key===kick.key){
     active=null;
     if(typeof onFinish==='function')onFinish();
    }
   },TRANSITION_MS);
  }
  if(!active||active.key!==kick.key)return markup;
  const scene=renderMatchPenaltyScene(active);
  if(!scene||!RESULT_PANEL.test(markup)){reset();return markup;}
  return markup.replace(RESULT_PANEL,
   '<section class="panel match-stage opfc-penalty-animation" role="status" aria-label="Penalty en cours">'+
   '<span class="eyebrow">⚽ '+(kick.kind==='shootout'?'Tir au but':'Penalty')+'</span>'+
   '<h2 class="match-shot-ready-heading">Le tir est déclenché</h2>'+
   scene+'<p class="caption">Le résultat sera affiché après la frappe.</p></section>');
 }
 function animate(root){
  if(!active)return;
  const scene=root.querySelector('.opfc-penalty-animation');
  if(!scene||scene.dataset.animationKey===active.key)return;
  scene.dataset.animationKey=active.key;
  const pitch=scene.querySelector('.plab-pitch');
  const keeper=scene.querySelector('[data-penalty-keeper]');
  const ball=scene.querySelector('[data-penalty-ball]');
  const shadow=scene.querySelector('[data-penalty-shadow]');
  const art=ball?.querySelector('.plab-ball-art');
  if(!pitch||!keeper||!ball||!art)return;
  const reduced=typeof window!=='undefined'&&window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const progress=Math.min(.98,Math.max(0,(clock()-active.started)/TRANSITION_MS));
  const duration=Math.max(1,TRANSITION_MS*(1-progress));
  const t=trajectoryFor(active),w=pitch.clientWidth,height=pitch.clientHeight;
  const bx=w*(t.ballX-50)/100,by=height*(t.ballY-68)/100;
  const kx=w*(t.keeperX-50)/100;
  const directionX={GAUCHE:-.19,CENTRE:0,DROITE:.19}[active.shotDirection]*w;
  const keyFrames=[
   {transform:'translate(-50%,-50%) translate(0px,0px) scale(1)',offset:0},
   {transform:'translate(-50%,-50%) translate('+directionX+'px,'+by*.58+'px) scale(.78)',offset:.57},
   {transform:'translate(-50%,-50%) translate('+bx+'px,'+by+'px) scale(.49)',offset:active.outcome==='save'?.86:1}
  ];
  if(active.outcome==='save')keyFrames.push({
   transform:'translate(-50%,-50%) translate('+(bx+directionX*.08)+'px,'+(by+height*.045)+'px) scale(.50)',offset:1
  });
  const remaining=frames=>{
   const lower=frames.filter(f=>f.offset<=progress).at(-1)??frames[0];
   const following=frames.find(f=>f.offset>progress)??frames.at(-1);
   return [lower,...frames.filter(f=>f.offset>progress)].map((f,i,a)=>({
    ...f,offset:i===0?0:(f.offset-progress)/(1-progress)
   })).filter((f,i,a)=>i===0||f.offset>=a[i-1].offset);
  };
  if(typeof ball.animate==='function'&&!reduced){
   ball.animate(remaining(keyFrames),{duration,fill:'forwards',easing:'cubic-bezier(.28,.02,.29,1)'});
   keeper.animate(remaining([
    {transform:'translate(-50%,-50%) translateX(0px)',offset:0},
    {transform:'translate(-50%,-50%) translateX(0px)',offset:.09},
    {transform:'translate(-50%,-50%) translateX('+kx+'px)',offset:1}
   ]),{duration,fill:'forwards',easing:'cubic-bezier(.25,.1,.23,1)'});
   art.animate(remaining([
    {transform:'rotate(-16deg)',offset:0},{transform:'rotate(115deg)',offset:.5},
    {transform:'rotate(315deg)',offset:1}
   ]),{duration,fill:'forwards',easing:'ease-in'});
   if(shadow)shadow.animate(remaining([
    {transform:'translate(-50%,-50%) scale(1)',opacity:.48,offset:0},
    {transform:'translate(-50%,-50%) translate('+directionX*.62+'px,'+by*.42+'px) scale(.65)',opacity:.24,offset:.57},
    {transform:'translate(-50%,-50%) translate('+bx+'px,'+by+'px) scale(.4)',opacity:0,offset:1}
   ]),{duration,fill:'forwards',easing:'ease-out'});
   if(active.outcome==='goal'){
    schedule(()=>{if(scene.isConnected&&active?.key===scene.dataset.animationKey)
     pitch.classList.add('plab-goal-impact');
    },Math.max(0,TRANSITION_MS*.84-(clock()-active.started)));
   }
  }
 }
 return {decorate,animate,reset};
}
