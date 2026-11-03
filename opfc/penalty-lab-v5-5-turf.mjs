/**
 * OPFC LAB V5.5 — pelouse de stade premium, entièrement VISUELLE.
 *  - bandes de tonte progressives en perspective vers le point de penalty ;
 *  - dégradés naturels et éclairage de stade, sans vert fluo ;
 *  - 2 400 vrais micro-brins et reflets déterministes, rendus en 4 paths SVG ;
 *  - grain subtil et dégradés de profondeur.
 * La cage V5.2, les trajectoires et tous les SVG de marquage sont conservés.
 */
import {labV52PitchGraphic} from './penalty-lab-v5-2-net.mjs';

export const LAB_V55_TURF=Object.freeze({
 viewBox:'0 0 360 365',
 horizonY:120,
 pitchEndY:365,
 stripes:Object.freeze([120,139,160,184,211,243,279,320,365]),
 grassBlades:2400
});

const SVG_GRASS_V51='<rect x="0" y="120" width="360" height="245" fill="url(#plab-blades)"/>';
const fmt=n=>String(Math.round(n*10)/10);
const escape=(s)=>String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/** Déterministe : aucun Math.random, aucune animation ni serveur. */
function pseudo(seed){
 let s=seed>>>0;
 return ()=>{
  s^=s<<13;s^=s>>>17;s^=s<<5;
  return ((s>>>0)%1000000)/1000000;
 };
}

function microBlades(){
 const rng=pseudo(785130);
 const classes=[[],[],[],[]];
 for(let i=0;i<LAB_V55_TURF.grassBlades;i++){
  const x=rng()*360;
  // Densité et taille augmentent progressivement vers la caméra.
  const depth=Math.pow(rng(),.66);
  const y=LAB_V55_TURF.horizonY+2+depth*242;
  const near=(y-LAB_V55_TURF.horizonY)/245;
  const h=.55+near*2.7*rng();
  const tilt=(rng()-.5)*(1.3+near*2.4);
  const endX=x+tilt;
  classes[i%4].push('M'+fmt(x)+' '+fmt(y)+'l'+fmt(endX-x)+' '+fmt(-h));
 }
 return classes.map((d,i)=>'<path d="'+d.join(' ')+'" stroke="'+
  ['#d0efb5','#0b3926','#a0d68a','#052b22'][i]+'" stroke-width="'+
  [.43,.5,.27,.6][i]+'" stroke-opacity="'+[.30,.32,.23,.19][i]+'" fill="none"/>').join('');
}
function mowStripes(){
 const stops=LAB_V55_TURF.stripes;
 let result='';
 const palette=['#295f38','#397a44','#2a693e','#3c7e49','#2b6c3d','#43834b','#2b713f','#448e4e'];
 for(let i=0;i<stops.length-1;i++){
  const y=stops[i],h=stops[i+1]-y;
  result+='<rect x="0" y="'+y+'" width="360" height="'+h+'" fill="'+palette[i]+'"/>';
  // Tondu dans le sens opposé : transition douce, surtout pas damier.
  result+='<rect x="0" y="'+y+'" width="360" height="'+h+'" fill="url(#plab-v55-band-light)" opacity="'+
   (i%2===0?'.15':'.09')+'"/>';
  if(i<stops.length-2)
   result+='<path d="M0 '+fmt(y+h)+'H360" stroke="#062d1f" stroke-opacity=".10" stroke-width=".45"/>';
 }
 return result;
}

export function labV55TurfGraphic(){
 const blades=microBlades();
 return '<svg class="plab-v55-turf" viewBox="'+LAB_V55_TURF.viewBox+
  '" preserveAspectRatio="none" aria-hidden="true" focusable="false">'+
  '<defs>'+
   '<clipPath id="plab-v55-grass-clip"><rect x="0" y="120" width="360" height="245"/></clipPath>'+
   '<linearGradient id="plab-v55-depth" x1="0" y1="0" x2="0" y2="1">'+
    '<stop stop-color="#071c20" stop-opacity=".43"/>'+
    '<stop offset=".2" stop-color="#133323" stop-opacity=".13"/>'+
    '<stop offset=".56" stop-color="#c3e6a1" stop-opacity=".03"/>'+
    '<stop offset="1" stop-color="#0d3b23" stop-opacity=".09"/>'+
   '</linearGradient>'+
   '<linearGradient id="plab-v55-band-light" x1="0" y1="0" x2="1" y2="0">'+
    '<stop stop-color="#061e16" stop-opacity=".36"/>'+
    '<stop offset=".23" stop-color="#feffdc" stop-opacity=".10"/>'+
    '<stop offset=".51" stop-color="#e3fbd1" stop-opacity=".32"/>'+
    '<stop offset=".78" stop-color="#f7ffc9" stop-opacity=".07"/>'+
    '<stop offset="1" stop-color="#061e16" stop-opacity=".36"/>'+
   '</linearGradient>'+
   '<radialGradient id="plab-v55-pitch-light" cx=".49" cy=".38" r=".79">'+
    '<stop stop-color="#d8f4a4" stop-opacity=".15"/>'+
    '<stop offset=".53" stop-color="#c8e6ad" stop-opacity=".045"/>'+
    '<stop offset="1" stop-color="#0a2219" stop-opacity=".34"/>'+
   '</radialGradient>'+
   '<filter id="plab-v55-grain" x="0" y="0" width="100%" height="100%">'+
    '<feTurbulence type="fractalNoise" baseFrequency=".43 .72" numOctaves="2" seed="12" stitchTiles="stitch"/>'+
    '<feColorMatrix type="saturate" values="0"/>'+
   '</filter>'+
  '</defs>'+
  '<g clip-path="url(#plab-v55-grass-clip)">'+
   mowStripes()+
   '<rect x="0" y="120" width="360" height="245" fill="url(#plab-v55-pitch-light)"/>'+
   '<rect x="0" y="120" width="360" height="245" fill="url(#plab-v55-depth)"/>'+
   '<rect x="0" y="120" width="360" height="245" fill="#9bc27e" filter="url(#plab-v55-grain)" opacity=".115" style="mix-blend-mode:soft-light"/>'+
   '<g stroke-linecap="round">'+blades+'</g>'+
   '<path d="M0 120 H360" stroke="#071e1b" stroke-opacity=".6" stroke-width="1.8"/>'+
  '</g></svg>';
}

/** Conserve tous les traits de la scène existante, enlève seulement l'ancien
 * pavage simpliste de petits tirets sur l'herbe. Le nouveau tapis est sous
 * les marquages/cage/filet via le z-index du SVG, jamais dans le vrai jeu. */
export function labV55PitchGraphic(){
 const source=labV52PitchGraphic();
 if(source.split(SVG_GRASS_V51).length!==2)
  throw Error('Pavage de pelouse V5.1 introuvable, adaptation V5.5 impossible');
 return source.replace(SVG_GRASS_V51,'');
}
