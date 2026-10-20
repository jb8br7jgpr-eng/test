/** Catalogue OPFC : lecture seule des 50 fiches officielles, sans dépendance au jeu. */
import {CARDS} from './catalog.mjs';
import {portraitFile} from './ui-portraits.mjs';

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
