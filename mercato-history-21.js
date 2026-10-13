// OPMercato 2.1 — Archives privées des parties en ligne.
(function(){
  'use strict';
  const KEY='opmercato-online-archive-v21';
  const SESSION='opmercato-online-session-v1';
  const API='https://nezqupnhcqwuewfilioa.supabase.co/functions/v1/opmercato-online';
  const SBKEY='sb_publishable_rLlu872lFwupJfFw_f3alw_GhbR7Mok';
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=x=>{try{return BigInt(x||0).toLocaleString('fr-FR')+' ฿';}catch{return '0 ฿';}};
  let saved=[];try{saved=JSON.parse(localStorage.getItem(KEY)||'[]');if(!Array.isArray(saved))saved=[];}catch{}
  const overlay=document.createElement('section');overlay.id='op21-archives';overlay.hidden=true;document.body.appendChild(overlay);
  function track(s){
    if(!s?.roomId||!/^[0-9a-f]{64}$/.test(s.token||''))return;
    saved=[{roomId:s.roomId,token:s.token},...saved.filter(x=>x.roomId!==s.roomId)].slice(0,50);
    try{localStorage.setItem(KEY,JSON.stringify(saved));}catch{}
  }
  try{track(JSON.parse(localStorage.getItem(SESSION)||'null'));}catch{}
  function result(m){
    const ordered=[...m.players].sort((a,b)=>b.score-a.score||(BigInt(b.budget)>BigInt(a.budget)?1:BigInt(b.budget)<BigInt(a.budget)?-1:0));
    const tied=ordered.filter(p=>p.score===ordered[0].score&&p.budget===ordered[0].budget);
    return tied.length>1?(tied.some(p=>p.id===m.seat)?'Égalité':'Défaite'):(ordered[0].id===m.seat?'Victoire':'Défaite');
  }
  function graph(matches){
    const ms=matches.slice(0,12).reverse();if(!ms.length)return '';
    const path=fn=>ms.map((m,i)=>{
      const x=28+300*i/Math.max(1,ms.length-1);
      const y=116-Math.min(100,Math.max(0,Number(fn(m))||0))*.98;
      return x.toFixed(1)+','+y.toFixed(1);
    }).join(' ');
    return '<section class="op21-graph"><strong>Évolution de la puissance moyenne</strong>'+
      '<svg viewBox="0 0 350 135" role="img" aria-label="Puissances moyennes des équipages, 12 derniers matchs">'+
      '<path d="M28 16V116H344" fill="none" stroke="#92acb6"/>'+
      [0,25,50,75,100].map(n=>'<text x="3" y="'+(119-n*.98)+'" fill="#c5d8e0" font-size="10">'+n+'</text>').join('')+
      '<polyline points="'+path(m=>Math.max(0,...m.players.filter(p=>p.id!==m.seat).map(p=>p.averagePower)))+'" stroke="#bba1db" fill="none" stroke-width="2.8" stroke-linejoin="round"/>'+
      '<polyline points="'+path(m=>m.players.find(p=>p.id===m.seat)?.averagePower||0)+'" stroke="#ffd282" fill="none" stroke-width="3.4" stroke-linejoin="round"/>'+
      '</svg><small><span>● Ton équipage</span><span>● Meilleur adversaire</span></small></section>';
  }
  function render(matches,err=''){
    const wins=matches.filter(m=>result(m)==='Victoire').length;
    const draws=matches.filter(m=>result(m)==='Égalité').length;
    const avg=matches.length?(matches.reduce((n,m)=>n+(m.players.find(p=>p.id===m.seat)?.averagePower||0),0)/matches.length).toFixed(1):'0';
    overlay.innerHTML='<div class="op21-archive-shell"><header><div><small>🏴‍☠️ LE JOURNAL DE BORD</small><h2>📜 Archives des Pirates</h2></div><button data-op21-close>✕</button></header>'+
      '<p class="op21-note">Les parties sont conservées sur Supabase et consultables avec les accès aux salons enregistrés sur cet iPhone.</p>'+
      (err?'<p class="op21-error">'+esc(err)+'</p>':'')+
      '<div class="op21-kpis"><div><b>'+matches.length+'</b><small>Parties</small></div><div><b>'+wins+'</b><small>Victoires</small></div>'+
      '<div><b>'+draws+'</b><small>Égalités</small></div><div><b>'+avg+'</b><small>Puissance moy.</small></div></div>'+
      graph(matches)+'<h3>Résultats des matchs</h3>'+
      (matches.map(m=>{
        const mine=m.players.find(p=>p.id===m.seat),r=result(m),date=new Date(m.finishedAt).toLocaleDateString('fr-FR');
        const ranked=[...m.players].sort((a,b)=>b.score-a.score||(BigInt(b.budget)>BigInt(a.budget)?1:-1));
        return '<details class="op21-match"><summary><span><strong>'+esc(date)+' · '+esc(m.code)+'</strong><small>'+
          esc(mine?.name||'Pirate')+' · '+(mine?.score||0)+' pts · '+m.round+' enchères</small></span>'+
          '<em class="'+(r==='Victoire'?'win':r==='Défaite'?'loss':'tie')+'">'+r+'</em></summary>'+
          '<p>🏆 '+(ranked[0]?esc(ranked[0].name):'—')+' · '+m.teamSize+' recrues prévues par joueur</p>'+
          m.players.map(p=>'<section class="op21-player"><strong>'+esc(p.name)+' — '+p.score+' points</strong>'+
            '<span>Puissance moyenne : <b>'+p.averagePower+'</b> · Total recrues : '+p.basePower+'</span>'+
            '<span>'+p.roster.length+' recrutés · Dépenses : '+money(p.spent)+' · Reste : '+money(p.budget)+'</span>'+
            '<span>Synergies +'+p.synergy+' · Armement +'+p.armamentBonus+'</span>'+
            (p.strongest?'<span>💥 Meilleure recrue : '+esc(p.strongest.name)+' ('+p.strongest.power+' pts)</span>':'')+
            '<div class="op21-roster">'+p.roster.map(c=>'<span>'+esc(c.name)+' ('+c.power+')</span>').join('')+'</div></section>').join('')+'</details>';
      }).join('')||'<p>Aucune partie terminée dans les salons conservés sur cet appareil. Tes prochaines parties apparaîtront ici.</p>')+
      '<button class="op21-refresh" data-op21-refresh>↻ Actualiser les archives</button></div>';
  }
  async function open(){
    overlay.hidden=false;overlay.innerHTML='<div class="op21-archive-shell"><p>📜 Chargement des archives…</p><button data-op21-close>Fermer</button></div>';
    try{
      const response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json',apikey:SBKEY},
        body:JSON.stringify({action:'history',entries:saved}),signal:AbortSignal.timeout(15000)});
      const data=await response.json();
      if(!response.ok||data.error)throw Error(data.error||'Archives indisponibles');
      render(Array.isArray(data.matches)?data.matches:[]);
    }catch(e){render([],e.message||'Impossible de charger les archives.');}
  }
  overlay.addEventListener('click',e=>{
    if(e.target.closest('[data-op21-close]'))overlay.hidden=true;
    if(e.target.closest('[data-op21-refresh]'))open();
  });
  const css=document.createElement('style');css.textContent=`
    #op21-archives[hidden]{display:none!important}
    #op21-archives{position:fixed;inset:0;z-index:1800;overflow-y:auto;overscroll-behavior:contain;background:#071a27;color:#edf3f5}
    .op21-archive-shell{max-width:740px;margin:auto;padding:calc(env(safe-area-inset-top) + 15px) 14px calc(env(safe-area-inset-bottom) + 30px)}
    .op21-archive-shell>header{display:flex;align-items:center;justify-content:space-between;gap:10px}
    .op21-archive-shell header small{color:#f6c677;font-size:11px;letter-spacing:.1em}
    .op21-archive-shell h2{font-size:25px;margin:8px 0}.op21-archive-shell h3{margin-top:24px}
    .op21-archive-shell button{cursor:pointer;color:#ffe2ab;background:#1a384a;border:1px solid #a18353;border-radius:10px;padding:11px;font-weight:800}
    .op21-note{font-size:12px;color:#b9cdd7;line-height:1.5}.op21-error{color:#ffb4a6}
    .op21-kpis{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
    .op21-kpis>div{display:grid;gap:5px;text-align:center;padding:13px 5px;border:1px solid #4b6777;border-radius:12px;background:#112d3e}
    .op21-kpis b{font-size:24px;color:#ffd388}.op21-kpis small{font-size:11px}
    .op21-graph{border:1px solid #607480;background:#112b3b;border-radius:14px;padding:14px 8px;margin:18px 0}
    .op21-graph strong{font-size:13px}.op21-graph svg{display:block;width:100%}
    .op21-graph small{display:flex;gap:20px;justify-content:center;font-size:11px}
    .op21-graph small span:first-child{color:#ffd282}.op21-graph small span:last-child{color:#bba1db}
    .op21-match{border:1px solid #536c7d;background:#102c3e;border-radius:12px;padding:12px;margin-bottom:10px}
    .op21-match summary{display:flex;align-items:center;justify-content:space-between;gap:10px;list-style:none;cursor:pointer}
    .op21-match summary::-webkit-details-marker{display:none}
    .op21-match summary span{display:grid;gap:5px}.op21-match summary small{font-size:11px;color:#b7cfda}
    .op21-match em{font-style:normal;font-size:11px;font-weight:850;border-radius:7px;padding:6px;color:#e6eefd;background:#435265}
    .op21-match em.win{background:#235c48;color:#affbd0}.op21-match em.loss{background:#673944;color:#ffc1c1}.op21-match em.tie{background:#574d27;color:#fff0a1}
    .op21-match>p{font-size:12px}
    .op21-player{border-top:1px solid #ffffff2b;margin-top:9px;padding:12px 0;display:grid;gap:6px;font-size:12px}
    .op21-player strong{color:#ffd283}.op21-roster{display:flex;flex-wrap:wrap;gap:4px}
    .op21-roster span{background:#2a5061;border-radius:8px;padding:5px 7px;font-size:10px}
    .op21-refresh{width:100%;margin-top:20px}
  `;document.head.appendChild(css);
  window.OP21_HISTORY={track,open};
})();