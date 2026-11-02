/** OPFC LAB V4 : effets purement graphiques, sans modifier les règles. */
import {labPitchGraphic} from './penalty-lab-visual.mjs';
import {trajectoryFor} from './penalty-lab-core.mjs';
export const V4_STADIUMS=Object.freeze({
 mugiwara:{light:'#e3b454',secondary:'#185b88'},
 wanodrome:{light:'#e8a1be',secondary:'#74bce4'},
 erbaf:{light:'#d9b66f',secondary:'#327657'},
 skypiea:{light:'#8775be',secondary:'#e7c66f'},
 alabasta:{light:'#e8ca83',secondary:'#319c9a'},
 marineford:{light:'#a5b6c7',secondary:'#285a91'},
 dressrosa:{light:'#e6bd70',secondary:'#8055ae'},
 'whole-cake':{light:'#f4d8ac',secondary:'#cf6a9f'}
});
export function stadiumLight(id){return V4_STADIUMS[id]??V4_STADIUMS.mugiwara;}
/**
 * Le filet original est scindé en trois couches VISUELLES. Toutes les mailles,
 * coordonnées et tracés du SVG V3 restent rigoureusement identiques.
 */
export function labV4PitchGraphic(){
 const original=labPitchGraphic();
 const pattern=/(<g class="plab-net-mesh"[^>]*>)([\s\S]*?)(<\/g>)/;
 const match=original.match(pattern);
 if(!match)throw Error('Filet V3 introuvable');
 const clips='<defs>'+
  '<clipPath id="plab-v4-net-left"><rect x="60" y="26" width="80" height="87"/></clipPath>'+
  '<clipPath id="plab-v4-net-center"><rect x="140" y="26" width="80" height="87"/></clipPath>'+
  '<clipPath id="plab-v4-net-right"><rect x="220" y="26" width="80" height="87"/></clipPath>'+
  '</defs>';
 const regions=['left','center','right'].map(region=>
  '<g class="plab-net-mesh plab-v4-net-'+region+'" fill="none" stroke="#e8f4f8" '+
  'stroke-width=".68" stroke-opacity=".58" clip-path="url(#plab-v4-net-'+region+')">'+
  match[2]+'</g>').join('');
 return original.replace(match[0],regions).replace('</defs>',clips+'</defs>');
}
/** Variation décorative stable, qui ne dépend ni des statistiques ni du hasard moteur. */
export function flightStyle(attempt){
 const key=String(attempt?.shooterId??'')+':'+String(attempt?.shotNumber??1)+':'+String(attempt?.shotDirection??'');
 let sum=0;
 for(let i=0;i<key.length;i++)sum=(sum*31+key.charCodeAt(i))>>>0;
 return ['low','medium','high'][sum%3];
}
export function flightFrames(attempt,width,height){
 const t=trajectoryFor(attempt);
 const x=width*(t.ballX-50)/100, y=height*(t.ballY-68)/100;
 const dir=({GAUCHE:-.19,CENTRE:0,DROITE:.19})[attempt.shotDirection]*width;
 const lift={low:height*.008,medium:height*.025,high:height*.049}[flightStyle(attempt)];
 const round=n=>Math.round(n*10)/10;
 const frames=[
  {transform:'translate(-50%,-50%) translate(0px,0px) scale(1)',offset:0},
  {transform:'translate(-50%,-50%) translate('+round(dir*.10)+'px,'+round(y*.11-lift*.35)+'px) scale(.97)',offset:.18},
  {transform:'translate(-50%,-50%) translate('+round(dir*.60)+'px,'+round(y*.56-lift)+'px) scale(.77)',offset:.58},
  {transform:'translate(-50%,-50%) translate('+round(x*.87)+'px,'+round(y*.87-lift*.38)+'px) scale(.57)',offset:.82},
  {transform:'translate(-50%,-50%) translate('+round(x)+'px,'+round(y)+'px) scale(.49)',offset:1}
 ];
 if(attempt.outcome==='save'){
  frames[3]={...frames[3],transform:'translate(-50%,-50%) translate('+round(x*.98)+'px,'+round(y*.98)+'px) scale(.51)'};
  frames[4]={...frames[4],transform:'translate(-50%,-50%) translate('+round(x+dir*.07)+'px,'+round(y+height*.04)+'px) scale(.50)'};
 }
 return {frames,flight:flightStyle(attempt),x,y,keeperX:width*(t.keeperX-50)/100,zone:attempt.shotDirection};
}
/** Tir susceptible de conclure les TAB selon le score actuel, AVANT son résultat. */
export function potentiallyDecisive(session){
 const s=session?.shootout;
 if(session?.type!=='shootout'||s?.phase!=='active'||!['PSG','OM'].includes(s.nextClub))return false;
 const club=s.nextClub, other=club==='PSG'?'OM':'PSG';
 const shots={PSG:s.attempts.PSG.length,OM:s.attempts.OM.length};
 shots[club]++;
 const leftA=Math.max(0,5-shots.PSG),leftB=Math.max(0,5-shots.OM);
 for(const goal of [0,1]){
  const scores={PSG:s.score.PSG,OM:s.score.OM};
  scores[club]+=goal;
  if(scores.PSG>scores.OM+leftB||scores.OM>scores.PSG+leftA)return true;
  if(shots.PSG>=5&&shots.OM>=5&&shots.PSG===shots.OM&&scores.PSG!==scores.OM)return true;
 }
 return false;
}
