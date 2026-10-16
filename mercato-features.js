(function enhanceMercato() {
  'use strict';
  const version = 3;
  // Nouvelle synergie : elle depend exclusivement de l'affiliation du catalogue.
  // Plusieurs groupes differents sont cumulables. Les anciennes combinaisons
  // fixes (trio monstrueux, Roger, etc.) ne donnent plus de bonus.
  function affiliationBonus(count){
    return count>=5?50:count>=2?(count-1)*10:0;
  }
  const getPlayerBonuses=p=>{
    const affiliations=new Map();
    for(const id of p?.roster||[]){
      const crew=window.MERCATO_EXPANSION?.details?.[id]?.crew?.trim();
      if(crew)affiliations.set(crew,(affiliations.get(crew)||0)+1);
    }
    return [...affiliations].map(([name,count])=>({
      name,count,points:affiliationBonus(count)
    })).filter(b=>b.points>0).sort((a,b)=>b.points-a.points||a.name.localeCompare(b.name,'fr'));
  };
  function effectivePower(p,id){const base=CARDS[id]?.power||0;if(state?.v3)return Math.max(0,Math.min(100,base+Number(p.smileModifiers?.[id]||0)+Number(p.shipBonus?.[id]||0)+(p.armamentId===id?Number(p.armamentBonus||0):0)));return p.smileModifiers?.[id]===undefined?base:Math.max(0,Math.min(100,base+p.smileModifiers[id]));}
  const getBreakdown=p=>{
    const base=(p.roster||[]).reduce((sum,id)=>sum+effectivePower(p,id),0);
    const armament=state?.v3?0:p.armamentId&&p.roster.includes(p.armamentId)?(p.armamentBonus??5):0;
    const synergyItems=getPlayerBonuses(p);
    const synergy=synergyItems.reduce((sum,x)=>sum+x.points,0);
    return {base,armament,synergy,synergyItems,total:base+armament+synergy};
  };
  getScore=function(p){return getBreakdown(p).total;};


  // Le meme catalogue d'evenements que le serveur.
  const BURST_IDS=new Set(['luffy','zoro','nami','usopp','sanji','chopper','robin','franky','brook','jinbe','luffy-gear5']);
  const V2_TYPES=['war','marine','mystery','black','god','smile','reverie','burst'];
  const V2_INFO={
    war:['⚔️','GUERRE AU SOMMET','Deux légendes de rang S se présentent à la suite.'],
    marine:['🎲','PRIME DE LA MARINE','Chaque joueur gagne une prime en lançant son dé.'],
    mystery:['❔','PERSONNAGE MYSTÈRE','Seul le rang du personnage sera révélé.'],
    black:['🏴‍☠️','MARCHÉ NOIR','Trois personnages apparaissent, un seul sera mis aux enchères.'],
    god:['💥','INCIDENT DE GOD VALLEY','Chaque joueur peut éliminer une recrue adverse.'],
    smile:['🍎','SMILE','Le personnage le plus faible mange un fruit SMILE : pile ou face ?'],
    reverie:['👑','LA RÊVERIE','Taxe royale ×2 : première mise obligatoire, retrait possible ensuite. Haki des Rois interdit.'],
    burst:['🚀','COUP DE BURST','Le Thousand Sunny surgit ! Un Chapeau de paille disponible rejoint une enchère secrète. Une seule proposition par pirate, puis révélation simultanée.']
  };
  function chooseSchedule(players,recruits){
    const total=players*recruits,qty=recruits<=5?1:recruits<=9?2:3;
    const types=V2_TYPES.filter(t=>(t!=='smile'&&t!=='god')||total>=players*2+2);
    const picks=[];
    while(picks.length<qty)picks.push(types.splice(Math.floor(Math.random()*types.length),1)[0]);
    const plan=[],busy=new Set();
    for(const type of picks){
      const earliest=type==='smile'?Math.max(players+1,Math.floor(total/2)+1):
        type==='god'?players+1:recruits===1?1:2;
      const last=Math.max(earliest,Math.min(total-1,Math.ceil(total*.9)));
      const positions=[];
      for(let n=earliest;n<=last;n++){
        if(busy.has(n)||(type==='war'&&(busy.has(n+1)||n>=total)))continue;
        positions.push(n);
      }
      if(!positions.length)continue;
      const round=positions[Math.floor(Math.random()*positions.length)];
      plan.push({type,round});busy.add(round);if(type==='war')busy.add(round+1);
    }
    return plan.sort((a,b)=>a.round-b.round);
  }
  function normalized() {
    if(!state)return;
    for(const p of state.players) {
      if(typeof p.observationUsed!=='boolean')p.observationUsed=false;
      if(typeof p.armamentUsed!=='boolean')p.armamentUsed=!!p.armamentId;
      if(!p.purchases || typeof p.purchases!=='object')p.purchases={};
      if(typeof p.marineAward!=='string')p.marineAward='0';
    }
    if(!state.initialBudget)state.initialBudget=String(state.players[0]?.budget||'1000');
    if(!state.featureConfig){
      state.featureConfig={version:4,plan:chooseSchedule(state.players.length,TEAM_SIZE),
        active:null,warRounds:[],eventUsed:false,mysteryUsed:false};
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
    f.awaitingRolls=true;
    f.rollIndex=0;
  }
  function rollMarineDie(){
    const f=state?.featureConfig;
    if(!f||f.eventType!=='marine'||!f.awaitingRolls)return;
    const p=state.players[f.rollIndex];
    if(!p)return;
    const roll=1+Math.floor(Math.random()*6);
    const percent=roll*5;
    const amount=safeBig(state.initialBudget)*BigInt(percent)/100n;
    p.budget=(safeBig(p.budget)+amount).toString();
    p.marineAward=amount.toString();
    p.marineRoll=roll;
    f.rolls.push({id:p.id,roll,percent,amount:amount.toString()});
    f.rollIndex++;
    if(f.rollIndex>=state.players.length)f.awaitingRolls=false;
    save();render();
  }

  const oldDrawNext=drawNext;
  drawNext=function(){
    if(!state)return oldDrawNext();
    normalized();
    if(state.phase==='finished'||isComplete()||state.drawIndex>=state.drawPile.length)
      return oldDrawNext();
    const f=state.featureConfig;
    if(f.plan){
      f.active=null;
      const upcoming=state.round+1;
      const scheduled=f.plan.find(e=>e.round===upcoming);
      let selected=scheduled?.type||null;
      if(['smile','god'].includes(selected)&&state.players.some(p=>p.roster.length===0)){
        const reserved=new Set(f.plan.map(x=>x.type));
        const pool=['mystery','marine','black','reverie'].filter(x=>!reserved.has(x));
        selected=pool[Math.floor(Math.random()*pool.length)]||'marine';
      }
      if(selected==='burst'&&!state.drawPile.slice(state.drawIndex).some(id=>BURST_IDS.has(id))){
        const reserved=new Set(f.plan.map(x=>x.type));
        const pool=['mystery','marine','black','reverie'].filter(x=>!reserved.has(x));
        selected=pool[Math.floor(Math.random()*pool.length)]||'marine';
      }
      if(selected==='war'&&!prepareWarCards(upcoming)){
        const reserved=new Set(f.plan.map(x=>x.type));
        const pool=['marine','mystery','black','reverie'].filter(x=>!reserved.has(x));
        selected=pool[Math.floor(Math.random()*pool.length)]||'marine';
      }
      if(selected==='war')f.warRounds=[upcoming,upcoming+1];
      oldDrawNext();
      if(state.phase!=='auction'||!state.auction)return;
      const a=state.auction;
      if(selected==='burst'){
        // Inclure la carte qui vient d'être tirée et les cartes futures, mais jamais les recrues
        // déjà achetées ni les cartes refusées dans les enchères précédentes.
        const candidates=[a.charId,...state.drawPile.slice(state.drawIndex)].filter(id=>BURST_IDS.has(id));
        const chosen=candidates[Math.floor(Math.random()*candidates.length)];
        if(chosen&&chosen!==a.charId){
          const index=state.drawPile.indexOf(chosen,state.drawIndex);
          if(index>=0){state.drawPile[index]=a.charId;a.charId=chosen;}
        }
      }
      a.mystery=selected==='mystery';
      a.warGuaranteed=f.warRounds.includes(state.round);
      if(selected){
        f.active={type:selected,round:state.round,stage:'intro',step:0,removed:[],ready:[],flips:[]};
        if(selected==='black'){
          const extras=state.drawPile.slice(state.drawIndex,state.drawIndex+2);
          state.drawIndex+=extras.length;
          f.active.choices=[a.charId,...extras];
        }
        if(selected==='marine'){f.rolls=[];f.rollIndex=0;f.awaitingRolls=false;}
        if(selected==='burst'){f.active.offers=[];f.active.tieFlips=[];f.active.tieBits='';f.active.tied=[];}
        f.eventUsed=true;f.activatedRound=state.round;f.eventType=selected;
      }
      save();render();return;
    }
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
      const f=state.featureConfig;
      const hidden=f?.plan?f.plan.some(e=>e.type==='mystery'&&e.round===state.round+i+1):
        f?.mysteryRound===state.round+i+1&&!f?.mysteryUsed;
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


  function v2Active(){return state?.featureConfig?.plan?state.featureConfig.active:null;}
  function v2Royal(){return v2Active()?.type==='reverie';}
  function v2Ready(){
    const e=v2Active();if(!e||!['intro','result','god-result'].includes(e.stage))return;
    if(e.stage==='result'||e.stage==='god-result'){e.stage='auction';save();render();return;}
    e.stage=e.type==='marine'?'roll':e.type==='smile'?'coin':
      e.type==='black'?'select':e.type==='god'?'eliminate':e.type==='burst'?'offers':'auction';
    e.step=0;
    if(e.type==='reverie'){
      const a=state.auction;
      a.turnId=findNextBidder((state.round-2+state.players.length)%state.players.length,a);
      a.firstTurnId=a.turnId;
      if(a.turnId===null){a.outcome='unsold';}
    }
    save();render();
  }

  function v2Fx(type,message,result){
    // Le hasard est déjà décidé ; le rendu 3D ne fait que révéler le résultat.
    const veil=document.createElement('div');veil.className='v2-local-fx';
    let visual='';
    if(type==='coin'||type==='burst-coin'){
      const flip=result?1800:1980;
      visual='<div class="v2-fx-stage"><div class="v2-flip-coin" style="--coin-flip:'+flip+'deg">'+
        '<div class="v2-coin-side v2-coin-pile">'+(type==='burst-coin'?'🚀':'🍎')+'<span>PILE</span></div>'+
        '<div class="v2-coin-side v2-coin-face">☠️<span>FACE</span></div></div></div>';
    }else{
      const n=Math.max(1,Math.min(6,Number(result)||1));
      const angles=[[0,0],[0,0],[-90,0],[0,-90],[0,90],[90,0],[0,180]][n];
      const faces=['⚀','⚁','⚂','⚃','⚄','⚅'];
      visual='<div class="v2-fx-stage"><div class="v2-dice-cube" style="--dice-x:'+(720+angles[0])+'deg;--dice-y:'+(1080+angles[1])+'deg">'+
        faces.map((face,i)=>'<div class="v2-dice-face v2-side-'+(i+1)+'">'+face+'</div>').join('')+
        '</div></div>';
    }
    veil.innerHTML=visual+'<strong class="v2-fx-result">'+esc(message)+'</strong>';
    document.body.appendChild(veil);
    setTimeout(()=>veil.remove(),2100);
  }
  window.OPMERCATO_EVENT_FX=v2Fx;
  function v2Roll(){
    const e=v2Active();if(!e||e.type!=='marine'||e.stage!=='roll')return;
    const p=state.players[e.step],roll=1+Math.floor(Math.random()*6),percent=roll*5;
    const amount=safeBig(state.initialBudget)*BigInt(percent)/100n;
    p.budget=(safeBig(p.budget)+amount).toString();p.marineAward=amount.toString();p.marineRoll=roll;
    state.featureConfig.rolls.push({id:p.id,roll,percent,amount:amount.toString()});
    e.step++;if(e.step===state.players.length)e.stage='result';
    save();render();v2Fx('die',p.name+' : '+roll+' → +'+percent+' % ('+currency(amount)+')',roll);
  }
  function v2Coin(){
    const e=v2Active();if(!e||e.type!=='smile'||e.stage!=='coin')return;
    const p=state.players[e.step],sorted=p.roster.slice().sort((a,b)=>effectivePower(p,a)-effectivePower(p,b));const tied=sorted.filter(id=>effectivePower(p,id)===effectivePower(p,sorted[0]));const id=state?.v3?tied[Math.floor(Math.random()*tied.length)]:sorted[0];
    const pile=Math.random()<.5,before=id?effectivePower(p,id):0,
      after=Math.max(0,Math.min(100,before+(pile?25:-25)));
    if(id){p.smileModifiers=p.smileModifiers||{};p.smileModifiers[id]=state?.v3?Number(p.smileModifiers[id]||0)+(pile?25:-25):after-(CARDS[id]?.power||0);}
    e.flips.push({id:p.id,charId:id||null,pile,before,after});e.step++;
    if(e.step===state.players.length)e.stage='result';
    save();render();v2Fx('coin',p.name+' : '+(id?pile?'PILE · +25':'FACE · −25':'Aucune recrue à transformer'),pile);
  }

  function v2BurstSettle(winner){
    const e=v2Active(),a=state.auction;
    const max=e.offers.reduce((v,o)=>Math.max(v,o.amount),0);
    e.winner=winner;
    e.stage='result';
    e.ready=[];
    a.leader=winner;
    a.highBid=max;
    // La recette normale de règlement conserve les budgets, les achats et le Haki d'Armement.
    settle();
  }
  function v2BurstOffer(){
    const e=v2Active();
    if(e?.type!=='burst'||e.stage!=='offers')return;
    const p=state.players[e.step],input=document.querySelector('#v2-burst-amount');
    const raw=String(input?.value??'').trim();
    if(!/^\d{1,12}$/.test(raw))return showToast('Indique un montant entier en Berrys, ou 0 pour ne pas miser.');
    const value=Number(raw),minimum=Number(state.baseBid||20);
    if(!Number.isSafeInteger(value)||value!==0&&value<minimum)
      return showToast('La mise doit être de 0 (passer) ou au moins '+currency(minimum)+'.');
    if(value>0&&(p.roster.length>=TEAM_SIZE||safeBig(p.budget)<BigInt(value)))
      return showToast('Enchère impossible : budget insuffisant ou équipage complet.');
    if(e.offers.some(o=>o.id===p.id))return;
    e.offers.push({id:p.id,amount:value});
    e.step++;
    if(e.step===state.players.length){
      const max=Math.max(...e.offers.map(o=>o.amount));
      const tied=max>0?e.offers.filter(o=>o.amount===max).map(o=>o.id):[];
      if(tied.length>1){e.tied=tied;e.tieBits='';e.tieFlips=[];e.stage='tie';}
      else v2BurstSettle(tied[0]??null);
    }
    save();render();
  }
  function v2BurstCoin(){
    const e=v2Active();
    if(e?.type!=='burst'||e.stage!=='tie')return;
    const pile=Math.random()<.5;
    e.tieBits+=(pile?'0':'1');
    e.tieFlips.push({pile});
    const bits=Math.ceil(Math.log2(e.tied.length));
    let msg='COUP DE BURST : '+(pile?'PILE':'FACE');
    if(e.tieBits.length>=bits){
      const n=parseInt(e.tieBits,2);
      e.tieBits='';
      if(n<e.tied.length){
        msg+=' · '+state.players[e.tied[n]].name+' remporte le départage !';
        v2BurstSettle(e.tied[n]);
      }else msg+=' · Nouvelle pièce pour départager les ex æquo.';
    }
    save();render();v2Fx('burst-coin',msg,pile);
  }
  function v2Pick(id){
    const e=v2Active();if(!e||e.type!=='black'||e.stage!=='select')return;
    if(!e.choices.includes(id)||e.removed.includes(id))return;
    e.removed.push(id);e.step++;
    if(e.step===2){
      state.auction.charId=e.choices.find(x=>!e.removed.includes(x));
      for(const returned of e.removed){
        const pos=state.drawIndex+Math.floor(Math.random()*(state.drawPile.length-state.drawIndex+1));
        state.drawPile.splice(pos,0,returned);
      }
      e.stage='auction';
    }
    save();render();
  }
  function v2Eliminate(id){
    const e=v2Active();if(!e||e.type!=='god'||e.stage!=='eliminate')return;
    const first=state.auction.firstTurnId??0,actor=(first+e.step)%state.players.length,
      opponent=state.players[(actor+1)%state.players.length];
    if(id&&!opponent.roster.includes(id))return;
    if(id){opponent.roster=opponent.roster.filter(x=>x!==id);e.removed.push({from:opponent.id,id});}
    e.step++;if(e.step===state.players.length){e.stage='god-result';e.ready=[];}
    save();render();
  }
  const beforeRoyalBid=bid,beforeRoyalPass=pass,beforeRoyalSettle=settle,beforeRoyalBidder=findNextBidder;
  findNextBidder=function(from,a){
    if(!v2Royal()||v2Active().stage!=='auction')return beforeRoyalBidder(from,a);
    const value=BigInt(a.highBid||0)>0n?BigInt(a.highBid)+BigInt(state.bidStep||10):BigInt(state.baseBid||20);
    for(let offset=1;offset<=state.players.length;offset++){
      const p=state.players[(Number(from)+offset)%state.players.length];
      if(p.id===a.leader||a.passed.includes(p.id)||p.roster.length>=TEAM_SIZE)continue;
      if(safeBig(p.budget)>=(state?.v3&&p.ship==='mobydick'?(value*2n*90n+50n)/100n:value*2n)&&safeBig(p.budget)>=value)return p.id;
    }
    return null;
  };
  bid=function(value){
    if(v2Royal()&&v2Active().stage==='auction'){
      const p=player(state.auction?.turnId);
      if(!p||safeBig(p.budget)<(state?.v3&&p.ship==='mobydick'?(BigInt(Math.floor(Number(value)||0))*2n*90n+50n)/100n:BigInt(Math.floor(Number(value)||0))*2n))
        return showToast('👑 Taxe royale : tu dois pouvoir payer le double de ta mise.');
    }
    return beforeRoyalBid(value);
  };
  pass=function(){
    if(v2Royal()&&v2Active().stage==='auction'&&state.auction?.leader===null)return showToast('👑 Rêverie : il faut une première mise avant de pouvoir se retirer !');
    return beforeRoyalPass();
  };
  settle=function(){
    const royal=v2Royal()&&v2Active().stage==='auction',
      a=state?.auction,leader=a?.leader,
      extra=royal&&leader!==null&&leader!==undefined?safeBig(a.highBid):0n;
    beforeRoyalSettle();
    if(extra&&leader!==null){
      const p=player(leader);p.budget=(safeBig(p.budget)-extra).toString();
      if(p.purchases)p.purchases[a.charId]=(extra*2n).toString();
      save();render();
    }
  };
  function v2Screen(){
    const e=v2Active(),def=V2_INFO[e.type],my=state.players,stateText=esc(def[2]);
    let content='';
    if(e.stage==='intro'){
      content='<p>'+stateText+'</p><button class="primary" data-action="v2-ready">Continuer →</button>';
    }else if(e.stage==='result'&&e.type!=='burst'){
      const rows=e.type==='marine'?state.featureConfig.rolls.map(x=>
        esc(player(x.id)?.name)+' : 🎲 '+x.roll+' → +'+x.percent+' % · '+currency(x.amount)):
        e.flips.map(x=>esc(player(x.id)?.name)+' : '+(x.charId?esc(CARDS[x.charId]?.name||x.charId)+' · '+(x.pile?'Pile +25':'Face −25')+' · '+x.before+' → '+x.after:'Aucune recrue à transformer'));
      content='<div class="v2-local-results">'+rows.map(x=>'<p>'+x+'</p>').join('')+'</div>'+
        '<button class="primary" data-action="v2-ready">Continuer →</button>';
    }else if(e.stage==='god-result'){
      content='<p>Les pertes de chaque équipage</p><div class="v2-god-results">'+
        my.map(p=>'<div class="v2-god-player"><strong>'+esc(p.name)+'</strong>'+
          (e.removed.filter(x=>x.from===p.id).map(x=>'<div class="v2-god-lost"><span class="portrait portrait-tiny"><span class="portrait-fallback">☠️</span><img class="portrait-photo" data-portrait-id="'+esc(x.id)+'" alt="" loading="lazy"></span><span>💥 '+esc(CARDS[x.id]?.name||x.id)+' · '+(CARDS[x.id]?.power||0)+' pts</span></div>').join('')||'<span class="v2-god-spared">Équipage épargné</span>')+'</div>').join('')+'</div><button class="primary" data-action="v2-ready">Continuer →</button>';
    }else if(e.type==='burst'&&e.stage==='offers'){
      const p=my[e.step],min=Number(state.baseBid||20);
      content='<div class="v2-burst-card">'+charCard(CARDS[state.auction.charId])+'</div>'+
        '<p>🔒 Au tour de <b>'+esc(p.name)+'</b> : une seule mise secrète, sans chronomètre.</p>'+
        '<div class="v2-burst-input"><label for="v2-burst-amount">Ta proposition en Berrys (0 pour passer)</label>'+
        '<input id="v2-burst-amount" type="number" min="0" step="1" inputmode="numeric" placeholder="Mise de départ : '+min+'"></div>'+
        '<button class="primary" data-action="v2-burst-offer">🔒 Verrouiller mon offre</button>'+
        '<p>'+(e.offers.length)+' / '+my.length+' propositions enregistrées. Les montants restent cachés.</p>';
    }else if(e.type==='burst'&&e.stage==='tie'){
      content='<div class="v2-burst-card">'+charCard(CARDS[state.auction.charId])+'</div>'+
        '<h2>💰 Offres révélées simultanément</h2>'+
        '<div class="v2-local-results">'+e.offers.map(o=>'<p>'+esc(player(o.id).name)+' : '+currency(o.amount)+'</p>').join('')+'</div>'+
        '<p>Égalité en tête ! 🪙 Le pile ou face départage les joueurs concernés.</p>'+
        '<button class="primary" data-action="v2-burst-coin">🪙 Lancer la pièce</button>';
    }else if(e.type==='burst'&&e.stage==='result'){
      content='<div class="v2-burst-card">'+charCard(CARDS[state.auction.charId])+'</div>'+
        '<h2>🚀 Révélation des offres !</h2>'+
        '<div class="v2-local-results">'+e.offers.map(o=>'<p>'+esc(player(o.id).name)+' : '+currency(o.amount)+'</p>').join('')+'</div>'+
        '<p>'+(e.winner===null?'Personnage invendu.':'🏆 '+esc(player(e.winner).name)+' recrute '+esc(CARDS[state.auction.charId].name)+' pour '+currency(state.auction.highBid)+' !')+'</p>'+
        '<button class="primary" data-action="v2-ready">Continuer →</button>';
    }else if(e.stage==='roll'){
      const p=my[e.step];content='<p>Au tour de <b>'+esc(p.name)+'</b> de lancer le dé !</p>'+
        '<div class="v2-local-die">🎲</div><button class="primary" data-action="v2-roll">🎲 Lancer mon dé</button>'+
        '<div class="v2-local-results">'+(state.featureConfig.rolls||[]).map(x=>
          '<p>'+esc(player(x.id)?.name)+' : '+x.roll+' → +'+x.percent+' %</p>').join('')+'</div>';
    }else if(e.stage==='coin'){
      const p=my[e.step];content='<p>Au tour de <b>'+esc(p.name)+'</b> de lancer la pièce SMILE !</p>'+
        '<div class="v2-local-die">🪙</div><button class="primary" data-action="v2-coin">🪙 Lancer ma pièce</button>';
    }else if(e.stage==='select'){
      const first=state.auction.firstTurnId??0,actor=my[(first+e.step)%my.length];
      content='<p>Au tour de <b>'+esc(actor.name)+'</b> de retirer un personnage.</p>'+
        '<div class="v2-local-choices">'+e.choices.filter(id=>!e.removed.includes(id)).map(id=>
          '<div><strong>'+esc(CARDS[id]?.name||id)+'</strong><small>'+CARDS[id]?.power+' points</small>'+
          '<button data-action="v2-pick" data-id="'+esc(id)+'">❌ Éliminer</button></div>').join('')+'</div>'+
        '<p>Les deux personnages écartés retourneront dans la pioche.</p>';
    }else if(e.stage==='eliminate'){
      const first=state.auction.firstTurnId??0,actor=my[(first+e.step)%my.length],
        opponent=my[(first+e.step+1)%my.length];
      content='<p><b>'+esc(actor.name)+'</b> peut supprimer une recrue de <b>'+esc(opponent.name)+'</b>.</p>'+
        '<div class="v2-local-choices">'+opponent.roster.map(id=>
          '<div><strong>'+esc(CARDS[id]?.name||id)+'</strong><small>'+effectivePower(opponent,id)+' points</small>'+
          '<button data-action="v2-delete" data-id="'+esc(id)+'">💥 Éliminer</button></div>').join('')+'</div>'+
        '<button class="btn-ghost" data-action="v2-skip">Épargner cet équipage</button>'+
        '<p>Les recrues éliminées disparaissent définitivement. Leurs places se libèrent.</p>';
    }
    return header()+'<section class="v2-local-special v2-'+e.type+'"><small>✦ ÉVÉNEMENT SPÉCIAL ✦</small>'+
      '<div class="v2-local-symbol">'+def[0]+'</div><h1>'+def[1]+'</h1>'+content+'</section>'+
      '<div class="v2-local-hint">Aucun événement ne disparaît automatiquement. Confirme pour continuer.</div>';
  }

  const oldAuction=auctionScreen;
  auctionScreen=function(){
    if(!state||state.phase!=='auction')return oldAuction();
    if(v2Active()&&v2Active().stage!=='auction')return v2Screen();
    const a=state.auction;
    let html=oldAuction();
    const f=state.featureConfig;
    if(f&&!f.plan) {
      const banner=f.eventUsed&&f.activatedRound===state.round
        ? f.eventType==='war'
          ?'<div class="event-banner">⚔️ GUERRE AU SOMMET ! Les 2 personnages de rang S se présentent à la suite.</div>'
          :'<div class="event-banner">🎲 PRIME DE LA MARINE ! '+(f.rolls||[]).map(r=>esc(player(r.id)?.name||'')+' : dé '+r.roll+' → +'+r.percent+' % ('+currency(r.amount)+')').join(' · ')+'</div>'
        :a?.warGuaranteed?'<div class="event-banner">⚔️ Guerre au sommet — deuxième personnage légendaire !</div>':'';
      html=html.replace('<section class="card auction">',banner+'<section class="card auction">');
    }
    if(v2Active()&&v2Active().stage==='auction'){
      const label=V2_INFO[v2Active().type];
      html=html.replace('<section class="card auction">',
        '<div class="event-banner">✦ '+esc(label[1])+' ✦ '+esc(label[2])+'</div><section class="card auction">');
      if(v2Royal()){
        html=html.replace(/<button class="haki-btn"[\s\S]*?<\/button>/,'');
        if(a?.leader===null)html=html.replace(/<button class="pass-btn"[^>]*>[\s\S]*?<\/button>/,
          '<button class="pass-btn" disabled>👑 Première mise obligatoire</button>');
      }
    }
    if(a?.warGuaranteed&&!v2Active()&&f?.plan){
      html=html.replace('<section class="card auction">',
        '<div class="event-banner">⚔️ GUERRE AU SOMMET — deuxième légende de rang S !</div><section class="card auction">');
    }
    if(a?.mystery&&a.outcome===null){
      const c=CARDS[a.charId];
      const actual=charCard(c);
      const t=tierOf(c.power);
      const mysteryCard='<article class="card character-card mystery-character" style="--tier-glow:'+t.glow+'"><div class="card-top"><span class="wanted">🔒 ENCHÈRE MYSTÈRE</span><span class="tier" style="--tier-color:'+t.color+';--tier-border:'+t.color+'">Classe '+t.tier+'</span></div><div class="mystery-symbol">❔</div><h1 class="mystery-title">Qui se cache derrière cette carte ?</h1><p>Seul son rang est révélé. Son identité et sa puissance seront dévoilées après l’enchère.</p></article>';
      html=html.replace(actual,mysteryCard);
    }
    if(f?.awaitingRolls){
      const roller=state.players[f.rollIndex];
      const rolls=f.rolls.map(r=>'<span>'+esc(player(r.id)?.name||'')+' : 🎲 '+r.roll+' → '+currency(r.amount)+'</span>').join('');
      const die='<section class="card auction"><div class="marine-roll-content"><span class="eyebrow">Prime de la Marine</span><h2>🎲 Au tour de '+esc(roller?.name||'')+'</h2><p>Un dé à 6 faces détermine ton bonus : 1 = 5 %, 2 = 10 %, 3 = 15 %, 4 = 20 %, 5 = 25 %, 6 = 30 % du budget de départ.</p><button class="primary" data-action="marine-roll">🎲 Lancer mon dé</button><div class="marine-history">'+rolls+'</div></div></section>';
      const begin=html.indexOf('<section class="card auction">');
      const end=html.indexOf('</section>',begin);
      if(begin>=0&&end>begin)html=html.slice(0,begin)+die+html.slice(end+10);
      return html;
    }
    const p=currentPlayer();
    if(p){
      const powers='<div class="extra-powers">'+
        '<button data-action="observation" class="extra-power" '+(p.observationUsed?'disabled':'')+'>👁 Observation <small>'+(p.observationUsed?'Déjà utilisé':'Voir les 3 prochaines cartes')+'</small></button>'+
        '<span class="extra-power op21-armament-status">🛡 Armement <small>'+(p.armamentUsed?'Déjà utilisé':'Proposé à la prochaine recrue de 60 pts ou moins')+'</small></span>'+
        '</div>';
      const marker='<button class="pass-btn" data-action="pass"';
      html=html.replace(marker,powers+marker);
    }
    if(a?.outcome==='sold'&&a.leader!==null&&a.leader!==undefined){
      const winner=player(a.leader),card=CARDS[a.charId];
      if(winner&&!winner.armamentUsed&&card?.power<=60&&!a.armamentChoice){
        html=html.replace('data-action="next"','data-action="next" disabled aria-disabled="true"');
        html+='<div class="op21-armament-overlay"><section class="card op21-armament-modal"><small>🛡 HAKI DE L’ARMEMENT</small><h2>'+esc(winner.name)+', renforce ta recrue !</h2><p>'+esc(card.name)+' possède '+card.power+' points. Veux-tu lui offrir <b>+'+(winner.ship==='polartang'?40:20)+' points</b> ?</p><div class="op21-power-evolution">'+card.power+' <span>→</span> '+Math.min(100,card.power+(winner.ship==='polartang'?40:20))+'</div><button class="primary" data-action="armament-recruit">🛡 Utiliser le Haki</button><button class="btn-ghost" data-action="armament-defer">Conserver pour plus tard</button></section></div>';
      }
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
      const smileHtml=(p.roster||[]).filter(id=>p.smileModifiers?.[id]!==undefined)
        .map(id=>'<span class="active-synergy">🍎 '+esc(CARDS[id]?.name||id)+
          ' : '+effectivePower(p,id)+' pts · rang '+tierOf(CARDS[id]?.power||0).tier+'</span>').join('');
      const synergiesHtml=d.synergyItems.length?'<span class="active-synergy">🤝 '+d.synergyItems.map(s=>esc(s.name)+' ('+s.count+') +'+s.points).join(' · ')+'</span>':'';
      return '<div class="power-breakdown">Base '+d.base+(d.armament?' + '+d.armament+' Armement':'')+(d.synergy?' + '+d.synergy+' synergies':'')+' = <strong>'+d.total+' points</strong></div>'+
        (safeBig(p.marineAward)>0n?'<div class="power-breakdown">🎲 Prime de la Marine : +'+currency(p.marineAward)+'</div>':'')+
        '<div class="special-stats">'+powers+synergiesHtml+smileHtml;
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
        entries.push({p,id,c:CARDS[id],power:effectivePower(p,id),price:p.purchases?.[id]});
      }
    }
    const best=entries.slice().sort((a,b)=>b.power-a.power)[0];
    const bought=entries.filter(e=>e.price!==undefined&&safeBig(e.price)>0n);
    const bargain=bought.sort((a,b)=>{
      const lhs=BigInt(a.power)*safeBig(b.price), rhs=BigInt(b.power)*safeBig(a.price);
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
      best?medal('💥','Meilleure recrue',esc(best.c.name)+' · '+best.power+' pts','Équipage de '+esc(best.p.name)):'',
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
        '<li>Haki de l’Armement : à chaque recrue de <b>60 points ou moins</b>, proposer un bonus de <b>+20 points définitifs</b> (ou le garder pour plus tard). Une utilisation par joueur.</li>'+
        '<li>Synergies par affiliation : 1 personnage = 0 point ; 2 = +10 ; 3 = +20 ; 4 = +30 ; 5 ou plus = +50. Chaque affiliation donne son propre bonus, cumulable avec les autres. Les anciennes synergies par combinaison ont été supprimées.</li>'+
        '<li>Huit événements possibles : Guerre au sommet, Prime de la Marine, Personnage mystère, Marché Noir, God Valley, SMILE, Rêverie et Coup de Burst. 1 événement pour 1 à 5 recrues, 2 pour 6 à 9, 3 à partir de 10. Chaque annonce reste affichée jusqu’à Continuer.</li>'+
        '<li>Rêverie : première mise obligatoire, puis retrait gratuit autorisé ; coût final doublé et Haki des Rois interdit. SMILE : chaque joueur lance une pièce (+25 ou −25 sur le personnage le plus faible, dans les limites 0 à 100).</li>');
    }
  };

  document.addEventListener('click',event=>{
    const b=event.target.closest('button[data-action="armament-recruit"],button[data-action="armament-defer"]');
    if(!b||!state?.auction||state.auction.outcome!=='sold')return;
    const a=state.auction,p=player(a.leader),c=CARDS[a.charId];
    if(!p||p.armamentUsed||!c||c.power>60||a.armamentChoice)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(b.dataset.action==='armament-recruit'){
      p.armamentUsed=true;p.armamentId=a.charId;p.armamentBonus=state?.v3&&p.ship==='polartang'?40:20;a.armamentChoice='used';
      showToast('🛡 '+c.name+' gagne +'+p.armamentBonus+' points !');
    } else a.armamentChoice='skip';
    save();render();
  },true);
  document.addEventListener('click',event=>{
    const b=event.target.closest('button[data-action^="v2-"]');
    if(!b||b.disabled||!state?.featureConfig?.plan)return;
    event.preventDefault();event.stopImmediatePropagation();
    const action=b.dataset.action;
    if(action==='v2-ready')v2Ready();
    else if(action==='v2-roll')v2Roll();
    else if(action==='v2-coin')v2Coin();
    else if(action==='v2-burst-offer')v2BurstOffer();
    else if(action==='v2-burst-coin')v2BurstCoin();
    else if(action==='v2-pick')v2Pick(b.dataset.id);
    else if(action==='v2-delete')v2Eliminate(b.dataset.id);
    else if(action==='v2-skip')v2Eliminate('');
  },true);
  const style=document.createElement('style');
  style.textContent=`
    .v2-local-special{margin:22px 0 8px;background:radial-gradient(circle at top,#355369,#122637 70%);
      border:2px solid #d0ab70;border-radius:23px;padding:30px 15px;text-align:center;color:#f8e8cb}
    .v2-local-special.v2-god,.v2-local-special.v2-war{background:linear-gradient(145deg,#4d2730,#102132);border-color:#dd7664}
    .v2-local-special.v2-black,.v2-local-special.v2-mystery{background:linear-gradient(145deg,#483358,#162734);border-color:#ae9bda}
    .v2-local-special.v2-burst{background:linear-gradient(145deg,#294f73,#0b273c);border-color:#f1be63}
    .v2-local-special.v2-smile{background:linear-gradient(145deg,#5d3926,#132836);border-color:#f1be63}
    .v2-local-special small{letter-spacing:.12em;color:#f5d69a}
    .v2-local-special h1{font-size:27px;color:#ffdb8f;margin:8px 0 25px}
    .v2-local-special p{font-size:14px;line-height:1.6}
    .v2-local-symbol{font-size:70px;animation:v2LocalBounce .85s infinite alternate;margin:18px auto}
    .v2-local-special button.primary{margin:20px auto 6px;max-width:360px}
    .v2-burst-card{margin:12px auto;max-width:440px}.v2-burst-card .character-card{margin:0 auto}
    .v2-burst-input{display:grid;gap:8px;text-align:left;max-width:340px;margin:20px auto}
    .v2-burst-input input{width:100%;border-radius:12px;padding:14px;font-size:18px;background:#f1ece0;color:#102a3d}
    .v2-local-choices{display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:10px;margin:18px 0}
    .v2-local-choices>div{display:grid;align-content:space-between;gap:8px;background:#234154;padding:13px 8px;border:1px solid #b69a6b;border-radius:14px}
    .v2-local-choices button{background:#e5bd77;color:#152635;border:none;border-radius:10px;padding:10px}
    .v2-local-hint{text-align:center;font-size:11px;color:#b7ced9;padding:14px}
    .v2-local-die{font-size:88px;animation:v2LocalBounce .7s infinite alternate}
    .v2-local-results p{background:#274456;border:1px solid #866e45;border-radius:9px;padding:10px}
    .v2-local-fx{position:fixed;z-index:3000;inset:0;background:#091e2bf0;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fbe8b1;font-size:22px;text-align:center;padding:16px}

    .v2-fx-stage{width:180px;height:180px;display:flex;align-items:center;justify-content:center;perspective:700px;margin:0 auto 25px}
    .v2-dice-cube{width:100px;height:100px;position:relative;transform-style:preserve-3d;animation:v2ActualDie 1.7s cubic-bezier(.17,.64,.31,1) forwards}
    .v2-dice-face{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:linear-gradient(145deg,#fff9e9,#e0d5be);
       color:#283748;border:4px solid #c79c58;border-radius:13px;font-size:65px;box-shadow:inset 0 0 14px #a99b7c}
    .v2-side-1{transform:translateZ(50px)}.v2-side-6{transform:rotateY(180deg) translateZ(50px)}
    .v2-side-3{transform:rotateY(90deg) translateZ(50px)}.v2-side-4{transform:rotateY(-90deg) translateZ(50px)}
    .v2-side-2{transform:rotateX(90deg) translateZ(50px)}.v2-side-5{transform:rotateX(-90deg) translateZ(50px)}
    @keyframes v2ActualDie{0%{transform:rotateX(0) rotateY(0) translateY(-65px) scale(.75)}
      48%{transform:rotateX(470deg) rotateY(660deg) translateY(-25px) scale(1.14)}
      100%{transform:rotateX(var(--dice-x)) rotateY(var(--dice-y)) translateY(0) scale(1)}}
    .v2-flip-coin{width:134px;height:134px;position:relative;transform-style:preserve-3d;animation:v2ActualCoin 1.7s ease-out forwards}
    .v2-coin-side{position:absolute;inset:0;backface-visibility:hidden;border:8px ridge #dfaa42;border-radius:50%;display:flex;
      align-items:center;justify-content:center;flex-direction:column;gap:4px;font-size:37px;background:radial-gradient(circle,#ffebb0,#d49d3c 75%);color:#392513;box-shadow:0 7px 24px #050608}
    .v2-coin-side span{font-size:18px;font-weight:950;letter-spacing:.12em}
    .v2-coin-face{transform:rotateY(180deg);background:radial-gradient(circle,#f8e5ad,#b88c3f 75%)}
    @keyframes v2ActualCoin{0%{transform:translateY(-90px) rotateY(0deg) scale(.7)}
      100%{transform:translateY(0) rotateY(var(--coin-flip)) scale(1)}}
    .v2-fx-result{display:block;font-size:21px;line-height:1.5;color:#ffe4a4;text-shadow:0 3px 7px #071926}
    @media(prefers-reduced-motion:reduce){.v2-dice-cube,.v2-flip-coin{animation-duration:.01ms}}

    @keyframes v2LocalSpin{to{transform:rotateY(180deg) rotateZ(30deg) scale(1.2)}}
    @keyframes v2LocalBounce{to{transform:scale(1.15) rotate(7deg)}}

    .marine-roll-content{text-align:center;padding:8px 0 3px}
    .marine-roll-content h2{margin:14px 0;font-size:23px}
    .marine-roll-content p{font-size:13px}
    .marine-history{display:grid;gap:6px;margin-top:15px}
    .marine-history span{color:#ffe6a6;font-size:12px;font-weight:750}
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
    .v2-god-results{display:grid;gap:12px;text-align:left;margin:20px 0}
    .v2-god-player{border:1px solid #bf7a60;border-radius:14px;padding:12px;background:#211d2d}
    .v2-god-player>strong{display:block;color:#ffd68b;margin-bottom:9px}
    .v2-god-lost{display:flex;align-items:center;gap:9px;color:#fff0e7;font-weight:750;font-size:13px}
    .v2-god-spared{color:#b7d2bf;font-size:13px}
    .op21-armament-overlay{position:fixed;inset:0;background:#061522e8;z-index:800;display:grid;place-items:center;padding:18px;overflow:auto}
    .op21-armament-modal{max-width:430px;width:100%;text-align:center;border:2px solid #e0b86b!important;box-shadow:0 18px 70px #0009}
    .op21-armament-modal h2{margin:12px 0;color:#fbdc99}.op21-armament-modal p{line-height:1.5}
    .op21-armament-modal button{display:block;width:100%;margin-top:10px}
    .op21-power-evolution{font-size:31px;color:#eec678;font-weight:950;padding:10px}.op21-power-evolution span{color:#a3bec9;padding:0 8px}
    .op21-armament-status{display:flex;flex-direction:column;justify-content:center;gap:4px;border:1px solid #56707e;padding:9px;border-radius:9px;font-size:12px}
    .op21-armament-status small{font-size:10px}
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
    if(['observation','armament','armament-choose','marine-roll'].includes(action)){
      event.preventDefault();event.stopImmediatePropagation();
      if(action==='observation')observation();
      else if(action==='armament')openArmament();
      else if(action==='marine-roll')rollMarineDie();
      else useArmament(button.dataset.charId);
    }
  },true);
  render();
})();
