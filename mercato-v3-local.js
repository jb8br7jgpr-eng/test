(function(){
'use strict';
const SHIPS=[['sunny','Thousand Sunny','☀️','Coup de Vent','+3 refus'],['redforce','Red Force','🐉','Terre Sainte','+1 à +3 par recrue'],['mobydick','Moby Dick','🐋','Protection du Père','−10 % sur les enchères'],['polartang','Polar Tang','💛','Opération de Jouvence','Armement +40'],['orojackson','Oro Jackson','👑','Vision du Futur','Six cartes et une inversion']];
const V=()=>state?.v3,clamp=n=>Math.min(100,Math.max(0,n)),nm=id=>esc(CARDS[id]?.name||id);
const sh=id=>SHIPS.find(x=>x[0]===id),btn=(a,label)=>'<button class="primary" data-action="v3-'+a+'">'+label+'</button>';
const oldStart=start,oldDraw=drawNext,oldScore=getScore,oldSettle=settle,oldRender=render,oldPass=pass;
const pow=(p,id)=>clamp((CARDS[id]?.power||0)+Number(p.smileModifiers?.[id]||0)+Number(p.shipBonus?.[id]||0)+(p.armamentId===id?Number(p.armamentBonus||0):0));
function synergy(ids){const m=new Map();for(const id of ids){const crew=window.MERCATO_EXPANSION?.details?.[id]?.crew;if(crew)m.set(crew,(m.get(crew)||0)+1);}return [...m.values()].reduce((a,n)=>a+(n>=5?50:n>=2?(n-1)*10:0),0);}
getScore=p=>V()?p.roster.reduce((s,id)=>s+pow(p,id),0)+synergy(p.roster):oldScore(p);
function recruit(p,id,bonus){if(p.ship==='redforce'){p.shipBonus=p.shipBonus||{};p.shipBonus[id]=bonus||1+Math.floor(Math.random()*3);}}
start=function(){const prior=state;oldStart();if(state&&state!==prior){
 const n=Math.floor(Math.random()*state.drawPile.length),secret=state.drawPile.splice(n,1)[0];
 state.round=0;state.drawIndex=0;state.auction=null;
 state.v3={phase:'dice',rolls:{},order:[],idx:0,starter:0,morgans:{id:secret,phase:'pending',guesses:{},shown:0,winner:null,ties:[],bonus:0,done:false},market:{done:false,order:[],idx:0,offer:null,locked:[],exchanges:[]}};
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
 if(dueT()){const t=V().market;t.order=shuffle(state.players.map(p=>p.id));t.idx=0;t.offer=null;t.locked=[];t.exchanges=[];V().phase='market';state.auction=null;save();render();return;}
 oldDraw();if(state.phase==='auction'&&state.auction){
 const wanted=(V().starter+state.round-1)%state.players.length;
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
function nextTrade(){const t=V().market;t.offer=null;t.idx++;if(t.idx>=t.order.length){t.done=true;resume();}else{save();render();}}
function screen(){const v=V(),m=v.morgans,t=v.market;
 if(v.phase==='dice'||v.phase==='dice-tie'){
  const tied=v.phase==='dice-tie',group=tied?v.tieGroups[v.tieIndex]:state.players.map(p=>p.id);
  const rolls=tied?v.tieRolls:v.rolls,nextId=group.find(id=>rolls[id]===undefined);
  return '<h2>🎲 '+(tied?'Égalité : relance entre ex æquo':'Lancer de dé initial')+'</h2>'+
    '<p>Le meilleur résultat choisit le navire en premier, le dernier commence les enchères.</p>'+
    group.map(id=>'<p>'+esc(player(id).name)+' : 🎲 '+(rolls[id]??'?')+'</p>').join('')+
    (nextId===undefined?'':'<h3>Au tour de '+esc(player(nextId).name)+'</h3>'+btn('roll','🎲 Lancer le dé'));
 }
 if(v.phase==='ships'){const p=player(v.order[v.idx]);return '<h2>⛵ Choix du navire</h2><h3>'+esc(p.name)+' choisit</h3><div class="v3-ship-grid">'+
  SHIPS.map(s=>'<div class="v3-ship"><img src="./opmercato-ship-'+s[0]+'.jpg" alt="'+s[1]+'"><b>'+s[2]+' '+s[1]+'</b><small>'+s[3]+'</small><p>'+s[4]+'</p>'+
  (state.players.some(p=>p.ship===s[0])?'<p>Indisponible</p>':btn('ship-'+s[0],'Choisir'))+'</div>').join('')+'</div>';}
 if(v.phase==='morgans'){
  let h='<h2>📰 Prédictions de Morgans</h2><p>Devine la puissance initiale du personnage secret.</p>';
  if(m.phase==='intro')h+=btn('morgans-ready','Continuer');
  if(m.phase==='guess'){const p=state.players.find(p=>m.guesses[p.id]===undefined);h+='<h3>'+esc(p.name)+' : ta prédiction confidentielle</h3><input id="v3-guess" type="number" min="1" max="100">'+btn('morgans-guess','🔒 Confirmer');}
  if(!['intro','guess'].includes(m.phase)){h+='<h3>'+nm(m.id)+' · '+CARDS[m.id].power+' pts · rang '+tierOf(CARDS[m.id].power).tier+'</h3>';
   const seen=m.phase==='character'?0:m.phase==='reveal'?m.shown:state.players.length;
   h+=state.players.map((p,i)=>'<p>'+esc(p.name)+' : '+(i<seen?m.guesses[p.id]+' · écart '+Math.abs(m.guesses[p.id]-CARDS[m.id].power):'🔒')+'</p>').join('');
  }
  if(['character','reveal','winner'].includes(m.phase))h+=btn('morgans-next','Continuer');
  if(m.phase==='wheel')h+='<div class="v3-wheel">🎡</div>'+btn('morgans-wheel','Tourner la roue');
  if(['winner','offer','armament'].includes(m.phase))h+='<h3>🏆 '+esc(player(m.winner).name)+'</h3>';
  if(m.phase==='offer')h+='<p>Recrutement gratuit · '+(m.bonus?'Terre Sainte +'+m.bonus:'')+'</p>'+btn('morgans-accept','Accepter la recrue')+btn('morgans-reject','Refuser');
  if(m.phase==='armament')h+=btn('morgans-armament','🛡 Utiliser le Haki +'+(player(m.winner).ship==='polartang'?40:20))+btn('morgans-skip','Conserver mon Haki');
  return h;
 }
 if(v.phase==='market'){
  const p=player(t.order[t.idx]);let h='<h2>🔄 Marché des transferts</h2><h3>Proposition '+(t.idx+1)+'/'+t.order.length+' — '+esc(p.name)+'</h3>';
  if(t.offer){const o=t.offer,a=player(o.from),b=player(o.to);h+='<h3>'+nm(o.give)+' ⇄ '+nm(o.take)+'</h3>'+
    '<p>'+esc(a.name)+' '+(tradeScore(a,o.give,o.take)-getScore(a))+' pts · '+esc(b.name)+' '+(tradeScore(b,o.take,o.give)-getScore(b))+' pts</p>'+
    btn('trade-accept','Accepter')+btn('trade-reject','Refuser');
  }else{const people=state.players.filter(x=>x.id!==p.id&&x.roster.some(id=>!t.locked.includes(id)));
    h+='<label>Adversaire<select id="v3-target">'+people.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join('')+'</select></label>'+
    '<label>Ton personnage<select id="v3-give">'+p.roster.filter(id=>!t.locked.includes(id)).map(id=>'<option value="'+id+'">'+nm(id)+'</option>').join('')+'</select></label>'+
    '<label>Personnage souhaité<select id="v3-take"></select></label><p id="v3-preview"></p>'+
    btn('trade-offer','Proposer')+btn('trade-pass','Passer');}
  return h;
 }return '';
}
function preview(){const v=V();if(v?.phase!=='market'||v.market.offer)return;
 const p=player(v.market.order[v.market.idx]),a=document.querySelector('#v3-target'),g=document.querySelector('#v3-give'),t=document.querySelector('#v3-take');if(!a||!g||!t)return;
 const target=player(Number(a.value)),prior=t.value;t.innerHTML=(target?.roster||[]).filter(id=>!v.market.locked.includes(id)).map(id=>'<option value="'+id+'">'+nm(id)+'</option>').join('');
 if([...t.options].some(x=>x.value===prior))t.value=prior;
 const x=document.querySelector('#v3-preview');if(x&&g.value&&t.value)x.textContent=p.name+' : '+(tradeScore(p,g.value,t.value)-getScore(p))+' pts · '+target.name+' : '+(tradeScore(target,t.value,g.value)-getScore(target))+' pts';
}
render=function(){if(V()&&['dice','ships','morgans','market'].includes(V().phase)){
 app.innerHTML='<section class="card v3-screen"><span class="eyebrow">OPMERCATO 3.0</span>'+screen()+'</section>'+
  '<div class="v3-players-mini">'+state.players.map(p=>esc(p.name)+' : '+currency(p.budget)+' · '+getScore(p)+' pts').join('<hr>')+'</div>';preview();return;}
 oldRender();if(V()){app.querySelectorAll('.player-card').forEach((node,i)=>{const p=state.players[i],s=sh(p.ship);if(!s)return;
 node.querySelector('.player-header')?.insertAdjacentHTML('beforeend','<span class="v3-ship-mini">'+s[2]+' '+s[1]+' · '+
 (p.ship==='sunny'?(8-p.passesUsed)+' refus':p.ship==='mobydick'?'−10 %':p.ship==='redforce'?'Actif':p.ship==='polartang'?(p.armamentUsed?'Utilisé':'Prêt'):(p.observationUsed?'Utilisé':'Prêt'))+'</span>');});}};

function v3OroScreen(){
 const v=V(),items=v.oroPeek||[];
 const make=(key,initial)=>'<select id="'+key+'">'+items.map((x,i)=>'<option value="'+i+'" '+(i===initial?'selected':'')+'>'+(i+1)+'. '+nm(x.id)+'</option>').join('')+'</select>';
 modal.innerHTML='<section class="card modal-content v3-oro-modal"><span class="eyebrow">👑 Vision du Futur</span>'+
 '<h2>Les '+items.length+' prochaines cartes</h2><div class="v3-oro-grid">'+items.map((x,i)=>
  '<div class="v3-oro-card"><small>Position '+(i+1)+'</small><b>'+nm(x.id)+'</b>'+
  '<span>Rang '+tierOf(CARDS[x.id].power).tier+' · '+CARDS[x.id].power+' pts</span>'+
  '<small>Premier à miser : '+esc(player(x.first).name)+'</small></div>').join('')+'</div>'+
 (items.length>=2&&!v.oroSwapped?'<h3>🔀 Échanger deux positions</h3><div class="v3-oro-pair">'+make('v3-oro-a',0)+make('v3-oro-b',1)+'</div>'+
 '<p id="v3-oro-preview">Aperçu : positions 1 et 2 échangées ; premiers enchérisseurs inchangés.</p>'+
 '<button class="primary" data-action="v3-oro-confirm">Confirmer l’inversion</button>':'')+
 '<button class="btn-ghost" data-action="close-modal">Continuer sans autre inversion</button></section>';
 modal.classList.remove('hidden');
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
document.addEventListener('click',e=>{const b=e.target.closest('button[data-action^="v3-"]');if(!b||!V())return;e.preventDefault();e.stopImmediatePropagation();
 const a=b.dataset.action.slice(3),v=V(),m=v.morgans,t=v.market;
 if(a==='roll'){
 const tied=v.phase==='dice-tie',group=tied?v.tieGroups[v.tieIndex]:state.players.map(p=>p.id);
 const rolls=tied?v.tieRolls:v.rolls,id=group.find(id=>rolls[id]===undefined);if(id===undefined)return;
 rolls[id]=1+Math.floor(Math.random()*6);
 window.OPMERCATO_EVENT_FX?.('die',player(id).name+' : 🎲 '+rolls[id],rolls[id]);
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
 else if(a==='trade-accept'||a==='trade-reject'){if(a==='trade-accept')swap(t.offer);nextTrade();return;}
 save();render();
},true);
const css=document.createElement('style');css.textContent='.v3-screen{text-align:center;padding:20px;margin:16px 0}.v3-screen h2{color:#f6d28f;font-size:26px}.v3-screen .primary{display:block;width:100%;margin:10px 0}.v3-screen input,.v3-screen select{width:100%;background:#163544;color:#fff;border:1px solid #b98e56;border-radius:10px;padding:12px;margin:8px 0}.v3-ship-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:8px}.v3-ship{display:grid;gap:7px;background:#23465c;padding:8px;border-radius:13px}.v3-ship img{width:100%;aspect-ratio:1;object-fit:cover}.v3-ship small,.v3-ship p{font-size:12px}.v3-players-mini{font-size:12px;padding:10px;color:#c5d4dd}.v3-ship-mini{font-size:11px;color:#f4ca87}.v3-wheel{font-size:80px;animation:v3spin 2s linear infinite}@keyframes v3spin{to{transform:rotate(360deg)}}';
css.textContent+='.v3-oro-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.v3-oro-card{display:grid;gap:3px;padding:8px;border:1px solid #94764f;border-radius:10px;background:#183b50;font-size:11px}.v3-oro-card span,.v3-oro-card small{font-size:10px;color:#cfdeed}.v3-oro-pair{display:grid;grid-template-columns:1fr 1fr;gap:9px}';
document.head.appendChild(css);
})();