/**
 * Laboratoire Penaltys / TAB OPFC — modèle 100 % mémoire, sans persistance.
 * Réutilise STRICTEMENT les calculateurs sportifs et l'ordre officiel des TAB.
 */
import {CARDS, CARD_BY_ID} from './catalog.mjs';
import {formationPositions, lineupDetails} from './rules.mjs';
import {calculatePenalty, resolvePenalty, PENALTY_DIRECTIONS} from './penalty.mjs';
import {createShootout, nextShootoutShooter, applyShootoutKick} from './shootout.mjs';

export const LAB_POSITIONS=Object.freeze(formationPositions('2-2-2'));
export const LAB_SLOTS=Object.freeze(['PSG','OM']);
export const LAB_OUTCOMES=Object.freeze(['engine','goal','save','miss']);
const other=club=>club==='PSG'?'OM':'PSG';
const ensure=(yes,message)=>{if(!yes)throw Error(message);};

export function defaultLineups(){
 const used=new Set();
 return Object.fromEntries(LAB_SLOTS.map(club=>[club,LAB_POSITIONS.map(position=>{
  const available=CARDS.filter(c=>c.position===position&&!used.has(c.id))
   .sort((a,b)=>b.rating-a.rating||a.name.localeCompare(b.name,'fr'));
  ensure(available.length>0,'Personnages insuffisants');
  const chosen=available[0].id;
  used.add(chosen);
  return chosen;
 })]));
}
export function validateLineups(lineups){
 ensure(lineups&&typeof lineups==='object','Compositions absentes');
 const taken=new Set();
 for(const club of LAB_SLOTS){
  const slots=lineups[club];
  ensure(Array.isArray(slots)&&slots.length===LAB_POSITIONS.length,'Composition incomplète : '+club);
  for(let i=0;i<slots.length;i++){
   const card=CARD_BY_ID.get(slots[i]);
   ensure(!!card,'Personnage invalide : '+club);
   ensure(card.position===LAB_POSITIONS[i],'Poste invalide : '+card.name);
   ensure(!taken.has(card.id),'Personnage en doublon : '+card.name);
   taken.add(card.id);
  }
 }
 return true;
}
export function asTeams(lineups){
 validateLineups(lineups);
 return LAB_SLOTS.map(club=>({
  club,formation:'2-2-2',slots:[...lineups[club]],
  roster:[...lineups[club]],ready:true
 }));
}
function findPlayer(teams,club,id){
 const actor=lineupDetails(teams.find(t=>t.club===club)).find(p=>p?.cardId===id);
 ensure(!!actor,'Personnage non titulaire : '+id);
 return actor;
}
function forcedDraw(calculation,outcome){
 const miss=calculation.missProbability/100;
 const save=calculation.saveProbability/100;
 if(outcome==='miss')return miss/2;
 if(outcome==='save')return miss+save/2;
 if(outcome==='goal')return miss+save+(1-miss-save)/2;
 throw Error('Résultat forcé inconnu');
}
export function createLabSession({type='penalty',lineups=defaultLineups(),attacker='PSG',firstClub='PSG'}={}){
 ensure(['penalty','shootout'].includes(type),'Mode de test invalide');
 ensure(LAB_SLOTS.includes(attacker)&&LAB_SLOTS.includes(firstClub),'Club invalide');
 const teams=asTeams(lineups);
 const shootout=type==='shootout'?createShootout({
  psg:teams[0],om:teams[1],regulationScore:{PSG:0,OM:0},
  coinDraw:firstClub==='PSG'?0.25:0.75
 }):null;
 return {type,teams,attacker,shootout};
}
export function labTurn(session,{shooterId}={}){
 if(session.type==='shootout'){
  const pick=nextShootoutShooter(session.shootout);
  if(!pick)return null;
  return {club:pick.club,shooterId:pick.cardId,
   keeperId:session.shootout.keepers[other(pick.club)].cardId,
   shotNumber:pick.shotNumber,round:pick.round};
 }
 const club=session.attacker;
 return {club,shooterId:shooterId??session.teams.find(t=>t.club===club).slots[5],
  keeperId:session.teams.find(t=>t.club===other(club)).slots[0],
  shotNumber:1,round:1};
}
/** Retourne un résultat PRÉPARÉ ; la séance n'avance qu'à commitLabKick(). */
export function prepareLabKick(session,{shotDirection,keeperDirection,mode='engine',shooterId,rng=Math.random}={}){
 ensure(PENALTY_DIRECTIONS.includes(shotDirection)&&PENALTY_DIRECTIONS.includes(keeperDirection),
  'Direction invalide');
 ensure(LAB_OUTCOMES.includes(mode),'Mode de résolution invalide');
 const turn=labTurn(session,{shooterId});
 ensure(!!turn,'Séance terminée');
 const attacker=findPlayer(session.teams,turn.club,turn.shooterId);
 const keeper=findPlayer(session.teams,other(turn.club),turn.keeperId);
 const calc=calculatePenalty({taker:attacker,keeper,shotDirection,keeperDirection});
 const draw=mode==='engine'?rng():forcedDraw(calc,mode);
 ensure(Number.isFinite(draw)&&draw>=0&&draw<1,'Tirage invalide');
 if(session.type==='shootout'){
  const next=applyShootoutKick(session.shootout,{
   club:turn.club,shooterId:turn.shooterId,shotDirection,keeperDirection,draw
  });
  const attempt=next.timeline.at(-1);
  return {attempt:{...attempt,outcome:attempt.result},nextShootout:next};
 }
 const result=resolvePenalty(calc,draw);
 return {attempt:{
  ...turn,shotDirection,keeperDirection,outcome:result.outcome,
  result:result.outcome,scored:result.isGoal,probabilities:calc
 },nextShootout:null};
}
export function commitLabKick(session,prepared){
 ensure(prepared&&prepared.attempt,'Tentative manquante');
 if(session.type==='penalty')return session;
 ensure(prepared.nextShootout&&prepared.nextShootout.timeline.length===session.shootout.timeline.length+1,
  'Progression de séance invalide');
 return {...session,shootout:prepared.nextShootout};
}
/** Les coordonnées sont exprimées depuis le tireur, face au but. */
export function trajectoryFor({shotDirection,keeperDirection,outcome}){
 ensure(PENALTY_DIRECTIONS.includes(shotDirection)&&PENALTY_DIRECTIONS.includes(keeperDirection),
  'Direction de trajectoire invalide');
 ensure(['goal','save','miss'].includes(outcome),'Issue de trajectoire invalide');
 const x={GAUCHE:30,CENTRE:50,DROITE:70};
 const keeperX={GAUCHE:30,CENTRE:50,DROITE:70}[keeperDirection];
 let ballX=x[shotDirection],ballY=20;
 if(outcome==='save'){
  ballX=keeperX;
  ballY=29;
 }else if(outcome==='miss'){
  ballX=shotDirection==='GAUCHE'?7:shotDirection==='DROITE'?93:50;
  ballY=shotDirection==='CENTRE'?4:17;
 }else if(shotDirection===keeperDirection){
  ballX+=shotDirection==='DROITE'?-7:7;
 }
 return Object.freeze({ballX,ballY,keeperX});
}
