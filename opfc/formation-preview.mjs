/** Aperçu tactique avec le MÊME terrain que le placement après enchère gagnée.
 * compact=true : deux demi-colonnes en local sur iPhone. La hauteur doit être
 * INDÉPENDANTE de la largeur, sinon la pelouse masque milieu et attaque.
 */
import {FORMATIONS} from './rules.mjs';
import {pitchMarkings} from './pitch-markings.mjs';
const POS=['GAR','DEF','MIL','ATT'];
const LABELS=['Gardien','Défenseur','Milieu','Attaquant'];
export function renderFormationPreview(name,{compact=false}={}){
 const counts=FORMATIONS[name];
 if(!Array.isArray(counts)||counts.length!==4)throw Error('Formation inconnue');
 // Styles de secours intégrés au DOM : fiables même si Safari conserve un
 // ancien CSS. Délibérément limités aux aperçus LOCAUX compact=true.
 const pitchStyle=compact?
  ' style="aspect-ratio:auto!important;height:228px!important;min-height:228px!important;max-height:none!important"':'';
 const linesStyle=compact?
  ' style="height:208px!important;min-height:208px!important;padding:27px 0 9px!important;justify-content:space-between!important"':'';
 const rowStyle=compact?
  ' style="height:27px!important;min-height:27px!important;margin:0 1px!important;gap:1px!important"':'';
 const badgeStyle=compact?
  ' style="width:19px!important;height:19px!important;min-width:19px!important;min-height:19px!important;flex:0 0 19px!important;font-size:7px!important;border-width:1.3px!important"':'';
 const rows=counts.map((n,index)=>
  '<div class="pitch-row opfc-fp-position-row opfc-fp-row-'+POS[index].toLowerCase()+'"'+rowStyle+'>'+
  Array.from({length:n},()=>'<span class="opfc-fp-position-badge opfc-fp-'+POS[index].toLowerCase()+'"'+badgeStyle+'>'+POS[index]+'</span>').join('')+
  '</div>').join('');
 return '<figure class="opfc-fp-figure" aria-label="Formation '+name+' : '+counts.map((n,i)=>n+' '+LABELS[i].toLowerCase()+(n>1?'s':'')).join(', ')+'">'+
  '<div class="slot-field slot-field-single opfc-fp-pitch" aria-hidden="true"'+pitchStyle+'>'+
   pitchMarkings()+
   '<div class="opfc-fp-lines"'+linesStyle+'>'+rows+'</div>'+
  '</div>'+
  '<figcaption>⚽ '+name+' · Gardien en haut · Attaque en bas ↓</figcaption>'+
 '</figure>';
}
