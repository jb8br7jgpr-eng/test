/** OPFC v0.8 — bloc 9B1, presentation locale du jeu ouvert.
 * Vue construite à partir de matchPublicView uniquement : ni calendrier futur
 * ni tactique confirmée cachée ne sont exposés dans l'interface.
 * Les actions appellent les fonctions officielles de match-actions.mjs.
 */
import {CARD_BY_ID} from './catalog.mjs';
import {matchPublicView,kickoffMatch,continueMatch,resumeMatch} from './match.mjs';
import {beginOpenPlayAction,lockOpenPlayChoice,revealOpenPlayDuel,continueOpenPlayDuel,revealOpenPlayShot} from './match-actions.mjs';

const html=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const name=id=>CARD_BY_ID.get(id)?.name??id??'—';
const BUTTONS={
 'attack-choice':[['COMBINER','Combiner'],['LANCER','Lancer'],['PERCER','Percer']],
 'defense-choice':[['PRESSER','Presser'],['INTERCEPTER','Intercepter'],['CONTENIR','Contenir']],
 'shot-attack-choice':[['PLACEE','Frappe placée'],['PUISSANTE','Frappe puissante'],['PIQUEE','Ballon piqué']],
 'shot-defense-choice':[['LIGNE','Rester sur la ligne'],['SORTIE','Sortir'],['PLONGEON','Anticiper le plongeon']]
};
const ACTOR={
 'attack-choice':'attacker','defense-choice':'defender',
 'shot-attack-choice':'attacker','shot-defense-choice':'defender'
};
const ACTION_LABEL={
 open:'Jeu ouvert',corner:'Corner','free-kick':'Coup franc',penalty:'Penalty'
};
const OUTCOME={stopped:'Attaque stoppée',chance:'Occasion créée',foul:'Faute sifflée',
 miss:'Tir manqué',save:'Arrêt du gardien',goal:'BUUUUT !'};
const stageLabels={
 'attack-choice':'Choix de construction', 'defense-choice':'Réponse défensive',
 'shot-attack-choice':'Choix du tir','shot-defense-choice':'Réaction du gardien'
};
const button=(act,text,attr='')=>'<button class="btn primary full" data-action="'+act+'" '+attr+'>'+html(text)+'</button>';
/** Retourne le club qui doit recevoir physiquement le téléphone maintenant. */
export function matchTurnOwner(state){
 if(state?.phase!=='match')return null;
 const a=state.match?.action;
 if(!a||a.kind!=='open')return null;
 return ACTOR[a.stage]?a[ACTOR[a.stage]]:null;
}
export function matchRequiresPrivacy(state){
 return matchTurnOwner(state)!==null;
}
/** Commandes de test et de l'interface locale, sans saisie des résultats.
 * Le club est déterminé depuis l'état privé (les vérifications de moteur
 * restent actives). Aucun endpoint serveur n'est exposé par ce module.
 */
export function dispatchOpenMatch(state,command,{choice,rng=Math.random}={}){
 if(state?.phase==='kickoff-ready'&&command==='kickoff')
  return kickoffMatch(state,rng);
 if(command==='resume'&&state?.phase==='resume-ready')
  return resumeMatch(state);
 if(command==='continue-result')return continueMatch(state);
 const a=state?.match?.action;
 if(command==='begin-open')return beginOpenPlayAction(state,rng);
 if(command==='choose'){
  const owner=matchTurnOwner(state);
  if(!owner)throw Error('Aucun joueur ne doit choisir maintenant');
  return lockOpenPlayChoice(state,owner,choice);
 }
 if(!a||a.kind!=='open')throw Error('Action de jeu ouvert absente');
 if(command==='reveal-duel')return revealOpenPlayDuel(state,rng());
 if(command==='continue-duel')return continueOpenPlayDuel(state);
 if(command==='reveal-shot')return revealOpenPlayShot(state,rng());
 throw Error('Commande de match inconnue');
}
function scoreBoard(m){
 return '<div class="match-scoreboard"><div><span class="score-club psg">PSG</span><small>Pirates Saint-Grandline</small></div>'+
 '<div class="match-score"><strong>'+m.score.PSG+' – '+m.score.OM+'</strong><span>'+m.minute+'e minute</span></div>'+
 '<div><span class="score-club om">OM</span><small>Olympique de MaryGeoise</small></div></div>';
}
function scoreStats(m){
 return '<div class="match-mini-stats">'+['PSG','OM'].map(id=>'<div><strong>'+id+'</strong><span>'+
 m.statistics[id].shots+' tirs · '+m.statistics[id].onTarget+' cadrés</span></div>').join('')+'</div>';
}
function choiceGrid(options){
 return '<div class="match-choice-grid">'+options.map(([id,title])=>
 '<button class="btn match-choice" data-action="match-choose" data-choice="'+id+'">'+html(title)+'</button>').join('')+'</div>';
}
function fieldNames(a){
 if(!a?.roles)return '';
 return '<div class="match-actors"><div><span>Porteur</span><strong>'+html(name(a.roles.carrier.cardId))+'</strong></div>'+
 '<div><span>Partenaire</span><strong>'+html(name(a.roles.partner.cardId))+'</strong></div>'+
 '<div><span>Défenseur</span><strong>'+html(name(a.roles.defender.cardId))+'</strong></div></div>';
}
function handover(owner){
 return '<section class="match-handover" aria-label="Transmission confidentielle">'+
 '<div class="match-handover-icon" aria-hidden="true">🔒</div><h2>À toi de jouer, '+owner+'</h2>'+
 '<p>Passe le téléphone au joueur '+owner+'. La décision précédente reste masquée.</p>'+
 button('match-uncover','Je suis '+owner+' · afficher mon choix')+'</section>';
}
function renderAction(state,view,uncovered){
 const a=view.match.action,owner=matchTurnOwner(state);
 if(owner&&!uncovered)return handover(owner);
 if(owner){
  const isShot=a.stage.startsWith('shot-'),role=ACTOR[a.stage];
  return '<section class="panel match-stage"><span class="eyebrow">'+html(stageLabels[a.stage])+'</span>'+
   '<h2>'+a[role]+' · '+(role==='attacker'?'Attaque':'Défense')+'</h2>'+
   '<p class="muted">Ta décision est secrète jusqu’à la confirmation de ton adversaire.</p>'+
   fieldNames(a)+choiceGrid(BUTTONS[a.stage])+'</section>';
 }
 if(a.stage==='duel-ready')return '<section class="panel match-stage"><h2>Les deux tactiques sont validées</h2>'+
  '<p class="muted">Elles vont être révélées simultanément.</p>'+button('match-reveal-duel','Révéler et résoudre le duel')+'</section>';
 if(a.stage==='duel-revealed'){
  const duel=a.duel;
  return '<section class="panel match-stage"><span class="eyebrow">Résultat du duel</span><h2>'+
   html(OUTCOME[duel?.outcome?.outcome]??'Duel résolu')+'</h2>'+
   '<p>'+html(duel?.calculation?.attack)+' face à '+html(duel?.calculation?.defense)+'</p>'+
   '<p class="caption">Probabilité calculée : '+Number(duel?.calculation?.successConditional??duel?.calculation?.successProbability??0).toFixed(1)+' % (hors faute le cas échéant).</p>'+
   button('match-continue-duel','Continuer')+'</section>';
 }
 if(a.stage==='shot-ready')return '<section class="panel match-stage"><h2>Le tireur et le gardien ont choisi</h2>'+
  '<p>Les deux choix vont être révélés simultanément.</p>'+
  button('match-reveal-shot','Résoudre la frappe')+'</section>';
 if(a.stage==='set-piece-pending')return '<section class="panel match-stage"><h2>Faute · phase arrêtée</h2>'+
  '<p class="muted">La suite de cette action sera raccordée à l’interface des penalties et coups francs au bloc 9B2, sans ajouter de séquence.</p></section>';
 return '<section class="panel match-stage"><h2>Action en préparation</h2></section>';
}
function resultView(m){
 const r=m.lastResult,goal=r?.scorerId?'<p><strong>Buteur : '+html(name(r.scorerId))+'</strong></p>':'';
 return '<section class="panel match-stage"><span class="eyebrow">Résultat · '+r.minute+'e</span><h2>'+
  html(OUTCOME[r.outcome]??r.outcome)+'</h2>'+goal+
  '<p class="muted">Le résultat reste affiché jusqu’à validation.</p>'+
  button('match-continue-result','Continuer')+'</section>';
}
export function renderMatchScreen(state,{uncovered=false}={}){
 if(state?.phase==='kickoff-ready')return '<section class="panel match-stage">'+
  '<span class="eyebrow">Grandline Cup · Avant-match</span><h2>Les équipes sont prêtes !</h2>'+
  '<p>Sept joueurs de chaque côté. Les compositions se verrouillent au coup d’envoi.</p>'+
  button('match-kickoff','Donner le coup d’envoi')+'</section>';
 const view=matchPublicView(state),m=view.match;
 if(!m)return '<section class="panel match-stage"><h2>Aucun match en cours</h2></section>';
 let out=scoreBoard(m);
 if(state.phase==='half-time')return out+'<div class="ready-banner"><h2>Mi-temps · 45e minute</h2>'+
  '<p>Les deux joueurs peuvent réorganiser leur composition. Le calendrier est conservé.</p></div>';
 if(state.phase==='resume-ready')return out+'<section class="panel match-stage">'+
  '<h2>Les deux compositions sont validées</h2>'+button('match-resume','Reprendre la deuxième mi-temps')+'</section>';
 if(state.phase==='shootout-ready')return out+'<section class="panel match-stage"><h2>Égalité à 90 minutes</h2>'+
  '<p>Les tirs au but seront reliés aux écrans au bloc 9B2.</p></section>';
 if(state.phase==='finished')return out+'<section class="panel match-stage"><h2>Fin du match</h2>'+
  '<p>Vainqueur : '+html(m.winner)+'</p></section>';
 if(state.phase==='moment-result')return out+scoreStats(m)+resultView(m);
 const moment=m.currentMoment;
 if(!m.action){
  const supported=moment?.type==='open';
  out+='<section class="panel match-stage"><span class="eyebrow">'+html(moment?.minute)+'e · '+html(ACTION_LABEL[moment?.type]??'Action')+'</span>'+
   '<h2>'+html(moment?.attacker)+' passe à l’attaque</h2>'+
   (supported?'<p>Annonce des personnages et choix tactiques confidentiels.</p>'+
    button('match-begin-open','Commencer cette action'):
    '<p>Les écrans de cette phase arrêtée arrivent au bloc 9B2. La séquence reste intacte.</p>')+
   '</section>';
  return out+scoreStats(m);
 }
 out+='<div class="match-context">'+html(ACTION_LABEL[m.action.kind])+' · '+html(m.action.context??'')+
  ' · '+html(m.action.attacker)+' attaque</div>';
 return out+scoreStats(m)+renderAction(state,view,uncovered);
}
