/** OPFC — Bloc 9A : accueil, mercato et stade local iPhone. */
import {createGame,bid,pass,useKings,useObservation,acceptSolo,chooseFormation,place,ready} from './engine.mjs';
import {CARD_BY_ID} from './catalog.mjs';
import {renderCharacterPortrait,renderClubCrest} from './ui-portraits.mjs';
import {effectiveRating,lineupDetails} from './rules.mjs';
import {FORMATION_NAMES,uiAuction,uiTeam,cardStats,currentAuctionEnding,clubName} from './ui-model.mjs';
import {renderMatchScreen,matchRequiresPrivacy,dispatchOpenMatch} from './ui-match.mjs';
import {createOnlineClient} from './online-client.mjs';
import {renderOnlineLobby,normalizeJoinCodeInput} from './ui-online.mjs';

const app=document.getElementById('opfc-app');
const STORAGE='opfc-v08-local-dev';
let game=null,firstClub='PSG',selection=null,modal=null,error='',beforeForm={PSG:'2-2-2',OM:'2-2-2'};
let matchUncovered=false;
// Affichage purement local : aucun changement de règles ou de calcul moteur.
let placement=null,teamsVisible=false,pitchClub=null;
// L'état du salon et sa session sont séparés de la sauvegarde du mode local.
const onlineClient=createOnlineClient();
let onlineVisible=false,onlineStage='choose',onlineJoinCode='',onlineBusy=false,onlineError='';
let onlineTimer=null;
function stopOnlinePoll(){
 if(onlineTimer!==null){clearInterval(onlineTimer);onlineTimer=null;}
}
function syncOnlinePoll(){
 if(!onlineVisible||!onlineClient.configured||onlineClient.room?.status!=='waiting'){
  stopOnlinePoll();return;
 }
 if(onlineTimer!==null)return;
 onlineTimer=setInterval(()=>{
  if(onlineBusy||document.hidden)return;
  void refreshOnlineRoom();
 },4000);
 onlineTimer?.unref?.(); // uniquement utile sous Node lors des tests.
}
async function onlineMutation(fn){
 if(onlineBusy)return;
 onlineBusy=true;onlineError='';render();
 try{
  await fn();
  onlineError='';
 }catch(err){
  onlineError=err?.message||'Impossible de contacter le salon.';
 }finally{
  onlineBusy=false;render();syncOnlinePoll();
 }
}
async function refreshOnlineRoom(){
 await onlineMutation(async()=>{
  await onlineClient.refreshRoom();
  onlineStage='room';
 });
}
async function onlineClicked(action,button){
 if(action==='online-back'){
  if(onlineStage==='choose'||onlineStage==='room'||onlineStage==='restore'){
   onlineVisible=false;stopOnlinePoll();
  }else onlineStage='choose';
  onlineError='';render();return;
 }
 if(action==='online-create-screen'){onlineStage='create';onlineError='';render();return;}
 if(action==='online-join-screen'){onlineStage='join';onlineError='';render();return;}
 if(action==='online-cancel-forget'){onlineStage=onlineClient.room?'room':'restore';render();return;}
 if(action==='online-forget-confirm'){onlineStage='forget-confirm';render();return;}
 if(action==='online-forget'){
  stopOnlinePoll();onlineClient.leaveDevice();onlineStage='choose';onlineError='';render();return;
 }
 if(action==='online-copy-code'){
  const code=onlineClient.room?.code;
  if(!code)throw Error('Aucun code de salon à copier');
  if(!globalThis.navigator?.clipboard?.writeText)throw Error('Copie le code affiché à l’écran.');
  await navigator.clipboard.writeText(code);
  onlineError='Code copié dans le presse-papiers.';render();return;
 }
 if(action==='online-create'){
  await onlineMutation(async()=>{
   await onlineClient.createRoom(firstClub);onlineStage='room';
  });return;
 }
 if(action==='online-join'){
  const typed=document.getElementById('opfc-room-code')?.value??onlineJoinCode;
  onlineJoinCode=normalizeJoinCodeInput(typed);
  await onlineMutation(async()=>{
   await onlineClient.joinRoom(onlineJoinCode);onlineStage='room';
  });return;
 }
 if(action==='online-refresh'){await refreshOnlineRoom();return;}
 throw Error('Commande de salon inconnue');
}
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const card=id=>CARD_BY_ID.get(id);
const others=id=>id==='PSG'?'OM':'PSG';
const short=id=>esc(id);
function save(){try{if(game)localStorage.setItem(STORAGE,JSON.stringify({game,firstClub,beforeForm,placement,teamsVisible,pitchClub}));}catch{}}
function restore(){try{
 const data=JSON.parse(localStorage.getItem(STORAGE)||'null');
 if(data?.game?.version===1&&['mercato','lineup','kickoff-ready','match','moment-result','half-time','resume-ready','shootout-ready','shootout','finished'].includes(data.game.phase)&&
 data.game.teams?.length===2){
   game=data.game;firstClub=data.firstClub==='OM'?'OM':'PSG';beforeForm=data.beforeForm||beforeForm;
   teamsVisible=data.teamsVisible===true;
   pitchClub=['PSG','OM'].includes(data.pitchClub)?data.pitchClub:null;
   const p=data.placement;
   if(p&&['mercato','lineup'].includes(game.phase)&&
     game.teams.some(t=>t.club===p.club&&t.roster.includes(p.cardId))){
     placement={club:p.club,cardId:p.cardId};
     selection={club:p.club,id:p.cardId};
     pitchClub=p.club;
   }
  }
}catch{}}
const shell=()=>'<header class="topbar"><a class="brand-mini" href="./"><img src="./opfc-logo-hd.PNG" alt="" width="35" height="35"> OPMERCATO FC</a><a class="small-link" href="./">← Accueil</a></header>';
const options=(values,current)=>values.map(v=>'<option value="'+esc(v)+'" '+(v===current?'selected':'')+'>'+esc(v)+'</option>').join('');
const btn=(action,title,klass='ghost',disabled=false,extra='')=>'<button type="button" class="btn '+klass+'" data-action="'+action+'" '+extra+' '+(disabled?'disabled':'')+'>'+title+'</button>';
const sep=()=>'<span class="eyebrow">Le Classique de Grand Line</span>';
function welcome(){
 return shell()+'<main class="intro">'+
 '<img class="intro-logo" src="./opfc-logo-hd.PNG" alt="Logo OPMercato FC" width="180" height="180">'+sep()+
 '<h1 class="intro-title">La Grandline Cup<br>se gagne ici.</h1><p>Sept recrues. Deux clubs. Un seul vainqueur.</p>'+
 '<section class="panel intro-panel"><h2 class="section-title">Club du joueur 1</h2><div class="select-club">'+
 ['PSG','OM'].map(id=>'<button class="club-option '+id.toLowerCase()+' '+(firstClub===id?'active':'')+
 '" data-action="club" data-club="'+id+'" aria-pressed="'+(firstClub===id)+'"><strong>'+id+'</strong><span>'+esc(clubName(id))+'</span></button>').join('')+
 '</div><p class="caption">Joueur 2 : '+esc(clubName(others(firstClub)))+'</p></section>'+
 '<section class="panel intro-panel"><h2 class="section-title">Formations de départ</h2><div class="formation-picker">'+
 ['PSG','OM'].map(id=>'<div class="form-box"><label for="initial-'+id+'">'+id+'</label><select id="initial-'+id+'" data-action="initial-formation" data-club="'+id+'">'+options(FORMATION_NAMES,beforeForm[id])+'</select></div>').join('')+
 '</div><p class="caption">Modifiables pendant le mercato puis à la mi-temps.</p></section>'+
 '<div class="intro-actions">'+btn('start','Jouer en local · 2 joueurs','primary full')+
 btn('online','Mode en ligne · salons privés','ghost full')+
 '<p class="online-note">Découvre les salons privés. Les parties à deux iPhone nécessiteront le serveur OPFC indépendant.</p></div></main>';
}
function wallets(){
 return '<div class="huds">'+game.teams.map(team=>{
  const u=uiTeam(team);
  return '<div class="hud '+team.club.toLowerCase()+'"><div class="hud-top"><span>'+esc(clubName(team.club))+'</span><strong>'+team.club+
   '</strong></div><div class="hud-budget"><strong>'+team.budget+' M</strong><span>Berrys</span></div>'+
   '<div class="hud-bottom"><span>'+u.rosterCount+'/7 recrues</span><span>'+u.refusals+'/5 refus</span></div></div>';
 }).join('')+'</div>';
}
function portrait(info){
 return '<div class="portrait-shell portrait-shell-photo">'+renderCharacterPortrait(info.id,'portrait-card')+'</div>';
}
function cardPanel(info){
 const rar={DIA:'DIAMANT',OR:'OR',ARG:'ARGENT',BRZ:'BRONZE'};
 const stats=cardStats(info).map(s=>{
  const grade=s.value>=90?'elite':s.value>=80?'high':s.value>=70?'medium':s.value>=60?'low':'weak';
  return '<div class="stat opfc-stat"><span>'+s.label+'</span>'+
   '<strong class="opfc-stat-value stat-'+grade+'">'+s.value+'</strong></div>';
 }).join('');
 return '<div class="player-card opfc-player-card rarity-'+info.rarity+'">'+portrait(info)+
 '<div class="player-identity"><h2 class="player-name">'+esc(info.name)+'</h2>'+
 '<div class="player-meta">'+esc(info.group)+'</div></div>'+
 '<div class="player-rating-row">'+
 '<span class="player-position position-purple">'+info.position+'</span>'+
 '<div class="player-rating"><span>NOTE GLOBALE</span>'+
 '<strong class="rating-value">'+info.rating+'</strong></div>'+
 '<span class="player-tier tier-'+info.rarity.toLowerCase()+'">'+rar[info.rarity]+'</span>'+
 '</div><div class="stats-grid">'+stats+'</div></div>';
}
// Valeurs internes en millions de Berrys ; l'interface affiche les Berrys entiers.
const fullBerrys=millions=>{
 const value=Number(millions)*1000000;
 if(!Number.isSafeInteger(value)||value<0)throw Error('Montant invalide');
 return String(value).replace(/\B(?=(\d{3})+(?!\d))/g,' ')+' ฿';
};
function sale(){
 // Reproduction du panneau d'enchères approuvé pour OPFC (cosmétique seulement).
 // Les incréments sont ceux du moteur OPFC : 1 M par palier, contrairement au jeu classique.
 const context=uiAuction(game),a=context.auction,t=context.team;
 const min=context.minimum,max=context.maximum,remaining=Math.max(0,5-t.refusals);
 const steps=[0,1,5,10],withdrawal=context.everOffered;
 const refusal=withdrawal?'Arrêter d’enchérir (gratuit)':
  context.canPass?'Refuser ce personnage · '+remaining+'/5 restants':
  '⛔ Plus de refus sans enchère disponibles';
 const kingInfo=t.hakis.kings?'Déjà utilisé':
  context.canKings?'Utilisable une seule fois':'Disponible seulement en premier';
 const eyeInfo=t.hakis.observation?'Déjà utilisé':'Voir les 5 prochaines cartes';
 return '<div class="opfc-auction-stage"><div class="auction-top"><span class="eyebrow">Mercato · '+
 game.teams.reduce((n,team)=>n+team.roster.length,0)+'/14</span>'+
 '<span class="turn-pill">Enchère en cours</span></div>'+
 cardPanel(context.card)+
 '<section class="opfc-auction card auction" aria-label="Enchères OPFC"><div class="bid-title"><div>'+
 '<span class="kicker">Meilleure offre</span>'+
 '<strong class="bid-amount">'+(a.highestBid?fullBerrys(a.highestBid):'Aucune')+'</strong></div>'+
 '<div class="bid-leader">'+(a.highestClub?'En tête : <strong>'+esc(clubName(a.highestClub))+'</strong>':
 'Mise de départ : <strong>'+fullBerrys(min)+'</strong>')+'</div></div>'+
 '<div class="turn-banner"><div><span>AU TOUR DE</span><strong>'+esc(a.turn)+'</strong></div>'+
 '<div class="turn-budget">'+fullBerrys(t.budget)+'<br><span>disponibles</span></div></div>'+
 (a.king?'<p class="warning-copy">👑 Haki des Rois activé par '+a.king.holder+'.</p>':'')+
 (a.solo?'<div class="solo-auction"><p>Une seule équipe recrute encore : prix fixe '+fullBerrys(5)+'.</p>'+
 '<button class="primary" data-action="solo">Recruter · '+fullBerrys(5)+'</button></div>':
 '<div class="offers">'+steps.map(step=>{
  const amount=min+step;
  return '<button class="offer-btn" type="button" data-action="bid-quick" data-amount="'+amount+
  '" '+(context.canBid&&amount<=max?'':'disabled')+'><b>'+fullBerrys(amount)+'</b><small>'+
  (step===0?'Offre minimale':'+'+step+' palier(s)')+'</small></button>';
 }).join('')+'</div>'+
 '<div class="custom-bid"><label for="bid-value">Autre montant (฿)</label>'+
 '<div><input id="bid-value" type="text" inputmode="numeric" autocomplete="off" pattern="[0-9]*"'+
 ' aria-label="Montant personnalisé en Berrys" placeholder="'+(min*1000000)+'" value="'+(min*1000000)+'" '+
 (context.canBid?'':'disabled')+'>'+
 '<button type="button" class="btn-ghost" data-action="bid" '+(context.canBid?'':'disabled')+
 '>Enchérir</button></div></div>'+
 '<button class="pass-btn" type="button" data-action="pass" '+(context.canPass?'':'disabled')+
 '>'+refusal+'</button>'+
 '<div class="auction-hakis"><button class="haki-btn" type="button" data-action="kings"'+
 (context.canKings?'':' disabled')+'>'+
 '👑 Haki des Rois<small>'+kingInfo+'</small></button>'+
 '<button class="extra-power" type="button" data-action="observation"'+
 (context.canObserve?'':' disabled')+'>👁 Observation<small>'+eyeInfo+'</small></button></div>'+
 '<p class="notice">'+(withdrawal?
 'Se retirer après une mise ne consomme aucun refus.':
 'Seul un refus avant la première offre consomme un de tes 5 refus.')+
 '<span class="refusal-counter">Refus utilisés : <strong>'+t.refusals+'/5</strong>'+
 ' · Restants : <strong>'+remaining+'/5</strong></span></p>')+
 '</section></div>';
}
// Dessin partagé par tous les écrans (placement, compositions et match).
function pitchMarkings(){
 return '<div class="pitch-markings" aria-hidden="true">'+
 '<span class="pitch-outline"></span>'+
 '<span class="pitch-center-line"></span><span class="pitch-center-circle"></span><span class="pitch-center-spot"></span>'+
 '<span class="pitch-penalty-area pitch-penalty-top"></span><span class="pitch-penalty-area pitch-penalty-bottom"></span>'+
 '<span class="pitch-goal-area pitch-goal-area-top"></span><span class="pitch-goal-area pitch-goal-area-bottom"></span>'+
 '<span class="pitch-penalty-spot pitch-penalty-spot-top"></span><span class="pitch-penalty-spot pitch-penalty-spot-bottom"></span>'+
 '<span class="pitch-goal pitch-goal-top"></span><span class="pitch-goal pitch-goal-bottom"></span>'+
 '<span class="pitch-corner pitch-corner-tl"></span><span class="pitch-corner pitch-corner-tr"></span>'+
 '<span class="pitch-corner pitch-corner-bl"></span><span class="pitch-corner pitch-corner-br"></span>'+
 '</div>';
}
function fieldHalf(team,top){
 const u=uiTeam(team),positions=top?['GAR','DEF','MIL','ATT']:['ATT','MIL','DEF','GAR'];
 const spectator=!['mercato','lineup','half-time'].includes(game.phase);
 const label='<div class="field-label '+team.club.toLowerCase()+'"><span>'+team.club+' · '+u.formation+
 '</span><span>'+u.entente+'/10 entente</span></div>';
 const lines=positions.map(pos=>'<div class="pitch-row pitch-row-'+pos.toLowerCase()+'">'+
  u.lineup.filter(p=>p.position===pos).map(p=>{
   const active=selection?.club===team.club&&selection?.id===p.cardId;
   const viewOnly=spectator&&!!p.cardId;
   const action=viewOnly?'inspect-player':'slot';
   const aria=p.card?.name?pos+' · '+p.card.name+' · note effective '+p.rating+
     (p.outOfPosition?' · hors poste':'')+', ouvrir sa fiche':pos+' · emplacement libre';
   return '<button type="button" class="pitch-player '+(p.cardId?'':'empty')+' '+(active?'selected':'')+
    '" data-action="'+action+'" data-club="'+team.club+'" data-slot="'+p.slot+'"'+
    (viewOnly?' data-card="'+esc(p.cardId)+'"':'')+' aria-label="'+esc(aria)+'"'+
    (spectator&&!p.cardId?' disabled':'')+'>'+
    (p.card?renderCharacterPortrait(p.card.id,'pitch-avatar'):
    '<span class="pitch-avatar pitch-avatar-empty" aria-hidden="true">+</span>')+
    '<span class="pitch-player-badges"><span class="position">'+pos+'</span>'+
    (p.rating===null?'':'<span class="rating">'+p.rating+'</span>')+
    (p.outOfPosition?'<span class="out" title="Hors poste" aria-label="Hors poste">!</span>':'')+
    '</span></button>';
  }).join('')+'</div>').join('');
 return '<div class="field-half '+(top?'field-half-top':'field-half-bottom')+'">'+
 (top?label:'')+lines+(top?'':label)+'</div>';
}
function currentPitchClub(){
 // En phase de placement, l'équipe qui vient de recruter reste toujours en haut.
 if(placement)return placement.club;
 if(selection?.club)return selection.club;
 return pitchClub|| (game?.phase==='mercato'?game.auction?.turn:null) || firstClub;
}
function pitch(){
 const spectator=!['mercato','lineup','half-time'].includes(game.phase);
 const upper=currentPitchClub();
 const first=game.teams.find(t=>t.club===upper),other=game.teams.find(t=>t.club!==upper);
 return '<section class="panel pitch-panel"><div class="auction-top"><span class="eyebrow">Le stade · les compositions</span>'+
 '<span class="caption">Terrain vertical</span></div>'+
 (placement?'<p class="placement-guidance">Recrue sélectionnée : <strong>'+esc(card(placement.cardId)?.name)+
 '</strong>. Touche une case de ton équipe pour la placer.</p>':
 '<div class="pitch-orientation"><span>Équipe en haut :</span>'+
 game.teams.map(t=>btn('pitch-view',t.club,(upper===t.club?'primary':'ghost')+' small',false,
 'data-club="'+t.club+'" aria-pressed="'+(upper===t.club)+'"')).join('')+'</div>')+
 '<p class="lineup-help">'+(spectator?
 'Compositions sur le terrain · les changements sont possibles uniquement à la mi-temps.':
 selection?'Sélection : '+esc(card(selection.id)?.name)+' · touche une case '+selection.club+' pour placer ou échanger.':
 'Sélectionne une recrue puis touche une case de son club. Les cases occupées peuvent être échangées.')+'</p>'+
 '<div class="slot-field '+(placement?'slot-field-single':'slot-field-full')+'" data-top-club="'+upper+'">'+
 pitchMarkings()+fieldHalf(first,true)+(placement?'':'<div class="field-divider"></div>'+fieldHalf(other,false))+
 '</div></section>';
}
function teamPanel(team){
 const u=uiTeam(team),editable=['mercato','lineup','half-time'].includes(game.phase)&&!team.ready&&
 (!placement||placement.club===team.club)&&!placement;
 return '<section class="panel team-panel"><div class="team-heading"><h2>'+renderClubCrest(team.club,'team-crest')+esc(clubName(team.club))+
 '</h2><small>'+u.rosterCount+'/7</small></div><div class="team-tools"><span class="caption">Entente '+u.entente+'/10</span>'+
 '<select data-action="formation" data-club="'+team.club+'" aria-label="Formation '+team.club+'" '+(editable?'':'disabled')+'>'+
 options(FORMATION_NAMES,u.formation)+'</select></div><div class="chip-row">'+
 (team.roster.length?team.roster.map(id=>{
  const info=card(id),chosen=selection?.club===team.club&&selection?.id===id;
  const selectable=editable ||(placement&&placement.club===team.club&&placement.cardId===id);
  const ranks={DIA:'Diamant',OR:'Or',ARG:'Argent',BRZ:'Bronze'};
  return '<button class="team-chip '+(chosen?'selected':'')+'" data-action="pick" data-club="'+team.club+
  '" data-card="'+esc(id)+'" aria-pressed="'+!!chosen+'" '+(selectable?'':'disabled')+'>'+
  renderCharacterPortrait(id,'chip-portrait')+
  '<span class="team-chip-content"><span class="team-chip-name">'+esc(info.name)+'</span>'+
  '<span class="team-chip-details"><span class="roster-position">'+info.position+'</span>'+
  '<span class="roster-rating">'+info.rating+'</span>'+
  '<span class="roster-tier tier-'+info.rarity.toLowerCase()+'">'+ranks[info.rarity]+'</span></span></span>'+
  '<small class="chip-placed">'+(team.slots.includes(id)?'✓':'+')+'</small></button>';
 }).join(''):'<span class="caption">Aucune recrue.</span>')+'</div>'+
 (['lineup','half-time'].includes(game.phase)?btn('ready',u.ready?'✓ Équipe prête':u.canReady?'Valider cette composition':'Place les 7 joueurs',
 'small full '+(u.canReady?'primary':'ghost'),!u.canReady,'data-club="'+team.club+'"'):'')+'</section>';
}
function teams(){
 const upper=currentPitchClub();
 return pitch()+'<div class="two-teams">'+
 [...game.teams].sort((a,b)=>Number(b.club===upper)-Number(a.club===upper)).map(teamPanel).join('')+'</div>';
}
function placementPage(){
 const team=game.teams.find(t=>t.club===placement.club);
 const placed=team?.slots.includes(placement.cardId);
 const recruit=card(placement.cardId),ranks={DIA:'Diamant',OR:'Or',ARG:'Argent',BRZ:'Bronze'};
 return '<section class="panel placement-intro"><span class="eyebrow">Recrutement confirmé</span>'+
 '<div class="placement-summary">'+renderCharacterPortrait(placement.cardId,'placement-portrait')+
 '<div class="placement-summary-body"><h2>'+esc(recruit.name)+' rejoint '+placement.club+'</h2>'+
 '<div class="placement-metadata"><span class="roster-position">'+recruit.position+'</span>'+
 '<span class="roster-rating">Note '+recruit.rating+'</span>'+
 '<span class="roster-tier tier-'+recruit.rarity.toLowerCase()+'">'+ranks[recruit.rarity]+'</span>'+
 '</div></div></div>'+
 '<p>Place ta nouvelle recrue sur ton demi-terrain avant de reprendre les enchères.</p></section>'+
 teams()+
 '<div class="placement-actions">'+
 btn('continue-placement',game.phase==='lineup'?'Continuer vers les compositions':'Reprendre les enchères',
 'primary full',!placed)+
 (!placed?'<p class="caption">Choisis une case pour activer le bouton Continuer.</p>':'')+
 '</div>';
}
function playing(){
 const intro=shell()+'<div class="match-header">'+sep()+'<h1 class="page-title">'+
 (game.phase==='mercato'?'Mercato des légendes':'Prépare le Classique')+'</h1>'+
 '<div class="dice-note">Dés : '+game.dice.join(' · ')+'</div></div>'+wallets();
 if(placement)return intro+placementPage()+
 '<div class="gameplay-nav"><span class="caption">Placement de recrue</span>'+
 '<button class="link-button" data-action="confirm-reset">Nouvelle partie</button></div>';
 const next=game.phase==='mercato'?sale()+
 '<div class="view-teams-actions">'+btn('toggle-teams',teamsVisible?'Masquer les équipes':'Voir les équipes',
 'ghost full',false,'aria-expanded="'+teamsVisible+'"')+'</div>'+
 (teamsVisible?teams():''):teams()+
 '<div class="ready-banner"><strong>Compositions en préparation</strong>'+
 '<p>Les 2 clubs doivent confirmer leurs équipes.</p></div>';
 return intro+next+'<div class="gameplay-nav"><span class="caption">Mode local</span>'+
 '<button class="link-button" data-action="confirm-reset">Nouvelle partie</button></div>';
}
function endMercato(){
 return shell()+'<main class="ready-layout">'+sep()+
 '<h1 class="page-title">Les équipes sont prêtes !</h1><p>Les sept recrues de chaque club sont alignées.</p>'+
 wallets()+teams()+renderMatchScreen(game)+
 btn('confirm-reset','Nouvelle partie locale','ghost full')+'</main>';
}
function matchPage(){
 const middle=renderMatchScreen(game,{uncovered:matchUncovered});
 // Terrain et listes de recrues présents sous TOUTES les étapes du match.
 // Les commandes de composition restent actives uniquement à la mi-temps.
 const overview='<section class="match-team-overview" aria-label="Terrain et effectifs du match">'+
 '<div class="match-team-overview-heading"><span>⚽ TERRAIN ET COMPOSITIONS</span>'+
 '<small>'+ (game.phase==='half-time'?'Modifications autorisées à la mi-temps':'Effectifs des deux équipes')+'</small></div>'+
 teams()+'</section>';
 return shell()+'<main class="ready-layout">'+middle+overview+
 '<div class="gameplay-nav"><span class="caption">Grandline Cup · Mode local</span>'+btn('confirm-reset','Nouvelle partie','ghost small')+'</div></main>';
}
function popup(){
 if(!modal)return '';
 let body='';
 if(modal.type==='dice')body='<div class="big-symbol">🎲</div><h2>Départ du mercato</h2><p>'+game.dice.join(' contre ')+
 '</p><p>Premier club prioritaire : <strong>'+game.auction.priority+'</strong></p>'+
 btn('close','Commencer les enchères','primary full');
 if(modal.type==='sale'){
  const result=modal.result;
  body='<h2>'+(result.winner?'Recrue remportée !':'Carte invendue')+'</h2>'+
  '<div class="sale-reveal">'+renderCharacterPortrait(result.cardId,'sale-result-portrait')+
  '<p><strong>'+esc(card(result.cardId)?.name)+'</strong> '+(result.winner?'rejoint '+result.winner+' pour '+result.price+' M.':'quitte ce mercato.')+'</p></div>'+
  btn('close','Continuer','primary full');
 }
 if(modal.type==='observation-pass')body='<div class="big-symbol">👁</div><h2>Choix secret</h2>'+
 '<p>Donne le téléphone au joueur <strong>'+modal.club+'</strong>, puis ouvre les cinq prochaines cartes.</p>'+
 btn('observation-show','Je suis '+modal.club+' · Voir','primary full');
 if(modal.type==='observation-show')body='<div class="big-symbol">👁</div><h2>Observation · '+modal.club+'</h2>'+
 '<div class="preview-list">'+modal.ids.map((id,index)=>'<div class="preview-item"><span class="preview-main">'+
 '<small>'+(index+1)+'</small>'+renderCharacterPortrait(id,'preview-portrait')+
 esc(card(id)?.name)+'</span><strong>'+card(id)?.rating+'</strong></div>').join('')+'</div>'+
 btn('close','Masquer et continuer','primary full');
 if(modal.type==='card'){
  const c=card(modal.id);
  body='<h2>'+esc(c.name)+'</h2>'+cardPanel(c)+
  '<div class="detail-grid">'+['GAR','DEF','MIL','ATT'].map(pos=>'<div><span>'+pos+'</span><strong>'+effectiveRating(c.id,pos)+'</strong></div>').join('')+
  '</div><p>Notes effectives selon le poste. Les six stats de la carte sont naturelles.</p>'+
  btn('close','Retour','primary full');
 }
 if(modal.type==='reset')body='<h2>Nouvelle partie ?</h2><p>La progression locale actuelle sera effacée.</p>'+
 btn('reset','Effacer la partie','negative full')+btn('close','Annuler','ghost full');
 return '<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true">'+body+'</section></div>';
}
function render(){
 app.innerHTML=(onlineVisible?shell()+renderOnlineLobby({
  stage:onlineStage,firstClub,room:onlineClient.room,
  configured:onlineClient.configured,joinCode:onlineJoinCode,
  busy:onlineBusy,error:onlineError
 }):game?(game.phase==='kickoff-ready'?endMercato():['mercato','lineup'].includes(game.phase)?playing():matchPage()):welcome())+
 (error?'<div class="alert" role="alert">'+esc(error)+'</div>':'')+popup();
}
function change(fn){
 const before=game,next=fn(before),end=before.phase==='mercato'?currentAuctionEnding(before,next):null;
 game=next;error='';selection=null;
 if(teamsVisible&&!placement&&before.phase==='mercato'&&next.phase==='mercato'&&
   before.auction?.turn!==next.auction?.turn)
   pitchClub=next.auction.turn;
 if(end){
  modal={type:'sale',result:end};
  if(end.winner){placement={club:end.winner,cardId:end.cardId};pitchClub=end.winner;}
 }
 save();render();
}
function start(){
 const s=createGame({firstClub});
 for(const id of ['PSG','OM'])if(beforeForm[id]!=='2-2-2')Object.assign(s,chooseFormation(s,id,beforeForm[id]));
 game=s;selection=null;placement=null;teamsVisible=false;pitchClub=null;modal={type:'dice'};error='';save();render();
}
function clicked(button){
 const action=button.dataset.action,club=button.dataset.club;
 if(action==='online'){
  onlineVisible=true;onlineStage=onlineClient.hasSession?(onlineClient.room?'room':'restore'):'choose';
  onlineError='';render();syncOnlinePoll();return;
 }
 if(action.startsWith('online-')){
  if(!onlineVisible)throw Error('Ouvre d’abord le mode en ligne');
  void onlineClicked(action,button).catch(e=>{onlineError=e?.message||'Action de salon impossible';render();});
  return;
 }
 if(onlineVisible)return; // un salon affiché ne déclenche jamais une commande locale.
 if(modal&&!['close','observation-show','reset'].includes(action))return;
 if(action==='match-uncover'){
  if(!game||!matchRequiresPrivacy(game))throw Error('Aucun choix privé à révéler');
  matchUncovered=true;render();return;
 }
 if(action.startsWith('match-')){
  if(!game)throw Error('Aucune partie en cours');
  const commands={
   'match-kickoff':'kickoff','match-begin-open':'begin-open',
   'match-choose':'choose','match-reveal-duel':'reveal-duel',
   'match-continue-duel':'continue-duel','match-reveal-shot':'reveal-shot',
   'match-continue-result':'continue-result','match-resume':'resume',
   'match-begin-setpiece':'begin-setpiece','match-taker':'select-taker',
   'match-reveal-setpiece-duel':'reveal-setpiece-duel',
   'match-continue-setpiece-duel':'continue-setpiece-duel',
   'match-finish-corner':'finish-corner',
   'match-reveal-penalty':'reveal-penalty',
   'match-begin-shootout':'begin-shootout',
   'match-shootout-choose':'shootout-choose',
   'match-shootout-reveal':'shootout-reveal',
   'match-shootout-continue':'shootout-continue'
  };
  const command=commands[action];
  if(!command)throw Error('Action de match non disponible');
  if(['choose','select-taker','shootout-choose'].includes(command)&&!matchUncovered)
   throw Error('Le joueur doit d’abord confirmer la transmission du téléphone.');
  const choice=button.dataset.choice,takerId=button.dataset.card;
  matchUncovered=false; // masque immédiatement toute décision précédente
  change(s=>dispatchOpenMatch(s,command,{choice,takerId}));return;
 }
 if(action==='club'){firstClub=club;render();return;}
 if(action==='start'){start();return;}
 if(action==='close'){
  if(modal?.type==='sale'&&placement){
   selection={club:placement.club,id:placement.cardId};
   pitchClub=placement.club;
  }
  modal=null;save();render();return;
 }
 if(action==='confirm-reset'){modal={type:'reset'};render();return;}
 if(action==='reset'){game=null;selection=null;placement=null;teamsVisible=false;pitchClub=null;modal=null;error='';matchUncovered=false;try{localStorage.removeItem(STORAGE);}catch{}render();return;}
 if(action==='observation-show'){if(modal?.type==='observation-pass'){modal.type='observation-show';render();}return;}
 if(!game)return;
 if(action==='toggle-teams'){
  if(game.phase!=='mercato'||placement)throw Error('Affichage des équipes indisponible');
  teamsVisible=!teamsVisible;
  pitchClub=teamsVisible?game.auction.turn:null;
  save();render();return;
 }
 if(action==='pitch-view'){
  if(placement)throw Error('Le club du recruteur reste en haut pendant le placement');
  if(!game.teams.some(t=>t.club===club))throw Error('Club introuvable');
  pitchClub=club;selection=null;save();render();return;
 }
 if(action==='continue-placement'){
  if(!placement)throw Error('Aucune recrue en attente de placement');
  const team=game.teams.find(t=>t.club===placement.club);
  if(!team?.slots.includes(placement.cardId))throw Error('Place la recrue sur le terrain avant de continuer');
  placement=null;selection=null;pitchClub=null;teamsVisible=false;save();render();return;
 }
 if(placement&&!['pick','slot','inspect','confirm-reset','formation','close'].includes(action))
  throw Error('Place ta nouvelle recrue avant de reprendre les enchères.');
 if(action==='bid-quick'){
  if(game.phase!=='mercato'||placement)throw Error('Mise rapide indisponible');
  const amount=Number(button.dataset.amount);
  if(!Number.isInteger(amount))throw Error('Montant incorrect');
  change(s=>bid(s,s.auction.turn,amount));return;
 }
 if(action.startsWith('amount-')){
  const input=document.getElementById('bid-value'),context=uiAuction(game);
  if(!input||!context)return;
  const raw=Number(String(input.value).replace(/[\s\u00a0\u202f]/g,''))/1000000;
  const selected=action==='amount-min'?context.minimum:action==='amount-max'?context.maximum:
   Math.min(context.maximum,Math.max(context.minimum,(Number.isFinite(raw)?raw:context.minimum)+5));
  input.value=String(Math.round(selected)*1000000);
  return;
 }
 if(action==='bid'){
  const raw=String(document.getElementById('bid-value')?.value??'');
  const value=raw.replace(/[\s\u00a0\u202f]/g,'');
  if(!/^\d+$/.test(value))throw Error('Saisis un montant entier en Berrys.');
  const amount=Number(value);
  if(!Number.isSafeInteger(amount)||amount%1000000!==0)
   throw Error('Les offres OPFC doivent être un multiple de 1 000 000 ฿.');
  change(s=>bid(s,s.auction.turn,amount/1000000));return;
 }
 if(action==='pass'){change(s=>pass(s,s.auction.turn));return;}
 if(action==='solo'){change(s=>acceptSolo(s,s.auction.turn));return;}
 if(action==='kings'){change(s=>useKings(s,s.auction.turn));return;}
 if(action==='observation'){
  const current=game.auction.turn;
  const r=useObservation(game,current);
  game=r.state;selection=null;
  modal={type:'observation-pass',club:current,ids:r.peek};save();render();return;
 }
 if(action==='inspect'){modal={type:'card',id:game.auction.cardId};render();return;}
 if(action==='pick'){
  const id=button.dataset.card;
  if(placement&&(club!==placement.club||id!==placement.cardId))
   throw Error('Place d’abord la nouvelle recrue avant de modifier un autre joueur.');
  selection=placement?{club:placement.club,id:placement.cardId}:
   (selection?.club===club&&selection.id===id?null:{club,id});
  pitchClub=club;render();return;
 }
 if(action==='slot'){
  if(placement&&club!==placement.club)throw Error('La recrue doit rejoindre le terrain de son propre club.');
  const slot=Number(button.dataset.slot),team=game.teams.find(t=>t.club===club);
  pitchClub=club;
  if(selection){
   if(selection.club!==club)throw Error('Tu ne peux déplacer que tes propres joueurs.');
   const id=selection.id;change(s=>place(s,club,id,slot));
  }else if(team?.slots[slot]){modal={type:'card',id:team.slots[slot]};render();}
  return;
 }
 if(action==='ready'){change(s=>ready(s,club));return;}
}
app.addEventListener('click',event=>{
 const target=event.target.closest('button[data-action]');
 if(!target||target.disabled)return;
 try{clicked(target);}catch(e){error=e.message||'Action impossible';render();}
});
app.addEventListener('change',event=>{
 const target=event.target;
 try{
  if(target.dataset.action==='initial-formation'&&FORMATION_NAMES.includes(target.value)){
   beforeForm[target.dataset.club]=target.value;render();
  }
  if(target.dataset.action==='formation'&&FORMATION_NAMES.includes(target.value)){
   if(placement&&target.dataset.club!==placement.club)throw Error('Termine le placement du recruteur');
   pitchClub=target.dataset.club;
   change(s=>chooseFormation(s,target.dataset.club,target.value));
   if(placement)selection={club:placement.club,id:placement.cardId};
   render();
  }
 }catch(e){error=e.message||'Formation impossible';render();}
});
restore();
if(onlineClient.loadSession()){
 onlineVisible=true;onlineStage='restore';
}
render();
if(onlineVisible&&onlineClient.configured)void refreshOnlineRoom();
