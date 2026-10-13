(function(){
  "use strict";
  const API="https://nezqupnhcqwuewfilioa.supabase.co/functions/v1/opmercato-online";
  const SBURL="https://nezqupnhcqwuewfilioa.supabase.co";
  const SBKEY="sb_publishable_rLlu872lFwupJfFw_f3alw_GhbR7Mok";
  const KEY="opmercato-online-session-v1";
  const escOnline=x=>String(x??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const berrys=x=>{try{return BigInt(String(x??0)).toLocaleString("fr-FR")+" ฿";}catch{return "0 ฿";}};
  let session=null,view=null,showing=false,loading=false,channel=null,poll=null,topic="",onlineDetailId=null;
  let mode="choose",client=null,busy=false,loaded=false,copyMessage="",peekOpen=false,fx=null;
  const root=document.createElement("section");root.id="opmercato-online";
  root.style.display="none";document.body.appendChild(root);
  try{const stored=JSON.parse(localStorage.getItem(KEY)||"null");if(stored?.roomId&&stored?.token)session=stored;}catch{}
  function note(text){copyMessage=String(text); const x=root.querySelector("#online-notice");if(x)x.textContent=copyMessage;}
  function show(){
    showing=true;root.style.display="block";app.style.display="none";
    document.body.classList.add("online-open");paint();
  }
  function hide(){
    showing=false;root.style.display="none";app.style.display="";
    document.body.classList.remove("online-open");render();
  }
  function forget(){
    session=null;view=null;localStorage.removeItem(KEY);
    if(channel&&client)client.removeChannel(channel);
    channel=null;topic="";if(poll){clearInterval(poll);poll=null;}
    mode="choose";peekOpen=false;hide();
  }
  function addSync(){
    if(!session||!view)return;
    if(topic===view.topic&&poll)return;
    if(channel&&client)client.removeChannel(channel);
    topic=view.topic;
    if(!client&&window.supabase?.createClient)client=window.supabase.createClient(SBURL,SBKEY,{
      auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
      realtime:{params:{eventsPerSecond:5}}
    });
    if(client){
      channel=client.channel(topic,{config:{broadcast:{self:false}}})
       .on("broadcast",{event:"changed"},()=>refresh())
       .subscribe();
    }
    if(poll)clearInterval(poll);
    poll=setInterval(()=>{if(showing&&document.visibilityState!=="hidden")refresh();},2600);
  }
  async function call(action,args={}){
    const body={action,...args};
    if(session&&!["create","join"].includes(action)){body.roomId=session.roomId;body.token=session.token;}
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),12000);
    try {
      const response=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json","apikey":SBKEY},body:JSON.stringify(body),signal:controller.signal});
      const result=await response.json();
      if(!response.ok||result.error)throw new Error(result.error||"Connexion au serveur impossible.");
      return result;
    } finally{clearTimeout(timeout);}
  }
  function apply(result,force=false){
    const next=result?.room;if(!next)return;
    if(!force&&view?.id===next.id&&Number(next.version)<=Number(view.version))return;
    view=next;
    if(showing)paint();
    addSync();
  }
  async function refresh(){
    if(!session||loading)return;
    loading=true;
    try{const res=await call("get");apply(res);}
    catch(e){if(showing)note("Synchronisation en attente : "+e.message);}
    finally{loading=false;}
  }
  async function action(action,args={}){
    if(busy)return;
    busy=true;
    const clicked=[...root.querySelectorAll("[data-online]")];
    const priorDisabled=clicked.map(b=>b.disabled);
    clicked.forEach(b=>b.disabled=true);
    try {
      const res=await call(action,args);
      apply(res,true);
      if(action==="observation")peekOpen=true;
      copyMessage="";
      paint();
      if(["roll","coin"].includes(action)){
        const e=res.room?.event?.active,seat=res.room.yourSeat;
        const outcome=action==="roll"?res.room?.event?.rolls?.find(x=>x.id===seat):
          e?.flips?.find(x=>x.id===seat);
        if(outcome){
          const name=res.room?.players?.[seat]?.name||"Pirate";
          const desc=action==="roll"?
            name+" : 🎲 "+outcome.roll+" → +"+outcome.percent+" % · "+berrys(outcome.amount):
            name+" : "+(outcome.pile?"PILE · +25":"FACE · −25")+" · "+outcome.before+" → "+outcome.after+" pts";
          window.OPMERCATO_EVENT_FX?.(action==="roll"?"die":"coin",desc,action==="roll"?outcome.roll:outcome.pile);
        }
      }
    }catch(e){
      note(e.message);
      if(String(e.message).includes("évolué"))await refresh();
    }finally{busy=false;clicked.forEach((b,i)=>{if(b.isConnected)b.disabled=priorDisabled[i];});}
  }
  function label(p){return escOnline(p?.name||"Pirate");}
  function button(id,text,kind="primary",disabled=false){
    return '<button type="button" class="'+kind+'" data-online="'+id+'" '+(disabled?'disabled':'')+'>'+text+'</button>';
  }
  function shell(content){
    root.innerHTML='<div class="online-shell"><div class="online-head"><div><div class="online-eyebrow">🏴‍☠️ OPMERCATO EN DIRECT</div><h1>Mercato multijoueur</h1></div>'+
      button("back","✕ Fermer","online-text")+'</div>'+content+
      '<div class="online-notice" id="online-notice" role="status">'+escOnline(copyMessage)+'</div></div>';
    // Reutiliser exactement la meme chaine de portraits que le mode local.
    window.OPMERCATO_SHARED?.refreshImages?.();
  }
  function landing(){
    const prefill=new URLSearchParams(location.search).get("room");
    const form=mode==="create"?
      '<h2>⚓ Créer un salon</h2><label>Ton pseudo<input id="online-name" maxlength="25" value="Pirate 1" autocomplete="nickname"></label>'+
      '<label>Nombre de pirates (2 à 6)<select id="online-players"><option value="2">2 joueurs</option><option value="3">3 joueurs</option><option value="4">4 joueurs</option><option value="5">5 joueurs</option><option value="6">6 joueurs</option></select></label>'+
      '<label>Budget initial en Berrys<input id="online-budget" inputmode="numeric" type="text" value="250000000"></label>'+
      '<label>Personnages à recruter chacun<input id="online-team" inputmode="numeric" type="number" min="1" max="30" value="5"></label>'+
      '<label class="online-check"><input id="online-spoilers" type="checkbox" checked> Inclure les personnages manga récents (spoilers)</label>'+
      button("create-go","Créer le salon →")+
      '<p class="online-hint">Tu recevras un code à partager. La partie démarre quand tous les pirates sont dans le salon.</p>':
      mode==="join"?
      '<h2>🏴‍☠️ Rejoindre une partie</h2><label>Code du salon<input id="online-code" type="text" maxlength="8" autocapitalize="characters" value="'+escOnline(prefill||"")+'" placeholder="EX. PIRATE42"></label>'+
      '<label>Ton pseudo<input id="online-name" maxlength="25" value="Pirate 2" autocomplete="nickname"></label>'+
      button("join-go","Rejoindre le salon →"):
      '<h2>Jouez de 2 à 6 sur vos téléphones !</h2><p>Un pirate crée le salon, les autres le rejoignent avec un code. Les enchères et les pouvoirs se synchronisent automatiquement.</p>'+
      button("create-form","⚓ Créer une partie")+button("join-form","🔑 Rejoindre une partie","btn-ghost");
    shell('<section class="online-card">'+form+'</section><div class="online-back">'+button("local","← Mode classique sur un seul téléphone","online-text")+'</div>');
  }
  function waiting(){
    const players=view.players.map((p,i)=>'<div class="online-person"><span>'+ (i===0?'👑':'🏴‍☠️')+
      '</span><strong>'+label(p)+'</strong><small>'+ (i===0?'Hôte':'Invité')+'</small></div>').join("");
    return '<section class="online-card"><h2>Salon prêt à accueillir les pirates</h2><div class="online-code">'+escOnline(view.code)+'</div>'+
      '<p class="online-hint">Transmets ce code à ta femme ou partage directement le lien.</p>'+
      '<div class="online-actions">'+button("copy-code","Copier le code","btn-ghost")+button("copy-link","Partager le lien","btn-ghost")+'</div>'+
      '<div class="online-people">'+players+(view.players.length<(view.maxPlayers||2)?'<div class="online-person online-wait">⏳ En attente de '+((view.maxPlayers||2)-view.players.length)+' pirate(s)…</div>':'')+'</div>'+
      '<p>Budget : <strong>'+berrys(view.initialBudget)+'</strong> · '+view.teamSize+' personnages chacun · '+view.players.length+'/'+(view.maxPlayers||2)+' pirates.</p>'+
      (view.host?button("start","🏴‍☠️ Lancer la partie", "primary",view.players.length<(view.maxPlayers||2)):
        '<p class="online-hint">L’hôte lancera le mercato dès que tout le monde sera prêt.</p>')+
      '</section>';
  }
  function powerFor(p,id){const base=CARDS[id]?.power||0;return p.smileModifiers?.[id]===undefined?base:Math.max(0,Math.min(100,base+p.smileModifiers[id]));}
  function classFor(n){return n>=95?"S":n>=80?"A":n>=65?"B":n>=50?"C":n>=35?"D":n>=20?"E":"F";}
  function gameScore(){
    return '<section class="online-teams"><h2>⚓ Vos équipages</h2>'+
      view.players.map(p=>'<div class="online-team"><div class="online-team-top"><b>'+label(p)+'</b><strong>'+p.score+' pts</strong></div>'+
        '<div class="online-team-meta">'+berrys(p.budget)+' restants · '+p.roster.length+'/'+view.teamSize+' recrues · '+p.passesUsed+'/5 refus</div>'+
        '<div class="online-roster">'+(p.roster.length?p.roster.map(id=>'<button type="button" data-action="details" data-char-id="'+escOnline(id)+'" class="online-roster-character">'+
          '<span class="portrait portrait-tiny"><span class="portrait-fallback">☠️</span><img class="portrait-photo" data-portrait-id="'+escOnline(id)+'" alt="" loading="lazy"></span>'+
          '<span>'+escOnline(CARDS[id]?.name||id)+(p.smileModifiers?.[id]!==undefined?'<small class="online-smile-buff">🍎 '+powerFor(p,id)+' pts (rang '+classFor(powerFor(p,id))+')</small>':'')+'</span></button>').join(""):
        '<span>Équipage vide</span>')+'</div>'+
        '<div class="online-small">Base '+p.roster.reduce((v,id)=>v+powerFor(p,id),0)+
          (p.armamentId?' · Armement +5':'')+
          (p.bonuses?.length?' · Synergies +'+p.bonuses.reduce((v,x)=>v+x.points,0):'')+'</div>'+
        (p.marineAward&&BigInt(p.marineAward)>0n?'<div class="online-small">🎲 Prime Marine : +'+berrys(p.marineAward)+'</div>':'')+
        '<div class="online-small">👑 '+(p.hakiUsed?'Haki des Rois utilisé':'Disponible')+
        ' · 👁 '+(p.observationUsed?'Utilisé':'Disponible')+' · 🛡 '+(p.armamentUsed?'Utilisé':'Disponible')+'</div>'+
        (p.bonuses?.length?'<div class="online-synergy">🤝 '+p.bonuses.map(x=>escOnline(x.name)+' ('+x.count+') +'+x.points).join(", ")+'</div>':'')+
      '</div>').join("")+'</section>';
  }
  function portraitCard(id){
    if(!id)return '<div class="online-mystery"><div>❔</div><h2>Enchère mystère</h2><p>Son rang est connu, mais pas son identité.</p></div>';
    const c=CARDS[id];
    if(!c)return '<div class="online-mystery">Personnage inconnu</div>';
    return charCard(c);
  }

  const EVENT_INFO={
    war:["⚔️","GUERRE AU SOMMET","Deux légendes de rang S surgissent consécutivement !"],
    marine:["🎲","PRIME DE LA MARINE","Chaque pirate lance son dé pour gagner des Berrys."],
    mystery:["❔","PERSONNAGE MYSTÈRE","Seul le rang du prochain personnage est visible."],
    black:["🏴‍☠️","MARCHÉ NOIR","Trois personnages révélés. Deux seront renvoyés dans la pioche."],
    god:["💥","INCIDENT DE GOD VALLEY","Chaque pirate peut supprimer une recrue adverse."],
    smile:["🍎","SMILE","Le personnage le plus faible risque +25 ou −25 points."],
    reverie:["👑","LA RÊVERIE","Taxe royale : mise finale ×2, aucun refus, Haki des Rois interdit."]
  };
  function specialPanel(){
    const e=view.event.active,info=EVENT_INFO[e.type]||["✨","ÉVÉNEMENT SPÉCIAL",""];
    const mine=view.yourSeat,player=view.players[mine],myReady=e.ready?.includes(mine);
    let content="";
    if(e.stage==="intro"){
      content='<p class="v2-description">'+escOnline(info[2])+'</p>'+
        button("event-ready",myReady?"✓ En attente des autres pirates…":"Continuer →","primary",myReady)+
        '<p class="online-hint">'+(e.ready?.length||0)+'/'+view.players.length+' confirmations</p>';
    }else if(e.stage==="result"){
      const items=e.type==="marine"?(view.event.rolls||[]).map(x=>{
        const p=view.players[x.id];return '<p>'+label(p)+' : 🎲 '+x.roll+' → +'+x.percent+' % ('+berrys(x.amount)+')</p>';
      }):e.flips.map(x=>{
        const p=view.players[x.id];return '<p>'+label(p)+' : '+escOnline(CARDS[x.charId]?.name||x.charId)+
          ' — '+(x.pile?"Pile +25":"Face −25")+' · '+x.before+' → '+x.after+' pts</p>';
      });
      content='<div class="v2-results">'+items.join("")+'</div>'+
        button("event-ready",myReady?"✓ En attente des autres pirates…":"Continuer →","primary",myReady);
    }else if(e.stage==="roll"){
      const owner=view.players[e.step],myTurn=e.step===mine;
      content='<p>🎲 '+(myTurn?"À toi de lancer le dé !":"Au tour de "+label(owner))+'</p>'+
        '<div class="v2-animated-object">🎲</div>'+
        button("roll","🎲 Lancer le dé","primary",!myTurn)+
        '<div class="v2-results">'+(view.event.rolls||[]).map(x=>'<p>'+label(view.players[x.id])+' : '+x.roll+' → +'+x.percent+' %</p>').join("")+'</div>';
    }else if(e.stage==="coin"){
      const flipped=e.flips.some(x=>x.id===mine);
      content='<p>Chaque joueur lance sa pièce indépendamment.</p>'+
        '<div class="v2-animated-object">🪙</div>'+
        button("coin",flipped?"✓ Pièce lancée — en attente…":"🪙 Lancer ma pièce","primary",flipped)+
        '<p class="online-hint">'+e.flips.length+'/'+view.players.length+' pièces lancées</p>';
    }else if(e.stage==="select"){
      const first=view.auction.firstTurnId??0,actor=(first+e.step)%view.players.length;
      const canChoose=actor===mine;
      content='<p>'+(canChoose?"Choisis un personnage à éliminer.":"Au tour de "+label(view.players[actor])+" de retirer un personnage.")+'</p>'+
        '<div class="v2-choice-grid">'+e.choices.filter(id=>!e.removed.includes(id)).map(id=>
          '<div class="v2-choice"><b>'+escOnline(CARDS[id]?.name||id)+'</b><span>'+Number(CARDS[id]?.power||0)+' pts</span>'+
          button("pick-"+id,"❌ Éliminer","btn-ghost",!canChoose)+'</div>').join("")+'</div>'+
        '<p class="online-hint">Les deux personnages retirés retourneront dans la pioche.</p>';
    }else if(e.stage==="eliminate"){
      const first=view.auction.firstTurnId??0,actor=(first+e.step)%view.players.length,target=(actor+1)%view.players.length;
      const canChoose=actor===mine,opponent=view.players[target];
      content='<p>'+(canChoose?"Choisis une recrue à supprimer chez "+label(opponent)+".":"Au tour de "+label(view.players[actor])+" d'affronter "+label(opponent)+".")+'</p>'+
        '<div class="v2-choice-grid">'+opponent.roster.map(id=>
          '<div class="v2-choice"><b>'+escOnline(CARDS[id]?.name||id)+'</b>'+
          '<span>'+Number(CARDS[id]?.power||0)+' pts</span>'+
          button("delete-"+id,"💥 Éliminer","btn-ghost",!canChoose)+'</div>').join("")+'</div>'+
        (canChoose?button("event-skip","Épargner cet équipage","online-text"):"")+
        '<p class="online-hint">Les recrues éliminées sont définitivement exclues, mais les places se libèrent.</p>';
    }
    return '<div class="v2-special v2-'+e.type+'"><div class="v2-tag">✦ ÉVÉNEMENT SPÉCIAL ✦</div>'+
      '<div class="v2-symbol">'+info[0]+'</div><h2>'+info[1]+'</h2>'+content+'</div>';
  }
  function eventBox(){
    const e=view.event||{};
    if(e.active?.stage==="auction")return '<div class="online-event">✦ '+escOnline(EVENT_INFO[e.active.type]?.[1]||"Événement")+' ✦</div>';
    if(e.awaitingRolls||e.activatedRound===view.round&&e.used){
      if(e.type==="marine")return '<div class="online-event">🎲 PRIME DE LA MARINE : '+(e.rolls||[]).map(r=>{
        const p=view.players.find(p=>p.id===r.id);return label(p)+' : '+r.roll+' → +'+r.percent+' % ('+berrys(r.amount)+')';
      }).join(" · ")+(e.rolls.length?'':'Chaque joueur lance son dé !')+'</div>';
      if(e.type==="war")return '<div class="online-event">⚔️ GUERRE AU SOMMET : deux personnages de classe S à la suite !</div>';
    }
    if(view.auction?.warGuaranteed)return '<div class="online-event">⚔️ Guerre au sommet : personnage légendaire !</div>';
    return "";
  }
  function auction(){
    const a=view.auction;const me=view.players[view.yourSeat];
    if(!a)return "";
    if(view.event?.active&&view.event.active.stage!=="auction")return specialPanel();
    const active=a.outcome===null,turn=a.turnId===view.yourSeat;
    const bidder=view.players[a.turnId];
    const leader=a.leader!==null?view.players[a.leader]:null;
    const minimum=BigInt(a.highBid)>0n?BigInt(a.highBid)+BigInt(view.bidStep):BigInt(view.baseBid);
    const royal=view.event?.active?.type==="reverie";
    const canAfford=BigInt(me.budget)>=minimum*(royal?2n:1n)&&me.roster.length<view.teamSize;
    const canHaki=!royal&&turn&&!me.hakiUsed&&a.firstTurnId===me.id&&a.leader===null&&a.highBid==="0"&&a.passed.length===0;
    const roll=view.event.awaitingRolls;
    let actionHtml="";
    if(roll){
      const roller=view.players[view.event.rollIndex];
      const mine=view.event.rollIndex===me.id;
      actionHtml='<div class="online-turn">🎲 Au tour de <b>'+label(roller)+'</b> pour lancer son dé</div>'+
        button("roll","🎲 Lancer mon dé (5 à 30 %)","primary",!mine);
    }else if(!active){
      const winner=leader?'🏆 '+label(leader)+' recrute '+escOnline(CARDS[a.charId]?.name||a.charId)+
         (a.hakiWinner===leader.id?' gratuitement grâce au Haki des Rois':" pour "+berrys(royal?BigInt(a.highBid)*2n:a.highBid)) :
         "🌊 Personnage invendu";
      actionHtml='<div class="online-turn online-winner">'+winner+'</div>'+
        (view.host?button("next","Personnage suivant →"): '<div class="online-hint">L’hôte passe au prochain personnage…</div>');
    }else{
      const offerChoices=[0n,1n,5n,10n].map((factor)=>{
        const val=minimum+factor*BigInt(view.bidStep);
        return button("bid-"+val.toString(),berrys(val), "online-offer",!turn||!canAfford||val*(royal?2n:1n)>BigInt(me.budget));
      }).join("");
      actionHtml='<div class="online-turn"><span>AU TOUR DE</span><b>'+label(bidder)+'</b>'+
        (!turn?'<small>Patiente, l’autre pirate réfléchit !</small>':'<small>C’est à toi de jouer !</small>')+'</div>'+
        '<div class="online-bid-info"><span>Meilleure offre : <b>'+(leader?berrys(a.highBid):'Aucune')+'</b></span>'+
        '<span>'+(leader?'En tête : '+label(leader):'Mise de départ : '+berrys(view.baseBid))+'</span></div>'+
        '<div class="online-offers">'+offerChoices+'</div>'+
        '<div class="online-custom"><input id="online-custom-amount" type="text" inputmode="numeric" placeholder="Autre montant en Berrys" '+(!turn?'disabled':'')+'>'+
        button("custom-bid","Enchérir","btn-ghost",!turn)+'</div>'+
        (canHaki?button("haki","👑 Haki des Rois — recruter gratuitement"): "")+
        (royal?'<div class="online-event">👑 Taxe royale ×2 : refus interdit, Haki des Rois désactivé.</div>':"")+
        button("pass",a.leader!==null?"Se retirer (gratuit)":"Refuser ce personnage · "+(5-me.passesUsed)+"/5 restants",
          "online-pass",royal||!turn||(a.leader===null&&me.passesUsed>=5))+
        '<div class="online-powers">'+
        button("observation",me.observationUsed?'👁 Revoir mes visions':'👁 Observation', "btn-ghost",!turn&&!me.observationUsed)+
        button("armament",me.armamentUsed?'🛡 Déjà utilisé':'🛡 Armement +5',"btn-ghost",!turn||me.armamentUsed||me.roster.length===0)+'</div>'+
        (peekOpen&&me.observationUsed?peekPanel():"");
    }
    return '<div class="online-round"><strong>ENCHÈRE N° '+view.round+'</strong><span>'+view.remaining+' cartes restantes</span></div>'+
      eventBox()+(a.mystery&&active?'<div class="online-rank">Classe '+escOnline(a.tier)+'</div>':"")+
      portraitCard(a.charId)+'<section class="online-card online-actions-area">'+actionHtml+'</section>';
  }
  function peekPanel(){
    const me=view.players[view.yourSeat];
    return '<div class="online-peek"><h3>👁 Tes 3 prochaines cartes</h3>'+
      (view.peek.length?view.peek.map((x,i)=>'<p>'+(i+1)+'. '+(x.id?escOnline(CARDS[x.id]?.name||x.id):'🔒 Enchère mystère')+
         ' — classe '+escOnline(x.tier)+'</p>').join(""):'<p>Aucune carte restante.</p>')+
      '<small>Cette vision est privée : l’autre joueur ne la reçoit pas.</small></div>';
  }
  function scoreboardEnd(){
    const sorted=[...view.players].sort((a,b)=>b.score-a.score||
      (BigInt(b.budget)>BigInt(a.budget)?1:BigInt(b.budget)<BigInt(a.budget)?-1:0));
    const entries=view.players.flatMap(p=>p.roster.map(id=>({player:p,id,price:BigInt(p.purchases?.[id]||"0"),power:powerFor(p,id)})));
    const best=entries.slice().sort((a,b)=>b.power-a.power)[0];
    const bargain=entries.filter(e=>e.price>0n).sort((a,b)=>{
       const left=BigInt(a.power)*b.price,right=BigInt(b.power)*a.price;
       return left>right?-1:left<right?1:0;
    })[0];
    const spent=p=>Object.values(p.purchases||{}).reduce((sum,v)=>sum+BigInt(String(v)),0n);
    const spender=[...view.players].sort((a,b)=>spent(a)>spent(b)?-1:spent(a)<spent(b)?1:0)[0];
    const bonus=p=>(p.armamentId?5:0)+(p.bonuses||[]).reduce((s,b)=>s+b.points,0);
    const tactician=[...view.players].sort((a,b)=>bonus(b)-bonus(a))[0];
    const award=(icon,title,content)=>'<div class="online-award">'+icon+' <strong>'+title+'</strong> : '+content+'</div>';
    const tied=sorted.filter(p=>p.score===sorted[0].score&&p.budget===sorted[0].budget);
    return '<section class="online-card online-final"><div class="online-cup">🏆</div><h2>'+(tied.length>1?'Égalité !':'Victoire de '+label(sorted[0])+' !')+'</h2>'+
      '<p>'+sorted[0].score+' points — '+(tied.length>1?'vainqueurs ex aequo : '+tied.map(p=>label(p)).join(', '):'meilleur équipage des mers !')+'</p>'+
      '<div class="online-champion-roster">'+sorted[0].roster.map(id=>'<button type="button" data-action="details" data-char-id="'+escOnline(id)+'">'+
        '<span class="portrait portrait-medium"><span class="portrait-fallback">☠️</span><img class="portrait-photo" data-portrait-id="'+escOnline(id)+'" alt="" loading="lazy"></span>'+
        '<span>'+escOnline(CARDS[id]?.name||id)+'</span></button>').join("")+'</div><h3>Classement final</h3>'+
      sorted.map((p,i)=>'<div class="online-rankrow"><strong>'+(i===0?'🥇':i===1?'🥈':i===2?'🥉':'#'+(i+1))+' '+label(p)+'</strong>'+
        '<span>'+p.score+' pts · '+berrys(p.budget)+' restants</span></div>').join("")+
      '<h3>🏅 Trophées du mercato</h3>'+
      (best?award('💥','Meilleure recrue',escOnline(CARDS[best.id]?.name||best.id)+' ('+best.power+' pts)'):'')+
      (bargain?award('💰','Meilleur prix',escOnline(CARDS[bargain.id]?.name||bargain.id)+' — '+berrys(bargain.price)):'')+
      (spent(spender)>0n?award('💸','Plus gros investisseur',label(spender)+' — '+berrys(spent(spender))):'')+
      (bonus(tactician)>0?award('🧠','Meilleur stratège',label(tactician)+' — +'+bonus(tactician)+' pts'):'')+
      '</section>';
  }
  function detail(id){
    const c=CARDS[id];if(!c)return "";
    const d=window.MERCATO_EXPANSION?.details?.[id]||{};
    return '<div class="online-detail-panel"><div class="online-card">'+button("detail-close","✕ Fermer","online-text")+
      '<h2>'+escOnline(c.name)+'</h2>'+portraitCard(id)+
      '<p><strong>Affiliation :</strong> '+escOnline(d.crew||"Non renseignée")+'</p>'+
      '<p><strong>Pouvoir :</strong> '+escOnline(d.ability||"Non renseigné")+'</p>'+
      '<p><strong>Taille :</strong> '+escOnline(d.height||"Non renseignée")+'</p>'+
      '<p>'+escOnline(d.description||"")+'</p></div></div>';
  }
  function onlineRules(){
    const num=view?.teamSize||5;
    const initial=view?.baseBid||"20",increment=view?.bidStep||"10";
    const rules=[
      'Chaque joueur commence avec le meme budget et doit recruter <b>'+num+' personnages</b>.',
      'La mise de depart est de <b>'+berrys(initial)+'</b>, puis chaque surenchere monte d’au moins <b>'+berrys(increment)+'</b>.',
      'Les offres personnalisees et les budgets eleves sont autorises.',
      'Refuser une carte avant toute enchere consomme un de tes <b>5 refus</b>. Se retirer apres une offre est gratuit.',
      'Haki des Rois : recruter gratuitement une fois, seulement si tu joues en premier et avant toute enchere.',
      'Haki de l’Observation : consulter secretement les trois prochaines cartes une fois par joueur.',
      'Haki de l’Armement : renforcer une de tes recrues de <b>+5 points</b>, une fois par joueur.',
      'Synergies par affiliation : 1 personnage = 0 point ; 2 = +10 ; 3 = +20 ; 4 = +30 ; 5 ou plus = +50. Les bonus de plusieurs affiliations se cumulent. Les anciens trios spéciaux ne comptent plus.',
      '7 evenements independants : Guerre au sommet, Prime de la Marine, Personnage mystere, Marche noir, God Valley, SMILE et Reverie.',
      '1 evenement pour 1 a 5 recrues, 2 pour 6 a 10, 3 pour 11 a 30. Les joueurs confirment chaque annonce avec Continuer.',
      'Un evenement se declenche : Guerre au Sommet (deux classes S) ou Prime de la Marine (de 5 % a 30 % du budget initial).',
      'Le score total additionne les puissances des recrues, les synergies et le Haki de l’Armement. Le budget restant departage une egalite de points.',
      'Les personnages ne peuvent etre recrutes qu’une seule fois dans chaque partie.'
    ];
    modal.innerHTML='<section class="card modal-content"><span class="eyebrow">OPMercato en ligne</span><h2>Regles du mercato</h2><ul>'+
      rules.map(x=>'<li>'+x+'</li>').join('')+'</ul><button class="primary" data-action="close-modal">Compris !</button></section>';
    modal.classList.remove("hidden");
  }
  function paint(){
    if(!showing)return;
    if(!view){landing();return;}
    const main=view.status==="lobby"?waiting():
      '<div class="online-room-bar"><span>Salon <strong>'+escOnline(view.code)+'</strong></span><span>🌐 Synchronisation active</span></div>'+
      '<div class="online-nav">'+button("catalog","📚 Catalogue ("+CHARACTERS.length+" personnages)","btn-ghost")+button("rules","📖 Règles","btn-ghost")+'</div>'+
      (view.status==="finished"?scoreboardEnd():auction())+gameScore()+
      (view.host&&view.status==="playing"?button("finish","Terminer cette partie","online-text"):"");
    shell(main+(fx?'<div class="v2-fx"><div class="v2-fx-icon">'+(fx.type==="roll"?"🎲":"🪙")+'</div><strong>'+
      (fx.type==="roll"?"Dé : "+fx.outcome.roll+" · +"+fx.outcome.percent+" %":fx.outcome.pile?"PILE · +25":"FACE · −25")+
      '</strong></div>':"")+(view?'<div class="online-back">'+button("leave-online","Quitter ce salon et créer une nouvelle partie","online-text")+'</div>':"")+(onlineDetailId?detail(onlineDetailId):""));
  }
  // Les portraits sont charges par OPMERCATO_SHARED.refreshImages (mode local).
  const originalRender=render;
  render=function(){
    originalRender();
    if(!showing){
      const top=app.querySelector(".topbar");
      if(top&&!top.querySelector("[data-online='open']"))
        top.insertAdjacentHTML("beforeend",'<button class="online-entry" type="button" data-online="open">🌐 En ligne</button>');
    }
  };
  document.addEventListener("click",async event=>{
    const b=event.target.closest("[data-online]");if(!b)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(b.disabled)return;
    const a=b.dataset.online;
    if(a==="open"){mode="choose";show();if(session)refresh();return;}
    if(a==="local"||a==="back"){hide();return;}
    if(a==="leave-online"){if(confirm("Quitter ce salon sur ce téléphone ? Les autres joueurs pourront continuer leur partie.")){forget();show();}return;}
    if(a==="create-form"){mode="create";paint();return;}
    if(a==="join-form"){mode="join";paint();return;}
    if(a==="copy-code"||a==="copy-link"){
      const text=a==="copy-code"?view.code:location.origin+location.pathname+"?room="+view.code;
      try{await navigator.clipboard.writeText(text);note("Copié !");}catch{note(text);}
      return;
    }
    if(a==="create-go"||a==="join-go"){
      if(busy)return;busy=true;b.disabled=true;note("Connexion au serveur…");
      try{
        const data=a==="create-go"?await call("create",{
          name:root.querySelector("#online-name").value.trim(),
          budget:root.querySelector("#online-budget").value.trim(),
          teamSize:Number(root.querySelector("#online-team").value),maxPlayers:Number(root.querySelector("#online-players").value),
          spoilers:root.querySelector("#online-spoilers").checked}):
          await call("join",{name:root.querySelector("#online-name").value.trim(),code:root.querySelector("#online-code").value.trim()});
        session={roomId:data.room.id,token:data.token};localStorage.setItem(KEY,JSON.stringify(session));
        copyMessage="";apply(data,true);
      }catch(e){note(e.message);}
      finally{busy=false;b.disabled=false;}
      return;
    }
    if(a==="detail-close"){onlineDetailId=null;paint();return;}
    if(a==="details"){window.OPMERCATO_SHARED?.openDetail?.(b.dataset.charId);return;}
    if(a==="catalog"){window.OPMERCATO_SHARED?.openCatalog?.();return;}
    if(a==="rules"){onlineRules();return;}
    if(a==="observation"&&view.players[view.yourSeat].observationUsed){peekOpen=!peekOpen;paint();return;}
    if(a==="armament"){
      const p=view.players[view.yourSeat];
      root.querySelector(".online-actions-area")?.insertAdjacentHTML("beforeend",
        '<div class="online-peek"><h3>🛡 Renforcer un personnage (+5 pts)</h3>'+p.roster.map(id=>button("arm-"+id,escOnline(CARDS[id]?.name||id),"btn-ghost")).join("")+'</div>');
      return;
    }
    if(a==="event-ready"){await action("event-ready");return;}
    if(a==="coin"){await action("coin");return;}
    if(a==="event-skip"){await action("event-eliminate",{charId:""});return;}
    if(a.startsWith("pick-")){await action("event-pick",{charId:a.slice(5)});return;}
    if(a.startsWith("delete-")){await action("event-eliminate",{charId:a.slice(7)});return;}
    if(a==="custom-bid"){const val=root.querySelector("#online-custom-amount")?.value.replace(/[\s._]/g,"");await action("bid",{amount:val});return;}
    if(a.startsWith("bid-")){await action("bid",{amount:a.slice(4)});return;}
    if(a.startsWith("arm-")){await action("armament",{charId:a.slice(4)});return;}
    if(["start","bid","pass","haki","observation","next","roll","finish"].includes(a)){await action(a);return;}
  },true);
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&showing)refresh();});
  const css=document.createElement("style");
  css.textContent=`
    .online-smile-buff{display:block;font-size:10px;color:#f2cc7a;font-weight:800;margin-top:2px}

    .v2-special{margin:14px 0;border:2px solid #c8a369;background:radial-gradient(circle at 50% 10%,#344d60,#102332 75%);border-radius:23px;padding:28px 16px;color:#fff4d4;text-align:center;box-shadow:0 10px 32px #0008}
    .v2-war,.v2-god{border-color:#df685a;background:linear-gradient(130deg,#4b242a,#101c2c)}
    .v2-black,.v2-mystery{border-color:#a993e0;background:linear-gradient(130deg,#362448,#132332)}
    .v2-smile{border-color:#f1c762;background:linear-gradient(130deg,#5a392a,#172632)}
    .v2-tag{font-size:11px;letter-spacing:.16em;color:#f9ca77;font-weight:800}
    .v2-symbol{font-size:68px;margin:18px 0 8px;animation:v2Entrance .7s both}
    .v2-special h2{font-size:25px;letter-spacing:.05em;color:#f9d58a;margin:8px 0 24px}
    .v2-description{font-size:15px;margin:12px 0 24px}
    .v2-special button.primary{margin:20px auto 5px;max-width:350px}
    .v2-choice-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:10px;margin:18px 0}
    .v2-choice{display:grid;gap:8px;align-content:space-between;padding:12px 7px;border:1px solid #9f855a;border-radius:13px;background:#203447;color:#fff}
    .v2-choice b{font-size:13px;overflow-wrap:anywhere}.v2-choice span{font-size:12px}
    .v2-choice button{min-height:42px}.v2-results{color:#f7d58b;font-size:14px;margin:20px 0}
    .v2-animated-object{font-size:92px;animation:v2Entrance .9s infinite alternate;display:block}
    .v2-fx{position:fixed;z-index:2500;inset:0;background:#081525e6;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:25px;color:#fce9b1;text-align:center;font-size:24px}
    .v2-fx-icon{font-size:130px;animation:v2Spin .26s linear infinite alternate}
    @keyframes v2Spin{to{transform:rotateY(180deg) rotateZ(40deg) scale(1.2)}}
    @keyframes v2Entrance{from{transform:scale(.85) rotate(-8deg);opacity:.5}to{transform:scale(1) rotate(8deg);opacity:1}}

    .online-open #modal{z-index:1600}
    .online-nav{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0}
    .online-nav .btn-ghost{color:#ffdf98;border-color:#a17f4b;font-size:12px}
    .online-roster .online-roster-character{display:flex;align-items:center;gap:6px;color:#f4f8fa;background:#275061;border:1px solid #446d79;border-radius:9px;padding:5px 8px;max-width:100%;text-align:left;font-size:11px}
    .online-roster .online-roster-character>span:last-child{overflow-wrap:anywhere}
    .online-roster .portrait-tiny{width:24px;height:24px;min-width:24px}
    .online-entry{border:1px solid #d8ad60;border-radius:12px;background:#143847;color:#ffe1a0;
      padding:10px;font-size:12px;font-weight:900;white-space:nowrap}
    body.online-open{overflow:hidden}
    #opmercato-online{position:fixed;inset:0;z-index:1100;background:#0a1c29;
      overflow-y:auto;overscroll-behavior:contain;color:#e8f1f3}
    .online-shell{max-width:760px;margin:auto;padding:calc(env(safe-area-inset-top) + 20px) 14px calc(env(safe-area-inset-bottom) + 60px)}
    .online-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin:5px 0 20px}
    .online-head h1{font-size:clamp(21px,5vw,29px);margin:4px 0}
    .online-eyebrow{font-size:10px;letter-spacing:.17em;color:#f6c775;font-weight:900}
    .online-text{border:0;background:none;color:#bdd6dc;font-size:12px;font-weight:800;padding:8px}
    .online-card{border-radius:18px;border:1px solid #426273;padding:18px;background:linear-gradient(145deg,#173548,#102b3c);margin:13px 0}
    .online-card h2{font-size:21px;margin:0 0 15px}
    .online-card h3{font-size:17px;margin:20px 0 12px}
    .online-card label:not(.online-check){display:block;font-size:12px;color:#b6d1db;margin:15px 0;font-weight:750}
    .online-card label select{display:block;width:100%;margin-top:8px;padding:13px;color:#f6fafb;background:#0d2534;border:1px solid #56707e;border-radius:11px;font-size:16px}
    .online-card label input:not([type=checkbox]){display:block;width:100%;margin-top:8px;padding:13px;color:#f6fafb;
      background:#0d2534;border:1px solid #56707e;border-radius:11px;font-size:16px}
    .online-card .primary,.online-shell .primary{width:100%;margin-top:10px}
    .online-card .btn-ghost{margin-top:9px;color:#ffdf98}
    .online-check{display:flex;gap:9px;align-items:center;font-size:12px;margin:12px 0;color:#b6d1db}
    .online-check input{width:18px;height:18px}
    .online-hint{font-size:12px;color:#aac0c9;line-height:1.6}
    .online-back{text-align:center;margin-top:12px}
    .online-notice{min-height:22px;margin:17px 0;color:#ffcf7e;font-size:12px}
    .online-code{font-size:clamp(26px,8vw,43px);font-weight:950;letter-spacing:.14em;
      text-align:center;color:#ffdf93;background:#0a2330;border:1px dashed #dbac63;
      border-radius:12px;padding:18px 5px}
    .online-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .online-person{display:flex;align-items:center;gap:10px;padding:13px 8px;border-bottom:1px solid #ffffff17}
    .online-person small{margin-left:auto;color:#a7c6d2}
    .online-wait{color:#a6bec7}
    .online-room-bar,.online-round{display:flex;justify-content:space-between;gap:8px;align-items:center;
      font-size:11px;color:#b2cbd5;margin:10px 0}
    .online-room-bar strong,.online-round strong{color:#ffcd7d}
    .online-round{margin-top:18px}
    .online-shell .premium-recruit{margin-bottom:15px}
    .online-event{padding:14px;background:#68462e;color:#ffe1a2;border-radius:14px;font-weight:850;margin:13px 0}
    .online-mystery{padding:38px 18px;text-align:center;background:#173648;border:1px solid #ab834c;border-radius:17px}
    .online-mystery>div{font-size:75px}
    .online-rank{display:inline-block;background:#514068;color:#ffdf96;padding:8px 15px;border-radius:10px}
    .online-turn{display:grid;gap:5px;background:#194557;border-radius:13px;padding:15px;margin-bottom:13px}
    .online-turn>span{font-size:11px;letter-spacing:.1em;color:#c2dfeb;font-weight:900}
    .online-turn b{font-size:18px}
    .online-turn small{color:#c6d3d4}
    .online-winner{background:#345038;font-size:14px}
    .online-bid-info{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;color:#c1d9df;font-size:12px}
    .online-bid-info b{color:#ffdb91}
    .online-offers{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:15px}
    .online-offer{border:1px solid #6e8a94;background:#214657;border-radius:13px;padding:13px 8px;
      color:#fff;font-size:clamp(11px,3.2vw,15px);font-weight:900;overflow-wrap:anywhere}
    .online-custom{display:flex;gap:7px;margin:12px 0}
    .online-custom input{width:65%;min-width:0;background:#0d2534;color:white;
      border:1px solid #4a7080;border-radius:10px;padding:10px;font-size:13px}
    .online-custom button{flex:1;margin:0!important}
    .online-pass{display:block;width:100%;border:1px solid #a5bdc5;background:#263b47;
      border-radius:12px;color:#eaf2f5;padding:12px;margin-top:10px;font-weight:850}
    .online-powers{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}
    .online-powers button{font-size:12px}
    #opmercato-online button:disabled{opacity:.4;cursor:not-allowed}
    .online-peek{margin-top:12px;padding:13px;background:#263e5a;border-radius:11px;font-size:13px}
    .online-peek small{color:#b9cbd5}
    .online-teams{margin-top:20px}
    .online-teams h2{font-size:19px}
    .online-team{padding:13px;background:#142f40;border:1px solid #38566a;border-radius:13px;margin:11px 0}
    .online-team-top{display:flex;justify-content:space-between;color:#f3c774}
    .online-team-meta,.online-small{font-size:11px;color:#b6cfd9;margin-top:7px}
    .online-roster{display:flex;flex-wrap:wrap;gap:5px;margin-top:10px}
    .online-roster span{font-size:11px;padding:5px 8px;background:#275061;border-radius:16px}
    .online-synergy{color:#f5c275;font-size:11px;margin-top:10px}
    .online-champion-roster{display:flex;gap:8px;overflow-x:auto;padding:8px 0 12px}
    .online-champion-roster button{min-width:89px;max-width:105px;display:grid;gap:6px;justify-items:center;border:1px solid #aa8649;border-radius:10px;background:#173a4b;color:#fff;padding:8px;font-size:11px}
    .online-champion-roster .portrait-medium{width:66px;height:88px}
    .online-cup{font-size:54px;text-align:center}
    .online-final{text-align:center}
    .online-final h2{font-size:26px}
    .online-rankrow,.online-award{display:flex;justify-content:space-between;gap:10px;text-align:left;
      padding:12px 6px;border-bottom:1px solid #ffffff26;font-size:12px}
    .online-award{display:block;line-height:1.6}
    .online-detail-panel{position:fixed;inset:0;z-index:1200;background:#0a1c29f5;overflow:auto;padding:25px 12px}
    .online-detail-panel .online-card{max-width:660px;margin:0 auto}
    @media(max-width:430px){.online-card{padding:13px}.online-shell{padding:calc(env(safe-area-inset-top) + 14px) 10px calc(env(safe-area-inset-bottom) + 35px)}}
  `;
  document.head.appendChild(css);
  render();
  if(new URLSearchParams(location.search).has("room")&&!session){mode="join";show();}
  else if(session){show();refresh();}
})();