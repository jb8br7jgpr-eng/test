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
function save(){try{if(game)localStorage.setItem(STORAGE,JSON.stringify({game,firstClub,beforeForm}));}catch{}}
function restore(){try{
 const data=JSON.parse(localStorage.getItem(STORAGE)||'null');
 if(data?.game?.version===1&&['mercato','lineup','kickoff-ready','match','moment-result','half-time','resume-ready','shootout-ready','shootout','finished'].includes(data.game.phase)&&
 data.game.teams?.length===2){game=data.game;firstClub=data.firstClub==='OM'?'OM':'PSG';beforeForm=data.beforeForm||beforeForm;}
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
 '<div class="player-identity-row"><div class="player-identity">'+
 '<h2 class="player-name">'+esc(info.name)+'</h2>'+
 '<div class="player-meta">'+esc(info.group)+'</div></div>'+
 '<div class="player-labels"><span class="player-position position-'+info.position.toLowerCase()+'">'+info.position+'</span>'+
 '<span class="player-tier tier-'+info.rarity.toLowerCase()+'">'+rar[info.rarity]+'</span></div></div>'+
 '<div class="player-rating"><span>NOTE GLOBALE</span>'+
 '<strong class="rating-value">'+info.rating+'</strong></div>'+
 '<div class="stats-grid">'+stats+'</div></div>';
}
function sale(){
 const context=uiAuction(game),a=context.auction,t=context.team;
 const min=context.minimum,max=context.maximum;
 return '<section class="panel"><div class="auction-top"><span class="eyebrow">Mercato · '+game.teams.reduce((n,t)=>n+t.roster.length,0)+
 '/14</span><span class="turn-pill">'+a.turn+' doit jouer</span></div>'+
 cardPanel(context.card)+
 '<div class="auction-info"><span>Offre : <strong>'+(a.highestBid?a.highestBid+' M · '+a.highestClub:'Aucune')+
 '</strong></span><span>Priorité : <strong>'+a.priority+'</strong></span></div>'+
 (a.king?'<p class="warning-copy">Haki des Rois activé par '+a.king.holder+'.</p>':'')+
 (a.solo?'<p class="warning-copy">Une seule équipe recrute encore : prix fixe 5 M.</p>'+btn('solo','Recruter · 5 M','primary full'):
 '<div class="bid-row"><div class="form-box"><label for="bid-value">Offre en M Berrys</label>'+
 '<input class="bid-input" id="bid-value" type="number" inputmode="numeric" min="'+min+'" max="'+max+'" step="1" value="'+min+'" '+
 (context.canBid?'':'disabled')+'></div>'+btn('bid','Enchérir · '+a.turn,'primary',!context.canBid)+'</div>'+
 '<div class="bid-presets">'+btn('amount-min','Minimum','small',!context.canBid)+
 btn('amount-five','+5 M','small',!context.canBid)+btn('amount-max','Max '+max+' M','small',!context.canBid)+'</div>'+
 '<div class="auction-buttons">'+btn('pass',context.everOffered?'Se retirer':'Passer','negative',!context.canPass)+
 btn('inspect','Fiche complète','ghost',false,'data-card="'+esc(a.cardId)+'"')+'</div>'+
 '<div class="haki-row">'+btn('observation','Observation','ghost',!context.canObserve)+
 btn('kings','Haki des Rois','ghost',!context.canKings)+'</div>')+
 '<p class="warning-copy">Mise légale : '+min+' à '+max+' M. Réserve obligatoire de 5 M par recrue restante.</p></section>';
}
function fieldHalf(team,top){
 const u=uiTeam(team),positions=top?['GAR','DEF','MIL','ATT']:['ATT','MIL','DEF','GAR'];
 return '<div class="field-half"><div class="field-label '+team.club.toLowerCase()+'"><span>'+team.club+' · '+u.formation+
 '</span><span>'+u.entente+'/10 entente</span></div>'+
 positions.map(pos=>'<div class="pitch-row">'+u.lineup.filter(p=>p.position===pos).map(p=>{
  const active=selection?.club===team.club&&selection?.id===p.cardId;
  return '<button class="pitch-player '+(p.cardId?'':'empty')+' '+(active?'selected':'')+
   '" data-action="slot" data-club="'+team.club+'" data-slot="'+p.slot+'" aria-label="'+esc(pos)+' '+esc(p.card?.name??'vide')+'">'+
   '<span class="position">'+pos+(p.outOfPosition?'<span class="out" title="Hors poste"> !</span>':'')+'</span>'+
   (p.card?renderCharacterPortrait(p.card.id,'pitch-avatar'):'<span class="pitch-avatar pitch-avatar-empty" aria-hidden="true">+</span>')+
   '<span class="player-mininame">'+esc(p.card?.name??'+')+'</span>'+
   (p.rating===null?'':'<span class="rating">'+p.rating+'</span>')+'</button>';
 }).join('')+'</div>').join('')+'</div>';
}
function pitch(){
 const first=game.teams.find(t=>t.club===firstClub),other=game.teams.find(t=>t.club!==firstClub);
 return '<section class="panel"><div class="auction-top"><span class="eyebrow">Le stade · les compositions</span><span class="caption">Terrain vertical</span></div>'+
 '<p class="lineup-help">'+(selection?'Sélection : '+esc(card(selection.id)?.name)+' · touche une case '+selection.club+' pour placer ou échanger.':
 'Sélectionne une recrue puis touche une case de son club. Les cases occupées peuvent être échangées.')+'</p>'+
 '<div class="slot-field">'+fieldHalf(first,true)+'<div class="field-divider"></div>'+fieldHalf(other,false)+'</div></section>';
}
function teamPanel(team){
 const u=uiTeam(team),editable=['mercato','lineup','half-time'].includes(game.phase)&&!team.ready;
 return '<section class="panel team-panel"><div class="team-heading"><h2>'+renderClubCrest(team.club,'team-crest')+esc(clubName(team.club))+
 '</h2><small>'+u.rosterCount+'/7</small></div><div class="team-tools"><span class="caption">Entente '+u.entente+'/10</span>'+
 '<select data-action="formation" data-club="'+team.club+'" aria-label="Formation '+team.club+'" '+(editable?'':'disabled')+'>'+
 options(FORMATION_NAMES,u.formation)+'</select></div><div class="chip-row">'+
 (team.roster.length?team.roster.map(id=>{
  const chosen=selection?.club===team.club&&selection?.id===id;
  return '<button class="team-chip '+(chosen?'selected':'')+'" data-action="pick" data-club="'+team.club+
  '" data-card="'+esc(id)+'" aria-pressed="'+!!chosen+'" '+(editable?'':'disabled')+'>'+renderCharacterPortrait(id,'chip-portrait')+
  '<span class="team-chip-name">'+esc(card(id).name)+'</span><small>'+(team.slots.includes(id)?'✓':'+')+'</small></button>';
 }).join(''):'<span class="caption">Aucune recrue.</span>')+'</div>'+
 (['lineup','half-time'].includes(game.phase)?btn('ready',u.ready?'✓ Équipe prête':u.canReady?'Valider cette composition':'Place les 7 joueurs',
 'small full '+(u.canReady?'primary':'ghost'),!u.canReady,'data-club="'+team.club+'"'):'')+'</section>';
}
function teams(){
 return pitch()+'<div class="two-teams">'+game.teams.map(teamPanel).join('')+'</div>';
}
function playing(){
 const intro=shell()+'<div class="match-header">'+sep()+'<h1 class="page-title">'+
 (game.phase==='mercato'?'Mercato des légendes':'Prépare le Classique')+'</h1>'+
 '<div class="dice-note">Dés : '+game.dice.join(' · ')+'</div></div>'+wallets();
 const next=game.phase==='mercato'?sale()+teams():teams()+
 '<div class="ready-banner"><strong>Compositions en préparation</strong><p>Les 2 clubs doivent confirmer leurs équipes.</p></div>';
 return intro+next+'<div class="gameplay-nav"><span class="caption">Mode local · bloc 9A</span>'+
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
 return shell()+'<main class="ready-layout">'+middle+
 (game.phase==='half-time'?teams():'')+
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
 if(end)modal={type:'sale',result:end};
 save();render();
}
function start(){
 const s=createGame({firstClub});
 for(const id of ['PSG','OM'])if(beforeForm[id]!=='2-2-2')Object.assign(s,chooseFormation(s,id,beforeForm[id]));
 game=s;selection=null;modal={type:'dice'};error='';save();render();
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
 if(action==='close'){modal=null;render();return;}
 if(action==='confirm-reset'){modal={type:'reset'};render();return;}
 if(action==='reset'){game=null;selection=null;modal=null;error='';matchUncovered=false;try{localStorage.removeItem(STORAGE);}catch{}render();return;}
 if(action==='observation-show'){if(modal?.type==='observation-pass'){modal.type='observation-show';render();}return;}
 if(!game)return;
 if(action.startsWith('amount-')){
  const input=document.getElementById('bid-value'),context=uiAuction(game);
  if(!input||!context)return;
  input.value=String(action==='amount-min'?context.minimum:action==='amount-max'?context.maximum:
  Math.min(context.maximum,Math.max(context.minimum,Number(input.value)+5)));
  return;
 }
 if(action==='bid'){
  const value=document.getElementById('bid-value')?.value;
  if(!/^\d+$/.test(value??''))throw Error('Saisis une mise entière valide.');
  change(s=>bid(s,s.auction.turn,Number(value)));return;
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
  selection=selection?.club===club&&selection.id===id?null:{club,id};render();return;
 }
 if(action==='slot'){
  const slot=Number(button.dataset.slot),team=game.teams.find(t=>t.club===club);
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
  if(target.dataset.action==='formation'&&FORMATION_NAMES.includes(target.value))
   change(s=>chooseFormation(s,target.dataset.club,target.value));
 }catch(e){error=e.message||'Formation impossible';render();}
});
restore();
if(onlineClient.loadSession()){
 onlineVisible=true;onlineStage='restore';
}
render();
if(onlineVisible&&onlineClient.configured)void refreshOnlineRoom();
