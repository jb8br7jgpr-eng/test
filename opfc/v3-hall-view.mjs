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
 const list=limit=>'<ol>'+rows.slice(0,limit).map((p,i)=>
  '<li><span>'+(i<3?['🥇','🥈','🥉'][i]+' ':'')+(i+1)+'. +e(p.name)+'</span><strong>'+value(p.id)+'</strong></li>').join('')+'</ol>';
 return {id:lead?.id??null,html:'<article class="discovery-panel v3-hall-card">'+
  '<h3>'+e(c.icon)+' '+e(c.title)+'</h3>'+picture(lead,'v3-hall-leader')+
  '<strong>'+e(lead?.name??'En attente de légende')+'</strong><span class="v3-hall-number">'+
  (lead?value(lead.id)+' '+e(c.unit):'Aucune performance')+'</span>'+
  '<details><summary>Podium des 3 meilleurs</summary>'+list(3)+'</details>'+
  '<details><summary>Voir le classement complet</summary>'+list(rows.length)+'</details></article>'};
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
 (seven.some(p=>p.points>0)?teamPitch(seven):'<p>En attente des premières performances.</p>')+'</section>';
}
