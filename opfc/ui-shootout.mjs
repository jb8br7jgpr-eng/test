/**
 * OPFC v0.8 — 9B3 : déroulement local de la séance de tirs au but.
 * Les directions sont sauvegardées dans l'état PRIVE pour permettre une
 * reprise après rechargement ; elles sont exclues de matchPublicView().
 * Aucune formule de tir recodée : advanceShootout() est l'unique autorité.
 */
import {beginShootout,advanceShootout} from './match.mjs';
import {nextShootoutShooter} from './shootout.mjs';
import {CARD_BY_ID} from './catalog.mjs';

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
 return '<div class="match-choice-grid">'+
 dirs.map(d=>'<button class="btn match-choice" data-action="match-shootout-choose" data-choice="'+d+'">'+
 ({GAUCHE:'Gauche',CENTRE:'Centre',DROITE:'Droite'}[d])+'</button>').join('')+'</div>';
}
function history(s){
 const timeline=s?.timeline??[];
 if(!timeline.length)return '<p class="caption">Aucune tentative pour le moment.</p>';
 return '<div class="shootout-history">'+timeline.map((t,index)=>
  '<div class="shootout-attempt"><span class="shootout-attempt-club">'+escape(t.club)+'</span>'+
  '<span>'+escape(name(t.shooterId))+'</span><strong class="'+(t.scored?'kick-goal':'kick-fail')+'">'+
  (t.scored?'✓ But':t.result==='save'?'✕ Arrêt':'✕ Raté')+
  '</strong><small>n° '+t.shotNumber+'</small></div>').join('')+'</div>';
}
const introPanel=(title,desc,action,label)=>'<section class="panel match-stage"><span class="eyebrow">Tirs au but</span>'+
 '<h2>'+title+'</h2><p>'+desc+'</p>'+btn(action,label)+'</section>';
export function renderShootoutScreen(state,{uncovered=false}={}){
 if(state?.phase==='shootout-ready')return introPanel('Égalité après 90 minutes',
  'Lancer de pièce pour déterminer qui tire en premier. Les deux équipes conservent leur composition de la 90e minute.',
  'match-begin-shootout','Lancer la pièce et commencer la séance');
 const s=state?.match?.shootout;
 if(!s)return '';
 let out='<section class="panel shootout-board"><span class="eyebrow">Grandline Cup · Tirs au but</span>'+
  '<div class="shootout-score"><span>PSG</span><strong>'+s.score.PSG+' – '+s.score.OM+'</strong><span>OM</span></div>'+
  '<p class="caption">'+(s.stage==='sudden-death'?'Mort subite':'Cinq tirs initiaux')+
  ' · '+s.attempts.PSG.length+' tir(s) PSG / '+s.attempts.OM.length+' tir(s) OM</p></section>';
 const last=state.match.shootoutLastResult;
 if(last){
  out+=introPanel(last.scored?'BUT !':last.result==='save'?'Arrêt du gardien !':'Tir manqué',
   escape(name(last.shooterId))+' ('+escape(last.club)+') · '+escape(last.shotDirection)+' / gardien : '+escape(last.keeperDirection)+
   '. Le résultat reste visible jusqu’à « Continuer ».',
   'match-shootout-continue',s.phase==='finished'?'Voir le résultat final':'Continuer');
 }else if(state.phase==='shootout'){
  const p=current(state),owner=shootoutTurnOwner(state),pending=state.match.shootoutPending;
  if(owner&&!uncovered)
   out+='<section class="match-handover"><div class="match-handover-icon">🔒</div>'+
    '<h2>À toi de jouer, '+owner+'</h2><p>Passe le téléphone au joueur '+owner+
    '. La direction précédente reste masquée.</p>'+
    btn('match-uncover','Je suis '+owner+' · afficher mon choix')+'</section>';
  else if(owner){
   const shooterTurn=owner===p.club;
   out+='<section class="panel match-stage"><span class="eyebrow">'+(shooterTurn?'Tireur':'Gardien')+
    ' · '+escape(owner)+'</span><h2>'+escape(name(shooterTurn?p.cardId:s.keepers[owner].cardId))+'</h2>'+
    '<p>'+(shooterTurn?'Choisis secrètement où tirer.':'Choisis secrètement où plonger.')+
    '</p>'+buttonChoices()+'</section>';
  }else if(pending?.shotDirection&&pending?.keeperDirection){
   out+=introPanel('Les deux directions sont verrouillées',
    'Le tir et le plongeon vont être révélés ensemble. Le résultat est calculé par le moteur officiel.',
    'match-shootout-reveal','Révéler et tirer');
  }
 }
 return out+'<section class="panel shootout-log"><h3 class="section-title">Historique des tentatives</h3>'+history(s)+'</section>';
}
