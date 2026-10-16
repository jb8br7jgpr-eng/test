(function installRosterSummary(){
  'use strict';
  // Interface commune aux modes local et en ligne ; ne modifie aucun score ni aucune sauvegarde.
  const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clamp=x=>Math.min(100,Math.max(0,x));
  const num=x=>{const n=Number(x);return Number.isFinite(n)?n:0;};
  const signed=x=>x<0?'−'+Math.abs(x):x>0?'+'+x:'0';
  const affiliation=id=>window.MERCATO_EXPANSION?.details?.[id]?.crew?.trim()||'Affiliation non renseignée';
  const rank=x=>x>=95?'S':x>=80?'A':x>=65?'B':x>=50?'C':x>=35?'D':x>=20?'E':'F';
  function effects(p,id,v3){
    const base=num(CARDS[id]?.power);
    const smile=Object.prototype.hasOwnProperty.call(p.smileModifiers||{},id)?num(p.smileModifiers[id]):null;
    const red=v3?num(p.shipBonus?.[id]):0;
    const arm=v3&&p.armamentId===id?num(p.armamentBonus):0;
    const modifiers=[];
    if(smile!==null)modifiers.push({text:'🍎 SMILE '+signed(smile),value:smile,kind:smile<0?'negative':smile>0?'positive':'neutral'});
    if(red)modifiers.push({text:'🐉 Terre Sainte '+signed(red),value:red,kind:'positive'});
    if(arm)modifiers.push({text:'🛡️ Haki de l’Armement '+signed(arm),value:arm,kind:'positive'});
    const raw=base+(smile||0)+red+arm,final=clamp(raw);
    return {base,final,raw,modifiers};
  }
  function character(p,id,{v3=false,online=false}={}){
    const c=CARDS[id];if(!c)return '';
    const fx=effects(p,id,v3),name=escape(c.name),safeId=escape(id);
    const modifierHtml=fx.modifiers.length?
      fx.modifiers.map(m=>'<span class="oprs-effect oprs-'+m.kind+'">'+escape(m.text)+'</span>').join(''):
      '<span class="oprs-no-effect">Aucun bonus ou malus</span>';
    const formula=fx.modifiers.map(m=>' '+(m.value>=0?'+ ':'− ')+Math.abs(m.value)).join('');
    return '<button type="button" class="oprs-character" '+(online?'data-online':'data-action')+'="details" data-char-id="'+safeId+'" aria-label="Fiche de '+name+', puissance '+fx.final+' sur 100">'+
      '<span class="oprs-portrait portrait portrait-tiny"><span class="portrait-fallback">☠️</span>'+
      '<img class="portrait-photo" data-portrait-id="'+safeId+'" alt="" loading="lazy"></span>'+
      '<span class="oprs-character-main"><span class="oprs-character-title">'+name+
      '<span class="oprs-rank">Rang '+rank(fx.base)+'</span></span>'+
      '<span class="oprs-affiliation">'+escape(affiliation(id))+'</span>'+
      '<span class="oprs-modifiers">'+modifierHtml+'</span>'+
      '<span class="oprs-formula">Base '+fx.base+formula+' = <b>'+fx.final+'</b> / 100'+(fx.raw!==fx.final?' · Limite 0–100':'')+'</span></span>'+
      '<span class="oprs-character-score"><b>'+fx.final+'</b><small>/100</small></span></button>';
  }
  function affiliationBonuses(p){
    const counts=new Map();
    for(const id of p.roster||[]){const crew=affiliation(id);if(crew==='Affiliation non renseignée')continue;counts.set(crew,(counts.get(crew)||0)+1);}
    return [...counts].map(([name,count])=>({name,count,points:count>=5?50:count>=2?(count-1)*10:0}))
      .filter(x=>x.points>0).sort((a,b)=>b.points-a.points||a.name.localeCompare(b.name,'fr'));
  }
  function totals(p,{v3=false,online=false,score=null,losses=[]}={}){
    const members=(p.roster||[]).filter(id=>CARDS[id]);
    const base=members.reduce((n,id)=>n+effects(p,id,v3).final,0);
    const bonuses=online&&Array.isArray(p.bonuses)?p.bonuses:affiliationBonuses(p);
    const synergy=bonuses.reduce((s,b)=>s+num(b.points),0);
    // Dans les anciennes parties V2, l'Armement est un bonus global ; en V3 il est inclus dans la recrue.
    const oldArm=!v3&&p.armamentId&&members.includes(p.armamentId)?num(p.armamentBonus||5):0;
    const final=score===null?base+synergy+oldArm:num(score);
    const synergyLines=bonuses.length?bonuses.map(b=>
      '<div class="oprs-bonus-row"><span>🤝 '+escape(b.name)+' <small>('+num(b.count)+' personnages)</small></span><strong>+'+num(b.points)+'</strong></div>').join(''):
      '<p class="oprs-empty-bonuses">Aucune synergie active</p>';
    const lost=(losses||[]).filter(x=>Number(x.from)===Number(p.id)&&CARDS[x.id]);
    return '<div class="oprs-calculation" aria-label="Calcul du score de '+escape(p.name)+'">'+
      '<div class="oprs-score-label">Calcul des points</div>'+
      '<div class="oprs-bonus-row"><span>⚔️ Puissance des recrues ('+members.length+')</span><strong>'+base+'</strong></div>'+
      '<div class="oprs-synergy-title">Synergies d’affiliation</div>'+synergyLines+
      (!v3&&oldArm?'<div class="oprs-bonus-row"><span>🛡️ Haki de l’Armement (ancien mode)</span><strong>+'+oldArm+'</strong></div>':'')+
      '<div class="oprs-grand-total"><span>⭐ Score total</span><strong>'+final+' pts</strong></div>'+
      (lost.length?'<div class="oprs-losses"><strong>💥 Pertes à God Valley</strong>'+
        lost.map(x=>'<span>− '+escape(CARDS[x.id].name)+' (recrue éliminée)</span>').join('')+'</div>':'')+
      '</div>';
  }
  function crew(p,{v3=false,online=false,score=null,losses=[]}={}){
    return '<div class="oprs-roster">'+(p.roster?.length?p.roster.map(id=>character(p,id,{v3,online})).join(''):
      '<p class="oprs-empty">Aucune recrue dans cet équipage.</p>')+'</div>'+
      totals(p,{v3,online,score,losses});
  }
  window.OPMERCATO_ROSTER_SUMMARY=Object.freeze({crew,character,effects,totals});
  const previousScoreBoard=scoreBoard;
  scoreBoard=function(){
    if(!state)return previousScoreBoard();
    const v3=!!state.v3;
    const f=state.featureConfig||{};
    const losses=f.godLosses?.length?f.godLosses:(f.active?.type==='god'?f.active.removed||[]:[]);
    return '<div class="section-heading"><h2>Les équipages</h2><small>'+TEAM_SIZE+' places par joueur</small></div>'+
      '<section class="score-list">'+state.players.map((p,i)=>
        '<article class="player-card oprs-team"><div class="player-header">'+
          '<div class="identity"><div class="avatar" style="--avatar-bg:'+AVATARS[i%AVATARS.length]+'">'+
          escape(p.name?.trim().slice(0,1).toUpperCase()||'P')+'</div><div>'+
          '<strong>'+escape(p.name)+'</strong><small>'+currency(p.budget)+' restants · '+p.roster.length+'/'+TEAM_SIZE+' recrutés</small>'+
          '</div></div><div class="player-score"><b>'+getScore(p)+'</b><small>POINTS</small></div></div>'+
          '<div class="oprs-status">⏭️ Refus '+num(p.passesUsed)+'/'+(p.ship==='sunny'?8:5)+
          ' <span>👑 Rois '+(p.hakiUsed?'utilisé':'prêt')+'</span>'+
          ' <span>👁 Observation '+(p.observationUsed?'utilisée':'prête')+'</span>'+
          ' <span>🛡 Armement '+(p.armamentUsed?'utilisé':'prêt')+'</span></div>'+
          crew(p,{v3,score:getScore(p),losses})+
          (num(p.marineAward)>0?'<div class="oprs-finance">🎲 Prime de la Marine : '+currency(p.marineAward)+' (Berrys, sans points de puissance)</div>':'')+
          '</article>').join('')+'</section>';
  };
  const css=document.createElement('style');
  css.textContent=`
    .oprs-team{min-width:0;overflow:hidden}
    .oprs-team .player-header{gap:8px}.oprs-team .identity{min-width:0}
    .oprs-team .identity>div:last-child{min-width:0}
    .oprs-team .identity strong{overflow-wrap:anywhere}
    .oprs-team .identity small{white-space:normal;overflow-wrap:anywhere}
    .oprs-team .player-score{flex:none}
    .oprs-status{display:flex;gap:5px 10px;flex-wrap:wrap;margin:11px 0 6px;font-size:10px;line-height:1.5;color:#acc6d3}
    .oprs-roster{display:grid;grid-template-columns:minmax(0,1fr);gap:8px;margin-top:13px;width:100%;min-width:0}
    .oprs-character{display:grid;grid-template-columns:44px minmax(0,1fr) auto;align-items:start;gap:11px;width:100%;min-width:0;padding:11px;border:1px solid #446679;border-radius:13px;background:#102c3d;color:#eef4f3;text-align:left;overflow:hidden;box-sizing:border-box}
    .oprs-character:focus-visible{outline:2px solid #f7ca72;outline-offset:2px}
    .oprs-portrait.portrait{display:block;position:relative;width:44px!important;height:55px!important;min-width:44px!important;min-height:55px!important;border-radius:8px!important;overflow:hidden;padding:0!important;background:#234b5b!important}
    .oprs-portrait .portrait-photo{width:100%;height:100%;object-fit:cover;display:block}
    .oprs-character-main{display:grid;min-width:0;gap:5px}
    .oprs-character-title{display:flex;align-items:baseline;gap:5px 8px;flex-wrap:wrap;font-size:14px;font-weight:850;line-height:1.3;overflow-wrap:anywhere}
    .oprs-rank{font-size:10px;font-weight:800;color:#d7b77c;white-space:nowrap}
    .oprs-affiliation{font-size:11px;color:#a8c5d1;overflow-wrap:anywhere;line-height:1.35}
    .oprs-modifiers{display:flex;flex-wrap:wrap;gap:5px;min-width:0}
    .oprs-effect,.oprs-no-effect{font-size:10px;line-height:1.3;white-space:normal;overflow-wrap:anywhere;border-radius:6px;padding:4px 6px;border:1px solid transparent}
    .oprs-positive{color:#bff6d7;background:#154736;border-color:#427b65}
    .oprs-negative{color:#ffbbb7;background:#482a34;border-color:#995864}
    .oprs-neutral{color:#dae4eb;background:#294154;border-color:#647d8b}
    .oprs-no-effect{color:#879fae;padding-left:0}
    .oprs-formula{font-size:10px;color:#becfda;line-height:1.45;overflow-wrap:anywhere}
    .oprs-formula b{color:#ffe0a0}
    .oprs-character-score{display:grid;justify-items:end;align-content:start;min-width:39px;padding-top:1px}
    .oprs-character-score>b{color:#f5cb7b;font-size:22px;line-height:1.1;font-weight:950}
    .oprs-character-score>small{font-size:10px;color:#adc7d1}
    .oprs-calculation{min-width:0;margin-top:13px;padding:13px 12px;border:1px solid #566d73;border-radius:13px;background:#0b2635}
    .oprs-score-label,.oprs-synergy-title{font-size:11px;text-transform:uppercase;letter-spacing:.07em;font-weight:850;color:#d5e3eb;margin:0 0 8px}
    .oprs-synergy-title{margin:12px 0 7px;padding-top:10px;border-top:1px solid #ffffff25}
    .oprs-bonus-row{display:flex;align-items:baseline;justify-content:space-between;gap:10px;font-size:12px;line-height:1.45;margin:6px 0;color:#dceaf0}
    .oprs-bonus-row span{min-width:0;overflow-wrap:anywhere}
    .oprs-bonus-row strong{flex:none;color:#bcebd2;white-space:nowrap}
    .oprs-bonus-row small{font-size:10px;color:#a0b8bf}
    .oprs-empty-bonuses,.oprs-empty{font-size:11px;color:#a8c0cc;margin:9px 0}
    .oprs-grand-total{display:flex;justify-content:space-between;align-items:baseline;gap:9px;margin-top:13px;padding-top:12px;border-top:1px solid #f7ca7260;font-size:14px;font-weight:900;color:#ffe4a4}
    .oprs-grand-total strong{font-size:21px;white-space:nowrap}
    .oprs-losses{display:grid;gap:5px;border-top:1px solid #ffffff25;margin-top:13px;padding-top:12px;color:#ffc5c0;font-size:11px}
    .oprs-finance{font-size:10px;color:#b6d3d9;margin-top:11px}
    #opmercato-online .online-team .oprs-roster{display:grid;gap:8px}
    #opmercato-online .online-team .oprs-character{border-radius:13px}
    #opmercato-online .online-team .oprs-character span{background:transparent;padding:0;font-size:inherit;border-radius:0}
    #opmercato-online .online-team .oprs-character .oprs-effect{font-size:10px;padding:4px 6px;border-radius:6px}
    #opmercato-online .online-team .oprs-character .oprs-positive{background:#154736;color:#bff6d7;border-color:#427b65}
    #opmercato-online .online-team .oprs-character .oprs-negative{background:#482a34;color:#ffbbb7;border-color:#995864}
    #opmercato-online .online-team .oprs-character .oprs-neutral{background:#294154;color:#dae4eb;border-color:#647d8b}
    #opmercato-online .online-team .oprs-character .oprs-no-effect{font-size:10px}
    #opmercato-online .online-team .oprs-character .oprs-portrait{background:#234b5b!important}
    #opmercato-online .online-team .oprs-character .oprs-character-score>b{font-size:22px}
    #opmercato-online .online-team .oprs-character .oprs-character-title{font-size:14px}
    #opmercato-online .online-team .oprs-character .oprs-affiliation{font-size:11px}
    #opmercato-online .online-team .oprs-character .oprs-formula{font-size:10px}
    #opmercato-online .online-team .oprs-character .oprs-rank{font-size:10px}
    @media(max-width:360px){.oprs-character{grid-template-columns:36px minmax(0,1fr) auto;gap:7px;padding:9px 7px}.oprs-portrait.portrait{width:36px!important;height:46px!important;min-width:36px!important;min-height:46px!important}.oprs-character-score>b{font-size:19px}}
  `;
  document.head.appendChild(css);
})();
