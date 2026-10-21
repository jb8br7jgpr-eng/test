/** Catalogue OPFC : personnages et clubs. Affichage en lecture seule, sans incidence sur le jeu. */
import {CARDS} from './catalog.mjs';
import {portraitFile} from './ui-portraits.mjs';
import {DISPLAY_CLUBS,displayAbbr,clubLogoFile} from './club-identities.mjs';
import {CLUB_HONOURS,CLUB_TROPHIES} from './club-honours.mjs';

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

function clubHtml(club){
 const honours=CLUB_HONOURS[club.id];
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
  '<div class="club-catalog-honours"><div class="club-catalog-honours-head"><h3>Palmarès fictif</h3>'+
  '<span class="club-catalog-total">'+esc(total)+' titre'+(total===1?'':'s')+'</span></div>'+
  '<ul class="club-catalog-awards">'+trophies+'</ul></div></article>';
}

clubRoot.innerHTML=DISPLAY_CLUBS.map(clubHtml).join('');
const clubElements=[...clubRoot.querySelectorAll('.club-catalog-card')];
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
