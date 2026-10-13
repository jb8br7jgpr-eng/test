(function enhanceMercato() {
  'use strict';
  const version = 2;
  const synergies = [
    {id:'trio-monstre',name:'Trio monstrueux',ids:['luffy','zoro','sanji'],points:15},
    {id:'roger-crew',name:'Légendes de Roger',ids:['roger','rayleigh','gaban'],points:20},
    {id:'beasts',name:'Trois calamités',ids:['kaido','king','queen'],points:15},
    {id:'brothers',name:'Frères de fraternité',ids:['ace','sabo','luffy'],points:20}
  ];
  const getPlayerBonuses=p=>{
    const owned=new Set(p?.roster||[]);
    return synergies.filter(x=>x.ids.every(id=>owned.has(id)));
  };
  const getBreakdown=p=>{
    const base=(p.roster||[]).reduce((sum,id)=>sum+(CARDS[id]?.power||0),0);
    const armament=p.armamentId&&p.roster.includes(p.armamentId)?5:0;
    const synergyItems=getPlayerBonuses(p);
    const synergy=synergyItems.reduce((sum,x)=>sum+x.points,0);
    return {base,armament,synergy,synergyItems,total:base+armament+synergy};
  };
  getScore=function(p){return getBreakdown(p).total;};

  function normalized() {
    if(!state)return;
    for(const p of state.players) {
      if(typeof p.observationUsed!=='boolean')p.observationUsed=false;
      if(typeof p.armamentUsed!=='boolean')p.armamentUsed=!!p.armamentId;
      if(!p.purchases || typeof p.purchases!=='object')p.purchases={};
      if(typeof p.marineAward!=='string')p.marineAward='0';
    }
    if(!state.initialBudget)state.initialBudget=String(state.players[0]?.budget||'1000');
    if(!state.featureConfig) {
      const remaining=Math.max(1,state.players.length*TEAM_SIZE);
      // Déclenchement tôt pour que les petites équipes puissent vivre les événements.
      const mysteryAt=state.round+Math.min(2,Math.max(1,Math.floor(remaining/3)));
      const eventAt=state.round+Math.min(2,Math.max(1,Math.floor(remaining/4)));
      const plan=Math.random()<.5?'war':'marine';
      state.featureConfig={version,eventType:plan,eventRound:eventAt,mysteryRound:mysteryAt,eventUsed:false,mysteryUsed:false,warRounds:[]};
      if(plan==='war') {
        if(!prepareWarCards(eventAt)){
          state.featureConfig.eventType='marine';
        }
      }
    }
  }
  function prepareWarCards(eventRound) {
    const start=state.drawIndex+(eventRound-(state.round+1));
    if(start<0||start+1>=state.drawPile.length)return false;
    for(let offset=0;offset<2;offset++){
      const target=start+offset;
      if(tierOf(CARDS[state.drawPile[target]]?.power||0).tier==='S')continue;
      let from=-1;
      for(let i=target+1;i<state.drawPile.length;i++) {
        if(tierOf(CARDS[state.drawPile[i]]?.power||0).tier==='S'){from=i;break;}
      }
      if(from<0)return false;
      [state.drawPile[target],state.drawPile[from]]=[state.drawPile[from],state.drawPile[target]];
    }
    return true;
  }
  const oldSave=save;
  save=function(){
    if(state){
      for(const p of state.players){
        if(!p.purchases || typeof p.purchases!=='object')p.purchases={};
      }
      const a=state.auction;
      if(a?.outcome==='sold'&&a.leader!==null&&a.leader!==undefined){
        const p=player(a.leader);
        if(p&&p.roster.includes(a.charId)&&!Object.prototype.hasOwnProperty.call(p.purchases,a.charId)){
          p.purchases[a.charId]=a.hakiWinner===a.leader?'0':String(a.highBid||0);
        }
      }
    }
    oldSave();
  };
  if(state){normalized();save();}

  const oldStart=start;
  start=function(){
    const prev=state;
    oldStart();
    if(state&&state!==prev){
      // L'initialisation a déjà lieu lors du premier drawNext() appelé par oldStart().
      normalized();save();render();
    }
  };

  function safeBig(value) {try{return BigInt(value??0);}catch(e){return 0n;}}
  function marineEvent() {
    const f=state.featureConfig;
    f.rolls=[];
    for(const p of state.players){
      const roll=1+Math.floor(Math.random()*6);
      const percent=roll*5;
      const amount=safeBig(state.initialBudget)*BigInt(percent)/100n;
      p.budget=(safeBig(p.budget)+amount).toString();
      p.marineAward=amount.toString();
      p.marineRoll=roll;
      f.rolls.push({id:p.id,roll,percent,amount:amount.toString()});
    }
  }

  const oldDrawNext=drawNext;
  drawNext=function(){
    if(!state)return oldDrawNext();
    normalized();
    if(state.phase==='finished'||isComplete()||state.drawIndex>=state.drawPile.length)
      return oldDrawNext();
    const f=state.featureConfig;
    const nextRound=state.round+1;
    const isEvent=!f.eventUsed&&nextRound>=f.eventRound;
    const mystery=!f.mysteryUsed&&nextRound>=f.mysteryRound;
    if(isEvent){
      f.eventUsed=true;
      f.activatedRound=nextRound;
      if(f.eventType==='marine')marineEvent();
      else f.warRounds=[nextRound,nextRound+1];
    }
    if(mystery){f.mysteryUsed=true;}
    oldDrawNext();
    if(state.phase==='auction'&&state.auction){
      state.auction.mystery=Boolean(mystery);
      state.auction.warGuaranteed=Boolean(f.warRounds?.includes(state.round));
      save();render();
    }
  };

  function currentPlayer() {
    const a=state?.auction;
    return a&&a.outcome===null&&a.turnId!==null?player(a.turnId):null;
  }
  function observation(){
    const p=currentPlayer();
    if(!p||p.observationUsed)return showToast('Haki de l’Observation indisponible.');
    p.observationUsed=true;save();render();
    const upcoming=state.drawPile.slice(state.drawIndex,state.drawIndex+3);
    const content=upcoming.map((id,i)=>{
      const c=CARDS[id];
      const hidden=state.featureConfig?.mysteryRound===state.round+i+1 && !state.featureConfig?.mysteryUsed;
      return '<li>'+(i+1)+'. '+(hidden?'🔒 Enchère mystère, classe '+tierOf(c.power).tier:esc(c.name)+' · classe '+tierOf(c.power).tier)+'</li>';
    }).join('')||'<li>Aucun personnage restant.</li>';
    modal.innerHTML='<section class="card modal-content"><span class="eyebrow">👁 Haki de l’Observation</span><h2>Les 3 prochaines cartes</h2><p>Regarde discrètement, puis ferme la fenêtre avant de passer le téléphone.</p><ul>'+content+'</ul><p>Ce pouvoir est maintenant consommé pour '+esc(p.name)+'.</p><button class="primary" data-action="close-modal">Refermer les visions</button></section>';
    modal.classList.remove('hidden');
  }
  function openArmament(){
    const p=currentPlayer();
    if(!p||p.armamentUsed||p.roster.length===0)return showToast('Aucun personnage éligible au Haki de l’Armement.');
    modal.innerHTML='<section class="card modal-content"><span class="eyebrow">🛡 Haki de l’Armement</span><h2>Renforcer une recrue</h2><p>Choisis un de tes personnages : il gagne définitivement <strong>+5 points</strong>. Une seule utilisation par joueur.</p><div class="armament-choices">'+p.roster.map(id=>'<button data-action="armament-choose" data-char-id="'+esc(id)+'" class="btn-ghost">'+esc(CARDS[id]?.name||id)+' · '+(CARDS[id]?.power||0)+' → '+((CARDS[id]?.power||0)+5)+' pts</button>').join('')+'</div><button class="pass-btn" data-action="close-modal">Annuler</button></section>';
    modal.classList.remove('hidden');
  }
  function useArmament(id){
    const p=currentPlayer();
    if(!p||p.armamentUsed||!p.roster.includes(id))return showToast('Choix impossible.');
    p.armamentUsed=true;
    p.armamentId=id;
    save();closeModal();render();
    showToast('🛡 '+CARDS[id].name+' gagne +5 points !');
  }

  const oldAuction=auctionScreen;
  auctionScreen=function(){
    if(!state||state.phase!=='auction')return oldAuction();
    const a=state.auction;
    let html=oldAuction();
    const f=state.featureConfig;
    if(f) {
      const banner=f.eventUsed&&f.activatedRound===state.round
        ? f.eventType==='war'
          ?'<div class="event-banner">⚔️ GUERRE AU SOMMET ! Les 2 personnages de rang S se présentent à la suite.</div>'
          :'<div class="event-banner">🎲 PRIME DE LA MARINE ! '+f.rolls.map(r=>esc(player(r.id)?.name||'')+' : dé '+r.roll+' → +'+r.percent+' % ('+currency(r.amount)+')').join(' · ')+'</div>'
        :a?.warGuaranteed?'<div class="event-banner">⚔️ Guerre au sommet — deuxième personnage légendaire !</div>':'';
      html=html.replace('<section class="card auction">',banner+'<section class="card auction">');
    }
    if(a?.mystery&&a.outcome===null){
      const c=CARDS[a.charId];
      const actual=charCard(c);
      const t=tierOf(c.power);
      const mysteryCard='<article class="card character-card mystery-character" style="--tier-glow:'+t.glow+'"><div class="card-top"><span class="wanted">🔒 ENCHÈRE MYSTÈRE</span><span class="tier" style="--tier-color:'+t.color+';--tier-border:'+t.color+'">Classe '+t.tier+'</span></div><div class="mystery-symbol">❔</div><h1 class="mystery-title">Qui se cache derrière cette carte ?</h1><p>Seul son rang est révélé. Son identité et sa puissance seront dévoilées après l’enchère.</p></article>';
      html=html.replace(actual,mysteryCard);
    }
    const p=currentPlayer();
    if(p){
      const powers='<div class="extra-powers">'+
        '<button data-action="observation" class="extra-power" '+(p.observationUsed?'disabled':'')+'>👁 Observation <small>'+(p.observationUsed?'Déjà utilisé':'Voir les 3 prochaines cartes')+'</small></button>'+
        '<button data-action="armament" class="extra-power" '+(p.armamentUsed||p.roster.length===0?'disabled':'')+'>🛡 Armement <small>'+(p.armamentUsed?'Déjà utilisé':p.roster.length===0?'Recrute d’abord':'Ajouter +5 à une recrue')+'</small></button>'+
        '</div>';
      const marker='<button class="pass-btn" data-action="pass"';
      html=html.replace(marker,powers+marker);
    }
    return html;
  };

  const oldScoreBoard=scoreBoard;
  scoreBoard=function(){
    let html=oldScoreBoard();
    if(!state)return html;
    let i=0;
    html=html.replace(/<div class="special-stats">/g,()=>{
      const p=state.players[i++];
      const d=getBreakdown(p);
      const powers='<span>👁 '+(p.observationUsed?'Utilisé':'Prêt')+'</span><span>🛡 '+(p.armamentUsed?'Utilisé':'Prêt')+'</span>';
      const synergiesHtml=d.synergyItems.length?'<span class="active-synergy">🤝 '+d.synergyItems.map(s=>esc(s.name)+' +'+s.points).join(' · ')+'</span>':'';
      return '<div class="power-breakdown">Base '+d.base+(d.armament?' + '+d.armament+' Armement':'')+(d.synergy?' + '+d.synergy+' synergies':'')+' = <strong>'+d.total+' points</strong></div>'+
        (safeBig(p.marineAward)>0n?'<div class="power-breakdown">🎲 Prime de la Marine : +'+currency(p.marineAward)+'</div>':'')+
        '<div class="special-stats">'+powers+synergiesHtml;
    });
    return html;
  };

  const previousEnd=endScreen;
  endScreen=function(){
    let html=previousEnd();
    const people=state.players;
    const entries=[];
    for(const p of people){
      for(const id of p.roster){
        if(!CARDS[id])continue;
        entries.push({p,id,c:CARDS[id],price:p.purchases?.[id]});
      }
    }
    const best=entries.slice().sort((a,b)=>b.c.power-a.c.power)[0];
    const bought=entries.filter(e=>e.price!==undefined&&safeBig(e.price)>0n);
    const bargain=bought.sort((a,b)=>{
      const lhs=BigInt(a.c.power)*safeBig(b.price), rhs=BigInt(b.c.power)*safeBig(a.price);
      return lhs>rhs?-1:lhs<rhs?1:0;
    })[0];
    const spender=people.slice().sort((a,b)=>{
      const pa=Object.values(a.purchases||{}).reduce((n,x)=>n+safeBig(x),0n);
      const pb=Object.values(b.purchases||{}).reduce((n,x)=>n+safeBig(x),0n);
      return pb>pa?1:pb<pa?-1:0;
    })[0];
    const spent=spender?Object.values(spender.purchases||{}).reduce((n,x)=>n+safeBig(x),0n):0n;
    const tactician=people.slice().sort((a,b)=>{
      const ba=getBreakdown(a),bb=getBreakdown(b);
      return (bb.armament+bb.synergy)-(ba.armament+ba.synergy);
    })[0];
    const winners=ranking()[0];
    const medal=(emoji,title,value,note)=>'<div class="award-item"><span class="award-symbol">'+emoji+'</span><div><strong>'+title+'</strong><span>'+value+'</span><small>'+note+'</small></div></div>';
    const awards=[
      best?medal('💥','Meilleure recrue',esc(best.c.name)+' · '+best.c.power+' pts','Équipage de '+esc(best.p.name)):'',
      bargain?medal('💰','Meilleur rapport qualité/prix',esc(bargain.c.name),'Acheté par '+esc(bargain.p.name)+' pour '+currency(bargain.price)):'',
      spender&&spent>0n?medal('💸','Plus gros investisseur',esc(spender.name),'Dépenses : '+currency(spent)):'',
      tactician&&getBreakdown(tactician).synergy+getBreakdown(tactician).armament>0
        ?medal('🧠','Meilleur stratège',esc(tactician.name),'Bonus combinés : +'+(getBreakdown(tactician).synergy+getBreakdown(tactician).armament)+' pts'):''
    ].filter(Boolean).join('');
    const victory= '<div class="final-explainer">🏆 Score : puissance des recrues + Haki de l’Armement + synergies. Départage : budget restant.</div>';
    const owned=winners?.roster||[];
    const championSquad='<div class="champion-roster">'+owned.map(id=>{
      const c=CARDS[id];if(!c)return '';
      return '<button data-action="details" data-char-id="'+esc(id)+'" class="champion-portrait"><div class="portrait portrait-medium"><span class="portrait-fallback">☠️</span><img class="portrait-photo" data-portrait-id="'+esc(id)+'" alt="" loading="lazy" /></div><span>'+esc(c.name)+'</span></button>';
    }).join('')+'</div>';
    html=html.replace('<div class="win-score">',championSquad+'<div class="win-score">');
    html=html.replace('<div class="ranking">',victory+'<div class="ranking">');
    if(awards)html=html.replace('<div class="section-heading"><h2>Les équipages</h2>',
      '<section class="awards"><h2>🏅 Trophées du mercato</h2>'+awards+'</section><div class="section-heading"><h2>Les équipages</h2>');
    return html;
  };

  const oldOpenModal=openModal;
  openModal=function(kind){
    oldOpenModal(kind);
    if(kind==='rules'){
      const ul=modal.querySelector('ul');
      if(ul)ul.insertAdjacentHTML('beforeend',
        '<li>Haki de l’Observation : consulter discrètement les <b>3 prochains personnages</b>, une fois par joueur.</li>'+
        '<li>Haki de l’Armement : donner <b>+5 points</b> à une recrue, une fois par joueur.</li>'+
        '<li>Synergies : Luffy/Zoro/Sanji +15 ; Roger/Rayleigh/Gaban +20 ; Kaido/King/Queen +15 ; Ace/Sabo/Luffy +20 points.</li>'+
        '<li>Une seule enchère mystère : seul le rang est visible jusqu’à la fin de l’enchère.</li>'+
        '<li>Un seul événement par partie : Guerre au sommet (2 cartes S consécutives) OU Prime de la Marine (chaque joueur lance un dé et reçoit 5 à 30 % de son budget initial).</li>');
    }
  };

  const style=document.createElement('style');
  style.textContent=`
    .event-banner{margin:10px 0 14px;background:linear-gradient(110deg,#5d3f25,#9f6630);
      border:1px solid #e6b05e;padding:15px;border-radius:16px;font-weight:850;font-size:13px;line-height:1.6;color:#fff4d8}
    .extra-powers{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:12px}
    .extra-power{background:linear-gradient(125deg,#23445c,#1b3449);border:1px solid #5087aa;
      color:#f4f9fa;border-radius:12px;padding:11px 7px;font-size:13px;font-weight:900}
    .extra-power small{display:block;font-size:10px;font-weight:550;margin-top:5px;color:#bfd3df}
    .extra-power:disabled{filter:grayscale(1);opacity:.38}
    .mystery-character{text-align:center;padding-top:25px}
    .mystery-symbol{font-size:78px;margin:12px 0;text-shadow:0 0 25px #e9c57955}
    .mystery-title{font-size:23px;margin:8px 0 12px}
    .mystery-character p{font-size:13px;max-width:320px;margin:0 auto}
    .armament-choices{display:flex;flex-direction:column;gap:8px;margin-bottom:13px}
    .armament-choices button{text-align:left;color:#f7ca72}
    .power-breakdown{font-size:11px;margin:8px 0 0;color:#d1dfe6;line-height:1.45}
    .active-synergy{color:#ffd68c!important;border-color:#aa874d!important}
    .final-explainer{font-size:12px;line-height:1.5;color:#bcd5dd;margin:7px 0 16px}
    .awards{margin:22px 0;padding:17px;background:#13303d;border:1px solid #52606a;border-radius:18px}
    .awards h2{margin-bottom:13px}
    .award-item{display:flex;gap:10px;align-items:flex-start;padding:11px 0;border-top:1px solid #ffffff22}
    .award-symbol{font-size:25px}
    .award-item strong,.award-item span,.award-item small{display:block}
    .award-item strong{font-size:12px;color:#f7ca72}
    .award-item div>span{font-size:13px;font-weight:800;margin:4px 0}
    .award-item small{font-size:11px;color:#b9cbd5}
    .champion-roster{display:flex;gap:8px;overflow-x:auto;padding:5px 1px 14px;margin-top:13px}
    .champion-portrait{border:1px solid #f7ca7255;border-radius:11px;background:#163446;
      color:#fff;min-width:85px;max-width:100px;padding:6px;font-size:10px}
    .champion-portrait .portrait{margin:auto auto 6px;height:90px;width:66px}
    .champion-portrait>span{display:block;overflow-wrap:anywhere}
  `;
  document.head.appendChild(style);

  document.addEventListener('click',event=>{
    const button=event.target.closest('button[data-action]');
    if(!button||button.disabled)return;
    const action=button.dataset.action;
    if(['observation','armament','armament-choose'].includes(action)){
      event.preventDefault();event.stopImmediatePropagation();
      if(action==='observation')observation();
      else if(action==='armament')openArmament();
      else useArmament(button.dataset.charId);
    }
  },true);
  render();
})();
