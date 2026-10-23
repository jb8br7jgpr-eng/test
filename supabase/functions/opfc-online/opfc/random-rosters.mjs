/**
 * OPFC — option Équipes aléatoires. Le moteur classique des enchères reste inchangé.
 * Sept titulaires à leur poste préféré par équipe ; tirage intercalé et sans doublon.
 */
import {CARDS} from './catalog.mjs';
import {formationPositions} from './rules.mjs';
const RARITIES=Object.freeze({BRZ:30,ARG:30,OR:30,DIA:10});
const POSITIONS=['GAR','DEF','MIL','ATT'];
function draw(rng){
 const x=rng();
 if(!Number.isFinite(x)||x<0||x>=1)throw Error('Tirage aléatoire invalide');
 return x;
}
export function generateRandomTeams(base,formations,{rng=Math.random}={}){
 if(base?.version!==1||base.phase!=='mercato'||!Array.isArray(base.teams)||
  base.teams.length!==2||base.teams.some(t=>t.roster.length||t.slots.some(Boolean)))
  throw Error('Une nouvelle partie est nécessaire pour tirer les équipes');
 if(!formations||Object.keys(formations).sort().join(',')!=='OM,PSG')
  throw Error('Formations des deux joueurs manquantes');
 const positions=Object.fromEntries(['PSG','OM'].map(club=>{
  const name=formations[club];
  const slots=formationPositions(name);
  if(slots.length!==7||!slots.every(p=>POSITIONS.includes(p)))throw Error('Formation invalide');
  return [club,slots];
 }));
 const state=structuredClone(base);
 const taken=new Set(),order=[];
 // Un seul tirage par emplacement. Toute rareté épuisée est retirée
 // de la distribution avant de lancer le dé de rareté.
 const drawPlayer=(pos)=>{
  const available=CARDS.filter(c=>c.position===pos&&!taken.has(c.id));
  if(!available.length)throw Error('Effectif insuffisant au poste '+pos);
  const families=Object.entries(RARITIES).map(([rarity,weight])=>
   ({rarity,weight,players:available.filter(c=>c.rarity===rarity)}))
   .filter(f=>f.players.length);
  const total=families.reduce((n,f)=>n+f.weight,0);
  let chance=draw(rng)*total;
  let family=families[families.length-1];
  for(const next of families){chance-=next.weight;if(chance<0){family=next;break;}}
  const player=family.players[Math.floor(draw(rng)*family.players.length)];
  taken.add(player.id);
  return player.id;
 };
 // Alterner les deux équipes, tout en respectant chacune sa formation.
 for(let slot=0;slot<7;slot++){
  for(const club of slot%2===0?['PSG','OM']:['OM','PSG']){
   const id=drawPlayer(positions[club][slot]);
   const team=state.teams.find(t=>t.club===club);
   team.slots[slot]=id;team.roster.push(id);
   order.push({club,slot,cardId:id});
  }
 }
 state.phase='lineup';
 state.auction=null;
 state.lastResult=null;
 state.recruitmentMode='random';
 state.randomRevealOrder=order;
 state.randomReveal={step:0,ready:{PSG:false,OM:false}};
 for(const team of state.teams){
  team.formation=formations[team.club];
  team.ready=false;
 }
 return state;
}
