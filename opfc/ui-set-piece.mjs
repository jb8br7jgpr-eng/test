/**
 * OPFC v0.8 — bloc 9B2 : interface locale des phases arrêtées.
 * Uniquement l'état public pour le rendu, état privé pour les transitions.
 * Les choix sont verrouillés et jamais affichés avant la double confirmation.
 */
import {CARD_BY_ID} from './catalog.mjs';
import {renderCharacterPortrait} from './ui-portraits.mjs';
import {beginSetPieceAction,selectSetPieceTaker,lockSetPieceChoice,
 revealSetPieceDuel,continueSetPieceDuel,finishSetPieceCorner,revealSetPiecePenalty} from './set-piece-actions.mjs';
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
const choices=arr=>'<div class="match-choice-grid">'+arr.map(([id,label])=>
 '<button class="btn match-choice" data-action="match-choose" data-choice="'+id+'">'+escape(label)+'</button>').join('')+'</div>';
const section=(heading,content,tag='Phase arrêtée')=>'<section class="panel match-stage"><span class="eyebrow">'+escape(tag)+'</span><h2>'+heading+'</h2>'+content+'</section>';
const handover=club=>'<section class="match-handover" aria-label="Transmission confidentielle"><div class="match-handover-icon">🔒</div>'+
 '<h2>À toi de jouer, '+club+'</h2><p>Passe le téléphone au joueur '+club+'. La décision adverse reste secrète.</p>'+
 button('match-uncover','Je suis '+club+' · afficher mon choix')+'</section>';
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
  return lockSetPieceChoice(state,club,choice);
 }
 if(command==='reveal-setpiece-duel')return revealSetPieceDuel(state,rng());
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
  return section('Choisis le tireur · '+a.attacker,
   '<p class="muted">Un des sept titulaires, gardien compris. Son choix sera annoncé avant les tactiques.</p>'+
   '<div class="match-choice-grid">'+ids.map(id=>
    '<button class="btn match-choice setpiece-taker" data-action="match-taker" data-card="'+escape(id)+'">'+renderCharacterPortrait(id,'setpiece-taker-portrait')+escape(name(id))+'</button>').join('')+'</div>',type);
 }
 if(a.stage==='attack-choice'||a.stage==='defense-choice'){
  const attacking=a.stage==='attack-choice',role=attacking?'attack':'defense';
  const desc=attacking?'Choix offensif':'Réponse défensive';
  const actor=attacking?a.attacker:a.defender;
  return section(desc+' · '+actor,
   '<p class="muted">La tactique choisie est verrouillée. Elle reste invisible pour l’adversaire.</p>'+
   '<div class="setpiece-feature">'+renderCharacterPortrait(a.actors?.taker?.cardId,'setpiece-player-feature')+
   '<p class="caption">Tireur : '+escape(name(a.actors?.taker?.cardId))+
   (a.actors?.receiver?' · Réceptionneur : '+escape(name(a.actors.receiver.cardId)):'')+'</p></div>'+
   choices(options[a.kind][role]),type);
 }
 if(a.stage==='duel-ready')
  return section('Les deux tactiques sont verrouillées',
   '<p>Les choix de zones et de défense seront dévoilés ensemble.</p>'+
   button('match-reveal-setpiece-duel','Révéler et résoudre le duel'),type);
 if(a.stage==='duel-revealed'){
  const r=a.duel,success=r?.outcome?.outcome==='chance';
  const attack=r?.calculation?.attackZone??r?.calculation?.attack;
  const defense=r?.calculation?.defenseZone??r?.calculation?.defense;
  return section(success?'Occasion créée !':'La défense récupère le ballon',
   '<p>'+escape(attack)+' face à '+escape(defense)+'</p>'+
   '<p class="caption">Probabilité de réussite du duel : '+
   Number(r?.calculation?.successProbability??0).toFixed(1)+' %</p>'+
   button('match-continue-setpiece-duel','Continuer'),type);
 }
 if(a.stage==='corner-gesture-choice')
  return section('Choisis la finition du corner · '+a.attacker,
   '<p>Le réceptionneur '+escape(name(a.actors?.receiver?.cardId))+' frappe. Aucun second choix du gardien.</p>'+
   choices([['TETE','Tête'],['VOLEE','Reprise de volée'],['RETOURNE','Retourné acrobatique']]),type);
 if(a.stage==='corner-finish-ready')
  return section('Le geste est choisi',
   '<p>Le gardien tente maintenant d’arrêter la frappe.</p>'+
   button('match-finish-corner','Résoudre la finition'),type);
 if(a.stage==='penalty-ready')
  return section('Les deux directions sont verrouillées',
   '<p>Le penalty sera résolu en une seule fois, sans rebond.</p>'+
   button('match-reveal-penalty','Révéler les directions et tirer'),type);
 return section('Action en attente', '<p>La phase arrêtée va continuer.</p>',type);
}
