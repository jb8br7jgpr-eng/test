/** Portraits OFFICIELS OPFC : les 50 fichiers WebP originaux du dossier
 * portraits_opfc/, copiés sans modification depuis main vers opfc-development.
 * Mapping explicite 1:1 entre les IDs officiels et les noms de fichiers.
 * Le monogramme n'est qu'un secours si une image ne charge pas.
 */
import {CARD_BY_ID} from './catalog.mjs';

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
 const om=club==='OM';
 return '<span class="club-crest '+(om?'om':'psg')+' '+h(cssClass)+'" aria-hidden="true">'+
  '<span class="club-crest-top">'+(om?'OLYMPIQUE':'PIRATES')+'</span>'+
  '<strong>'+(om?'OM':'PSG')+'</strong>'+
  '<span class="club-crest-bottom">'+(om?'MARYGEOISE':'GRANDLINE')+'</span></span>';
}
