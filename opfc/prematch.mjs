/** Présentation de l'avant-match, commune au local et aux deux téléphones. */
import {stadiumById} from './stadiums.mjs';
import {lineupDetails} from './rules.mjs';
import {CARD_BY_ID} from './catalog.mjs';
import {renderClubCrest,renderCharacterPortrait} from './ui-portraits.mjs';
import {visualName,visualAbbr,setDisplayedClubs} from './club-identities.mjs';
import {competitionName} from './club-honours.mjs';
const h=s=>String(s??'').replace(/[&<>"']/g,k=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[k]));
const teamBlock=t=>'<div class="opfc-prematch-team"><h3>'+h(visualName(t.club))+'</h3>'+
 lineupDetails(t).filter(Boolean).map(p=>'<div class="opfc-prematch-player">'+
 renderCharacterPortrait(p.cardId,'opfc-prematch-portrait')+
 '<span class="opfc-prematch-player-name">'+h(CARD_BY_ID.get(p.cardId)?.name??p.cardId)+'</span>'+
 '<small>'+h(p.position)+(p.outOfPosition?' ⚠️':'')+'</small><b>'+p.rating+'</b></div>').join('')+'</div>';
export function renderPrematch(state,{canKickoff=true,waitingMessage='Le créateur du salon donne le coup d’envoi.'}={}){
 if(state?.phase!=='kickoff-ready'||state.teams?.length!==2)throw Error('Avant-match indisponible');
 setDisplayedClubs(state.teams);
 const stadium=stadiumById(state.stadiumId);
 return '<section class="panel match-stage opfc-prematch">'+
 '<span class="eyebrow">'+h(competitionName(state.competition))+' · Avant-match</span>'+
 '<h2>'+h(stadium.name)+'</h2>'+
 '<p class="caption">'+stadium.capacity.toLocaleString('fr-FR')+' places</p>'+
 '<img class="opfc-prematch-stadium" src="'+h(stadium.image)+'" alt="Illustration du '+h(stadium.name)+'" decoding="async">'+
 '<div class="opfc-prematch-vs">'+
 '<div class="opfc-prematch-club">'+renderClubCrest('PSG','opfc-prematch-crest')+
 '<span>'+h(visualName('PSG'))+'</span></div><strong>VS</strong>'+
 '<div class="opfc-prematch-club">'+renderClubCrest('OM','opfc-prematch-crest')+
 '<span>'+h(visualName('OM'))+'</span></div></div>'+
 '<div class="v3-prematch-kickoff">'+
 (canKickoff?'<button class="btn primary full" type="button" data-action="match-kickoff">⚽ Donner le coup d’envoi</button>':
 '<p class="caption" role="status">'+h(waitingMessage)+'</p>')+'</div>'+
 '<h3>Compositions officielles</h3>'+
 '<div class="opfc-prematch-rosters">'+state.teams.map(teamBlock).join('')+'</div>'+
 '</section>';
}
