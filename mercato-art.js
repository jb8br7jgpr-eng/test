/* OPMercato — illustrations 4:3 de l'utilisateur.
   Les images s'affichent seulement si les fichiers originaux existent.
   Aucun bloc vide ne recouvre les informations en cas de fichier manquant. */
(function(){
  'use strict';
  const pictures=Object.freeze({
    market:['op-art-mercato-annonce.jpg','Annonce du marché des transferts : Luffy et Zoro'],
    accepted:['op-art-mercato-accepte.jpg','Échange accepté : Chopper et Usopp'],
    rejected:['op-art-mercato-refuse.jpg','Échange refusé : Zoro et Sanji'],
    morgans:['op-art-morgans.jpg','Big News Morgans lisant son journal'],
    war:['op-art-guerre-au-sommet.jpg','Barbe Blanche déchaîne des tsunamis sur Marineford'],
    marine:['op-art-prime-marine.jpg','Brannew affiche la prime de Luffy'],
    mystery:['op-art-personnage-mystere.jpg','Les Mugiwaras contemplent une prime mystérieuse'],
    black:['op-art-marche-noir.jpg','Les figures de la pègre découvrent un trésor'],
    god:['op-art-god-valley.jpg','Clash entre Rocks et Roger à God Valley'],
    smile:['op-art-smile.jpg','Doflamingo tient les fruits artificiels SMILE'],
    reverie:['op-art-reverie.jpg','Les souverains réunis à la Rêverie'],
    burst:['op-art-coup-de-burst.jpg','Le Thousand Sunny s’envole au-dessus des vagues']
  });
  function image(key,compact=false){
    const entry=pictures[key];
    if(!entry)return '';
    return '<figure class="op-art'+(compact?' op-art-compact':'')+'">'+
      '<img src="./'+entry[0]+'" alt="'+entry[1]+'" loading="eager" decoding="async" '+
      'onload="this.parentElement.classList.add(&quot;is-ready&quot;)" '+
      'onerror="this.parentElement.remove()"></figure>';
  }
  function logo(){
    return '<div class="op-logo-frame op-art-logo"><img src="./opmercato-logo.jpg?v=1" alt="Logo OPMercato" decoding="async"></div>';
  }
  window.OPMERCATO_ART=Object.freeze({image,logo});
  const style=document.createElement('style');
  style.textContent=`
    .op-art{display:none;box-sizing:border-box;width:min(100%,360px);margin:12px auto 16px;
      overflow:hidden;border:1px solid rgba(247,202,114,.75);border-radius:14px;
      box-shadow:0 10px 25px #0005;background:#0a2230;}
    .op-art.is-ready{display:block}
    .op-art img{display:block;width:100%;height:auto;aspect-ratio:4/3;object-fit:contain}
    .op-art-compact{width:min(100%,300px);margin:10px auto 14px}
    .op-art-logo{display:block;width:min(100%,290px);max-width:100%;
      aspect-ratio:2.5/1;margin:0 auto 17px;border-radius:14px}
    .v2-local-special:has(.op-art.is-ready)>.v2-local-symbol,
    .v2-special:has(.op-art.is-ready)>.v2-symbol{display:none}
    @media(max-height:740px){.op-art{width:min(100%,285px)}.op-art-compact{width:min(100%,255px)}}
    @media(min-width:700px){.op-art{width:min(100%,440px)}.op-art-compact{width:min(100%,340px)}}
  `;
  document.head.appendChild(style);
})();