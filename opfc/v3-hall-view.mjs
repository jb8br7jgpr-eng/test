/** Panthéon V3 : affichage, sans modification du moteur ou des résultats. */
import {CARDS} from './catalog.mjs';
import {portraitFile} from './ui-portraits.mjs';
import {pitchMarkings} from './pitch-markings.mjs';
import {CATEGORIES,SEATS,rankCards,hallSeven} from './v3-hall-core.mjs';
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key='opfc-v3-hall-incumbents';
const picture=(c,cls)=>{
 const src=c&&portraitFile(c.id);
 return '<span class="'+cls+'">'+(src?'<img src="'+e(src)+'" alt="Portrait de '+e(c.name)+'" loading="lazy" decoding="async">':'⚓')+'</span>';
};
const stored=()=>{
 try{const s=JSON.parse(localStorage.getItem(key)||'{}');return s&&typeof s==='object'?s:{};}
 catch{return {};}
};
function categoryHtml(c,totals,prior,milestones){
 const ranked=rankCards(CARDS,c.key,totals,{incumbents:prior||[],milestones});
 const rows=ranked.filter(p=>(totals.get(p.id)?.[c.key]??0)>0);
 const lead=rows[0],value=id=>Number(totals.get(id)?.[c.key]??0);
 const list=cards=>'<ol>'+cards.map((p,i)=>
  '<li><span>'+(i<3?['🥇','🥈','🥉'][i]+' ':'')+(i+1)+'. '+e(p.name)+'</span><strong>'+value(p.id)+'</strong></li>').join('')+'</ol>';
 return {id:lead?.id??null,html:'<article class="discovery-panel v3-hall-card">'+
  '<h3>'+e(c.icon)+' '+e(c.title)+'</h3>'+picture(lead,'v3-hall-leader')+
  '<strong>'+e(lead?.name??'En attente de légende')+'</strong><span class="v3-hall-number">'+
  (lead?value(lead.id)+' '+e(c.unit):'Aucune performance')+'</span>'+
  '<details><summary>Podium des 3 meilleurs</summary>'+list(rows.slice(0,3))+'</details>'+
  '<details><summary>Voir le classement complet</summary>'+list(ranked)+'</details></article>'};
}
function teamPitch(team){
 const point=(p,x,y)=>{
  const c=p.points>0?CARDS.find(c=>c.id===p.id):null;
  return '<div class="v3-hall-player" style="left:'+x+'%;top:'+y+'%">'+
   picture(c,'v3-hall-avatar')+'<strong>'+e(c?.name??'—')+'</strong><small>'+p.points+' pts</small></div>';
 };
 const by=pos=>team.filter(p=>p.position===pos);
 return '<div class="v3-hall-pitch slot-field slot-field-single">'+pitchMarkings()+
  by('GAR').map(p=>point(p,50,17)).join('')+
  by('DEF').map((p,i)=>point(p,i?76:24,38)).join('')+
  by('MIL').map((p,i)=>point(p,i?64:36,60)).join('')+
  by('ATT').map((p,i)=>point(p,i?80:20,83)).join('')+'</div>';
}
/** Classement toujours affiché, y compris après synchronisation des statistiques. */
const HALL_POSITIONS=Object.freeze([
 {id:'GAR',icon:'🧤',name:'Gardiens'},
 {id:'DEF',icon:'🛡️',name:'Défenseurs'},
 {id:'MIL',icon:'🎯',name:'Milieux'},
 {id:'ATT',icon:'⚽',name:'Attaquants'}
]);
function hallPretenders(points,prior,milestones,seven){
 const rankedTotals=new Map([...points].map(([id,n])=>[id,{points:n}]));
 const incumbents=prior.seats??{};
 const legends=new Set(seven.filter(p=>p.points>0).map(p=>p.id));
 const sections=HALL_POSITIONS.map(position=>{
  const positionCards=rankCards(CARDS.filter(c=>c.position===position.id),'points',rankedTotals,{
   incumbents:incumbents[position.id]??[],milestones
  });
  const seats=SEATS[position.id];
  const cutoff=Number(points.get(positionCards[seats-1]?.id)??0);
  const rows=positionCards.map((card,index)=>{
   const earned=Number(points.get(card.id)??0);
   const isLegend=legends.has(card.id);
   const deficit=cutoff-earned;
   const status=isLegend?'<span class="v3-hall-rank-legend">★ Sept de légende</span>':
    cutoff<=0?'':deficit===0?
    '<span class="v3-hall-rank-gap">À égalité de points · départage</span>':
    '<span class="v3-hall-rank-gap">−'+deficit+' pts du dernier titulaire</span>';
   return '<li class="v3-hall-rank-row'+(isLegend?' is-legend':'')+'">'+
    '<span class="v3-hall-rank-index">'+(index+1)+'.</span>'+
    picture(card,'v3-hall-rank-avatar')+
    '<span class="v3-hall-rank-identity"><strong>'+e(card.name)+'</strong>'+status+'</span>'+
    '<span class="v3-hall-rank-score"><strong>'+earned+'</strong><small>pts</small></span></li>';
  }).join('');
  return '<section class="v3-hall-position" aria-label="'+e(position.name)+'">'+
   '<h3><span>'+e(position.icon)+' '+e(position.name)+'</span>'+
   '<small>'+seats+' place'+(seats>1?'s':'')+' dans le Sept</small></h3>'+
   '<ol class="v3-hall-rank-list">'+rows+'</ol></section>';
 }).join('');
 return '<section class="discovery-panel v3-hall-chasers" aria-label="Classement des prétendants">'+
  '<header class="v3-hall-chasers-header">'+
  '<span class="v3-hall-chasers-title"><strong>🏆 Classement des prétendants</strong>'+
  '<small>Tous les personnages · Points cumulés</small></span>'+
  '<span class="v3-hall-chasers-counter">'+CARDS.length+' joueurs</span>'+
  '</header><div class="v3-hall-chasers-body">'+sections+'</div></section>';
}
export function renderV3Hall(totals,points,milestones){
 if(!totals||!points||!milestones)return '<p class="discovery-notes">⏳ Données historiques en cours de synchronisation.</p>';
 const prior=stored(),next={};
 const categories=CATEGORIES.map(c=>{const x=categoryHtml(c,totals,prior[c.key],milestones);next[c.key]=x.id?[x.id]:[];return x.html;});
 const seven=hallSeven(CARDS,points,prior.seats??{},milestones);
 next.seats=Object.fromEntries(Object.keys(SEATS).map(pos=>[pos,seven.filter(p=>p.position===pos).map(p=>p.id)]));
 try{localStorage.setItem(key,JSON.stringify(next));}catch{}
 return '<div class="v3-hall-grid">'+categories.join('')+'</div>'+
 '<section class="discovery-panel v3-hall-team"><h2>🏆 Sept de Légende</h2>'+
 '<p>La meilleure équipe historique · 2-2-2 · Points de l’Ancre d’Or</p>'+
 (seven.some(p=>p.points>0)?teamPitch(seven):'<p>En attente des premières performances.</p>')+'</section>'+ 
 hallPretenders(points,prior,milestones,seven);
}
