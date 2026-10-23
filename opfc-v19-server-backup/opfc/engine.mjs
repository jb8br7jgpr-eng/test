/** Moteur d'enchères et de compositions OPMercato FC v0.8 — commun local/serveur. */
import { CARDS,CLUBS,CARD_BY_ID } from './catalog.mjs';
import { formationPositions } from './rules.mjs';
import {chooseClubPair} from './club-identities.mjs';
const START_BUDGET=250,MIN_BID=5,MAX_REFUSALS=5,ROSTER_SIZE=7;
const fail=message=>{throw new Error(message);};
const drawRng=rng=>{const n=rng();if(!Number.isFinite(n)||n<0||n>=1)fail('PRNG invalide');return n;};
const shuffle=(items,rng)=>{const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(drawRng(rng)*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const clone=state=>structuredClone(state);
const checkClub=(state,id)=>{const n=state.teams.findIndex(x=>x.club===id);if(n<0)fail('Club inconnu');return n;};
const complete=p=>p.roster.length>=ROSTER_SIZE;
const record=(s,msg)=>{s.history.push(msg);};
export const maxBid = team => complete(team)?0:team.budget-MIN_BID*(ROSTER_SIZE-team.roster.length-1);
function nextCard(s){
  if(s.teams.every(complete)){
    s.phase='lineup';s.auction=null;s.teams.forEach(t=>t.ready=false);return;
  }
  if(s.cursor>=s.deck.length)fail('Réserve de personnages épuisée');
  const cardId=s.deck[s.cursor++];
  const priority=s.nextPriority;
  s.nextPriority=1-priority;
  const current=complete(s.teams[priority])?1-priority:priority;
  s.auction={cardId,priority:s.teams[priority].club,turn:s.teams[current].club,highestBid:0,highestClub:null,passed:[],offered:[],king:null,solo:s.teams.filter(x=>!complete(x)).length===1};
  record(s,{kind:'new-card',cardId,priority:s.teams[priority].club});
}
function closeCard(s,reason){
  const a=s.auction;
  if(a.highestClub){
    const owner=s.teams[checkClub(s,a.highestClub)];
    if(complete(owner)||owner.budget<a.highestBid)fail('Achat impossible');
    owner.budget-=a.highestBid;
    owner.roster.push(a.cardId);
  }
  s.lastResult={cardId:a.cardId,winner:a.highestClub,price:a.highestBid,reason};
  record(s,{kind:'auction-end',...s.lastResult});
  nextCard(s);
}
function advanceAfterAction(s,actor){
  const a=s.auction,other=s.teams[1-checkClub(s,actor)].club;
  if(a.highestClub && a.passed.includes(other)){closeCard(s,'withdrawn');return;}
  if(!a.highestClub && a.passed.length===2){closeCard(s,'unsold');return;}
  a.turn=other;
  const otherTeam=s.teams[checkClub(s,other)];
  if(complete(otherTeam)||maxBid(otherTeam)<Math.max(MIN_BID,a.highestBid+1)){
    if(a.highestClub)closeCard(s,'opponent-unable-to-bid');
    else if(a.passed.includes(other))closeCard(s,'unsold');
    else {a.passed.push(other);closeCard(s,'unavailable');}
  }
}
export function createGame({firstClub='PSG',rng=Math.random,deck=null,dice=null,clubChoices=null}={}){
  if(!CLUBS.some(c=>c.id===firstClub))fail('Club inconnu');
  const other=CLUBS.find(c=>c.id!==firstClub).id;
  const identities=clubChoices?chooseClubPair(clubChoices.PSG,clubChoices.OM):chooseClubPair();
  const rolls=dice||(()=>{let r;do{r=[1+Math.floor(drawRng(rng)*6),1+Math.floor(drawRng(rng)*6)];}while(r[0]===r[1]);return r;})();
  if(rolls.length!==2||rolls.some(x=>!Number.isInteger(x)||x<1||x>6)||rolls[0]===rolls[1])fail('Dés de départ invalides');
  const pool=deck?[...deck]:shuffle(CARDS.map(c=>c.id),rng);
  if((pool.length!==CARDS.length && !(deck && pool.length===50)) || new Set(pool).size!==pool.length||pool.some(id=>!CARD_BY_ID.has(id)))fail('Paquet invalide');
  const s={version:1,phase:'mercato',teams:[firstClub,other].map(club=>({club,identityId:identities[club],budget:START_BUDGET,refusals:0,roster:[],formation:'2-2-2',slots:Array(7).fill(null),ready:false,hakis:{observation:false,kings:false}})),dice:rolls,nextPriority:rolls[0]>rolls[1]?0:1,deck:pool,cursor:0,auction:null,lastResult:null,history:[]};
  nextCard(s);
  return s;
}
function requireAuction(s,club){if(s.phase!=='mercato'||!s.auction)fail('Aucune enchère en cours');checkClub(s,club);return s.auction;}
function requireTurn(s,club){const a=requireAuction(s,club);if(a.turn!==club)fail('Ce n’est pas ton tour');if(a.solo)fail('Carte à prix fixe : recrue seule');if(a.passed.includes(club))fail('Tu as déjà passé');return a;}
export function bid(state,club,amount){
  const s=clone(state),a=requireTurn(s,club),t=s.teams[checkClub(s,club)];
  if(!Number.isInteger(amount)||amount<Math.max(MIN_BID,a.highestBid+1)||amount>maxBid(t))fail('Mise illégale');
  if(a.king && a.king.phase==='open' && a.king.holder!==club)fail('Le Haki des Rois exige l’offre du détenteur');
  if(a.king && a.king.phase==='reply' && a.king.holder===club)fail('Réponse adverse attendue');
  if(a.king && a.king.phase==='last' && a.king.holder!==club)fail('Dernière offre réservée au Haki des Rois');
  a.highestBid=amount;a.highestClub=club;
  if(!a.offered.includes(club))a.offered.push(club);
  record(s,{kind:'bid',club,amount});
  if(a.king){
    if(a.king.phase==='open')a.king.phase='reply';
    else if(a.king.phase==='reply')a.king.phase='last';
    else if(a.king.phase==='last'){closeCard(s,'king-final-bid');return s;}
  }
  advanceAfterAction(s,club);
  return s;
}
export function pass(state,club){
  const s=clone(state),auction=requireAuction(s,club);
  if(auction.solo){
    const team=s.teams[checkClub(s,club)];
    if(auction.turn!==club||complete(team))fail('Recrutement solo indisponible');
    if(team.refusals>=MAX_REFUSALS)fail('Les cinq refus sont épuisés : recrutement obligatoire');
    team.refusals++;
    auction.passed.push(club);
    record(s,{kind:'pass',club,cost:1,solo:true});
    closeCard(s,'solo-refused');
    return s;
  }
  const a=requireTurn(s,club),team=s.teams[checkClub(s,club)];
  if(a.king?.holder===club&&a.king.phase==='open')fail('L’ouverture avec le Haki des Rois est obligatoire');
  // Dès qu'une enchère existe, tout joueur peut passer sans consommer de refus.
  const minimum=Math.max(MIN_BID,a.highestBid+1);
  const charged=a.highestBid===0&&maxBid(team)>=minimum;
  if(charged){
    if(team.refusals>=MAX_REFUSALS)fail('Les cinq refus sans enchère sont épuisés');
    team.refusals++;
  }
  if(!a.passed.includes(club))a.passed.push(club);
  record(s,{kind:'pass',club,cost:charged?1:0});
  if(a.king && a.king.phase==='last' && a.king.holder===club){closeCard(s,'king-no-final-bid');return s;}
  if(a.highestClub){closeCard(s,'withdrawn');return s;}
  advanceAfterAction(s,club);
  return s;
}
export function useKings(state,club){
  const s=clone(state),a=requireTurn(s,club),team=s.teams[checkClub(s,club)];
  if(team.hakis.kings||a.offered.length||a.passed.length||a.highestBid>0||a.priority!==club)fail('Haki des Rois indisponible');
  a.king={holder:club,phase:'open'};team.hakis.kings=true;
  record(s,{kind:'kings',club});return s;
}
export function useObservation(state,club){
  const s=clone(state);requireAuction(s,club);
  const team=s.teams[checkClub(s,club)];
  if(team.hakis.observation)fail('Observation déjà utilisée');
  team.hakis.observation=true;
  const peek=s.deck.slice(s.cursor,s.cursor+5);
  record(s,{kind:'observation',club});
  return {state:s,peek};
}
export function acceptSolo(state,club){
  const s=clone(state),a=requireAuction(s,club);
  if(!a.solo || s.teams[checkClub(s,club)].roster.length>=ROSTER_SIZE||a.turn!==club)fail('Achat seul indisponible');
  a.highestBid=MIN_BID;a.highestClub=club;
  closeCard(s,'solo-fixed-price');return s;
}
function allowLineupChange(s,club){
  const t=s.teams[checkClub(s,club)];
  if(!['mercato','lineup','half-time'].includes(s.phase))fail('Composition verrouillée');
  if(s.phase==='mercato' && s.auction && (s.auction.king?.phase==='reply'||s.auction.king?.phase==='last'))fail('Duel de Haki en cours');
  t.ready=false;return t;
}
/**
 * Répartit les titulaires déjà posés vers la nouvelle formation sans vider
 * le terrain : priorité au poste naturel, puis à la ligne occupée, enfin
 * au maintien d'emplacement. Deterministe, au plus 7! essais.
 * Compatible avec les formations partielles pendant le mercato.
 */
export function chooseFormation(state,club,name){
  const s=clone(state),t=allowLineupChange(s,club);
  const nextPositions=formationPositions(name);
  if(t.formation===name)return s;
  const priorPositions=formationPositions(t.formation);
  const players=t.slots.map((id,index)=>({id,index})).filter(p=>p.id);
  let bestScore=-Infinity,bestSlots=null;
  const slots=Array(7).fill(null);
  function allocate(n,used,score){
    if(n===players.length){
      if(score>bestScore){bestScore=score;bestSlots=[...slots];}
      return;
    }
    const p=players[n];
    const natural=CARD_BY_ID.get(p.id)?.position;
    for(let dest=0;dest<7;dest++){
      if(used&(1<<dest))continue;
      const value=(natural===nextPositions[dest]?300:0)+
       (priorPositions[p.index]===nextPositions[dest]?35:0)+
       (p.index===dest?8:0)+Math.max(0,6-Math.abs(dest-p.index));
      slots[dest]=p.id;
      allocate(n+1,used|(1<<dest),score+value);
      slots[dest]=null;
    }
  }
  allocate(0,0,0);
  t.formation=name;
  t.slots=bestSlots??Array(7).fill(null);
  return s;
}
export function place(state,club,cardId,slot){
  const s=clone(state),t=allowLineupChange(s,club);
  if(!t.roster.includes(cardId))fail('Ce personnage ne fait pas partie de ton club');
  if(!Number.isInteger(slot)||slot<0||slot>=7)fail('Case de terrain inconnue');
  const old=t.slots.indexOf(cardId);
  if(old===slot)return s;
  const displaced=t.slots[slot];
  t.slots[slot]=cardId;
  if(old>=0)t.slots[old]=displaced;
  return s;
}
export function ready(state,club){
  const s=clone(state);
  if(!['lineup','half-time'].includes(s.phase))fail('Équipe prête impossible dans cette phase');
  const t=s.teams[checkClub(s,club)];
  if(!complete(t)||t.slots.some(id=>!id)||new Set(t.slots).size!==7||t.slots.some(id=>!t.roster.includes(id)))fail('Composition incomplète');
  t.ready=true;
  if(s.teams.every(t=>t.ready))s.phase=s.phase==='lineup'?'kickoff-ready':'resume-ready';
  return s;
}
export function publicView(state){
  const {deck,cursor,onlinePrivate, ...visible}=state;
  return clone(visible);
}
