/**
 * OPFC v0.8 — bloc 9B2 : interface locale des phases arrêtées.
 * Uniquement l'état public pour le rendu, état privé pour les transitions.
 * Les choix sont verrouillés et jamais affichés avant la double confirmation.
 */
import {CARD_BY_ID} from './catalog.mjs?v=opfc-75-roster-20261022';
import {renderCharacterPortrait} from './ui-portraits.mjs';
import {visualAbbr} from './club-identities.mjs';
import {matchTacticalChoices,renderShotFaceOff,renderReceiverCard,renderShotResult} from './ui-match-widgets.mjs?v=opfc-result-polish-20261026';
import {beginSetPieceAction,selectSetPieceTaker,lockSetPieceChoice,
 revealSetPieceDuel,continueSetPieceDuel,finishSetPieceCorner,revealSetPiecePenalty} from './set-piece-actions.mjs?v=opfc-match-balance-20261025';
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const name=id=>CARD_BY_ID.get(id)?.name??id??'—';
const kindLabel={corner:'Corner','free-kick':'Coup franc',penalty:'Penalty'};
const button=(action,label,extra='')=>'<button class="btn primary full" data-action="'+action+'" '+extra+'>'+escape(label)+'</button>';
const options={
 corner:{
  attack:[['PREMIER','Premier poteau'],['PENALTY','Point de penalty'],['SECOND','Second poteau']],
  defense:[['PREMIER','Couvrir le premier poteau'],['PENALTY','Couvrir le point de penalty'],['SECOND','Couvrir le second poteau']]
 },
 'free-kick':{
  attack:[['DIRECT','Frappe directe'],['CENTRE','Centre'],['COMBINAISON','Combinaison courte']],
  defense:[['MUR','Renforcer le mur'],['MARQUAGE','Marquage serré'],['ANTICIPER','Anticiper']]
 },
 penalty:{
  attack:[['GAUCHE','Tirer à gauche'],['CENTRE','Tirer au centre'],['DROITE','Tirer à droite']],
  defense:[['GAUCHE','Plonger à gauche'],['CENTRE','Rester au centre'],['DROITE','Plonger à droite']]
 }
};
const choices=arr=>matchTacticalChoices(arr);
const section=(heading,content,tag='Phase arrêtée')=>'<section class="panel match-stage"><span class="eyebrow">'+escape(tag)+'</span><h2>'+heading+'</h2>'+content+'</section>';
const actorsFaceOff=(state,a,{receiver=false}={})=>renderShotFaceOff(state,{
 shooterId:receiver?a.actors?.receiver?.cardId:a.actors?.taker?.cardId,
 keeperId:a.keeper?.cardId,attacker:a.attacker,defender:a.defender,
 shooterLabel:receiver?'Finisseur':'Tireur',keeperLabel:'Gardien'
});
const receiverCard=(state,a)=>a.kind==='penalty'?'':renderReceiverCard(state,{
 receiverId:a.actors?.receiver?.cardId,club:a.attacker,
 possible:a.kind==='free-kick'
});
const handover=club=>'<section class="match-handover" aria-label="Transmission confidentielle"><div class="match-handover-icon">🔒</div>'+
 '<h2>À toi de jouer, '+escape(visualAbbr(club))+'</h2><p>Passe le téléphone au joueur '+escape(visualAbbr(club))+'. La décision adverse reste secrète.</p>'+
 button('match-uncover','Je suis '+escape(visualAbbr(club))+' · afficher mon choix')+'</section>';
export const isSetPieceKind=kind=>['corner','free-kick','penalty'].includes(kind);
export function setPieceTurnOwner(state){
 if(state?.phase!=='match')return null;
 const a=state.match?.action;
 if(!isSetPieceKind(a?.kind))return null;
 if(['taker-choice','attack-choice','corner-gesture-choice'].includes(a.stage))return a.attacker;
 if(a.stage==='defense-choice')return a.defender;
 return null;
}
export function dispatchSetPieceMatch(state,command,{choice,takerId,rng=Math.random}={}){
 if(command==='begin-setpiece')return beginSetPieceAction(state);
 const a=state?.match?.action;
 if(command==='select-taker'){
  if(a?.stage!=='taker-choice'||!isSetPieceKind(a.kind))throw Error('Choix du tireur indisponible');
  return selectSetPieceTaker(state,a.attacker,takerId,rng);
 }
 if(command==='choose'){
  const club=setPieceTurnOwner(state);
  if(!club)throw Error('Aucun choix de phase arrêtée attendu');
  let next=lockSetPieceChoice(state,club,choice);
  if(next.match.action?.stage==='duel-ready')
   next=revealSetPieceDuel(next,rng(),rng);
  else if(next.match.action?.stage==='penalty-ready')
   next=revealSetPiecePenalty(next,rng());
  else if(next.match.action?.stage==='corner-finish-ready')
   next=finishSetPieceCorner(next,rng());
  return next;
 }
 if(command==='reveal-setpiece-duel')return revealSetPieceDuel(state,rng(),rng);
 if(command==='continue-setpiece-duel')return continueSetPieceDuel(state,rng());
 if(command==='finish-corner')return finishSetPieceCorner(state,rng());
 if(command==='reveal-penalty')return revealSetPiecePenalty(state,rng());
 throw Error('Commande de phase arrêtée inconnue');
}
export function renderSetPieceAction(state,viewAction,{uncovered=false}={}){
 const a=viewAction,owner=setPieceTurnOwner(state),type=kindLabel[a.kind];
 if(owner&&!uncovered)return handover(owner);
 if(a.stage==='taker-choice'){
  const team=state.teams.find(t=>t.club===a.attacker);
  const ids=team?.slots??[];
  return section('Choisis le tireur · '+escape(visualAbbr(a.attacker)),
   '<p class="muted">Un des sept titulaires, gardien compris. Son choix sera annoncé avant les tactiques.</p>'+
   '<div class="match-choice-grid match-tactical-choices">'+ids.map(id=>
    '<button type="button" class="btn match-choice setpiece-taker" data-action="match-taker" data-card="'+escape(id)+'">'+
    renderCharacterPortrait(id,'setpiece-taker-portrait')+
    '<span class="setpiece-taker-label"><span class="match-choice-emoji" aria-hidden="true">⚽</span>'+
    '<strong>'+escape(name(id))+'</strong></span></button>').join('')+'</div>',type);
 }
 if(a.stage==='attack-choice'||a.stage==='defense-choice'){
  const attacking=a.stage==='attack-choice',role=attacking?'attack':'defense';
  const desc=attacking?'Choix offensif':'Réponse défensive';
  const actor=attacking?a.attacker:a.defender;
  return section(desc+' · '+escape(visualAbbr(actor)),
   '<p class="muted">La tactique choisie est verrouillée. Elle reste invisible pour l’adversaire.</p>'+
   actorsFaceOff(state,a)+receiverCard(state,a)+
   choices(options[a.kind][role]),type);
 }
 if(a.stage==='duel-ready')
  return section('Les deux tactiques sont verrouillées',
   actorsFaceOff(state,a)+'<p>Les choix de zones et de défense seront dévoilés ensemble.</p>'+
   button('match-reveal-setpiece-duel','Révéler et résoudre le duel'),type);
 if(a.stage==='duel-revealed'){
  const outcome=a.duel?.outcome?.outcome;
  const typeDescription=a.kind==='corner'?'Corner':'Coup franc';
  return renderShotResult(state,{
   outcome,attacker:a.attacker,minute:a.minute,score:state.match?.score,
   shooterId:a.actors?.receiver?.cardId??a.actors?.taker?.cardId,
   defenderId:a.actors?.defender?.cardId,
   context:typeDescription+' · Résultat du duel',
   detailExtra:outcome==='chance'?
    (a.kind==='corner'?'Le réceptionneur va choisir son geste.':
     'Le tireur va tenter sa finition.'):
    'La défense a récupéré le ballon. Prochaine action après Continuer.',
   action:'match-continue-setpiece-duel',
   continueLabel:outcome==='chance'?
    (a.kind==='corner'?'Choisir la finition':'Résoudre le tir'):'Continuer'
  });
 }
 if(a.stage==='corner-gesture-choice')
  return section('Choisis la finition du corner · '+escape(visualAbbr(a.attacker)),
   actorsFaceOff(state,a,{receiver:true})+
   '<p>Le réceptionneur choisit son geste. Aucun second choix du gardien.</p>'+
   receiverCard(state,a)+
   choices([['TETE','Tête'],['VOLEE','Reprise de volée'],['RETOURNE','Retourné acrobatique']]),type);
 if(a.stage==='corner-finish-ready')
  return section('Le geste est choisi',
   actorsFaceOff(state,a,{receiver:true})+'<p>Le gardien tente maintenant d’arrêter la frappe.</p>'+
   button('match-finish-corner','Résoudre la finition'),type);
 if(a.stage==='penalty-ready')
  return section('Les deux directions sont verrouillées',
   actorsFaceOff(state,a)+'<p>Le penalty sera résolu en une seule fois, sans rebond.</p>'+
   button('match-reveal-penalty','Révéler les directions et tirer'),type);
 return section('Action en attente', '<p>La phase arrêtée va continuer.</p>',type);
}
