/** Catalogue OPFC : personnages et clubs. Affichage en lecture seule, sans incidence sur le jeu. */
import {CARDS,CARD_BY_ID} from './catalog.mjs?v=opfc-75-roster-20261022';
import {portraitFile} from './ui-portraits.mjs?v=opfc-75-roster-20261022';
import {DISPLAY_CLUBS,displayAbbr,clubLogoFile} from './club-identities.mjs';
import {CLUB_HONOURS,CLUB_TROPHIES} from './club-honours.mjs?v=opfc-trophees-20261022';
import {loadTrophyHistory,syncQueuedLocalResults} from './trophy-service.mjs?v=opfc-v2-20261023';
import {loadPlayerTotals} from './player-totals-service.mjs';
import {loadV3ClubStats,loadV3PlayerPoints,loadV3Milestones} from './v3-data-service.mjs';
import {renderV3ClubStats} from './v3-club-view.mjs';
import {renderV3Hall} from './v3-hall-view.mjs';
import {sortCatalogCharacters,sortCatalogClubs,characterStatSortAvailable} from './catalog-sorting.mjs';

const root=document.getElementById('catalog-grid');
const search=document.getElementById('catalog-search');
const position=document.getElementById('catalog-position');
const rarity=document.getElementById('catalog-rarity');
const count=document.getElementById('catalog-count');
const empty=document.getElementById('catalog-empty');
const characterSort=document.getElementById('catalog-sort');
const scorerStatus=document.getElementById('catalog-scorers-status');
let scorerTotals=null,careerComplete=false,v3ClubTotals=null,v3PlayerPoints=null,v3Milestones=null;
let careerSyncMessage='Synchronisation des statistiques…';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const compact=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const post={GAR:'Gardien',DEF:'Défenseur',MIL:'Milieu',ATT:'Attaquant'};
const rarityName={DIA:'Diamant',OR:'Or',ARG:'Argent',BRZ:'Bronze'};
const stats={PUI:'PUI',TEC:'TEC',PAS:'PAS',VIT:'VIT',DEF:'DEF',GAR:'GAR'};
const careerValue=(id,key)=>{
 if(scorerTotals===null||(!careerComplete&&key!=='goals'))return '—';
 const value=scorerTotals.get(id);
 return value?.[key]===null?'—':value?.[key]??0;
};
function sortedCharacters(){
 return sortCatalogCharacters(CARDS,characterSort.value,
  {totals:scorerTotals,complete:careerComplete});
}

function cardHtml(c){
 const portrait=portraitFile(c.id);
 const letters=c.name.split(/[\s.-]+/).filter(Boolean).slice(0,2).map(x=>x.charAt(0)).join('');
 const picture=portrait?
  '<img loading="lazy" decoding="async" src="'+esc(portrait)+'" alt="Portrait de '+esc(c.name)+'">':
  esc(letters);
 const statBlocks=Object.entries(stats).map(([key,label])=>
  '<div class="catalog-stat"><span>'+label+'</span><strong>'+esc(c.stats[key])+'</strong></div>'
 ).join('');
 // Le même compteur anchors qu'avant, simplement déplacé dans l'espace
 // disponible à droite du portrait et des informations de carrière.
 const anchors=careerValue(c.id,'anchors');
 const anchorAward='<div class="catalog-anchor-award" aria-label="Ancres d’Or de '+esc(c.name)+' : '+esc(anchors)+'">'+
  '<img class="catalog-anchor-art" src="./opfc/illustrations/ancre-or.webp" alt="" loading="lazy" decoding="async">'+
  '<strong class="catalog-anchor-value">'+esc(anchors)+'</strong>'+
  '<small class="catalog-anchor-label">ANCRES D’OR</small></div>';
 const career=[['MATCHS','matches'],['BUTS','goals'],['PASSES DÉCISIVES','assists']]
  .map(([label,key])=>'<div class="catalog-career-cell"><strong>'+esc(careerValue(c.id,key))+
    '</strong><small>'+label+'</small></div>').join('');
 return '<article class="discovery-panel catalog-card" data-search="'+esc(compact(c.name+' '+c.group))+
  '" data-position="'+esc(c.position)+'" data-rarity="'+esc(c.rarity)+'">'+
  '<div class="catalog-card-top"><div class="catalog-portrait">'+picture+'</div>'+
  '<div class="catalog-card-info">'+anchorAward+
  '<h2 class="catalog-card-name">'+esc(c.name)+'</h2>'+
  '<div class="catalog-metrics"><div class="catalog-rating">'+esc(c.rating)+'<small>NOTE</small></div></div>'+
  '<div class="catalog-tags"><span class="catalog-tag">'+esc(post[c.position])+'</span>'+
  '<span class="catalog-tag rarity-'+esc(c.rarity)+'">'+esc(rarityName[c.rarity])+'</span></div>'+
  '<p class="catalog-group">'+esc(c.group)+'</p></div></div>'+
  '<div class="catalog-stats" aria-label="Six statistiques de '+esc(c.name)+'">'+statBlocks+'</div>'+
  '<div class="catalog-career" aria-label="Statistiques de carrière de '+esc(c.name)+'">'+career+
  '</div></article>';
}

let elements=[];
function paintCharacters(){
 root.innerHTML=sortedCharacters().map(cardHtml).join('');
 elements=[...root.querySelectorAll('.catalog-card')];
 update();
}
function update(){
 const q=compact(search.value),pos=position.value,rar=rarity.value;
 let visible=0;
 for(const el of elements){
  const ok=(!q||el.dataset.search.includes(q))&&(!pos||el.dataset.position===pos)&&(!rar||el.dataset.rarity===rar);
  el.hidden=!ok;
  if(ok)visible++;
 }
 count.innerHTML='<strong>'+visible+'</strong> personnage'+(visible===1?'':'s')+' sur '+CARDS.length;
 empty.hidden=visible!==0;
}
search.addEventListener('input',update);
position.addEventListener('change',update);
rarity.addEventListener('change',update);
function displayCareerSyncStatus(){
 const mode=characterSort.value;
 const metric=['matches','goals','assists','anchors'].includes(mode);
 if(metric&&!characterStatSortAvailable(mode,scorerTotals,careerComplete)){
  scorerStatus.textContent=scorerTotals===null?'⏳ Synchronisation des statistiques en cours…':
   '⚠️ Ce classement attend la synchronisation des statistiques V2 : affichage temporaire par note.';
  return;
 }
 scorerStatus.textContent=careerSyncMessage;
}
characterSort.addEventListener('change',()=>{paintCharacters();displayCareerSyncStatus();});
paintCharacters();
async function refreshScorers(){
 try{
  const {totals,complete}=await loadPlayerTotals();
  const changed=!scorerTotals||careerComplete!==complete||
   JSON.stringify([...scorerTotals])!==JSON.stringify([...totals]);
  scorerTotals=totals;careerComplete=complete;
  careerSyncMessage=complete?
   '✅ Carrières synchronisées : matchs, buts, passes décisives et Ancres d’Or.':
   '⚠️ Nouvelles statistiques en attente du serveur ; buts historiques conservés.';
  displayCareerSyncStatus();
  if(changed)paintCharacters();
   refreshHall();
 }catch{
  careerSyncMessage='⚠️ Statistiques momentanément indisponibles ou non actualisées.';
  displayCareerSyncStatus();
 }
}


/* Section clubs : mêmes identités et mêmes logos que dans les menus du jeu. */
const clubRoot=document.getElementById('club-grid');
const clubSearch=document.getElementById('club-search');
const clubSort=document.getElementById('club-sort');
const clubCount=document.getElementById('club-count');
const clubEmpty=document.getElementById('club-empty');
const clubStatus=document.getElementById('club-sync-status');
let liveHonours=null;

function sortedClubs(){
 return sortCatalogClubs(DISPLAY_CLUBS,clubSort.value,liveHonours,CLUB_TROPHIES);
}
function clubHtml(club,rank){
 const honours=liveHonours?.[club.id]??CLUB_HONOURS[club.id];
 const logo=clubLogoFile(club.id);
 const abbr=displayAbbr(club.id);
 if(!honours||!logo)throw new Error('Fiche de club incomplète : '+club.id);
 const trophies=CLUB_TROPHIES.map(t=>
  '<li class="club-catalog-award" aria-label="'+esc(t.name)+' : '+esc(honours[t.key])+' titre(s)">'+
  '<span class="club-catalog-award-name'+(t.key==='grandline'?' club-catalog-award-name-split':'')+'">'+
  (t.key==='grandline'?'<span>Grandline</span><span>Champions Cup</span>':esc(t.name))+'</span>'+
  '<img class="club-catalog-award-image" src="'+esc(t.image)+'" alt="Trophée de '+esc(t.name)+'" loading="lazy" decoding="async">'+
  '<strong class="club-catalog-award-value">'+esc(honours[t.key])+'</strong>'+
  '</li>').join('');
 const total=CLUB_TROPHIES.reduce((sum,t)=>sum+honours[t.key],0);
 return '<article class="discovery-panel club-catalog-card" data-search="'+esc(compact(club.name+' '+abbr))+'" style="--club-color:'+esc(club.secondary)+'">'+
  '<div class="club-catalog-banner"><span class="club-catalog-rank" aria-label="Position '+rank+'">#'+rank+'</span><img src="'+esc(logo)+'" alt="Écusson de '+esc(club.name)+'" loading="lazy" decoding="async"></div>'+
  '<div class="club-catalog-identity"><h2 class="club-catalog-name">'+esc(club.name)+'</h2>'+
  '<div class="club-catalog-identifier"><strong>'+esc(abbr)+'</strong><span>CLUB OPFC</span></div></div>'+
  '<div class="club-catalog-honours"><div class="club-catalog-honours-head"><h3>Palmarès officiel</h3>'+
  '<span class="club-catalog-total"><strong>'+esc(total)+'</strong><span>titre'+(total===1?'':'s')+'</span></span></div>'+
  '<ul class="club-catalog-awards">'+trophies+'</ul></div>'+renderV3ClubStats(v3ClubTotals?(v3ClubTotals.get(club.id)??{matches:0,wins:0,losses:0,goalsFor:0,goalsAgainst:0}):null)+'</article>';
}

function paintClubs(){
 clubRoot.innerHTML=sortedClubs().map((club,i)=>clubHtml(club,i+1)).join('');
 clubElements=[...clubRoot.querySelectorAll('.club-catalog-card')];
 updateClubs();
}
clubRoot.innerHTML=sortedClubs().map((club,i)=>clubHtml(club,i+1)).join('');
let clubElements=[...clubRoot.querySelectorAll('.club-catalog-card')];
function updateClubs(){
 const q=compact(clubSearch.value);
 let visible=0;
 for(const item of clubElements){
  const show=!q||item.dataset.search.includes(q);
  item.hidden=!show;
  if(show)visible++;
 }
 clubCount.innerHTML='<strong>'+visible+'</strong> club'+(visible===1?'':'s')+' sur '+DISPLAY_CLUBS.length;
 clubEmpty.hidden=visible!==0;
}
clubSearch.addEventListener('input',updateClubs);
clubSort.addEventListener('change',paintClubs);
updateClubs();

/* Trois onglets accessibles, liens directs #clubs et #finales. */
const characterPanel=document.getElementById('catalog-characters');
const clubPanel=document.getElementById('catalog-clubs');
const finalPanel=document.getElementById('catalog-finals');
const hallPanel=document.getElementById('catalog-hall');
const hallTab=document.getElementById('catalog-tab-hall');
const hallContent=document.getElementById('v3-hall-content');
const characterTab=document.getElementById('catalog-tab-characters');
const clubTab=document.getElementById('catalog-tab-clubs');
const finalTab=document.getElementById('catalog-tab-finals');
const panels={characters:characterPanel,clubs:clubPanel,finals:finalPanel,hall:hallPanel};
const tabs={characters:characterTab,clubs:clubTab,finals:finalTab,hall:hallTab};
const hashes={characters:'#personnages',clubs:'#clubs',finals:'#finales',hall:'#hall-of-fame'};
characterTab.querySelector('.catalog-tab-count').textContent=CARDS.length;
clubTab.querySelector('.catalog-tab-count').textContent=DISPLAY_CLUBS.length;
function selectCatalogTab(tab){
 const chosen=Object.hasOwn(panels,tab)?tab:'characters';
 for(const [id,panel] of Object.entries(panels))panel.hidden=id!==chosen;
 for(const [id,button] of Object.entries(tabs)){
  const active=id===chosen;
  button.classList.toggle('is-active',active);
  button.setAttribute('aria-selected',String(active));
  button.tabIndex=active?0:-1;
 }
}
function syncCatalogTab(){
 const hash=window.location.hash;
 selectCatalogTab(hash==='#clubs'?'clubs':hash==='#finales'?'finals':hash==='#hall-of-fame'?'hall':'characters');
}
for(const [id,button] of Object.entries(tabs)){
 button.addEventListener('click',()=>{selectCatalogTab(id);window.location.hash=hashes[id];});
 button.addEventListener('keydown',event=>{
  const order=['characters','clubs','finals','hall'];
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();
  const i=order.indexOf(id);
  const next=event.key==='Home'?0:event.key==='End'?order.length-1:
    (i+(event.key==='ArrowLeft'?-1:1)+order.length)%order.length;
  tabs[order[next]].click();tabs[order[next]].focus();
 });
}
window.addEventListener('hashchange',syncCatalogTab);
syncCatalogTab();

const clubById=new Map(DISPLAY_CLUBS.map(club=>[club.id,club]));
const compById=new Map(CLUB_TROPHIES.map(c=>[c.key,c]));
const formatDate=value=>{
 try{return new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));}
 catch{return 'Date inconnue';}
};

/* Les 100 finales officielles les plus récentes, fournies par l'API OPFC existante. */
const historyRoot=document.getElementById('opfc-results-history');
const finalsSearch=document.getElementById('finals-search');
const finalsCompetition=document.getElementById('finals-competition');
const finalsMode=document.getElementById('finals-mode');
const finalsCount=document.getElementById('finals-count');
const finalsStatus=document.getElementById('finals-sync-status');
const finalsPrevious=document.getElementById('finals-prev');
const finalsNext=document.getElementById('finals-next');
const finalsPageLabel=document.getElementById('finals-page-label');
const PAGE_SIZE=20;
let historyItems=[],historyPage=0,historySignature='';

function renderGoals(goals,slot){
 const own=goals.filter(g=>g.club===slot);
 if(!own.length)return '<p class="caption">Aucun but inscrit</p>';
 return own.map(g=>'<div class="finals-goal">⚽ '+esc(CARD_BY_ID.get(g.cardId)?.name??g.cardId)+
  ' <span>'+esc(g.minute)+'e</span></div>').join('');
}
function renderHistoryCard(g){
 const home=clubById.get(g.home_club),away=clubById.get(g.away_club);
 const comp=compById.get(g.competition);
 if(!home||!away||!comp)return '';
 const logo=id=>'<img src="'+esc(clubLogoFile(id))+'" alt="" width="52" height="52" loading="lazy" decoding="async">';
 const winner=clubById.get(g.winner);
 const tab=g.shootout?' · TAB '+esc(g.shootout.home)+' – '+esc(g.shootout.away):'';
 const goals=Array.isArray(g.goals)?g.goals:[];
 return '<article class="opfc-history-match">'+
  '<div class="opfc-history-meta"><span>'+esc(comp.icon)+' '+esc(comp.name)+'</span>'+
  '<span>'+esc(formatDate(g.played_at))+'</span></div>'+
  '<div class="opfc-history-mode">'+(g.mode==='online'?'🌐 En ligne':'🏠 Local')+'</div>'+
  '<div class="opfc-history-teams">'+
  '<span>'+logo(home.id)+'<strong>'+esc(displayAbbr(home.id))+'</strong><small>'+esc(home.name)+'</small></span>'+
  '<div class="opfc-history-score"><strong>'+esc(g.home_score)+' – '+esc(g.away_score)+'</strong>'+
  '<small>Score final'+tab+'</small></div>'+
  '<span>'+logo(away.id)+'<strong>'+esc(displayAbbr(away.id))+'</strong><small>'+esc(away.name)+'</small></span></div>'+
  '<p class="opfc-history-champion">🏆 Champion : '+esc(winner?.name??'Club vainqueur')+'</p>'+
  '<details class="opfc-history-details" data-result-id="'+esc(g.source_key)+'">'+
  '<summary>Voir les buteurs <span>⌄</span></summary>'+
  '<div class="opfc-history-goals"><div><h4>'+esc(home.name)+'</h4>'+renderGoals(goals,'PSG')+'</div>'+
  '<div><h4>'+esc(away.name)+'</h4>'+renderGoals(goals,'OM')+'</div></div></details></article>';
}
function filteredHistory(){
 const q=compact(finalsSearch.value),competition=finalsCompetition.value,mode=finalsMode.value;
 return historyItems.filter(g=>{
  const home=clubById.get(g.home_club),away=clubById.get(g.away_club);
  return (!competition||g.competition===competition)&&(!mode||g.mode===mode)&&
   (!q||compact([home?.name,away?.name,displayAbbr(g.home_club),displayAbbr(g.away_club)].join(' ')).includes(q));
 });
}
function renderHistory(){
 const data=filteredHistory(),pages=Math.max(1,Math.ceil(data.length/PAGE_SIZE));
 historyPage=Math.min(historyPage,pages-1);
 const first=historyPage*PAGE_SIZE;
 const expanded=new Set([...historyRoot.querySelectorAll('details[open]')].map(el=>el.dataset.resultId));
 historyRoot.innerHTML=data.length?data.slice(first,first+PAGE_SIZE).map(renderHistoryCard).join(''):
  '<p class="catalog-empty">'+(historyItems.length?'Aucune finale ne correspond aux filtres.':'Aucune finale enregistrée pour le moment.')+'</p>';
 for(const el of historyRoot.querySelectorAll('details'))if(expanded.has(el.dataset.resultId))el.open=true;
 finalsCount.innerHTML='<strong>'+data.length+'</strong> finale'+(data.length===1?'':'s')+' dans les archives récentes';
 finalsPrevious.disabled=historyPage===0;
 finalsNext.disabled=historyPage>=pages-1;
 finalsPageLabel.textContent='Page '+(historyPage+1)+' / '+pages;
}
for(const el of [finalsSearch,finalsCompetition,finalsMode]){
 el.addEventListener(el===finalsSearch?'input':'change',()=>{historyPage=0;renderHistory();});
}
finalsPrevious.addEventListener('click',()=>{
 if(historyPage>0){historyPage--;renderHistory();finalPanel.scrollIntoView({block:'start'});}
});
finalsNext.addEventListener('click',()=>{
 if(historyPage<Math.ceil(filteredHistory().length/PAGE_SIZE)-1){
  historyPage++;renderHistory();finalPanel.scrollIntoView({block:'start'});
 }
});
async function refreshPalmares(){
 try{
  const data=await loadTrophyHistory();
  const fresh=Object.fromEntries(DISPLAY_CLUBS.map(club=>[club.id,{grandline:0,league:0,cup:0}]));
  for(const item of data.summary){
   if(fresh[item.club]&&compById.has(item.competition))
    fresh[item.club][item.competition]=Math.max(0,Number(item.titles)||0);
  }
  liveHonours=fresh;
  paintClubs();
  const signature=JSON.stringify(data.history);
  if(signature!==historySignature){
   historySignature=signature;
   historyItems=[...data.history].sort((a,b)=>
    new Date(b.played_at)-new Date(a.played_at)||
    String(b.source_key).localeCompare(String(a.source_key)));
   renderHistory();
  }
  clubStatus.textContent='✅ Palmarès synchronisés';
  finalsStatus.textContent=data.history.length>=100?
   '✅ Résultats synchronisés · 100 finales les plus récentes affichables.':
   '✅ Historique synchronisé · '+data.history.length+' finale'+(data.history.length===1?'':'s')+' enregistrée'+(data.history.length===1?'':'s')+'.';
 }catch{
  clubStatus.textContent='Connexion au palmarès indisponible. Les chiffres affichés ne sont pas à jour.';
  finalsStatus.textContent='Connexion à l’historique indisponible. Réessaie avec Internet.';
  if(!liveHonours){
   for(const value of clubRoot.querySelectorAll('.club-catalog-award-value,.club-catalog-total strong'))
    value.textContent='—';
  }
 }
}
function refreshHall(){
 if(hallContent)hallContent.innerHTML=renderV3Hall(careerComplete?scorerTotals:null,v3PlayerPoints,v3Milestones);
}
async function refreshV3(){
 const [clubs,points,milestones]=await Promise.allSettled([loadV3ClubStats(),loadV3PlayerPoints(),loadV3Milestones()]);
 if(clubs.status==='fulfilled'){v3ClubTotals=clubs.value;paintClubs();}
 const status=document.getElementById('v3-club-status');
 if(status)status.textContent=clubs.status==='fulfilled'?'✅ Statistiques des clubs synchronisées':'⏳ Statistiques historiques en attente de la migration V3.';
 if(points.status==='fulfilled')v3PlayerPoints=points.value;
 if(milestones.status==='fulfilled')v3Milestones=milestones.value;
 refreshHall();
}
const refreshCatalogue=()=>Promise.all([refreshPalmares(),refreshScorers(),refreshV3()]);
void syncQueuedLocalResults().then(refreshCatalogue);
setInterval(()=>{if(!document.hidden)void refreshCatalogue();},20000);
window.addEventListener('focus',()=>void syncQueuedLocalResults().then(refreshCatalogue));
