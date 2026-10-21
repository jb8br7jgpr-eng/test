/** OPFC — lecture de palmarès et file de résultats locaux. Aucun effet sur le moteur sportif. */
import {OPFC_ONLINE_API_URL} from './online-config.mjs';
import {isCompetition} from './club-honours.mjs';
import {isDisplayClub} from './club-identities.mjs';

const QUEUE_KEY='opfc-local-trophy-results-v1';
const CONFIRMED_KEY='opfc-local-confirmed-trophy-results-v1';
const API=OPFC_ONLINE_API_URL;
let syncing=null;
async function request(payload){
 const response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify(payload),cache:'no-store'});
 const body=await response.json();
 if(!response.ok||body?.error)throw Error(body?.error??'Serveur OPFC indisponible');
 return body;
}
export async function loadTrophyHistory(){
 const data=await request({action:'honours'});
 if(!Array.isArray(data?.summary)||!Array.isArray(data?.history))throw Error('Palmarès illisible');
 return data;
}
function pending(){
 try{const v=JSON.parse(localStorage.getItem(QUEUE_KEY)||'[]');return Array.isArray(v)?v:[];}
 catch{return [];}
}
function confirmed(){
 try{const data=JSON.parse(localStorage.getItem(CONFIRMED_KEY)||'[]');return Array.isArray(data)?data:[];}catch{return []}
}
function markConfirmed(id){
 try{localStorage.setItem(CONFIRMED_KEY,JSON.stringify([...confirmed().filter(x=>x!==id),id].slice(-2000)));}catch{}
}
function setPending(items){
 try{localStorage.setItem(QUEUE_KEY,JSON.stringify(items));return true;}
 catch{return false;}
}
function localResult(game){
 if(game?.phase!=='finished'||!game.match?.winner||
   !isCompetition(game.competition)||!game.matchRecordId)return null;
 const teams=Object.fromEntries(game.teams.map(t=>[t.club,t.identityId??t.club]));
 if(!isDisplayClub(teams.PSG)||!isDisplayClub(teams.OM)||teams.PSG===teams.OM)return null;
 const match=game.match;
 return {id:game.matchRecordId,competition:game.competition,clubs:teams,
  score:{PSG:match.score.PSG,OM:match.score.OM},winner:match.winner,victory:match.victory,
  shootout:match.victory==='shootout'?{PSG:match.shootout.score.PSG,OM:match.shootout.score.OM}:null,
  goals:match.goals.map(g=>({club:g.club,cardId:g.cardId,minute:g.minute}))};
}
/** Idempotence : le même match est dans la file et la base sous le même UUID. */
export function queueFinishedLocalGame(game){
 const result=localResult(game);
 if(!result)return false;
 if(confirmed().includes(result.id))return true;
 const items=pending();
 if(!items.some(x=>x.id===result.id)){
  if(!setPending([...items,result]))return false;
 }
 void syncQueuedLocalResults();
 return true;
}
/** Aucune suppression si la requête n'aboutit pas : reprise au prochain accès Internet. */
export function syncQueuedLocalResults(){
 if(syncing)return syncing;
 syncing=(async()=>{
  while(true){
   const items=pending();
   if(!items.length)break;
   const result=items[0];
   try{
    await request({action:'record-local',result});
    markConfirmed(result.id);
    setPending(pending().filter(x=>x.id!==result.id));
   }catch{break;}
  }
 })().finally(()=>{syncing=null;});
 return syncing;
}
export const pendingLocalResultsCount=()=>pending().length;
