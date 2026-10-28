/** OPFC — chronologie visuelle fondée uniquement sur l'historique public joué.
 * Aucune modification des résultats, du calendrier ou des probabilités.
 */
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LEVELS=Object.freeze({stopped:13,miss:25,save:37,goal:49});
const OUTCOMES=Object.freeze({stopped:'Attaque stoppée',miss:'Tir non cadré',save:'Tir cadré arrêté',goal:'But marqué'});
const left=43,right=335,middle=100;
const at=minute=>left+Math.max(0,Math.min(90,minute))*(right-left)/90;
export function momentumEntries(match){
 return (Array.isArray(match?.history)?match.history:[]).filter(e=>
  e&&['PSG','OM'].includes(e.attacker)&&
  Number.isFinite(e.minute)&&e.minute>=0&&e.minute<=90&&
  Object.hasOwn(LEVELS,e.outcome)
 ).slice(0,12).map((e,index)=>({minute:e.minute,club:e.attacker,outcome:e.outcome,index}));
}
/** Répartition exclusivement visuelle : les minutes et l'ordre des actions restent réels.
 * On ne décale que les barres d'une MÊME équipe (les deux équipes sont sur
 * des demi-graphiques différents). Les positions sont calculées en coordonnées
 * SVG, donc le rendu reste identique sur les différentes tailles d'iPhone.
 */
export function momentumBarLayout(entries){
 const bars=entries.map((e,pos)=>({
  ...e,pos,realX:at(e.minute),x:at(e.minute),width:18
 }));
 const gap=2.5;
 for(const club of ['PSG','OM']){
  const group=bars.filter(b=>b.club===club).sort((a,b)=>a.minute-b.minute||a.pos-b.pos);
  if(!group.length)continue;
  for(const bar of group){
   const nearest=Math.min(Infinity,...group.filter(b=>b!==bar).map(b=>Math.abs(b.realX-bar.realX)));
   // Les actions isolées gardent leur largeur originelle, les grappes sont
   // légèrement affinées mais jamais superposées ni invisibles.
   bar.width=nearest<24?12:18;
  }
  let offset=0;
  const offsets=[];
  const blocks=[];
  // Régression isotone : minimise le déplacement total autour des vraies
  // minutes, en imposant des distances suffisantes entre rectangles.
  for(let i=0;i<group.length;i++){
   if(i)offset+=(group[i-1].width+group[i].width)/2+gap;
   offsets.push(offset);
   blocks.push({start:i,end:i,sum:group[i].realX-offset,count:1});
   while(blocks.length>1){
    const b=blocks[blocks.length-1],a=blocks[blocks.length-2];
    if(a.sum/a.count<=b.sum/b.count)break;
    a.end=b.end;a.sum+=b.sum;a.count+=b.count;
    blocks.pop();
   }
  }
  // Chaque rectangle reste entièrement dans les limites de l'histogramme,
  // même si plusieurs actions surviennent à la 0e ou à la 90e minute.
  const minX=left+group[0].width/2;
  const maxX=right-group.at(-1).width/2-offset;
  for(const b of blocks){
   const base=Math.max(minX,Math.min(maxX,b.sum/b.count));
   for(let i=b.start;i<=b.end;i++)group[i].x=base+offsets[i];
  }
 }
 return bars;
}
export function renderMatchMomentum(match,{open=false,clubA='PSG',clubB='OM'}={}){
 const entries=momentumEntries(match),now=Math.max(0,Math.min(90,Number(match?.minute)||0));
 const toggle='<button type="button" class="opfc-momentum-toggle" data-action="v4-momentum-toggle" aria-expanded="'+(open?'true':'false')+'" aria-controls="opfc-momentum-panel">'+
  '<span>▥ '+(open?'Masquer le momentum':'Voir le momentum')+'</span><span aria-hidden="true">'+(open?'⌃':'⌄')+'</span></button>';
 if(!open)return '<div class="opfc-momentum-wrap">'+toggle+'</div>';
 const layout=momentumBarLayout(entries);
 // Un petit trait au ras de l'axe montre la vraie minute lorsqu'une barre
 // a dû être décalée ; il est dessiné DERRIÈRE les barres.
 const timingLeaders=layout.filter(e=>Math.abs(e.x-e.realX)>1.5).map(e=>{
  const up=e.club==='PSG',y=up?middle-2:middle+2;
  const stroke=up?'#86F1B4':'#B8C0FF';
  return '<line x1="'+e.realX.toFixed(2)+'" y1="'+y+'" x2="'+e.x.toFixed(2)+'" y2="'+y+
   '" stroke="'+stroke+'" stroke-width="1" opacity=".65" stroke-dasharray="2 2"/>';
 }).join('');
 const bars=layout.map(e=>{
  const x=e.x,height=LEVELS[e.outcome],up=e.club==='PSG';
  const fill=up?'#36C77A':'#8996F4',stroke=up?'#C2FBDD':'#D4DCFF',width=e.width;
  const caption=escape(e.minute+'e min. · '+(up?clubA:clubB)+' · '+OUTCOMES[e.outcome]);
  return '<rect class="opfc-momentum-bar '+(up?'opfc-momentum-bar-psg':'opfc-momentum-bar-om')+'" x="'+(x-width/2).toFixed(2)+'" y="'+(up?middle-height:middle)+'" width="'+width.toFixed(2)+'" height="'+height+
   '" rx="1.8" fill="'+fill+'" stroke="'+stroke+'" stroke-width="1.35"><title>'+caption+'</title></rect>';
 }).join('');
 const goals=entries.filter(e=>e.outcome==='goal');
 // Écarter les étiquettes des buts proches, mais conserver la vraie position de chaque barre.
 const spaced=club=>{
  const sorted=goals.filter(g=>g.club===club).sort((a,b)=>a.minute-b.minute);
  const points=sorted.map(g=>({g,real:at(g.minute),x:at(g.minute)}));
  for(let i=1;i<points.length;i++)points[i].x=Math.max(points[i].x,points[i-1].x+32);
  if(points.length&&points.at(-1).x>right-5){
   const shift=points.at(-1).x-(right-5);
   points.forEach(p=>p.x-=shift);
  }
  for(let i=points.length-2;i>=0;i--)points[i].x=Math.min(points[i].x,points[i+1].x-32);
  if(points.length&&points[0].x<left+5){
   const shift=left+5-points[0].x;
   points.forEach(p=>p.x+=shift);
  }
  return points;
 };
 const labels=[...spaced('PSG'),...spaced('OM')].map(({g,real,x})=>{
  const up=g.club==='PSG',y=up?42:165,textY=up?24:190;
  const fill=up?'#36C77A':'#8996F4';
  const leader=Math.abs(real-x)>1?'<line x1="'+real.toFixed(2)+'" y1="'+(up?53:150)+'" x2="'+x.toFixed(2)+'" y2="'+y+'" stroke="'+fill+'" stroke-width="1" opacity=".8"/>':'';
  return '<g>'+leader+'<circle class="opfc-momentum-goal-ring '+(up?'opfc-momentum-goal-psg':'opfc-momentum-goal-om')+'" cx="'+x.toFixed(2)+'" cy="'+y+'" r="11.7" fill="none" stroke="'+fill+'" stroke-width="1.2"/>'+
   '<circle class="opfc-momentum-goal-marker '+(up?'opfc-momentum-goal-psg':'opfc-momentum-goal-om')+'" cx="'+x.toFixed(2)+'" cy="'+y+'" r="10" fill="'+fill+'" stroke="#F4F7FA" stroke-width="1.4"/>'+
   '<text x="'+x.toFixed(2)+'" y="'+(y+4)+'" font-size="11" text-anchor="middle">⚽</text>'+
   '<text x="'+x.toFixed(2)+'" y="'+textY+'" fill="#F4F7FA" font-size="11" font-weight="800" text-anchor="middle">'+g.minute+'′</text></g>';
 }).join('');
 const gameLabel=entries.length+' action'+(entries.length===1?'':'s')+' jouée'+(entries.length===1?'':'s');
 return '<div class="opfc-momentum-wrap">'+toggle+
  '<section id="opfc-momentum-panel" class="opfc-momentum-panel" aria-label="Momentum du match">'+
  '<div class="opfc-momentum-heading"><strong>DYNAMIQUE DU MATCH</strong><span>'+gameLabel+' · '+now+'e min.</span></div>'+
  (entries.length?'<svg class="opfc-momentum-svg" viewBox="0 0 360 210" role="img" aria-label="'+escape(gameLabel+' : '+goals.length+' but'+(goals.length===1?'':'s'))+'">'+
    '<defs><linearGradient id="opfc-momentum-bar-psg-gradient" x1="0" y1="0" x2="0" y2="1">'+
    '<stop offset="0%" stop-color="#8AE6B9"/><stop offset="53%" stop-color="#36C77A"/><stop offset="100%" stop-color="#20895D"/>'+
    '</linearGradient><linearGradient id="opfc-momentum-bar-om-gradient" x1="0" y1="0" x2="0" y2="1">'+
    '<stop offset="0%" stop-color="#C5CCFF"/><stop offset="53%" stop-color="#8996F4"/><stop offset="100%" stop-color="#626DBB"/>'+
    '</linearGradient></defs>'+
    '<rect class="opfc-momentum-plot-base" x="43" y="48" width="292" height="104" rx="4" fill="#152B3B"/>'+
    '<rect x="43" y="48" width="'+Math.max(0,at(now)-left).toFixed(2)+'" height="52" fill="#1D423A" opacity=".62"/>'+
    '<rect x="43" y="100" width="'+Math.max(0,at(now)-left).toFixed(2)+'" height="52" fill="#2F3453" opacity=".62"/>'+
    '<rect x="'+at(now).toFixed(2)+'" y="48" width="'+Math.max(0,right-at(now)).toFixed(2)+'" height="104" fill="#0C1D2B" opacity=".60"/>'+
    '<line class="opfc-momentum-axis" x1="43" y1="100" x2="335" y2="100" stroke="#D2DBE4" stroke-width="1.4"/>'+
    '<line class="opfc-momentum-halftime" x1="'+at(45).toFixed(2)+'" y1="46" x2="'+at(45).toFixed(2)+'" y2="154" stroke="#B9CBDA" stroke-width="1" stroke-dasharray="4 4"/>'+
    timingLeaders+bars+labels+
    '<line class="opfc-momentum-now" x1="'+at(now).toFixed(2)+'" y1="45" x2="'+at(now).toFixed(2)+'" y2="154" stroke="#F4D18A" stroke-width="2" stroke-dasharray="3 3"/>'+

    '<text x="3" y="78" fill="#86F1B4" font-size="11" font-weight="800">'+escape(clubA)+'</text>'+
    '<text x="3" y="131" fill="#B8C0FF" font-size="11" font-weight="800">'+escape(clubB)+'</text>'+
    '<text x="43" y="207" font-size="11" text-anchor="middle" fill="#CEDBE4">0′</text>'+
    '<text x="'+at(45).toFixed(2)+'" y="207" font-size="11" text-anchor="middle" fill="#CEDBE4">45′</text>'+
    '<text x="335" y="207" font-size="11" text-anchor="middle" fill="#CEDBE4">90′</text>'+
   '</svg>':
   '<p class="opfc-momentum-empty">La première barre apparaîtra à la fin de la première action.</p>')+
  '<div class="opfc-momentum-legend"><span><i class="opfc-momentum-key psg"></i>'+escape(clubA)+'</span>'+
  '<span><i class="opfc-momentum-key om"></i>'+escape(clubB)+'</span><span>⚽ Buts et minutes</span></div>'+
  '<p class="opfc-momentum-caption">Petite barre : attaque stoppée · Moyenne : tir non cadré · Haute : tir arrêté · Maximum : but</p>'+
  '</section></div>';
}
