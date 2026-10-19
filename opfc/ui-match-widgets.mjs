/**
 * Composants cosmétiques partagés : les cartes de choix reprennent EXACTEMENT
 * l'habillage des cases d'enchères OPMercato classique. Moteur inchangé.
 * Confrontation et annonce de tir affichent exclusivement des données connues.
 */
import {CARD_BY_ID} from './catalog.mjs';
import {lineupDetails} from './rules.mjs';
import {renderCharacterPortrait} from './ui-portraits.mjs';

const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const opposite=c=>c==='PSG'?'OM':'PSG';
const playerOf=(state,club,id)=>state?.teams?.find(team=>team.club===club)
 ?lineupDetails(state.teams.find(team=>team.club===club)).find(p=>p?.cardId===id)??null:null;
const keeperOf=(state,club)=>state?.teams?.find(t=>t.club===club)
 ?lineupDetails(state.teams.find(t=>t.club===club)).find(p=>p?.position==='GAR')?.cardId??null:null;

export function matchTacticalChoices(options,action='match-choose'){
 return '<div class="match-choice-grid match-tactical-choices">'+options.map(([id,label])=>
  '<button type="button" class="btn match-choice" data-action="'+h(action)+'" data-choice="'+h(id)+'">'+
  '<strong>'+h(label)+'</strong></button>').join('')+'</div>';
}

export function renderShotFaceOff(state,{shooterId,keeperId,attacker,defender,shooterLabel='Tireur',keeperLabel='Gardien'}={}){
 if(!shooterId||!keeperId||!attacker||!defender)return '';
 const profile=(id,club,role)=>{
  const actual=playerOf(state,club,id),original=CARD_BY_ID.get(id);
  const name=original?.name??id,position=actual?.position??original?.position??'?',
   rating=actual?.rating??original?.rating??'—';
  return '<div class="match-duelist '+h(club.toLowerCase())+'">'+
   '<span class="match-duelist-team">'+h(club)+' · '+h(role)+'</span>'+
   renderCharacterPortrait(id,'faceoff-portrait')+
   '<strong class="match-duelist-name">'+h(name)+'</strong>'+
   '<div class="match-duelist-badges"><span class="match-duelist-position">'+h(position)+'</span>'+
   '<span class="match-duelist-rating">NOTE '+h(rating)+'</span></div>'+
   (actual?.outOfPosition?'<small class="match-duelist-out">Hors poste</small>':'')+'</div>';
 };
 return '<div class="match-faceoff match-shot-faceoff" aria-label="Tireur : '+
  h(CARD_BY_ID.get(shooterId)?.name??shooterId)+' face au gardien : '+
  h(CARD_BY_ID.get(keeperId)?.name??keeperId)+'">'+
  profile(shooterId,attacker,shooterLabel)+
  '<span class="faceoff-vs" aria-hidden="true">VS</span>'+
  profile(keeperId,defender,keeperLabel)+'</div>';
}

const RESULTS=Object.freeze({
 goal:{title:'BUUUUT !',detail:'Le ballon termine au fond des filets !',tone:'goal',tag:'⚽'},
 save:{title:'ARRÊT DU GARDIEN !',detail:'Le gardien repousse la frappe !',tone:'save',tag:'🧤'},
 miss:{title:'TIR MANQUÉ !',detail:'Le ballon ne trouve pas le cadre.',tone:'miss',tag:'✕'}
});
/** Rend UNIQUEMENT un résultat de frappe, jamais une action stoppée avant tir. */
export function renderShotResult(state,{outcome,attacker,minute,shooterId,keeperId,
 score,action='match-continue-result',continueLabel='Continuer',context='Résultat du tir',detailExtra=''}={}){
 const cfg=RESULTS[outcome];if(!cfg)return '';
 const defender=opposite(attacker);
 const actorId=outcome==='save'?(keeperId??keeperOf(state,defender)):shooterId;
 const club=outcome==='save'?defender:attacker;
 const actual=actorId?playerOf(state,club,actorId):null;
 const natural=actorId?CARD_BY_ID.get(actorId):null;
 const role=outcome==='save'?'Gardien':'Tireur';
 const portrait=actorId?'<div class="shot-result-player">'+
  renderCharacterPortrait(actorId,'shot-result-portrait')+
  '<strong>'+h(natural?.name??actorId)+'</strong>'+
  '<div class="shot-result-player-meta">'+h(club)+' · '+role+
  (actual?' · '+h(actual.position)+' · Note '+actual.rating:'')+
  (actual?.outOfPosition?' · Hors poste':'')+'</div></div>':'';
 const scoreboard=score?'<div class="shot-result-score" aria-label="Score après la frappe">'+
  '<span>PSG</span><strong>'+h(score.PSG)+' – '+h(score.OM)+'</strong><span>OM</span></div>':'';
 return '<section class="panel match-stage shot-result-panel shot-result-'+cfg.tone+'" aria-label="'+cfg.title+'">'+
  '<span class="eyebrow">'+h(context)+(Number.isInteger(minute)?' · '+minute+'e':'')+'</span>'+
  '<span class="shot-result-icon" aria-hidden="true">'+cfg.tag+'</span>'+
  '<h2 class="shot-result-headline">'+cfg.title+'</h2>'+
  '<p class="shot-result-description">'+cfg.detail+'</p>'+
  (detailExtra?'<p class="shot-result-directions">'+h(detailExtra)+'</p>':'')+
  portrait+scoreboard+
  '<p class="shot-result-wait">Le résultat reste affiché jusqu’à validation.</p>'+
  '<button class="btn primary full" data-action="'+h(action)+'">'+h(continueLabel)+'</button></section>';
}

export function matchKeeperId(state,club){return keeperOf(state,club);}
