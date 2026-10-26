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
/** Aperçu de pelouse utilisé comme fond des résultats et de la célébration finale.
 * Chemins depuis opfc.html (à la racine). Un seul fond est préchargé : le stade choisi. */
export const RESULT_STADIUM_BACKDROPS=Object.freeze({
 'mugiwara':'./opfc/illustrations/01_mugiwara_stadium.webp',
 'wanodrome':'./opfc/illustrations/02_wanodrome.webp',
 'erbaf':'./opfc/illustrations/03_erbaf_arena.webp',
 'skypiea':'./opfc/illustrations/04_skypiea_field.webp',
 'alabasta':'./opfc/illustrations/05_alabasta_park.webp',
 'marineford':'./opfc/illustrations/06_marineford_stadion.webp',
 'dressrosa':'./opfc/illustrations/07_dressrosa_arena.webp',
 'whole-cake':'./opfc/illustrations/08_whole_cake_stadium.webp'
});
const resultBackdropPreloads=new Map();
export function preloadStadiumBackdrop(id){
 const src=RESULT_STADIUM_BACKDROPS[id];
 if(!src||resultBackdropPreloads.has(id)||typeof Image!=='function')return;
 const image=new Image();
 image.decoding='async';
 resultBackdropPreloads.set(id,image);
 image.src=src;
}
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
