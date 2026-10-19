/** OPFC v0.8 — bloc 9A : interface mercato local sur iPhone.
 * Le serveur en ligne et les matchs seront branchés dans les blocs suivants.
 * Aucune formule de jeu dupliquée : les mutations utilisent engine.mjs.
 */
import {createGame,bid,pass,useKings,useObservation,acceptSolo,chooseFormation,place,ready} from './engine.mjs';
import {CARD_BY_ID} from './catalog.mjs';
import {effectiveRating} from './rules.mjs';
import {FORMATION_NAMES,uiAuction,uiTeam,cardStats,currentAuctionEnding,clubName} from './ui-model.mjs';
const KEY='opfc-v08-dev-local',app=document.getElementById('opfc-app');
let state=null,firstClub='PSG',selected=null,dialog=null,error='',initialFormations={PSG:'2-2-2',OM:'2-2-2'};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const other=id=>id==='PSG'?'OM':'PSG',card=id=>CARD_BY_ID.get(id),name=id=>card(id)?.name??id;
const safe=fn=>{try{return fn();}catch{return null;}};
function persist(){safe(()=>localStorage.setItem(KEY,JSON.stringify({state,firstClub,initialFormations})));}
function restore(){
 const raw=safe(()=>localStorage.getItem(KEY));if(!raw)return;
 try{
  const obj=JSON.parse(raw);
  if(obj.state?.version===1&&['mercato','lineup','kickoff-ready'].includes(obj.state.phase)&&Array.isArray(obj.state.teams)){
   state=obj.state;
   firstClub=['PSG','OM'].includes(obj.firstClub)?obj.firstClub:'PSG';
   if(obj.initialFormations)initialFormations=obj.initialFormations;
  }
 }catch{}
}
const header=()=>'<header class="topbar"><a class="brand-mini" href="./"><img src="./opfc-logo-hd.PNG" alt="" width="35" height="35"><span>OPMERCATO FC</span></a><a class="small-link" href="./">← Les jeux</a></header>';
const options=value=>FORMATION_NAMES.map(v=>'<option value="'+v+'" '+(v===value?'selected':'')+'>'+v+'</option>').join('');
const button=(act,label,extra='',disabled=false,klass='btn')=>'<button type="button" class="'+klass+'" data-action="'+act+'" '+extra+' '+(disabled?'disabled':'')+'>'+label+'</button>';
function intro(){
 let out=header()+'<main class="intro"><img class="intro-logo" src="./opfc-logo-hd.PNG" alt="OPMercato FC" width="180" height="180">';
 out+='<span class="eyebrow">Le Classique de Grand Line</span><h1 class="intro-title">La Grandline Cup<br>se gagne ici.</h1><p>Sept recrues, 250 M Berrys et un Classique mémorable.</p>';
 out+='<section class="panel intro-panel"><h2 class="section-title">Club du joueur 1</h2><div class="select-club">';
 for(const id of ['PSG','OM']){
  out+=button('club','<strong>'+id+'</strong><span>'+esc(clubName(id))+'</span>','data-club="'+id+'" aria-pressed="'+(firstClub===id)+'"',false,
   'club-option '+(id==='PSG'?'psg':'om')+(firstClub===id?' active':''));
 }
 out+='</div><p class="caption">Joueur 2 : '+esc(clubName(other(firstClub)))+'</p></section>';
 out+='<section class="panel intro-panel"><h2 class="section-title">Formation initiale</h2><div class="formation-picker">';
 for(const id of ['PSG','OM'])out+='<div class="form-box"><label for="initial-'+id+'">'+id+'</label><select id="initial-'+id+'" data-action="initial-formation" data-club="'+id+'">'+options(initialFormations[id])+'</select></div>';
 out+='</div><p class="caption">Les formations restent modifiables pendant le mercato.</p></section>';
 out+='<div class="intro-actions">'+button('start','Jouer en local · 2 joueurs','',false,'btn primary full');
 out+='<button class="btn ghost full" disabled>Mode en ligne · en préparation</button>';
 out+='<p class="online-note">Le mode en ligne sera intégré avec Supabase avant le premier déploiement public d’OPFC.</p></div></main>';
 return out;
}
function hud(t){
 return '<div class="hud '+(t.club==='PSG'?'psg':'om')+'"><div class="hud-top"><span>'+esc(clubName(t.club))+'</span><strong>'+t.club+'</strong></div>'+
 '<div class="hud-budget"><strong>'+t.budget+' M</strong><span>Berrys</span></div><div class="hud-bottom"><span>'+t.roster.length+'/7 recrues</span><span>'+t.refusals+'/5 refus</span></div></div>';
}
const huds=()=>'<div class="huds" aria-label="Budgets des clubs">'+state.teams.map(hud).join('')+'</div>';
function portrait(c){
 const initials=c.name.split(/[\s.-]+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();
 return '<div class="portrait-shell" aria-label="Portrait HD de '+esc(c.name)+' à venir"><span class="portrait-symbol">'+esc(initials)+'</span><span class="portrait-label">Portrait HD à venir</span></div>';
}
function cardMarkup(c){
 let out='<div class="player-card rarity-'+c.rarity+'">'+portrait(c)+'<div><div class="rating-strip"><span class="rating-value">'+c.rating+'</span>';
 out+='<span class="rarity">'+({DIA:'DIAMANT',OR:'OR',ARG:'ARGENT',BRZ:'BRONZE'}[c.rarity])+'</span></div>';
 out+='<div class="player-name">'+esc(c.name)+'</div><div class="player-meta">'+esc(c.group)+' · '+c.position+'</div><div class="stats-grid">';
 for(const s of cardStats(c))out+='<div class="stat"><span>'+s.label+'</span><strong>'+s.value+'</strong></div>';
 return out+'</div></div></div>';
}
function auction(){
 const m=uiAuction(state),a=m.auction,t=m.team;
 let out='<section class="panel"><div class="auction-top"><span class="eyebrow">Mercato · '+(state.teams[0].roster.length+state.teams[1].roster.length)+'/14</span><span class="turn-pill">'+a.turn+' doit jouer</span></div>';
 out+=cardMarkup(m.card);
 out+='<div class="auction-info"><span>Meilleure offre : <strong>'+(a.highestBid?a.highestBid+' M · '+a.highestClub:'Aucune')+'</strong></span><span>Priorité : <strong>'+a.priority+'</strong></span></div>';
 if(a.king)out+='<p class="warning-copy">Haki des Rois activé par '+a.king.holder+' : dernière surenchère possible.</p>';
 if(a.solo)out+='<p class="warning-copy">L’autre équipe est complète. Achat seul à prix fixe.</p>'+
  button('solo','Recruter pour 5 M · '+a.turn,'',false,'btn primary full');
 else{
  out+='<div class="bid-row"><label class="form-box" for="bid-amount"><span class="caption">Offre en M Berrys</span><input class="bid-input" id="bid-amount" type="number" inputmode="numeric" min="'+m.minimum+'" max="'+m.maximum+'" step="1" value="'+m.minimum+'" '+(m.canBid?'':'disabled')+'></label>';
  out+=button('bid','Enchérir · '+a.turn,'',!m.canBid,'btn primary')+'</div><div class="bid-presets">';
  out+=button('amount','Minimum','data-value="min"',!m.canBid,'btn small');
  out+=button('amount','+5 M','data-value="plus5"',!m.canBid,'btn small');
  out+=button('amount','Max '+m.maximum+' M','data-value="max"',!m.canBid,'btn small')+'</div>';
  out+='<div class="auction-buttons">'+button('pass',m.everOffered?'Se retirer':'Passer','',!m.canPass,'btn negative');
  out+=button('inspect','Fiche complète','data-card="'+m.card.id+'"',false,'btn ghost')+'</div><div class="haki-row">';
  out+=button('observation','Haki Observation '+(t.hakis.observation?'✓':''),'',!m.canObserve,'btn ghost');
  out+=button('kings','Haki des Rois '+(t.hakis.kings?'✓':''),'',!m.canKings,'btn ghost')+'</div>';
 }
 out+='<p class="warning-copy">Mise autorisée : '+m.minimum+' à '+m.maximum+' M. Garde 5 M par recrue restante. Cinq refus sans mise maximum.</p></section>';
 return out;
}
function row(u,position,club){
 let out='<div class="pitch-row">';
 for(const p of u.lineup.filter(p=>p.position===position)){
  out+=button('slot','<span class="position">'+p.position+(p.outOfPosition?' <span class="out">!</span>':'')+'</span><span class="player-mininame">'+esc(p.card?.name??'+')+'</span>'+(p.rating===null?'':'<span class="rating">'+p.rating+'</span>'),
    'data-club="'+club+'" data-slot="'+p.slot+'" aria-label="'+esc(p.position+' '+(p.card?.name??'case vide'))+'"',false,
    'pitch-player '+(p.cardId?'':'empty')+(selected?.club===club&&selected.id===p.cardId?' selected':''));
 }
 return out+'</div>';
}
function half(t,upper){
 const u=uiTeam(t),zones=upper?['GAR','DEF','MIL','ATT']:['ATT','MIL','DEF','GAR'];
 let out='<div class="field-half"><div class="field-label '+(t.club==='PSG'?'psg':'om')+'"><span>'+t.club+' · '+t.formation+'</span><span>'+u.entente+'/10 entente</span></div>';
 for(const zone of zones)out+=row(u,zone,t.club);
 return out+'</div>';
}
function stadium(){
 const a=state.teams.find(t=>t.club===firstClub),b=state.teams.find(t=>t.club!==firstClub);
 return '<div class="slot-field" aria-label="Stade vertical">'+half(a,true)+'<div class="field-divider"></div>'+half(b,false)+'</div>';
}
function teams(){
 const editable=['mercato','lineup'].includes(state.phase);
 let out='<section class="panel"><div class="auction-top"><span class="eyebrow">Stade · composition</span><span class="caption">Placement manuel</span></div>';
 out+='<p class="lineup-help">'+(selected?'Sélection : '+esc(name(selected.id))+' · touche une case '+selected.club:'Touche une recrue ci-dessous, puis sa case sur le terrain.')+'</p>';
 out+=stadium()+'</section><div class="two-teams">';
 for(const t of state.teams){
  const u=uiTeam(t);
  out+='<section class="panel team-panel"><div class="team-heading"><h2><span class="club-bullet">'+t.club+'</span>'+esc(clubName(t.club))+'</h2><small>'+t.roster.length+'/7</small></div>';
  out+='<div class="team-tools"><span class="caption">Entente '+u.entente+'/10</span><select data-action="formation" data-club="'+t.club+'" aria-label="Formation '+t.club+'" '+(editable?'':'disabled')+'>'+options(t.formation)+'</select></div><div class="chip-row">';
  for(const id of t.roster){
   out+=button('select-card',esc(name(id))+' <small>'+(t.slots.includes(id)?'✓':'+')+'</small>',
    'data-club="'+t.club+'" data-card="'+id+'" aria-pressed="'+(selected?.club===t.club&&selected.id===id)+'"',
    !editable,'team-chip '+(selected?.club===t.club&&selected.id===id?'selected':''));
  }
  if(!t.roster.length)out+='<span class="caption">Aucune recrue pour le moment.</span>';
  out+='</div>';
  if(state.phase==='lineup')out+=button('ready',u.ready?'✓ Équipe prête':u.canReady?'Valider cette composition':'Place les 7 joueurs','data-club="'+t.club+'"',!u.canReady,'btn small full '+(u.ready?'ghost':'primary'));
  out+='</section>';
 }
 return out+'</div>';
}
function page(){
 let out=header();
 if(state.phase==='mercato'){
  out+='<div class="match-header"><span class="eyebrow">Le Classique de Grand Line</span><h1 class="page-title">Mercato des légendes</h1><div class="dice-note">Dés : '+state.dice.join(' · ')+'</div></div>';
  out+=huds()+auction()+teams();
 }else if(state.phase==='lineup'){
  out+='<div class="match-header"><h1 class="page-title">Prépare le Classique</h1><p class="muted">Place les sept joueurs de chaque équipe, puis valide les compositions.</p></div>';
  out+=huds()+teams();
 }else{
  out+='<div class="match-header"><h1 class="page-title">Les équipes sont prêtes !</h1><p class="muted">Les 14 joueurs attendent le coup d’envoi.</p></div>';
  out+=huds()+teams()+'<div class="notice">Les écrans de match seront branchés dans le bloc suivant. Aucun score fictif n’est généré.</div>';
 }
 out+='<div class="gameplay-nav"><span class="caption">Mode local · prototype de développement</span>'+button('new-confirm','Nouvelle partie','',false,'link-button')+'</div>';
 return out;
}
function modal(){
 if(!dialog)return '';
 let out='';
 if(dialog.kind==='opening'){
  out='<div class="big-symbol">🎲</div><h2>Place au mercato !</h2><p>Résultat des dés : '+state.dice.join(' — ')+'. Priorité initiale : <strong>'+state.auction.priority+'</strong>.</p>'+button('dismiss','Commencer les enchères','',false,'btn primary full');
 }else if(dialog.kind==='sale'){
  const c=card(dialog.result.cardId),r=dialog.result;
  out='<div class="big-symbol">🏅</div><h2>'+(r.winner?'Recrue remportée !':'Carte invendue')+'</h2><p><strong>'+esc(c?.name??r.cardId)+'</strong> '+(r.winner?'rejoint '+r.winner+' pour '+r.price+' M Berrys.':'quitte définitivement le mercato.')+'</p>';
  out+=button('dismiss',state.phase==='lineup'?'Préparer les compositions':'Continuer','',false,'btn primary full');
 }else if(dialog.kind==='observation-pass'){
  out='<div class="big-symbol">👁</div><h2>Secret de l’Observation</h2><p>Donne le téléphone au joueur <strong>'+dialog.club+'</strong> pour lui seul.</p>';
  out+=button('observation-view','Je suis '+dialog.club+' · voir les cartes','',false,'btn primary full');
 }else if(dialog.kind==='observation-view'){
  out='<div class="big-symbol">👁</div><h2>Les cinq prochaines cartes</h2><p>Confidentiel · '+dialog.club+' uniquement.</p><div class="preview-list">';
  dialog.cards.forEach((id,i)=>out+='<div class="preview-item"><span>'+(i+1)+'. '+esc(name(id))+'</span><strong>'+card(id).rating+'</strong></div>');
  out+='</div>'+button('dismiss','Masquer et reprendre','',false,'btn primary full');
 }else if(dialog.kind==='inspect'){
  const c=card(dialog.id);
  out='<h2>'+esc(c.name)+'</h2>'+cardMarkup(c)+'<h3 class="section-title">Notes effectives par poste</h3><div class="detail-grid">';
  for(const pos of ['GAR','DEF','MIL','ATT'])out+='<div><span>'+pos+'</span><strong>'+effectiveRating(c.id,pos)+'</strong></div>';
  out+='</div>'+button('dismiss','Retour au jeu','',false,'btn primary full');
 }else if(dialog.kind==='new-confirm'){
  out='<h2>Nouvelle partie ?</h2><p>La partie actuelle sera effacée de cet appareil.</p>'+button('reset','Effacer la partie','',false,'btn negative full')+button('dismiss','Conserver ma partie','',false,'btn ghost full');
 }
 return '<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true">'+out+'</section></div>';
}
function render(){
 app.innerHTML=(state?page():intro())+
  (error?'<div class="alert" role="alert">'+esc(error)+'</div>':'')+
  (state?'<p class="footer-note">OPFC v0.8 · branche de développement</p>':'')+modal();
}
function mutate(fn){
 const old=state,next=fn(state);
 const end=old.phase==='mercato'?currentAuctionEnding(old,next):null;
 state=next;selected=null;error='';persist();
 if(end)dialog={kind:'sale',result:end};
 render();
}
function start(){
 let s=createGame({firstClub});
 for(const id of ['PSG','OM'])if(initialFormations[id]!=='2-2-2')s=chooseFormation(s,id,initialFormations[id]);
 state=s;selected=null;error='';dialog={kind:'opening'};persist();render();
}
function act(btn){
 const action=btn.dataset.action,club=btn.dataset.club,id=btn.dataset.card;
 if(dialog&&!['dismiss','observation-view','reset'].includes(action))return;
 if(action==='club'){firstClub=club;render();return;}
 if(action==='start'){start();return;}
 if(action==='dismiss'){dialog=null;render();return;}
 if(action==='new-confirm'){dialog={kind:'new-confirm'};render();return;}
 if(action==='reset'){
  state=null;selected=null;dialog=null;error='';safe(()=>localStorage.removeItem(KEY));render();return;
 }
 if(action==='observation-view'){
  if(dialog?.kind==='observation-pass'){dialog={...dialog,kind:'observation-view'};render();}
  return;
 }
 if(!state)return;
 if(action==='amount'){
  const field=document.getElementById('bid-amount'),ctx=uiAuction(state);
  if(!field||!ctx)return;
  const n=btn.dataset.value==='min'?ctx.minimum:btn.dataset.value==='max'?ctx.maximum:Math.min(ctx.maximum,Math.max(ctx.minimum,Number(field.value)+5));
  field.value=String(n);return;
 }
 if(action==='bid'){
  const value=document.getElementById('bid-amount')?.value;
  if(!/^\d+$/.test(value??''))throw Error('Saisis une mise entière.');
  mutate(s=>bid(s,s.auction.turn,Number(value)));return;
 }
 if(action==='pass'){mutate(s=>pass(s,s.auction.turn));return;}
 if(action==='solo'){mutate(s=>acceptSolo(s,s.auction.turn));return;}
 if(action==='kings'){mutate(s=>useKings(s,s.auction.turn));return;}
 if(action==='observation'){
  const owner=state.auction.turn,r=useObservation(state,owner);
  state=r.state;dialog={kind:'observation-pass',club:owner,cards:r.peek};persist();render();return;
 }
 if(action==='inspect'){dialog={kind:'inspect',id};render();return;}
 if(action==='select-card'){
  selected=selected?.club===club&&selected.id===id?null:{club,id};error='';render();return;
 }
 if(action==='slot'){
  const slot=Number(btn.dataset.slot);
  if(selected){
   if(selected.club!==club)throw Error('Ce joueur appartient à l’autre club.');
   mutate(s=>place(s,club,selected.id,slot));
  }else{
   const occupied=state.teams.find(t=>t.club===club)?.slots[slot];
   if(occupied){dialog={kind:'inspect',id:occupied};render();}
  }
  return;
 }
 if(action==='ready'){mutate(s=>ready(s,club));return;}
}
app.addEventListener('click',event=>{
 const btn=event.target.closest('button[data-action]');
 if(!btn||btn.disabled)return;
 try{act(btn);}catch(e){error=e.message??'Action impossible';render();}
});
app.addEventListener('change',event=>{
 const target=event.target;
 try{
  if(target.dataset.action==='initial-formation'){
   initialFormations[target.dataset.club]=target.value;
  }else if(target.dataset.action==='formation'){
   mutate(s=>chooseFormation(s,target.dataset.club,target.value));
  }
 }catch(e){error=e.message??'Formation impossible';render();}
});
restore();render();
