/**
 * OPFC LAB V5.2 — filet continu à réponse élastique.
 *
 * Fin du découpage V4 en trois bandes indépendantes et clippées :
 * chaque intersection de maille partage EXACTEMENT les mêmes coordonnées
 * entre la ligne verticale et horizontale. Les extrémités restent fixées
 * aux montants et aux barres. Une onde amortie naît à l'impact réel du ballon.
 *
 * Pure présentation : ni règles, ni probabilités, ni serveur.
 */
import {labV51PitchGraphic,LAB_V51_CAMERA} from './penalty-lab-v5-1.mjs';

export const NET_GRID=Object.freeze({columns:20,rows:13,
 left:LAB_V51_CAMERA.frontXLeft,right:LAB_V51_CAMERA.frontXRight,
 top:LAB_V51_CAMERA.frontCrossbarY,bottom:LAB_V51_CAMERA.frontBaseY,
 duration:490});
const fmt=n=>(Math.round(n*100)/100).toString();
const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));

/** Une seule surface : 20 verticales + 13 horizontales, sans clipPath ni joint. */
export function continuousNetPoints(impact={x:180,y:104},progress=0){
 const c=NET_GRID,elapsed=clamp(progress,0,1);
 const points=[];
 const centerX=clamp(impact.x,c.left+12,c.right-12);
 const centerY=clamp(impact.y,c.top+9,c.bottom-9);
 const settle=Math.pow(1-elapsed,1.45);
 const rebound=Math.sin(elapsed*Math.PI*1.72)*Math.exp(-elapsed*1.15)*settle;
 const spread=21+elapsed*55;
 const waveRadius=elapsed*78;
 for(let j=0;j<c.rows;j++){
  const v=j/(c.rows-1),y=c.top+(c.bottom-c.top)*v;
  const row=[];
  for(let i=0;i<c.columns;i++){
   const u=i/(c.columns-1),x=c.left+(c.right-c.left)*u;
   // Courbure statique très légère; aucune couture entre les mailles.
   const baseX=x+(u-.5)*3.4*Math.sin(Math.PI*v);
   const baseY=y+1.6*Math.sin(Math.PI*u)*Math.sin(Math.PI*v);
   // Les extrémités sont fixées EXACTEMENT au cadre, sans epsilon flottant.
   if(i===0||i===c.columns-1||j===0||j===c.rows-1){
    row.push(Object.freeze({x:baseX,y:baseY}));
    continue;
   }
   const distance=Math.hypot(x-centerX,y-centerY);
   const core=Math.exp(-(distance*distance)/(2*spread*spread));
   const ring=Math.exp(-Math.pow(distance-waveRadius,2)/(2*22*22))*
    Math.sin(elapsed*Math.PI*3.8)*Math.exp(-elapsed*2.1)*settle;
   // Les 4 bords sont cousus à la structure (taper=0 aux extrémités).
   const pinned=Math.pow(Math.sin(Math.PI*u)*Math.sin(Math.PI*v),.7);
   const dx=pinned*(.108*(x-centerX)*core*rebound+
    (x<centerX?-1:1)*1.35*ring);
   const dy=pinned*(7.8*core*rebound+1.9*ring);
   row.push(Object.freeze({x:baseX+dx,y:baseY+dy}));
  }
  points.push(Object.freeze(row));
 }
 return Object.freeze(points);
}
export function continuousNetPaths(impact,progress=0){
 const nodes=continuousNetPoints(impact,progress),c=NET_GRID;
 const paths=[];
 for(let i=0;i<c.columns;i++){
  let d='';
  for(let j=0;j<c.rows;j++){
   const p=nodes[j][i];d+=(j?' L':'M')+fmt(p.x)+' '+fmt(p.y);
  }
  paths.push(d);
 }
 for(let j=0;j<c.rows;j++){
  let d='';
  for(let i=0;i<c.columns;i++){
   const p=nodes[j][i];d+=(i?' L':'M')+fmt(p.x)+' '+fmt(p.y);
  }
  paths.push(d);
 }
 return paths;
}
function meshMarkup(){
 return '<g class="plab-net-mesh plab-v52-net" fill="none" stroke="#e8f4f8" '+
  'stroke-width=".68" stroke-opacity=".63" aria-hidden="true">'+
  continuousNetPaths({x:180,y:104},0).map((d,i)=>
   '<path data-net-line="'+i+'" d="'+d+'"/>').join('')+'</g>';
}
export function labV52PitchGraphic(){
 const original=labV51PitchGraphic();
 let inserts=0;
 let svg=original.replace(
  /<g class="plab-net-mesh plab-v4-net-(?:left|center|right)"[\s\S]*?<\/g>/g,
  ()=>{
   inserts++;
   return inserts===1?meshMarkup():'';
  }
 );
 if(inserts!==3)throw Error('Filet V5.1 attendu en trois anciens tiers : '+inserts);
 // Les masques découpe V4 deviennent inutiles : les retirer intégralement.
 svg=svg.replace(/<clipPath id="plab-v4-net-(?:left|center|right)">[\s\S]*?<\/clipPath>/g,'');
 return svg;
}
/** Anime le DOM SVG avec rAF ; ne crée aucun élément/classe dans le jeu OPFC.
 * La promesse se termine après l'amortissement ou dès que la scène disparaît.
 */
export function animateContinuousNet(scene,impact,{
 duration=NET_GRID.duration,
 raf=fn=>requestAnimationFrame(fn),
 live=()=>scene.isConnected
}={}){
 const group=scene?.querySelector('.plab-v52-net');
 const paths=group?[...group.querySelectorAll('path[data-net-line]')]:[];
 if(paths.length!==NET_GRID.columns+NET_GRID.rows)return Promise.resolve(false);
 if(!(duration>0))return Promise.resolve(false);
 group.classList.add('plab-v52-net-active');
 let started=null;
 return new Promise(resolve=>{
  const tick=now=>{
   if(!live()){
    group.classList.remove('plab-v52-net-active');
    resolve(false);return;
   }
   if(started===null)started=now;
   const fraction=clamp((now-started)/duration,0,1);
   const ds=continuousNetPaths(impact,fraction);
   for(let i=0;i<paths.length;i++)paths[i].setAttribute('d',ds[i]);
   if(fraction<1)raf(tick);
   else{
    // Restitue le maillage initial exactement, sans flottement résiduel.
    const rest=continuousNetPaths(impact,0);
    for(let i=0;i<paths.length;i++)paths[i].setAttribute('d',rest[i]);
    group.classList.remove('plab-v52-net-active');
    resolve(true);
   }
  };
  raf(tick);
 });
}
