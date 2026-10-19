/** Portraits OPFC : réutilisation des visuels déjà publiés pour OPMercato classique.
 * Les noms sans fichier associé conservent un monogramme propre (jamais de photo erronée).
 * Les URLs sont relatives à opfc.html, qui est situé à la racine du site.
 */
import {CARD_BY_ID} from './catalog.mjs';

const PORTRAIT_NAMES=Object.freeze({
 'luffy':'luffy','zoro':'zoro','nami':'nami','usopp':'usopp',
 'sanji':'sanji','chopper':'chopper','robin':'robin','franky':'franky',
 'brook':'brook','jinbe':'jinbe','shanks':'shanks','kaido':'kaido',
 'big-mom':'bigmom','barbe-noire':'teach','barbe-blanche':'whitebeard',
 'marco':'marco','katakuri':'katakuri','crocodile':'crocodile',
 'doflamingo':'doflamingo','bartholomew-kuma':'kuma',
 'trafalgar-law':'law','eustass-kidd':'kid',
 'gol-d-roger':'roger','rocks-d-xebec':'rocks','silvers-rayleigh':'rayleigh',
 'kozuki-oden':'oden','portgas-d-ace':'ace','sabo':'sabo',
 'monkey-d-garp':'garp','koby':'coby'
});
const h=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const portraitFile=id=>PORTRAIT_NAMES[id]?
 './custom-portraits/op-portrait-'+PORTRAIT_NAMES[id]+'.jpg':null;
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
