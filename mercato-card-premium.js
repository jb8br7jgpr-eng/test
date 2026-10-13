(function premiumMercatoCards(){
  'use strict';
  // Les personnages ne doivent pas dépendre d'un appel réseau pour connaître leur arc.
  // L'arc est celui où le personnage est introduit ou tient un rôle important.
  const groups={
    'Romance Dawn':'roger luffy shanks zoro alvida helmeppo prime-wb kuina higuma beckman roux yasopp limejuice bonk-punch monster',
    'Orange Town':'buggy cabaji mohji cabaji2',
    'Syrup Village':'usopp kuro jango',
    'Baratie':'sanji mihawk donkrieg gin zeff pearl fullbody',
    'Arlong Park':'nami arlong arlong2',
    'Loguetown':'smoker tashigi dragon',
    'Reverse Mountain':'vivi',
    'Little Garden':'mr3 galdino',
    'Drum':'chopper wapol',
    'Alabasta':'ace crocodile bonclay mr1 daz-bones hina cobra pell chaka koza karoo',
    'Whisky Peak':'robin',
    'Jaya':'teach bellamy cricket burgess vanaugur lafitte docq doflamingo whitebeard-jr',
    'Skypiea':'enel ganfall wyper nolande kalgara conis ohm satori gedatsu shura',
    'Long Ring Long Land':'foxy kuzan',
    'Water Seven':'franky lucci kaku paulie iceburg tom kokoro',
    'Enies Lobby':'spandam kalifa blueno jabra kumadori fukuro spandine',
    'Post-Enies Lobby':'prime-garp coby helmeppo2',
    'Thriller Bark':'brook kuma moria perona absalom hogback ryuma',
    'Sabaody':'law kid killer urouge bege hawkins apoo drake rayleigh kizaru bepo jeanbart penguin shachi heat wire sentomaru charlos',
    'Amazon Lily':'hancock',
    'Impel Down':'magellan ivankov shiryu',
    'Marineford':'akainu sengoku marco vista jozu izou thatch rakuyo whiteybay shiki tsuru onigumo momonga doberman',
    'Île des Hommes-Poissons':'jinbe bigmom shiraboshi neptune hody vander fisher',
    'Punk Hazard':'caesar vergo smoker-tashigi kinemon momono',
    'Dressrosa':'fujitora sabo pica diamante trebol rebecca cavendish bartolomeo vergo-sub senorpink gladius laog sugar corazon kyros viola leo sai donchinjao hajrudin or-lumbus ideo hack',
    'Zou':'inu neko jack pedro carrot wanda shishilian',
    'Whole Cake Island':'katakuri smoothie perospero',
    'Rêverie':'imu garling warcury nusjuro mars ju-peter saturn',
    'Wano':'kaido oden ryokugyu yamato king queen toki hiyori denjiro ashura kawamatsu raizo kiku kanjuro orochi kanjiro hyogoro tama shinobu ulti pageone whoswho blackmaria sasaki numbers-giant speed ginrummy rocks',
    'Egghead':'bonney stussy vegapunk shaka lilith atlas edison pythagoras york s-hawk s-snake s-bear s-shark ginny kuma-king prince-grus hibari',
    'Elbaf':'loki harald gunko sommers killingham shamrock gaban',
    'Revolutionnaires':'belo-betty karasu morley lindbergh koala dragon-kuma',
    'Marine':'kong bogard',
    'Île des Hommes-Poissons / Egghead':'kuma',
    'Siècle oublié':'joyboy',
    'Hachinosu':'catarina vasco pizarro sanjuan stronger',
    'Après Dressrosa':'bakkin',
    'Zou / Wano':'whoswho',
    'Egghead / Marine':'s-hawk',
    'Thriller Bark / Cross Guild':'mr1'
  };
  const arcs=Object.create(null);
  Object.entries(groups).forEach(([arc,ids])=>ids.split(/\s+/).forEach(id=>{
    if(!arcs[id])arcs[id]=arc;
  }));
  // Certaines catégories décrivent un groupe plutôt qu'un véritable arc :
  // pour ces personnages, on donne un arc de référence connu.
  Object.assign(arcs,{
    'belo-betty':'Rêverie','karasu':'Rêverie','morley':'Rêverie',
    'lindbergh':'Rêverie','koala':'Dressrosa','dragon-kuma':'Impel Down',
    'kong':'Post-Marineford','bogard':'Post-Enies Lobby',
    'joyboy':'Wano / Egghead','catarina':'Impel Down','vasco':'Impel Down',
    'pizarro':'Impel Down','sanjuan':'Marineford','stronger':'Jaya',
    'rocks':'Wano','whitebeard-jr':'Après Dressrosa','prime-wb':'Jaya','coby':'Romance Dawn',
    'smoker':'Loguetown','bigmom':'Île des Hommes-Poissons',
    'ryokugyu':'Rêverie / Wano','oden':'Wano'
  });
  const details=window.MERCATO_EXPANSION?.details||{};
  const getArc=id=>arcs[id]||'Arc à confirmer';
  const previousCharCard=charCard;
  // Remplace le générateur d'encarts sans toucher au déroulement des enchères,
  // aux sauvegardes, ni à la gestion des personnages mystères.
  charCard=function(c){
    if(!c)return previousCharCard(c);
    const t=tierOf(c.power);
    const d=details[c.id]||{};
    const affiliation=d.crew||'Affiliation non renseignée';
    const arc=getArc(c.id);
    const spoiler=d.spoiler?'<span class="premium-spoiler">⚠ Manga récent</span>':'';
    return '<article class="card character-card premium-recruit" style="--tier-color:'+t.color+
      ';--tier-border:'+t.color+'88;--tier-bg:'+t.background+';--tier-glow:'+t.glow+
      '" aria-label="Personnage '+esc(c.name)+', classe '+t.tier+', puissance '+c.power+'">'+
      '<div class="premium-kicker"><span class="wanted">AVIS DE RECRUTEMENT</span>'+spoiler+'</div>'+
      '<div class="premium-main">'+
        '<div class="premium-identity">'+
          '<h1 class="character-name">'+esc(c.name)+'</h1>'+
          '<div class="premium-info"><span>Affiliation</span><strong>'+esc(affiliation)+'</strong></div>'+
          '<div class="premium-info"><span>Arc d’apparition</span><strong>'+esc(arc)+'</strong></div>'+
        '</div>'+
        '<div class="premium-art" aria-label="Portrait de '+esc(c.name)+'">'+
          '<div class="portrait premium-portrait"><span class="portrait-fallback">☠️</span>'+
          '<img class="portrait-photo" data-portrait-id="'+esc(c.id)+'" alt="Illustration de '+esc(c.name)+'" loading="eager" /></div>'+
        '</div>'+
      '</div>'+
      '<div class="premium-stats">'+
        '<div class="premium-stat premium-stat-tier"><span>Rang</span><strong><b>'+t.tier+'</b> '+esc(t.label)+'</strong></div>'+
        '<div class="premium-stat premium-stat-power"><span>Puissance</span><strong>'+c.power+'<small> / 100</small></strong></div>'+
        '<button class="premium-detail" data-action="details" data-char-id="'+esc(c.id)+'" aria-label="Voir la fiche de '+esc(c.name)+'">Voir la fiche <span aria-hidden="true">→</span></button>'+
      '</div>'+
      '</article>';
  };
  const style=document.createElement('style');
  style.textContent=`
    /* V2 — les photos ne se chevauchent plus avec le nom, le rang ou la puissance. */
    .character-card.premium-recruit {
      position:relative; overflow:hidden; min-height:0; padding:22px;
      background:radial-gradient(ellipse at 94% 10%,var(--tier-glow),transparent 55%),
       linear-gradient(125deg,#1b394b,#122b3a 67%,#102634);
      border:1px solid rgba(199,221,230,.20); border-radius:23px;
      box-shadow:0 16px 36px rgba(0,0,0,.22);
    }
    .character-card.premium-recruit:after{content:none;}
    .premium-kicker{display:flex;gap:8px;align-items:center;justify-content:space-between;
      padding-bottom:16px;margin-bottom:18px;border-bottom:1px solid rgba(210,235,236,.11)}
    .premium-spoiler{font-size:10px;white-space:nowrap;color:#ffdf99}
    .premium-main{display:grid;grid-template-columns:minmax(0,1fr) minmax(146px, .85fr);
      align-items:start;gap:20px}
    .premium-identity{min-width:0;display:flex;flex-direction:column;gap:17px;padding-top:6px}
    .premium-recruit .character-name{
      margin:0 0 5px;max-width:none;font-size:clamp(26px,5.5vw,43px);
      line-height:1.04;letter-spacing:-.045em;overflow-wrap:anywhere;text-wrap:balance;
      font-weight:900;position:static}
    .premium-info{display:grid;gap:5px;min-width:0}
    .premium-info span{font-size:10px;font-weight:850;letter-spacing:.11em;
      text-transform:uppercase;color:#91b5c0}
    .premium-info strong{font-size:clamp(12px,2.5vw,16px);color:#f5f8f7;
      font-weight:760;line-height:1.34;overflow-wrap:anywhere}
    .premium-info:last-child strong{color:#ffd589}
    .premium-art{min-width:0;display:flex;align-items:center;justify-content:center}
    .premium-portrait{width:100%;aspect-ratio:4/5;min-height:0;max-height:288px;
      border-radius:16px;border:1px solid rgba(244,203,122,.45);
      background:linear-gradient(135deg,#253d51,#132634);
      box-shadow:0 8px 22px rgba(0,0,0,.23)}
    .premium-portrait .portrait-fallback{font-size:clamp(30px,7vw,53px)}
    .premium-portrait .portrait-photo{object-fit:contain;object-position:center}
    .premium-stats{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(128px,1.2fr);
      gap:9px;margin-top:17px;position:relative;z-index:1;align-items:stretch}
    .premium-stat{min-width:0;display:flex;flex-direction:column;justify-content:center;gap:5px;
      background:rgba(2,15,23,.43);border:1px solid rgba(255,255,255,.11);
      border-radius:13px;padding:11px 12px}
    .premium-stat>span{text-transform:uppercase;font-size:10px;letter-spacing:.1em;
      font-weight:850;color:#a1b8c4}
    .premium-stat strong{display:flex;align-items:baseline;gap:5px;color:#fff;
      font-size:clamp(15px,3.5vw,21px);font-weight:900;white-space:normal}
    .premium-stat-tier strong{color:var(--tier-color)}
    .premium-stat-tier b{font-size:clamp(21px,5vw,28px);line-height:1}
    .premium-stat-power strong{color:#f7ca72;font-size:clamp(23px,5vw,29px)}
    .premium-stat-power small{font-size:12px;color:#e4e7e2}
    .premium-detail{border:1px solid rgba(247,202,114,.5);border-radius:13px;
      background:linear-gradient(135deg,#2a5260,#183544);color:#ffe1a0;
      font-size:13px;font-weight:900;min-height:55px;padding:12px;display:flex;
      align-items:center;justify-content:center;gap:9px;white-space:nowrap}
    .premium-detail span{font-size:20px}
    .premium-detail:hover{filter:brightness(1.12)}
    @media(max-width:520px){
      .character-card.premium-recruit{padding:15px;border-radius:19px}
      .premium-kicker{margin-bottom:14px;padding-bottom:12px}
      .premium-main{grid-template-columns:minmax(0,1fr) minmax(116px,.82fr);gap:12px}
      .premium-identity{gap:12px;padding-top:2px}
      .premium-recruit .character-name{font-size:clamp(24px,7vw,34px);margin-bottom:1px}
      .premium-info strong{font-size:12px}
      .premium-info span{font-size:9px}
      .premium-portrait{max-height:220px;border-radius:12px}
      .premium-stats{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}
      .premium-detail{grid-column:1/-1;min-height:45px}
      .premium-stat{padding:9px 11px}
      .premium-stat-tier strong{font-size:15px}
    }
    @media(max-width:340px){
      .premium-main{grid-template-columns:minmax(0,1fr) 112px;gap:10px}
      .premium-info strong{font-size:11px}
      .premium-recruit .character-name{font-size:23px}
    }
  `;
  document.head.appendChild(style);
  render();
})();
