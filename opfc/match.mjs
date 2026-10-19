/**
 * OPFC v0.8 — Bloc 8A : orchestration du calendrier et du score (§§15A–18,32).
 * AUCUNE simulation arbitraire : resolveMatchMoment reçoit un résultat déjà
 * calculé et authentifié par le moteur d'action (bloc 8B) côté serveur.
 * Ne jamais exposer cette transition brute directement aux clients en ligne.
 *
 * Le calendrier complet est SECRET (stockage serveur), immuable après kickoff.
 * Les deux modes utilisent les mêmes transitions. Aucune horloge réelle.
 */
import {buildSchedule,lineupDetails} from './rules.mjs';
import {publicView} from './engine.mjs';
import {createShootout,applyShootoutKick} from './shootout.mjs';

const CLUBS=['PSG','OM'];
const clone=state=>structuredClone(state);
const fail=message=>{throw Error(message);};
const other=club=>club==='PSG'?'OM':'PSG';
function getTeams(s){
 if(!Array.isArray(s?.teams)||s.teams.length!==2)fail('Deux équipes obligatoires');
 const psg=s.teams.find(t=>t.club==='PSG'),om=s.teams.find(t=>t.club==='OM');
 if(!psg||!om)fail('Clubs PSG et OM obligatoires');
 for(const team of [psg,om]){
  if(team.roster?.length!==7||team.ready!==true||
    team.slots?.length!==7||new Set(team.roster).size!==7||
    new Set(team.slots).size!==7||
    team.slots.some(id=>!team.roster.includes(id))
  )fail('Équipe prête à sept titulaires obligatoire');
  if(lineupDetails(team).some(p=>!p))fail('Composition invalide');
 }
 if(new Set([...psg.roster,...om.roster]).size!==14)fail('Doublon entre les clubs');
 return {PSG:psg,OM:om};
}
const blankStats=()=>({sequences:0,shots:0,onTarget:0,saves:0});
const current=s=>s.match?.schedule?.[s.match.index]??null;
export function kickoffMatch(state,rng=Math.random){
 if(state?.phase!=='kickoff-ready'||state.match)fail('Coup d’envoi indisponible');
 const teams=getTeams(state);
 const schedule=buildSchedule(teams.PSG,teams.OM,rng);
 if(schedule.length<10||schedule.length>12||schedule.some(e=>!CLUBS.includes(e.attacker)))
  fail('Calendrier incorrect');
 const s=clone(state);
 s.phase='match';
 s.match={
  version:1,index:0,minute:schedule[0].minute,schedule,score:{PSG:0,OM:0},
  statistics:{PSG:blankStats(),OM:blankStats()},
  goals:[],history:[],lastResult:null,winner:null,victory:null,
  shootout:null
 };
 return s;
}
export function currentMatchMoment(state){
 if(!['match','moment-result'].includes(state?.phase))return null;
 const event=current(state);
 return event?Object.freeze({...event}):null;
}
/** Transition INTERNE de confiance : résultat déjà résolu par moteur.
 * Les détails du tireur devront être vérifiés contre la finition calculée
 * par l'orchestrateur (bloc 8B). Aucun client ne choisit 'goal' librement.
 */
export function resolveMatchMoment(state,{outcome,scorerId=null}={}){
 if(state?.phase!=='match'||!state.match)fail('Aucune action à résoudre');
 if(!['stopped','miss','save','goal'].includes(outcome))fail('Résultat de séquence invalide');
 const event=current(state);if(!event)fail('Calendrier terminé');
 const s=clone(state),m=s.match,attack=event.attacker,defense=other(attack);
 if(outcome==='goal'){
  const lineup=s.teams.find(t=>t.club===attack);
  if(typeof scorerId!=='string'||!lineup.slots.includes(scorerId))fail('Buteur absent du terrain');
 }else if(scorerId!==null)fail('Buteur uniquement pour un but');
 const attackerStats=m.statistics[attack];
 attackerStats.sequences++;
 if(outcome!=='stopped'){
  attackerStats.shots++;
  if(outcome!=='miss')attackerStats.onTarget++;
  if(outcome==='save')m.statistics[defense].saves++;
  if(outcome==='goal'){
   m.score[attack]++;
   m.goals.push({club:attack,cardId:scorerId,minute:event.minute});
  }
 }
 const result={index:m.index,minute:event.minute,period:event.period,attacker:attack,
  type:event.type,outcome,scorerId};
 m.history.push(result);
 m.lastResult=result;
 m.minute=event.minute;
 s.phase='moment-result'; // oblige le clic Continuer avant la suite.
 return s;
}
/** Passe à la séquence suivante, ou affiche mi-temps / 90e.
 * Ne modifie JAMAIS le calendrier pré-tiré.
 */
export function continueMatch(state){
 if(state?.phase!=='moment-result'||!state.match?.lastResult)fail('Aucun résultat à continuer');
 const s=clone(state),m=s.match;
 if(m.lastResult.index!==m.index)fail('Résultat incompatible avec la séquence');
 m.index++;
 m.lastResult=null;
 if(m.index===m.schedule.length){
  m.minute=90;
  if(m.score.PSG===m.score.OM)s.phase='shootout-ready';
  else{
   s.phase='finished';
   m.winner=m.score.PSG>m.score.OM?'PSG':'OM';
   m.victory='regulation';
  }
 }else if(m.schedule[m.index].period===2&&m.history.at(-1).period===1){
  s.phase='half-time';m.minute=45;
  s.teams.forEach(t=>t.ready=false);
 }else{
  s.phase='match';
  m.minute=m.schedule[m.index].minute;
 }
 return s;
}
/** ready() de engine.mjs fait passer de 'half-time' à 'resume-ready';
 * cette transition utilise STRICTEMENT le calendrier original.
 */
export function resumeMatch(state){
 if(state?.phase!=='resume-ready'||!state.match)fail('Reprise impossible');
 getTeams(state);
 const m=state.match;
 if(m.index<1||m.index>=m.schedule.length||
   m.schedule[m.index].period!==2||m.schedule[m.index-1].period!==1)
   fail('Reprise en dehors de la mi-temps');
 const s=clone(state);
 s.phase='match';s.match.minute=m.schedule[m.index].minute;
 return s;
}
/** Égalité à 90 min seulement. Le lancer de pièce ouvre la séance,
 * sans mélanger son score et ses statistiques au temps réglementaire.
 */
export function beginShootout(state,coinDraw){
 if(state?.phase!=='shootout-ready'||!state.match)fail('Départage indisponible');
 const s=clone(state),psg=s.teams.find(t=>t.club==='PSG'),om=s.teams.find(t=>t.club==='OM');
 s.match.shootout=createShootout({psg,om,regulationScore:s.match.score,coinDraw});
 s.phase='shootout';
 return s;
}
/** Appelé après réception sécurisée des deux directions du penalty. */
export function advanceShootout(state,kick){
 if(state?.phase!=='shootout'||!state.match?.shootout)fail('Aucune séance de tirs au but');
 const s=clone(state);
 s.match.shootout=applyShootoutKick(s.match.shootout,kick);
 if(s.match.shootout.phase==='finished'){
  s.phase='finished';s.match.winner=s.match.shootout.winner;s.match.victory='shootout';
 }
 return s;
}
/** Vue safe : jamais le paquet d'enchères, ni le programme FUTUR du match.
 * Les infos nécessaires au client : score, séquence courante, résultat,
 * statistiques et historique déjà joué.
 */
export function matchPublicView(state){
 const view=publicView(state);
 if(view.match){
  delete view.match.schedule;
  view.match.currentMoment=currentMatchMoment(state);
 }
 return view;
}
