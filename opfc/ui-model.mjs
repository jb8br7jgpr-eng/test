/** OPFC v0.8 — modèles d'affichage sans mutation des règles officielles. */
import {CARD_BY_ID} from './catalog.mjs?v=opfc-75-roster-20261022';
import {formationPositions,effectiveRating,chemistry,lineupDetails} from './rules.mjs?v=opfc-75-roster-20261022';
import {maxBid} from './engine.mjs?v=opfc-75-roster-20261022';
import {visualName} from './club-identities.mjs';

const other=id=>id==='PSG'?'OM':'PSG';
export const FORMATION_NAMES=Object.freeze(['2-2-2','2-3-1','1-2-3','3-2-1','1-3-2','2-1-3','3-1-2']);
export function uiAuction(state){
 if(state?.phase!=='mercato'||!state.auction)return null;
 const a=state.auction,team=state.teams.find(t=>t.club===a.turn);
 if(!team)throw Error('Club enchérisseur introuvable');
 const minimum=Math.max(5,a.highestBid+1);
 const maximum=maxBid(team);
 const everOffered=a.offered.includes(team.club);
 const canBid=!a.solo&&maximum>=minimum&&!a.passed.includes(team.club);
 // Dès la première offre (même adverse), passer est gratuit, même à 5/5 refus.
 const canPass=a.solo?team.refusals<5:
   (!a.king||a.king.holder!==team.club||a.king.phase!=='open')&&
   (a.highestBid>0||team.refusals<5||maximum<minimum);
 const canKings=!a.solo&&!team.hakis.kings&&a.priority===team.club&&
   a.highestBid===0&&a.offered.length===0&&a.passed.length===0&&!a.king;
 return {auction:a,team,card:CARD_BY_ID.get(a.cardId),minimum,maximum,
  canBid,canPass,canKings,canObserve:!team.hakis.observation,everOffered};
}
export function uiTeam(team){
 const players=lineupDetails(team);
 const positions=formationPositions(team.formation);
 const occupied=team.slots.filter(Boolean);
 return {
  club:team.club,formation:team.formation,rosterCount:team.roster.length,
  budget:team.budget,refusals:team.refusals,
  entente:occupied.length?chemistry(occupied):0,
  lineup:positions.map((position,i)=>{
   const info=players[i];
   return {slot:i,position,cardId:info?.cardId??null,
    card:info?CARD_BY_ID.get(info.cardId):null,
    rating:info?.rating??null,outOfPosition:info?.outOfPosition??false};
  }),
  bench:team.roster.filter(id=>!team.slots.includes(id)).map(id=>CARD_BY_ID.get(id)),
  canReady:team.roster.length===7&&players.length===7&&players.every(Boolean)&&
   new Set(occupied).size===7&&!team.ready,
  ready:team.ready,
 };
}
/**
 * Liste d'effectif par POSTE EFFECTIVEMENT OCCUPÉ sur cette partie.
 * La fiche du catalogue ne sert ni au tri ni à déterminer le poste joué.
 * Les recrues encore sans case figurent après les joueurs placés et sont
 * clairement marquées "À placer" (pas de fausse note effective).
 */
export function uiRoster(team){
 const playing=new Map(lineupDetails(team).filter(Boolean).map(player=>[player.cardId,player]));
 const order={GAR:0,DEF:1,MIL:2,ATT:3};
 return team.roster.map(id=>{
  const player=playing.get(id)??null;
  return {
   cardId:id,card:CARD_BY_ID.get(id),
   position:player?.position??null,
   rating:player?.rating??null,
   outOfPosition:player?.outOfPosition??false,
   placed:!!player
  };
 }).sort((a,b)=>(order[a.position]??4)-(order[b.position]??4));
}

export function cardStats(card){
 if(!card)throw Error('Carte introuvable');
 return ['PUI','TEC','PAS','VIT','DEF','GAR'].map(key=>({label:key,value:card.stats[key]}));
}
export function currentAuctionEnding(before,after){
 return after.history.length>before.history.length&&
  after.history.slice(before.history.length).some(e=>e.kind==='auction-end')?
   after.lastResult:null;
}
export function clubName(id){return visualName(id);}
export function opponent(id){return other(id);}
