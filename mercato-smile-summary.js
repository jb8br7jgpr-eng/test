/* OPMercato — visuel SMILE partagé entre le mode local et le mode en ligne. */
(function(){
'use strict';
const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function render(flips,players){
  const results=Array.isArray(flips)?flips:[];
  const people=Array.isArray(players)?players:[];
  const rows=people.map(p=>{
    const f=results.find(x=>Number(x.id)===Number(p.id));
    if(!f)return '<article class="smile-player"><h3>🏴‍☠️ '+safe(p.name)+'</h3><p class="smile-pending">🪙 En attente de son lancer…</p></article>';
    if(!f.charId)return '<article class="smile-player"><h3>🏴‍☠️ '+safe(p.name)+'</h3><p>Aucune recrue à transformer.</p></article>';
    const c=CARDS[f.charId],initial=Number(f.before),final=Number(f.after),delta=final-initial;
    const positive=!!f.pile,sign=positive?'+25':'−25',escapedId=safe(f.charId);
    return '<article class="smile-player '+(positive?'smile-plus':'smile-minus')+'">'+
      '<h3>🏴‍☠️ '+safe(p.name)+'</h3>'+
      '<div class="smile-character-line"><div class="smile-avatar"><span class="portrait-fallback">☠️</span>'+
      '<img class="portrait-photo" data-portrait-id="'+escapedId+'" alt="" loading="eager"></div>'+
      '<div class="smile-character-info"><strong>'+safe(c?.name||f.charId)+'</strong>'+
      '<span class="smile-coin-result">'+(positive?'🪙 PILE':'🪙 FACE')+' · <b>'+sign+' points</b></span>'+
      '<span class="smile-evolution">'+initial+' <span aria-hidden="true">→</span> <strong>'+final+' / 100</strong></span></div></div>'+
      '<p class="smile-consequence">'+(positive?'🟢 Bonus':'🔴 Malus')+' SMILE : '+
      (delta>=0?'+':'')+delta+' points réellement appliqués'+
      (Math.abs(delta)!==25?' (limite de puissance 0–100)':'')+'</p></article>';
  }).join('');
  return '<section class="smile-results" aria-label="Résultats de SMILE">'+
    '<p class="smile-results-intro">🍎 Résultat du pile ou face pour chaque pirate. La puissance de sa recrue la plus faible peut augmenter ou diminuer.</p>'+
    rows+'</section>';
}
window.OPMERCATO_SMILE_SUMMARY=Object.freeze({render});
const css=document.createElement('style');
css.textContent=`
 .smile-results{display:grid;gap:12px;width:100%;max-width:670px;margin:14px auto 20px;text-align:left}
 .smile-results-intro{font-size:13px;color:#d9e6e8;text-align:center;line-height:1.6}
 .smile-player{background:#132e40;border:1px solid #627e8c;border-radius:17px;padding:15px 12px;min-width:0}
 .smile-player.smile-plus{border-color:#65a88c;background:linear-gradient(135deg,#174436,#102d3c)}
 .smile-player.smile-minus{border-color:#d38b91;background:linear-gradient(135deg,#4a2637,#142b3d)}
 .smile-player h3{font-size:15px;color:#ffe0a2;margin:0 0 12px;line-height:1.3}
 .smile-character-line{display:flex;gap:13px;align-items:center;min-width:0}
 .smile-avatar{position:relative;width:72px;height:72px;min-width:72px;border:2px solid #e4c17e;border-radius:50%;overflow:hidden;background:#264a5e;flex:none}
 .smile-avatar>.portrait-photo{display:block!important;position:absolute!important;inset:0!important;width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;object-fit:cover!important;object-position:center 22%!important;border-radius:50%!important}
 .smile-avatar>.portrait-fallback{position:absolute;inset:0;display:grid;place-items:center;font-size:22px}
 .smile-character-info{display:grid;align-content:center;gap:7px;min-width:0}
 .smile-character-info>strong{font-size:16px;color:#f7f3e7;line-height:1.3;overflow-wrap:anywhere}
 .smile-coin-result{font-size:12px;color:#ffdea6;line-height:1.4;font-weight:800}
 .smile-plus .smile-coin-result b{color:#b8ffcf}
 .smile-minus .smile-coin-result b{color:#ffb8c1}
 .smile-evolution{font-size:14px;color:#d9e7ec}
 .smile-evolution strong{color:#fff1ba;font-size:20px}
 .smile-consequence{font-size:11px!important;color:#cbdbe4!important;margin:13px 0 0;padding-top:10px;border-top:1px solid #ffffff35;line-height:1.5}
 .smile-pending{color:#a8c7d1}
 #opmercato-online .smile-results .smile-player{padding:15px 12px}
 #opmercato-online .smile-character-info>strong{font-size:16px}
 #opmercato-online .smile-evolution strong{font-size:20px}
 @media(max-width:350px){.smile-avatar{width:58px;height:58px;min-width:58px}.smile-character-line{gap:9px}.smile-character-info>strong{font-size:14px}}
`;
document.head.appendChild(css);
})();
