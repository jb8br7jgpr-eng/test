/** UI-only helpers for OPFC match transitions and targeted portrait warm-up.
 * No match-engine, network or persistence mutations.
 */
import {portraitFile} from './ui-portraits.mjs?v=opfc-75-roster-20261022';

/**
 * Evite une destruction/recreation du DOM quand une actualisation produit
 * exactement le meme HTML. Le cache ne remplace PAS l'etat de jeu, et ne
 * court-circuite jamais le calcul des phases ou les controles serveur.
 *
 * Important : les champs saisis, les images deja chargees et la position du
 * curseur sont conserves quand l'interface visible n'a pas change.
 * invalidate() signale les modifications DOM partielles (Momentum, etc.).
 */
export function createStableMarkupCommitter(){
 let root=null,lastMarkup=null;
 return {
  commit(target,markup){
   if(target===root&&markup===lastMarkup&&target.firstElementChild)return false;
   target.innerHTML=markup;
   root=target;lastMarkup=markup;
   return true;
  },
  invalidate(){root=null;lastMarkup=null;}
 };
}

/**
 * Met a jour uniquement le Momentum. Tous les autres elements du match
 * (portraits, score, boutons tactiques, champs en cours de saisie) gardent
 * leurs noeuds DOM et leur etat natif.
 */
export function patchMomentumOnly(root,html){
 const previous=root?.querySelector?.('.opfc-momentum-wrap');
 if(!previous)return false;
 const active=typeof document==='undefined'?null:document.activeElement;
 const retainFocus=!!active&&previous.contains?.(active);
 previous.outerHTML=html;
 if(retainFocus)root.querySelector('.opfc-momentum-toggle')?.focus({preventScroll:true});
 return true;
}

const loadedPortraits=new Map();
const portraitQueue=[];
let runningPortraits=0;
const MAX_PARALLEL=3;

function flushPortraitQueue(){
 if(typeof Image!=='function')return;
 while(runningPortraits<MAX_PARALLEL&&portraitQueue.length){
  const src=portraitQueue.shift();
  const image=new Image();
  image.decoding='async';
  runningPortraits++;
  loadedPortraits.set(src,image);
  const completed=()=>{
   runningPortraits--;
   flushPortraitQueue();
  };
  image.onload=completed;
  image.onerror=completed;
  image.src=src;
 }
}

/** Only prepare the actual 7+7 players after the lineups are finalized. */
export function preloadMatchPortraits(state){
 if(!state||!['kickoff-ready','match','moment-result','half-time','resume-ready','shootout-ready','shootout','finished'].includes(state.phase))return;
 if(!Array.isArray(state.teams)||state.teams.length!==2||
    state.teams.some(team=>!Array.isArray(team.slots)||team.slots.length!==7||team.slots.some(id=>!id)))return;
 for(const team of state.teams){
  for(const id of team.slots){
   const src=portraitFile(id);
   if(!src||loadedPortraits.has(src)||portraitQueue.includes(src))continue;
   portraitQueue.push(src);
  }
 }
 flushPortraitQueue();
}

/** Keys deliberately exclude resultAcks / pending flags / online room revisions. */
export function matchUiStepKey(state){
 if(!state||!['kickoff-ready','match','moment-result','half-time','resume-ready','shootout-ready','shootout','finished'].includes(state.phase))return null;
 const m=state.match||{},a=m.action||{},s=m.shootout||{},r=m.lastResult||{};
 return [state.phase,m.index??'',a.kind??'',a.stage??'',a.minute??'',
  r.outcome??'',r.minute??'',r.scorerId??'',
  s.active?.shotNumber??'',s.lastResult?.shotNumber??'',s.stage??''].join(':');
}

/** En ligne, seuls les boutons d'action réellement disponibles pour CE
 * téléphone déclenchent le retour automatique. Jamais les écrans d'attente.
 * On interroge la vue déjà filtrée par les règles d'autorisation locales/serveur,
 * sans accéder aux choix secrets ni au calendrier futur.
 */
const ONLINE_ACTION_PHASES=new Set([
 'kickoff-ready','match','moment-result','half-time','resume-ready','shootout-ready','shootout'
]);
export function onlineOwnTurnHasAction(root,phase){
 if(!root||!ONLINE_ACTION_PHASES.has(phase))return false;
 const content=root.querySelector('.online-game-content.opfc-online-playing');
 if(!content)return false;
 const choices=content.querySelectorAll(
  'button[data-action="online-choice"],button[data-action="online-game"],button[data-action="ready"]'
 );
 return Array.from(choices).some(b=>!b.disabled&&b.getAttribute('aria-disabled')!=='true');
}

/** Calcule une destination de scroll en pixels CSS, sans accès au DOM.
 * Quand le panneau tient dans la zone visible, son bas est privilégié pour
 * laisser apparaître un maximum de score / Momentum / bandeau au-dessus.
 * Sinon, on garde le titre et le début de l'action dégagés de l'en-tête fixe.
 * Clamping indispensable en haut et en bas du document.
 */
export function matchFocusScrollTarget({
 top, height, scrollY, viewportHeight, viewportOffset=0,
 topInset=0, bottomInset=16, maxScrollY=Infinity
}){
 const usable=Math.max(0,viewportHeight-topInset-bottomInset);
 const offset=height<=usable
  ? top+height-(viewportOffset+viewportHeight-bottomInset)
  : top-(viewportOffset+topInset);
 return Math.max(0,Math.min(maxScrollY,Math.round(scrollY+offset)));
}

/** Positionne chaque nouvelle étape ; jamais sur une simple validation réseau.
 * Le bouton manuel « Revenir à l'action » utilise la même logique.
 */
export function scrollToMatchFocus(root){
 if(!root)return;
 const phase=root.dataset.v3Phase;
 let focus=null;
 if(phase==='finished')focus=root.querySelector('.final-screen, .shootout-tracker');
 else if(phase==='moment-result')focus=root.querySelector('.shot-result-unified, .match-stage');
 else if(phase==='half-time'||phase==='resume-ready')focus=root.querySelector('.halftime-screen');
 else if(phase==='kickoff-ready')focus=root.querySelector('.opfc-prematch, .match-stage');
 else if(phase==='shootout-ready'||phase==='shootout')focus=root.querySelector('.shot-result-unified, .online-turn-wait, .match-stage, .shootout-tracker');
 else focus=root.querySelector('.online-turn-wait, .match-handover, .match-stage');
 if(!focus)return;

 // Safari iPhone : hauteur réellement visible (barres du navigateur comprises).
 const viewport=window.visualViewport;
 const viewportHeight=viewport?.height??window.innerHeight;
 const viewportOffset=viewport?.offsetTop??0;
 const rect=focus.getBoundingClientRect();
 // Le CSS OPFC réserve déjà safe-area-inset-top + 74 px sous l'en-tête fixe.
 const cssTop=parseFloat(window.getComputedStyle(focus).scrollMarginTop);
 const headerBottom=root.querySelector('.opfc-match-topbar')?.getBoundingClientRect().bottom??0;
 const topInset=Math.max(Number.isFinite(cssTop)?cssTop:74,headerBottom+8);
 // Padding de .app = safe-area-inset-bottom + 28px : conserver 16 px
 // d'air sous le bouton tout en respectant la zone de sécurité iPhone.
 const rootBottom=parseFloat(window.getComputedStyle(root).paddingBottom);
 const bottomInset=Number.isFinite(rootBottom)?Math.max(16,rootBottom-12):16;
 const scrollArea=document.scrollingElement??document.documentElement;
 const maxScrollY=Math.max(0,scrollArea.scrollHeight-scrollArea.clientHeight);
 const target=matchFocusScrollTarget({
  top:rect.top,height:rect.height,scrollY:window.scrollY,
  viewportHeight,viewportOffset,topInset,bottomInset,maxScrollY
 });
 if(Math.abs(target-window.scrollY)<1)return;
 const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
 window.scrollTo({top:target,behavior:reduce?'instant':'smooth'});
}
