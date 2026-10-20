/** OPFC v0.8 — bloc 9B1, presentation locale du jeu ouvert.
 * Vue construite à partir de matchPublicView uniquement : ni calendrier futur
 * ni tactique confirmée cachée ne sont exposés dans l'interface.
 * Les actions appellent les fonctions officielles de match-actions.mjs.
 */
import {CARD_BY_ID} from './catalog.mjs';
import {lineupDetails} from './rules.mjs';
import {renderCharacterPortrait,renderClubCrest} from './ui-portraits.mjs';
import {matchPublicView,kickoffMatch,continueMatch,resumeMatch} from './match.mjs';
import {beginOpenPlayAction,lockOpenPlayChoice,revealOpenPlayDuel,continueOpenPlayDuel,revealOpenPlayShot} from './match-actions.mjs';
import {isSetPieceKind,setPieceTurnOwner,dispatchSetPieceMatch,renderSetPieceAction} from './ui-set-piece.mjs';
import {shootoutTurnOwner,dispatchShootout,renderShootoutScreen} from './ui-shootout.mjs';
import {renderFinalResult} from './ui-final.mjs';
import {setDisplayedClubs,visualName,visualAbbr} from './club-identities.mjs';
import {matchTacticalChoices,renderShotFaceOff,renderShotResult,renderReceiverCard,matchKeeperId} from './ui-match-widgets.mjs';

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
const QUALITY={
 FRANCHE:{label:'OCCASION FRANCHE',detail:'Meilleure situation',tone:'franche',icon:'🟢'},
 BONNE:{label:'BONNE OCCASION',detail:'Bonne situation',tone:'bonne',icon:'🟠'},
 DIFFICILE:{label:'ACTION DIFFICILE',detail:'Situation compliquée',tone:'difficile',icon:'🔴'}
};
const stageLabels={
 'attack-choice':'Choix de construction', 'defense-choice':'Réponse défensive',
 'shot-attack-choice':'Choix du tir','shot-defense-choice':'Réaction du gardien'
};
const button=(act,text,attr='')=>'<button class="btn primary full" data-action="'+act+'" '+attr+'>'+html(text)+'</button>';
/** Retourne le club qui doit recevoir physiquement le téléphone maintenant. */
export function matchTurnOwner(state){
 if(state?.phase==='shootout')return shootoutTurnOwner(state);
 if(state?.phase!=='match')return null;
 const a=state.match?.action;
 if(!a)return null;
 if(isSetPieceKind(a.kind))return setPieceTurnOwner(state);
 if(a.kind!=='open')return null;
 return ACTOR[a.stage]?a[ACTOR[a.stage]]:null;
}
export function matchRequiresPrivacy(state){
 return matchTurnOwner(state)!==null;
}
/** Commandes de test et de l'interface locale, sans saisie des résultats.
 * Le club est déterminé depuis l'état privé (les vérifications de moteur
 * restent actives). Aucun endpoint serveur n'est exposé par ce module.
 */
export function dispatchOpenMatch(state,command,{choice,takerId,rng=Math.random}={}){
 if(state?.phase==='kickoff-ready'&&command==='kickoff')
  return kickoffMatch(state,rng);
 if(command==='resume'&&state?.phase==='resume-ready')
  return resumeMatch(state);
 if(command==='continue-result')return continueMatch(state);
 if(['begin-shootout','shootout-choose','shootout-reveal','shootout-continue'].includes(command))
  return dispatchShootout(state,command,{choice,rng});
 if(command==='begin-setpiece')return dispatchSetPieceMatch(state,command,{choice,takerId,rng});
 const a=state?.match?.action;
 if(isSetPieceKind(a?.kind))return dispatchSetPieceMatch(state,command,{choice,takerId,rng});
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
 return '<div class="match-scoreboard"><div>'+renderClubCrest('PSG','score-crest')+'<small>'+html(visualName('PSG'))+'</small></div>'+
 '<div class="match-score"><strong>'+m.score.PSG+' – '+m.score.OM+'</strong><span>'+m.minute+'e minute</span></div>'+
 '<div>'+renderClubCrest('OM','score-crest')+'<small>'+html(visualName('OM'))+'</small></div></div>';
}
function scoreStats(m){
 return '<div class="match-mini-stats">'+['PSG','OM'].map(id=>'<div><strong>'+html(visualAbbr(id))+'</strong><span>'+
 m.statistics[id].shots+' tirs · '+m.statistics[id].onTarget+' cadrés</span></div>').join('')+'</div>';
}
/** Le contexte de l'occasion provient du moteur existant, jamais d'une estimation UI. */
function attackBanner(attacker,context,kind,minute){
 if(!['PSG','OM'].includes(attacker))return '';
 const defense=attacker==='PSG'?'OM':'PSG';
 const quality=QUALITY[context];
 return '<section class="match-attack-banner '+attacker.toLowerCase()+'" aria-label="Équipe attaquante : '+attacker+'">'+
 '<div class="match-attack-teams"><div class="match-attacking-team"><span>⚽ À L’ATTAQUE</span><strong>'+html(visualAbbr(attacker))+'</strong></div>'+
 '<div class="match-attack-arrow" aria-hidden="true">→</div>'+
 '<div class="match-defending-team"><span>EN DÉFENSE</span><strong>'+html(visualAbbr(defense))+'</strong></div></div>'+
 '<div class="match-action-type '+(quality?'type-'+quality.tone:'type-neutral')+'">'+
 (quality?'<strong>'+quality.icon+' '+quality.label+'</strong><small>'+quality.detail+'</small>':
 '<strong>'+html(ACTION_LABEL[kind]??'Action en cours')+'</strong><small>'+html(minute)+'e minute</small>')+
 '</div></section>';
}
const choiceGrid=options=>matchTacticalChoices(options);
function fieldNames(a){
 if(!a?.roles)return '';
 const players=[
  ['Porteur',a.roles.carrier?.cardId],
  ['Partenaire',a.roles.partner?.cardId],
  ['Défenseur',a.roles.defender?.cardId]
 ];
 return '<div class="match-actors">'+players.map(([label,id])=>
  '<div>'+renderCharacterPortrait(id,'match-actor-portrait')+
  '<span>'+label+'</span><strong>'+html(name(id))+'</strong></div>').join('')+'</div>';
}
function actualPlayer(state,club,id){
 if(!id||!['PSG','OM'].includes(club))return null;
 const team=state.teams?.find(t=>t.club===club);
 return team?lineupDetails(team).find(player=>player?.cardId===id)??null:null;
}
function faceOff(state,left,right,leftLabel,rightLabel,attacker,defender){
 if(!left||!right)return '';
 const playerCard=(id,role,club)=>{
  const player=actualPlayer(state,club,id);
  const original=CARD_BY_ID.get(id);
  const slot=player?.position??original?.position??'?';
  const rating=player?.rating??original?.rating??'—';
  return '<div class="match-duelist '+(club==='PSG'?'psg':'om')+'">'+
   '<span class="match-duelist-team">'+html(visualAbbr(club))+' · '+html(role)+'</span>'+
   renderCharacterPortrait(id,'faceoff-portrait')+
   '<strong class="match-duelist-name">'+html(name(id))+'</strong>'+
   '<div class="match-duelist-badges"><span class="match-duelist-position">'+html(slot)+'</span>'+
   '<span class="match-duelist-rating">NOTE '+rating+'</span></div>'+
   (player?.outOfPosition?'<small class="match-duelist-out">Hors poste</small>':'')+
   '</div>';
 };
 return '<div class="match-faceoff" aria-label="'+html(name(left))+' face à '+html(name(right))+'">'+
 playerCard(left,leftLabel,attacker)+
 '<span class="faceoff-vs" aria-hidden="true">VS</span>'+
 playerCard(right,rightLabel,defender)+'</div>';
}
const duelFaceOff=(state,a)=>faceOff(state,a?.roles?.carrier?.cardId,a?.roles?.defender?.cardId,
 'Attaque','Défense',a?.attacker,a?.defender);
const shotFaceOff=state=>{
 const a=state?.match?.action;
 return renderShotFaceOff(state,{shooterId:a?.shooterId,keeperId:a?.keeper?.cardId,
  attacker:a?.attacker,defender:a?.defender});
};

function handover(owner){
 return '<section class="match-handover" aria-label="Transmission confidentielle">'+
 '<div class="match-handover-icon" aria-hidden="true">🔒</div><h2>À toi de jouer, '+owner+'</h2>'+
 '<p>Passe le téléphone au joueur '+owner+'. La décision précédente reste masquée.</p>'+
 button('match-uncover','Je suis '+owner+' · afficher mon choix')+'</section>';
}
function renderAction(state,view,uncovered){
 const a=view.match.action;
 if(isSetPieceKind(a.kind))return renderSetPieceAction(state,a,{uncovered});
 const owner=matchTurnOwner(state);
 if(owner&&!uncovered)return handover(owner);
 if(owner){
  const isShot=a.stage.startsWith('shot-'),role=ACTOR[a.stage];
  return '<section class="panel match-stage"><span class="eyebrow">'+html(stageLabels[a.stage])+'</span>'+
   '<h2>'+a[role]+' · '+(role==='attacker'?'Attaque':'Défense')+'</h2>'+
   '<p class="muted">Ta décision est secrète jusqu’à la confirmation de ton adversaire.</p>'+
   (isShot?shotFaceOff(state):
    fieldNames(a)+renderReceiverCard(state,{
      receiverId:a.roles?.partner?.cardId,club:a.attacker,possible:true
    }))+choiceGrid(BUTTONS[a.stage])+'</section>';
 }
 if(a.stage==='duel-ready')return '<section class="panel match-stage"><h2 class="match-duel-ready-heading">Les deux tactiques sont validées</h2>'+
  duelFaceOff(state,a)+'<p class="muted">Elles vont être révélées simultanément.</p>'+button('match-reveal-duel','Révéler et résoudre le duel')+'</section>';
 if(a.stage==='duel-revealed'){
  const duel=a.duel;
  return '<section class="panel match-stage"><span class="eyebrow">Résultat du duel</span><h2>'+
   html(OUTCOME[duel?.outcome?.outcome]??'Duel résolu')+'</h2>'+
   duelFaceOff(state,a)+'<p>'+html(duel?.calculation?.attack)+' face à '+html(duel?.calculation?.defense)+'</p>'+
   '<p class="caption">Probabilité calculée : '+Number(duel?.calculation?.successConditional??duel?.calculation?.successProbability??0).toFixed(1)+' % (hors faute le cas échéant).</p>'+
   button('match-continue-duel','Continuer')+'</section>';
 }
 if(a.stage==='shot-ready')return '<section class="panel match-stage"><h2 class="match-shot-ready-heading">Le tireur et le gardien ont choisi</h2>'+
  shotFaceOff(state)+'<p>Les deux choix vont être révélés simultanément.</p>'+
  button('match-reveal-shot','Résoudre la frappe')+'</section>';
 if(a.stage==='set-piece-pending')return '<section class="panel match-stage"><h2>Faute sifflée !</h2>'+
  '<p>Cette action continue par un '+html(a.duel?.outcome?.setPiece==='penalty'?'penalty':'coup franc')+' à la même minute.</p>'+
  button('match-begin-setpiece','Continuer avec la phase arrêtée')+'</section>';
 return '<section class="panel match-stage"><h2>Action en préparation</h2></section>';
}
function resultView(m,state){
 const r=m.lastResult;
 // Au sein d'une action officielle, les IDs des finisseurs sont fournis par
 // le moteur (jeu ouvert, corner, coup franc, penalty). Pour un ancien
 // résultat sans détails, ne jamais inventer l'identité d'un tireur.
 if(['goal','save','miss'].includes(r?.outcome)){
  const detail=r.details??{};
  return renderShotResult(state,{
   outcome:r.outcome,attacker:r.attacker,minute:r.minute,score:m.score,
   shooterId:r.scorerId??detail.finisherId??detail.takerId??null,
   keeperId:matchKeeperId(state,r.attacker==='PSG'?'OM':'PSG'),
   context:r.type==='open'?'Tir en jeu ouvert':
    r.type==='corner'?'Corner':r.type==='free-kick'?'Coup franc':'Penalty'
  });
 }
 return '<section class="panel match-stage"><span class="eyebrow">Résultat · '+r.minute+'e</span><h2>'+
  html(OUTCOME[r.outcome]??r.outcome)+'</h2>'+
  '<p class="muted">Le résultat reste affiché jusqu’à validation.</p>'+
  button('match-continue-result','Continuer')+'</section>';
}
/**
 * Bilan officiel de la pause. Toutes les données viennent des 45 minutes
 * réellement jouées. Les listes et le terrain commun restent sous ce bloc,
 * où les modifications de postes/formations sont déjà gérées par le moteur.
 */
function halftimeView(state,m){
 const resume=state.phase==='resume-ready';
 const stats=m.statistics;
 const compare=[
  ['Tirs', 'shots'],['Tirs cadrés','onTarget'],['Arrêts','saves']
 ];
 const rows=compare.map(([label,key])=>'<div class="halftime-stat-row">'+
  '<strong>'+Number(stats.PSG[key])+'</strong>'+
  '<span>'+label+'</span>'+
  '<strong>'+Number(stats.OM[key])+'</strong></div>').join('');
 const statuses=state.teams.map(t=>
  '<div class="halftime-team-status '+(t.ready?'is-ready':'is-pending')+'">'+
  '<span class="halftime-status-symbol" aria-hidden="true">'+(t.ready?'✓':'◷')+'</span>'+
  '<span><strong>'+html(visualAbbr(t.club))+'</strong> : '+
   (t.ready?'✓ composition validée':'composition à valider')+'</span></div>'
 ).join('');
 return '<div class="halftime-screen">'+
  '<header class="halftime-header">'+
   '<span class="eyebrow">Grandline Cup · Pause tactique</span>'+
   '<h2>⏸️ MI-TEMPS</h2><p>Mi-temps · 45e minute</p>'+
  '</header>'+scoreBoard(m)+
  '<section class="panel halftime-stats" aria-label="Bilan de la première période">'+
   '<h3>📊 Bilan de la première période</h3>'+
   '<div class="halftime-stats-heading"><strong>'+html(visualAbbr('PSG'))+'</strong><span>Statistiques officielles</span><strong>'+html(visualAbbr('OM'))+'</strong></div>'+
   '<div class="halftime-stat-rows">'+rows+'</div>'+
  '</section>'+
  '<section class="panel halftime-tactics" aria-label="Ajustements tactiques à la mi-temps">'+
   '<h3>🔄 Ajustements tactiques</h3>'+
   '<p>Change la formation ou repositionne les joueurs sur le terrain ci-dessous, puis valide chaque équipe.</p>'+
   '<div class="halftime-statuses">'+statuses+'</div>'+
   (resume?'<p class="halftime-ready-note">Les deux équipes sont prêtes pour la deuxième période.</p>'+
    button('match-resume','▶️ Reprendre la deuxième mi-temps'):
    '<p class="halftime-ready-note">La reprise sera disponible après validation des deux équipes.</p>')+
  '</section></div>';
}
export function renderMatchScreen(state,{uncovered=false}={}){
 if(state?.phase==='kickoff-ready')return '<section class="panel match-stage">'+
  '<span class="eyebrow">Grandline Cup · Avant-match</span><h2>Les équipes sont prêtes !</h2>'+
  '<p>Sept joueurs de chaque côté. Les compositions se verrouillent au coup d’envoi.</p>'+
  button('match-kickoff','Donner le coup d’envoi')+'</section>';
 const view=matchPublicView(state),m=view.match;
 if(!m)return '<section class="panel match-stage"><h2>Aucun match en cours</h2></section>';
 let out=scoreBoard(m);
 if(state.phase==='half-time'||state.phase==='resume-ready')return halftimeView(state,m);
 if(state.phase==='shootout-ready'||state.phase==='shootout')return out+renderShootoutScreen(state,{uncovered});
 if(state.phase==='finished'){
  if(state.match.shootoutLastResult)return out+renderShootoutScreen(state,{uncovered});
  return renderFinalResult(state);
 }
 if(state.phase==='moment-result'){
  const last=m.lastResult;
  return out+attackBanner(last?.attacker,last?.details?.context,last?.type,last?.minute)+scoreStats(m)+resultView(m,state);
 }
 const moment=m.currentMoment;
 if(!m.action){
  const supported=moment?.type==='open';
  const setPiece=isSetPieceKind(moment?.type);
  out+=attackBanner(moment?.attacker,null,moment?.type,moment?.minute)+
  '<section class="panel match-stage"><span class="eyebrow">'+html(moment?.minute)+'e · '+html(ACTION_LABEL[moment?.type]??'Action')+'</span>'+
   '<h2>'+html(moment?.attacker)+' passe à l’attaque</h2>'+
   (supported?'<p>Annonce des personnages et choix tactiques confidentiels.</p>'+
    button('match-begin-open','Commencer cette action'):
    setPiece?'<p>Choix du tireur et tactiques confidentielles.</p>'+button('match-begin-setpiece','Commencer cette phase arrêtée'):
    '<p>Séquence inconnue : aucune action simulée.</p>')+
   '</section>';
  return out+scoreStats(m);
 }
 out+=attackBanner(m.action.attacker,m.action.context??m.action.originContext,m.action.kind,m.action.minute);
 return out+scoreStats(m)+renderAction(state,view,uncovered);
}
