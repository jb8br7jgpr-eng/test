/** Catalogue OPFC : personnages et clubs. Affichage en lecture seule, sans incidence sur le jeu. */
import {CARDS} from './catalog.mjs';
import {portraitFile} from './ui-portraits.mjs';
import {DISPLAY_CLUBS,displayAbbr,clubLogoFile} from './club-identities.mjs';
import {CLUB_HONOURS,CLUB_TROPHIES} from './club-honours.mjs?v=opfc-comp-v1-20261022';
import {loadTrophyHistory,syncQueuedLocalResults} from './trophy-service.mjs';

const root=document.getElementById('catalog-grid');
const search=document.getElementById('catalog-search');
const position=document.getElementById('catalog-position');
const rarity=document.getElementById('catalog-rarity');
const count=document.getElementById('catalog-count');
const empty=document.getElementById('catalog-empty');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const compact=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const post={GAR:'Gardien',DEF:'Défenseur',MIL:'Milieu',ATT:'Attaquant'};
const rarityName={DIA:'Diamant',OR:'Or',ARG:'Argent',BRZ:'Bronze'};
const stats={PUI:'PUI',TEC:'TEC',PAS:'PAS',VIT:'VIT',DEF:'DEF',GAR:'GAR'};
const sorted=[...CARDS].sort((a,b)=>b.rating-a.rating||a.name.localeCompare(b.name,'fr'));

function cardHtml(c){
 const portrait=portraitFile(c.id);
 const letters=c.name.split(/[\s.-]+/).filter(Boolean).slice(0,2).map(x=>x.charAt(0)).join('');
 const picture=portrait?'<img loading="lazy" decoding="async" src="'+esc(portrait)+'" alt="Portrait de '+esc(c.name)+'">':esc(letters);
 const statBlocks=Object.entries(stats).map(([key,label])=>
  '<div class="catalog-stat"><span>'+label+'</span><strong>'+esc(c.stats[key])+'</strong></div>'
 ).join('');
 return '<article class="discovery-panel catalog-card" data-search="'+esc(compact(c.name+' '+c.group))+
  '" data-position="'+esc(c.position)+'" data-rarity="'+esc(c.rarity)+'">'+
  '<div class="catalog-card-top"><div class="catalog-portrait">'+picture+'</div>'+
  '<div class="catalog-card-info"><h2 class="catalog-card-name">'+esc(c.name)+'</h2>'+
  '<div class="catalog-rating">'+esc(c.rating)+'<small>NOTE</small></div>'+
  '<div class="catalog-tags"><span class="catalog-tag">'+esc(post[c.position])+'</span>'+
  '<span class="catalog-tag rarity-'+esc(c.rarity)+'">'+esc(rarityName[c.rarity])+'</span></div>'+
  '<p class="catalog-group">'+esc(c.group)+'</p></div></div>'+
  '<div class="catalog-stats" aria-label="Six statistiques de '+esc(c.name)+'">'+statBlocks+'</div></article>';
}

root.innerHTML=sorted.map(cardHtml).join('');
const elements=[...root.querySelectorAll('.catalog-card')];
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
update();


/* Section clubs : mêmes identités et mêmes logos que dans les menus du jeu. */
const clubRoot=document.getElementById('club-grid');
const clubSearch=document.getElementById('club-search');
const clubCount=document.getElementById('club-count');
const clubEmpty=document.getElementById('club-empty');
const clubStatus=document.getElementById('club-sync-status');
const historyRoot=document.getElementById('opfc-results-history');
let liveHonours=null;

function clubHtml(club){
 const honours=liveHonours?.[club.id]??CLUB_HONOURS[club.id];
 const logo=clubLogoFile(club.id);
 const abbr=displayAbbr(club.id);
 if(!honours||!logo)throw new Error('Fiche de club incomplète : '+club.id);
 const trophies=CLUB_TROPHIES.map(t=>'<li>'+
  '<span class="club-catalog-award-name"><span class="club-catalog-award-icon" aria-hidden="true">'+esc(t.icon)+'</span>'+esc(t.name)+'</span>'+
  '<strong class="club-catalog-award-value" aria-label="'+esc(honours[t.key])+' titres">'+esc(honours[t.key])+'</strong>'+
  '</li>').join('');
 const total=CLUB_TROPHIES.reduce((sum,t)=>sum+honours[t.key],0);
 return '<article class="discovery-panel club-catalog-card" data-search="'+esc(compact(club.name+' '+abbr))+'" style="--club-color:'+esc(club.secondary)+'">'+
  '<div class="club-catalog-banner"><img src="'+esc(logo)+'" alt="Écusson de '+esc(club.name)+'" loading="lazy" decoding="async"></div>'+
  '<div class="club-catalog-identity"><h2 class="club-catalog-name">'+esc(club.name)+'</h2>'+
  '<div class="club-catalog-identifier"><strong>'+esc(abbr)+'</strong><span>CLUB OPFC</span></div></div>'+
  '<div class="club-catalog-honours"><div class="club-catalog-honours-head"><h3>Palmarès officiel</h3>'+ 
  '<span class="club-catalog-total">'+esc(total)+' titre'+(total===1?'':'s')+'</span></div>'+
  '<ul class="club-catalog-awards">'+trophies+'</ul></div></article>';
}

clubRoot.innerHTML=DISPLAY_CLUBS.map(clubHtml).join('');
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
updateClubs();

/* Onglets accessibles ; un lien direct #clubs ouvre aussi la galerie. */
const characterPanel=document.getElementById('catalog-characters');
const clubPanel=document.getElementById('catalog-clubs');
const characterTab=document.getElementById('catalog-tab-characters');
const clubTab=document.getElementById('catalog-tab-clubs');
characterTab.querySelector('.catalog-tab-count').textContent=CARDS.length;
clubTab.querySelector('.catalog-tab-count').textContent=DISPLAY_CLUBS.length;
function selectCatalogTab(tab){
 const isClub=tab==='clubs';
 characterPanel.hidden=isClub;
 clubPanel.hidden=!isClub;
 for(const [button,active] of [[characterTab,!isClub],[clubTab,isClub]]){
  button.classList.toggle('is-active',active);
  button.setAttribute('aria-selected',String(active));
  button.tabIndex=active?0:-1;
 }
}
function syncCatalogTab(){
 selectCatalogTab(window.location.hash==='#clubs'?'clubs':'characters');
}
characterTab.addEventListener('click',()=>{
 selectCatalogTab('characters');
 window.location.hash='#personnages';
});
clubTab.addEventListener('click',()=>{
 selectCatalogTab('clubs');
 window.location.hash='#clubs';
});
for(const [button,tabName] of [[characterTab,'characters'],[clubTab,'clubs']]){
 button.addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();
  const next=tabName==='characters'?'clubs':'characters';
  const chosen=event.key==='Home'?'characters':event.key==='End'?'clubs':next;
  const target=chosen==='clubs'?clubTab:characterTab;
  target.click();
  target.focus();
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
function renderHistory(history){
 if(!history.length){
  historyRoot.innerHTML='<p class="caption">Aucune finale disputée pour le moment. Les 20 clubs débutent sans trophée.</p>';
  return;
 }
 historyRoot.innerHTML=history.slice(0,100).map(g=>{
  const home=clubById.get(g.home_club),away=clubById.get(g.away_club);
  const comp=compById.get(g.competition);
  if(!home||!away||!comp)return '';
  const score=String(g.home_score)+' – '+String(g.away_score);
  const tab=g.shootout?' · TAB '+esc(g.shootout.home)+' – '+esc(g.shootout.away):'';
  const logo=id=>'<img src="'+esc(clubLogoFile(id))+'" alt="" width="32" height="32" loading="lazy">';
  const winner=clubById.get(g.winner);
  return '<article class="opfc-history-match">'+
   '<div class="opfc-history-meta"><span>'+esc(comp.icon)+' '+esc(comp.name)+'</span><span>'+esc(formatDate(g.played_at))+' · '+(g.mode==='online'?'En ligne':'Local')+'</span></div>'+
   '<div class="opfc-history-teams"><span>'+logo(home.id)+'<strong>'+esc(displayAbbr(home.id))+'</strong></span>'+
   '<div class="opfc-history-score"><strong>'+esc(score)+'</strong>'+(tab?'<small>'+tab+'</small>':'')+'</div>'+
   '<span>'+logo(away.id)+'<strong>'+esc(displayAbbr(away.id))+'</strong></span></div>'+
   '<p class="opfc-history-champion">🏆 '+esc(winner?.name??'Club vainqueur')+'</p>'+
   '</article>';
 }).join('');
}
async function refreshPalmares(){
 try{
  const data=await loadTrophyHistory();
  const fresh=Object.fromEntries(DISPLAY_CLUBS.map(club=>[club.id,{grandline:0,league:0,cup:0}]));
  for(const item of data.summary){
   if(fresh[item.club]&&compById.has(item.competition))
    fresh[item.club][item.competition]=Math.max(0,Number(item.titles)||0);
  }
  liveHonours=fresh;
  clubRoot.innerHTML=DISPLAY_CLUBS.map(clubHtml).join('');
  clubElements=[...clubRoot.querySelectorAll('.club-catalog-card')];
  updateClubs();
  renderHistory(data.history);
  clubStatus.textContent='✅ Palmarès synchronisés · '+data.history.length+' finale'+(data.history.length===1?'':'s')+' dans l’historique récent.';
 }catch{
  clubStatus.textContent='Connexion au palmarès indisponible. Les chiffres affichés ne sont pas à jour.';
  historyRoot.innerHTML='<p class="caption">Impossible de charger les finales. Réessaie avec une connexion Internet.</p>';
  // Ne pas afficher un total fictif à zéro comme si la donnée était fiable.
  if(!liveHonours){
   for(const value of clubRoot.querySelectorAll('.club-catalog-award-value,.club-catalog-total'))
    value.textContent='—';
  }
 }
}
void syncQueuedLocalResults().then(refreshPalmares);
setInterval(()=>{if(!document.hidden)void refreshPalmares();},20000);
window.addEventListener('focus',()=>void syncQueuedLocalResults().then(refreshPalmares));
