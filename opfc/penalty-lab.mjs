/**
 * OPFC — Laboratoire Penaltys / TAB. Accessible seulement par ?dev=penalty.
 * Zéro storage, fetch, serveur, statistiques, historique ou écriture.
 */
import {CARDS,CARD_BY_ID} from './catalog.mjs';
import {DISPLAY_CLUBS,displayClub,clubLogoFile,chooseClubPair,setDisplayedChoices} from './club-identities.mjs';
import {STADIUMS,stadiumById} from './stadiums.mjs';
import {renderCharacterPortrait} from './ui-portraits.mjs';
import {renderShotResult} from './ui-match-widgets.mjs';
import {labPitchGraphic,labBallGraphic} from './penalty-lab-visual.mjs';
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
css.href='./opfc/penalty-lab.css?v=lab-v2-20261102';
document.head.append(css);
root.classList.add('plab');
root.classList.remove('app');

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
function scoreboard(){
 if(!state.session)return '';
 const a=displayClub(state.clubs.PSG),b=displayClub(state.clubs.OM);
 const s=state.session.shootout;
 return '<div class="plab-identity"><div>'+clubImage(a.id)+'<strong>'+h(a.name)+'</strong></div>'+
  '<span class="plab-vs">VS</span><div>'+clubImage(b.id)+'<strong>'+h(b.name)+'</strong></div></div>'+
  (s?'<div class="plab-score"><div class="plab-score-team"><small>'+h(a.name)+'</small>'+
   '<strong>'+s.score.PSG+'</strong></div><span class="plab-score-mid">TAB</span>'+
   '<div class="plab-score-team"><small>'+h(b.name)+'</small><strong>'+s.score.OM+'</strong></div></div>'+
   '<div class="plab-shootout-history">'+s.timeline.map(t=>'<span class="plab-dot '+(t.scored?'goal':'fail')+
    '" title="'+h(name(t.shooterId))+'">'+(t.scored?'✓':'×')+'</span>').join('')+'</div>':
   '<div class="plab-note">Penalty classique · Tir d’entraînement sans score</div>');
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
 if(state.step==='shooter'||state.step==='keeper'){
  const isShooter=state.step==='shooter';
  controls='<div class="plab-stage-heading">'+(isShooter?'⚽ Au tireur de choisir':'🧤 Au gardien de choisir')+
   '<small>Choix confidentiel : la direction adverse reste invisible.</small></div>'+
   '<div class="plab-buttons">'+Object.keys(labels).map(dir=>
   button('choose',labels[dir],isShooter?'':'','data-direction="'+dir+'"')).join('')+'</div>';
 }else if(state.step==='handover'){
  controls='<div class="plab-note">🔒 Direction du tireur enregistrée et masquée. Passe le téléphone au gardien.</div>'+
    button('keeper-ready','Je suis le gardien · choisir','primary full');
 }else if(state.step==='animating'){
  controls='<p class="plab-note" role="status">⚽ Tir en cours…</p>';
 }
 return heading()+'<section class="plab-card">'+scoreboard()+
  '<div class="plab-stage-heading">'+(state.session.type==='shootout'?
   'Tir n° '+turn.shotNumber+' · '+h(displayClub(state.clubs[turn.club]).name):
   'Penalty · '+h(displayClub(state.clubs[turn.club]).name))+'</div>'+
  pitch(turn)+controls+
  '<div class="plab-actions">'+button('config','⚙️ Configuration')+
  (state.session.type==='shootout'?button('restart','↻ Nouvelle séance'):'')+'</div></section>';
}
function renderResult(){
 const attempt=state.prepared?.attempt;
 if(!attempt)return renderPlay();
 const score=state.session.type==='shootout'?state.session.shootout.score:null;
 const viewState={teams:state.session.teams,phase:'moment-result',match:{index:0,score}};
 const result=renderShotResult(viewState,{
  outcome:attempt.outcome,attacker:attempt.club,
  shooterId:attempt.shooterId,keeperId:attempt.keeperId,
  score,context:state.session.type==='shootout'?'Labo · Séance de tirs au but':'Labo · Penalty classique',
  detailExtra:'Tir : '+labels[attempt.shotDirection]+' · Gardien : '+labels[attempt.keeperDirection],
  action:state.session.type==='shootout'?'plab-next':'plab-replay',
  continueLabel:state.session.type==='shootout'?'Valider et passer au tir suivant':'Rejouer le penalty',
  goalInfo:state.session.type==='penalty'&&attempt.scored?{kind:'penalty'}:null
 });
 return heading()+'<section class="plab-card">'+scoreboard()+
  '<p class="plab-result-state">Résultat d’essai — '+(state.session.type==='shootout'?
   'le score ne change qu’après validation.':'aucun score enregistré.')+'</p>'+
   result+'<div class="plab-actions">'+
   (state.session.type==='shootout'?button('replay','↻ Rejouer (sans compter)'):'')+
   button('config','⚙️ Configuration')+
   (state.session.type==='shootout'?button('restart','Nouvelle séance'):'')+
   '</div></section>';
}
function renderFinished(){
 const s=state.session.shootout;
 const winner=displayClub(state.clubs[s.winner]);
 return heading()+'<section class="plab-card">'+scoreboard()+
  '<div class="plab-summary"><div style="font-size:36px">🏆</div>'+
  '<h2>Victoire de '+h(winner.name)+' !</h2><p>Fin de la séance simulée. Aucune finale ni statistique sauvegardée.</p></div>'+
  '<div class="plab-actions">'+button('restart','Nouvelle séance','primary')+
  button('config','Modifier les équipes')+'</div></section>';
}
function render(){
 try{
  setDisplayedChoices(chooseClubPair(state.clubs.PSG,state.clubs.OM));
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
 else if(action==='choose'&&['shooter','keeper'].includes(state.step)){
  const dir=button.dataset.direction;
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
