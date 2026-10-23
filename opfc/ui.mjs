/** OPFC — Bloc 9A : accueil, mercato et stade local iPhone. */
import {createGame,bid,pass,useKings,useObservation,acceptSolo,chooseFormation,place,ready} from './engine.mjs?v=opfc-75-roster-20261022';
import {generateRandomTeams} from './random-rosters.mjs?v=opfc-duo-20261022';
import {renderFormationPreview} from './formation-preview.mjs?v=opfc-local-pitch-full-20261022';
import {pitchMarkings} from './pitch-markings.mjs';
import {CARD_BY_ID} from './catalog.mjs?v=opfc-75-roster-20261022';
import {DISPLAY_CLUBS,currentClubChoices,setDisplayedClubs,setDisplayedChoices,visualAbbr,displayAbbr} from './club-identities.mjs';
import {renderCharacterPortrait,renderClubCrest,renderIdentityCrest} from './ui-portraits.mjs?v=opfc-75-roster-20261022';
import {effectiveRating,lineupDetails} from './rules.mjs?v=opfc-75-roster-20261022';
import {FORMATION_NAMES,uiAuction,uiTeam,uiRoster,cardStats,currentAuctionEnding,clubName} from './ui-model.mjs?v=opfc-75-roster-20261022';
import {renderMatchScreen,matchRequiresPrivacy,dispatchOpenMatch} from './ui-match.mjs?v=opfc-v2-20261023';
import {createOnlineClient} from './online-client.mjs?v=opfc-v2-20261023';
import {renderOnlineLobby,normalizeJoinCodeInput} from './ui-online.mjs?v=opfc-v2-20261023';
import {renderOnlineGame} from './ui-online-game.mjs?v=opfc-v2-20261023';
import {CLUB_TROPHIES,isCompetition,competitionName,renderCompetitionPicker} from './club-honours.mjs?v=opfc-trophees-20261022';
import {queueFinishedLocalGame,syncQueuedLocalResults,pendingLocalResultsCount} from './trophy-service.mjs?v=opfc-v2-20261023';
import {stadiumPicker,isStadium} from './stadiums.mjs';

const app=document.getElementById('opfc-app');
const STORAGE='opfc-v08-local-dev';
let game=null,firstClub='PSG',selection=null,modal=null,error='',beforeForm={PSG:'2-2-2',OM:'2-2-2'};
let localClubChoices={PSG:'PSG',OM:'OM'},onlineHostIdentity='PSG',onlineGuestIdentity='OM';
let localCompetition='league',onlineCompetition='league';
let localStadium='mugiwara',onlineStadium='mugiwara';
let localRecruitmentMode='auction',onlineRecruitmentMode='auction';
let onlineHostFormation='2-2-2',onlineGuestFormation='2-2-2';
let matchUncovered=false;
// Affichage purement local : aucun changement de règles ou de calcul moteur.
let placement=null,teamsVisible=false,pitchClub=null;
// L'état du salon et sa session sont séparés de la sauvegarde du mode local.
const onlineClient=createOnlineClient();
let entryView='modes'; // écran de choix au lancement d'OPFC.
let onlineVisible=false,onlineStage='choose',onlineJoinCode='',onlineBusy=false,onlineError='';
let onlineSelection=null,onlineOwnClubScope=null,onlinePitchClub=null,onlineTeamsVisible=false,onlineRoomDetails=false;
let onlineModal=null,onlineSeenRoom=null,onlineSeenAuctionCard=null;
let onlinePendingTaker=null;
let onlineTimer=null,onlineRefreshInFlight=false;
const scrollMatchToTop=()=>{try{window.scrollTo({top:0,behavior:'instant'});}catch{window.scrollTo(0,0);}};
function onlineMatchDisplayKey(snapshot){
 if(!snapshot||!['match','moment-result','shootout','finished','shootout-ready'].includes(snapshot.phase))
  return null;
 const m=snapshot.match??{},a=m.action,s=m.shootout;
 return [snapshot.phase,m.index,a?.stage??'',m.lastResult?.outcome??'',
  s?.active?.shotNumber??'',s?.lastResult?.shotNumber??''].join(':');
}
function stopOnlinePoll(){
 if(onlineTimer!==null){clearInterval(onlineTimer);onlineTimer=null;}
}
function syncOnlinePoll(){
 if(!onlineVisible||!onlineClient.configured||!onlineClient.hasSession){
  stopOnlinePoll();return;
 }
 if(onlineTimer!==null)return;
 onlineTimer=setInterval(()=>{
  if(onlineBusy||onlineRefreshInFlight||document.hidden)return;
  void refreshOnlineRoom(true);
 },1800);
 onlineTimer?.unref?.(); // uniquement utile sous Node lors des tests.
}
async function onlineMutation(fn){
 if(onlineBusy)return;
 onlineBusy=true;onlineError='';render();
 try{
  await fn();
  onlineError='';
  if(['match','moment-result','shootout','finished','shootout-ready'].includes(onlineClient.game?.phase))
   scrollMatchToTop();
 }catch(err){
  onlineError=err?.message||'Impossible de contacter le salon.';
 }finally{
  onlineBusy=false;onlinePendingTaker=null;render();syncOnlinePoll();
 }
}
async function refreshOnlineRoom(silent=false){
 if(silent){
  if(onlineBusy||onlineRefreshInFlight)return;
  onlineRefreshInFlight=true;
  const beforeScreen=onlineMatchDisplayKey(onlineClient.game);
  try{
   const version=onlineClient.room?.version;
   const before=onlineClient.room?.status;
   await onlineClient.refreshRoom();
   if(onlineStage!=='room'||onlineClient.room?.version!==version||
      onlineClient.room?.status!==before){
    onlineStage='room';onlineError='';render();
    if(beforeScreen!==onlineMatchDisplayKey(onlineClient.game)&&
       onlineMatchDisplayKey(onlineClient.game)!==null)scrollMatchToTop();
   }
  }catch(err){
   const message=err?.message??'Actualisation impossible';
   if(onlineError!==message){onlineError=message;render();}
  }finally{onlineRefreshInFlight=false;}
  return;
 }
 await onlineMutation(async()=>{
  await onlineClient.refreshRoom();
  onlineStage='room';
 });
}
// Commandes envoyées uniquement au serveur authentifié : jamais d'appel
// à bid(), place() ou dispatchOpenMatch() depuis un écran en ligne.
async function onlineGameClicked(action,button){
 const snapshot=onlineClient.game,room=onlineClient.room;
 if(!snapshot||!room||room.status!=='ready')throw Error('Le deuxième téléphone doit rejoindre la partie');
 const club=room.myClub;
 if(action==='pitch-view'){
  onlinePitchClub=button.dataset.club;onlineSelection=null;render();return;
 }
 if(action==='toggle-teams'){onlineTeamsVisible=!onlineTeamsVisible;render();return;}
 if(action==='online-room-details'){onlineRoomDetails=!onlineRoomDetails;render();return;}
 if(action==='inspect'){const id=snapshot.auction?.cardId;if(id){modal={type:'card',id};render();}return;}
 if(action==='close'){modal=null;render();return;}
 if(action==='continue-placement'){render();return;}
 if(['amount-min','amount-max','amount-plus'].includes(action)){
  const input=document.getElementById('bid-value'),context=uiAuction(snapshot);
  if(!input||!context)return;
  const raw=Number(String(input.value).replace(/[\s\u00a0\u202f]/g,''))/1000000;
  const selected=action==='amount-min'?context.minimum:action==='amount-max'?context.maximum:
   Math.min(context.maximum,Math.max(context.minimum,(Number.isFinite(raw)?raw:context.minimum)+5));
  input.value=String(Math.round(selected)*1000000);return;
 }
 if(action==='bid-quick'||action==='bid'){
  if(snapshot.phase!=='mercato'||snapshot.auction?.turn!==club)throw Error('Ce n’est pas ton tour');
  let amount=Number(button.dataset.amount);
  if(action==='bid'){
   const raw=String(document.getElementById('bid-value')?.value??'').replace(/[\s\u00a0\u202f]/g,'');
   if(!/^\d+$/.test(raw)||Number(raw)%1000000!==0)
    throw Error('Offre invalide : montant entier en millions de Berrys');
   amount=Number(raw)/1000000;
  }
  if(!Number.isSafeInteger(amount))throw Error('Offre invalide');
  await onlineMutation(()=>onlineClient.marketAction({type:'bid',amount}));return;
 }
 if(['pass','solo','kings','observation'].includes(action)){
  if(snapshot.phase!=='mercato')throw Error('Le mercato est terminé');
  if(action!=='observation'&&snapshot.auction?.turn!==club)throw Error('Ce n’est pas ton tour');
  await onlineMutation(()=>onlineClient.marketAction({type:action}));return;
 }
 if(action==='pick'){
  if(!['mercato','lineup','half-time'].includes(snapshot.phase)||button.dataset.club!==club)
   throw Error('Tu ne peux sélectionner que ton club');
  const cardId=button.dataset.card;
  if(!snapshot.teams.find(t=>t.club===club).roster.includes(cardId))
   throw Error('Carte absente de ton équipe');
  const pending=onlinePending(snapshot);
  if(pending?.club===club&&pending.id!==cardId)throw Error('Place d’abord ta nouvelle recrue');
  if(onlineSelection?.club===club&&onlineSelection.id===cardId){
   modal={type:'card',id:cardId};onlineSelection=null;
  }else onlineSelection={club,id:cardId};
  render();return;
 }
 if(action==='inspect-player'){
  const id=button.dataset.card;
  if(snapshot.teams.some(t=>t.roster.includes(id))){
   modal={type:'card',id};render();
  }
  return;
 }
 if(action==='slot'){
  if(button.dataset.club!==club||!['mercato','lineup','half-time'].includes(snapshot.phase))
   throw Error('Tu ne peux placer que tes propres joueurs');
  const slot=Number(button.dataset.slot);
  const pending=onlinePending(snapshot);
  // Un nouveau joueur non placé doit toujours passer avant une ancienne sélection.
  const selected=pending?.club===club?{club,id:pending.id}:onlineSelection;
  const touched=snapshot.teams.find(t=>t.club===club)?.slots[slot];
  if(!pending&&selected?.club===club&&selected.id===touched){
   modal={type:'card',id:touched};onlineSelection=null;render();return;
  }
  if(!selected||selected.club!==club){
   const chosen=snapshot.teams.find(t=>t.club===club).slots[slot];
   if(chosen){onlineSelection={club,id:chosen};render();}
   return;
  }
  await onlineMutation(async()=>{
   const command={type:snapshot.phase==='half-time'?'half-place':'place',
    cardId:selected.id,slot};
   if(snapshot.phase==='half-time')await onlineClient.matchAction(command);
   else if(snapshot.phase==='mercato')await onlineClient.marketAction(command);
   else await onlineClient.lineupAction(command);
   onlineSelection=null;
  });return;
 }
 if(action==='ready'){
  if(button.dataset.club!==club)throw Error('Seul ton club peut être validé');
  await onlineMutation(async()=>{
   if(snapshot.phase==='half-time')await onlineClient.matchAction({type:'half-ready'});
   else await onlineClient.lineupAction({type:'ready'});
   onlineSelection=null;
  });return;
 }
 if(action==='online-bid'||action==='online-bid-custom'){
  if(snapshot.phase!=='mercato'||snapshot.auction?.turn!==club)
   throw Error('Ce n’est pas ton tour d’enchérir');
  let amount;
  if(action==='online-bid')amount=Number(button.dataset.amount);
  else{
   const raw=String(document.getElementById('online-bid-value')?.value??'');
   const digits=raw.replace(/[\s\u00a0\u202f]/g,'');
   if(!/^\d+$/.test(digits)||Number(digits)%1000000!==0)
    throw Error('Offre en Berrys : multiple entier de 1 000 000 ฿ requis');
   amount=Number(digits)/1000000;
  }
  if(!Number.isSafeInteger(amount))throw Error('Offre invalide');
  await onlineMutation(()=>onlineClient.marketAction({type:'bid',amount}));return;
 }
 if(action==='online-choice'){
  const type=button.dataset.shootout==='true'?'shootout-choose':'choose';
  const choice=button.dataset.choice;
  await onlineMutation(()=>onlineClient.matchAction({type,choice}));return;
 }
 if(action==='online-game'){
  const type=button.dataset.type;
  const command={type};
  if(type==='select-taker'){
   command.takerId=button.dataset.card;
   if(!command.takerId||!snapshot.teams.find(t=>t.club===club)?.slots.includes(command.takerId))
    throw Error('Choisis un des sept titulaires de ton équipe pour tirer le corner.');
   if(onlineBusy)return; // une seule requête malgré plusieurs touches
   onlinePendingTaker=command.takerId;
  }
  if(type==='choose'||type==='shootout-choose')command.choice=button.dataset.choice;
  await onlineMutation(async()=>{
   if(snapshot.phase==='mercato')
    await onlineClient.marketAction(command);
   else if(['lineup','kickoff-ready'].includes(snapshot.phase))
    await onlineClient.lineupAction(command);
   else await onlineClient.matchAction(command);
  });
  if(['match','moment-result','shootout','finished'].includes(onlineClient.game?.phase))
   scrollMatchToTop();
  return;
 }
 throw Error('Cette action n’est pas disponible en ligne');
}
async function onlineFormationChanged(target){
 const snapshot=onlineClient.game,club=onlineClient.room?.myClub;
 if(!snapshot||target.dataset.club!==club||
  !['mercato','lineup','half-time'].includes(snapshot.phase))
  throw Error('Tu ne peux modifier que ta propre formation');
 if(!FORMATION_NAMES.includes(target.value))throw Error('Formation inconnue');
 const phase=snapshot.phase,formation=target.value;
 await onlineMutation(async()=>{
  if(phase==='half-time')await onlineClient.matchAction({type:'half-formation',formation});
  else if(phase==='mercato')await onlineClient.marketAction({type:'formation',formation});
  else await onlineClient.lineupAction({type:'formation',formation});
  onlineSelection=null;
 });
}
async function onlineClicked(action,button){
 if(action==='online-menu'){
  // Retour au menu SANS effacer le jeton, le salon ni la progression.
  stopOnlinePoll();onlineVisible=false;entryView='modes';onlineRoomDetails=false;
  onlineError='';onlineModal=null;render();return;
 }
 if(action==='online-back'){
  if(onlineStage==='choose'||onlineStage==='room'||onlineStage==='restore'){
   onlineVisible=false;stopOnlinePoll();
  }else onlineStage='choose';
  onlineError='';render();return;
 }
 if(action==='online-select-recruitment'){
  if(onlineStage!=='create'||onlineClient.hasSession)throw Error('Choix de mode indisponible');
  if(!['auction','random'].includes(button.dataset.mode))throw Error('Mode de recrutement invalide');
  onlineRecruitmentMode=button.dataset.mode;render();return;
 }
 if(action==='online-select-stadium'){
  if(onlineStage!=='create'||onlineClient.hasSession||!isStadium(button.dataset.stadium))throw Error('Stade indisponible');
  onlineStadium=button.dataset.stadium;render();return;
 }
 if(action==='online-select-competition'){
  if(onlineStage!=='create'||onlineClient.hasSession)throw Error('Compétition non modifiable');
  if(!isCompetition(button.dataset.competition))throw Error('Compétition invalide');
  onlineCompetition=button.dataset.competition;render();return;
 }
 if(action==='online-create-screen'){onlineStage='create';onlineError='';render();return;}
 if(action==='online-join-screen'){onlineStage='join';onlineError='';render();return;}
 if(action==='online-cancel-forget'){onlineStage=onlineClient.room?'room':'restore';render();return;}
 if(action==='online-forget-confirm'){onlineStage='forget-confirm';render();return;}
 if(action==='online-forget'){
  stopOnlinePoll();onlineClient.leaveDevice();onlineStage='choose';onlineError='';
  onlineModal=null;onlineSeenRoom=null;onlineSeenAuctionCard=null;render();return;
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
   await onlineClient.createRoom('PSG',onlineHostIdentity,onlineCompetition,onlineRecruitmentMode,onlineHostFormation,onlineStadium);
   onlineStage='room';
   try{await onlineClient.refreshRoom();}catch{ /* reprise par actualisation automatique */ }
  });return;
 }
 if(action==='online-join'){
  const typed=document.getElementById('opfc-room-code')?.value??onlineJoinCode;
  onlineJoinCode=normalizeJoinCodeInput(typed);
  await onlineMutation(async()=>{
   await onlineClient.joinRoom(onlineJoinCode,onlineGuestIdentity,onlineGuestFormation);
   onlineStage='room';
   try{await onlineClient.refreshRoom();}catch{ /* reprise par actualisation automatique */ }
  });return;
 }
 if(action==='online-exit-finished'){
  if(onlineClient.game?.phase!=='finished'||onlineClient.game?.match?.shootout?.lastResult)
   throw Error('Attends la fin de la partie avant de quitter');
  stopOnlinePoll();onlineClient.leaveDevice();onlineVisible=false;onlineStage='choose';
  entryView='modes';onlineModal=null;modal=null;onlineSeenRoom=null;onlineSeenAuctionCard=null;
  onlineSelection=null;onlineError='';render();return;
 }
 if(action==='online-reveal-confirm'){
  const snapshot=onlineClient.game,own=onlineClient.room?.myClub;
  if(!snapshot||snapshot.phase!=='lineup'||snapshot.reveal?.step>=7||
   !snapshot.reveal||snapshot.reveal.ready?.[own])throw Error('Validation déjà effectuée');
  await onlineMutation(()=>onlineClient.lineupAction({type:'reveal-next'}));
  return;
 }
 if(action==='online-modal-continue'){onlineModal=null;render();return;}
 if(action==='online-room-details'){onlineRoomDetails=!onlineRoomDetails;render();return;}
 if(action==='online-refresh'){await refreshOnlineRoom();return;}
 await onlineGameClicked(action,button);
}
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const card=id=>CARD_BY_ID.get(id);
const others=id=>id==='PSG'?'OM':'PSG';
const short=id=>esc(id);
function save(){
 try{if(game)localStorage.setItem(STORAGE,JSON.stringify({game,firstClub,beforeForm,placement,teamsVisible,pitchClub}));}catch{}
 if(game?.phase==='finished')queueFinishedLocalGame(game);
}
function restore(){try{
 const data=JSON.parse(localStorage.getItem(STORAGE)||'null');
 if(data?.game?.version===1&&['mercato','lineup','kickoff-ready','match','moment-result','half-time','resume-ready','shootout-ready','shootout','finished'].includes(data.game.phase)&&
 data.game.teams?.length===2){
   game=data.game;firstClub=data.firstClub==='OM'?'OM':'PSG';beforeForm=data.beforeForm||beforeForm;
   if(isCompetition(game.competition))localCompetition=game.competition;
    localClubChoices=currentClubChoices(data.game.teams);
   teamsVisible=data.teamsVisible===true;
   pitchClub=['PSG','OM'].includes(data.pitchClub)?data.pitchClub:null;
   if(game.recruitmentMode==='random'&&game.phase==='lineup'&&
    Number.isInteger(game.randomReveal?.step)&&game.randomReveal.step<7)
    modal={type:'random-reveal',step:game.randomReveal.step};
   const p=data.placement;
   if(p&&['mercato','lineup'].includes(game.phase)&&
     game.teams.some(t=>t.club===p.club&&t.roster.includes(p.cardId))){
     const finalPlaced=game.phase==='lineup'&&
       game.teams.find(t=>t.club===p.club)?.slots.includes(p.cardId);
     if(finalPlaced){
       // Anciennes sauvegardes : le dernier placement est déjà terminé.
       placement=null;selection=null;teamsVisible=true;pitchClub=p.club;
     }else{
       placement={club:p.club,cardId:p.cardId};
       selection={club:p.club,id:p.cardId};
       pitchClub=p.club;
     }
   }
  }
}catch{}}
const shell=()=>'<header class="topbar"><a class="brand-mini" href="./"><img src="./opfc-logo-hd.PNG" alt="" width="35" height="35"> OPMERCATO FC</a><a class="small-link" href="./">← Accueil</a></header>';
const options=(values,current)=>values.map(v=>'<option value="'+esc(v)+'" '+(v===current?'selected':'')+'>'+esc(v)+'</option>').join('');
const btn=(action,title,klass='ghost',disabled=false,extra='')=>'<button type="button" class="btn '+klass+'" data-action="'+action+'" '+extra+' '+(disabled?'disabled':'')+'>'+title+'</button>';
const sep=()=>'<span class="eyebrow">Le tournoi de Grand Line</span>';
/** Accueil OPFC : logo en haut, illustration officielle au centre, deux modes en bas. */
function modeChooser(){
 return '<main class="opfc-mode-entry">'+
 '<header class="opfc-mode-brand">'+
 '<a class="opfc-mode-return" href="./" aria-label="Retour à l\'accueil général">← Accueil</a>'+
 '<h1 class="opfc-visually-hidden">OPMercato FC — Choisir un mode de jeu</h1>'+
 '<img class="opfc-mode-main-logo" src="./opfc-logo-hd.PNG" width="180" height="180" alt="Logo OPMercato FC">'+
 '</header>'+
 '<div class="opfc-mode-art-slot" data-art-slot="opfc-mode-cover">'+
 '<img class="opfc-mode-hero-image" src="./opfc/illustrations/opfc_accueil_carre.PNG" '+
 'width="1024" height="1024" alt="Illustration d’accueil d’OPMercato FC" '+
 'decoding="async" fetchpriority="high"></div>'+
 '<div class="opfc-mode-options" aria-label="Choix du mode de jeu">'+
 btn('open-local','<span class="opfc-mode-action-icon" aria-hidden="true">⚽</span><span><strong>Jouer en local</strong><small>À deux sur le même appareil</small></span><span class="opfc-mode-chevron" aria-hidden="true">›</span>','primary opfc-mode-action')+
 btn('online','<span class="opfc-mode-action-icon" aria-hidden="true">🌐</span><span><strong>Jouer en ligne</strong><small>Deux iPhone · Un salon privé</small></span><span class="opfc-mode-chevron" aria-hidden="true">›</span>','ghost opfc-mode-action')+
 '<nav class="opfc-mode-shortcuts" aria-label="Découvrir OPMercato FC">'+
 '<a class="opfc-mode-shortcut" href="./opfc-catalogue.html"><span aria-hidden="true">📚</span>Catalogue</a>'+
 '<a class="opfc-mode-shortcut" href="./opfc-regles.html"><span aria-hidden="true">📖</span>Règles</a>'+
 '</nav>'+
 '</div></main>';
}
function welcome(){
 return shell()+'<main class="intro opfc-local-setup">'+
 '<div class="opfc-local-nav">'+btn('back-modes','← Choix du mode','ghost small')+'</div>'+
 '<img class="intro-logo" src="./opfc-logo-hd.PNG" alt="Logo OPMercato FC" width="120" height="120">'+sep()+
 '<h1 class="intro-title">Prépare ton match.</h1><p>Sept recrues. Deux clubs. Un seul vainqueur.</p>'+
 '<section class="panel intro-panel opfc-competition-panel"><h2 class="section-title">🏆 Choisis ta compétition</h2>'+
 '<p class="caption">Sélectionne le trophée à disputer avant de choisir les clubs.</p>'+
 renderCompetitionPicker(localCompetition,'local-select-competition')+'</section>'+ '<section class="panel intro-panel">'+stadiumPicker(localStadium,'local-select-stadium')+'</section>'+
 '<section class="panel intro-panel opfc-setup-mode" aria-label="Comment composer les équipes ?">'+
 '<div class="opfc-recruit-buttons opfc-recruit-buttons-local">'+
 btn('local-recruit-auction','⚖️ Mercato classique',(localRecruitmentMode==='auction'?'primary':'ghost')+' full',false,'aria-pressed="'+(localRecruitmentMode==='auction')+'"')+
 btn('local-recruit-random','🎲 Équipes aléatoires',(localRecruitmentMode==='random'?'primary':'ghost')+' full',false,'aria-pressed="'+(localRecruitmentMode==='random')+'"')+
 '</div></section>'+
 '<section class="opfc-local-player-grid" aria-label="Préparation des deux joueurs">'+
 ['PSG','OM'].map((id,index)=>{
  const chosen=DISPLAY_CLUBS.find(c=>c.id===localClubChoices[id]);
  return '<article class="panel opfc-setup-player">'+
  '<h2>Joueur '+(index+1)+'</h2>'+
  '<div class="opfc-club-picker"><label for="club-identity-'+id+'">Choix du club</label>'+
  '<select id="club-identity-'+id+'" data-action="club-identity" data-club="'+id+'">'+
  DISPLAY_CLUBS.map(c=>'<option value="'+c.id+'"'+(localClubChoices[id]===c.id?' selected':'')+'>'+esc(c.name)+' ('+esc(displayAbbr(c.id))+')</option>').join('')+
  '</select>'+
  '<div class="opfc-club-picked" style="border-left-color:'+chosen.primary+'">'+
  renderIdentityCrest(chosen.id,'select-crest')+
  '<div class="opfc-picked-name"><strong>'+esc(displayAbbr(chosen.id))+'</strong><small>'+esc(chosen.name)+'</small></div></div></div>'+
  '<div class="opfc-setup-formation"><label for="initial-'+id+'">Formation de départ</label>'+
  '<select id="initial-'+id+'" data-action="initial-formation" data-club="'+id+'">'+
  options(FORMATION_NAMES,beforeForm[id])+'</select></div>'+
  renderFormationPreview(beforeForm[id],{compact:true})+
  '</article>';
 }).join('')+'</section>'+
 '<div class="intro-actions">'+
 (game?'<section class="panel opfc-resume-card"><p>Une partie locale est sauvegardée sur cet appareil.</p>'+btn('resume-local','▶ Reprendre ma partie','ghost full')+'</section>':'')+
 btn('start',game?'Créer une nouvelle partie':localRecruitmentMode==='random'?'🎲 Tirer les deux équipes':'Lancer le match · 2 joueurs','primary full')+'</div></main>';
}
function wallets(){
 return '<div class="huds">'+game.teams.map(team=>{
  const u=uiTeam(team);
  return '<div class="hud '+team.club.toLowerCase()+'"><div class="hud-top"><span class="hud-club-name">'+renderClubCrest(team.club,'hud-crest')+esc(clubName(team.club))+'</span><strong>'+esc(visualAbbr(team.club))+
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
function sale({ownClub=null}={}){
 // Reproduction du panneau d'enchères approuvé pour OPFC (cosmétique seulement).
 // Les incréments sont ceux du moteur OPFC : 1 M par palier, contrairement au jeu classique.
 const context=uiAuction(game),a=context.auction,t=context.team;
 const mayAct=ownClub===null||ownClub===a.turn;
 const min=context.minimum,max=context.maximum,remaining=Math.max(0,5-t.refusals);
 const steps=[0,1,5,10],withdrawal=context.everOffered,freePass=a.highestBid>0;
 const refusal=freePass?(withdrawal?'Arrêter d’enchérir (gratuit)':'Passer gratuitement · enchère adverse'):
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
 '<div class="turn-banner"><div><span>AU TOUR DE</span><strong>'+esc(visualAbbr(a.turn))+'</strong></div>'+
 '<div class="turn-budget">'+fullBerrys(t.budget)+'<br><span>disponibles</span></div></div>'+
 (a.king?'<p class="warning-copy">👑 Haki des Rois activé par '+esc(visualAbbr(a.king.holder))+'.</p>':'')+
 (a.solo?'<div class="solo-auction"><p>Une seule équipe recrute encore : prix fixe '+fullBerrys(5)+'.</p>'+
 '<button type="button" class="btn primary full" data-action="solo"'+(mayAct?'':' disabled')+'>Recruter · '+fullBerrys(5)+'</button>'+
 '<button type="button" class="btn ghost full" data-action="pass"'+(mayAct&&context.canPass?'':' disabled')+'>'+
 (mayAct&&context.canPass?'Refuser ce personnage · '+remaining+'/5 restants':'⛔ Refus épuisés · recrutement obligatoire')+
 '</button><p class="caption">Refus utilisés : '+t.refusals+'/5. Le refus passe à la carte suivante.</p></div>':
 '<div class="offers">'+steps.map(step=>{
  const amount=min+step;
  return '<button class="offer-btn" type="button" data-action="bid-quick" data-amount="'+amount+
  '" '+(mayAct&&context.canBid&&amount<=max?'':'disabled')+'><b>'+fullBerrys(amount)+'</b><small>'+
  (step===0?'Offre minimale':'+'+step+' palier(s)')+'</small></button>';
 }).join('')+'</div>'+
 '<div class="custom-bid"><label for="bid-value">Autre montant (฿)</label>'+
 '<div><input id="bid-value" type="text" inputmode="numeric" autocomplete="off" pattern="[0-9]*"'+
 ' aria-label="Montant personnalisé en Berrys" placeholder="'+(min*1000000)+'" value="'+(min*1000000)+'" '+
 (mayAct&&context.canBid?'':'disabled')+'>'+
 '<button type="button" class="btn-ghost" data-action="bid" '+(mayAct&&context.canBid?'':'disabled')+
 '>Enchérir</button></div></div>'+
 '<button class="pass-btn" type="button" data-action="pass" '+(mayAct&&context.canPass?'':'disabled')+
 '>'+refusal+'</button>'+
 '<div class="auction-hakis"><button class="haki-btn" type="button" data-action="kings"'+
 (mayAct&&context.canKings?'':' disabled')+'>'+
 '👑 Haki des Rois<small>'+kingInfo+'</small></button>'+
 '<button class="extra-power" type="button" data-action="observation"'+
 (mayAct&&context.canObserve?'':' disabled')+'>👁 Observation<small>'+eyeInfo+'</small></button></div>'+
 '<p class="notice">'+(freePass?
 'Une enchère a été placée : passer est gratuit pour les deux joueurs.':
 'Sans enchère sur ce personnage, passer consomme un de tes 5 refus.')+
 '<span class="refusal-counter">Refus utilisés : <strong>'+t.refusals+'/5</strong>'+
 ' · Restants : <strong>'+remaining+'/5</strong></span></p>')+
 '</section></div>';
}
// Dessin partagé par tous les écrans (placement, compositions et match).
function fieldHalf(team,top){
 const u=uiTeam(team),positions=top?['GAR','DEF','MIL','ATT']:['ATT','MIL','DEF','GAR'];
 const spectator=onlineOwnClubScope!==null?
  (team.club!==onlineOwnClubScope||!['mercato','lineup','half-time'].includes(game.phase)):
  !['mercato','lineup','half-time'].includes(game.phase);
 const label='<div class="field-label '+team.club.toLowerCase()+'"><span>'+esc(visualAbbr(team.club))+' · '+u.formation+
 '</span><span>'+u.entente+'/10 entente</span></div>';
 const lines=positions.map(pos=>'<div class="pitch-row pitch-row-'+pos.toLowerCase()+'">'+
  u.lineup.filter(p=>p.position===pos).map(p=>{
   const active=selection?.club===team.club&&selection?.id===p.cardId;
   const viewOnly=spectator&&!!p.cardId;
   const action=viewOnly?'inspect-player':'slot';
   const aria=p.card?.name?pos+' · '+p.card.name+' · poste naturel '+p.card.position+
     ' · note effective '+p.rating+(p.outOfPosition?' · hors poste':'')+
     (spectator?' · ouvrir sa fiche':' · sélectionner ou échanger'):pos+' · emplacement libre';
   return '<button type="button" class="pitch-player '+(p.cardId?'':'empty')+' '+(active?'selected':'')+
    '" data-action="'+action+'" data-club="'+team.club+'" data-slot="'+p.slot+'"'+
    (viewOnly?' data-card="'+esc(p.cardId)+'"':'')+' aria-label="'+esc(aria)+'"'+
    (spectator&&!p.cardId?' disabled':'')+'>'+
    (p.card?renderCharacterPortrait(p.card.id,'pitch-avatar'):
    '<span class="pitch-avatar pitch-avatar-empty" aria-hidden="true">+</span>')+
    '<span class="pitch-player-badges"><span class="position">'+pos+'</span>'+
    (p.rating===null?'':'<span class="rating">'+p.rating+'</span>')+
    (p.outOfPosition?'<span class="out" title="Hors poste" aria-label="Hors poste">!</span>':'')+
    '</span>'+
    (p.card?'<span class="pitch-player-natural">Préf. '+esc(p.card.position)+'</span>':'')+
    '</button>';
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
 game.teams.map(t=>btn('pitch-view',visualAbbr(t.club),(upper===t.club?'primary':'ghost')+' small',false,
 'data-club="'+t.club+'" aria-pressed="'+(upper===t.club)+'"')).join('')+'</div>')+
 '<p class="lineup-help">'+(spectator?
 'Compositions sur le terrain · les changements sont possibles uniquement à la mi-temps.':
 selection?'Sélection : '+esc(card(selection.id)?.name)+' · touche une case '+esc(visualAbbr(selection.club))+' pour placer ou échanger.':
 'Touche deux joueurs sur le terrain pour échanger leurs places, ou choisis une recrue puis une case. Poste préféré visible sous chaque portrait.')+'</p>'+
 '<div class="slot-field '+(placement?'slot-field-single':'slot-field-full')+'" data-top-club="'+upper+'">'+
 pitchMarkings()+fieldHalf(first,true)+(placement?'':'<div class="field-divider"></div>'+fieldHalf(other,false))+
 '</div></section>';
}
function teamPanel(team){
 const u=uiTeam(team),roster=uiRoster(team);
 const editable=(onlineOwnClubScope===null?['mercato','lineup','half-time'].includes(game.phase):
  ['mercato','lineup','half-time'].includes(game.phase)&&team.club===onlineOwnClubScope)&&!team.ready&&
 (!placement||placement.club===team.club)&&!placement;
 const ranks={DIA:'Diamant',OR:'Or',ARG:'Argent',BRZ:'Bronze'};
 return '<section class="panel team-panel"><div class="team-heading"><h2>'+
 renderClubCrest(team.club,'team-crest')+esc(clubName(team.club))+
 '</h2><small>'+u.rosterCount+'/7</small></div><div class="team-tools"><span class="caption">Entente '+u.entente+'/10</span>'+
 '<select data-action="formation" data-club="'+team.club+'" aria-label="Formation '+esc(visualAbbr(team.club))+'" '+(editable?'':'disabled')+'>'+
 options(FORMATION_NAMES,u.formation)+'</select></div><div class="chip-row">'+
 (roster.length?roster.map(player=>{
  const {cardId:id,card:info,position,rating,outOfPosition,placed}=player;
  const displayPosition=position??'À placer',displayRating=rating??'—';
  const chosen=selection?.club===team.club&&selection?.id===id;
  const selectable=editable ||(placement&&placement.club===team.club&&placement.cardId===id);
  const listAction=selectable?'pick':'inspect-player';
  const label=info.name+' · poste naturel '+info.position+' · poste occupé '+displayPosition+
   (placed?' · note effective '+displayRating:' · note à définir')+
   (outOfPosition?' · hors poste':'')+' · '+ranks[info.rarity];
  return '<button class="team-chip '+(chosen?'selected':'')+'" data-action="'+listAction+'" data-club="'+team.club+
   '" data-card="'+esc(id)+'" aria-pressed="'+!!chosen+'" aria-label="'+esc(label)+'">'+
   renderCharacterPortrait(id,'chip-portrait')+
   '<span class="team-chip-content"><span class="team-chip-name">'+esc(info.name)+'</span>'+
   '<span class="team-chip-details"><span class="roster-natural">Préf. '+info.position+'</span>'+
   '<span class="roster-position">'+(placed?'Joue '+displayPosition:'À placer')+'</span>'+
   '<span class="roster-rating" title="'+(placed?'Note effective':'Note après placement')+'">'+displayRating+'</span>'+
   (outOfPosition?'<span class="roster-warning" title="Hors poste" aria-label="Hors poste">! Hors poste</span>':'')+
   '<span class="roster-tier tier-'+info.rarity.toLowerCase()+'">'+ranks[info.rarity]+'</span></span></span>'+
   '<small class="chip-placed">'+(placed?'✓':'+')+'</small></button>';
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
 '<div class="placement-summary-body"><h2>'+esc(recruit.name)+' rejoint '+esc(clubName(placement.club))+'</h2>'+
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
 const random=game.recruitmentMode==='random';
 const intro=shell()+'<div class="match-header">'+sep()+'<h1 class="page-title">'+
 (game.phase==='mercato'?'Mercato des légendes':'Prépare le match')+'</h1>'+
 (random?'<div class="dice-note">🎲 Équipes aléatoires · 7 joueurs au bon poste</div>':
 '<div class="dice-note">Dés : '+game.dice.join(' · ')+'</div>')+'</div>'+
 (random?'':wallets());
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
 return shell()+'<main class="ready-layout">'+
 (game.phase==='finished'?'<div class="opfc-final-exit-wrap">'+
   btn('exit-finished-local','← Quitter la partie et revenir au menu','opfc-exit-gold full')+'</div>':'')+
 middle+
 (game.phase==='finished'&&pendingLocalResultsCount()>0?'<p class="caption" role="status">🏆 Résultat en cours de synchronisation. Il sera envoyé automatiquement dès que la connexion sera disponible.</p>':'')+
 overview+'<div class="gameplay-nav"><span class="caption">'+esc(competitionName(game.competition))+' · Mode local</span>'+btn('confirm-reset','Nouvelle partie','ghost small')+'</div></main>';
}
function popup(){
 if(!modal)return '';
 if(modal.type==='random-reveal')
  return randomRevealPanel(game,modal.step);
 let body='';
 if(modal.type==='dice')body='<div class="big-symbol">🎲</div><h2>Départ du mercato</h2><p>'+game.dice.join(' contre ')+
 '</p><p>Premier club prioritaire : <strong>'+esc(clubName(game.auction.priority))+'</strong></p>'+
 btn('close','Commencer les enchères','primary full');
 if(modal.type==='sale'){
  const result=modal.result;
  body='<h2>'+(result.winner?'Recrue remportée !':'Carte invendue')+'</h2>'+
  '<div class="sale-reveal">'+renderCharacterPortrait(result.cardId,'sale-result-portrait')+
  '<p><strong>'+esc(card(result.cardId)?.name)+'</strong> '+(result.winner?'rejoint '+esc(clubName(result.winner))+' pour '+result.price+' M.':'quitte ce mercato.')+'</p></div>'+
  btn('close','Continuer','primary full');
 }
 if(modal.type==='observation-pass')body='<div class="big-symbol">👁</div><h2>Choix secret</h2>'+
 '<p>Donne le téléphone au joueur <strong>'+esc(visualAbbr(modal.club))+'</strong>, puis ouvre les cinq prochaines cartes.</p>'+
 btn('observation-show','Je suis '+visualAbbr(modal.club)+' · Voir','primary full');
 if(modal.type==='observation-show')body='<div class="big-symbol">👁</div><h2>Observation · '+esc(visualAbbr(modal.club))+'</h2>'+
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
 if(modal.type==='overwrite-local')body='<h2>Remplacer la partie ?</h2><p>Une partie locale est sauvegardée. En créer une nouvelle effacera cette progression.</p>'+
 btn('accept-overwrite','Créer une nouvelle partie','negative full')+btn('close','Annuler','ghost full');
 if(modal.type==='reset')body='<h2>Nouvelle partie ?</h2><p>La progression locale actuelle sera effacée.</p>'+
 btn('reset','Effacer la partie','negative full')+btn('close','Annuler','ghost full');
 return '<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true">'+body+'</section></div>';
}
/** Le serveur détient les compositions ; aucune recrue n'est placée localement. */
function onlinePending(snapshot){
 if(!['mercato','lineup'].includes(snapshot?.phase))return null;
 // Priorité au premier placement en attente, quel que soit l'appareil.
 for(const team of snapshot.teams??[]){
  const id=team.roster?.find(cardId=>!team.slots.includes(cardId));
  if(id)return {club:team.club,id};
 }
 return null;
}
function onlineScoped(renderFn,{pending=null}={}){
 const snapshot=onlineClient.game;
 if(!snapshot)return '';
 const prior={game,selection,pitchClub,placement,own:onlineOwnClubScope};
 try{
  const ownClub=onlineClient.room?.myClub??'PSG';
  game=snapshot;onlineOwnClubScope=ownClub;
  placement=pending?.club===ownClub?{club:ownClub,cardId:pending.id}:null;
  selection=placement?{club:ownClub,id:pending.id}:onlineSelection;
  pitchClub=onlinePitchClub??ownClub;
  return renderFn();
 }finally{
  game=prior.game;selection=prior.selection;pitchClub=prior.pitchClub;
  placement=prior.placement;onlineOwnClubScope=prior.own;
 }
}
function onlineTeams(pending=null){
 return onlineScoped(()=>'<section class="match-team-overview online-team-overview" aria-label="Terrain et effectifs du match">'+
   '<div class="match-team-overview-heading"><span>⚽ TERRAIN ET COMPOSITIONS</span>'+
   '<small>'+(['mercato','lineup','half-time'].includes(game.phase)?
    'Ton club est modifiable · touche un joueur puis sa nouvelle case':'Effectifs des deux équipes')+'</small></div>'+
   teams()+'</section>',{pending});
}
function onlineSharedMarket(snapshot){
 const ownClub=onlineClient.room.myClub;
 if(snapshot.phase==='lineup'&&snapshot.reveal?.step<7)
  return '<main class="online-game-content opfc-online-playing">'+
   randomRevealPanel(snapshot,snapshot.reveal.step,{
    online:true,myClub:ownClub,readyFlags:snapshot.reveal.ready,busy:onlineBusy
   })+'</main>';
 const pending=onlinePending(snapshot);
 const hud=snapshot.phase==='lineup'&&onlineClient.room?.recruitmentMode==='random'?'':onlineScoped(()=>wallets());
 if(pending){
  if(pending.club!==ownClub)
   return '<main class="online-game-content opfc-online-playing">'+hud+
    '<section class="panel online-turn-wait"><h2>⏳ Recrue en cours de placement</h2>'+
    '<p>'+esc(clubName(pending.club))+' place son personnage avant la reprise du mercato.</p></section>'+
    '</main>';
  const recruit=card(pending.id);
  return '<main class="online-game-content opfc-online-playing">'+hud+
    '<section class="panel placement-intro"><span class="eyebrow">Recrutement confirmé</span>'+
    '<div class="placement-summary">'+renderCharacterPortrait(pending.id,'placement-portrait')+
    '<div class="placement-summary-body"><h2>'+esc(recruit.name)+' rejoint '+esc(clubName(ownClub))+'</h2>'+
    '<div class="placement-metadata"><span class="roster-position">Préf. '+esc(recruit.position)+'</span>'+
    '<span class="roster-rating">Note '+recruit.rating+'</span></div></div></div>'+
    '<p><strong>Touche une case sur ton terrain pour placer la recrue.</strong> Puis les enchères reprendront automatiquement.</p>'+
    '</section>'+onlineTeams(pending)+'</main>';
 }
 if(snapshot.phase==='mercato'){
  const auction=onlineScoped(()=>sale({ownClub}));
  const mine=snapshot.auction?.turn===ownClub;
  const ownTeam=snapshot.teams.find(t=>t.club===ownClub);
  return '<main class="online-game-content opfc-online-playing">'+hud+
   (mine?'':'<p class="online-turn-note">⏳ Au tour de '+esc(visualAbbr(snapshot.auction.turn))+
   '. Tu peux consulter tes joueurs et ton Haki d’Observation.</p>')+
   auction+
   (snapshot.myObservation?.length?
    '<section class="panel online-observation"><strong>👁 Tes révélations (privées)</strong>'+
    '<div class="online-observation-row">'+snapshot.myObservation.map(id=>
     '<div>'+renderCharacterPortrait(id,'kick-portrait')+
     '<span>'+esc(card(id)?.name??id)+'</span></div>').join('')+
    '</div></section>':'')+
   (!mine&&!ownTeam?.hakis?.observation?
    '<button class="btn ghost full" data-action="observation">👁 Utiliser ton Observation</button>':'')+
   '<div class="view-teams-actions"><button class="btn ghost full" data-action="toggle-teams" aria-expanded="'+onlineTeamsVisible+'">'+
   (onlineTeamsVisible?'Masquer les équipes':'Voir les équipes')+'</button></div>'+
   (onlineTeamsVisible?onlineTeams():'')+'</main>';
 }
 return '<main class="online-game-content opfc-online-playing">'+hud+
  renderOnlineGame(snapshot,{myClub:ownClub,hostClub:onlineClient.room.hostClub,competition:onlineClient.room?.competition})+
  onlineTeams()+'</main>';
}
/**
 * Les mêmes annonces de départ de partie et de recrutement qu'en local.
 * Elles sont propres au téléphone, sans bloquer le tour du serveur.
 */
/**
 * Révélation progressive des 14 recrues, commune aux parcours local et en ligne.
 * Les personnages et les formations sont fixés avant la révélation.
 */
function randomRevealPanel(snapshot,step,{online=false,myClub=null,readyFlags=null,busy=false}={}){
 if(!snapshot||!Number.isInteger(step)||step<0||step>6)throw Error('Progression du tirage invalide');
 const ranks={BRZ:'BRONZE',ARG:'ARGENT',OR:'OR',DIA:'DIAMANT'};
 const duo=['PSG','OM'].map(club=>{
  const team=snapshot.teams.find(t=>t.club===club);
  const info=card(team?.slots?.[step]);
  if(!team||!info)throw Error('Tirage du joueur manquant');
  const diamond=info.rarity==='DIA';
  const status=online&&readyFlags?.[club]===true?
   '<span class="opfc-duo-ready">✓ Prêt</span>':'';
  return '<article class="opfc-duo-half '+club.toLowerCase()+(diamond?' opfc-duo-diamond':'')+'">'+
   '<header class="opfc-duo-club">'+renderClubCrest(club,'opfc-duo-crest')+
    '<div class="opfc-duo-club-name"><strong>'+esc(visualAbbr(club))+'</strong>'+
    '<small>'+esc(clubName(club))+'</small></div></header>'+
   '<div class="opfc-duo-portrait">'+renderCharacterPortrait(info.id,'opfc-duo-player-portrait')+'</div>'+
   '<div class="opfc-duo-player-name">'+esc(info.name)+'</div>'+
   '<div class="opfc-duo-stats"><span>'+esc(info.position)+'</span>'+
    '<span>NOTE <b>'+esc(info.rating)+'</b></span></div>'+
   '<div class="opfc-duo-rarity rarity-'+info.rarity+'">'+(diamond?'💎 ':'')+ranks[info.rarity]+'</div>'+
   status+'</article>';
 }).join('');
 const mineReady=online&&readyFlags?.[myClub]===true;
 const theirsReady=online&&readyFlags?.[myClub==='PSG'?'OM':'PSG']===true;
 const buttonText=step===6?'⚽ Découvrir les compositions':'Joueurs suivants →';
 const footer=online?
  '<p class="opfc-duo-sync" role="status">'+
  (mineReady?(theirsReady?'✓ Synchronisation des deux joueurs…':'✓ Tu as validé · En attente de l’adversaire'):
   'Appuie pour valider ce duo. Le suivant apparaît quand vous avez tous les deux confirmé.')+
  '</p>'+
  '<button type="button" class="btn primary full" data-action="online-reveal-confirm"'+
   (mineReady||busy?' disabled':'')+'>'+
   (mineReady?'✓ Validation envoyée · Patiente…':buttonText)+'</button>':
  '<button type="button" class="btn primary full" data-action="random-reveal-next">'+buttonText+'</button>';
 const layout='<section class="opfc-duo-stage" aria-label="Révélation simultanée des deux équipes">'+
  '<div class="opfc-duo-heading"><span class="eyebrow">🎲 ÉQUIPES ALÉATOIRES</span>'+
  '<h2>Face-à-face · Duo '+(step+1)+' / 7</h2>'+
  '<p>'+(['Gardiens','Défenseurs et milieux','Défenseurs et milieux','Milieux et attaquants','Milieux et attaquants','Attaquants','Attaquants'][step])+'</p></div>'+
  '<div class="opfc-duo-vs">'+duo+'</div>'+
  '<div class="opfc-duo-progress"><span style="width:'+((step+1)/7*100).toFixed(2)+'%"></span></div>'+
  '<p class="caption">30 % Bronze · 30 % Argent · 30 % Or · 10 % Diamant</p>'+
  footer+'</section>';
 return online?layout:'<div class="modal-backdrop opfc-duo-overlay" role="presentation"><div class="opfc-duo-modal" role="dialog" aria-modal="true">'+layout+'</div></div>';
}
function trackOnlineAnnouncements(snapshot,room){
 if(!snapshot||!room)return;
 const roomKey=room.id??room.code;
 const currentCard=snapshot.lastResult?.cardId??null;
 if(onlineSeenRoom!==roomKey){
  onlineSeenRoom=roomKey;onlineSeenAuctionCard=currentCard;onlineModal=null;
  if(snapshot.phase==='mercato'&&snapshot.teams.every(team=>team.roster.length===0))
   onlineModal={type:'dice',dice:[...snapshot.dice],priority:snapshot.auction?.priority};
  return;
 }
 if(currentCard&&currentCard!==onlineSeenAuctionCard){
  onlineSeenAuctionCard=currentCard;
  onlineModal={type:'sale',result:snapshot.lastResult};
 }
}
function onlineAnnouncementView(){
 if(!onlineModal)return '';
 let body='';
 if(onlineModal.type==='dice')body='<div class="big-symbol">🎲</div>'+
  '<h2>Départ du mercato</h2><p>'+onlineModal.dice.join(' contre ')+
  '</p><p>Premier club prioritaire : <strong>'+
  esc(clubName(onlineModal.priority))+'</strong></p>';
 else if(onlineModal.type==='sale'){
  const result=onlineModal.result;
  body='<h2>'+(result.winner?'Recrue remportée !':'Carte invendue')+'</h2>'+
   '<div class="sale-reveal">'+renderCharacterPortrait(result.cardId,'sale-result-portrait')+
   '<p><strong>'+esc(card(result.cardId)?.name??result.cardId)+'</strong> '+
   (result.winner?'rejoint '+esc(clubName(result.winner))+' pour '+result.price+' M.':
    'quitte ce mercato.')+'</p></div>';
 }
 return '<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true">'+
  body+'<button type="button" class="btn primary full" data-action="online-modal-continue">'+
  (onlineModal.type==='dice'?'Commencer les enchères':'Continuer')+'</button></section></div>';
}
function render(){
 const showingGame=onlineVisible&&onlineStage==='room'&&
  onlineClient.room?.status==='ready'&&!!onlineClient.game;
 const snapshot=showingGame?onlineClient.game:null;
 if(showingGame)trackOnlineAnnouncements(snapshot,onlineClient.room);
 if(onlineVisible){
  if(onlineClient.game)setDisplayedClubs(onlineClient.game.teams);
  else if(onlineClient.room?.clubChoices)setDisplayedChoices(onlineClient.room.clubChoices);
  else setDisplayedClubs(null);
 }else if(game)setDisplayedClubs(game.teams);
 else setDisplayedChoices(localClubChoices);
 const room=onlineClient.room;
 const compactRoom=showingGame?'<div class="online-session-bar" role="status">'+
  '<span>🌐 Partie en ligne · '+esc(visualAbbr(room.myClub))+' vs '+
  esc(visualAbbr(room.myClub==='PSG'?'OM':'PSG'))+'</span>'+
  '<div class="online-session-actions"><button type="button" data-action="online-room-details">'+
  (onlineRoomDetails?'Masquer le salon':'Infos du salon')+'</button>'+
  '<button type="button" data-action="online-menu">← Menu</button></div></div>':'';
 const lobby=(!showingGame||onlineRoomDetails)?renderOnlineLobby({
  stage:onlineStage,firstClub,room:onlineClient.room,
  hostIdentity:onlineHostIdentity,guestIdentity:onlineGuestIdentity,competition:onlineCompetition,
  recruitmentMode:onlineRecruitmentMode,hostFormation:onlineHostFormation,guestFormation:onlineGuestFormation,stadiumId:onlineStadium,
  configured:onlineClient.configured,joinCode:onlineJoinCode,
  busy:onlineBusy,error:onlineError,gameActive:showingGame
 }):'';
 const liveStatus=showingGame?
  (onlineError?'<section class="alert online-network-error" role="alert"><strong>Synchronisation interrompue</strong>'+
   '<p>'+esc(onlineError)+'</p><button class="btn ghost full" type="button" data-action="online-refresh">🔄 Actualiser la partie</button></section>':'')+
  (onlinePendingTaker?'<section class="online-choice-pending" role="status">⏳ Sélection de <strong>'+
   esc(card(onlinePendingTaker)?.name??onlinePendingTaker)+
   '</strong> en cours… La connexion est vérifiée avant de continuer.</section>':''):'';
 const completedOnlineFinal=showingGame&&snapshot.phase==='finished'&&!snapshot.match?.shootout?.lastResult;
 const onlineDisplay=shell()+
  (completedOnlineFinal?'<div class="opfc-final-exit-wrap">'+
    btn('online-exit-finished','← Quitter la partie et revenir au menu','opfc-exit-gold full')+'</div>':'')+
  compactRoom+lobby+liveStatus+
  (showingGame?(['mercato','lineup','kickoff-ready'].includes(snapshot.phase)?onlineSharedMarket(snapshot):
   '<main class="online-game-content opfc-online-playing">'+
   renderOnlineGame(snapshot,{myClub:room.myClub,hostClub:room.hostClub,competition:onlineClient.room?.competition})+
   (['match','moment-result','half-time','resume-ready','shootout-ready','shootout','finished'].includes(snapshot.phase)?
    onlineTeams():'')+'</main>'):'');
 app.innerHTML=(onlineVisible?onlineDisplay:entryView==='modes'?modeChooser():entryView==='local'?welcome():game?
  (game.phase==='kickoff-ready'?endMercato():['mercato','lineup'].includes(game.phase)?playing():matchPage()):welcome())+
 (error?'<div class="alert" role="alert">'+esc(error)+'</div>':'')+
 (onlineVisible?onlineAnnouncementView():'')+popup();
}
function change(fn){
 const before=game,next=fn(before),end=before.phase==='mercato'?currentAuctionEnding(before,next):null;
 game=next;error='';selection=null;
 // La dernière recrue étant déjà sur le terrain, afficher directement
 // les compositions sans laisser un ancien verrou de placement actif.
 if(placement&&game.phase==='lineup'&&game.teams.find(t=>t.club===placement.club)?.slots.includes(placement.cardId)){
   placement=null;teamsVisible=true;
 }
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
 let s=createGame({firstClub:'PSG',clubChoices:localClubChoices});
 s.competition=localCompetition;
 s.stadiumId=localStadium;
 s.matchRecordId=crypto.randomUUID();
 if(localRecruitmentMode==='random'){
  s=generateRandomTeams(s,beforeForm);
 }else{
  for(const id of ['PSG','OM'])if(beforeForm[id]!=='2-2-2')Object.assign(s,chooseFormation(s,id,beforeForm[id]));
 }
 game=s;entryView='playing';selection=null;placement=null;teamsVisible=false;pitchClub=null;
 modal=localRecruitmentMode==='random'?{type:'random-reveal',step:0}:{type:'dice'};
 error='';save();render();
}
function clicked(button){
 const action=button.dataset.action,club=button.dataset.club;
 if(action==='open-local'){entryView='local';error='';render();return;}
 if(action==='exit-finished-local'){
  if(game?.phase!=='finished')throw Error('La partie n’est pas terminée');
  entryView='modes';modal=null;selection=null;error='';render();return;
 }
 if(action==='back-modes'){entryView='modes';error='';render();return;}
 if(action==='online'){
  entryView='modes';onlineVisible=true;onlineStage=onlineClient.hasSession?(onlineClient.room?'room':'restore'):'choose';
  onlineError='';render();syncOnlinePoll();
  if(onlineClient.hasSession)void refreshOnlineRoom(true);
  return;
 }
 if(onlineVisible){
  void onlineClicked(action,button).catch(e=>{onlineError=e?.message||'Action réseau impossible';render();});
  return;
 }
 if(action==='local-recruit-auction'||action==='local-recruit-random'){
  if(entryView!=='local')throw Error('Choix du recrutement indisponible');
  localRecruitmentMode=action==='local-recruit-random'?'random':'auction';render();return;
 }
 if(action==='local-select-stadium'){
  if(entryView!=='local'||!isStadium(button.dataset.stadium))throw Error('Stade indisponible');
  localStadium=button.dataset.stadium;render();return;
 }
 if(action==='local-select-competition'){
  if(!isCompetition(button.dataset.competition))throw Error('Compétition invalide');
  if(entryView!=='local')throw Error('Sélection indisponible');
  localCompetition=button.dataset.competition;render();return;
 }
 if(action==='random-reveal-next'){
  if(modal?.type!=='random-reveal'||game?.recruitmentMode!=='random'||
   game.phase!=='lineup'||modal.step!==game.randomReveal?.step||modal.step>=7)
    throw Error('Tirage non disponible');
  game.randomReveal.step++;
  if(game.randomReveal.step===7){modal=null;teamsVisible=true;}
  else modal.step=game.randomReveal.step;
  save();render();return;
 }
 if(modal&&!['close','observation-show','reset','accept-overwrite'].includes(action))return;
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
  change(s=>dispatchOpenMatch(s,command,{choice,takerId}));
  if(['match','moment-result','shootout','finished'].includes(game?.phase))scrollMatchToTop();
  return;
 }
 if(action==='club'){firstClub=club;render();return;}
 if(action==='resume-local'){
  if(game){
   entryView='playing';
   // Après une reconnexion ou un passage par le menu, reprendre la révélation
   // aléatoire exactement au duo sauvegardé (jamais sauter les duos restants).
   modal=game.recruitmentMode==='random'&&game.phase==='lineup'&&
    Number.isInteger(game.randomReveal?.step)&&game.randomReveal.step>=0&&
    game.randomReveal.step<7?
    {type:'random-reveal',step:game.randomReveal.step}:null;
   error='';render();
  }
  return;
 }
 if(action==='start'){if(game){modal={type:'overwrite-local'};render();}else start();return;}
 if(action==='accept-overwrite'){if(modal?.type==='overwrite-local'){modal=null;start();}return;}
 if(action==='close'){
  if(modal?.type==='sale'&&placement){
   selection={club:placement.club,id:placement.cardId};
   pitchClub=placement.club;
  }
  modal=null;save();render();return;
 }
 if(action==='confirm-reset'){modal={type:'reset'};render();return;}
 if(action==='reset'){entryView='local';game=null;selection=null;placement=null;teamsVisible=false;pitchClub=null;modal=null;error='';matchUncovered=false;try{localStorage.removeItem(STORAGE);}catch{}render();return;}
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
 if(action==='inspect-player'){
  const id=button.dataset.card;
  if(!game?.teams.some(t=>t.roster.includes(id)))throw Error('Joueur absent des effectifs');
  modal={type:'card',id};render();return;
 }
 if(action==='pick'){
  const id=button.dataset.card;
  if(placement&&(club!==placement.club||id!==placement.cardId))
   throw Error('Place d’abord la nouvelle recrue avant de modifier un autre joueur.');
  if(!placement&&selection?.club===club&&selection.id===id){
   modal={type:'card',id};selection=null;
  }else selection=placement?{club:placement.club,id:placement.cardId}:{club,id};
  pitchClub=club;render();return;
 }
 if(action==='slot'){
  if(placement&&club!==placement.club)throw Error('La recrue doit rejoindre le terrain de son propre club.');
  const slot=Number(button.dataset.slot),team=game.teams.find(t=>t.club===club);
  pitchClub=club;
  if(selection){
   if(selection.club!==club)throw Error('Tu ne peux déplacer que tes propres joueurs.');
   const id=selection.id;
   if(!placement&&team?.slots[slot]===id){
    modal={type:'card',id};selection=null;render();
   }else change(s=>place(s,club,id,slot));
  }else if(team?.slots[slot]){selection={club,id:team.slots[slot]};render();}
  return;
 }
 if(action==='ready'){
  // Compatibilité des parties enregistrées avec un dernier placement terminé.
  if(placement&&game.phase==='lineup'&&game.teams.find(t=>t.club===placement.club)?.slots.includes(placement.cardId))
   placement=null;
  change(s=>ready(s,club));return;
 }
}
app.addEventListener('click',event=>{
 const target=event.target.closest('button[data-action]');
 if(!target||target.disabled)return;
 try{clicked(target);}catch(e){error=e.message||'Action impossible';render();}
});
app.addEventListener('change',event=>{
 const target=event.target;
 try{
  if(onlineVisible){
   if(target.dataset.action==='online-competition'&&isCompetition(target.value)){
     onlineCompetition=target.value;render();return;
    }
    if(target.dataset.action==='online-host-formation'&&FORMATION_NAMES.includes(target.value)){
     onlineHostFormation=target.value;render();return;
    }
    if(target.dataset.action==='online-guest-formation'&&FORMATION_NAMES.includes(target.value)){
     onlineJoinCode=document.getElementById('opfc-room-code')?.value??onlineJoinCode;
     onlineGuestFormation=target.value;render();return;
    }
    if(target.dataset.action==='online-host-identity'&&DISPLAY_CLUBS.some(c=>c.id===target.value)){
    onlineHostIdentity=target.value;render();return;
   }
   if(target.dataset.action==='online-guest-identity'&&DISPLAY_CLUBS.some(c=>c.id===target.value)){
    onlineJoinCode=document.getElementById('opfc-room-code')?.value??onlineJoinCode;
    onlineGuestIdentity=target.value;render();return;
   }
   if(target.dataset.action==='formation')
    void onlineFormationChanged(target).catch(e=>{onlineError=e?.message||'Formation réseau impossible';render();});
   return;
  }
  if(target.dataset.action==='local-competition'&&isCompetition(target.value)&&!game){
    localCompetition=target.value;render();return;
   }
   if(target.dataset.action==='club-identity'&&DISPLAY_CLUBS.some(c=>c.id===target.value)&&!game){
   const slot=target.dataset.club,other=slot==='PSG'?'OM':'PSG';
   if(!['PSG','OM'].includes(slot))throw Error('Joueur invalide');
   const previous=localClubChoices[slot];localClubChoices[slot]=target.value;
   if(localClubChoices[other]===target.value)localClubChoices[other]=previous;
   render();return;
  }
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
 // Garder la session mais passer d'abord par le choix du mode.
 onlineStage='restore';
}
render();
void syncQueuedLocalResults();
window.addEventListener('online',()=>{void syncQueuedLocalResults();});
if(onlineVisible&&onlineClient.configured)void refreshOnlineRoom();
// Reconnexion iOS : rattrapage immédiat après retour au premier plan.
document.addEventListener('visibilitychange',()=>{
 if(onlineVisible&&!document.hidden&&onlineClient.hasSession)void refreshOnlineRoom(true);
});
window.addEventListener('focus',()=>{
 if(onlineVisible&&onlineClient.hasSession&&!onlineRefreshInFlight)
  void refreshOnlineRoom(true);
});
