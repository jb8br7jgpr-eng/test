/**
 * OPFC v0.8 — 9B3 : déroulement local de la séance de tirs au but.
 * Les directions sont sauvegardées dans l'état PRIVE pour permettre une
 * reprise après rechargement ; elles sont exclues de matchPublicView().
 * Aucune formule de tir recodée : advanceShootout() est l'unique autorité.
 */
import {beginShootout,advanceShootout} from './match.mjs';
import {nextShootoutShooter} from './shootout.mjs';
import {CARD_BY_ID} from './catalog.mjs';
import {visualAbbr} from './club-identities.mjs';
import {renderCharacterPortrait} from './ui-portraits.mjs';
import {matchTacticalChoices,renderShotFaceOff,renderShotResult} from './ui-match-widgets.mjs';

const fail=m=>{throw Error(m);};
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const name=id=>CARD_BY_ID.get(id)?.name??id??'—';
const dirs=['GAUCHE','CENTRE','DROITE'];
const btn=(action,title)=>'<button class="btn primary full" data-action="'+action+'">'+escape(title)+'</button>';
function current(state){
 const p=nextShootoutShooter(state?.match?.shootout);
 if(!p)fail('Séance terminée ou tireur indisponible');
 return p;
}
export function shootoutTurnOwner(state){
 if(state?.phase!=='shootout')return null;
 if(state.match.shootoutLastResult)return null;
 const p=current(state);
 const pending=state.match.shootoutPending;
 if(!pending)return p.club;
 if(pending.club!==p.club||pending.shooterId!==p.cardId)fail('Tir en attente incompatible avec le tour');
 return pending.shotDirection&&!pending.keeperDirection?(p.club==='PSG'?'OM':'PSG'):null;
}
export function dispatchShootout(state,command,{choice,rng=Math.random}={}){
 if(command==='begin-shootout'){
  if(state?.phase!=='shootout-ready')fail('Départage non disponible');
  const next=beginShootout(state,rng());
  next.match.shootoutPending=null;
  next.match.shootoutLastResult=null;
  return next;
 }
 if(command==='shootout-continue'){
  if(!state?.match?.shootoutLastResult)fail('Aucun tir à continuer');
  const next=structuredClone(state);
  next.match.shootoutLastResult=null;
  return next;
 }
 if(state?.phase!=='shootout'||!state.match?.shootout)fail('Séance indisponible');
 if(state.match.shootoutLastResult)fail('Valide le résultat avant un nouveau tir');
 const p=current(state),pending=state.match.shootoutPending;
 if(command==='shootout-choose'){
  if(!dirs.includes(choice))fail('Direction invalide');
  const owner=shootoutTurnOwner(state);
  if(!owner)fail('Les deux directions sont déjà choisies');
  const next=structuredClone(state);
  if(!pending)next.match.shootoutPending={
   club:p.club,shooterId:p.cardId,shotDirection:choice,keeperDirection:null
  };
  else next.match.shootoutPending.keeperDirection=choice;
  return next;
 }
 if(command==='shootout-reveal'){
  if(!pending?.shotDirection||!pending?.keeperDirection)fail('Deux choix sont nécessaires avant le tir');
  const s=advanceShootout(state,{
   club:p.club,shooterId:p.cardId,
   shotDirection:pending.shotDirection,keeperDirection:pending.keeperDirection,
   draw:rng()
  });
  const latest=s.match.shootout.timeline.at(-1);
  s.match.shootoutPending=null;
  s.match.shootoutLastResult=structuredClone(latest);
  return s;
 }
 fail('Commande de tirs au but inconnue');
}
function buttonChoices(){
 return matchTacticalChoices(dirs.map(d=>[d,{GAUCHE:'Gauche',CENTRE:'Centre',DROITE:'Droite'}[d]]),
  'match-shootout-choose');
}
const shootoutFaceOff=(state,p)=>renderShotFaceOff(state,{
 shooterId:p.cardId,keeperId:state.match.shootout.keepers[p.club==='PSG'?'OM':'PSG']?.cardId,
 attacker:p.club,defender:p.club==='PSG'?'OM':'PSG'
});
function history(s){
 const timeline=s?.timeline??[];
 if(!timeline.length)return '<p class="caption">Aucune tentative pour le moment.</p>';
 return '<div class="shootout-history">'+timeline.map((t,index)=>
  '<div class="shootout-attempt"><span class="shootout-attempt-club">'+escape(visualAbbr(t.club))+'</span>'+
  '<span class="shootout-kick-player">'+renderCharacterPortrait(t.shooterId,'kick-portrait')+escape(name(t.shooterId))+'</span><strong class="'+(t.scored?'kick-goal':'kick-fail')+'">'+
  (t.scored?'✓ But':t.result==='save'?'✕ Arrêt':'✕ Raté')+
  '</strong><small>n° '+t.shotNumber+'</small></div>').join('')+'</div>';
}
const introPanel=(title,desc,action,label)=>'<section class="panel match-stage"><span class="eyebrow">Tirs au but</span>'+
 '<h2>'+title+'</h2><p>'+desc+'</p>'+btn(action,label)+'</section>';
/**
 * Tableau visuel alimenté exclusivement par les tentatives officielles déjà
 * enregistrées. Affiche toujours les cinq cases réglementaires, puis étend
 * les deux lignes à chaque nouvelle série de mort subite. Les deux équipes
 * conservent le même nombre de cases, même si une seule vient de tirer.
 */
export function renderShootoutTracker(s){
 if(!s?.attempts||!s?.score)return '';
 const countP=s.attempts.PSG.length,countO=s.attempts.OM.length;
 const maxCount=Math.max(5,countP,countO);
 const sudden=s.stage==='sudden-death'||maxCount>5;
 const totalRounds=Math.max(countP,countO);
 const round=s.phase==='finished'?Math.max(1,totalRounds):
  Math.max(1,totalRounds+(countP===countO?1:0));
 const stageLabel=sudden?'MORT SUBITE':round===1?'1re série de tirs':round+'e série de tirs';
 const active=s.phase==='active';
 const rows=['PSG','OM'].map(club=>{
  const shots=s.attempts[club],score=s.score[club];
  const boxes=Array.from({length:maxCount},(_,i)=>{
   const attempt=shots[i];
   const outcome=!attempt?'pending':attempt.scored?'goal':'fail';
   const mark=!attempt?'·':attempt.scored?'✓':'✕';
   const title=attempt?(attempt.scored?'But':attempt.result==='save'?'Arrêt':'Tir manqué'):
    (active?'À venir':'Non tiré');
   return (i===5?'<span class="shootout-marks-divider" aria-hidden="true"></span>':'')+
    '<span class="shootout-mark shootout-mark--'+outcome+'" title="'+escape(title)+
    '" aria-label="'+escape(visualAbbr(club)+', tir '+(i+1)+' : '+title)+'">'+mark+'</span>';
  }).join('');
  return '<div class="shootout-tracker-team '+club.toLowerCase()+'">'+
   '<div class="shootout-tracker-identity"><strong>'+escape(visualAbbr(club))+'</strong>'+
   '<span class="shootout-tracker-goals">'+score+'</span></div>'+
   '<div class="shootout-marks" role="group" aria-label="Tentatives de '+escape(visualAbbr(club))+'">'+boxes+'</div>'+
   '</div>';
 }).join('');
 return '<section class="panel shootout-tracker" aria-label="Suivi des tirs au but">'+
  '<span class="eyebrow">⚽ Séance de tirs au but</span>'+
  '<h3 class="'+(sudden?'shootout-stage-sudden':'shootout-stage-normal')+
   '"'+(sudden?' aria-label="Mort subite"':'')+'>'+stageLabel+'</h3>'+
  '<p class="shootout-tracker-progress">'+(sudden?'Mort subite':'Cinq tirs initiaux')+
   ' · '+countP+' tir(s) '+escape(visualAbbr('PSG'))+' / '+countO+' tir(s) '+escape(visualAbbr('OM'))+'</p>'+
  '<div class="shootout-tracker-teams">'+rows+'</div>'+
  '<p class="shootout-tracker-legend">✓ But · ✕ Arrêt ou tir manqué · · '+
  (active?'À venir':'Non tiré')+'</p></section>';
}
export function renderShootoutScreen(state,{uncovered=false}={}){
 if(state?.phase==='shootout-ready')return introPanel('Égalité après 90 minutes',
  'Lancer de pièce pour déterminer qui tire en premier. Les deux équipes conservent leur composition de la 90e minute.',
  'match-begin-shootout','Lancer la pièce et commencer la séance');
 const s=state?.match?.shootout;
 if(!s)return '';
 let out=renderShootoutTracker(s);
 const last=state.match.shootoutLastResult;
 if(last){
  out+=renderShotResult(state,{
   outcome:last.scored?'goal':last.result==='save'?'save':'miss',
   attacker:last.club,shooterId:last.shooterId,
   keeperId:s.keepers[last.club==='PSG'?'OM':'PSG']?.cardId,
   score:s.score,context:'Séance de tirs au but',
   detailExtra:'Direction de la frappe : '+last.shotDirection+' · Gardien : '+last.keeperDirection,
   action:'match-shootout-continue',
   continueLabel:state.phase==='finished'?'Voir le résultat final':'Continuer'
  });
 }else if(state.phase==='shootout'){
  const p=current(state),owner=shootoutTurnOwner(state),pending=state.match.shootoutPending;
  if(owner&&!uncovered)
   out+='<section class="match-handover"><div class="match-handover-icon">🔒</div>'+
    '<h2>À toi de jouer, '+escape(visualAbbr(owner))+'</h2><p>Passe le téléphone au joueur '+escape(visualAbbr(owner))+
    '. La direction précédente reste masquée.</p>'+
    btn('match-uncover','Je suis '+visualAbbr(owner)+' · afficher mon choix')+'</section>';
  else if(owner){
   const shooterTurn=owner===p.club;
   out+='<section class="panel match-stage"><span class="eyebrow">'+(shooterTurn?'Tireur':'Gardien')+
    ' · '+escape(visualAbbr(owner))+'</span><h2 class="match-shot-ready-heading">'+(shooterTurn?'Choisis ta frappe':'Réaction du gardien')+'</h2>'+
    shootoutFaceOff(state,p)+
    '<p>'+(shooterTurn?'Choisis secrètement où tirer.':'Choisis secrètement où plonger.')+
    '</p>'+buttonChoices()+'</section>';
  }else if(pending?.shotDirection&&pending?.keeperDirection){
   out+='<section class="panel match-stage"><span class="eyebrow">Tirs au but</span>'+
    '<h2 class="match-shot-ready-heading">Les deux directions sont verrouillées</h2>'+
    shootoutFaceOff(state,p)+
    '<p>Le tir et le plongeon vont être révélés ensemble.</p>'+
    btn('match-shootout-reveal','Révéler et tirer')+'</section>';
  }
 }
 return out+'<section class="panel shootout-log"><h3 class="section-title">Historique des tentatives</h3>'+history(s)+'</section>';
}
