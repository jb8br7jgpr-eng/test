/** OPFC v0.8 — bloc 9B3 : feuille officielle de match.
 * Aucune statistique déduite ou simulée : uniquement celles du moteur.
 * La séance de tirs au but n'entre pas dans les tirs/buts du 90 minutes.
 * Portraits circulaires temporaires remplaçables par les visuels HD.
 */
import {CARD_BY_ID} from './catalog.mjs';
const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const player=id=>CARD_BY_ID.get(id)?.name??id??'—';
const clubs={PSG:'Pirates Saint-Grandline',OM:'Olympique de MaryGeoise'};
const short=id=>player(id).split(/\s+/).filter(Boolean).slice(0,2).map(n=>n[0]).join('').toUpperCase();
function goalsFor(goals,club){
 const list=goals.filter(g=>g.club===club);
 if(!list.length)return '<p class="caption">Aucun but</p>';
 return list.map(g=>'<div class="final-goal">'+
 '<span class="final-portrait" aria-hidden="true">'+h(short(g.cardId))+'</span>'+
 '<strong>'+h(player(g.cardId))+'</strong><span>'+Number(g.minute)+'e</span></div>').join('');
}
function statRow(label,a,b){
 const max=Math.max(1,a,b),p1=Math.round(a/max*100),p2=Math.round(b/max*100);
 return '<div class="final-stat"><div class="final-stat-head"><strong>'+a+'</strong><span>'+label+'</span><strong>'+b+'</strong></div>'+
 '<div class="final-stat-bars"><span><i style="width:'+p1+'%"></i></span><span><i style="width:'+p2+'%"></i></span></div></div>';
}
function shootoutReport(shootout){
 if(!shootout)return '';
 const rows=shootout.timeline.map(t=>'<div class="final-kick"><span class="club-dot '+h(t.club.toLowerCase())+'">'+h(t.club)+'</span>'+
 '<span>'+h(player(t.shooterId))+'</span><strong class="'+(t.scored?'kick-goal':'kick-fail')+'">'+
 (t.scored?'✓ But':t.result==='save'?'✕ Arrêt':'✕ Raté')+'</strong></div>').join('');
 return '<section class="panel final-shootout"><h3 class="section-title">Tirs au but — départage</h3>'+
 '<div class="final-shootout-score">PSG <strong>'+shootout.score.PSG+' – '+shootout.score.OM+'</strong> OM</div>'+
 '<p class="caption">Scores et tentatives de séance séparés du temps réglementaire.</p>'+
 '<div class="final-kicks">'+rows+'</div></section>';
}
export function renderFinalResult(state){
 if(state?.phase!=='finished'||!state.match?.winner)throw Error('Résultat final indisponible');
 const m=state.match,st=m.statistics;
 return '<div class="final-screen">'+
 '<section class="panel final-score"><span class="eyebrow">Grandline Cup · Coup de sifflet final</span>'+
 '<h2>Victoire de '+h(clubs[m.winner])+'</h2>'+
 '<div class="final-scoreline"><div><span class="final-club-emblem psg">PSG</span><strong>PSG</strong></div>'+
 '<div class="final-score-numbers"><strong>'+m.score.PSG+' – '+m.score.OM+'</strong>'+
 '<span>90 minutes</span></div>'+
 '<div><span class="final-club-emblem om">OM</span><strong>OM</strong></div></div>'+
 (m.victory==='shootout'?'<p class="final-qualification">Vainqueur aux tirs au but</p>':
 '<p class="final-qualification">Vainqueur au terme du temps réglementaire</p>')+
 '</section>'+
 '<section class="panel"><h3 class="section-title">Buteurs du match</h3>'+
 '<div class="final-goals"><div><h4>PSG</h4>'+goalsFor(m.goals,'PSG')+
 '</div><div><h4>OM</h4>'+goalsFor(m.goals,'OM')+'</div></div></section>'+
 '<section class="panel"><h3 class="section-title">Statistiques comparées · 90 minutes</h3>'+
 statRow('Tirs',st.PSG.shots,st.OM.shots)+
 statRow('Tirs cadrés',st.PSG.onTarget,st.OM.onTarget)+
 statRow('Arrêts',st.PSG.saves,st.OM.saves)+
 statRow('Séquences offensives',st.PSG.sequences,st.OM.sequences)+
 '</section>'+shootoutReport(m.shootout)+
 '<p class="caption final-footnote">Les portraits et écussons définitifs seront intégrés ultérieurement.</p></div>';
}
