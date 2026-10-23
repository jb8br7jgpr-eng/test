/** Totaux de carrière OPFC : serveur uniquement, aucun compteur local autoritaire. */
import {loadScorerTotals} from './scorer-service.mjs';
const endpoint='https://cihzwaxernachchpjktj.supabase.co/rest/v1/opfc_player_totals?select=card_id,matches,goals,assists,anchors';
const publicKey='sb_publishable_YHtE82cuI72CARv9rScVqw_g3sxbaHG';
const n=v=>Number.isSafeInteger(Number(v))&&Number(v)>=0?Number(v):null;
export async function loadPlayerTotals(){
 const res=await fetch(endpoint,{cache:'no-store',headers:{'apikey':publicKey,'Accept':'application/json'}});
 if(res.ok){
  const rows=await res.json();
  if(!Array.isArray(rows))throw Error('Statistiques individuelles illisibles');
  const totals=new Map();
  for(const x of rows){
   if(typeof x.card_id!=='string'||!['matches','goals','assists','anchors'].every(k=>n(x[k])!==null))
    throw Error('Statistiques individuelles invalides');
   totals.set(x.card_id,{matches:n(x.matches),goals:n(x.goals),assists:n(x.assists),anchors:n(x.anchors)});
  }
  return {totals,complete:true};
 }
 // Compatibilité avec l'ancien serveur tant que la migration n'est pas appliquée :
 // les buts restent exacts, les nouvelles valeurs sont explicitement indisponibles.
 const old=await loadScorerTotals();
 return {totals:new Map([...old].map(([id,goals])=>[id,{matches:null,goals,assists:null,anchors:null}])),complete:false};
}
