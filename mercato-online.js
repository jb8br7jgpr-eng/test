(function(){
  "use strict";
  const API="https://nezqupnhcqwuewfilioa.supabase.co/functions/v1/opmercato-online";
  const SBURL="https://nezqupnhcqwuewfilioa.supabase.co";
  const SBKEY="sb_publishable_rLlu872lFwupJfFw_f3alw_GhbR7Mok";
  const KEY="opmercato-online-session-v1";
  const escOnline=x=>String(x??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const berrys=x=>{try{return BigInt(String(x??0)).toLocaleString("fr-FR")+" ฿";}catch{return "0 ฿";}};
  let session=null,view=null,showing=undefined,loading=false,channel=null,poll=null,topic="",onlineDetailId=null;
  let mode="choose",client=null,busy=false,loaded=false,copyMessage="",peekOpen=false,fx=null,burstDraft="";
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
    const previous=view;
    if(next.event?.active?.type!=="burst"||next.event?.active?.round!==previous?.event?.active?.round)burstDraft="";
    view=next;
    // L'écran de roulement apparaît AVANT le nouveau résultat pour éviter un flash prématuré.
    // Les deux iPhone voient le même lancer, même si l'autre joueur l'a déclenché.
    const oldEvent=previous?.event?.active,newEvent=next.event?.active;
    if(showing&&previous?.id===next.id&&oldEvent&&newEvent&&
       oldEvent.round===newEvent.round&&oldEvent.type===newEvent.type){
      if(newEvent.type==="marine"){
        const added=(next.event.rolls||[]).slice((previous.event.rolls||[]).length);
        const latest=added.at(-1);
        if(latest){
          const name=next.players[latest.id]?.name||"Pirate";
          window.OPMERCATO_EVENT_FX?.("die",name+" : 🎲 "+latest.roll+" → +"+latest.percent+" % · "+berrys(latest.amount),latest.roll);
        }
      }else if(newEvent.type==="burst"){
        const added=(newEvent.tieFlips||[]).slice((oldEvent.tieFlips||[]).length);
        const latest=added.at(-1);
        if(latest)window.OPMERCATO_EVENT_FX?.("burst-coin","COUP DE BURST : "+(latest.pile?"PILE":"FACE")+
          (newEvent.winner!==undefined&&newEvent.winner!==null?" · "+(next.players[newEvent.winner]?.name||"Pirate")+" l'emporte !":""),latest.pile);
      }else if(newEvent.type==="smile"){
        const added=(newEvent.flips||[]).slice((oldEvent.flips||[]).length);
        const latest=added.at(-1);
        if(latest){
          const name=next.players[latest.id]?.name||"Pirate";
          window.OPMERCATO_EVENT_FX?.("coin",name+" : "+(latest.pile?"PILE · +25":"FACE · −25")+
            " · "+latest.before+" → "+latest.after+" pts",latest.pile);
        }
      }
    }
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

    }catch(e){
      if(action==="v3-intro-ready"&&String(e.message).includes("évolué")){
        try {
          await refresh();
          if(view?.v3?.stage==="intro"&&!view.v3.introReady?.includes(view.yourSeat)){
            apply(await call(action,args),true);
            copyMessage="";
            paint();
            return;
          }
          if(view?.v3?.stage!=="intro"||view.v3.introReady?.includes(view.yourSeat))return;
        }catch(retryError){e=retryError;}
      }
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
      '<label>Nombre de pirates (2 à 5)<select id="online-players"><option value="2">2 joueurs</option><option value="3">3 joueurs</option><option value="4">4 joueurs</option><option value="5">5 joueurs</option></select></label>'+
      '<label>Budget initial en Berrys<input id="online-budget" inputmode="numeric" type="text" value="250000000"></label>'+
      '<label>Personnages à recruter chacun<input id="online-team" inputmode="numeric" type="number" min="1" max="30" value="10"></label>'+
      '<label class="online-check"><input id="online-spoilers" type="checkbox" checked> Inclure les personnages manga récents (spoilers)</label>'+
      button("create-go","Créer le salon →")+
      '<p class="online-hint">Tu recevras un code à partager. La partie démarre quand tous les pirates sont dans le salon.</p>':
      mode==="join"?
      '<h2>🏴‍☠️ Rejoindre une partie</h2><label>Code du salon<input id="online-code" type="text" maxlength="8" autocapitalize="characters" value="'+escOnline(prefill||"")+'" placeholder="EX. PIRATE42"></label>'+
      '<label>Ton pseudo<input id="online-name" maxlength="25" value="Pirate 2" autocomplete="nickname"></label>'+
      button("join-go","Rejoindre le salon →"):
      '<h2>Jouez de 2 à 5 sur vos téléphones !</h2><p>Un pirate crée le salon, les autres le rejoignent avec un code. Les enchères et les pouvoirs se synchronisent automatiquement.</p>'+
      button("create-form","⚓ Créer une partie")+button("join-form","🔑 Rejoindre une partie","btn-ghost")+button("archive","📜 Archives des Pirates","btn-ghost");
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
  function powerFor(p,id){if(view?.v3?.version===3)return v3Power(p,id);const base=CARDS[id]?.power||0;return p.smileModifiers?.[id]===undefined?base:Math.max(0,Math.min(100,base+p.smileModifiers[id]));}
  function classFor(n){return n>=95?"S":n>=80?"A":n>=65?"B":n>=50?"C":n>=35?"D":n>=20?"E":"F";}
  function gameScore(){
    const summary=window.OPMERCATO_ROSTER_SUMMARY;
    const activeLosses=view.event?.active?.type==="god"?view.event.active.removed||[]:[];
    const losses=view.event?.godLosses?.length?view.event.godLosses:activeLosses;
    const teamSize=view.teamSize||10;
    return '<section class="online-teams"><h2>⚓ Vos équipages</h2>'+
      view.players.map(p=>'<div class="online-team"><div class="online-team-top"><b>'+label(p)+'</b><strong>'+p.score+' pts</strong></div>'+
        (p.ship?'<div class="v3-team-ship-online">'+shipMark3(p)+'</div>':'')+
        '<div class="online-team-meta">'+berrys(p.budget)+' restants · '+p.roster.length+'/'+teamSize+' recrues · '+p.passesUsed+'/'+(p.ship==='sunny'?8:5)+' refus</div>'+
        (summary?summary.crew(p,{v3:view.v3?.version===3,online:true,score:p.score,losses}):
          '<p class="online-small">'+p.roster.length+' personnages · '+p.score+' points</p>')+
        (p.marineAward&&BigInt(p.marineAward)>0n?'<div class="oprs-finance">🎲 Prime de la Marine : +'+berrys(p.marineAward)+' (Berrys, sans points de puissance)</div>':'')+
        '<div class="oprs-status">👑 Rois '+(p.hakiUsed?'utilisé':'prêt')+
          ' · 👁 Observation '+(p.observationUsed?'utilisée':'prête')+
          ' · 🛡 Armement '+(p.armamentUsed?'utilisé':'prêt')+'</div>'+
        '</div>').join('')+'</section>';
  }
  function liveHud(){
    if(!view||view.status!=="playing")return "";
    return '<div class="op21-live-hud" aria-label="Budgets et scores en direct">'+view.players.map(p=>
      '<div class="op21-hud-player" title="'+label(p)+'"><span>'+label(p)+'</span><b>'+berrys(p.budget)+'</b><small>⭐ '+p.score+' pts · '+p.roster.length+'/'+view.teamSize+'</small>'+shipMark3(p,true)+'</div>').join('')+'</div>';
  }
  function v3TradePerson(p,id){
    const c=CARDS[id],crew=window.MERCATO_EXPANSION?.details?.[id]?.crew||"Affiliation inconnue";
    return '<article class="v3-transfer-person"><small class="v3-transfer-owner">'+label(p)+'</small>'+
      '<span class="v3-transfer-avatar"><span class="portrait-fallback">☠️</span><img class="portrait-photo" data-portrait-id="'+escOnline(id)+'" alt="Portrait de '+escOnline(c.name)+'" loading="eager"></span>'+
      '<strong class="v3-transfer-name">'+escOnline(c.name)+'</strong><small class="v3-transfer-crew">'+escOnline(crew)+'</small>'+
      '<div class="v3-transfer-stats"><span>Rang <b>'+classFor(c.power)+'</b></span><span>Puissance <b>'+powerFor(p,id)+'/100</b></span></div>'+
      '<button type="button" class="v3-transfer-details" data-online="details" data-char-id="'+escOnline(id)+'">Voir la fiche →</button></article>';
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
    reverie:["👑","LA RÊVERIE","Taxe royale ×2 : première mise obligatoire, retrait possible ensuite. Haki des Rois interdit."],
    burst:["🚀","COUP DE BURST","Le Thousand Sunny débarque ! Un Chapeau de paille disponible arrive pour une enchère secrète unique."]
  };
  function specialPanel(){
    const e=view.event.active,info=EVENT_INFO[e.type]||["✨","ÉVÉNEMENT SPÉCIAL",""];
    const mine=view.yourSeat,player=view.players[mine],myReady=e.ready?.includes(mine);
    let content="";
    if(e.stage==="intro"){
      content='<p class="v2-description">'+escOnline(info[2])+'</p>'+
        button("event-ready",myReady?"✓ En attente des autres pirates…":"Continuer →","primary",myReady)+
        '<p class="online-hint">'+(e.ready?.length||0)+'/'+view.players.length+' confirmations</p>';
    }else if(e.type==="burst"&&e.stage==="offers"){
      const submitted=e.offers?.some(o=>o.id===mine);
      content='<div class="v2-burst-card">'+portraitCard(view.auction.charId)+'</div>'+
        '<p>🔒 Chacun dépose une seule offre secrète, sans chronomètre.</p>'+
        '<div class="v2-burst-ledger">'+view.players.map(p=>
          '<div>'+label(p)+' <span>'+(e.offers?.some(o=>o.id===p.id)?'🔒 Offre verrouillée':'⏳ En attente')+'</span></div>').join('')+'</div>'+
        (submitted?'<p class="online-hint">Ton offre est verrouillée. Attends les autres joueurs.</p>':
          '<label class="v2-burst-label" for="online-burst-amount">Ta proposition en Berrys (0 pour passer)</label>'+
          '<input id="online-burst-amount" class="v2-burst-amount" type="text" inputmode="numeric" value="'+escOnline(burstDraft)+'" placeholder="Mise minimum : '+berrys(view.baseBid)+'">'+
          button("burst-submit","🔒 Confirmer mon offre secrète","primary"))+
        '<p class="online-hint">'+(e.offers?.length||0)+' / '+view.players.length+' offres validées</p>';
    }else if(e.type==="burst"&&e.stage==="tie"){
      content='<div class="v2-burst-card">'+portraitCard(view.auction.charId)+'</div>'+
        '<h3>💰 Révélation simultanée des offres</h3>'+
        '<div class="v2-results">'+e.offers.map(o=>'<p>'+label(view.players[o.id])+' : '+berrys(o.amount)+'</p>').join('')+'</div>'+
        '<p>🪙 Égalité entre les meilleures offres ! Départage à pile ou face.</p>'+
        (view.host?button("burst-coin","🪙 Lancer la pièce","primary"):
          '<p class="online-hint">L’hôte lance la pièce, le résultat apparaît sur les deux téléphones.</p>');
    }else if(e.type==="burst"&&e.stage==="result"){
      content='<div class="v2-burst-card">'+portraitCard(view.auction.charId)+'</div>'+
        '<h3>🚀 Les offres sont révélées !</h3>'+
        '<div class="v2-results">'+e.offers.map(o=>'<p>'+label(view.players[o.id])+' : '+berrys(o.amount)+'</p>').join('')+'</div>'+
        '<p>'+(e.winner===null?'Personnage invendu.':'🏆 '+label(view.players[e.winner])+' recrute '+escOnline(CARDS[view.auction.charId]?.name||"ce personnage")+' pour '+berrys(view.v3?view.players[e.winner].purchases?.[view.auction.charId]??view.auction.highBid:view.auction.highBid)+(view.v3&&view.players[e.winner].ship==='mobydick'?' · 🐋 Protection du Père : −'+berrys(BigInt(view.auction.highBid)-BigInt(view.players[e.winner].purchases?.[view.auction.charId]??view.auction.highBid)):''))+'</p>'+
        button("event-ready",myReady?"✓ En attente des autres pirates…":"Continuer →","primary",myReady);
    }else if(e.stage==="result"){
      const items=e.type==="marine"?(view.event.rolls||[]).map(x=>{
        const p=view.players[x.id];return '<p>'+label(p)+' : 🎲 '+x.roll+' → +'+x.percent+' % ('+berrys(x.amount)+')</p>';
      }):e.flips.map(x=>{
        const p=view.players[x.id];return '<p>'+label(p)+' : '+escOnline(CARDS[x.charId]?.name||x.charId)+
          ' — '+(x.pile?"Pile +25":"Face −25")+' · '+x.before+' → '+x.after+' pts</p>';
      });
      content=(e.type==="smile"&&window.OPMERCATO_SMILE_SUMMARY?
        window.OPMERCATO_SMILE_SUMMARY.render(e.flips,view.players):
        '<div class="v2-results">'+items.join("")+'</div>')+
        button("event-ready",myReady?"✓ En attente des autres pirates…":"Continuer →","primary",myReady);
    }else if(e.stage==="god-result"){
      content='<p>💥 Voici les personnages perdus par chaque pirate :</p><div class="op21-god-result">'+view.players.map(p=>
        '<div class="op21-god-player"><strong>'+label(p)+'</strong>'+
        ((e.removed||[]).filter(x=>x.from===p.id).map(x=>'<div class="op21-god-victim"><span class="portrait portrait-tiny"><span class="portrait-fallback">☠️</span><img class="portrait-photo" data-portrait-id="'+escOnline(x.id)+'" alt="" loading="lazy"></span><span>💥 '+escOnline(CARDS[x.id]?.name||x.id)+' · '+(CARDS[x.id]?.power||0)+' pts</span></div>').join('')||'<p>Équipage épargné</p>')+'</div>').join('')+'</div>'+button("event-ready",myReady?"✓ En attente des autres pirates…":"Continuer →","primary",myReady);
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
      '<div class="v2-symbol">'+info[0]+'</div>'+(window.OPMERCATO_ART?.image(e.type)||'')+'<h2>'+info[1]+'</h2>'+content+'</div>';
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
    const canAfford=BigInt(me.budget)>=minimum&&BigInt(me.budget)>=((me.ship==='mobydick'?minimum*(royal?2n:1n)*90n+50n:minimum*(royal?2n:1n)*100n)/100n)&&me.roster.length<view.teamSize;
    const canHaki=!royal&&turn&&!me.hakiUsed&&a.firstTurnId===me.id&&a.leader===null&&a.highBid==="0"&&a.passed.length===0;
    const armamentPending=a.outcome==="sold"&&leader&&!leader.armamentUsed&&Number(CARDS[a.charId]?.power??100)<=60&&!a.armamentChoice;
    const roll=view.event.awaitingRolls;
    let actionHtml="";
    if(roll){
      const roller=view.players[view.event.rollIndex];
      const mine=view.event.rollIndex===me.id;
      actionHtml='<div class="online-turn">🎲 Au tour de <b>'+label(roller)+'</b> pour lancer son dé</div>'+
        button("roll","🎲 Lancer mon dé (5 à 30 %)","primary",!mine);
    }else if(!active){
      const bidAmount=BigInt(a.highBid||"0"),rawCost=royal?bidAmount*2n:bidAmount;
      const recorded=leader?.purchases?.[a.charId];
      const effectiveCost=leader&&recorded!==undefined?BigInt(recorded):leader?.ship==='mobydick'?((rawCost*90n+50n)/100n||1n):rawCost;
      const winner=leader?'🏆 '+label(leader)+' recrute '+escOnline(CARDS[a.charId]?.name||a.charId)+
         (a.hakiWinner===leader.id?' gratuitement grâce au Haki des Rois':" pour "+berrys(effectiveCost)+(leader?.ship==='mobydick'?' · 🐋 Protection du Père : −'+berrys(rawCost-effectiveCost):''))+(view.v3&&leader.shipBonus?.[a.charId]?' · 🐉 Terre Sainte +'+leader.shipBonus[a.charId]+' → '+powerFor(leader,a.charId)+' pts':'') :
         "🌊 Personnage invendu";
      const royalReceipt=leader&&royal&&a.hakiWinner!==leader.id?
        '<div class="online-royal-receipt">👑 RÊVERIE : '+berrys(bidAmount)+' × 2 = <strong>'+berrys(rawCost)+'</strong>'+
        (leader.ship==='mobydick'?' · 🐋 Protection du Père −'+berrys(rawCost-effectiveCost):'')+
        '<div>Montant réellement payé : <strong>'+berrys(effectiveCost)+'</strong></div></div>':"";
      actionHtml='<div class="online-turn online-winner">'+winner+'</div>'+royalReceipt+
        (armamentPending?(leader.id===me.id?
          '<div class="op21-armament-online"><strong>🛡 Haki de l’Armement</strong><p>'+escOnline(CARDS[a.charId]?.name||a.charId)+' : '+CARDS[a.charId].power+' → '+Math.min(100,CARDS[a.charId].power+(leader.ship==='polartang'?40:20))+' points. Utiliser ton Haki maintenant ?</p>'+button("armament-use","🛡 Renforcer de +"+(leader.ship==='polartang'?40:20)+" points")+button("armament-skip","Conserver mon Haki","btn-ghost")+'</div>':
          '<div class="op21-armament-online">🛡 '+label(leader)+' choisit d’utiliser ou non son Haki de l’Armement…</div>'):'')+
        (view.host?button("next","Personnage suivant →","primary",Boolean(armamentPending)): '<div class="online-hint">L’hôte passe au prochain personnage…</div>');
    }else{
      const offerChoices=[0n,1n,5n,10n].map((factor)=>{
        const val=minimum+factor*BigInt(view.bidStep);
        return button("bid-"+val.toString(),berrys(val), "online-offer",!turn||!canAfford||val>BigInt(me.budget)||((me.ship==='mobydick'?val*(royal?2n:1n)*90n+50n:val*(royal?2n:1n)*100n)/100n)>BigInt(me.budget));
      }).join("");
      actionHtml='<div class="online-turn"><span>AU TOUR DE</span><b>'+label(bidder)+'</b>'+
        (!turn?'<small>Patiente, l’autre pirate réfléchit !</small>':'<small>C’est à toi de jouer !</small>')+'</div>'+
        '<div class="online-bid-info"><span>Meilleure offre : <b>'+(leader?berrys(a.highBid):'Aucune')+'</b></span>'+
        '<span>'+(leader?'En tête : '+label(leader):'Mise de départ : '+berrys(view.baseBid))+'</span></div>'+
        '<div class="online-offers">'+offerChoices+'</div>'+
        '<div class="online-custom"><input id="online-custom-amount" type="text" inputmode="numeric" placeholder="Autre montant en Berrys" '+(!turn?'disabled':'')+'>'+
        button("custom-bid","Enchérir","btn-ghost",!turn)+'</div>'+
        (canHaki?button("haki","👑 Haki des Rois — recruter gratuitement"): "")+
        (royal?'<div class="online-event">👑 Taxe royale ×2 : première mise obligatoire, puis retrait gratuit. Haki des Rois désactivé.</div>':"")+
        button("pass",a.leader!==null?"Se retirer (gratuit)":"Refuser ce personnage · "+(5-me.passesUsed)+"/5 restants",
          "online-pass",!turn||(royal&&a.leader===null)||(a.leader===null&&me.passesUsed>=(me.ship==='sunny'?8:5)))+
        '<div class="online-powers">'+
        button("observation",me.ship==="orojackson"?(me.observationUsed?"👑 Revoir Vision du Futur":"👑 Vision du Futur · 6 cartes + inversion"):(me.observationUsed?"👁 Revoir mes visions":"👁 Observation"),"btn-ghost",!turn&&!me.observationUsed)+
        '<span class="op21-haki-hint">🛡 '+(me.armamentUsed?'Armement utilisé':'Armement : +20 proposé sur une recrue ≤60')+'</span></div>'+
        (peekOpen&&me.observationUsed?peekPanel():"");
    }
    return '<div class="online-round"><strong>ENCHÈRE N° '+view.round+'</strong><span>'+view.remaining+' cartes restantes</span></div>'+
      eventBox()+(a.mystery&&active?'<div class="online-rank">Classe '+escOnline(a.tier)+'</div>':"")+
      portraitCard(a.charId)+'<section class="online-card online-actions-area">'+actionHtml+'</section>';
  }
  function peekPanel(){
    const me=view.players[view.yourSeat],oro=view.v3&&me.ship==="orojackson",items=view.peek||[];
    let out='<div class="online-peek"><h3>👁 '+(oro?"Vision du Futur — ":"")+"Tes "+(oro?6:3)+" prochaines cartes</h3>";
    out+='<div class="'+(oro?'v3-peek-grid':'v3-peek-list')+'">'+(items.length?items.map((x,i)=>{
      const c=x.id?CARDS[x.id]:null;
      return '<div class="v3-peek-card"><b>Position '+(i+1)+'</b>'+
      (c?'<span class="v3-face-clip"><img class="portrait-photo v3-face-image" data-portrait-id="'+escOnline(x.id)+'" alt=""></span>':'')+
      '<strong>'+escOnline(c?.name||(x.id||'🔒 Enchère mystère'))+'</strong>'+
      '<small>Rang '+escOnline(x.tier)+(x.power!==undefined?' · '+x.power+' pts':'')+'</small>'+
      (oro?'<small>Début : '+label(view.players[x.firstSeat])+'</small>':'')+'</div>';
    }).join(""):'<p>Aucun personnage restant.</p>')+'</div>';
    if(oro&&!view.v3.swapUsed&&items.length>=2){
       const selector=(id)=>'<select id="'+id+'">'+items.map((x,i)=>'<option value="'+i+'">'+(i+1)+'. '+escOnline(CARDS[x.id]?.name||x.id)+'</option>').join("")+'</select>';
       out+='<h4>🔀 Inverser deux personnages (facultatif)</h4>'+
         '<div class="v3-swap-controls"><label>Premier personnage'+selector("v3-swap-first")+'</label>'+
         '<label>Second personnage'+selector("v3-swap-second")+'</label></div>'+
         '<div id="v3-swap-preview" class="v3-trade-preview"></div>'+
         button("v3-swap","Confirmer l’inversion","btn-ghost");
    }else if(oro&&view.v3.swapUsed)out+='<p>✓ Inversion utilisée.</p>';
    return out+'<small>Vision privée. Seul le joueur concerné reçoit ces informations.</small></div>';
  }
  function v3RefreshSwap(){
    if(!view?.v3)return;const x=root.querySelector("#v3-swap-first"),y=root.querySelector("#v3-swap-second"),preview=root.querySelector("#v3-swap-preview");
    if(!x||!y||!preview)return;
    const a=Number(x.value),b=Number(y.value);
    const p=view.peek||[];
    preview.textContent=a===b?"Choisis deux positions différentes.":
      "Aperçu : "+(a+1)+" → "+(b+1)+", "+(b+1)+" → "+(a+1)+
      ". Les premiers enchérisseurs restent attachés à leur position.";
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
    const bonus=p=>(p.armamentId?(p.armamentBonus??5):0)+(p.bonuses||[]).reduce((s,b)=>s+b.points,0);
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
    const num=view?.teamSize||10;
    const initial=view?.baseBid||"20",increment=view?.bidStep||"10";
    const rules=[
      'Chaque joueur commence avec le meme budget et doit recruter <b>'+num+' personnages</b>.',
      'La mise de depart est de <b>'+berrys(initial)+'</b>, puis chaque surenchere monte d’au moins <b>'+berrys(increment)+'</b>.',
      'Les offres personnalisees et les budgets eleves sont autorises.',
      'Refuser une carte avant toute enchere consomme un de tes <b>5 refus</b>. Se retirer apres une offre est gratuit.',
      'Haki des Rois : recruter gratuitement une fois, seulement si tu joues en premier et avant toute enchere.',
      'Haki de l’Observation : consulter secretement les trois prochaines cartes une fois par joueur.',
      'Haki de l’Armement : après une recrue de <b>60 points ou moins</b>, tu peux lui donner <b>+20 points définitifs</b> ou conserver ton Haki. Une seule utilisation.',
      'Synergies par affiliation : 1 personnage = 0 point ; 2 = +10 ; 3 = +20 ; 4 = +30 ; 5 ou plus = +50. Les bonus de plusieurs affiliations se cumulent. Les anciens trios spéciaux ne comptent plus.',
      '8 evenements independants : Guerre au sommet, Prime de la Marine, Personnage mystere, Marche noir, God Valley, SMILE, Reverie et Coup de Burst.',
      '1 evenement pour 1 a 5 recrues, 2 pour 6 a 9, 3 pour 10 a 30. Les joueurs confirment chaque annonce avec Continuer.',
      'Evenements sans doublon, sans chevauchement et a des tours aleatoires. SMILE arrive exclusivement dans la seconde moitie de la partie.',
      'La Reverie impose une premiere mise ; ensuite, se retirer est gratuit. Le gagnant paie le double de sa mise et le Haki des Rois est interdit.',
      'SMILE modifie uniquement les puissances dans la partie en cours et ne change jamais le catalogue.',
      'Le score total additionne les puissances des recrues, les synergies et le Haki de l’Armement. Le budget restant departage une egalite de points.',
      'Les personnages ne peuvent etre recrutes qu’une seule fois dans chaque partie.'
    ];
    modal.innerHTML='<section class="card modal-content"><span class="eyebrow">OPMercato en ligne</span><h2>Regles du mercato</h2><ul>'+
      rules.map(x=>'<li>'+x+'</li>').join('')+'</ul><button class="primary" data-action="close-modal">Compris !</button></section>';
    modal.classList.remove("hidden");
  }

  // --- OPMercato 3.0 multiplayer screens ---
  const SHIPS3=[
    {id:"sunny",name:"Thousand Sunny",emoji:"☀️",power:"Coup de Vent",effect:"8 refus au lieu de 5 pendant les enchères classiques. Les règles obligatoires de la Rêverie restent applicables."},
    {id:"redforce",name:"Red Force",emoji:"🐉",power:"Terre Sainte",effect:"Chaque recrue reçoit aléatoirement +1, +2 ou +3 points, avec un maximum de 100. Le bonus suit le personnage transféré."},
    {id:"mobydick",name:"Moby Dick",emoji:"🐋",power:"Protection du Père",effect:"−10 % sur le prix réellement payé des enchères gagnées, y compris pendant les événements spéciaux. Les offres sont comparées avant la remise."},
    {id:"polartang",name:"Polar Tang",emoji:"💛",power:"Opération de Jouvence",effect:"Ton Haki de l’Armement passe une seule fois de +20 à +40 points sur un personnage de puissance initiale 60 ou moins, sans dépasser 100."},
    {id:"orojackson",name:"Oro Jackson",emoji:"👑",power:"Vision du Futur",effect:"Remplace l’Observation : dévoile les 6 prochaines recrues avec leur puissance et leur premier enchérisseur ; inverse deux positions une fois."}
  ];
  const sh3=id=>SHIPS3.find(x=>x.id===id);
  const shipMark3=(p,compact=false)=>{
    const sh=sh3(p?.ship);if(!sh)return "";
    const status=p.ship==="sunny"?(8-p.passesUsed)+" refus":p.ship==="redforce"?"Actif":p.ship==="mobydick"?"−10 %":
      p.ship==="polartang"?(p.armamentUsed?"Utilisé":"Prêt"):
      p.observationUsed?"Utilisé":"Prêt";
    return '<span class="v3-ship-stamp"><img src="./opmercato-ships-sprite.webp" style="object-position:'+(SHIPS3.findIndex(q=>q.id===sh.id)*25)+'% 50%" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'inline\'"><span class="v3-ship-emoji" style="display:none">'+sh.emoji+'</span>'+
      (compact?'':'<strong>'+escOnline(sh.name)+'</strong>')+'<small>'+escOnline(status)+'</small></span>';
  };
  const v3Power=(p,id)=>{
    const base=Number(CARDS[id]?.power||0),smile=Number(p.smileModifiers?.[id]||0),ship=Number(p.shipBonus?.[id]||0);
    const haki=p.armamentId===id?Number(p.armamentBonus||0):0;
    return Math.max(0,Math.min(100,base+smile+ship+haki));
  };
  const v3Synergy=ids=>{
    const map=new Map();for(const id of ids){const crew=window.MERCATO_EXPANSION?.details?.[id]?.crew;if(crew)map.set(crew,(map.get(crew)||0)+1);}
    return [...map.values()].reduce((a,n)=>a+(n>=5?50:n>=2?(n-1)*10:0),0);
  };
  const projected3=(p,remove,add)=>{
    const ids=p.roster.map(id=>id===remove?add:id);
    return ids.reduce((n,id)=>n+(id===add?Math.max(0,Math.min(100,Number(CARDS[id]?.power||0)+Number(view.players.find(x=>x.roster.includes(add))?.shipBonus?.[add]||0)+
       Number(view.players.find(x=>x.roster.includes(add))?.smileModifiers?.[add]||0))):v3Power(p,id)),0)+v3Synergy(ids);
  };
  function v3Page(){
    const x=view.v3,me=view.players[view.yourSeat],mine=view.yourSeat;
    if(x.stage==="intro"){
      return '<section class="online-card v3-card v3-start-intro">'+(window.OPMERCATO_ART?.logo()||'')+'<h2>Bienvenue à bord, pirates !</h2>'+
       '<p>La partie commence par un tirage au sort, puis chacun choisit son navire exclusif.</p>'+
       '<div class="v3-intro-steps"><p><b>1.</b> Chaque joueur lance un dé à six faces. En cas d’égalité, seuls les ex æquo relancent.</p>'+
       '<p><b>2.</b> Le plus grand score choisit son navire en premier ; les autres suivent dans l’ordre.</p>'+
       '<p><b>3.</b> Chaque navire est unique et possède un pouvoir spécial pour toute la partie.</p>'+
       '<p><b>4.</b> Le dernier à choisir son navire commence la première enchère. L’ordre alterne ensuite.</p></div>'+
       '<p>Équipage prêt : <b>'+(x.introReady||[]).length+'/'+view.players.length+'</b></p>'+
       button("v3-intro-ready",(x.introReady||[]).includes(mine)?"✓ En attente des autres pirates":"⚔️ J’ai compris, commencer","primary",(x.introReady||[]).includes(mine))+
       '</section>';
    }
    const box=(title,inner)=>'<section class="online-card v3-card"><h2>'+title+'</h2>'+inner+'</section>';
    if(x.stage==="dice"||x.stage==="dice-tie"){
      const tied=x.stage==="dice-tie",eligible=tied?x.tiePlayers.includes(mine):x.rolls[mine]===undefined;
      const drawn=tied?x.tieRolls?.[mine]:x.rolls[mine];
      const who=tied?x.tiePlayers.map(id=>view.players[id]):view.players;
      return box(tied?"🎲 Égalité ! Nouvelle série de dés":"🎲 Tirage au sort des navires",
        '<p>'+(tied?"Seuls les joueurs ex æquo relancent, jusqu’à départage complet.":
        "Le meilleur résultat choisira en premier. Le dernier commencera les enchères.")+'</p>'+
        '<div class="v3-rolls">'+who.map(p=>'<div><b>'+label(p)+'</b><span>🎲 '+
        ((tied?x.tieRolls?.[p.id]:x.rolls[p.id])??"?")+'</span></div>').join("")+'</div>'+
        button("v3-roll",eligible?"🎲 Lancer mon dé":drawn!==undefined?"✓ Dé lancé":"Attendre le départage","primary",!eligible));
    }
    if(x.stage==="ships"){
      const current=x.choiceOrder[x.choiceIndex],owner=view.players[current];
      const used=new Set(view.players.map(p=>p.ship).filter(Boolean));
      return box("⛵ Choix des navires",'<p>Ordre du tirage : '+x.choiceOrder.map(id=>label(view.players[id])).join(" → ")+'</p>'+
         '<h3>Au tour de '+label(owner)+'</h3><div class="v3-ship-grid">'+SHIPS3.map(sh=>
          '<div class="v3-ship"><div class="v3-ship-art"><img src="./opmercato-ships-sprite.webp" style="object-position:'+(SHIPS3.findIndex(q=>q.id===sh.id)*25)+'% 50%" alt="'+escOnline(sh.name)+'" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'block\'"><span style="display:none">'+sh.emoji+'</span></div>'+
          '<strong>'+escOnline(sh.name)+'</strong><small>'+escOnline(sh.power)+'</small><p>'+escOnline(sh.effect)+'</p>'+
          button("v3-select-"+sh.id,used.has(sh.id)?"Déjà choisi":"Choisir ce navire","primary",used.has(sh.id)||current!==mine)+'</div>').join("")+'</div>');
    }
    if(x.stage==="morgans"){
      const m=x.morgans,stage=m.stage,id=m.id;
      let inner=(stage==='intro'?(window.OPMERCATO_ART?.image('morgans')||''):'')+'<p>Devine la puissance initiale du personnage secret entre 1 et 100.</p>';
      if(stage==="intro")inner+='<p>'+m.ready.length+'/'+view.players.length+' pirates prêts.</p>'+
        button("v3-morgans-ready",m.ready.includes(mine)?"En attente des autres…":"Continuer →","primary",m.ready.includes(mine));
      if(stage==="guesses")inner+='<p>'+m.submitted.length+'/'+view.players.length+' prédictions enregistrées.</p>'+
        (m.submitted.includes(mine)?"<p>Prédiction verrouillée. Attends les autres pirates.</p>":
          '<label>Ta prédiction secrète<input id="v3-prediction" type="number" min="1" max="100" inputmode="numeric" placeholder="1 à 100"></label>'+button("v3-morgans-guess","🔒 Confirmer ma prédiction","primary"));
      if(id)inner+='<div class="v3-prediction-card">'+portraitCard(id)+'</div><p><b>'+escOnline(CARDS[id]?.name||id)+
        '</b> · Rang '+escOnline(view.auction?.tier||((n)=>n>=95?"S":n>=80?"A":n>=65?"B":n>=50?"C":n>=35?"D":n>=20?"E":"F")(Number(CARDS[id]?.power||0)))+
        ' · Puissance originale : <b>'+Number(CARDS[id]?.power||0)+'</b></p>';
      if(["character","reveal","wheel","winner","offer","armament"].includes(stage)){
       const revealed=stage==="character"?0:stage==="reveal"?m.shown:view.players.length;
       inner+='<div class="v3-predictions">'+view.players.map((p,i)=>
         '<div><b>'+label(p)+'</b><span>'+(i<revealed?(m.guesses[p.id]+' · écart '+Math.abs(m.guesses[p.id]-Number(CARDS[id]?.power||0))):"🔒")+'</span></div>').join("")+'</div>';
      }
      if(["character","reveal","winner"].includes(stage))
       inner+=view.host?button("v3-morgans-next","Continuer →","primary"):'<p>En attente de l’hôte…</p>';
      if(stage==="wheel")inner+='<div class="v3-wheel">🎡</div><p>Égalité entre '+m.tied.map(id=>label(view.players[id])).join(" et ")+'</p>'+
       (view.host?button("v3-morgans-wheel","Tourner la roue !","primary"):"<p>La roue sera lancée par l’hôte.</p>");
      if(stage==="winner"||stage==="offer"||stage==="armament")inner+='<h3>🏆 '+label(view.players[m.winner])+' remporte la prédiction !</h3>';
      if(stage==="offer"){
       const owner=view.players[m.winner],buff=m.bonus||0,proposed=Math.min(100,Number(CARDS[id]?.power||0)+buff);
       inner+='<p>Recrutement gratuit · '+(owner.ship==="redforce"?"🐉 Terre Sainte : +"+buff+" points · ":"")+
        'Puissance projetée : '+proposed+' points · Gain total : <b>+'+(Math.min(100,Number(CARDS[id]?.power||0)+buff)+v3Synergy(owner.roster.concat(id))-v3Synergy(owner.roster))+' points</b> (synergies comprises).</p>';
       inner+=mine===m.winner?button("v3-morgans-accept","✅ Recruter gratuitement","primary")+button("v3-morgans-reject","Refuser (sans refus consommé)","btn-ghost"):'<p>Le gagnant réfléchit…</p>';
      }
      if(stage==="armament")inner+=mine===m.winner?'<p>Haki de l’Armement disponible sur cette recrue.</p>'+
        button("v3-morgans-armament","🛡 Renforcer ma recrue de +"+(me.ship==="polartang"?40:20),"primary")+
        button("v3-morgans-skip","Conserver mon Haki","btn-ghost"):'<p>Choix du Haki en cours…</p>';
      return box("📰 Prédictions de Morgans",inner);
    }
    if(x.stage==="market"){
      const m=x.market,owner=view.players[m.order[m.step]];
      let inner=(m.offer||m.result?'':(window.OPMERCATO_ART?.image('market',true)||''))+'<p>Une proposition par joueur, un personnage contre un personnage, sans Berrys.</p>'+
        '<p>Proposition '+(m.step+1)+'/'+m.order.length+' · Au tour de <b>'+label(owner)+'</b></p>';
      if(m.result){
        const o=m.result,a=view.players[o.from],b=view.players[o.to],done=(o.ack||[]).includes(mine);
        inner+='<div class="v3-transfer-result '+(o.accepted?'is-accepted':'is-rejected')+'" role="status">'+
          '<div class="v3-transfer-result-icon">'+(o.accepted?'✅':'❌')+'</div>'+(window.OPMERCATO_ART?.image(o.accepted?'accepted':'rejected',true)||'')+
          '<h3>'+(o.accepted?'Échange accepté !':'Échange refusé')+'</h3>'+
          '<p>'+label(b)+(o.accepted?' a accepté':' a refusé')+' la proposition de '+label(a)+'.</p>'+
          '<p class="v3-transfer-result-pair">'+escOnline(CARDS[o.give]?.name||o.give)+' ⇄ '+escOnline(CARDS[o.take]?.name||o.take)+'</p>'+
          '<p>'+(o.accepted?'Les équipages et les scores ont été actualisés.':'Les deux pirates conservent leurs personnages.')+'</p>'+
          (done?'<p>⏳ En attente des autres joueurs…</p>':button("v3-trade-continue","Continuer →","primary"))+
          '<small class="v3-transfer-ack">'+(o.ack||[]).length+'/'+view.players.length+' joueurs prêts</small></div>';
      }else if(m.offer){
        const a=view.players[m.offer.from],b=view.players[m.offer.to],give=m.offer.give,take=m.offer.take;
        inner+='<p class="v3-transfer-intro">'+label(a)+' propose à '+label(b)+'</p>'+
         '<div class="v3-transfer-grid">'+v3TradePerson(a,give)+v3TradePerson(b,take)+'</div>'+
         '<p class="v3-transfer-impact">Effets estimés : '+label(a)+' <b>'+(projected3(a,give,take)-a.score)+' pts</b> · '+
         label(b)+' <b>'+(projected3(b,take,give)-b.score)+' pts</b></p>'+
         (mine===m.offer.to?button("v3-trade-accept","✅ Accepter l’échange","primary")+
          button("v3-trade-reject","Refuser l’échange","btn-ghost"):'<p>En attente de la réponse du destinataire…</p>');
      }else if(m.order[m.step]===mine){
        const targets=view.players.filter(p=>p.id!==mine&&p.roster.some(id=>!m.locked.includes(id)));
        const options=arr=>arr.map(p=>'<option value="'+p.id+'">'+label(p)+'</option>').join("");
        inner+='<label>Adversaire<select id="v3-trade-target">'+options(targets)+'</select></label>'+
          '<label>Ton personnage<select id="v3-trade-give">'+me.roster.filter(id=>!m.locked.includes(id)).map(id=>'<option value="'+id+'">'+escOnline(CARDS[id]?.name||id)+'</option>').join("")+'</select></label>'+
          '<label>Personnage souhaité<select id="v3-trade-take"></select></label>'+
          '<div class="v3-trade-preview" id="v3-trade-preview"></div>'+
          button("v3-trade-offer","Proposer l’échange","primary",!targets.length)+
          button("v3-trade-pass","Passer ma proposition","btn-ghost");
      }else inner+='<p>En attente du joueur qui propose…</p>';
      inner+='<div class="v3-trade-history">'+m.exchanges.map(t=>'<p>✅ '+escOnline(CARDS[t.give]?.name||t.give)+' ⇄ '+escOnline(CARDS[t.take]?.name||t.take)+'</p>').join("")+'</div>';
      return box("🔄 Marché des transferts",inner);
    }
    return "";
  }
  function v3RefreshTrade(){
    if(!view?.v3||view.v3.stage!=="market")return;
    const target=root.querySelector("#v3-trade-target"),give=root.querySelector("#v3-trade-give"),take=root.querySelector("#v3-trade-take");
    if(!target||!give||!take)return;
    const other=view.players[Number(target.value)],mine=view.players[view.yourSeat],locked=view.v3.market.locked;
    const old=take.value;
    take.innerHTML=(other?.roster||[]).filter(id=>!locked.includes(id)).map(id=>'<option value="'+id+'">'+escOnline(CARDS[id]?.name||id)+'</option>').join("");
    if([...take.options].some(x=>x.value===old))take.value=old;
    const a=give.value,b=take.value,panel=root.querySelector("#v3-trade-preview");
    if(!a||!b||!panel)return;
    panel.innerHTML='<p>Impact total (synergies comprises) : <b>'+label(mine)+' '+(projected3(mine,a,b)-mine.score)+
      ' pts</b> · <b>'+label(other)+' '+(projected3(other,b,a)-other.score)+' pts</b></p>';
  }

  function sharedNotice(){
    const n=view?.v3?.notice;if(!n)return "";
    const confirmed=(n.ack||[]).includes(view.yourSeat),ready=(n.ack||[]).length;
    return '<div class="v3-shared-backdrop" role="dialog" aria-modal="true" aria-label="Résultat partagé">'+
      '<section class="v3-shared-notice"><span class="v3-shared-kicker">✦ ÉVÉNEMENT PARTAGÉ ✦</span>'+
      '<div class="v3-shared-icon" aria-hidden="true">'+escOnline(n.icon||"✨")+'</div>'+
      '<h2>'+escOnline(n.title)+'</h2><p>'+escOnline(n.body)+'</p>'+
      (confirmed?'<div class="v3-shared-wait">✓ Tu as confirmé. En attente des autres pirates…</div>':
        button("v3-notice-continue","Continuer →","primary"))+
      '<div class="v3-shared-progress">'+ready+' / '+view.players.length+' joueurs prêts</div>'+
      '<small>La partie reprend uniquement après confirmation de tous les joueurs.</small>'+
      '</section></div>';
  }
  function paint(){
    if(!showing)return;
    if(!view){landing();return;}
    const main=view.status==="lobby"?waiting():
      '<div class="online-room-bar"><span>Salon <strong>'+escOnline(view.code)+'</strong></span><span>🌐 Synchronisation active</span></div>'+
      liveHud()+'<div class="online-nav">'+button("catalog","📚 Catalogue ("+(window.OPMERCATO_SHARED?.catalogCount?.()??CHARACTERS.length)+" personnages)","btn-ghost")+button("rules","📖 Règles","btn-ghost")+'</div>'+
      (view.status==="finished"?scoreboardEnd():view.v3&&view.v3.stage!=="auction"?v3Page():auction())+gameScore()+
      (view.host&&view.status==="playing"?button("finish","Terminer cette partie","online-text"):"");
    shell(main+(fx?'<div class="v2-fx"><div class="v2-fx-icon">'+(fx.type==="roll"?"🎲":"🪙")+'</div><strong>'+
      (fx.type==="roll"?"Dé : "+fx.outcome.roll+" · +"+fx.outcome.percent+" %":fx.outcome.pile?"PILE · +25":"FACE · −25")+
      '</strong></div>':"")+(view?'<div class="online-back">'+button("leave-online","Quitter ce salon et créer une nouvelle partie","online-text")+'</div>':"")+(onlineDetailId?detail(onlineDetailId):"")+sharedNotice());
    if(view?.v3?.stage==="market")v3RefreshTrade();
    if(peekOpen&&view?.v3)v3RefreshSwap();
  }
  // Le bouton Mode en ligne se trouve maintenant sur la page d'accueil, sous Lancer le mercato.
  document.addEventListener("click",async event=>{
    const b=event.target.closest("[data-online]");if(!b)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(b.disabled)return;
    const a=b.dataset.online;
    if(a==="open"){mode="choose";show();if(session)refresh();return;}
    if(a==="local"||a==="back"){hide();return;}
    if(a==="leave-online"){if(confirm("Quitter ce salon sur ce téléphone ? Les autres joueurs pourront continuer leur partie.")){forget();show();}return;}
    if(a==="archive"){window.OP21_HISTORY?.open();return;}
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
        session={roomId:data.room.id,token:data.token};localStorage.setItem(KEY,JSON.stringify(session));window.OP21_HISTORY?.track(session);
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
    if(a==="v3-swap"){const first=Number(root.querySelector("#v3-swap-first")?.value),second=Number(root.querySelector("#v3-swap-second")?.value);if(first===second){note("Sélectionne deux positions différentes.");return;}await action("v3-observation-swap",{a:first,b:second});peekOpen=true;return;}
    if(a==="v3-roll"){const seat=view.yourSeat,name=view.players[seat]?.name;await action("v3-roll");const roll=view?.v3?.lastDice?.[seat];if(roll>=1&&roll<=6)await window.OPMERCATO_V3_DICE?.play(roll,name);return;}
    if(a.startsWith("v3-select-")){await action("v3-ship",{ship:a.slice(10)});return;}
    if(a==="v3-intro-ready"){await action("v3-intro-ready");return;}
    if(a==="v3-notice-continue"){await action("v3-notice-continue");return;}
    if(a==="v3-morgans-ready"){await action("v3-morgans-ready");return;}
    if(a==="v3-morgans-guess"){await action("v3-morgans-guess",{guess:Number(root.querySelector("#v3-prediction")?.value)});return;}
    if(a==="v3-morgans-next"||a==="v3-morgans-wheel"||a==="v3-morgans-armament"||a==="v3-morgans-skip"){await action(a);return;}
    if(a==="v3-morgans-accept"||a==="v3-morgans-reject"){await action("v3-morgans-recruit",{accept:a==="v3-morgans-accept"});return;}
    if(a==="v3-trade-offer"){await action("v3-trade-offer",{to:Number(root.querySelector("#v3-trade-target")?.value),
       give:root.querySelector("#v3-trade-give")?.value,take:root.querySelector("#v3-trade-take")?.value});return;}
    if(["v3-trade-pass","v3-trade-accept","v3-trade-reject","v3-trade-continue"].includes(a)){await action(a);return;}
    if(a==="armament-use"){await action("armament",{charId:view.auction?.charId});return;}
    if(a==="armament-skip"){await action("armament-skip");return;}
    if(a==="event-ready"){await action("event-ready");return;}
    if(a==="coin"){await action("coin");return;}
    if(a==="burst-coin"){await action("burst-coin");return;}
    if(a==="burst-submit"){
      const amount=root.querySelector("#online-burst-amount")?.value.replace(/[\s._]/g,"").trim();
      if(!/^\d+$/.test(String(amount??""))){note("Indique une offre entière en Berrys, ou 0 pour passer.");return;}
      await action("burst-offer",{amount});return;
    }
    if(a==="event-skip"){await action("event-eliminate",{charId:""});return;}
    if(a.startsWith("pick-")){await action("event-pick",{charId:a.slice(5)});return;}
    if(a.startsWith("delete-")){await action("event-eliminate",{charId:a.slice(7)});return;}
    if(a==="custom-bid"){const val=root.querySelector("#online-custom-amount")?.value.replace(/[\s._]/g,"");await action("bid",{amount:val});return;}
    if(a.startsWith("bid-")){await action("bid",{amount:a.slice(4)});return;}
    if(["start","bid","pass","haki","observation","next","roll","finish"].includes(a)){await action(a);return;}
  },true);
  document.addEventListener("input",ev=>{if(ev.target?.id==="online-burst-amount")burstDraft=ev.target.value;});
  document.addEventListener("change",ev=>{if(["v3-trade-target","v3-trade-give","v3-trade-take"].includes(ev.target?.id))v3RefreshTrade();
    if(["v3-swap-first","v3-swap-second"].includes(ev.target?.id))v3RefreshSwap();});
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&showing)refresh();});
  const css=document.createElement("style");
  css.textContent=`
    .online-royal-receipt{padding:14px 11px;margin:12px 0;text-align:center;background:#293b47;color:#ffe0a2;border:1px solid #d4a966;border-radius:13px;line-height:1.7;font-size:13px}
    .online-royal-receipt strong{color:#fff0bc}
    .v3-shared-backdrop{position:fixed;z-index:1400;inset:0;display:flex;align-items:center;justify-content:center;background:#061522ef;overflow-y:auto;padding:calc(env(safe-area-inset-top) + 15px) 15px calc(env(safe-area-inset-bottom) + 15px);box-sizing:border-box}
    .v3-shared-notice{width:min(100%,460px);max-height:95dvh;overflow-y:auto;box-sizing:border-box;text-align:center;padding:23px 20px 25px;border:2px solid #e0b96d;border-radius:20px;background:radial-gradient(ellipse at top,#284d61,#102839 78%);color:#eaf5f6;box-shadow:0 18px 60px #000a}
    .v3-shared-kicker{font-size:11px;letter-spacing:.13em;color:#f7cc7c;font-weight:900}
    .v3-shared-icon{font-size:64px;margin:13px 0 6px;line-height:1.25}
    .v3-shared-notice h2{font-size:clamp(21px,5.6vw,28px);line-height:1.25;overflow-wrap:anywhere;margin:8px 0}
    .v3-shared-notice p{font-size:15px;line-height:1.7;overflow-wrap:anywhere;margin:15px 0;color:#e4eced}
    .v3-shared-notice .primary{width:100%;max-width:320px;min-height:52px;font-size:16px;margin:17px auto 8px}
    .v3-shared-wait{padding:16px 8px;border:1px solid #65977f;background:#16463a;color:#c3f5d8;border-radius:12px;margin:15px 0;font-size:13px;font-weight:850}
    .v3-shared-progress{font-weight:900;color:#f6d48f;font-size:13px;margin:12px 0}
    .v3-shared-notice small{font-size:11px;line-height:1.5;color:#b4cbd5;display:block}

    .v3-face-clip{display:block!important;position:relative!important;width:60px!important;height:60px!important;max-width:60px!important;max-height:60px!important;overflow:hidden!important;contain:layout paint!important;border-radius:50%!important;border:2px solid #e0b76e;background:#24485a;margin:5px auto;flex:none!important}
    .v3-face-clip>.portrait-photo.v3-face-image{display:block!important;position:absolute!important;inset:0!important;width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;object-fit:cover!important;object-position:center 22%!important;transform:none!important;border-radius:50%!important}
    .v3-peek-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.v3-peek-card{display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0;border:1px solid #638898;background:#16354a;padding:8px;border-radius:10px;font-size:11px;text-align:center}.v3-peek-card strong{font-size:11px;overflow-wrap:anywhere}.v3-peek-card small{font-size:10px;color:#c4d4dd}.v3-peek-card .portrait-tiny{width:48px;height:48px}.v3-swap-controls{display:grid;grid-template-columns:1fr 1fr;gap:8px}.v3-swap-controls select{width:100%;background:#183449;color:#fff;border-radius:8px;padding:8px;border:1px solid #6b8c9b}
    .v3-start-intro{text-align:center;padding:24px 15px}
    .v3-intro-symbols{font-size:74px;filter:drop-shadow(0 10px 14px #0008)}
    .v3-intro-steps{display:grid;gap:8px;margin:20px 0;text-align:left}
    .v3-intro-steps p{padding:12px;border:1px solid #b08a57;background:#1a3549;border-radius:11px;margin:0;line-height:1.5}
    .v3-redforce-bonus{display:block;color:#f6cf86;font-size:10px;font-weight:800}
    .v3-team-ship-online{display:flex;align-items:center;gap:10px;margin:10px 0 3px;padding:7px 10px;border:1px solid #9e8055;background:#0c2537;border-radius:12px;max-width:100%;box-sizing:border-box}
    .v3-team-ship-online .v3-ship-stamp{display:flex;align-items:center;flex-wrap:wrap;gap:7px;width:100%;font-size:12px;margin:0;line-height:1.3;min-width:0}
    .v3-team-ship-online .v3-ship-stamp img{width:40px;height:40px;min-width:40px;border-radius:50%}
    .v3-team-ship-online .v3-ship-stamp small{display:inline-flex;margin-left:auto;background:#315647;color:#d6f5e0;border-radius:12px;padding:5px 9px;white-space:nowrap}
    .v3-ship p{line-height:1.48;font-size:12px;min-height:6em;color:#e4edf0}
    .v3-ship{align-content:start;padding:11px;gap:8px}
    .v3-ship strong{font-size:15px;color:#ffe1a5}
    .v3-ship-stamp{display:inline-flex;align-items:center;gap:5px;color:#fbd48f;font-size:11px;margin:5px 0}
    .v3-ship-stamp img{width:27px;height:27px;object-fit:cover;border-radius:50%;border:1px solid #d3a867}
    .v3-ship-stamp small{font-size:10px;color:#98e9b4}
    .v3-rolls,.v3-predictions{display:grid;gap:6px;margin:15px 0}
    .v3-rolls>div,.v3-predictions>div{display:flex;justify-content:space-between;gap:10px;background:#243d50;padding:11px;border-radius:10px}
    .v3-rolls span{font-size:22px;animation:v3die .6s ease both}
    @keyframes v3die{from{transform:rotateX(600deg) rotateY(400deg) scale(.4)}to{transform:none}}
    .v3-ship-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:9px}
    .v3-ship{display:grid;gap:5px;background:#213e52;padding:8px;border:1px solid #ae8c58;border-radius:13px;text-align:center}
    .v3-ship-art{width:100%;aspect-ratio:1;display:grid;place-items:center;background:#153146;border-radius:8px;font-size:57px}
    .v3-ship-art img{width:100%;height:100%;object-fit:cover;border-radius:8px}
    .v3-ship strong{font-size:13px}.v3-ship small{color:#e3bd7b;font-weight:700}.v3-ship p{font-size:11px}
    .v3-prediction-card{max-width:320px;margin:14px auto}
    .v3-morgans-logo,.v3-wheel{text-align:center;font-size:72px;animation:v3die 1.5s both}
    .v3-wheel{animation:v3die 2s linear infinite}
    .v3-transfer-ack{display:block;color:#b4d4cf;font-size:11px;margin-top:12px}
    .v3-trade-versus{display:grid;grid-template-columns:1fr 30px 1fr;align-items:center;gap:5px}
    .v3-trade-versus .character-card{min-height:100px;padding:8px;margin:0}
    .v3-trade-versus .character-name{font-size:16px;margin:2px}.v3-trade-versus .power strong{font-size:16px}
    .v3-trade-preview{margin:10px 0;color:#fbd48f;font-size:13px}
    .online-smile-buff{display:block;font-size:10px;color:#f2cc7a;font-weight:800;margin-top:2px}
    .op21-live-hud{position:sticky;top:calc(env(safe-area-inset-top, 0px) + 8px);z-index:80;display:grid;grid-template-columns:repeat(auto-fit,minmax(112px,1fr));gap:5px;background:#081b29f5;border:1px solid #9e7d48;border-radius:14px;padding:8px 5px;box-shadow:0 7px 17px #0015;backdrop-filter:blur(13px)}
    .op21-hud-player{min-width:0;display:grid;gap:3px;text-align:center;padding:3px}
    .op21-hud-player:not(:last-child){border-right:1px solid #ffffff2b}
    .op21-hud-player span{font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:850;color:#dae7ec}
    .op21-hud-player b{font-size:clamp(10px,2.8vw,15px);color:#f8d18a;overflow-wrap:anywhere;line-height:1.25}
    .op21-hud-player small{font-size:10px;color:#c9dee1}
    .op21-god-result{display:grid;gap:10px;text-align:left}
    .op21-god-player{border:1px solid #b87968;background:#25212e;padding:12px;border-radius:12px}
    .op21-god-player>strong{display:block;color:#ffdcaa;margin-bottom:8px}
    .op21-god-victim{display:flex;gap:9px;align-items:center;font-size:12px}
    .op21-god-victim .portrait-tiny{height:35px;width:28px;min-width:28px}
    .op21-armament-online{padding:15px;border:1px solid #d4ad64;border-radius:15px;background:#2e3745;color:#ffdb91;margin:10px 0;text-align:center}
    .op21-armament-online button{width:100%;margin-top:10px}
    .op21-haki-hint{display:block;text-align:center;padding:9px;border:1px solid #537180;border-radius:10px;font-size:11px;color:#b8d2dc}

    .v2-special{margin:14px 0;border:2px solid #c8a369;background:radial-gradient(circle at 50% 10%,#344d60,#102332 75%);border-radius:23px;padding:28px 16px;color:#fff4d4;text-align:center;box-shadow:0 10px 32px #0008}
    .v2-war,.v2-god{border-color:#df685a;background:linear-gradient(130deg,#4b242a,#101c2c)}
    .v2-black,.v2-mystery{border-color:#a993e0;background:linear-gradient(130deg,#362448,#132332)}
    .v2-burst{border-color:#f4c476;background:linear-gradient(135deg,#294e73,#102232)}
    .v2-burst-card{max-width:420px;margin:12px auto}
    .v2-burst-card .character-card{margin:0 auto}
    .v2-burst-ledger{display:grid;gap:8px;text-align:left;margin:14px 0}
    .v2-burst-ledger>div{padding:12px;border:1px solid #8f805e;border-radius:10px;background:#233e50;display:flex;justify-content:space-between;gap:10px}
    .v2-burst-label{display:block;text-align:left;margin-top:20px;font-size:13px}
    .v2-burst-amount{box-sizing:border-box;width:100%;border:1px solid #ba965e;background:#f3ede0;color:#152c3c;padding:14px;border-radius:12px;font-size:18px;margin-top:9px}
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