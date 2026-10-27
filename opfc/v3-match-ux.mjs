/** UI-only helpers for OPFC match transitions and targeted portrait warm-up.
 * No match-engine, network or persistence mutations.
 */
import {portraitFile} from './ui-portraits.mjs?v=opfc-75-roster-20261022';

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

/** Reposition to a newly rendered step, never on a mere acknowledgement. */
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
 const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 focus.scrollIntoView({block:'start',behavior:reduce?'instant':'smooth'});
}
