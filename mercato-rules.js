(function installMercatoRules(){
  'use strict';
  const MAX_PASSES=5;
  const MIN_RECRUITS=1;
  const MAX_RECRUITS=30;

  const safeCount=value=>Number.isInteger(Number(value)) ? Number(value):5;
  const passUsed=p=>Math.min(MAX_PASSES,Math.max(0,Number.isInteger(p?.passesUsed)?p.passesUsed:0));
  const hasHaki=p=>!!p && !p.hakiUsed && p.roster.length<TEAM_SIZE;
  const minForAuction=a=>BigInt(a.highBid||0)>0n?BigInt(a.highBid)+BigInt(state.bidStep??10):BigInt(state.baseBid??20);
  const canHakiNow=(a,p)=>Boolean(
    a&&p&&a.outcome===null&&a.turnId===p.id&&a.firstTurnId===p.id &&
    a.leader===null && BigInt(a.highBid||0)===0n &&
    a.passed.length===0 && hasHaki(p)
  );

  // Évite de casser les parties enregistrées avec les versions précédentes.
  if(state){
    const requested=safeCount(state.teamSize);
    TEAM_SIZE=Math.max(MIN_RECRUITS,Math.min(MAX_RECRUITS,requested));
    state.teamSize=TEAM_SIZE;
    state.players.forEach(p=>{
      p.passesUsed=passUsed(p);
      p.hakiUsed=Boolean(p.hakiUsed);
    });
    save();
  }

  const beforeSetup=setupScreen;
  setupScreen=function(){
    return beforeSetup()
      .replace('ses <strong>5 personnages</strong>', 'ses <strong>'+TEAM_SIZE+' personnages</strong>')
      .replace('<button class="primary" data-action="start">',
        '<div class="field field-team-size"><label for="team-size">Personnages à recruter par joueur</label>'+
        '<input id="team-size" type="number" min="'+MIN_RECRUITS+'" max="'+MAX_RECRUITS+'" step="1" inputmode="numeric" value="'+TEAM_SIZE+'"/>'+
        '<span class="hint" style="margin:0">De '+MIN_RECRUITS+' à '+MAX_RECRUITS+' personnages par joueur.</span></div>'+
        '<button class="primary" data-action="start">');
  };

  const beforeStart=start;
  start=function(){
    const value=Number(document.querySelector('#team-size')?.value??TEAM_SIZE);
    if(!Number.isInteger(value)||value<MIN_RECRUITS||value>MAX_RECRUITS){
      showToast('Choisis entre '+MIN_RECRUITS+' et '+MAX_RECRUITS+' personnages par joueur.');
      return;
    }
    TEAM_SIZE=value;
    const oldState=state;
    beforeStart();
    if(state && state!==oldState){
      state.teamSize=TEAM_SIZE;
      state.players.forEach(p=>{p.passesUsed=0;p.hakiUsed=false;});
      save();render();
    }
  };

  // Permet d'utiliser le Haki même si le budget du premier joueur est épuisé.
  findNextBidder=function(afterIndex,a){
    const amount=minForAuction(a);
    const firstChoice=a.leader===null&&BigInt(a.highBid||0)===0n&&a.passed.length===0;
    for(let offset=1;offset<=state.players.length;offset++){
      const p=state.players[(Number(afterIndex)+offset)%state.players.length];
      if(p.id===a.leader||a.passed.includes(p.id)||p.roster.length>=TEAM_SIZE)continue;
      if(canParticipate(p,amount)||(firstChoice&&hasHaki(p))){
        if(firstChoice&&a.firstTurnId===undefined)a.firstTurnId=p.id;
        return p.id;
      }
    }
    return null;
  };

  isComplete=function(){
    if(!state)return false;
    return state.players.every(p=>p.roster.length>=TEAM_SIZE) ||
      !state.players.some(p=>p.roster.length<TEAM_SIZE &&
        (canParticipate(p,BigInt(state.baseBid??20)) || hasHaki(p)));
  };

  const beforePass=pass;
  pass=function(){
    const a=state?.auction;
    if(!a||a.outcome!==null||a.turnId===null)return;
    const p=player(a.turnId);
    if(!p)return;
    if(passUsed(p)>=MAX_PASSES){showToast('Tu as déjà utilisé tes 5 passes. Il faut enchérir ou utiliser le Haki disponible.');return;}
    p.passesUsed=passUsed(p)+1;
    beforePass();
  };

  function useHaki(){
    const a=state?.auction;
    const p=a&&a.turnId!==null?player(a.turnId):null;
    if(!canHakiNow(a,p)){
      showToast('Haki des Rois indisponible pour cette enchère.');
      return;
    }
    p.hakiUsed=true;
    p.roster.push(a.charId);
    a.leader=p.id;
    a.highBid='0';
    a.hakiWinner=p.id;
    a.outcome='sold';
    a.turnId=null;
    save();render();
  }

  const beforeAuction=auctionScreen;
  auctionScreen=function(){
    let html=beforeAuction();
    const a=state?.auction;
    if(!a||a.outcome!==null||a.turnId===null)return html;
    const p=player(a.turnId);
    if(!p)return html;
    const remaining=Math.max(0,MAX_PASSES-passUsed(p));
    const canPower=canHakiNow(a,p);
    const powerButton=canPower?
      '<button class="haki-btn" data-action="haki">👑 Haki des Rois — recruter gratuitement !'+
      '<small>Utilisable une seule fois, seulement en jouant en premier.</small></button>':'';
    html=html.replace('<button class="pass-btn" data-action="pass">Passer mon tour</button>',
      powerButton+'<button class="pass-btn" data-action="pass" '+(remaining===0?'disabled':'')+'>'+
      (remaining===0?'⛔ Plus de passes disponibles':'Passer mon tour · '+remaining+'/'+MAX_PASSES+' restantes')+'</button>');
    html=html.replace("Passer t'exclut uniquement des enchères pour ce personnage.",
      'Chaque joueur dispose de '+MAX_PASSES+' passes au total sur toute la partie.');
    return html;
  };

  const beforeScoreboard=scoreBoard;
  scoreBoard=function(){
    const html=beforeScoreboard();
    if(!state)return html;
    let i=0;
    return html.replace(/<div class="roster">/g,()=>{
      const p=state.players[i++];
      if(!p)return '<div class="roster">';
      return '<div class="special-stats"><span>⏭️ Passes : '+passUsed(p)+'/'+MAX_PASSES+'</span>'+
        '<span class="'+(p.hakiUsed?'power-spent':'power-ready')+'">'+
        (p.hakiUsed?'👑 Haki utilisé':'👑 Haki disponible')+'</span></div><div class="roster">';
    });
  };

  const beforeResolved=resolvedScreen;
  resolvedScreen=function(a,c){
    let html=beforeResolved(a,c);
    if(a.hakiWinner===undefined || a.hakiWinner===null)return html;
    return html.replace('<div class="icon">🏆</div>','<div class="icon">👑</div>')
      .replace('pour <strong>'+currency(0)+'</strong>.',
        'gratuitement grâce au <strong>Haki des Rois</strong> !');
  };

  ranking=function(){
    return [...state.players].sort((a,b)=>{
      const scoreDiff=getScore(b)-getScore(a);
      if(scoreDiff)return scoreDiff;
      const bMoney=BigInt(b.budget),aMoney=BigInt(a.budget);
      return bMoney>aMoney?1:bMoney<aMoney?-1:a.id-b.id;
    });
  };

  const beforeModal=openModal;
  openModal=function(kind){
    beforeModal(kind);
    if(kind==='rules'){
      const list=modal.querySelector('ul');
      if(list)list.insertAdjacentHTML('beforeend',
        '<li>Les joueurs recrutent chacun <b>'+TEAM_SIZE+' personnages</b>, nombre choisi avant la partie (de 1 à 30).</li>'+
        '<li>Chacun peut <b>passer son tour au maximum '+MAX_PASSES+' fois</b> sur l’ensemble de la partie.</li>'+
        '<li>Le <b>Haki des Rois</b> s’utilise <b>une seule fois par joueur</b> : uniquement lorsqu’il est le premier à jouer pour un personnage, avant toute enchère. Il le recrute immédiatement et <b>gratuitement</b>, sans opposition possible.</li>');
    }
  };

  const style=document.createElement('style');
  style.textContent=`
    .field-team-size{max-width:295px;margin:6px 0 18px}
    .field-team-size input{max-width:155px}
    .haki-btn{display:block;width:100%;margin-top:12px;padding:13px 12px;
      border:1px solid #f7cd78;border-radius:14px;
      background:linear-gradient(130deg,#533c20,#76532b);
      color:#fff5d5;font-size:14px;font-weight:950;
      text-align:center;box-shadow:0 6px 18px rgba(0,0,0,.2)}
    .haki-btn small{display:block;font-size:11px;font-weight:550;color:#f2d9a8;margin-top:5px}
    .special-stats{display:flex;align-items:center;flex-wrap:wrap;gap:7px;margin-top:10px;
      font-size:10px;color:#cee1e6}
    .special-stats span{border:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.16);
      border-radius:20px;padding:5px 8px}
    .special-stats .power-ready{color:#f7ca72;border-color:rgba(247,202,114,.4)}
    .special-stats .power-spent{color:#a5b6bd}
    .pass-btn:disabled{opacity:.5}
  `;
  document.head.appendChild(style);

  document.addEventListener('input',event=>{
    if(event.target.id==='team-size'){
      const v=Number(event.target.value);
      if(Number.isInteger(v)&&v>=MIN_RECRUITS&&v<=MAX_RECRUITS)TEAM_SIZE=v;
    }
  },true);

  document.addEventListener('click',event=>{
    const button=event.target.closest('button[data-action="haki"]');
    if(!button||button.disabled)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    useHaki();
  },true);

  render();
})();
