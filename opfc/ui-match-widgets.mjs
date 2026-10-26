/**
 * Composants cosmétiques partagés : les cartes de choix reprennent EXACTEMENT
 * l'habillage des cases d'enchères OPMercato classique. Moteur inchangé.
 * Confrontation et annonce de tir affichent exclusivement des données connues.
 */
import {CARD_BY_ID} from './catalog.mjs?v=opfc-75-roster-20261022';
import {lineupDetails} from './rules.mjs';
import {renderCharacterPortrait,renderClubCrest} from './ui-portraits.mjs';
import {visualAbbr} from './club-identities.mjs';

const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const opposite=c=>c==='PSG'?'OM':'PSG';
const playerOf=(state,club,id)=>state?.teams?.find(team=>team.club===club)
 ?lineupDetails(state.teams.find(team=>team.club===club)).find(p=>p?.cardId===id)??null:null;
const keeperOf=(state,club)=>state?.teams?.find(t=>t.club===club)
 ?lineupDetails(state.teams.find(t=>t.club===club)).find(p=>p?.position==='GAR')?.cardId??null:null;

// Emojis purement décoratifs, liés au LIBELLÉ : par exemple « Centre » peut
// désigner un centre offensif ou la direction centrale d'un tir au but.
// Les identifiants de choix envoyés au moteur restent strictement inchangés.
const TACTICAL_EMOJIS=Object.freeze({
 'Passe courte':'🔗','Passe en profondeur':'🚀','Dribbler':'⚡',
 'Tacler':'🦵','Intercepter':'🛡️','Pressing':'🏃',
 'Frappe placée':'🎯','Frappe puissante':'💥','Ballon piqué':'🪄',
 'Rester sur sa ligne':'🧤','Réduire l’angle':'🏃','Plongeon anticipé':'🤿',
 'Premier poteau':'🥅','Point de penalty':'🎯','Second poteau':'🥅',
 'Couvrir le premier poteau':'🛡️','Couvrir le point de penalty':'🧱',
 'Couvrir le second poteau':'🛡️',
 'Frappe directe':'🎯','Centre':'📐','Combinaison courte':'🔗',
 'Renforcer le mur':'🧱','Marquage serré':'🛡️','Anticiper':'👁️',
 'Tirer à gauche':'⬅️','Tirer au centre':'🎯','Tirer à droite':'➡️',
 'Plonger à gauche':'⬅️','Rester au centre':'🧤','Plonger à droite':'➡️',
 'Tête':'⚽','Reprise de volée':'💥','Retourné acrobatique':'🤸',
 'Gauche':'⬅️','Droite':'➡️'
});
// Explications purement visuelles de la matrice de sauvegarde, affichées
// uniquement quand les trois options sont les réactions du gardien.
const KEEPER_HINTS=Object.freeze({
 LIGNE:'Contre surtout le ballon piqué',
 SORTIE:'Contre surtout la frappe placée',
 PLONGEON:'Contre surtout la frappe puissante'
});
// Conseils dérivés des avantages tactiques existants ; rien de secret n'est lu.
const DEFENSE_HINTS=Object.freeze({
 PRESSER:'Contre surtout le dribble',
 INTERCEPTER:'Contre surtout la passe en profondeur',
 CONTENIR:'Contre surtout la passe courte'
});
const FREE_KICK_HINTS=Object.freeze({
 MUR:'Contre surtout la frappe directe',
 MARQUAGE:'Contre surtout le centre',
 ANTICIPER:'Contre surtout la combinaison courte'
});
export function matchTacticalChoices(options,action='match-choose',recommended=null){
 const ids=options.map(([id])=>id).join(',');
 const descriptions=ids==='LIGNE,SORTIE,PLONGEON'?KEEPER_HINTS:
  ids==='PRESSER,INTERCEPTER,CONTENIR'?DEFENSE_HINTS:
  ids==='MUR,MARQUAGE,ANTICIPER'?FREE_KICK_HINTS:null;
 return '<div class="match-choice-grid match-tactical-choices">'+options.map(([id,label])=>{
  const emoji=TACTICAL_EMOJIS[label]??'⚽';
  return '<button type="button" class="btn match-choice" data-action="'+h(action)+
   '" data-choice="'+h(id)+'"'+(id===recommended?' data-recommended="true"':'')+'>'+
   '<span class="match-choice-emoji" aria-hidden="true">'+emoji+'</span>'+
   (descriptions?'<span class="keeper-choice-copy"><strong>'+h(label)+'</strong>'+
    '<small class="match-keeper-hint">'+h(descriptions[id])+'</small></span>':
    '<strong>'+h(label)+'</strong>')+
   (id===recommended?'<small class="match-shot-recommendation">⭐ Tir conseillé</small>':'')+'</button>';
 }).join('')+'</div>';
}

/**
 * Encart de réception partagé entre coups de pied arrêtés et jeu ouvert.
 * Utilise exclusivement une sélection de rôle DÉJÀ annoncée, jamais un
 * choix tactique secret. Le poste et la note proviennent du terrain réel.
 */
export function renderReceiverCard(state,{receiverId,club,possible=false}={}){
 if(!receiverId||!['PSG','OM'].includes(club))return '';
 const playing=playerOf(state,club,receiverId);
 if(!playing)return '';
 const name=CARD_BY_ID.get(receiverId)?.name??receiverId;
 const caption=possible?'PARTENAIRE POTENTIEL À LA RÉCEPTION':'JOUEUR À LA RÉCEPTION';
 return '<div class="receiver-card '+h(club.toLowerCase())+'" aria-label="'+
   h((possible?'Partenaire potentiel':'Réceptionneur')+' : '+name)+'">'+
  '<div class="receiver-card-portrait">'+renderCharacterPortrait(receiverId,'receiver-portrait')+'</div>'+
  '<div class="receiver-card-content"><span class="receiver-card-label">⚽ '+caption+'</span>'+
  '<strong class="receiver-card-name">'+h(name)+'</strong>'+
  '<div class="receiver-card-details"><span class="receiver-card-club">'+h(visualAbbr(club))+'</span>'+
  '<span class="receiver-card-position">'+h(playing.position)+'</span>'+
  '<span class="receiver-card-rating">NOTE '+playing.rating+'</span>'+
  (playing.outOfPosition?'<span class="receiver-card-warning">! Hors poste</span>':'')+
  '</div></div></div>';
}

export function renderShotFaceOff(state,{shooterId,keeperId,attacker,defender,shooterLabel='Tireur',keeperLabel='Gardien'}={}){
 if(!shooterId||!keeperId||!attacker||!defender)return '';
 const profile=(id,club,role)=>{
  const actual=playerOf(state,club,id),original=CARD_BY_ID.get(id);
  const name=original?.name??id,position=actual?.position??original?.position??'?',
   rating=actual?.rating??original?.rating??'—';
  return '<div class="match-duelist '+h(club.toLowerCase())+'">'+
   '<span class="match-duelist-team">'+h(visualAbbr(club))+' · '+h(role)+'</span>'+
   renderCharacterPortrait(id,'faceoff-portrait')+
   '<strong class="match-duelist-name">'+h(name)+'</strong>'+
   '<div class="match-duelist-badges"><span class="match-duelist-position">'+h(position)+'</span>'+
   '<span class="match-duelist-rating">NOTE '+h(rating)+'</span></div>'+
   (actual?.outOfPosition?'<small class="match-duelist-out">Hors poste</small>':'')+'</div>';
 };
 return '<div class="match-faceoff match-shot-faceoff match-faceoff-immersive" aria-label="Tireur : '+
  h(CARD_BY_ID.get(shooterId)?.name??shooterId)+' face au gardien : '+
  h(CARD_BY_ID.get(keeperId)?.name??keeperId)+'">'+
  profile(shooterId,attacker,shooterLabel)+
  '<span class="faceoff-vs" aria-hidden="true">VS</span>'+
  profile(keeperId,defender,keeperLabel)+'</div>';
}

const RESULTS=Object.freeze({
 goal:{title:'BUUUUT !',detail:'Le ballon termine au fond des filets !',tone:'goal',tag:'⚽'},
 save:{title:'ARRÊT DU GARDIEN !',detail:'Le gardien repousse la frappe !',tone:'save',tag:'🧤'},
 miss:{title:'TIR RATÉ !',detail:'Le ballon ne trouve pas le cadre !',tone:'miss',tag:'❌'},
 stopped:{title:'ATTAQUE STOPPÉE !',detail:"Le défenseur récupère le ballon, l'attaque est terminée.",tone:'stopped',tag:'🛡️'},
 chance:{title:'OCCASION CRÉÉE !',detail:'Le duel offensif est remporté ! Le tir va pouvoir être préparé.',tone:'chance',tag:'🔥'},
 foul:{title:'FAUTE SIFFLÉE !',detail:'Le jeu est arrêté : un coup franc ou un penalty va être tiré.',tone:'foul',tag:'📣'}
});
// Un bref effet à la première apparition, pas à chaque rafraîchissement en ligne.
const seenResultIntros=new Set();
function briefResultIntro(state,{outcome,attacker,minute,context,actorId}){
 const m=state?.match;
 const key=[state?.matchRecordId??'initial',m?.index??'',m?.action?.stage??'',
  m?.shootout?.timeline?.length??'',outcome,attacker,minute??'',context,actorId??''].join('|');
 if(seenResultIntros.has(key))return false;
 if(seenResultIntros.size>200)seenResultIntros.clear();
 seenResultIntros.add(key);
 return true;
}
const GOAL_GESTURES=Object.freeze({
 PLACEE:'🎯 Frappe placée',PUISSANTE:'💥 Frappe puissante',PIQUEE:'🪄 Ballon piqué',
 TETE:'⚽ Tête sur corner',VOLEE:'💥 Reprise de volée sur corner',
 RETOURNE:'🤸 Retourné sur corner'
});
function goalCaption(info){
 if(!info)return '';
 if(info.kind==='penalty')return '🥅 But sur penalty';
 if(info.kind==='corner')return GOAL_GESTURES[info.gesture]??'🚩 But sur corner';
 if(info.kind==='free-kick')return '⚽ But sur coup franc';
 if(info.kind==='open')return GOAL_GESTURES[info.shot]??'⚽ But en jeu ouvert';
 return '';
}
/** Shared regulation goal panel, preserving the existing outcome screen dimensions.
 * Shootout outcomes reuse the same panel; only the score context changes.
 */
export function renderShotResult(state,{outcome,attacker,minute,shooterId,keeperId,defenderId,
 score,action='match-continue-result',continueLabel='Continuer',context='Résultat du tir',detailExtra='',
 goalInfo=null,localGoalAcks=null,animateGoal=false,scoreLabel='Score après la frappe'}={}){
 const cfg=RESULTS[outcome];if(!cfg)return '';
 const defender=opposite(attacker);
 const actorId=outcome==='save'?(keeperId??keeperOf(state,defender)):
  outcome==='stopped'?(defenderId??null):shooterId;
 const club=['save','stopped'].includes(outcome)?defender:attacker;
 const actual=actorId?playerOf(state,club,actorId):null;
 const natural=actorId?CARD_BY_ID.get(actorId):null;
 const role=outcome==='goal'?'Buteur':outcome==='save'?'Gardien':
  outcome==='stopped'?'Défenseur décisif':outcome==='chance'?'Attaquant décisif':
  outcome==='foul'?'Joueur impliqué':'Tireur';
 const regulationGoal=outcome==='goal'&&goalInfo!==null;
 const briefIntro=!regulationGoal&&briefResultIntro(state,{outcome,attacker,minute,context,actorId});
 const portrait=actorId?'<div class="shot-result-player">'+
  renderCharacterPortrait(actorId,'shot-result-portrait')+
  '<strong>'+h(natural?.name??actorId)+'</strong>'+
  (regulationGoal?'<div class="shot-goal-caption">'+h(goalCaption(goalInfo))+'</div>':
   '<div class="shot-result-player-meta">'+h(visualAbbr(club))+' · '+role+
   (actual?' · '+h(actual.position)+' · Note '+actual.rating:'')+
   (actual?.outOfPosition?' · Hors poste':'')+'</div>')+'</div>':'';
 const scoreTeam=id=>'<span class="shot-goal-team">'+
  renderClubCrest(id,'shot-goal-crest')+h(visualAbbr(id))+'</span>';
 const scoreboard=score?'<div class="shot-result-score" aria-label="'+h(scoreLabel)+'">'+
  scoreTeam('PSG')+'<strong>'+['PSG','OM'].map(id=>'<span class="score-digit'+(regulationGoal&&animateGoal&&id===attacker?' score-digit-goal':'')+'">'+h(score[id])+'</span>').join(' – ')+'</strong>'+scoreTeam('OM')+'</div>':'';
 const assister=regulationGoal&&goalInfo.assistId&&CARD_BY_ID.has(goalInfo.assistId)?
  '<div class="shot-goal-assist">🎯 Passe décisive : '+h(CARD_BY_ID.get(goalInfo.assistId).name)+'</div>':'';
 const confirmation=regulationGoal&&localGoalAcks?
  '<div class="shot-goal-acks" aria-label="Confirmation des deux joueurs">'+
  ['PSG','OM'].map(id=>'<button type="button" class="btn shot-goal-ack" data-action="match-goal-ack" data-club="'+h(id)+'"'+
   (localGoalAcks[id]?' disabled aria-disabled="true"':'')+'>'+
   (localGoalAcks[id]?'✓ ':'')+h(visualAbbr(id))+' · '+(localGoalAcks[id]?'Prêt':'Continuer')+'</button>').join('')+'</div>':
  '<button class="btn primary full" data-action="'+h(action)+'">'+h(continueLabel)+'</button>';
 return '<section class="panel match-stage shot-result-panel shot-result-'+cfg.tone+
  ' shot-goal-celebration shot-result-unified'+
  (regulationGoal?(animateGoal?' shot-goal-intro':''):(briefIntro?' shot-result-intro':''))+
  '" aria-label="'+cfg.title+'">'+
  '<span class="eyebrow">'+h(context)+(Number.isInteger(minute)?' · '+minute+'e':'')+'</span>'+
  '<span class="shot-result-icon" aria-hidden="true">'+cfg.tag+'</span>'+
  '<h2 class="shot-result-headline">'+cfg.title+'</h2>'+
  (regulationGoal?'':'<p class="shot-result-description">'+h(detailExtra||cfg.detail)+'</p>')+
  portrait+scoreboard+assister+
  '<p class="shot-result-wait">'+(regulationGoal?'Les deux joueurs doivent valider.':'Le résultat reste affiché jusqu’à validation.')+'</p>'+
  confirmation+'</section>';
}

export function matchKeeperId(state,club){return keeperOf(state,club);}
