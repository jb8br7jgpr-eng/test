/** OPFC — 10A4 : écrans du jeu EN LIGNE depuis la seule vue publique du serveur.
 * Aucun état maître, calendrier futur, direction secrète ou jeton n'est
 * requis pour construire ces composants. Les mutations sont HTTP côté Edge.
 */
import {CARD_BY_ID} from './catalog.mjs';
import {uiAuction,uiTeam,uiRoster,cardStats,clubName} from './ui-model.mjs';
import {renderCharacterPortrait,renderClubCrest} from './ui-portraits.mjs';
import {matchTacticalChoices,renderShotFaceOff,renderShotResult,renderReceiverCard,matchKeeperId} from './ui-match-widgets.mjs';
import {renderSetPieceAction,isSetPieceKind} from './ui-set-piece.mjs';
import {renderShootoutTracker} from './ui-shootout.mjs';
import {renderFinalResult} from './ui-final.mjs';
import {setDisplayedClubs,visualAbbr} from './club-identities.mjs';

const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const other=c=>c==='PSG'?'OM':'PSG';
const name=id=>CARD_BY_ID.get(id)?.name??id??'—';
const number=n=>String(n*1000000).replace(/\B(?=(\d{3})+(?!\d))/g,' ')+' ฿';
const btn=(type,label,disabled=false,extra='',kind='primary full')=>
 '<button type="button" class="btn '+kind+'" data-action="online-game" data-type="'+esc(type)+'" '+
 extra+(disabled?' disabled aria-disabled="true"':'')+'>'+esc(label)+'</button>';
const waiting=(club,text='')=>'<section class="panel online-turn-wait" role="status">'+
 '<span class="eyebrow">Synchronisation à deux téléphones</span><h2>⏳ Au tour de '+esc(visualAbbr(club))+'</h2>'+
 '<p>'+esc(text||"L'autre téléphone choisit sa prochaine action.")+'</p>'+
 '<p class="caption">Le jeu s’actualise automatiquement.</p></section>';
const stage=(title,inner)=>'<section class="panel match-stage online-match-stage"><h2>'+
 esc(title)+'</h2>'+inner+'</section>';
const showdown=(g,shooter,keeper,club)=>renderShotFaceOff(g,{
 shooterId:shooter,keeperId:keeper,attacker:club,defender:other(club)
});
const choices=(items)=>matchTacticalChoices(items,'online-choice');
const TACTICS=Object.freeze({
 'attack-choice':[['COMBINER','Combiner'],['LANCER','Lancer'],['PERCER','Percer']],
 'defense-choice':[['PRESSER','Presser'],['INTERCEPTER','Intercepter'],['CONTENIR','Contenir']],
 'shot-attack-choice':[['PLACEE','Frappe placée'],['PUISSANTE','Frappe puissante'],['PIQUEE','Ballon piqué']],
 'shot-defense-choice':[['LIGNE','Rester sur la ligne'],['SORTIE','Sortir'],['PLONGEON','Anticiper le plongeon']]
});

function board(m){
 return '<div class="match-scoreboard">'+
 '<div>'+renderClubCrest('PSG','score-crest')+'<small>'+esc(clubName('PSG'))+'</small></div>'+
 '<div class="match-score"><strong>'+m.score.PSG+' – '+m.score.OM+'</strong><span>'+
 m.minute+'e minute</span></div>'+
 '<div>'+renderClubCrest('OM','score-crest')+'<small>'+esc(clubName('OM'))+'</small></div></div>';
}
const playerLine=(club,g)=>g.teams.find(t=>t.club===club);
function visualMarket(g,club){
 const a=g.auction,team=playerLine(club,g),c=CARD_BY_ID.get(a?.cardId);
 if(!a||!c)return stage('Le mercato est terminé','<p>Place aux compositions.</p>');
 const context=uiAuction(g),mine=club===a.turn,enabled=mine&&context.canBid;
 const canPass=mine&&context.canPass;
 const amount=context.minimum,budget=team?.budget??0;
 const meta=cardStats(c).map(stat=>
  '<div class="stat opfc-stat"><span>'+stat.label+'</span><strong class="opfc-stat-value">'+
  stat.value+'</strong></div>').join('');
 let html='<div class="opfc-auction-stage online-market"><div class="auction-top"><span class="eyebrow">'+
  '⚓ MERCATO EN LIGNE</span><span class="turn-pill">'+esc(visualAbbr(a.turn))+' à l’enchère</span></div>'+
  '<div class="player-card opfc-player-card rarity-'+esc(c.rarity)+'">'+
  '<div class="portrait-shell portrait-shell-photo">'+renderCharacterPortrait(c.id,'portrait-card')+'</div>'+
  '<div class="player-identity"><h2 class="player-name">'+esc(c.name)+'</h2>'+
  '<div class="player-meta">'+esc(c.group)+'</div></div>'+
  '<div class="player-rating-row"><span class="player-position position-purple">'+c.position+'</span>'+
  '<div class="player-rating"><span>NOTE GLOBALE</span><strong class="rating-value">'+c.rating+
  '</strong></div><span class="player-tier tier-'+c.rarity.toLowerCase()+'">'+c.rarity+'</span></div>'+
  '<div class="stats-grid">'+meta+'</div></div>'+
  '<section class="opfc-auction card auction"><div class="bid-title"><div><span class="kicker">Meilleure offre</span>'+
  '<strong class="bid-amount">'+(a.highestBid?number(a.highestBid):'Aucune')+'</strong></div>'+
  '<div class="bid-leader">'+(a.highestClub?'En tête : '+esc(visualAbbr(a.highestClub)):
   'Mise de départ : '+number(amount))+'</div></div>'+
  '<div class="turn-banner"><div><span>AU TOUR DE</span><strong>'+esc(visualAbbr(a.turn))+'</strong></div>'+
  '<div class="turn-budget">'+number(budget)+'<br><span>ton budget</span></div></div>';
 if(mine)html+=(a.solo?
  '<div class="solo-auction"><p>Recrutement solo · prix fixe '+number(5)+'</p>'+
  btn('solo','Recruter pour '+number(5),false,'','primary full')+
  btn('pass',context.canPass?'Refuser ce personnage · '+(5-team.refusals)+'/5 restants':
   'Refus épuisés · recrutement obligatoire',!context.canPass,'','ghost full')+
  '<p class="caption">Refus utilisés : '+team.refusals+'/5 · le refus passe au personnage suivant.</p></div>':
  '<div class="offers">'+[0,1,5,10].map(step=>{
   const value=amount+step;
   return '<button type="button" class="offer-btn" data-action="online-bid" data-amount="'+value+'"'+
    (enabled&&value<=context.maximum?'':' disabled')+'><b>'+number(value)+'</b><small>'+
    (step?'+'+step+' palier(s)':'Offre minimale')+'</small></button>';
  }).join('')+'</div>'+
  '<div class="custom-bid"><label for="online-bid-value">Autre montant (฿)</label>'+
  '<div><input id="online-bid-value" type="text" inputmode="numeric" value="'+(amount*1000000)+
  '" '+(enabled?'':'disabled')+'><button type="button" class="btn-ghost" data-action="online-bid-custom"'+
  (enabled?'':' disabled')+'>Enchérir</button></div></div>'+
  '<button type="button" class="pass-btn" data-action="online-game" data-type="pass"'+
  (canPass?'':' disabled')+'>'+esc(a.highestBid>0?
   (context.everOffered?'Arrêter d’enchérir (gratuit)':'Passer gratuitement · enchère adverse'):
   'Refuser ce personnage · '+Math.max(0,5-(team?.refusals??0))+'/5 restants')+'</button>'+
  '<div class="auction-hakis">'+
  '<button type="button" class="haki-btn" data-action="online-game" data-type="kings"'+
  (context.canKings?'':' disabled')+'>👑 Haki des Rois</button>'+
  '<button type="button" class="extra-power" data-action="online-game" data-type="observation"'+
  (!team.hakis.observation?'':' disabled')+'>👁 Observation</button></div>');
 else html+='<p class="online-wait-inline">⏳ '+esc(visualAbbr(other(club)))+' décide de sa prochaine enchère.</p>'+
  (!team.hakis.observation?btn('observation','👁 Utiliser ton Observation',false,'','ghost full'):'');
 html+='</section>';
 if(g.myObservation?.length)html+='<section class="panel online-observation"><strong>👁 Tes cinq révélations</strong>'+
  '<div class="online-observation-row">'+g.myObservation.map(id=>
   '<div>'+renderCharacterPortrait(id,'kick-portrait')+'<span>'+esc(name(id))+'</span></div>').join('')+
  '</div></section>';
 return html+'</div>';
}
function matchStage(g,club,hostClub){
 const m=g.match,a=m?.action;
 if(g.phase==='finished'){
  // Le dernier tir est révélé avant le bilan final, même si le moteur
  // a déjà marqué la rencontre comme terminée.
  if(g.match?.shootout?.lastResult)return board(m)+shootoutStage(g,club);
  return renderFinalResult(g);
 }
 if(g.phase==='half-time'||g.phase==='resume-ready'){
  const status=g.teams.map(t=>'<span class="halftime-team-status '+(t.ready?'is-ready':'is-pending')+'">'+
   (t.ready?'✓':'◷')+' '+esc(visualAbbr(t.club))+' : '+(t.ready?'prêt':'en préparation')+'</span>').join('');
  const stats=['shots','onTarget','saves'].map((k,i)=>'<div class="halftime-stat-row">'+
   '<strong>'+m.statistics.PSG[k]+'</strong><span>'+['Tirs','Tirs cadrés','Arrêts'][i]+
   '</span><strong>'+m.statistics.OM[k]+'</strong></div>').join('');
  return '<div class="halftime-screen"><header class="halftime-header"><h2>⏸️ MI-TEMPS</h2>'+
   '<p>Pause tactique · 45e minute</p></header>'+board(m)+
   '<section class="panel halftime-stats"><h3>📊 Première période</h3><div class="halftime-stat-rows">'+
   stats+'</div></section><section class="panel halftime-tactics"><h3>🔄 Ajustements tactiques</h3>'+
   '<div class="halftime-statuses">'+status+'</div>'+
   (g.phase==='resume-ready'?(club===hostClub?
    btn('resume','▶️ Reprendre la deuxième mi-temps'):waiting(hostClub,'Le club hôte lance la deuxième période.')):
    '<p>Sur le terrain ci-dessous, place et valide uniquement les joueurs de ton club.</p>')+
   '</section></div>';
 }
 if(g.phase==='shootout-ready')
  return board(m)+(club===hostClub?
   stage('Égalité après 90 minutes','<p>Un lancer de pièce déterminera le premier tireur.</p>'+
    btn('begin-shootout','🪙 Lancer la pièce et commencer')):
   waiting(hostClub,'Le club hôte lance le départage aux tirs au but.'));
 if(g.phase==='shootout')return board(m)+shootoutStage(g,club);
 if(g.phase==='moment-result'){
  const result=m.lastResult;
  if(!result)return board(m)+stage('Résultat à venir','');
  const allowed=club===result.attacker;
  const detail=result.details??{};
  const content=['goal','save','miss','stopped'].includes(result.outcome)?
   renderShotResult(g,{outcome:result.outcome,attacker:result.attacker,
    minute:result.minute,score:m.score,
    shooterId:result.scorerId??detail.finisherId??detail.takerId??null,
    keeperId:matchKeeperId(g,other(result.attacker)),
    defenderId:detail.defenderId??detail.roles?.defender?.cardId??null,
    context:detail.kind==='free-kick'?'Coup franc':detail.kind==='corner'?'Corner':
     detail.kind==='penalty'?'Penalty':
     result.type==='open'?'Jeu ouvert':result.type==='free-kick'?'Coup franc':
     result.type==='corner'?'Corner':'Penalty',action:'online-game'})
    .replace('data-action="online-game"',
     'data-action="online-game" data-type="continue-result"'+
     (allowed?'':' disabled aria-disabled="true"'))
   :stage('Séquence terminée','<p>'+esc(result.outcome)+'</p>');
  return board(m)+content+(allowed?
   (['goal','save','miss','stopped'].includes(result.outcome)?'':btn('continue-result','Continuer')):
   waiting(result.attacker,'Le club attaquant valide la séquence.'));
 }
 if(g.phase!=='match')return stage('Partie en cours','');
 if(!a){
  const moment=m.currentMoment;
  if(!moment)return board(m)+stage('Synchronisation','<p>En attente de la prochaine action.</p>');
  const type=moment.type==='open'?'begin-open':'begin-setpiece';
  const label=moment.type==='open'?'Commencer cette action':'Commencer cette phase arrêtée';
  return board(m)+(club===moment.attacker?stage('⚽ '+visualAbbr(moment.attacker)+' passe à l’attaque',
   '<p>'+esc(moment.type==='open'?'Jeu ouvert':moment.type)+'</p>'+btn(type,label)):
   waiting(moment.attacker,'L’adversaire prépare sa séquence.'));
 }
 if(isSetPieceKind(a.kind)){
  const owner=a.stage==='defense-choice'?a.defender:a.attacker;
  if(club!==owner)return board(m)+waiting(owner,'Une phase arrêtée est en cours.');
  let rendered=renderSetPieceAction(g,a,{uncovered:true});
  const map={'match-taker':'select-taker','match-choose':'choose',
   'match-reveal-setpiece-duel':'reveal-setpiece-duel',
   'match-continue-setpiece-duel':'continue-setpiece-duel',
   'match-finish-corner':'finish-corner','match-reveal-penalty':'reveal-penalty'};
  rendered=rendered.replace(/data-action="(match-[a-z-]+)"/g,(_,key)=>
   'data-action="online-game" data-type="'+map[key]+'"');
  return board(m)+rendered;
 }
 if(a.kind!=='open')return board(m)+stage('Action inconnue','');
 const actors={'attack-choice':a.attacker,'defense-choice':a.defender,
  'shot-attack-choice':a.attacker,'shot-defense-choice':a.defender,
  'duel-ready':a.attacker,'duel-revealed':a.attacker,'shot-ready':a.attacker,
  'set-piece-pending':a.attacker};
 const owner=actors[a.stage];
 if(owner!==club)return board(m)+waiting(owner,'La décision tactique reste secrète sur ton téléphone.');
 let panel;
 if(TACTICS[a.stage]){
  const shot=a.stage.startsWith('shot-');
  const label={ 'attack-choice':'Choisis ta construction',
   'defense-choice':'Réponse défensive','shot-attack-choice':'Choisis ta frappe',
   'shot-defense-choice':'Réaction du gardien'}[a.stage];
  const player=shot?showdown(g,a.shooterId,
    matchKeeperId(g,a.defender),a.attacker):
   renderReceiverCard(g,{receiverId:a.roles?.partner?.cardId,club:a.attacker,possible:true});
  panel=stage(label,'<p>Ton choix restera caché jusqu’à la révélation.</p>'+
   player+choices(TACTICS[a.stage]));
 }else if(a.stage==='duel-ready')
  panel=stage('Les deux tactiques sont verrouillées',btn('reveal-duel','Révéler et résoudre le duel'));
 else if(a.stage==='duel-revealed'){
  const outcome=a.duel?.outcome?.outcome;
  const context=a.context==='FRANCHE'?'OCCASION FRANCHE':
   a.context==='BONNE'?'BONNE OCCASION':'ACTION DIFFICILE';
  panel=renderShotResult(g,{
   outcome,attacker:a.attacker,minute:a.minute,score:m.score,
   shooterId:outcome==='foul'?a.roles?.carrier?.cardId:
    (a.shooterId??a.roles?.carrier?.cardId),
   defenderId:a.roles?.defender?.cardId,
   context:'Résultat du duel · '+context,
   detailExtra:outcome==='chance'?'Le tireur va maintenant préparer sa frappe.':
    outcome==='stopped'?'La défense récupère le ballon. Prochaine action après Continuer.':
    'Place au coup franc ou au penalty.',
   action:'online-game',
   continueLabel:outcome==='chance'?'Passer au tir':
    outcome==='foul'?'Jouer la phase arrêtée':'Continuer'
  }).replace('data-action="online-game"',
   'data-action="online-game" data-type="continue-duel"');
 }
 else if(a.stage==='shot-ready')
  panel=stage('Tireur face au gardien',showdown(g,a.shooterId,matchKeeperId(g,a.defender),
   a.attacker)+btn('reveal-shot','Résoudre la frappe'));
 else if(a.stage==='set-piece-pending')
  panel=stage('Faute sifflée',btn('begin-setpiece','Continuer avec la phase arrêtée'));
 else panel=stage('Action en cours','<p>La séquence se poursuit.</p>');
 return board(m)+panel;
}
function shootoutStage(g,club){
 const s=g.match.shootout;
 if(!s)return stage('Départage en préparation','');
 const attempts={PSG:s.timeline.filter(t=>t.club==='PSG'),OM:s.timeline.filter(t=>t.club==='OM')};
 const tracker=renderShootoutTracker({...s,attempts});
 const history='<section class="panel shootout-log"><h3 class="section-title">Historique des tentatives</h3>'+
  (s.timeline.length?s.timeline.map(t=>
   '<div class="shootout-attempt"><span class="shootout-attempt-club">'+esc(visualAbbr(t.club))+'</span>'+
   '<span class="shootout-kick-player">'+renderCharacterPortrait(t.shooterId,'kick-portrait')+
   esc(name(t.shooterId))+'</span><strong class="'+(t.scored?'kick-goal':'kick-fail')+'">'+
   (t.scored?'✓ But':t.result==='save'?'✕ Arrêt':'✕ Raté')+'</strong></div>').join(''):
   '<p class="caption">Aucune tentative pour le moment.</p>')+'</section>';
 if(s.lastResult){
  const last=s.lastResult,keeper=last.keeperId;
  const result=renderShotResult(g,{outcome:last.scored?'goal':last.result==='save'?'save':'miss',
   attacker:last.club,shooterId:last.shooterId,keeperId:keeper,
   score:s.score,context:'Séance de tirs au but',action:'online-game',
   continueLabel:s.phase==='finished'?'Voir le résultat final':'Continuer'});
  return tracker+result.replace('data-action="online-game"',
   'data-action="online-game" data-type="shootout-continue" '+
   (club!==last.club?'disabled aria-disabled="true"':''))+history;
 }
 if(g.phase==='finished')return tracker+history;
 const p=s.active;
 if(!p)return tracker+waiting(s.nextClub??'—');
 const shooterTurn=!s.confirmed.shooter,keeperTurn=s.confirmed.shooter&&!s.confirmed.keeper;
 const owner=shooterTurn?p.club:keeperTurn?other(p.club):p.club;
 if(owner!==club)return tracker+waiting(owner,'Le tir et le plongeon sont confidentiels.');
 const pair=showdown(g,p.shooterId,p.keeperId,p.club);
 const data=shooterTurn||keeperTurn?stage(shooterTurn?'Choisis ta frappe':'Réaction du gardien',
  pair+'<p>Choisis ta direction secrètement.</p>'+choices([
   ['GAUCHE','Gauche'],['CENTRE','Centre'],['DROITE','Droite']]).replaceAll(
     'data-action="online-choice"','data-action="online-choice" data-shootout="true"')):
  stage('Les deux directions sont verrouillées',pair+btn('shootout-reveal','Révéler et tirer'));
 return tracker+data+history;
}
export function renderOnlineGame(g,{myClub,hostClub}={}){
 if(g?.teams)setDisplayedClubs(g.teams);
 if(!g||!['PSG','OM'].includes(myClub)||!['PSG','OM'].includes(hostClub))
  return '<section class="panel"><p>Synchronisation en cours…</p></section>';
 const top='<section class="online-game-heading"><span class="eyebrow">Grandline Cup · Mode en ligne</span>'+
  '<span class="online-game-club">'+renderClubCrest(myClub,'online-heading-crest')+
  '<strong>'+esc(clubName(myClub))+' · '+esc(visualAbbr(myClub))+'</strong></span></section>';
 if(g.phase==='mercato')return top+visualMarket(g,myClub);
 if(g.phase==='lineup')return top+stage('Prépare ta composition',
  '<p>Choisis tes sept titulaires et leur formation sur le terrain ci-dessous.</p>');
 if(g.phase==='kickoff-ready')return top+(myClub===hostClub?
  stage('Les équipes sont prêtes !',btn('kickoff','⚽ Donner le coup d’envoi')):
  waiting(hostClub,'Le club hôte lance le match.'));
 return top+matchStage(g,myClub,hostClub);
}
