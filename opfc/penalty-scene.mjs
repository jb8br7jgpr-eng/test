/**
 * OPFC — animation de présentation des vrais penaltys et TAB.
 * Strictement visuel : ne lit que les résultats résolus officiellement.
 * Ne change ni moteur, ni état du match, ni écran de résultat, ni réseau.
 */
import {CARD_BY_ID} from './catalog.mjs?v=opfc-75-roster-20261022';
import {renderCharacterPortrait} from './ui-portraits.mjs';
import {labBallGraphic} from './penalty-lab-visual.mjs?v=opfc-penalty-scene-20261102';
import {labV55PitchGraphic,labV55TurfGraphic} from './penalty-lab-v5-5-turf.mjs';
import {labV51FlightFrames} from './penalty-lab-v5-1-flight.mjs';
import {animateContinuousNet} from './penalty-lab-v5-2-net.mjs';
import {isStadium} from './stadiums.mjs';
const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dirs=['GAUCHE','CENTRE','DROITE'];
const results=['goal','save','miss'];
/** Rendu identique à la scène validée dans le labo, portraits ronds officiels. */
export function renderMatchPenaltyScene({shooterId,keeperId,stadiumId}={}){
 if(!CARD_BY_ID.has(shooterId)||!CARD_BY_ID.has(keeperId))return '';
 // Même illustration, même vue et même pelouse que le labo V5.5.
 // Choix du stade déjà public : aucune donnée confidentielle du moteur.
 const stadium=isStadium(stadiumId)?stadiumId:'mugiwara';
 return '<div class="opfc-penalty-scene">'+
  '<div class="plab-pitch" role="img" aria-label="Terrain de penalty avec ballon, but, filets et portraits du tireur et du gardien">'+
  '<div class="plab-grass"></div>'+
  '<div class="plab-v5-backdrop" data-stadium="'+h(stadium)+'" aria-hidden="true"></div>'+
  labV55TurfGraphic()+labV55PitchGraphic()+
  '<div class="plab-keeper" data-penalty-keeper="true">'+renderCharacterPortrait(keeperId,'plab-keeper-portrait')+
   '<span class="plab-person-label">'+h(CARD_BY_ID.get(keeperId).name)+'</span></div>'+
  '<div class="plab-v4-contact" aria-hidden="true"></div>'+
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
 return {...kick,kind,stadiumId:state.stadiumId,key:[state.matchRecordId??'initial',kind,sequence,
  kick.shotDirection,kick.keeperDirection,kick.outcome].join('|')};
}
const RESULT_PANEL=/<section class="panel match-stage shot-result-panel[^"]*"[^>]*>[\s\S]*?<\/section>/;
const TRACKER_PANEL=/<section class="panel shootout-tracker"[\s\S]*?<\/section>/;
const LOG_PANEL=/<section class="panel shootout-log"[\s\S]*?<\/section>/;
const FLIGHT_MS=1020;
const TRANSITION_MS=1570; // 1020 ms de tir + 490 ms d'onde du filet + respiration.
/** UI-only transition: replace *rendered markup* temporarily, never underlying game state.
 * One key per real kick; online polling and acknowledgements must not replay it.
 */
export function createPenaltySceneController({onFinish,clock=()=>Date.now(),schedule=(fn,ms)=>setTimeout(fn,ms),cancel=clearTimeout}={}){
 let active=null,seen=new Set(),timer=null,netTimer=null,netOwner=null,revealOnce=null,lastSelectionKey=null;
 const originalIntroPanels=new Map();
 function reset(){
  if(timer!==null){cancel(timer);timer=null;}
  if(netTimer!==null){cancel(netTimer);netTimer=null;}
  netOwner=null;
  active=null;
 }
 function decorate(markup,state,{previousTracker=null,previousLog=null}={}){
  const kick=resolvedPenaltyForPresentation(state);
  if(!kick){reset();revealOnce=null;return markup;}
  if(!active||active.key!==kick.key){
   reset();
   if(seen.has(kick.key)){
    if(revealOnce===kick.key){
     revealOnce=null;
     const panel=originalIntroPanels.get(kick.key);
     return panel&&RESULT_PANEL.test(markup)?markup.replace(RESULT_PANEL,panel):markup;
    }
    return markup;
   }
   if(seen.size>200)seen.clear();
   seen.add(kick.key);
   const originalPanel=markup.match(RESULT_PANEL)?.[0];
   if(originalPanel)originalIntroPanels.set(kick.key,originalPanel);
   if(originalIntroPanels.size>200)originalIntroPanels.clear();
   active={...kick,started:clock(),previousTracker,previousLog};
   timer=schedule(()=>{
    timer=null;
    if(active?.key===kick.key){
     active=null;
     revealOnce=kick.key;
     if(typeof onFinish==='function')onFinish();
    }
   },TRANSITION_MS);
  }
  if(!active||active.key!==kick.key)return markup;
  const scene=renderMatchPenaltyScene(active);
  if(!scene||!RESULT_PANEL.test(markup)){reset();return markup;}
  if(active.kind==='shootout'){
   // Geler les VRAIS composants existants pour ne pas divulguer le résultat.
   if(active.previousTracker)markup=markup.replace(TRACKER_PANEL,active.previousTracker);
   else markup=markup.replace(TRACKER_PANEL,old=>old.replace(
    'class="panel shootout-tracker"','class="panel shootout-tracker" style="visibility:hidden"'));
   if(active.previousLog)markup=markup.replace(LOG_PANEL,active.previousLog);
   else markup=markup.replace(LOG_PANEL,old=>old.replace(
    'class="panel shootout-log"','class="panel shootout-log" style="visibility:hidden"'));
  }
  return markup.replace(RESULT_PANEL,
   '<section class="panel match-stage opfc-penalty-animation" role="status" aria-label="Penalty en cours">'+
   '<span class="eyebrow">⚽ '+(kick.kind==='shootout'?'Tir au but':'Penalty')+'</span>'+
   '<h2 class="match-shot-ready-heading">Le tir est déclenché</h2>'+
   scene+'<p class="caption">Le résultat sera affiché après la frappe.</p></section>');
 }
 function animate(root,state=null){
  if(!active){
   // Comme en V5.5 : le nouveau tireur retrouve une scène stable.
   const scene=root.querySelector('.opfc-penalty-scene .plab-pitch');
   if(!scene||!state?.match)return;
   const match=state.match,shootout=match.shootout;
   let key=null;
   if(state.phase==='shootout'&&shootout&&!shootout.lastResult&&!match.shootoutLastResult){
    const next=shootout.active;
    const current=next?next.shotNumber:(shootout.timeline?.length??0)+1;
    key='tab:'+(state.matchRecordId??'initial')+':'+current+':'+(shootout.timeline?.length??0);
   }else if(state.phase==='match'&&match.action?.kind==='penalty'){
    key='penalty:'+(state.matchRecordId??'initial')+':'+match.index;
   }
   if(!key||key===lastSelectionKey)return;
   lastSelectionKey=key;
   const reduced=typeof window!=='undefined'&&window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
   if(!reduced&&typeof scene.animate==='function')
    scene.animate([{opacity:.64},{opacity:1}],{duration:200,easing:'ease-out'});
   return;
  }
  const scene=root.querySelector('.opfc-penalty-animation');
  if(!scene||scene.dataset.animationKey===active.key)return;
  scene.dataset.animationKey=active.key;
  const pitch=scene.querySelector('.plab-pitch');
  const keeper=scene.querySelector('[data-penalty-keeper]');
  const ball=scene.querySelector('[data-penalty-ball]');
  const shadow=scene.querySelector('[data-penalty-shadow]');
  const art=ball?.querySelector('.plab-ball-art');
  if(!pitch||!keeper||!ball||!art)return;
  if(netTimer!==null){cancel(netTimer);netTimer=null;}
  netOwner=scene;
  const kick=active;
  const reduced=typeof window!=='undefined'&&window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const elapsed=Math.max(0,clock()-kick.started);
  const progress=Math.min(.995,elapsed/FLIGHT_MS);
  const w=pitch.clientWidth,height=pitch.clientHeight;
  if(!(w>0&&height>0))return;
  // EXACTEMENT la projection V5.1 validée : hauteur des tirs, saves et ratés.
  // Le résultat et les choix de directions ont déjà été calculés par OPFC.
  const {frames,x,y,keeperX,impact}=labV51FlightFrames(kick,w,height);
  const round=n=>Math.round(n*10)/10;
  const directionX={GAUCHE:-.19,CENTRE:0,DROITE:.19}[kick.shotDirection]*w;
  const remaining=items=>{
   const first=items.filter(f=>f.offset<=progress).at(-1)??items[0];
   return [first,...items.filter(f=>f.offset>progress)].map((f,i)=>({
    ...f,offset:i===0?0:(f.offset-progress)/(1-progress)
   }));
  };
  if(typeof ball.animate==='function'&&!reduced&&elapsed<FLIGHT_MS){
   const duration=Math.max(1,FLIGHT_MS-elapsed);
   ball.animate(remaining(frames),{duration,fill:'forwards',easing:'cubic-bezier(.38,.05,.76,.76)'});
   keeper.animate(remaining([
    {transform:'translate(-50%,-50%) translateX(0px)',offset:0},
    {transform:'translate(-50%,-50%) translateX(0px)',offset:.09},
    {transform:'translate(-50%,-50%) translateX('+round(keeperX)+'px)',offset:1}
   ]),{duration,fill:'forwards',easing:'cubic-bezier(.25,.1,.23,1)'});
   art.animate(remaining([
    {transform:'rotate(-16deg)',offset:0},
    {transform:'rotate(80deg)',offset:.33},
    {transform:'rotate(190deg)',offset:.66},
    {transform:'rotate(315deg)',offset:1}
   ]),{duration,fill:'forwards',easing:'ease-in'});
   if(shadow)shadow.animate(remaining([
    {transform:'translate(-50%,-50%) scale(1)',opacity:.48,offset:0},
    {transform:'translate(-50%,-50%) translate('+round(directionX*.62)+'px,'+round(y*.42)+'px) scale(.65)',opacity:.24,offset:.57},
    {transform:'translate(-50%,-50%) translate('+round(x)+'px,'+round(y)+'px) scale(.4)',opacity:0,offset:1}
   ]),{duration,fill:'forwards',easing:'ease-out'});
  }
  // Le filet V5.2 déforme les 33 lignes en continu au point de contact ;
  // seulement sur un vrai but. Arrêt ou raté n'activent jamais ce mouvement.
  const kickKey=kick.key;
  const startImpact=()=>{
   netTimer=null;
   if(!scene.isConnected||!pitch.isConnected||active?.key!==kickKey)return;
   if(kick.outcome==='goal')
    void animateContinuousNet(pitch,impact,{live:()=>pitch.isConnected&&active?.key===kickKey});
   else if(kick.outcome==='save')pitch.classList.add('plab-v4-save-contact');
   else pitch.classList.add('plab-v4-miss-out');
  };
  const impactDelay=FLIGHT_MS*(kick.outcome==='goal'?.93:kick.outcome==='save'?.88:.94);
  if(!reduced)netTimer=schedule(startImpact,Math.max(0,impactDelay-elapsed));
 }

 return {decorate,animate,reset};
}
