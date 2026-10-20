/** OPMercato FC v0.8 — attribution reproductible des rôles, §21.
 * Le serveur (ou le moteur local) effectue ces tirages AVANT les choix secrets.
 * Ce module ne tire ni les stratégies ni les résultats des duels.
 */
import {lineupDetails} from './rules.mjs';

export const ROLE_WEIGHTS=Object.freeze({
  carrier:Object.freeze({ATT:3,MIL:5,DEF:1}),
  partner:Object.freeze({ATT:5,MIL:3,DEF:1}),
  defender:Object.freeze({ATT:1,MIL:2,DEF:5}),
});
const validDraw=(rng)=>{
  if(typeof rng!=='function')throw new Error('Générateur invalide');
  const n=rng();
  if(typeof n!=='number'||!Number.isFinite(n)||n<0||n>=1)throw new Error('Tirage invalide');
  return n;
};
function playersOnField(team){
  if(!team||typeof team!=='object')throw new Error('Équipe manquante');
  const players=lineupDetails(team);
  if(players.length!==7||players.some(p=>!p))throw new Error('Composition complète requise');
  const ids=players.map(p=>p.cardId);
  if(new Set(ids).size!==7)throw new Error('Doublon dans la composition');
  const result=players.map((p,index)=>Object.freeze({
    cardId:p.cardId,position:p.position,slot:index,stats:Object.freeze({...p.stats})
  }));
  if(result.filter(p=>p.position==='GAR').length!==1)throw new Error('Un gardien obligatoire');
  return result;
}
function weightedPick(players,role,excludeIds,rng){
  const weights=ROLE_WEIGHTS[role];
  if(!weights)throw new Error('Rôle inconnu');
  if(!Array.isArray(excludeIds))throw new Error('Exclusions invalides');
  const excluded=new Set(excludeIds);
  const pool=players.filter(p=>p.position!=='GAR'&&!excluded.has(p.cardId));
  const total=pool.reduce((sum,p)=>sum+weights[p.position],0);
  if(total<=0)throw new Error('Aucun joueur de champ disponible');
  let remaining=validDraw(rng)*total;
  for(const p of pool){
    remaining-=weights[p.position];
    if(remaining<0)return p;
  }
  return pool.at(-1);
}
/** Sélection pondérée sur les six joueurs de champ, selon le poste REEL. */
export function selectRole(team,role,{excludeIds=[],rng=Math.random}={}){
  return weightedPick(playersOnField(team),role,excludeIds,rng);
}
/** Porteur, partenaire distinct et défenseur adverse fixés avant l'action.
 * La désignation du finisseur de « Combiner » est un tirage équitable 50/50
 * fait ici, pas après la réussite du duel. */
export function prepareOpenPlayRoles(attackingTeam,defendingTeam,rng=Math.random){
  const attackers=playersOnField(attackingTeam),defenders=playersOnField(defendingTeam);
  const carrier=weightedPick(attackers,'carrier',[],rng);
  const partner=weightedPick(attackers,'partner',[carrier.cardId],rng);
  const defender=weightedPick(defenders,'defender',[],rng);
  const combinationShooter=validDraw(rng)<0.5?carrier:partner;
  const finishers=Object.freeze({
    COMBINER:combinationShooter.cardId,
    LANCER:partner.cardId,
    PERCER:carrier.cardId,
  });
  return Object.freeze({carrier,partner,defender,finishers});
}
/** Ce choix est déjà tiré et annoncé avant les stratégies, sans RNG tardif. */
export function finisherFor(openPlayRoles,attackChoice){
  if(!['COMBINER','LANCER','PERCER'].includes(attackChoice))throw new Error('Tactique inconnue');
  const id=openPlayRoles?.finishers?.[attackChoice];
  if(!id)throw new Error('Rôles non préparés');
  return id;
}
/** Corner ou coup franc centré/combiné : poids « partenaire offensif »,
 * hors gardien et hors tireur-passeur. Sélection AVANT les choix secrets. */
export function selectSetPieceReceiver(team,takerId,rng=Math.random){
  const players=playersOnField(team);
  if(!players.some(p=>p.cardId===takerId))throw new Error('Tireur absent de cette équipe');
  return weightedPick(players,'partner',[takerId],rng);
}
