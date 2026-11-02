/**
 * OPFC — Laboratoire Penaltys / TAB. Accessible seulement par ?dev=penalty.
 * Zéro storage, fetch, serveur, statistiques, historique ou écriture.
 */
import {CARDS,CARD_BY_ID} from './catalog.mjs';
import {DISPLAY_CLUBS,displayClub,clubLogoFile,chooseClubPair,setDisplayedChoices,visualName} from './club-identities.mjs';
import {STADIUMS,stadiumById} from './stadiums.mjs';
import {renderCharacterPortrait,renderClubCrest} from './ui-portraits.mjs';
import {renderShotResult,matchTacticalChoices} from './ui-match-widgets.mjs';
import {renderShootoutTracker,renderShootoutScreen} from './ui-shootout.mjs';
import {renderFinalResult} from './ui-final.mjs';
import {labPitchGraphic,labBallGraphic} from './penalty-lab-visual.mjs?v=lab-classicball-20261102';
import {
 LAB_POSITIONS,defaultLineups,validateLineups,createLabSession,
 labTurn,prepareLabKick,commitLabKick,trajectoryFor
} from './penalty-lab-core.mjs';

const root=document.getElementById('opfc-app');
const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const other=club=>club==='PSG'?'OM':'PSG';
const name=id=>CARD_BY_ID.get(id)?.name??id??'—';
const labels={GAUCHE:'Gauche',CENTRE:'Centre',DROITE:'Droite'};
const state={
 type:'penalty',clubs:{PSG:'PSG',OM:'BDW'},stadium:'mugiwara',
 lineups:defaultLineups(),mode:'engine',attacker:'PSG',firstClub:'PSG',
 shooterId:null,session:null,step:'config',shotDirection:null,
 prepared:null,animationId:0,error:''
};

const css=document.createElement('link');
css.rel='stylesheet';
css.href='./opfc/penalty-lab.css?v=lab-v3-20261102';
document.head.append(css);
root.classList.add('plab');
// Garder exactement les bases de l'affichage OPFC : .app, .panel, .btn et leurs styles.
root.classList.add('app');

function selectHtml(key,current,items,role,extra=''){
 return '<select data-role="'+role+'" '+extra+' aria-label="'+h(key)+'">'+
  items.map(item=>'<option value="'+h(item.value)+'"'+(item.value===current?' selected':'')+'>'+
   h(item.label)+'</option>').join('')+'</select>';
}
const clubOpts=()=>DISPLAY_CLUBS.map(c=>({value:c.id,label:c.name}));
const playerOpts=cards=>cards.map(c=>({value:c.id,label:c.name+' · '+c.rating}));
const heading=()=>'<header class="plab-header"><div><div class="plab-brand">OPMERCATO FC · OUTILS DE DÉVELOPPEMENT</div>'+
 '<h1>🧪 Labo Penaltys / TAB</h1></div><span class="plab-tag">LOCAL · ZÉRO SAUVEGARDE</span></header>';
const button=(action,label,kind='',extra='')=>
 '<button type="button" class="plab-btn '+kind+'" data-action="'+action+'" '+extra+'>'+label+'</button>';
const clubImage=id=>{const src=clubLogoFile(id);return src?'<img src="'+h(src)+'" alt="">':'';};

function rosterColumn(club){
 const current=state.lineups[club],identity=displayClub(state.clubs[club]);
 const taken=new Set([...state.lineups.PSG,...state.lineups.OM]);
 return '<div class="plab-team"><div class="plab-team-head">'+clubImage(state.clubs[club])+
  '<strong>'+h(identity?.name??club)+'</strong></div>'+
  current.map((id,index)=>{
   const available=CARDS.filter(c=>c.position===LAB_POSITIONS[index]&&(!taken.has(c.id)||c.id===id))
    .sort((a,b)=>b.rating-a.rating);
   return '<label class="plab-roster-slot"><span class="plab-slot-name">'+
    h(LAB_POSITIONS[index])+' · titulaire '+(index+1)+'</span>'+
    selectHtml('Personnage '+club+' '+(index+1),id,playerOpts(available),'slot',
     'data-club="'+club+'" data-index="'+index+'"')+'</label>';
  }).join('')+'</div>';
}
function renderConfig(){
 const typeChoices='<div class="plab-choice-types">'+
  button('type-penalty','<strong>⚽ Penalty isolé</strong><small>Un seul tir à rejouer</small>',
   state.type==='penalty'?'active':'')+
  button('type-shootout','<strong>🏆 Séance de TAB</strong><small>Tirs alternés et score</small>',
   state.type==='shootout'?'active':'')+'</div>';
 return heading()+
  '<section class="plab-card"><h2>1. Type de test</h2>'+typeChoices+
  '<div class="plab-grid"><label>Club A'+selectHtml('Club A',state.clubs.PSG,clubOpts(),'club','data-club="PSG"')+'</label>'+
  '<label>Club B'+selectHtml('Club B',state.clubs.OM,clubOpts(),'club','data-club="OM"')+'</label></div>'+
  '<label style="margin-top:12px">Stade'+selectHtml('Stade',state.stadium,
   STADIUMS.map(s=>({value:s.id,label:s.name})),'stadium')+'</label></section>'+
  '<section class="plab-card"><h2>2. Compositions</h2>'+
  '<p class="plab-sub">Deux équipes de 7 titulaires générées automatiquement. Tu peux remplacer chaque personnage par un autre du même poste, sans doublons.</p>'+
  '<div class="plab-roster">'+rosterColumn('PSG')+rosterColumn('OM')+'</div>'+
  button('regenerate','🔀 Autre composition automatique','')+'</section>'+
  '<section class="plab-card"><h2>3. Réglages du test</h2><div class="plab-grid">'+
  '<label>Mode de résolution'+selectHtml('Résolution',state.mode,[
   {value:'engine',label:'Moteur officiel'},{value:'goal',label:'Forcer BUT (labo)'},
   {value:'save',label:'Forcer ARRÊT (labo)'},{value:'miss',label:'Forcer RATÉ (labo)'}
  ],'mode')+'</label>'+
  '<label>'+(state.type==='shootout'?'Premier club tireur':'Club qui tire')+
  selectHtml('Club qui commence',state.type==='shootout'?state.firstClub:state.attacker,
   [{value:'PSG',label:'Club A'},{value:'OM',label:'Club B'}],'attacker')+'</label></div>'+
  (state.type==='penalty'?'<label style="margin-top:12px">Tireur'+
  selectHtml('Tireur',state.shooterId&&state.lineups[state.attacker].includes(state.shooterId)?
   state.shooterId:state.lineups[state.attacker][5],playerOpts(state.lineups[state.attacker].map(id=>CARD_BY_ID.get(id))),'shooter')+
  '</label>':'<p class="plab-footnote">Les tireurs des TAB suivent automatiquement le classement réel d’OPFC, modifiable via les compositions ci-dessus.</p>')+
  '<p class="plab-footnote">Tu contrôles successivement le tireur et le gardien. Les deux choix restent secrets jusqu’à la résolution. Aucun résultat ne sera enregistré.</p>'+
  (state.error?'<p role="alert" class="plab-note">'+h(state.error)+'</p>':'')+
  button('start','Lancer le laboratoire ⚽','primary full')+'</section>';
}
/** Bandeau de score : les mêmes éléments et classes que scoreBoard() d'OPFC,
 * le labo ne contient aucun tableau de score personnalisé. */
function scoreboard(){
 const score={PSG:0,OM:0};
 return '<div class="match-scoreboard"><div>'+
  renderClubCrest('PSG','score-crest')+'<small>'+h(visualName('PSG'))+'</small></div>'+
  '<div class="match-score"><strong>'+['PSG','OM'].map(id=>
   '<span class="score-digit">'+score[id]+'</span>').join(' – ')+
  '</strong><span>90e minute</span></div>'+
  '<div>'+renderClubCrest('OM','score-crest')+'<small>'+h(visualName('OM'))+'</small></div></div>';
}
/** Le tracker ET l'historique sont générés par le module d'affichage officiel.
 * Les tirs en attente n'y figurent pas avant "Continuer", conformément au labo. */
function officialTracker(){
 const s=state.session?.shootout;
 if(!s)return '';
 return renderShootoutTracker(s);
}
function officialHistory(){
 const s=state.session?.shootout;
 if(!s)return '';
 const tracker=renderShootoutTracker(s);
 const entire=renderShootoutScreen({
  phase:'finished',teams:state.session.teams,match:{shootout:s,shootoutLastResult:null}
 });
 if(!entire.startsWith(tracker))throw Error('Historique officiel indisponible');
 return entire.slice(tracker.length);
}
/** Choix tactiques du jeu original ; seuls les événements sont routés localement. */
function officialChoices(shooter){
 const items=state.session?.type==='shootout'?
  [['GAUCHE','Gauche'],['CENTRE','Centre'],['DROITE','Droite']]:
  shooter?
   [['GAUCHE','Tirer à gauche'],['CENTRE','Tirer au centre'],['DROITE','Tirer à droite']]:
   [['GAUCHE','Plonger à gauche'],['CENTRE','Rester au centre'],['DROITE','Plonger à droite']];
 return matchTacticalChoices(items,'plab-choose');
}
function labTools(){
 return '<details class="plab-tools"><summary>🧪 Commandes du laboratoire</summary>'+
  '<div class="plab-actions">'+
  button('config','⚙️ Configuration')+
  (state.session.type==='shootout'?button('restart','↻ Nouvelle séance'):'')+
  (state.step==='result'?button('replay','↻ Rejouer sans compter'):'')+
  '</div><p class="plab-footnote">Uniquement des essais locaux, aucun match ni palmarès enregistré.</p></details>';
}
const pitchSvg=labPitchGraphic;
function pitch(turn){
 const stadium=stadiumById(state.stadium);
 return '<div class="plab-pitch" role="img" aria-label="Pelouse de football avec surface de réparation, but détaillé et filets. Portrait du gardien dans la cage, ballon au point de penalty, portrait du tireur immobile.">'+
  '<div class="plab-grass"></div><div class="plab-stadium-glow"></div>'+pitchSvg()+
  '<div class="plab-keeper" id="plab-keeper">'+renderCharacterPortrait(turn.keeperId,'plab-keeper-portrait')+
  '<span class="plab-person-label">'+h(name(turn.keeperId))+'</span></div>'+
  '<div class="plab-ball-shadow" id="plab-ball-shadow" aria-hidden="true"></div>'+
  '<div class="plab-ball" id="plab-ball" aria-hidden="true">'+labBallGraphic()+'</div>'+
  '<div class="plab-shooter">'+renderCharacterPortrait(turn.shooterId,'plab-shooter-portrait')+
  '<span class="plab-person-label">'+h(name(turn.shooterId))+'</span></div>'+
  '</div><p class="plab-footnote" style="text-align:center">🏟 '+h(stadium.name)+
  ' · Même orientation pour les deux joueurs : gauche / centre / droite de l’écran</p>';
}
function renderPlay(){
 const turn=labTurn(state.session,{shooterId:state.shooterId});
 if(!turn)return renderFinished();
 let controls='';
 const club=state.step==='keeper'?other(turn.club):turn.club;
 if(state.step==='shooter'||state.step==='keeper'){
  const shooter=state.step==='shooter';
  controls='<p>'+(shooter?'Choisis secrètement où tirer.':'Choisis secrètement où plonger.')+'</p>'+
   officialChoices(shooter);
 }else if(state.step==='handover'){
  controls='<div class="match-handover"><div class="match-handover-icon">🔒</div>'+
   '<h2>À toi de jouer, '+h(visualName(other(turn.club)))+'</h2>'+
   '<p>Passe le téléphone au joueur adverse. La direction précédente reste masquée.</p>'+
   '<button type="button" class="btn primary full" data-action="keeper-ready">Je suis '+
    h(visualName(other(turn.club)))+' · afficher mon choix</button></div>';
 }else if(state.step==='animating')controls='<p class="caption" role="status">Tir en cours…</p>';
 const label=state.session.type==='shootout'?'Tirs au but':'Penalty';
 return heading()+scoreboard()+officialTracker()+
  '<section class="panel match-stage"><span class="eyebrow">'+label+
  ' · '+h(visualName(club))+'</span>'+
  '<h2 class="match-shot-ready-heading">'+(state.step==='shooter'?'Choisis ta frappe':
    state.step==='keeper'?'Réaction du gardien':
    state.step==='handover'?'Choix confidentiel':'Le tir est déclenché')+'</h2>'+
  pitch(turn)+controls+'</section>'+
  officialHistory()+labTools();
}
function renderResult(){
 const attempt=state.prepared?.attempt;
 if(!attempt)return renderPlay();
 const s=state.session.shootout;
 const score=s?s.score:{PSG:0,OM:0};
 const viewState={teams:state.session.teams,phase:'moment-result',match:{index:0,score}};
 const result=renderShotResult(viewState,{
  outcome:attempt.outcome,attacker:attempt.club,
  shooterId:attempt.shooterId,keeperId:attempt.keeperId,
  score,context:s?'Séance de tirs au but':'Penalty',
  scoreLabel:s?'Score de la séance de tirs au but':'Score après la frappe',
  detailExtra:s?
   'Direction de la frappe : '+attempt.shotDirection+' · Gardien : '+attempt.keeperDirection:
   'Direction de la frappe : '+attempt.shotDirection+' · Gardien : '+attempt.keeperDirection,
  action:s?'plab-next':'plab-replay',
  continueLabel:s&&state.prepared.nextShootout?.phase==='finished'?'Voir le résultat final':'Continuer',
  goalInfo:!s&&attempt.scored?{kind:'penalty'}:null
 });
 return heading()+scoreboard()+officialTracker()+result+
  officialHistory()+labTools();
}
function renderFinished(){
 const s=state.session.shootout;
 // Le laboratoire n'enregistre jamais d'historique réel. Cet état éphémère
 // sert uniquement à afficher le même écran final qu'OPFC.
 const statistics=()=>({sequences:0,shots:0,onTarget:0,saves:0});
 const mock={phase:'finished',teams:state.session.teams.map(t=>({...t,identityId:state.clubs[t.club]})),
  competition:'grandline',match:{
   winner:s.winner,victory:'shootout',score:{PSG:0,OM:0},
   goals:[],history:[],statistics:{PSG:statistics(),OM:statistics()},
   competition:'grandline',shootout:s
  }};
 return heading()+renderFinalResult(mock)+labTools();
}
function render(){
 try{
  setDisplayedChoices(chooseClubPair(state.clubs.PSG,state.clubs.OM));
  root.dataset.v3Phase=state.step==='config'?'':state.session?.type==='shootout'?'shootout':'match';
  root.dataset.v3Stadium=state.stadium;
  root.innerHTML=state.step==='config'?renderConfig():state.step==='result'?renderResult():
   state.step==='finished'?renderFinished():renderPlay();
 }catch(err){
  root.innerHTML=heading()+'<section class="plab-card"><h2>Erreur du laboratoire</h2>'+
   '<p class="plab-note" role="alert">'+h(err.message)+'</p>'+button('config','Retour à la configuration')+'</section>';
 }
}
function randomize(){
 const used=new Set();
 const slots={PSG:[],OM:[]};
 for(let i=0;i<7;i++)for(const club of ['PSG','OM']){
  const options=CARDS.filter(c=>c.position===LAB_POSITIONS[i]&&!used.has(c.id));
  const pick=options[Math.floor(Math.random()*options.length)];
  slots[club].push(pick.id);used.add(pick.id);
 }
 return slots;
}
function start(){
 validateLineups(state.lineups);
 state.session=createLabSession({
  type:state.type,lineups:state.lineups,attacker:state.attacker,firstClub:state.firstClub
 });
 state.prepared=null;state.shotDirection=null;state.step='shooter';
 state.error='';state.animationId++;render();
}
function resetToStep(step){
 state.animationId++;state.prepared=null;state.shotDirection=null;
 state.step=step;render();
 const element=root.querySelector('.plab-pitch');
 if(element)element.classList.add('is-resetting');
}
function restart(){
 state.session=createLabSession({
  type:state.type,lineups:state.lineups,attacker:state.attacker,firstClub:state.firstClub
 });
 resetToStep('shooter');
}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function animateCurrent(id){
 const attempt=state.prepared.attempt;
 const scene=root.querySelector('.plab-pitch');
 const keeper=root.querySelector('#plab-keeper');
 const ball=root.querySelector('#plab-ball');
 const shadow=root.querySelector('#plab-ball-shadow');
 const art=ball?.querySelector('.plab-ball-art');
 if(!scene||!keeper||!ball||!art)return;
 const trajectory=trajectoryFor(attempt);
 const w=scene.clientWidth,height=scene.clientHeight;
 const bx=w*(trajectory.ballX-50)/100;
 const by=height*(trajectory.ballY-68)/100;
 const kx=w*(trajectory.keeperX-50)/100;
 const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const duration=reduced?40:1020;
 const isSave=attempt.outcome==='save';
 const isGoal=attempt.outcome==='goal';
 // Le ballon part systématiquement dans la direction choisie.
 // Un arrêt improbable du mauvais côté n'altère jamais le résultat officiel.
 const directionX={GAUCHE:-.19,CENTRE:0,DROITE:.19}[attempt.shotDirection]*w;
 const ballFrames=[
  {transform:'translate(-50%,-50%) translate(0px,0px) scale(1)',offset:0},
  {transform:'translate(-50%,-50%) translate('+directionX.toFixed(1)+'px,'+(by*.58).toFixed(1)+'px) scale(.78)',offset:.57},
  {transform:'translate(-50%,-50%) translate('+bx.toFixed(1)+'px,'+by.toFixed(1)+'px) scale(.49)',offset:isSave?.86:1}
 ];
 if(isSave)ballFrames.push({transform:'translate(-50%,-50%) translate('+(bx+directionX*.08).toFixed(1)+'px,'+(by+height*.045).toFixed(1)+'px) scale(.50)',offset:1});
 // Le gardien glisse sans rotation ; seul le ballon tourne.
 const keeperFrames=[
  {transform:'translate(-50%,-50%) translateX(0px)',offset:0},
  {transform:'translate(-50%,-50%) translateX(0px)',offset:.09},
  {transform:'translate(-50%,-50%) translateX('+kx.toFixed(1)+'px)',offset:1}
 ];
 if(typeof ball.animate==='function'){
  const animations=[
   ball.animate(ballFrames,{duration,fill:'forwards',easing:'cubic-bezier(.28,.02,.29,1)'}),
   keeper.animate(keeperFrames,{duration,fill:'forwards',easing:'cubic-bezier(.25,.1,.23,1)'}),
   art.animate([
    {transform:'rotate(-16deg)',offset:0},
    {transform:'rotate(115deg)',offset:.5},
    {transform:'rotate(315deg)',offset:1}
   ],{duration,fill:'forwards',easing:'ease-in'})
  ];
  if(shadow)animations.push(shadow.animate([
   {transform:'translate(-50%,-50%) scale(1)',opacity:.48,offset:0},
   {transform:'translate(-50%,-50%) translate('+directionX*.62+'px,'+by*.42+'px) scale(.65)',opacity:.24,offset:.57},
   {transform:'translate(-50%,-50%) translate('+bx+'px,'+by+'px) scale(.4)',opacity:0,offset:1}
  ],{duration,fill:'forwards',easing:'ease-out'}));
  // L'impact filet est discret et ne modifie pas l'écran du résultat.
  if(isGoal&&!reduced){
   await delay(Math.round(duration*.84));
   if(id!==state.animationId)return;
   scene.classList.add('plab-goal-impact');
  }
  try{await Promise.all(animations.map(anim=>anim.finished));}
  catch{return;}
 }else await delay(duration);
 if(id!==state.animationId)return;
 await delay(reduced?0:90);
 if(id!==state.animationId)return;
 state.step='result';render();
}
function resolve(){
 state.prepared=prepareLabKick(state.session,{
  shotDirection:state.shotDirection,keeperDirection:state.keeperChoice,
  shooterId:state.shooterId,mode:state.mode
 });
 state.step='animating';
 const id=++state.animationId;
 render();
 void animateCurrent(id).catch(err=>{
  if(id===state.animationId){state.error=String(err.message);state.step='result';render();}
 });
}
function clickAction(action,button){
 if(action==='type-penalty'||action==='type-shootout'){
  state.type=action==='type-penalty'?'penalty':'shootout';state.step='config';render();
 }else if(action==='regenerate'){
  state.lineups=randomize();state.shooterId=null;render();
 }else if(action==='start')start();
 else if(action==='config')resetToStep('config');
 else if(action==='restart')restart();
 else if(action==='keeper-ready'&&state.step==='handover'){state.step='keeper';render();}
 else if(action==='plab-choose'&&['shooter','keeper'].includes(state.step)){
  const dir=button.dataset.choice;
  if(!Object.hasOwn(labels,dir))return;
  if(state.step==='shooter'){
   state.shotDirection=dir;state.step='handover';render();
  }else{
   state.keeperChoice=dir;resolve();
  }
 }else if(action==='replay'&&state.step==='result')resetToStep('shooter');
 else if(action==='plab-replay'&&state.step==='result')resetToStep('shooter');
 else if(action==='plab-next'&&state.step==='result'){
  state.session=commitLabKick(state.session,state.prepared);
  resetToStep(state.session.shootout?.phase==='finished'?'finished':'shooter');
 }
}
root.addEventListener('click',event=>{
 const button=event.target.closest('button[data-action]');
 if(!button||!root.contains(button))return;
 try{clickAction(button.dataset.action,button);}
 catch(err){state.error=String(err.message);render();}
});
root.addEventListener('change',event=>{
 const sel=event.target.closest('select[data-role]');
 if(!sel)return;
 const role=sel.dataset.role,club=sel.dataset.club,value=sel.value;
 try{
  if(role==='club'){
   const next={...state.clubs,[club]:value};
   chooseClubPair(next.PSG,next.OM);
   state.clubs=next;
  }else if(role==='stadium')state.stadium=value;
  else if(role==='mode')state.mode=value;
  else if(role==='attacker'){
   if(state.type==='shootout')state.firstClub=value;
   else{state.attacker=value;state.shooterId=null;}
  }else if(role==='shooter')state.shooterId=value;
  else if(role==='slot'){
   const next=structuredClone(state.lineups);
   next[club][Number(sel.dataset.index)]=value;
   validateLineups(next);
   state.lineups=next;
   if(state.shooterId&&!state.lineups[state.attacker].includes(state.shooterId))
    state.shooterId=null;
  }
  state.error='';render();
 }catch(err){state.error=String(err.message);render();}
});
render();
