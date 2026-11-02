/**
 * OPFC LAB V5.1 — une vue face au but, plus proche de la diffusion TV.
 * Adaptation VISUELLE du seul SVG du laboratoire. Aucun moteur / règle / réseau.
 *
 * La cage est plus frontale: toit aminci, cadre abaissé, montants élargis.
 * Les trois maillages V4 sont conservés pour les impacts gauche/centre/droite.
 */
import {labV4PitchGraphic} from './penalty-lab-v4.mjs';

export const LAB_V51_CAMERA=Object.freeze({
 backgroundHeightPercent:33,
 frontXLeft:43,
 frontXRight:317,
 frontCrossbarY:67,
 frontBaseY:145,
 rearCrossbarY:55,
 keeperYPercent:30.1,
 ballYPercent:68,
 shooterYPercent:85,
 // Valeurs de la cage V5 précédente pour valider le rapprochement.
 v5GoalWidth:230*1.115,
 goalWidth:317-43
});

const OG_FIELD='M65 108 L7 297 H353 L295 108 M118 108 L100 169 H260 L242 108 M135 297 Q180 352 225 297';
const NEW_FIELD='M43 145 L7 297 H353 L317 145 M108 145 L88 196 H272 L252 145 M135 297 Q180 352 225 297';
const round=n=>Math.round(n*10)/10;

/** Maille frontale cohérente avec le nouveau but (pas de nouveau résultat de tir). */
function frontMesh(){
 let mesh='';
 for(let i=0;i<=19;i++){
  const x=43+(274*i/19);
  mesh+='<path d="M'+round(x)+' 67 Q'+round(x+(x-180)*.015)+' 104 '+round(x)+' 145"/>';
 }
 for(let i=0;i<=12;i++){
  const y=67+(78*i/12);
  mesh+='<path d="M43 '+round(y)+' Q180 '+round(y+Math.sin(i/12*Math.PI)*3)+' 317 '+round(y)+'"/>';
 }
 return mesh;
}
/** Le toit profond V4 est remplacé par seulement 12 unités de profondeur apparente. */
function goalFace(){
 const mesh=frontMesh();
 const regions=['left','center','right'].map(region=>
  '<g class="plab-net-mesh plab-v4-net-'+region+'" fill="none" '+
  'stroke="#e8f4f8" stroke-width=".68" stroke-opacity=".61" '+
  'clip-path="url(#plab-v4-net-'+region+')">'+mesh+'</g>').join('');
 let roofMesh='';
 for(let i=0;i<=12;i++){
  const t=i/12,x=78+204*t,fx=43+274*t;
  roofMesh+='<path d="M'+round(x)+' 55 L'+round(fx)+' 67"/>';
 }
 return '<ellipse cx="180" cy="146" rx="147" ry="12" fill="#082b20" opacity=".54"/>'+
  '<path d="M43 67 L78 55 H282 L317 67 Z" fill="url(#plab-goalshade)" stroke="#f7ffff" stroke-opacity=".28"/>'+
  '<g fill="none" stroke="#e8f4f8" stroke-width=".6" stroke-opacity=".43">'+roofMesh+'</g>'+
  '<path d="M43 145 V67 H317 V145 Z" fill="url(#plab-goalshade)" stroke="none"/>'+
  regions+
  '<path d="M43 145 V67 H317 V145" fill="none" stroke="#092830" stroke-width="10" opacity=".72"/>'+
  '<path class="plab-v51-front-frame" d="M43 145 V67 H317 V145" fill="none" stroke="url(#plab-metal)" stroke-width="6.7" stroke-linejoin="round"/>'+
  '<path d="M41.8 143 V65 H315.5" fill="none" stroke="#fff" stroke-width="1.2" opacity=".65"/>';
}

/** Reprojection exacte du seul décor SVG, tous éléments OPFC hors cadre inchangés. */
export function labV51PitchGraphic(){
 const base=labV4PitchGraphic();
 const start=base.indexOf('<ellipse cx="180" cy="112"');
 const field=base.indexOf('<path d="'+OG_FIELD+'"');
 if(start<0||field<start)throw Error('Repères du but V4 non trouvés');
 let svg=base.slice(0,start)+goalFace()+base.slice(field);
 // Le SVG V4 dessinait de l'herbe à partir de y=57. Cette texture masquait
 // la tribune, malgré le rectangle V5 à 28 %. La démarrer après le décor :
 // le fond V5.1 est réellement visible sur 33 % de la hauteur.
 const grassV4='<rect x="0" y="57" width="360" height="308" fill="url(#plab-blades)"/>';
 const grassV51='<rect x="0" y="120" width="360" height="245" fill="url(#plab-blades)"/>';
 if(!svg.includes(grassV4))throw Error('Calque herbe V4 introuvable');
 svg=svg.replace(grassV4,grassV51);
 const clips=[
  ['left','60','80','43','92'],
  ['center','140','80','135','90'],
  ['right','220','80','225','92']
 ];
 for(const [region,oldX,oldW,newX,newW] of clips){
  const old='<clipPath id="plab-v4-net-'+region+'"><rect x="'+oldX+'" y="26" width="'+oldW+'" height="87"/></clipPath>';
  const now='<clipPath id="plab-v4-net-'+region+'"><rect x="'+newX+'" y="64" width="'+newW+'" height="85"/></clipPath>';
  if(!svg.includes(old))throw Error('Masque filet '+region+' introuvable');
  svg=svg.replace(old,now);
 }
 const count=svg.split(OG_FIELD).length-1;
 if(count!==2)throw Error('Marquage de surface V4 changé');
 return svg.replaceAll(OG_FIELD,NEW_FIELD);
}
