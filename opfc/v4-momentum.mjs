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
function barWidth(entries,index){
 const current=at(entries[index].minute);
 const near=Math.min(...entries.filter((_,i)=>i!==index).map(e=>Math.abs(at(e.minute)-current)),Infinity);
 // Barres épaisses dans l'espace disponible, jamais de superposition opaque.
 return Math.max(4,Math.min(18,near-2));
}
export function renderMatchMomentum(match,{open=false,clubA='PSG',clubB='OM'}={}){
 const entries=momentumEntries(match),now=Math.max(0,Math.min(90,Number(match?.minute)||0));
 const toggle='<button type="button" class="opfc-momentum-toggle" data-action="v4-momentum-toggle" aria-expanded="'+(open?'true':'false')+'" aria-controls="opfc-momentum-panel">'+
  '<span>▥ '+(open?'Masquer le momentum':'Voir le momentum')+'</span><span aria-hidden="true">'+(open?'⌃':'⌄')+'</span></button>';
 if(!open)return '<div class="opfc-momentum-wrap">'+toggle+'</div>';
 const bars=entries.map((e,i)=>{
  const x=at(e.minute),height=LEVELS[e.outcome],up=e.club==='PSG';
  const fill=up?'#36C77A':'#8996F4',stroke=up?'#C2FBDD':'#D4DCFF',width=barWidth(entries,i);
  const caption=escape(e.minute+'e min. · '+(up?clubA:clubB)+' · '+OUTCOMES[e.outcome]);
  return '<rect x="'+(x-width/2).toFixed(2)+'" y="'+(up?middle-height:middle)+'" width="'+width.toFixed(2)+'" height="'+height+
   '" rx="1.8" fill="'+fill+'" stroke="'+stroke+'" stroke-width="1.35"><title>'+caption+'</title></rect>';
 }).join('');
 const goals=entries.filter(e=>e.outcome==='goal');
 const labels=goals.map(e=>{
  const up=e.club==='PSG',x=at(e.minute),y=up?42:165,textY=up?24:190;
  const fill=up?'#36C77A':'#8996F4';
  return '<g><circle cx="'+x.toFixed(2)+'" cy="'+y+'" r="10" fill="'+fill+'" stroke="#F4F7FA" stroke-width="1.4"/>'+
   '<text x="'+x.toFixed(2)+'" y="'+(y+4)+'" font-size="11" text-anchor="middle">⚽</text>'+
   '<text x="'+x.toFixed(2)+'" y="'+textY+'" fill="#F4F7FA" font-size="11" font-weight="800" text-anchor="middle">'+e.minute+'′</text></g>';
 }).join('');
 const gameLabel=entries.length+' action'+(entries.length===1?'':'s')+' jouée'+(entries.length===1?'':'s');
 return '<div class="opfc-momentum-wrap">'+toggle+
  '<section id="opfc-momentum-panel" class="opfc-momentum-panel" aria-label="Momentum du match">'+
  '<div class="opfc-momentum-heading"><strong>DYNAMIQUE DU MATCH</strong><span>'+gameLabel+'</span></div>'+
  (entries.length?'<svg class="opfc-momentum-svg" viewBox="0 0 360 210" role="img" aria-label="'+escape(gameLabel+' : '+goals.length+' but'+(goals.length===1?'':'s'))+'">'+
    '<rect x="43" y="48" width="292" height="104" rx="4" fill="#152B3B"/>'+
    '<rect x="43" y="48" width="'+Math.max(0,at(now)-left).toFixed(2)+'" height="52" fill="#1D423A" opacity=".62"/>'+
    '<rect x="43" y="100" width="'+Math.max(0,at(now)-left).toFixed(2)+'" height="52" fill="#2F3453" opacity=".62"/>'+
    '<rect x="'+at(now).toFixed(2)+'" y="48" width="'+Math.max(0,right-at(now)).toFixed(2)+'" height="104" fill="#0C1D2B" opacity=".60"/>'+
    '<line x1="43" y1="100" x2="335" y2="100" stroke="#D2DBE4" stroke-width="1.4"/>'+
    '<line x1="'+at(45).toFixed(2)+'" y1="46" x2="'+at(45).toFixed(2)+'" y2="154" stroke="#B9CBDA" stroke-width="1" stroke-dasharray="4 4"/>'+
    bars+labels+
    '<line x1="'+at(now).toFixed(2)+'" y1="45" x2="'+at(now).toFixed(2)+'" y2="154" stroke="#F4D18A" stroke-width="2" stroke-dasharray="3 3"/>'+
    '<rect x="'+(at(now)-16).toFixed(2)+'" y="27" width="32" height="18" rx="7" fill="#F4D18A"/>'+
    '<text x="'+at(now).toFixed(2)+'" y="40" font-size="11" font-weight="800" text-anchor="middle" fill="#193146">'+now+'′</text>'+
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
