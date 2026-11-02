/**
 * OPFC — trajectoires VISUELLES calibrées sur le but frontal du laboratoire V5.1.
 *
 * Source de vérité sportive : trajectoryFor() et les résultats du moteur
 * restent intacts. Ce module projette un tir déjà résolu sur le dessin actuel :
 *
 *              barre y=67       centre du filet      base y=145
 *           poteau x=43                               poteau x=317
 *
 * Les trois hauteurs correspondent désormais à des points DANS les filets,
 * jamais au-dessus de la barre. Les ratés passent explicitement hors cadre.
 */
import {LAB_V51_CAMERA} from './penalty-lab-v5-1.mjs';
import {flightStyle} from './penalty-lab-v4.mjs';
import {trajectoryFor} from './penalty-lab-core.mjs';

const SVG_WIDTH=360;
const SVG_HEIGHT=365;
const CENTER_Y=LAB_V51_CAMERA.ballYPercent/100;
const round=n=>Math.round(n*10)/10;
const clip=(n,min,max)=>Math.min(max,Math.max(min,n));
const PCT_GOAL_HEIGHT={low:.69,medium:.52,high:.32};

/** Coordonnées en espace SVG de la cage actuelle, sans hasard ni moteur. */
export function labV51ImpactPoint(attempt){
 const outcome=attempt?.outcome;
 const t=trajectoryFor(attempt); // contrôle les directions et l'issue officielles
 const kind=flightStyle(attempt);
 const frame=LAB_V51_CAMERA;
 const width=frame.frontXRight-frame.frontXLeft;
 const height=frame.frontBaseY-frame.frontCrossbarY;
 if(outcome==='goal'){
  // Une frappe réussie atteint le filet : 92..121 sur les 67..145 disponibles.
  const y=frame.frontCrossbarY+height*PCT_GOAL_HEIGHT[kind];
  let x=SVG_WIDTH*t.ballX/100;
  if(attempt.shotDirection===attempt.keeperDirection){
   // Le tir reste du bon côté mais évite le portrait du gardien sur un but.
   const dir=attempt.shotDirection==='DROITE'?-1:1;
   x+=dir*SVG_WIDTH*.06;
  }
  return Object.freeze({
   x:round(clip(x,frame.frontXLeft+18,frame.frontXRight-18)),
   y:round(y),outcome,flight:kind
  });
 }
 if(outcome==='save'){
  // Point de contact autour des mains/du corps du gardien à ~30 % du terrain.
  return Object.freeze({
   x:round(SVG_WIDTH*t.keeperX/100),
   y:round(SVG_HEIGHT*frame.keeperYPercent/100),
   outcome,flight:kind
  });
 }
 // Ratés latéraux : le ballon passe EN DEHORS du montant, jamais dans le filet.
 // Raté au centre : il dépasse nettement la barre transversale.
 const x=attempt.shotDirection==='GAUCHE'?frame.frontXLeft-23:
  attempt.shotDirection==='DROITE'?frame.frontXRight+23:SVG_WIDTH/2;
 const y=attempt.shotDirection==='CENTRE'?frame.frontCrossbarY-29:
  frame.frontCrossbarY+height*.53;
 return Object.freeze({x:round(x),y:round(y),outcome,flight:kind});
}

/** Même API que flightFrames() V4 : seules les coordonnées de l'image changent. */
export function labV51FlightFrames(attempt,width,height){
 if(!(width>0&&height>0))throw Error('Dimensions de scène invalides');
 const hit=labV51ImpactPoint(attempt);
 const x=width*(hit.x/SVG_WIDTH-.5);
 const y=height*(hit.y/SVG_HEIGHT-CENTER_Y);
 const dir=({GAUCHE:-.19,CENTRE:0,DROITE:.19})[attempt.shotDirection]*width;
 const keeperX=width*(trajectoryFor(attempt).keeperX/100-.5);
 const lift={low:height*.008,medium:height*.025,high:height*.049}[hit.flight];
 const transform=(dx,dy,scale)=>
  'translate(-50%,-50%) translate('+round(dx)+'px,'+round(dy)+'px) scale('+scale+')';
 const frames=[
  {transform:transform(0,0,1),offset:0},
  {transform:transform(dir*.10,y*.11-lift*.35,.97),offset:.18},
  {transform:transform(dir*.60,y*.56-lift,.77),offset:.58},
  {transform:transform(x*.87,y*.87-lift*.38,.57),offset:.82},
  {transform:transform(x,y,.49),offset:1}
 ];
 if(attempt.outcome==='save'){
  // Contact gardien à la fin du vol, puis très courte déviation vers le sol.
  frames[3]={transform:transform(x*.98,y*.98,.51),offset:.82};
  frames[4]={transform:transform(x+dir*.07,y+height*.035,.50),offset:1};
 }
 return {frames,flight:hit.flight,x,y,keeperX,
  zone:attempt.shotDirection,impact:hit};
}
