/** OPFC — même parcours de match en local et sur deux iPhone.
 * Seuls l'attribution des commandes au club authentifié et les écrans
 * d'attente réseau diffèrent : aucun moteur ni calcul d'action côté client.
 * Le mercato et les compositions réutilisent les composants locaux de ui.mjs.
 */
import {renderOnlineMatchScreen} from './ui-match.mjs?v=opfc-arrow-premium-20261027';
import {renderOnlineShootoutScreen} from './ui-shootout.mjs?v=opfc-immersive-score-20261026';
import {renderFinalResult} from './ui-final.mjs?v=opfc-momentum-20261027';
import {renderClubCrest} from './ui-portraits.mjs?v=opfc-75-roster-20261022';
import {visualAbbr,setDisplayedClubs} from './club-identities.mjs';
import {competitionName} from './club-honours.mjs?v=opfc-trophees-20261022';
import {renderMatchMomentum} from './v4-momentum.mjs?v=opfc-momentum-20261027';

const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function scoreBoard(m,momentumOpen=false){
 return '<div class="match-scoreboard"><div>'+
  renderClubCrest('PSG','score-crest')+'<small>'+esc(visualAbbr('PSG'))+'</small></div>'+
  '<div class="match-score"><strong>'+m.score.PSG+' – '+m.score.OM+'</strong>'+
  '<span>'+m.minute+'e minute</span></div><div>'+
  renderClubCrest('OM','score-crest')+'<small>'+esc(visualAbbr('OM'))+'</small></div></div>'+
  renderMatchMomentum(m,{open:momentumOpen,clubA:visualAbbr('PSG'),clubB:visualAbbr('OM')});
}
/**
 * Les écrans de gameplay sont produits par les mêmes fonctions visuelles
 * que le local ; chaque commande est exécutée par la fonction Edge.
 */
function renderRematchChoices(g,myClub){
 const rematch=g.match?.rematch??{},votes=rematch.votes??{PSG:false,OM:false};
 const other=myClub==='PSG'?'OM':'PSG';
 const mine=!!votes[myClub],theirs=!!votes[other];
 const label=theirs?'Accepter la revanche':'Proposer une revanche';
 return '<section class="panel opfc-rematch-choice" aria-label="Revanche officielle">'+
  '<h3>🔄 REVANCHE</h3><p>Mêmes clubs, personnages, compositions de fin de match, stade et compétition.</p>'+
  (rematch.rejectedBy?'<p class="caption">Demande de revanche précédente refusée.</p>':'')+
  (mine?'<p class="opfc-rematch-await">✓ '+esc(visualAbbr(myClub))+' prêt · En attente de '+esc(visualAbbr(other))+'</p>':
   '<button class="btn primary full" data-action="online-game" data-type="rematch-accept">'+label+'</button>')+
  (theirs&&!mine?'<button class="btn ghost full" data-action="online-game" data-type="rematch-decline">Refuser la revanche</button>':'')+
  '<p class="caption">Chaque rencontre est enregistrée séparément dans les statistiques officielles.</p>'+
  '</section>';
}
export function renderOnlineGame(g,{myClub,hostClub,competition,momentumOpen=false}={}){
 if(g?.teams)setDisplayedClubs(g.teams);
 if(!g||!['PSG','OM'].includes(myClub)||!['PSG','OM'].includes(hostClub))
  return '<section class="panel"><p>Synchronisation en cours…</p></section>';
 if(g.phase==='mercato')return ''; // sale() + terrain communs, via ui.mjs.
 if(g.phase==='lineup')
  return '<section class="panel match-stage"><span class="eyebrow">'+esc(competitionName(g.match?.competition??competition))+' · Compositions</span>'+ 
   '<h2>Prépare ton équipe</h2><p>Choisis la formation et la place de tes sept recrues sur le terrain ci-dessous. '+
   'Tu contrôles uniquement ton club.</p></section>';
 if(['kickoff-ready','match','moment-result','half-time','resume-ready'].includes(g.phase))
  return renderOnlineMatchScreen(g,{myClub,hostClub,competition,momentumOpen});
 if(g.phase==='shootout-ready'||g.phase==='shootout')
  return scoreBoard(g.match,momentumOpen)+renderOnlineShootoutScreen(g,{myClub,hostClub});
 if(g.phase==='finished'){
  if(g.match?.shootout?.lastResult)
   return scoreBoard(g.match,momentumOpen)+renderOnlineShootoutScreen(g,{myClub,hostClub});
  return renderFinalResult(g,{momentumOpen})+renderRematchChoices(g,myClub);
 }
 return '<section class="panel"><p>Préparation de la prochaine étape…</p></section>';
}
