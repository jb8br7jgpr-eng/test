/** Mini-stade tactique OPFC : demi-terrain orienté du but (haut) vers la ligne médiane (bas). */
import {FORMATIONS} from './rules.mjs';
const POS=['GAR','DEF','MIL','ATT'];
export function renderFormationPreview(name){
 const counts=FORMATIONS[name];
 if(!counts||counts.length!==4)throw Error('Formation inconnue');
 const y=[13,35,58,81],names=['Gardien','Défenseur','Milieu','Attaquant'];
 const discs=counts.map((n,index)=>Array.from({length:n},(_,i)=>{
  const x=(i+1)*100/(n+1);
  return '<span class="opfc-fp-disc opfc-fp-'+POS[index].toLowerCase()+'" style="left:'+x.toFixed(3)+'%;top:'+y[index]+'%" aria-label="'+names[index]+'">'+
   '<b>'+POS[index].charAt(0)+'</b></span>';
 }).join('')).join('');
 return '<figure class="opfc-fp-figure" aria-label="Aperçu de la formation '+name+' : gardien en haut, attaquants en bas">'+
  '<div class="opfc-fp-pitch">'+
  '<div class="opfc-fp-grass"></div><div class="opfc-fp-outline"></div>'+
  '<div class="opfc-fp-goal"></div><div class="opfc-fp-box"></div>'+
  '<div class="opfc-fp-six"></div><div class="opfc-fp-spot"></div>'+
  '<div class="opfc-fp-arc"></div><div class="opfc-fp-centerline"></div>'+
  '<div class="opfc-fp-centercircle"></div><div class="opfc-fp-centerspot"></div>'+
  discs+'</div>'+
  '<figcaption>⚽ '+name+' · Du but vers l’attaque ↓</figcaption></figure>';
}
