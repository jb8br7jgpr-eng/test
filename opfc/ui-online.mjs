/** OPFC — bloc 10A2 : vues de salon mobile. Aucun jeton privé dans le HTML. */
import {normalizeRoomCode} from './online-protocol.mjs';
const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(act,label,style='ghost',disabled=false)=>'<button type="button" class="btn '+style+
 '" data-action="online-'+act+'" '+(disabled?'disabled aria-disabled="true"':'')+'>'+h(label)+'</button>';
const note=()=>'<p class="online-status-note" role="status">Le serveur Supabase OPFC n’est pas encore déployé. Tu peux découvrir les écrans, mais pas encore créer ou rejoindre un vrai salon.</p>';
const pretty=id=>id==='PSG'?'Pirates Saint-Grandline':'Olympique de MaryGeoise';
export function renderOnlineLobby({stage='choose',firstClub='PSG',room=null,configured=false,
 joinCode='',busy=false,error=''}={}){
 const nav='<div class="online-nav">'+button('back','← Retour','ghost small')+'</div>';
 let out='<section class="online-wrapper"><span class="eyebrow">OPMercato FC · Deux iPhone</span>'+
 '<h1 class="page-title">Mode en ligne</h1>'+
 '<p class="muted online-description">Deux clubs, un salon privé et une partie partagée. Les enchères et le match en réseau seront raccordés au prochain bloc.</p>';
 if(error)out+='<div class="alert" role="alert">'+h(error)+'</div>';
 if(stage==='choose'){
  out+='<section class="panel online-lobby-card"><h2 class="section-title">Choisis comment jouer</h2>'+
  '<div class="online-choices">'+button('create-screen','Créer une partie','primary full')+
  button('join-screen','Rejoindre une partie','ghost full')+'</div>'+
  '<p class="caption">Le créateur choisit son club. L’invité obtient automatiquement l’autre club.</p></section>';
 }else if(stage==='create'){
  out+='<section class="panel online-lobby-card"><h2 class="section-title">Créer un salon privé</h2>'+
   '<div class="online-versus"><span class="club-option active">'+h(firstClub)+'</span><span>VS</span><span class="club-option">'+(firstClub==='PSG'?'OM':'PSG')+'</span></div>'+
   '<p>Tu joueras avec <strong>'+h(pretty(firstClub))+'</strong>.</p>'+
   '<p class="caption">Un code privé à six caractères sera généré pour ton adversaire.</p>'+
   button('create','Générer le code du salon','primary full',busy||!configured)+'</section>';
 }else if(stage==='join'){
  out+='<section class="panel online-lobby-card"><h2 class="section-title">Rejoindre un salon</h2>'+
   '<label class="online-label" for="opfc-room-code">Code à 6 caractères</label>'+
   '<input id="opfc-room-code" class="online-code-input" type="text" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="10" placeholder="ABC234" value="'+h(joinCode)+'">'+
   '<p class="caption">Le code est fourni par le joueur qui a créé le salon.</p>'+
   button('join','Rejoindre le salon','primary full',busy||!configured)+'</section>';
 }else if(stage==='room'){
  if(!room)throw Error('Salon indisponible');
  const linked=room.opponentConnected&&room.status!=='waiting';
  out+='<section class="panel online-lobby-card"><span class="eyebrow">'+(linked?'Adversaire connecté':'En attente de l’adversaire')+'</span>'+
   '<h2>Salon '+h(room.role==='host'?'créé':'rejoint')+'</h2>'+
   '<p class="online-room-code" aria-label="Code du salon">'+h(room.code)+'</p>'+
   '<div class="online-room-actions">'+button('copy-code','Copier le code','ghost small')+
   button('refresh','Actualiser','ghost small',busy||!configured)+'</div>'+
   '<div class="online-members"><div><strong>Ton club</strong><span>'+h(room.myClub)+' · '+h(pretty(room.myClub))+'</span></div>'+
   '<div><strong>Adversaire</strong><span>'+h(linked?'Connecté':'Pas encore connecté')+'</span></div></div>'+
   '<p class="caption">'+(linked?'Les deux joueurs sont présents. La synchronisation du jeu sera ajoutée au prochain bloc.':
   'Partage uniquement le code à six caractères. Ne partage jamais ton jeton de session.')+'</p>'+
   button('forget-confirm','Quitter ce salon sur cet appareil','ghost full')+'</section>';
 }else if(stage==='restore'){
  out+='<section class="panel online-lobby-card"><h2>Session retrouvée sur cet iPhone</h2>'+
   '<p>Actualise pour récupérer le salon. La session est conservée séparément de ta partie locale.</p>'+
   button('refresh','Actualiser mon salon','primary full',busy||!configured)+
   button('forget-confirm','Oublier cette session','ghost full')+'</section>';
 }else if(stage==='forget-confirm'){
  out+='<section class="panel online-lobby-card"><h2>Oublier la session ?</h2>'+
  '<p>Cela supprime l’accès sauvegardé sur cet iPhone, mais ne ferme pas le salon du serveur.</p>'+
  button('forget','Oublier ce salon','negative full')+
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
