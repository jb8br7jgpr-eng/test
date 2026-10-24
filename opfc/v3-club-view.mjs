/** Encarts historiques OPFC V3. */
import {clubMetrics} from './v3-data-service.mjs';
const e=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderV3ClubStats(record){
 const v=clubMetrics(record),r=v?.ratio;
 const item=(label,value,tone)=>'<div class="v3-stat '+tone+'"><strong>'+e(value)+'</strong><small>'+e(label)+'</small></div>';
 const tone=n=>n==null||n===0?'neutral':n>0?'positive':'negative';
 const one=[
  item('MATCHS',v?.matches??'—','neutral'),item('VICTOIRES',v?.wins??'—','positive'),
  item('DÉFAITES',v?.losses??'—','negative'),item('RATIO',r==null?'—':r.toLocaleString('fr-FR',{minimumFractionDigits:1,maximumFractionDigits:1})+' %',tone(r==null?null:r-50))];
 const two=[item('BUTS MARQUÉS',v?.goalsFor??'—','positive'),
  item('BUTS ENCAISSÉS',v?.goalsAgainst??'—','negative'),
  item('DIFFÉRENCE',v?.diff==null?'—':v.diff>0?'+'+v.diff:v.diff,tone(v?.diff))];
 return '<section class="v3-club-stats"><h3>📊 Statistiques historiques</h3>'+
  '<div class="v3-stat-row">'+one.join('')+'</div><div class="v3-stat-row three">'+two.join('')+'</div></section>';
}
