/**
 * OPFC v0.8 §32B : départage aux tirs au but, après un score égal à 90'.
 * Module pur et déterministe. Un contrôleur local/serveur collecte secrètement
 * les DEUX directions avant d'appeler applyShootoutKick.
 * Score et statistiques de séance sont séparés du temps réglementaire.
 */
import {CARDS} from './catalog.mjs?v=opfc-75-roster-20261022';
import {lineupDetails} from './rules.mjs?v=opfc-match-balance-20261025';
import {calculatePenalty,resolvePenalty,averagePenaltyGoal} from './penalty.mjs?v=opfc-match-balance-20261025';

const CLUBS=Object.freeze(['PSG','OM']);
const catalogueOrder=new Map(CARDS.map((card,index)=>[card.id,index]));
const other=club=>club==='PSG'?'OM':'PSG';
const fail=text=>{throw Error(text);};
const validateDraw=n=>{
 if(typeof n!=='number'||!Number.isFinite(n)||n<0||n>=1)fail('Lancer de pièce invalide');
 return n;
};
function lineupAtNinety(team){
 const players=lineupDetails(team);
 if(players.length!==7||players.some(x=>!x))fail('Sept titulaires obligatoires');
 if(new Set(players.map(p=>p.cardId)).size!==7)fail('Doublons de titulaires');
 if(players.filter(p=>p.position==='GAR').length!==1)fail('Un gardien de terrain obligatoire');
 return players.map(p=>({
  cardId:p.cardId,position:p.position,
  stats:{TEC:p.stats.TEC,PUI:p.stats.PUI,GAR:p.stats.GAR}
 }));
}
function keeperOf(players){
 const p=players.find(x=>x.position==='GAR');
 return {cardId:p.cardId,stats:{GAR:p.stats.GAR}};
}
/** Classement immuable sur la probabilité moyenne de marquer contre
 * le gardien adverse à la 90', puis TEC, PUI et ordre des 50 cartes. */
export function rankShootoutShooters(team,opponentKeeper){
 const players=lineupAtNinety(team);
 const ranking=players.map(p=>({
  cardId:p.cardId,position:p.position,
  stats:{TEC:p.stats.TEC,PUI:p.stats.PUI},
  averageGoal:averagePenaltyGoal(p,opponentKeeper)
 }));
 ranking.sort((a,b)=>
   b.averageGoal-a.averageGoal||
   b.stats.TEC-a.stats.TEC||
   b.stats.PUI-a.stats.PUI||
   catalogueOrder.get(a.cardId)-catalogueOrder.get(b.cardId)
 );
 return ranking;
}
/** Le lancer de pièce attribue seulement le premier tir; aucun bonus sportif.
 * Pas de prolongation et aucune mutation de composition après 90 minutes. */
export function createShootout({psg,om,regulationScore,coinDraw}={}){
 if(!regulationScore||CLUBS.some(c=>!Number.isInteger(regulationScore[c])||regulationScore[c]<0)||
   regulationScore.PSG!==regulationScore.OM)fail('Séance réservée à une égalité à 90 minutes');
 const firstClub=validateDraw(coinDraw)<.5?'PSG':'OM';
 const psgPlayers=lineupAtNinety(psg),omPlayers=lineupAtNinety(om);
 if(new Set([...psgPlayers,...omPlayers].map(x=>x.cardId)).size!==14)
   fail('Les deux clubs doivent avoir 14 titulaires distincts');
 const keepers={PSG:keeperOf(psgPlayers),OM:keeperOf(omPlayers)};
 return {
  version:1,phase:'active',stage:'first-five',winner:null,firstClub,nextClub:firstClub,
  regulationScore:{PSG:regulationScore.PSG,OM:regulationScore.OM},
  score:{PSG:0,OM:0}, attempts:{PSG:[],OM:[]},timeline:[],
  keepers,orders:{
   PSG:rankShootoutShooters(psg,keepers.OM),
   OM:rankShootoutShooters(om,keepers.PSG)
  }
 };
}
/** Retourne le prochain tireur; le 8e reprend le premier du classement. */
export function nextShootoutShooter(state){
 if(state?.phase!=='active'||!CLUBS.includes(state.nextClub))return null;
 const club=state.nextClub;
 const count=state.attempts?.[club]?.length;
 if(!Number.isInteger(count)||count<0)fail('Historique de séance invalide');
 const entry=state.orders?.[club]?.[count%7];
 if(!entry)fail('Ordre des tireurs absent');
 return Object.freeze({club,shotNumber:count+1,round:Math.floor(count/7)+1,cardId:entry.cardId});
}
function settled(s){
 const nP=s.attempts.PSG.length,nO=s.attempts.OM.length;
 const remainingP=Math.max(0,5-nP),remainingO=Math.max(0,5-nO);
 // Arrêt immédiat dès qu'un rattrapage est mathématiquement impossible.
 if(nP<=5&&nO<=5 &&
   (s.score.PSG>s.score.OM+remainingO || s.score.OM>s.score.PSG+remainingP))return true;
 // Au-delà de cinq tentatives, on ne départage qu'après une PAIRE complète.
 if(nP>=5&&nO>=5&&nP===nO){
   if(s.score.PSG!==s.score.OM)return true;
   s.stage='sudden-death';
 }
 return false;
}
/** Une action authentifiée : le serveur valide joueur et ordre, puis appelle
 * ceci APRES réception des directions secrètes des deux adversaires. */
export function applyShootoutKick(state,{club,shooterId,shotDirection,keeperDirection,draw}={}){
 if(state?.phase!=='active')fail('Séance terminée ou inexistante');
 if(!CLUBS.includes(club)||state.nextClub!==club)fail('Ce club ne tire pas maintenant');
 const pick=nextShootoutShooter(state);
 if(shooterId!==pick.cardId)fail('Tireur différent de l’ordre officiel');
 const shooter=state.orders[club][state.attempts[club].length%7];
 const goalkeeper=state.keepers[other(club)];
 const probabilities=calculatePenalty({
  taker:shooter,keeper:goalkeeper,shotDirection,keeperDirection
 });
 const result=resolvePenalty(probabilities,draw);
 const s=structuredClone(state);
 const attempt={
  club,shotNumber:s.attempts[club].length+1,shooterId,keeperId:goalkeeper.cardId,
  shotDirection,keeperDirection,result:result.outcome,scored:result.isGoal,
  probabilities
 };
 s.attempts[club].push(attempt);
 s.timeline.push(attempt);
 if(result.isGoal)s.score[club]++;
 if(settled(s)){
  s.phase='finished';
  s.winner=s.score.PSG>s.score.OM?'PSG':'OM';
  s.nextClub=null;
 }else{
  s.nextClub=other(club);
 }
 return s;
}
