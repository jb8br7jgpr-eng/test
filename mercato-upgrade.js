(function upgradeMercato(){
  'use strict';
  const portraits = new Map();
  const aliases = {
    'prime-wb':'Edward Newgate','prime-garp':'Monkey D. Garp','sengoku':'Sengoku',
    'luffy':'Monkey D. Luffy','teach':'Marshall D. Teach','bigmom':'Charlotte Linlin',
    'roger':'Gol D. Roger','dragon':'Monkey D. Dragon','rayleigh':'Silvers Rayleigh',
    'akainu':'Sakazuki','kuzan':'Kuzan','kizaru':'Borsalino','ryokugyu':'Aramaki',
    'fujitora':'Issho','beckman':'Benn Beckman','hancock':'Boa Hancock',
    'enel':'Enel','inu':'Inuarashi','neko':'Nekomamushi',
    'bonclay':'Bentham','mr1':'Daz Bones','mr3':'Galdino','buggy':'Buggy',
    'jinbe':'Jinbe','coby':'Koby','law':'Trafalgar D. Water Law',
    'shanks':'Shanks','ace':'Portgas D. Ace','prime-wb':'Edward Newgate',
    'jack':'Jack','loki':'Loki','kaido':'Kaido','vegapunk':'Vegapunk'
  };
  const details = window.MERCATO_EXPANSION?.details || {};
  let spoilManga = localStorage.getItem('mercato-autorise-manga') !== 'false';
  function getDetails(id){
    const x = details[id] || {};
    return {crew:x.crew||'Non renseigné',ability:x.ability||'Techniques et capacités propres au personnage',
      height:x.height||'Non renseignée',description:x.description||'Personnage de l’univers One Piece.',
      alias:x.alias||aliases[id]||'',spoiler:!!x.spoiler};
  }
  function parseMoney(value){
    if(typeof value==='bigint')return value;
    const s=String(value??'').replace(/[\s\u00a0\u202f._]/g,'');
    if(!/^\d+$/.test(s))return null;
    try {return BigInt(s);} catch(e){return null;}
  }
  function money(value){return parseMoney(value)??0n;}
  function baseBid(){return money(state?.baseBid ?? 20);}
  function bidStep(){return money(state?.bidStep ?? 10);}
  currency = function(value){return money(value).toLocaleString('fr-FR')+' ฿';};
  canParticipate = function(p,amount){
    const n=parseMoney(amount);
    return !!p&&p.roster.length<TEAM_SIZE&&n!==null&&money(p.budget)>=n;
  };
  isComplete = function(){
    if(!state)return false;
    return state.players.every(p=>p.roster.length>=TEAM_SIZE)||!state.players.some(p=>canParticipate(p,baseBid()));
  };
  findNextBidder = function(afterIndex,a){
    const min=money(a.highBid)>0n ? money(a.highBid)+bidStep():baseBid();
    for(let offset=1;offset<=state.players.length;offset++){
      const p=state.players[(Number(afterIndex)+offset)%state.players.length];
      if(p.id!==a.leader&&!a.passed.includes(p.id)&&canParticipate(p,min))return p.id;
    }
    return null;
  };
  settle = function(){
    const a=state?.auction;
    if(!a||a.outcome!==null)return;
    if(a.leader!==null){
      const p=player(a.leader);
      if(!canParticipate(p,a.highBid)){showToast('Enchère invalide.');return;}
      p.budget=(money(p.budget)-money(a.highBid)).toString();
      p.roster.push(a.charId);
      a.outcome='sold';
    }else a.outcome='unsold';
    a.turnId=null;save();render();
  };
  bid = function(value){
    const a=state?.auction;
    if(!a||a.outcome!==null)return;
    const n=parseMoney(value);
    const minimum=money(a.highBid)>0n?money(a.highBid)+bidStep():baseBid();
    const bidder=player(a.turnId);
    if(n===null||n<minimum||!canParticipate(bidder,n)){
      showToast('Offre insuffisante ou budget dépassé.');return;
    }
    a.highBid=n.toString();
    a.leader=bidder.id;
    a.turnId=findNextBidder(bidder.id,a);
    if(a.turnId===null)settle(); else{save();render();}
  };
  start = function(){
    for(let i=0;i<playerCount;i++){
      const input=document.querySelector('#name-'+i);
      if(input)names[i]=input.value.trim().slice(0,25)||'Pirate '+(i+1);
    }
    const b=parseMoney(document.querySelector('#budget')?.value);
    if(b===null||b<1n){
      showToast('Entre un budget entier positif, sans limite maximale.');return;
    }
    startingBudget=b.toString();
    const initial=b>=1000n?b/50n:20n;
    const increment=b>=1000n?b/100n:10n;
    const pool=CHARACTERS.filter(c=>spoilManga||!getDetails(c.id).spoiler);
    state={version:1,phase:'auction',
      players:names.slice(0,playerCount).map((name,id)=>({id,name,budget:startingBudget,roster:[]})),
      drawPile:shuffle(pool.map(c=>c.id)),drawIndex:0,round:0,auction:null,
      baseBid:initial.toString(),bidStep:increment.toString()};
    drawNext();
  };
  const previousSetup=setupScreen;
  setupScreen=function(){
    return previousSetup()
      .replace('Budget de départ (฿)','Budget de départ libre (฿)')
      .replace(/type="number" min="100" max="100000" step="100" value="[^"]*" inputmode="numeric"/,
        'type="text" autocomplete="off" value="'+esc(startingBudget)+'" inputmode="numeric" placeholder="Ex. 1000000000"')
      .replace('<button class="primary" data-action="start">',
        '<p class="hint" style="margin:-5px 0 15px">Aucun plafond ! Tu peux mettre 1 000 000 000 Berrys ou plus. Les enchères s’adaptent automatiquement.</p><label class="spoiler-choice"><input type="checkbox" id="manga-allowed" '+(spoilManga?'checked':'')+' /> Inclure les personnages manga très récents (spoilers Egghead / Elbaf)</label><button class="primary" data-action="start">');
  };
  const oldCharacterCard=charCard;
  charCard=function(c){
    const d=getDetails(c.id);
    let h=oldCharacterCard(c);
    h=h.replace('<h1 class="character-name">',
      '<div class="portrait-main">'+portraitMarkup(c.id,'portrait-large')+'</div><h1 class="character-name">');
    h=h.replace('</article>',
      '<div class="character-quick"><span>'+esc(d.crew)+'</span><button data-action="details" data-char-id="'+esc(c.id)+'">Voir la fiche →</button></div>'+ (d.spoiler?'<div class="spoiler-chip">⚠️ Spoiler manga</div>':'')+'</article>');
    return h;
  };
  const previousAuction=auctionScreen;
  auctionScreen=function(){
    let h=previousAuction();
    if(state?.auction?.outcome!==null)return h;
    const a=state.auction;
    const bidder=player(a.turnId);
    const min=money(a.highBid)>0n?money(a.highBid)+bidStep():baseBid();
    const increments=[0n,1n,5n,10n];
    const offers='<div class="offers">'+increments.map((factor)=>{
      const n=min+factor*bidStep();
      return '<button class="offer-btn" data-action="bid" data-amount="'+n.toString()+'" '+(!canParticipate(bidder,n)?'disabled':'')+'><b>'+currency(n)+'</b><small>'+(factor===0n?'Offre minimale':'+'+factor+' palier(s)')+'</small></button>';
    }).join('')+'</div><div class="custom-bid"><label for="custom-bid">Autre montant (฿)</label><div><input id="custom-bid" type="text" inputmode="numeric" placeholder="'+esc(min.toString())+'" /><button class="btn-ghost" data-action="bid-custom">Enchérir</button></div></div>';
    const begin=h.indexOf('<div class="offers">');
    const end=h.indexOf('<button class="pass-btn"',begin);
    if(begin>=0&&end>begin)h=h.slice(0,begin)+offers+h.slice(end);
    return h;
  };
  function portraitMarkup(id,css='portrait-small'){
    return '<div class="portrait '+css+'"><span class="portrait-fallback">☠️</span><img class="portrait-photo" data-portrait-id="'+esc(id)+'" alt="" loading="lazy" /></div>';
  }
  const oldScoreBoard=scoreBoard;
  scoreBoard=function(){
    const h=oldScoreBoard();
    if(!state)return h;
    let out=h;
    for(const p of state.players){
      for(const id of p.roster){
        const c=CARDS[id];
        if(!c)continue;
        const key='<span class="chip">'+esc(c.name)+' <em>'+tierOf(c.power).tier+'</em></span>';
        const replacement='<button class="chip chip-photo" data-action="details" data-char-id="'+esc(id)+'">'+portraitMarkup(id,'portrait-tiny')+'<span>'+esc(c.name)+' <em>'+tierOf(c.power).tier+'</em></span></button>';
        out=out.replace(key,replacement);
      }
    }
    return out;
  };
  const oldRender=render;
  render=function(){
    oldRender();
    const top=app.querySelector('.topbar');
    if(top && state){
      top.insertAdjacentHTML('afterend','<div class="game-nav"><button class="btn-ghost" data-action="catalog">📚 Catalogue ('+CHARACTERS.length+' personnages)</button><span>🎲 Enchères entre amis</span></div>');
    }
    refreshImages();
  };
  function norm(str){
    return String(str||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toLowerCase().replace(/\(prime\)|\([^)]*\)/g,'').replace(/[^a-z0-9]/g,'');
  }
  function setPortraits(records,provider){
    const byName=new Map();
    for(const r of records){
      if(r?.name&&r?.url&&/^https:\/\//.test(r.url))byName.set(norm(r.name),r.url);
    }
    for(const c of CHARACTERS){
      if(portraits.has(c.id))continue;
      const d=getDetails(c.id);
      const candidates=[d.alias,aliases[c.id],c.name,c.name.replace(/\s*\(prime\)/i,''),c.name.replace(/^(Saint|Dr)\s+/i,'')];
      for(const candidate of candidates){
        if(candidate&&byName.has(norm(candidate))){
          portraits.set(c.id,byName.get(norm(candidate)));break;
        }
      }
    }
    try {localStorage.setItem('mercato-portraits-v3',JSON.stringify([...portraits]));}catch(e){}
    refreshImages();
  }
  // Illustrations officielles du jeu de cartes, associées à chaque personnage hors ligne.
  // Les <img> n'ont pas besoin de CORS. Les sources externes ne sont pas garanties à 100 %.
  // Illustrations choisies et envoyées par le créateur : fichiers originaux.
  // Un fichier absent n'empêche jamais le chargement du portrait précédent.
  const creatorPortraitFiles=Object.freeze({
    luffy:'op-portrait-luffy.jpg',
    zoro:'op-portrait-zoro.jpg',
    nami:'op-portrait-nami.jpg',
    usopp:'op-portrait-usopp.jpg',
    sanji:'op-portrait-sanji.jpg',
    chopper:'op-portrait-chopper.jpg',
    robin:'op-portrait-robin.jpg',
    franky:'op-portrait-franky.jpg',
    brook:'op-portrait-brook.jpg',
    jinbe:'op-portrait-jinbe.jpg',
    'luffy-gear5':'op-portrait-luffy-gear5.jpg'
  });
  const imageCandidates = new Map();
  function candidatesFor(id){
    if(imageCandidates.has(id))return imageCandidates.get(id);
    const cards=window.MERCATO_IMAGE_CARDS?.[id]||[];
    const out=[];
    // Les 11 cartes JPG originales sont prioritaires, pour les deux modes de jeu.
    if(creatorPortraitFiles[id])out.push('./custom-portraits/'+creatorPortraitFiles[id]);
    // Portraits approuvés par le créateur du jeu : priorité absolue.
    const custom=window.MERCATO_CUSTOM_PORTRAITS?.[id];
    if(typeof custom==='string' && /^(?:data:image\/webp;base64,)?[A-Za-z0-9+/]+=*$/.test(custom) && custom.length>100) {
      out.push(custom.startsWith('data:')?custom:'data:image/webp;base64,'+custom);
    }
    for(const cardId of cards.slice(0,4)){
      if(!/^(OP|EB|ST)\d{2}-\d{3}$/.test(cardId))continue;
      out.push('https://optcg-api.arjunbansal-ai.workers.dev/images/'+cardId);
      out.push('https://en.onepiece-cardgame.com/images/cardlist/card/'+cardId+'.png');
    }
    imageCandidates.set(id,out);
    return out;
  }
  function refreshImages(){
    document.querySelectorAll('img[data-portrait-id]').forEach(img=>{
      if(img.dataset.photoState)return;
      const id=img.dataset.portraitId;
      const urls=candidatesFor(id);
      const fallback=img.previousElementSibling;
      if(!urls.length){
        img.dataset.photoState='missing';
        if(fallback)fallback.textContent='🏴‍☠️';
        return;
      }
      let index=0;
      const loadNext=()=>{
        if(index>=urls.length){
          img.dataset.photoState='missing';
          img.classList.remove('loaded');
          img.removeAttribute('src');
          if(fallback)fallback.textContent='🏴‍☠️';
          return;
        }
        img.src=urls[index++];
      };
      img.dataset.photoState='loading';
      img.onload=()=>{
        if(img.naturalWidth>0){
          img.classList.add('loaded');
          img.dataset.photoState='ready';
        }else loadNext();
      };
      img.onerror=()=>{img.classList.remove('loaded');loadNext();};
      loadNext();
    });
  }
  function cardEntry(c){
    const d=getDetails(c.id), t=tierOf(c.power);
    return '<button class="catalog-tile" data-action="details" data-char-id="'+esc(c.id)+'">'+portraitMarkup(c.id,'portrait-medium')+
      '<span class="catalog-meta"><strong>'+esc(c.name)+'</strong><small>'+esc(d.crew)+'</small><span class="catalog-tier" style="color:'+t.color+'">Classe '+t.tier+' · '+c.power+' points</span>'+(d.spoiler?'<small>⚠ Manga récent</small>':'')+'</span></button>';
  }
  function catalogResults(){
    const container=modal.querySelector('#catalog-results');
    if(!container)return;
    const q=norm(modal.querySelector('#catalog-search')?.value||'');
    const filter=modal.querySelector('#catalog-tier')?.value||'all';
    const people=CHARACTERS.filter(c=>{
      const d=getDetails(c.id);
      if(!spoilManga&&d.spoiler)return false;
      if(filter!=='all'&&tierOf(c.power).tier!==filter)return false;
      return norm(c.name+' '+d.crew+' '+d.alias+' '+d.ability).includes(q);
    }).sort((a,b)=>b.power-a.power||a.name.localeCompare(b.name,'fr'));
    container.innerHTML='<div class="catalog-count">'+people.length+' personnages</div><div class="catalog-grid">'+people.map(cardEntry).join('')+'</div>';
    refreshImages();
  }
  function openCatalog(){
    modal.innerHTML='<section class="card modal-content catalog-modal"><div class="catalog-heading"><div><span class="eyebrow">Grand Line · Encyclopédie</span><h2>Les personnages</h2></div><button data-action="close-modal" class="btn-ghost">Fermer ✕</button></div><p>Explore les pirates, alliés, Marines et adversaires. Les puissances sont subjectives.</p><div class="catalog-controls"><input id="catalog-search" type="search" placeholder="Rechercher un personnage ou un équipage…" aria-label="Rechercher" /><select id="catalog-tier" aria-label="Filtrer par classe"><option value="all">Toutes les classes</option>'+['S','A','B','C','D','E','F'].map(t=>'<option>'+t+'</option>').join('')+'</select></div><label class="spoiler-choice"><input type="checkbox" id="catalog-manga" '+(spoilManga?'checked':'')+' /> Afficher les spoilers manga (Egghead / Elbaf)</label><div id="catalog-results"></div></section>';
    modal.classList.remove('hidden');
    catalogResults();
  }
  function openDetail(id){
    const c=CARDS[id];if(!c)return;
    const d=getDetails(id),t=tierOf(c.power);
    modal.innerHTML='<section class="card modal-content detail-modal"><button class="detail-close btn-ghost" data-action="close-modal">✕ Fermer</button><div class="detail-hero">'+portraitMarkup(id,'portrait-detail')+'<div><span class="eyebrow">Fiche personnage</span><h2>'+esc(c.name)+'</h2><span class="tier" style="--tier-border:'+t.color+';--tier-color:'+t.color+'">Classe '+t.tier+' · '+c.power+'/100</span></div></div><p class="detail-desc">'+esc(d.description)+'</p><dl class="detail-list"><div><dt>Équipage / camp</dt><dd>'+esc(d.crew)+'</dd></div><div><dt>Pouvoirs / style de combat</dt><dd>'+esc(d.ability)+'</dd></div><div><dt>Taille</dt><dd>'+esc(d.height)+'</dd></div></dl>'+(d.spoiler?'<p class="spoiler-warning">⚠️ Contient des éléments des arcs manga récents.</p>':'')+'<p class="image-credit">Illustrations tirées des cartes ONE PIECE CARD GAME, selon disponibilité. Images © Eiichiro Oda, Shueisha, Toei Animation et Bandai.</p></section>';
    modal.classList.remove('hidden');refreshImages();
  }
  const prevModal=openModal;
  openModal=function(kind){
    prevModal(kind);
    if(kind==='rules'){
      const list=modal.querySelector('ul');
      if(list){
        list.innerHTML=list.innerHTML.replace(
          'La mise de départ est de <b>'+currency(OPEN_BID)+'</b>, puis une nouvelle offre doit augmenter d\'au moins <b>'+currency(BID_STEP)+'</b>.',
          'La mise de départ est de <b>'+currency(baseBid())+'</b>, puis toute surenchère doit augmenter d\'au moins <b>'+currency(bidStep())+'</b>.'
        );
      }
      const x=modal.querySelector('ul');
      if(x)x.insertAdjacentHTML('beforeend','<li>Les budgets sont illimités. La mise de départ et les paliers augmentent avec le budget initial : '+currency(baseBid())+' au départ, puis +'+currency(bidStep())+' par palier.</li><li>Une enchère personnalisée est possible.</li><li>Le catalogue contient des spoilers des arcs récents si leur affichage est activé.</li>');
    }
  };
  const style=document.createElement('style');
  style.textContent=`
    .game-nav{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:-12px 0 18px}
    .game-nav .btn-ghost{color:var(--gold);border-color:rgba(247,202,114,.4)}
    .game-nav span{font-size:11px;color:var(--muted);text-align:right}
    .spoiler-choice{display:flex;align-items:flex-start;gap:10px;font-size:12px;color:var(--muted);margin:0 0 15px;line-height:1.5;cursor:pointer}
    .spoiler-choice input{width:17px;height:17px;min-height:17px;margin:1px 0 0;accent-color:var(--gold)}
    .character-card{min-height:290px}
    .character-card:after{opacity:.24}
    .character-name{max-width:67%;font-size:clamp(24px,6.5vw,43px);margin:25px 0 12px}
    .portrait{display:grid;place-items:center;position:relative;overflow:hidden;flex-shrink:0;
      background:radial-gradient(circle at 45% 20%,#345a60,#122a36);border:1px solid rgba(247,202,114,.35)}
    .portrait-fallback{font-size:30px;opacity:.55}
    .portrait-photo{width:100%;height:100%;object-fit:cover;position:absolute;inset:0;opacity:0;transition:opacity .25s}
    .portrait-photo.loaded{opacity:1}
    .portrait-large{width:38%;height:169px;border-radius:17px;position:absolute;right:19px;top:59px;z-index:1}
    .portrait-large .portrait-fallback{font-size:63px}
    .character-quick{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:15px;position:relative;z-index:2;color:var(--muted);font-size:11px}
    .character-quick button{border:1px solid var(--outline);background:#244451;color:var(--gold);border-radius:10px;padding:9px;font-weight:850;font-size:12px}
    .spoiler-chip{font-size:10px;color:#ffd171;margin-top:10px;position:relative;z-index:2}
    .custom-bid{margin-top:12px}.custom-bid label{font-size:11px;color:var(--muted);font-weight:800}
    .custom-bid>div{display:flex;gap:8px;margin-top:5px}.custom-bid input{min-width:0;flex:1}
    .custom-bid button{white-space:nowrap;color:var(--gold)}
    .offer-btn b{font-size:clamp(13px,3.9vw,20px);overflow-wrap:anywhere}
    .turn-budget{max-width:55%;white-space:normal;overflow-wrap:anywhere}
    .bid-amount{font-size:clamp(18px,6vw,30px);overflow-wrap:anywhere}
    .chip-photo{display:flex;align-items:center;gap:5px;text-align:left;color:var(--text)}
    .portrait-tiny{width:23px;height:23px;border-radius:50%;background:#24414e}
    .portrait-tiny .portrait-fallback{font-size:10px}
    .modal-content.catalog-modal{width:min(95vw,850px);max-height:92dvh;padding:18px}
    .catalog-heading{display:flex;justify-content:space-between;gap:10px;align-items:start}
    .catalog-heading h2{margin:6px 0 12px}
    .catalog-controls{display:grid;grid-template-columns:1fr 130px;gap:8px;margin-bottom:13px}
    .catalog-controls select{background:#0e2634;color:white;border:1px solid var(--outline);border-radius:12px;padding:9px;min-width:0}
    .catalog-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:8px}
    .catalog-tile{text-align:left;display:flex;align-items:center;gap:9px;border:1px solid var(--outline);background:#102d3c;color:var(--text);border-radius:12px;padding:8px;min-width:0}
    .portrait-medium{width:58px;height:74px;border-radius:9px}
    .catalog-meta{display:flex;flex-direction:column;gap:5px;min-width:0}
    .catalog-meta strong{font-size:12px;line-height:1.2;overflow-wrap:anywhere}
    .catalog-meta small{font-size:10px;color:var(--muted);overflow-wrap:anywhere}
    .catalog-tier{font-size:11px;font-weight:900}
    .catalog-count{font-size:12px;color:var(--gold);font-weight:850}
    .detail-modal{position:relative}.detail-close{display:block;margin-left:auto}
    .detail-hero{display:flex;align-items:center;gap:16px;margin:5px 0 18px}
    .portrait-detail{height:170px;width:135px;border-radius:16px}
    .detail-hero h2{font-size:clamp(20px,6vw,29px);margin:10px 0}
    .detail-desc{color:var(--text);font-size:14px}
    .detail-list{display:grid;gap:10px}
    .detail-list div{background:#102b38;padding:12px;border-radius:12px}
    .detail-list dt{font-size:10px;text-transform:uppercase;color:var(--muted);font-weight:900}
    .detail-list dd{margin:6px 0 0;font-size:14px}
    .spoiler-warning{font-size:12px;color:var(--gold)}
    .image-credit{font-size:10px !important;margin-bottom:0}
    @media(max-width:390px){.catalog-grid{grid-template-columns:1fr}.catalog-controls{grid-template-columns:1fr 115px}.portrait-large{height:135px;top:69px}.character-name{max-width:58%;font-size:27px}}
  `;
  style.textContent += `
    .portrait-photo { object-fit: cover; object-position: center top; }
    .portrait-large .portrait-photo, .portrait-detail .portrait-photo { object-position: center 10%; }
  `;
  document.head.appendChild(style);
  document.addEventListener('change',e=>{
    if(e.target.id==='manga-allowed'){
      spoilManga=e.target.checked;localStorage.setItem('mercato-autorise-manga',String(spoilManga));
    }
    if(e.target.id==='catalog-manga'){
      spoilManga=e.target.checked;localStorage.setItem('mercato-autorise-manga',String(spoilManga));catalogResults();
    }
    if(e.target.id==='catalog-tier')catalogResults();
  });
  document.addEventListener('input',e=>{
    if(e.target.id==='catalog-search')catalogResults();
  });
  document.addEventListener('click',e=>{
    const button=e.target.closest('button[data-action]');
    if(!button||button.disabled)return;
    const action=button.dataset.action;
    if(action==='bid'||action==='bid-custom'){
      e.preventDefault();e.stopImmediatePropagation();
      bid(action==='bid'?button.dataset.amount:document.querySelector('#custom-bid')?.value);
    }else if(action==='catalog'){
      e.preventDefault();e.stopImmediatePropagation();openCatalog();
    }else if(action==='details'){
      e.preventDefault();e.stopImmediatePropagation();openDetail(button.dataset.charId);
    }else if(action==='less'||action==='more'){
      e.preventDefault();e.stopImmediatePropagation();
      document.querySelectorAll('[data-player-input]').forEach(input=>{names[Number(input.dataset.playerInput)]=input.value;});
      startingBudget=document.querySelector('#budget')?.value||'1000';
      playerCount=Math.max(MIN_PLAYERS,Math.min(MAX_PLAYERS,playerCount+(action==='more'?1:-1)));
      render();
    }
  },true);
  // Les deux modes partagent le meme chargeur d'images, les fiches et le catalogue.
  window.OPMERCATO_SHARED = Object.freeze({refreshImages,openCatalog,openDetail,portraitMarkup,getDetails,catalogCount:()=>CHARACTERS.length});
  render();
})();
