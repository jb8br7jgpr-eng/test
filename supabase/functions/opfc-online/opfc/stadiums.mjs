/** Stades OPFC. Collection visuelle exclusivement, sans influence sur les matchs. */
export const STADIUMS=Object.freeze([
 {id:'mugiwara',name:'Mugiwara Stadium',capacity:60000,image:'./opfc/illustrations/stade-mugiwara.webp'},
 {id:'wanodrome',name:'Wanodrome',capacity:60000,image:'./opfc/illustrations/stade-wanodrome.webp'},
 {id:'erbaf',name:'Erbaf Arena',capacity:80000,image:'./opfc/illustrations/stade-erbaf.webp'},
 {id:'skypiea',name:'Skypiea Field',capacity:40000,image:'./opfc/illustrations/stade-skypiea.webp'},
 {id:'alabasta',name:'Alabasta Park',capacity:50000,image:'./opfc/illustrations/stade-alabasta.webp'},
 {id:'marineford',name:'Marineford Stadion',capacity:90000,image:'./opfc/illustrations/stade-marineford.webp'},
 {id:'dressrosa',name:'Dressrosa Arena',capacity:50000,image:'./opfc/illustrations/stade-dressrosa.webp'},
 {id:'whole-cake',name:'Whole Cake Stadium',capacity:60000,image:'./opfc/illustrations/stade-whole-cake.webp'}
]);
export const STADIUM_BY_ID=new Map(STADIUMS.map(x=>[x.id,x]));
export function stadiumById(id){return STADIUM_BY_ID.get(id)??STADIUMS[0];}
export const isStadium=id=>STADIUM_BY_ID.has(id);
export function stadiumPicker(selected,action='select-stadium'){
 const escape=s=>String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const current=stadiumById(selected);
 return '<section class="opfc-stadium-picker" aria-label="Choisir le stade">'+
 '<h2 class="section-title">🏟️ Choisis ton stade</h2>'+
 '<p class="caption">Un choix visuel : aucun bonus ou malus sportif.</p>'+
 '<div class="opfc-stadium-grid">'+STADIUMS.map(s=>
 '<button type="button" class="opfc-stadium-choice'+(s.id===current.id?' selected':'')+
 '" data-action="'+escape(action)+'" data-stadium="'+escape(s.id)+
 '" aria-pressed="'+(s.id===current.id)+'">'+
 '<img src="'+escape(s.image)+'" alt="" loading="lazy" decoding="async">'+
 '<strong>'+escape(s.name)+'</strong><small>'+s.capacity.toLocaleString('fr-FR')+' places</small></button>').join('')+
 '</div></section>';
}
