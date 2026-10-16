// OPMercato 2.1 — HUD compact, visible pendant les enchères locales.
(function(){
  'use strict';
  const style=document.createElement('style');
  style.textContent=`
    .op21-local-hud{position:sticky;top:env(safe-area-inset-top,0px);z-index:35;
      display:flex;gap:3px;overflow-x:auto;overscroll-behavior-x:contain;
      margin:5px 0 13px;padding:7px 5px;background:#091e2bf5;
      border:1px solid #c69b5d;border-radius:13px;box-shadow:0 8px 18px #0016;
      backdrop-filter:blur(12px);scrollbar-width:thin}
    .op21-local-hud .op21-hud-item{flex:1 0 105px;min-width:0;text-align:center;padding:3px 6px;
      display:grid;gap:3px;color:#e9f3f5;border-right:1px solid #ffffff2b}
    .op21-local-hud .op21-hud-item:last-child{border:0}
    .op21-hud-item .op21-hud-name{font-weight:900;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .op21-hud-item .op21-hud-money{font-size:clamp(11px,2.8vw,15px);font-weight:950;color:#f9d68f;overflow-wrap:anywhere}
    .op21-hud-item .op21-hud-stats{font-size:10px;color:#bcd6df}
    @media(min-width:800px){.op21-local-hud{top:0}.op21-local-hud .op21-hud-item{flex-basis:150px}}
  `;
  document.head.appendChild(style);
  const original=render;
  render=function(){
    original();
    if(!state||state.phase!=='auction')return;
    const top=app.querySelector('.topbar');if(!top||app.querySelector('.op21-local-hud'))return;
    const hud='<div class="op21-local-hud" aria-label="Budgets et points des pirates">'+
      state.players.map(p=>'<div class="op21-hud-item"><span class="op21-hud-name">'+esc(p.name)+'</span>'+
        '<strong class="op21-hud-money">'+currency(p.budget)+'</strong>'+
        '<small class="op21-hud-stats">⭐ '+getScore(p)+' pts · '+p.roster.length+'/'+TEAM_SIZE+'</small>'+(p.ship?'<small><img src="./opmercato-ships-sprite.webp" alt="" style="width:24px;height:24px;border-radius:50%;object-fit:cover;object-position:'+({sunny:0,redforce:25,mobydick:50,polartang:75,orojackson:100}[p.ship]||0)+'% 50%;vertical-align:middle;margin-right:4px">'+esc(({sunny:(8-p.passesUsed)+' refus',redforce:'Actif',mobydick:'−10 %',polartang:p.armamentUsed?'Utilisé':'Prêt',orojackson:p.observationUsed?'Utilisé':'Prêt'})[p.ship]||'')+'</small>':'')+'</div>').join('')+'</div>';
    top.insertAdjacentHTML('afterend',hud);
  };
  render();
})();