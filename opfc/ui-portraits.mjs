/** Portraits OFFICIELS OPFC : les portraits WebP du dossier
 * portraits_opfc/, (50 originaux et 15 nouveaux, fichiers conservés sans modification).
 * Mapping explicite 1:1 entre les IDs officiels et les noms de fichiers.
 * Le monogramme n'est qu'un secours si une image ne charge pas.
 */
import {CARD_BY_ID} from './catalog.mjs';
import {visualClub,displayClub,clubLogoFile} from './club-identities.mjs';

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
 'rob-lucci':'lucci',
 'ivankov':'ivankov',
 'kinemon':'kinemon',
 'bon-clay':'bonclay',
 'vegapunk':'vegapunk',
 'kalgara':'kalgara',
 'imu':'imu',
 'dorry':'dorry',
 'brogy':'brogy',
 'vivi':'vivi',
 'ener':'ener',
 'dadan':'dadan',
 'cesar-clown':'cesarclown',
 'inuarashi':'inuarashi',
 'nekomamushi':'nekomamushi',
 'momonosuke':'momonosuke'
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
/** Écusson réel pour un ID VISUEL (sélection des clubs, salon). */
export function renderIdentityCrest(identityId,cssClass=''){
 const identity=displayClub(identityId);
 const src=clubLogoFile(identityId);
 const label=identity?.name??'Club inconnu';
 if(src){
  return '<span class="club-crest club-crest-photo '+h(String(identityId).toLowerCase())+' '+h(cssClass)+
   '" role="img" aria-label="'+h(label)+'">'+
   '<img class="club-crest-image" src="'+h(src)+'" alt="" loading="lazy" decoding="async"></span>';
 }
 // Repli lisible si l'identité n'est pas disponible.
 return '<span class="club-crest '+h(cssClass)+'" role="img" aria-label="'+h(label)+'"><strong>'+
  h(identity?.id??'?')+'</strong></span>';
}
/** Club logique PSG/OM -> identité réelle sélectionnée, mode local ET en ligne. */
export function renderClubCrest(club,cssClass=''){
 const identity=visualClub(club);
 return renderIdentityCrest(identity?.id??club,cssClass);
}
