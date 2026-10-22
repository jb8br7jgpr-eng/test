/** Aperçu tactique avec le MÊME terrain que le placement après enchère gagnée. */
import {FORMATIONS} from './rules.mjs';
import {pitchMarkings} from './pitch-markings.mjs';
const POS=['GAR','DEF','MIL','ATT'];
const LABELS=['Gardien','Défenseur','Milieu','Attaquant'];
export function renderFormationPreview(name){
 const counts=FORMATIONS[name];
 if(!Array.isArray(counts)||counts.length!==4)throw Error('Formation inconnue');
 const rows=counts.map((n,index)=>
  '<div class="pitch-row opfc-fp-position-row opfc-fp-row-'+POS[index].toLowerCase()+'">'+
  Array.from({length:n},()=>'<span class="opfc-fp-position-badge opfc-fp-'+POS[index].toLowerCase()+'">'+POS[index]+'</span>').join('')+
  '</div>').join('');
 return '<figure class="opfc-fp-figure" aria-label="Formation '+name+' : '+counts.map((n,i)=>n+' '+LABELS[i].toLowerCase()+(n>1?'s':'')).join(', ')+'">'+
  '<div class="slot-field slot-field-single opfc-fp-pitch" aria-hidden="true">'+
   pitchMarkings()+
   '<div class="opfc-fp-lines">'+rows+'</div>'+
  '</div>'+
  '<figcaption>⚽ '+name+' · Gardien en haut · Attaque en bas ↓</figcaption>'+
 '</figure>';
}
