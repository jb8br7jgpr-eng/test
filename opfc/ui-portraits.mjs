/** Portraits OFFICIELS OPFC : les 50 fichiers WebP originaux du dossier
 * portraits_opfc/, copiés sans modification depuis main vers opfc-development.
 * Mapping explicite 1:1 entre les IDs officiels et les noms de fichiers.
 * Le monogramme n'est qu'un secours si une image ne charge pas.
 */
import {CARD_BY_ID} from './catalog.mjs';
import {visualClub} from './club-identities.mjs';

const PORTRAIT_NAMES=Object.freeze({
 'luffy':'luffy',
 'zoro':'zoro',
 'nami':'nami',
 'usopp':'usopp',
 'sanji':'sanji',
 'chopper':'chopper',
 'robin':'robin',
 'franky':'franky',
 'brook':'brook',
 'jinbe':'jinbe',
 'shanks':'shanks',
 'kaido':'kaido',
 'big-mom':'bigmom',
 'barbe-noire':'barbenoire',
 'barbe-blanche':'barbeblanche',
 'baggy':'baggy',
 'marco':'marco',
 'ben-beckman':'beckman',
 'king':'king',
 'katakuri':'katakuri',
 'crocodile':'crocodile',
 'hancock':'hancock',
 'gecko-moria':'moria',
 'doflamingo':'doflamingo',
 'bartholomew-kuma':'kuma',
 'mihawk':'mihawk',
 'trafalgar-law':'law',
 'eustass-kidd':'kid',
 'killer':'killer',
 'bonney':'bonney',
 'urouge':'urouge',
 'x-drake':'drake',
 'capone-bege':'bege',
 'scratchmen-apoo':'apoo',
 'basil-hawkins':'hawkins',
 'gol-d-roger':'roger',
 'rocks-d-xebec':'rocks',
 'monkey-d-dragon':'dragon',
 'silvers-rayleigh':'rayleigh',
 'kozuki-oden':'oden',
 'portgas-d-ace':'ace',
 'sabo':'sabo',
 'yamato':'yamato',
 'loki':'loki',
 'monkey-d-garp':'garp',
 'akainu':'akainu',
 'aokiji':'aokiji',
 'kizaru':'kizaru',
 'koby':'koby',
 'rob-lucci':'lucci'
});
const h=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const portraitFile=id=>PORTRAIT_NAMES[id]?
 './portraits_opfc/'+PORTRAIT_NAMES[id]+'.webp':null;
export const availablePortraitIds=Object.freeze(Object.keys(PORTRAIT_NAMES));
export function renderCharacterPortrait(id,cssClass=''){
 const card=CARD_BY_ID.get(id);
 const name=card?.name??String(id??'');
 const initials=name.split(/[\s.-]+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase();
 const src=portraitFile(id);
 return '<span class="character-portrait '+h(cssClass)+'" aria-hidden="true">'+
  '<span class="character-portrait-fallback">'+h(initials)+'</span>'+
  (src?'<img src="'+h(src)+'" loading="lazy" decoding="async" alt="">':'')+
  '</span>';
}
export function renderClubCrest(club,cssClass=''){
 const identity=visualClub(club);
 const words=identity?.name.split(' ')??['CLUB','INCONNU'];
 const top=words.slice(0,-1).join(' ').toUpperCase();
 const bottom=words.at(-1).toUpperCase();
 const primary=identity?.primary??'#112c59',secondary=identity?.secondary??'#ffffff';
 const n=parseInt(primary.slice(1),16);
 const light=((n>>16)&255)*.299+((n>>8)&255)*.587+(n&255)*.114>165;
 const ink=light?'#122336':'#ffffff';
 const style='color:'+ink+';background:linear-gradient(145deg,'+primary+','+secondary+')';
 return '<span class="club-crest '+h(club.toLowerCase())+' '+h(cssClass)+
  '" style="'+style+'" aria-label="'+h(identity?.name??'Club')+'">'+
  '<span class="club-crest-top">'+h(top)+'</span>'+
  '<strong>'+h(identity?.id??club)+'</strong>'+
  '<span class="club-crest-bottom">'+h(bottom)+'</span></span>';
}
