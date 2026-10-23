/** Statistiques OPFC : lecture des résultats déjà résolus, aucun tirage et aucun effet sportif. */
const number=(n)=>Number.isSafeInteger(n)&&n>=0?n:0;
const add=(map,id,key)=>{if(id&&map[id])map[id][key]++;};
export function matchPerformances(state){
 if(!state?.match||!Array.isArray(state.teams)||state.teams.length!==2)
  throw Error('Statistiques : match invalide');
 const players={};
 for(const team of state.teams){
  if(!['PSG','OM'].includes(team.club)||!Array.isArray(team.roster)||team.roster.length!==7)
   throw Error('Statistiques : composition invalide');
  for(const id of team.roster){
   if(players[id])throw Error('Statistiques : personnage en double');
   players[id]={club:team.club,matches:1,goals:0,assists:0,attacks:0,defenses:0,saves:0,anchors:0,points:0};
  }
 }
 for(const event of state.match.history??[]){
  const details=event.details??{},duel=details.duel?.outcome?.outcome;
  if(details.kind==='open'){
   if(duel==='chance')add(players,details.roles?.carrier?.cardId,'attacks');
   if(duel==='stopped')add(players,details.defenderId??details.roles?.defender?.cardId,'defenses');
  }else if(details.kind==='corner'||details.kind==='free-kick'){
   if(duel==='chance')add(players,details.takerId,'attacks');
   if(duel==='stopped')add(players,details.defenderId,'defenses');
  }
  if(event.outcome==='save')add(players,details.keeperId,'saves');
 }
 for(const goal of state.match.goals??[]){
  add(players,goal.cardId,'goals');
  if(goal.assistId&&goal.assistId!==goal.cardId)add(players,goal.assistId,'assists');
 }
 for(const p of Object.values(players))
  p.points=5*p.goals+3*p.assists+p.attacks+2*p.defenses+3*p.saves;
 const ids=Object.keys(players);
 ids.sort((a,b)=>{
  const x=players[a],y=players[b];
  return y.points-x.points||y.goals-x.goals||y.assists-x.assists||
   y.defenses-x.defenses||y.saves-x.saves||a.localeCompare(b);
 });
 const winner=state.phase==='finished'?ids[0]:null;
 if(winner)players[winner].anchors=1;
 return {players,winner,points:winner?players[winner].points:0};
}
export const validPlayerTotal=v=>v&&['matches','goals','assists','anchors'].every(k=>
 Number.isSafeInteger(v[k])&&v[k]>=0);
