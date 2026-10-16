(function(){
'use strict';
const SHIPS=[['sunny','Thousand Sunny','☀️','Coup de Vent','8 refus au lieu de 5 pour choisir tes recrues. La Rêverie impose toujours sa première mise.'],['redforce','Red Force','🐉','Terre Sainte','À chaque recrutement, bonus aléatoire +1, +2 ou +3 points (maximum 100). Ce bonus suit la recrue en cas de transfert.'],['mobydick','Moby Dick','🐋','Protection du Père','Réduction de 10 % sur le prix payé de toutes les enchères gagnées, événements spéciaux compris, après les multiplicateurs.'],['polartang','Polar Tang','💛','Opération de Jouvence','Une seule fois, ton Haki de l’Armement passe de +20 à +40, sur une recrue de puissance d’origine au plus 60 (maximum 100).'],['orojackson','Oro Jackson','👑','Vision du Futur','Remplace l’Observation : révèle les six prochaines recrues avec puissances et enchérisseurs, puis inverse une fois deux positions.']];
const V=()=>state?.v3,clamp=n=>Math.min(100,Math.max(0,n)),nm=id=>esc(CARDS[id]?.name||id);
const sh=id=>SHIPS.find(x=>x[0]===id),btn=(a,label)=>'<button class="primary" data-action="v3-'+a+'">'+label+'</button>';
const v3ShipStatus=p=>p.ship==='sunny'?(8-p.passesUsed)+' refus':p.ship==='redforce'?'Actif':p.ship==='mobydick'?'−10 %':p.ship==='polartang'?(p.armamentUsed?'Utilisé':'Prêt'):(p.observationUsed?'Utilisé':'Prêt');
const v3ShipImage=p=>p.ship?'<img class="v3-hud-ship" src="./opmercato-ships-sprite.webp" style="object-position:'+(SHIPS.findIndex(x=>x[0]===p.ship)*25)+'% 50%" alt="">':'';
const v3MiniHud=()=>'<div class="op21-local-hud v3-mini-hud">'+state.players.map(p=>'<div class="op21-hud-item"><b class="op21-hud-name">'+esc(p.name)+'</b><strong class="op21-hud-money">'+currency(p.budget)+'</strong><small class="op21-hud-stats">⭐ '+getScore(p)+' pts</small>'+(p.ship?'<small>'+v3ShipImage(p)+' '+v3ShipStatus(p)+'</small>':'')+'</div>').join('')+'</div>';
const oldStart=start,oldDraw=drawNext,oldScore=getScore,oldSettle=settle,oldRender=render,oldPass=pass;
const oldAuctionScreenV3=auctionScreen;
auctionScreen=function(){
 if(state?.v3&&state.phase==='auction'&&!state.auction){
   return '<section class="card auction"><h2>⚓ Prochaine enchère</h2><p>Le personnage est en préparation…</p></section>';
 }
 return oldAuctionScreenV3();
};
const oldScoreBoardV3=scoreBoard;
scoreBoard=function(){
 let html=oldScoreBoardV3();
 if(!V())return html;
 for(const p of state.players)for(const id of p.roster){
   const n=p.shipBonus?.[id];if(!n)continue;
   const c=CARDS[id];if(!c)continue;
   const marker=esc(c.name)+' <em>'+tierOf(c.power).tier+'</em>';
   html=html.replace(marker,marker+' <small class="v3-redforce-bonus">🐉 Terre Sainte +'+n+' · '+pow(p,id)+' pts</small>');
 }
 return html;
};
const oldResolved=resolvedScreen;
resolvedScreen=function(a,c){
 let html=oldResolved(a,c);
 if(!V()||a?.outcome!=='sold'||a.leader===null)return html;
 const p=player(a.leader);
 if(p?.ship==='redforce'&&p.shipBonus?.[a.charId]){
   const n=p.shipBonus[a.charId];
   html+='<div class="v3-redforce-result">🐉 Terre Sainte activée ! <strong>+'+n+' points</strong> · '+nm(a.charId)+' : '+pow(p,a.charId)+' points (rang inchangé)</div>';
 }
 if(!p||p.ship!=='mobydick'||!p.purchases?.[a.charId]||a.hakiWinner===a.leader)return html;
 const paid=BigInt(p.purchases[a.charId]),gross=BigInt(a.highBid)*(state.featureConfig?.active?.type==='reverie'?2n:1n);
 const saved=gross-paid;
 if(saved<=0n)return html;
 html=html.replace('pour <strong>'+currency(a.highBid)+'</strong>', 'pour <strong>'+currency(paid)+'</strong>');
 return html.replace('</p><button class="primary" data-action="next"', '</p><p>🐋 Protection du Père : −'+currency(saved)+' · Montant réellement payé : '+currency(paid)+'</p><button class="primary" data-action="next"');
};
const pow=(p,id)=>clamp((CARDS[id]?.power||0)+Number(p.smileModifiers?.[id]||0)+Number(p.shipBonus?.[id]||0)+(p.armamentId===id?Number(p.armamentBonus||0):0));
function synergy(ids){const m=new Map();for(const id of ids){const crew=window.MERCATO_EXPANSION?.details?.[id]?.crew;if(crew)m.set(crew,(m.get(crew)||0)+1);}return [...m.values()].reduce((a,n)=>a+(n>=5?50:n>=2?(n-1)*10:0),0);}
getScore=p=>V()?p.roster.reduce((s,id)=>s+pow(p,id),0)+synergy(p.roster):oldScore(p);
function recruit(p,id,bonus){if(p.ship==='redforce'){p.shipBonus=p.shipBonus||{};p.shipBonus[id]=bonus||1+Math.floor(Math.random()*3);}}
start=function(){const prior=state;oldStart();if(state&&state!==prior){
 const n=Math.floor(Math.random()*state.drawPile.length),secret=state.drawPile.splice(n,1)[0];
 state.round=0;state.drawIndex=0;state.auction=null;
 state.v3={phase:'intro',rolls:{},order:[],idx:0,starter:0,morgans:{id:secret,phase:'pending',guesses:{},shown:0,winner:null,ties:[],bonus:0,done:false},market:{done:false,order:[],idx:0,offer:null,result:null,locked:[],exchanges:[]}};
 state.players.forEach(p=>{p.ship=null;p.shipBonus={};});
 if(state.featureConfig){state.featureConfig.active=null;state.featureConfig.eventUsed=false;state.featureConfig.activatedRound=null;}
 save();render();
}};
settle=function(){if(!V())return oldSettle();const a=state.auction,p=a&&a.leader!==null?player(a.leader):null,n=p?.roster.length||0;oldSettle();if(p&&a.outcome==='sold'&&p.roster.length>n){
 recruit(p,a.charId);
 if(p.ship==='mobydick'&&a.hakiWinner!==a.leader){
 const before=BigInt(p.purchases?.[a.charId]||a.highBid||0),after=(before*90n+50n)/100n||1n;
 p.budget=(BigInt(p.budget)+before-after).toString();p.purchases[a.charId]=after.toString();state.v3.lastDiscount={id:a.charId,discount:String(before-after),paid:String(after)};
 }
 save();render();
}};
const dueM=()=>!V().morgans.done&&V().morgans.phase==='pending'&&state.players.every(p=>p.roster.length<TEAM_SIZE)&&
 (TEAM_SIZE===1||state.round>=Math.max(2,Math.floor(TEAM_SIZE*state.players.length*.3))||state.players.some(p=>p.roster.length>=TEAM_SIZE-1));
const dueT=()=>TEAM_SIZE>=2&&!V().market.done&&state.players.every(p=>p.roster.length>=Math.ceil(TEAM_SIZE/2));
drawNext=function(){if(!V())return oldDraw();if(V().phase!=='auction')return;
 if(dueM()){V().phase='morgans';V().morgans.phase='intro';state.auction=null;save();render();return;}
 if(dueT()){const t=V().market;t.order=shuffle(state.players.map(p=>p.id));t.idx=0;t.offer=null;t.result=null;t.locked=[];t.exchanges=[];V().phase='market';state.auction=null;save();render();return;}
 oldDraw();if(state.phase==='auction'&&state.auction){
 const normal=(V().starter+state.round-1)%state.players.length;
 const wanted=V().oroOpeners?.[state.auction.charId]??normal;
 const id=findNextBidder((wanted+state.players.length-1)%state.players.length,state.auction);
 state.auction.turnId=id;state.auction.firstTurnId=id;save();render();
 }};
function resume(){V().phase='auction';drawNext();}
function tradeScore(p,give,take){const ids=p.roster.map(id=>id===give?take:id),owner=state.players.find(x=>x.roster.includes(take));return ids.reduce((s,id)=>s+(id===take?clamp((CARDS[id]?.power||0)+Number(owner?.shipBonus?.[id]||0)+Number(owner?.smileModifiers?.[id]||0)):pow(p,id)),0)+synergy(ids);}
function swap(o){const a=player(o.from),b=player(o.to);
 a.roster=a.roster.map(id=>id===o.give?o.take:id);b.roster=b.roster.map(id=>id===o.take?o.give:id);
 for(const k of ['smileModifiers','shipBonus']){a[k]=a[k]||{};b[k]=b[k]||{};const left=a[k][o.give],right=b[k][o.take];delete a[k][o.give];delete b[k][o.take];if(left!==undefined)b[k][o.give]=left;if(right!==undefined)a[k][o.take]=right;}
 if(a.armamentId===o.give)a.armamentId=null;if(b.armamentId===o.take)b.armamentId=null;
 V().market.locked.push(o.give,o.take);V().market.exchanges.push(o);
}
function tradeTile(p,id,value){
 const c=CARDS[id],power=value===undefined?pow(p,id):value;
 return '<div class="v3-trade-person"><span class="v3-trade-face"><img class="portrait-photo v3-trade-face-img" data-portrait-id="'+esc(id)+'" alt="" loading="lazy"></span><strong class="v3-trade-person-name">'+nm(id)+'</strong><span class="v3-trade-person-rank">Rang '+tierOf(c.power).tier+' · <b>'+power+' pts</b></span></div>';
}
function tradeComparison(a,b,give,take,givePower,takePower){
 return '<div class="v3-trade-compact">'+tradeTile(a,give,givePower)+'<span class="v3-trade-arrow" aria-hidden="true">⇄</span>'+tradeTile(b,take,takePower)+'</div>';
}
function nextTrade(){const t=V().market;t.offer=null;t.result=null;t.idx++;if(t.idx>=t.order.length){t.done=true;resume();}else{save();render();}}
function screen(){const v=V(),m=v.morgans,t=v.market;
 if(v.phase==='intro')return '<div class="v3-start-intro"><div class="v3-intro-symbols">🎲 ⛵</div><h2>Que l’aventure commence !</h2><p>Avant les enchères, chaque pirate lance un dé à six faces.</p><div class="v3-intro-steps"><p><b>1.</b> Tout le monde lance son dé. En cas d’égalité, seuls les ex æquo relancent.</p><p><b>2.</b> Le plus grand résultat choisit son navire en premier, puis les autres dans l’ordre.</p><p><b>3.</b> Chaque navire est unique et donne un pouvoir pour toute la partie.</p><p><b>4.</b> Le dernier à choisir son navire ouvre la première enchère. Ensuite les premiers enchérisseurs alternent.</p></div>'+btn('intro-continue','⚔️ Commencer les lancers')+'</div>';
 if(v.phase==='dice'||v.phase==='dice-tie'){
  const tied=v.phase==='dice-tie',group=tied?v.tieGroups[v.tieIndex]:state.players.map(p=>p.id);
  const rolls=tied?v.tieRolls:v.rolls,nextId=group.find(id=>rolls[id]===undefined);
  return '<h2>🎲 '+(tied?'Égalité : relance entre ex æquo':'Lancer de dé initial')+'</h2>'+
    '<p>Le meilleur résultat choisit le navire en premier, le dernier commence les enchères.</p>'+
    group.map(id=>'<p>'+esc(player(id).name)+' : 🎲 '+(rolls[id]??'?')+'</p>').join('')+
    (nextId===undefined?'':'<h3>Au tour de '+esc(player(nextId).name)+'</h3>'+btn('roll','🎲 Lancer le dé'));
 }
 if(v.phase==='ships'){const p=player(v.order[v.idx]);return '<h2>⛵ Choix du navire</h2><h3>'+esc(p.name)+' choisit</h3><div class="v3-ship-grid">'+
  SHIPS.map(s=>'<div class="v3-ship"><img src="./opmercato-ships-sprite.webp" style="object-position:'+(SHIPS.findIndex(q=>q[0]===s[0])*25)+'% 50%" alt="'+s[1]+'"><b>'+s[2]+' '+s[1]+'</b><small>'+s[3]+'</small><p>'+s[4]+'</p>'+
  (state.players.some(p=>p.ship===s[0])?'<p>Indisponible</p>':btn('ship-'+s[0],'Choisir'))+'</div>').join('')+'</div>';}
 if(v.phase==='morgans'){
  let h='<h2>📰 Prédictions de Morgans</h2><p>Devine la puissance initiale du personnage secret.</p>';
  if(m.phase==='intro')h+=btn('morgans-ready','Continuer');
  if(m.phase==='guess'){const p=state.players.find(p=>m.guesses[p.id]===undefined);h+='<h3>'+esc(p.name)+' : ta prédiction confidentielle</h3><input id="v3-guess" type="number" min="1" max="100">'+btn('morgans-guess','🔒 Confirmer');}
  if(!['intro','guess'].includes(m.phase)){h+='<div class="v3-morgans-portrait">'+charCard(CARDS[m.id])+'</div><h3>'+nm(m.id)+' · '+CARDS[m.id].power+' pts · rang '+tierOf(CARDS[m.id].power).tier+'</h3>';
   const seen=m.phase==='character'?0:m.phase==='reveal'?m.shown:state.players.length;
   h+=state.players.map((p,i)=>'<p>'+esc(p.name)+' : '+(i<seen?m.guesses[p.id]+' · écart '+Math.abs(m.guesses[p.id]-CARDS[m.id].power):'🔒')+'</p>').join('');
  }
  if(['character','reveal','winner'].includes(m.phase))h+=btn('morgans-next','Continuer');
  if(m.phase==='wheel')h+='<div class="v3-wheel">🎡</div>'+btn('morgans-wheel','Tourner la roue');
  if(['winner','offer','armament'].includes(m.phase))h+='<h3>🏆 '+esc(player(m.winner).name)+'</h3>';
  if(m.phase==='offer'){const recipient=player(m.winner),previewPlayer={...recipient,roster:[...recipient.roster,m.id],shipBonus:{...recipient.shipBonus,[m.id]:recipient.ship==='redforce'?m.bonus:0}};const gain=getScore(previewPlayer)-getScore(recipient);h+='<p>Recrutement gratuit · '+(m.bonus?'Terre Sainte +'+m.bonus+' · ':'')+'Gain total estimé : <strong>+'+gain+' points</strong>, synergies comprises.</p>'+btn('morgans-accept','Accepter la recrue')+btn('morgans-reject','Refuser');}
  if(m.phase==='armament')h+=btn('morgans-armament','🛡 Utiliser le Haki +'+(player(m.winner).ship==='polartang'?40:20))+btn('morgans-skip','Conserver mon Haki');
  return h;
 }
 if(v.phase==='market'){
  const p=player(t.order[t.idx]);
  let h='<h2>🔄 Marché des transferts</h2><p class="v3-trade-step">Proposition '+(t.idx+1)+'/'+t.order.length+' · Au tour de <b>'+esc(p.name)+'</b></p>';
  if(t.result){
   const o=t.result,a=player(o.from),b=player(o.to);
   h+='<section class="v3-trade-decision" aria-live="polite"><div class="v3-trade-symbol">'+(o.accepted?'✅':'❌')+'</div><h3>'+(o.accepted?'Échange accepté !':'Échange refusé')+'</h3>'+
     '<p>'+esc(a.name)+' et '+esc(b.name)+'</p>'+tradeComparison(a,b,o.give,o.take,o.givePower,o.takePower)+
     (o.accepted?'<p class="v3-trade-effect">Bilan : <b>'+esc(a.name)+' '+(o.deltaFrom>=0?'+':'')+o.deltaFrom+' pts</b> · <b>'+esc(b.name)+' '+(o.deltaTo>=0?'+':'')+o.deltaTo+' pts</b></p>':
     '<p class="v3-trade-effect">Les deux équipages restent inchangés.</p>')+
     btn('trade-continue',t.idx+1>=t.order.length?'Continuer vers les enchères →':'Continuer le marché →')+'</section>';
  }else if(t.offer){
   const o=t.offer,a=player(o.from),b=player(o.to);
   h+='<p>'+esc(a.name)+' propose un échange à '+esc(b.name)+'</p>'+tradeComparison(a,b,o.give,o.take)+
     '<p class="v3-trade-effect">Impact estimé : <b>'+esc(a.name)+' '+(tradeScore(a,o.give,o.take)-getScore(a))+' pts</b> · <b>'+esc(b.name)+' '+(tradeScore(b,o.take,o.give)-getScore(b))+' pts</b></p>'+
     btn('trade-accept','✅ Accepter l’échange')+btn('trade-reject','Refuser l’échange');
  }else{
   const people=state.players.filter(x=>x.id!==p.id&&x.roster.some(id=>!t.locked.includes(id)));
   h+='<label>Adversaire<select id="v3-target">'+people.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join('')+'</select></label>'+
     '<label>Ton personnage<select id="v3-give">'+p.roster.filter(id=>!t.locked.includes(id)).map(id=>'<option value="'+id+'">'+nm(id)+'</option>').join('')+'</select></label>'+
     '<label>Personnage souhaité<select id="v3-take"></select></label><p id="v3-preview"></p>'+
     btn('trade-offer','Proposer')+btn('trade-pass','Passer');
  }
  return h;
 }return '';
}
function preview(){const v=V();if(v?.phase!=='market'||v.market.offer)return;
 const p=player(v.market.order[v.market.idx]),a=document.querySelector('#v3-target'),g=document.querySelector('#v3-give'),t=document.querySelector('#v3-take');if(!a||!g||!t)return;
 const target=player(Number(a.value)),prior=t.value;t.innerHTML=(target?.roster||[]).filter(id=>!v.market.locked.includes(id)).map(id=>'<option value="'+id+'">'+nm(id)+'</option>').join('');
 if([...t.options].some(x=>x.value===prior))t.value=prior;
 const x=document.querySelector('#v3-preview');if(x&&g.value&&t.value)x.textContent=p.name+' : '+(tradeScore(p,g.value,t.value)-getScore(p))+' pts · '+target.name+' : '+(tradeScore(target,t.value,g.value)-getScore(target))+' pts';
}
let v3RestoringAuction=false;
render=function(){
 if(V()?.phase==='auction'&&state.phase==='auction'&&!state.auction){
   if(!v3RestoringAuction){
     v3RestoringAuction=true;
     try{drawNext();}finally{v3RestoringAuction=false;}
     if(state.auction||state.phase==='finished'||V()?.phase!=='auction')return;
   }
   app.innerHTML='<section class="card v3-screen"><h2>⚓ Prochain recrutement</h2><p>Le prochain personnage est en préparation.</p><button class="primary" data-action="next">Continuer →</button></section>';
   return;
 }
 if(V()&&['intro','dice','ships','morgans','market'].includes(V().phase)){
 app.innerHTML=v3MiniHud()+'<section class="card v3-screen"><span class="eyebrow">OPMERCATO 3.0</span>'+screen()+'</section>'+
  '<div class="v3-players-mini">'+state.players.map(p=>esc(p.name)+' : '+currency(p.budget)+' · '+getScore(p)+' pts').join('<hr>')+'</div>';preview();window.OPMERCATO_SHARED?.refreshImages?.();return;}
 oldRender();if(V()){app.querySelectorAll('.player-card').forEach((node,i)=>{const p=state.players[i],s=sh(p.ship);if(!s)return;
 node.querySelector('.player-header')?.insertAdjacentHTML('afterend','<div class="v3-team-ship"><img src="./opmercato-ships-sprite.webp" style="object-position:'+(SHIPS.findIndex(q=>q[0]===s[0])*25)+'% 50%" alt=""><span class="v3-team-ship-name"><strong>'+esc(s[1])+'</strong><small>'+esc(s[3])+'</small></span><span class="v3-team-ship-status">'+
 (p.ship==='sunny'?(8-p.passesUsed)+' refus':p.ship==='mobydick'?'−10 %':p.ship==='redforce'?'Actif':p.ship==='polartang'?(p.armamentUsed?'Utilisé':'Prêt'):(p.observationUsed?'Utilisé':'Prêt'))+'</span></div>');});}};

function v3OroScreen(){
 const v=V(),items=v.oroPeek||[];
 const make=(key,initial)=>'<select id="'+key+'">'+items.map((x,i)=>'<option value="'+i+'" '+(i===initial?'selected':'')+'>'+(i+1)+'. '+nm(x.id)+'</option>').join('')+'</select>';
 modal.innerHTML='<section class="card modal-content v3-oro-modal"><span class="eyebrow">👑 Vision du Futur</span>'+
 '<h2>Les '+items.length+' prochaines cartes</h2><div class="v3-oro-grid">'+items.map((x,i)=>
  '<div class="v3-oro-card"><small>Position '+(i+1)+'</small><span class="v3-face-clip"><img class="portrait-photo v3-face-image" data-portrait-id="'+esc(x.id)+'" alt="" loading="lazy"></span><b>'+nm(x.id)+'</b>'+
  '<span>Rang '+tierOf(CARDS[x.id].power).tier+' · '+CARDS[x.id].power+' pts</span>'+
  '<small>Premier à miser : '+esc(player(x.first).name)+'</small></div>').join('')+'</div>'+
 (items.length>=2&&!v.oroSwapped?'<h3>🔀 Échanger deux positions</h3><div class="v3-oro-pair">'+make('v3-oro-a',0)+make('v3-oro-b',1)+'</div>'+
 '<p id="v3-oro-preview">Aperçu : positions 1 et 2 échangées ; premiers enchérisseurs inchangés.</p>'+
 '<button class="primary" data-action="v3-oro-confirm">Confirmer l’inversion</button>':'')+
 '<button class="btn-ghost" data-action="close-modal">Continuer sans autre inversion</button></section>';
 modal.classList.remove('hidden');window.OPMERCATO_SHARED?.refreshImages?.();
}
function v3UseOro(){
 const a=state?.auction,p=a?.turnId!==null?player(a?.turnId):null;
 if(!V()||!p||p.ship!=='orojackson'||p.observationUsed||a.outcome!==null)return false;
 p.observationUsed=true;
 V().oroPeek=state.drawPile.slice(state.drawIndex,state.drawIndex+6).map((id,i)=>({id,first:(V().starter+state.round+i)%state.players.length}));
 V().oroLocked=V().oroPeek.map(x=>x.id);
 V().oroOpeners=Object.fromEntries(V().oroPeek.map(x=>[x.id,x.first]));
 V().oroSwapped=false;
 save();render();v3OroScreen();return true;
}

window.OPMERCATO_V3_ORO=v3UseOro;
document.addEventListener('change',e=>{if(['v3-target','v3-give','v3-take'].includes(e.target.id))preview();},true);
document.addEventListener('change',e=>{
 if(['v3-oro-a','v3-oro-b'].includes(e.target.id)){
 const a=Number(document.querySelector('#v3-oro-a')?.value),b=Number(document.querySelector('#v3-oro-b')?.value);
 const out=document.querySelector('#v3-oro-preview');
 if(out)out.textContent=a===b?'Choisis deux positions distinctes.':'Aperçu : '+(a+1)+' et '+(b+1)+' échangées, sans changer les premiers enchérisseurs.';
 }
},true);
document.addEventListener('click',e=>{
 const b=e.target.closest('button[data-action]');if(!b||!V())return;
 if(b.dataset.action==='observation'&&state.auction?.turnId!==null&&player(state.auction.turnId)?.ship==='orojackson'){
  e.preventDefault();e.stopImmediatePropagation();v3UseOro();return;
 }
 if(b.dataset.action==='v3-oro-confirm'){
  e.preventDefault();e.stopImmediatePropagation();
  const a=Number(document.querySelector('#v3-oro-a')?.value),c=Number(document.querySelector('#v3-oro-b')?.value);
  const v=V();if(!Number.isInteger(a)||!Number.isInteger(c)||a===c||v.oroSwapped)return showToast('Choisis deux positions différentes.');
  const first=state.drawIndex+a,second=state.drawIndex+c;
  [state.drawPile[first],state.drawPile[second]]=[state.drawPile[second],state.drawPile[first]];
  [v.oroPeek[a].id,v.oroPeek[c].id]=[v.oroPeek[c].id,v.oroPeek[a].id];
  v.oroOpeners=Object.fromEntries(v.oroPeek.map(x=>[x.id,x.first]));v.oroSwapped=true;
  save();render();v3OroScreen();return;
 }
},true);
document.addEventListener('click',async e=>{const b=e.target.closest('button[data-action^="v3-"]');if(!b||!V())return;e.preventDefault();e.stopImmediatePropagation();
 const a=b.dataset.action.slice(3),v=V(),m=v.morgans,t=v.market;
 if(a==='intro-continue'){v.phase='dice';}
 else if(a==='roll'){
 if(b.disabled)return;b.disabled=true;b.setAttribute('aria-busy','true');
 const tied=v.phase==='dice-tie',group=tied?v.tieGroups[v.tieIndex]:state.players.map(p=>p.id);
 const rolls=tied?v.tieRolls:v.rolls,id=group.find(id=>rolls[id]===undefined);if(id===undefined)return;
 rolls[id]=1+Math.floor(Math.random()*6);
 await window.OPMERCATO_V3_DICE?.play(rolls[id],player(id).name);
 if(group.every(who=>rolls[who]!==undefined)){
  const buckets=new Map();
  for(const who of group){const n=rolls[who];buckets.set(n,[...(buckets.get(n)||[]),who]);}
  const newGroups=[...buckets.entries()].sort((x,y)=>y[0]-x[0]).map(([n,ids])=>ids);
  if(!tied)v.tieGroups=newGroups;else v.tieGroups.splice(v.tieIndex,1,...newGroups);
  v.tieIndex=v.tieGroups.findIndex(xs=>xs.length>1);v.tieRolls={};
  if(v.tieIndex<0){v.order=v.tieGroups.flat();v.starter=v.order.at(-1);v.phase='ships';}
  else v.phase='dice-tie';
 }
 }
 else if(a.startsWith('ship-')){const id=a.slice(5),p=player(v.order[v.idx]);if(!sh(id)||state.players.some(q=>q.ship===id))return;p.ship=id;p.shipBonus={};v.idx++;if(v.idx>=state.players.length){resume();return;}}
 else if(a==='morgans-ready')m.phase='guess';
 else if(a==='morgans-guess'){const n=Number(document.querySelector('#v3-guess')?.value),p=state.players.find(p=>m.guesses[p.id]===undefined);if(!p||!Number.isInteger(n)||n<1||n>100)return showToast('Entre 1 et 100');m.guesses[p.id]=n;if(Object.keys(m.guesses).length===state.players.length)m.phase='character';}
 else if(a==='morgans-next'){if(m.phase==='character')m.phase='reveal';else if(m.phase==='reveal'){m.shown++;if(m.shown>=state.players.length){
  const dist=state.players.map(p=>({id:p.id,d:Math.abs(m.guesses[p.id]-CARDS[m.id].power)})),min=Math.min(...dist.map(x=>x.d));m.ties=dist.filter(x=>x.d===min).map(x=>x.id);m.winner=m.ties.length===1?m.ties[0]:null;m.phase=m.ties.length===1?'winner':'wheel';}}
  else if(m.phase==='winner'){m.phase='offer';if(player(m.winner).ship==='redforce')m.bonus=1+Math.floor(Math.random()*3);}}
 else if(a==='morgans-wheel'){m.winner=m.ties[Math.floor(Math.random()*m.ties.length)];m.phase='winner';}
 else if(a==='morgans-accept'||a==='morgans-reject'){const p=player(m.winner);if(a==='morgans-accept'){p.roster.push(m.id);p.purchases[m.id]='0';recruit(p,m.id,m.bonus);}m.done=true;
  if(a==='morgans-accept'&&!p.armamentUsed&&CARDS[m.id].power<=60)m.phase='armament';else{m.phase='done';resume();return;}}
 else if(a==='morgans-armament'||a==='morgans-skip'){if(a==='morgans-armament'){const p=player(m.winner);p.armamentId=m.id;p.armamentUsed=true;p.armamentBonus=p.ship==='polartang'?40:20;}m.phase='done';resume();return;}
 else if(a==='trade-pass'){nextTrade();return;}
 else if(a==='trade-offer'){const p=player(t.order[t.idx]),to=Number(document.querySelector('#v3-target')?.value),give=document.querySelector('#v3-give')?.value,take=document.querySelector('#v3-take')?.value;if(!p.roster.includes(give)||!player(to)?.roster.includes(take))return;t.offer={from:p.id,to,give,take};}
 else if(a==='trade-accept'||a==='trade-reject'){
  if(!t.offer||t.result)return;
  const o=t.offer,from=player(o.from),to=player(o.to),accepted=a==='trade-accept';
  const beforeFrom=getScore(from),beforeTo=getScore(to);
  const givePower=pow(from,o.give),takePower=pow(to,o.take);
  if(accepted)swap(o);
  t.result={...o,accepted,givePower,takePower,deltaFrom:getScore(from)-beforeFrom,deltaTo:getScore(to)-beforeTo};
  t.offer=null;
 }
 else if(a==='trade-continue'){if(!t.result)return;nextTrade();return;}
 save();render();
},true);
const css=document.createElement('style');css.textContent='.v3-screen{text-align:center;padding:20px;margin:16px 0}.v3-screen h2{color:#f6d28f;font-size:26px}.v3-screen .primary{display:block;width:100%;margin:10px 0}.v3-screen input,.v3-screen select{width:100%;background:#163544;color:#fff;border:1px solid #b98e56;border-radius:10px;padding:12px;margin:8px 0}.v3-ship-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:8px}.v3-ship{display:grid;gap:7px;background:#23465c;padding:8px;border-radius:13px}.v3-ship img{width:100%;aspect-ratio:1;object-fit:cover}.v3-ship small,.v3-ship p{font-size:12px}.v3-players-mini{font-size:12px;padding:10px;color:#c5d4dd}.v3-ship-mini{font-size:11px;color:#f4ca87}.v3-wheel{font-size:80px;animation:v3spin 2s linear infinite}@keyframes v3spin{to{transform:rotate(360deg)}}';
css.textContent+='.v3-face-clip{display:block!important;position:relative!important;width:60px!important;height:60px!important;max-width:60px!important;max-height:60px!important;flex:none!important;overflow:hidden!important;contain:layout paint!important;margin:4px auto!important;border:2px solid #d5ad68;border-radius:50%!important;background:#234258}.v3-face-clip>.portrait-photo.v3-face-image{position:absolute!important;inset:0!important;display:block!important;width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;min-width:0!important;object-fit:cover!important;object-position:center 22%!important;border-radius:50%!important;transform:none!important}.v3-oro-card{min-width:0;overflow:hidden;align-items:center}.v3-oro-card b{overflow-wrap:anywhere;font-size:12px;line-height:1.2}.v3-oro-modal{max-width:660px;width:min(100%,660px);max-height:88dvh;overflow-y:auto;overflow-x:hidden;box-sizing:border-box}.v3-team-ship{display:flex;align-items:center;gap:9px;padding:9px 11px;margin-top:9px;background:#0d2636b8;border:1px solid #8d7557;border-radius:12px;min-width:0}.v3-team-ship>img{width:40px;height:40px;flex:none;object-fit:cover;border-radius:50%;border:1px solid #d2b17c}.v3-team-ship-name{display:grid;gap:2px;flex:1;min-width:0;color:#fce1ae}.v3-team-ship-name strong{font-size:13px;overflow-wrap:anywhere}.v3-team-ship-name small{font-size:11px;color:#c4d9e1}.v3-team-ship-status{font-size:11px;font-weight:800;color:#d6f5e0;background:#315647;border-radius:99px;padding:5px 8px;flex:none}.v3-ship{padding:11px;align-content:start;gap:8px}.v3-ship p{line-height:1.45;font-size:12px!important;color:#e5ecf0}.v3-redforce-result{padding:14px;text-align:center;background:#183b50;border:1px solid #e0af67;border-radius:12px;color:#ffdc93;font-size:14px;margin:12px auto}.v3-redforce-bonus{display:block;font-size:10px;font-weight:800;color:#eed092}.v3-intro-symbols{font-size:66px;filter:drop-shadow(0 8px 14px #0007);margin:12px 0}.v3-start-intro{max-width:620px;margin:auto}.v3-intro-steps{text-align:left;display:grid;gap:8px;margin:22px auto}.v3-intro-steps p{margin:0;padding:12px;border:1px solid #97794d;border-radius:12px;background:#1a3647;line-height:1.5}.v3-oro-photo{width:100%;height:auto;aspect-ratio:1;object-fit:cover;border-radius:8px;background:#31556a}.v3-hud-ship{width:24px;height:24px;border-radius:50%;object-fit:cover;display:inline-block;vertical-align:middle;margin-right:3px}.v3-mini-hud{margin-top:8px}.v3-morgans-portrait{max-width:400px;margin:10px auto}.v3-trade-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.v3-trade-cards .character-card{min-width:0;min-height:185px;padding:10px}.v3-trade-cards .character-name{font-size:18px;margin:20px 0 10px}.v3-trade-cards .power strong{font-size:23px}.v3-oro-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.v3-oro-card{display:grid;gap:3px;padding:8px;border:1px solid #94764f;border-radius:10px;background:#183b50;font-size:11px}.v3-oro-card span,.v3-oro-card small{font-size:10px;color:#cfdeed}.v3-oro-pair{display:grid;grid-template-columns:1fr 1fr;gap:9px}';
css.textContent+=".v3-trade-step{font-size:14px;color:#cbd8e4}.v3-trade-compact{width:100%;max-width:540px;display:grid;grid-template-columns:minmax(0,1fr) 25px minmax(0,1fr);align-items:center;gap:6px;margin:15px auto}.v3-trade-person{display:flex;flex-direction:column;align-items:center;gap:7px;min-width:0;padding:12px 6px;background:#19354a;border:1px solid #927a59;border-radius:14px;box-sizing:border-box;overflow:hidden}.v3-trade-face{position:relative;display:block;width:72px;height:72px;max-width:100%;overflow:hidden;border-radius:50%;border:2px solid #d2b17c;background:#29475a;flex:none}.v3-trade-face>.portrait-photo.v3-trade-face-img{display:block!important;position:absolute!important;inset:0!important;width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;object-fit:cover!important;object-position:center 22%!important;transform:none!important;border-radius:50%!important}.v3-trade-person-name{font-size:clamp(12px,3.4vw,17px);line-height:1.3;text-align:center;overflow-wrap:anywhere;max-width:100%}.v3-trade-person-rank{font-size:11px;line-height:1.4;color:#d0dce5}.v3-trade-arrow{font-size:25px;color:#efcb8b}.v3-trade-effect{font-size:13px;line-height:1.6;color:#ffdc9c;overflow-wrap:anywhere;margin:14px 0}.v3-trade-decision{border:1px solid #c7a575;border-radius:16px;background:#142e42;padding:14px 10px;margin-top:15px}.v3-trade-decision h3{font-size:22px;color:#f8d690}.v3-trade-symbol{font-size:42px}";
document.head.appendChild(css);
})();