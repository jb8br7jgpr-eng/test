/** Règles arithmétiques officielles OPMercato FC v0.8 (§03–05, §15–18). */
import { CARD_BY_ID } from './catalog.mjs?v=opfc-75-roster-20261022';

export const POSITIONS = Object.freeze(['GAR','DEF','MIL','ATT']);
export const FORMATIONS = Object.freeze({
  '2-2-2': [1,2,2,2],
  '2-3-1': [1,2,3,1],
  '1-2-3': [1,1,2,3],
  '3-2-1': [1,3,2,1],
  '1-3-2': [1,1,3,2],
  '2-1-3': [1,2,1,3],
  '3-1-2': [1,3,1,2],
});
const WEIGHTS = Object.freeze({
  ATT: {PUI:25,TEC:30,PAS:10,VIT:30,DEF:5,GAR:0},
  MIL: {PUI:10,TEC:30,PAS:35,VIT:15,DEF:10,GAR:0},
  DEF: {PUI:20,TEC:5,PAS:10,VIT:15,DEF:50,GAR:0},
  GAR: {PUI:5,TEC:0,PAS:5,VIT:0,DEF:10,GAR:80},
});
const RATING_PENALTY = Object.freeze({
  GAR:{GAR:0,DEF:12,MIL:12,ATT:12},
  DEF:{GAR:5,DEF:0,MIL:8,ATT:14},
  MIL:{GAR:5,DEF:8,MIL:0,ATT:8},
  ATT:{GAR:5,DEF:14,MIL:8,ATT:0},
});
const clamp=(x,low,high)=>Math.max(low,Math.min(high,x));
const cardRef = card => typeof card==='string' ? CARD_BY_ID.get(card) : card;
function assertCard(card){const ref=cardRef(card);if(!ref)throw new Error('Personnage inconnu');return ref;}
export function rawPositionRating(card,position){
  const ref=assertCard(card),weights=WEIGHTS[position];if(!weights)throw new Error('Poste inconnu');
  return Math.round(Object.entries(weights).reduce((sum,[stat,w])=>sum+ref.stats[stat]*w,0)/100);
}
export function effectiveRating(card,position){
  const ref=assertCard(card);
  if(!RATING_PENALTY[ref.position]?.hasOwnProperty(position))throw new Error('Poste inconnu');
  return Math.max(0,rawPositionRating(ref,position)-RATING_PENALTY[ref.position][position]);
}
export function matchStats(card,position){
  const ref=assertCard(card);
  if(!POSITIONS.includes(position))throw new Error('Poste inconnu');
  let penalty=0;
  if(ref.position!==position){
    if(ref.position==='GAR')penalty=7;
    else if(position==='GAR')penalty=4;
    else if((ref.position==='ATT'&&position==='DEF')||(ref.position==='DEF'&&position==='ATT'))penalty=8;
    else penalty=5;
  }
  return Object.fromEntries(Object.entries(ref.stats).map(([k,v])=>[k,Math.max(0,v-penalty)]));
}
export function formationPositions(name){
  const def=FORMATIONS[name];if(!def)throw new Error('Formation inconnue');
  return def.flatMap((count,index)=>Array.from({length:count},()=>POSITIONS[index]));
}
export function chemistry(ids){
  const counts=new Map();
  for(const id of ids){const group=assertCard(id).group;counts.set(group,(counts.get(group)||0)+1);}
  const score=[0,0,2,4,6,6,8,10];
  return Math.min(10,[...counts.values()].reduce((v,n)=>v+score[n],0));
}
export function chemistryAdvantage(ourIds,theirIds){return (chemistry(ourIds)-chemistry(theirIds))/2;}
export function lineupDetails(team){
  const positions=formationPositions(team.formation);
  const slots=team.slots||[];
  return slots.map((id,index)=>id?({cardId:id,position:positions[index],rating:effectiveRating(id,positions[index]),outOfPosition:CARD_BY_ID.get(id).position!==positions[index],stats:matchStats(id,positions[index])}):null);
}
export function collectiveStrength(team){
  const players=lineupDetails(team).filter(Boolean).filter(p=>p.position!=='GAR');
  if(players.length!==6)throw new Error('Six joueurs de champ requis');
  return players.reduce((sum,p)=>sum+p.rating,0)/6;
}
export function attackingProbability(a,b){return clamp(50+collectiveStrength(a)-collectiveStrength(b),40,60);}
export function buildSchedule(teamA,teamB,rng=Math.random){
  const draw=()=>{const x=rng();if(!Number.isFinite(x)||x<0||x>=1)throw new Error('PRNG invalide');return x;};
  const count=10+Math.floor(draw()*3);
  const pA=attackingProbability(teamA,teamB)/100;
  for(let tries=0;tries<50000;tries++){
    const minutes=new Set();while(minutes.size<count){const t=1+Math.floor(draw()*88);minutes.add(t<=44?t:t+1);}
    const sorted=[...minutes].sort((a,b)=>a-b);
    const types=()=>{const x=draw();return x<.70?'open':x<.85?'corner':x<.95?'free-kick':'penalty';};
    const out=sorted.map(minute=>({minute,period:minute<45?1:2,attacker:draw()<pA?'PSG':'OM',type:types()}));
    const countFor=(club,period)=>out.filter(e=>e.attacker===club&&(period==null||e.period===period)).length;
    if(['PSG','OM'].every(c=>countFor(c,null)>=3&&countFor(c,1)>=1&&countFor(c,2)>=1))return out;
  }
  throw new Error('Calendrier impossible à générer');
}
