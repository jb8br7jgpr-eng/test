/** OPFC — salons privés : sélection indépendante des dix clubs sur chaque iPhone. */
import {normalizeRoomCode} from './online-protocol.mjs';
import {DISPLAY_CLUBS,DISPLAY_BY_ID,displayAbbr} from './club-identities.mjs';
import {renderIdentityCrest} from './ui-portraits.mjs';
const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(act,label,style='ghost',disabled=false)=>'<button type="button" class="btn '+style+
 '" data-action="online-'+act+'" '+(disabled?'disabled aria-disabled="true"':'')+'>'+h(label)+'</button>';
const note=()=>'<p class="online-status-note" role="status">La connexion aux salons est indisponible. Réessaie plus tard.</p>';
const pretty=id=>DISPLAY_BY_ID.get(id)?.name??'Club inconnu';
function clubSelect(action,chosen){
 return '<div class="opfc-club-picker"><label for="'+h(action)+'">Ton club pour cette partie</label>'+
 '<select id="'+h(action)+'" data-action="'+h(action)+'">'+
 DISPLAY_CLUBS.map(c=>'<option value="'+c.id+'"'+(c.id===chosen?' selected':'')+'>'+
 h(c.name)+' ('+h(displayAbbr(c.id))+')</option>').join('')+'</select>'+
 '<span class="opfc-club-picked" style="border-left-color:'+h(DISPLAY_BY_ID.get(chosen)?.primary??'#c6b073')+'">'+
 renderIdentityCrest(chosen,'select-crest')+
 '<span class="opfc-picked-name"><strong>'+h(displayAbbr(chosen))+'</strong><small>'+h(pretty(chosen))+'</small></span></span></div>';
}
export function renderOnlineLobby({stage='choose',firstClub='PSG',hostIdentity='PSG',guestIdentity='OM',room=null,configured=false,
 joinCode='',busy=false,error='',gameActive=false}={}){
 const nav='<div class="online-nav">'+button('back','← Retour','ghost small')+'</div>';
 let out='<section class="online-wrapper"><span class="eyebrow">OPMercato FC · Deux iPhone</span>'+
 '<h1 class="page-title">Mode en ligne</h1>'+
 '<p class="muted online-description">Deux clubs, un salon privé, des enchères et un match partagés. Chaque téléphone commande son équipe.</p>';
 if(error)out+='<div class="alert" role="alert">'+h(error)+'</div>';
 if(stage==='choose'){
  out+='<section class="panel online-lobby-card"><h2 class="section-title">Choisis comment jouer</h2>'+
  '<div class="online-choices">'+button('create-screen','Créer une partie','primary full')+
  button('join-screen','Rejoindre une partie','ghost full')+'</div>'+
  '<p class="caption">Chaque joueur choisit l’un des dix clubs. Deux clubs identiques ne sont pas autorisés.</p></section>';
 }else if(stage==='create'){
  out+='<section class="panel online-lobby-card"><h2 class="section-title">Créer un salon privé</h2>'+
   clubSelect('online-host-identity',hostIdentity)+
   '<p>Tu joueras avec <strong>'+h(pretty(hostIdentity))+'</strong>.</p>'+
   '<p class="caption">Un code privé à six caractères sera généré pour ton adversaire.</p>'+
   button('create','Générer le code du salon','primary full',busy||!configured)+'</section>';
 }else if(stage==='join'){
  out+='<section class="panel online-lobby-card"><h2 class="section-title">Rejoindre un salon</h2>'+
   '<label class="online-label" for="opfc-room-code">Code à 6 caractères</label>'+
   '<input id="opfc-room-code" class="online-code-input" type="text" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="10" placeholder="ABC234" value="'+h(joinCode)+'">'+
   clubSelect('online-guest-identity',guestIdentity)+
   '<p class="caption">Choisis un club différent de celui du créateur. Le serveur vérifiera ton choix.</p>'+
   button('join','Rejoindre le salon','primary full',busy||!configured)+'</section>';
 }else if(stage==='room'){
  if(!room)throw Error('Salon indisponible');
  const linked=room.opponentConnected&&room.status!=='waiting';
  const mine=room.clubChoices?.[room.myClub]??room.myClub;
  const theirs=room.clubChoices?.[room.myClub==='PSG'?'OM':'PSG'];
  out+='<section class="panel online-lobby-card"><span class="eyebrow">'+(linked?'Adversaire connecté':'En attente de l’adversaire')+'</span>'+
   '<h2>Salon '+h(room.role==='host'?'créé':'rejoint')+'</h2>'+
   '<p class="online-room-code" aria-label="Code du salon">'+h(room.code)+'</p>'+
   '<div class="online-room-actions">'+button('copy-code','Copier le code','ghost small')+
   button('refresh','Actualiser','ghost small',busy||!configured)+'</div>'+
   '<div class="online-members"><div><strong>Ton club</strong><span class="online-member-identity">'+renderIdentityCrest(mine,'lobby-crest')+'<span>'+h(displayAbbr(mine))+' · '+h(pretty(mine))+'</span></span></div>'+
   '<div><strong>Adversaire</strong>'+(linked?'<span class="online-member-identity">'+renderIdentityCrest(theirs,'lobby-crest')+'<span>'+h(displayAbbr(theirs))+' · '+h(pretty(theirs))+'</span></span>':'<span>Pas encore connecté</span>')+'</div></div>'+
   '<p class="caption">'+(linked?(gameActive?'✅ Salon synchronisé. La partie continue juste en dessous.':
   'Les deux joueurs sont connectés. Chargement de la partie…'):
   'Partage uniquement le code à six caractères. Ne partage jamais ton jeton de session.')+'</p>'+
   button('menu','← Retour au menu · garder la partie','ghost full')+
   button('forget-confirm','Effacer mon accès au salon','negative full')+'</section>';
 }else if(stage==='restore'){
  out+='<section class="panel online-lobby-card"><h2>Session retrouvée sur cet iPhone</h2>'+
   '<p>Actualise pour récupérer le salon. La session est conservée séparément de ta partie locale.</p>'+
   button('refresh','Reprendre ma partie','primary full',busy||!configured)+
   button('menu','← Retour au menu · garder la partie','ghost full')+
   button('forget-confirm','Effacer mon accès au salon','negative full')+'</section>';
 }else if(stage==='forget-confirm'){
  out+='<section class="panel online-lobby-card"><h2>Oublier la session ?</h2>'+
  '<p>ATTENTION : ceci efface définitivement le jeton privé sauvegardé sur cet iPhone. Le salon reste occupé et son code ne permettra pas forcément de le rejoindre. Pour faire une pause, utilise Retour au menu.</p>'+
  button('forget','Effacer définitivement mon accès','negative full')+
  button('cancel-forget','Annuler','ghost full')+'</section>';
 }else throw Error('Écran de salon invalide');
 if(!configured)out+=note();
 out+=nav+'</section>';
 return out;
}
export function normalizeJoinCodeInput(value){
 if(typeof value!=='string')throw Error('Code de salon invalide');
 return normalizeRoomCode(value);
}
