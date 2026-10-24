/** OPFC V3 : lecture publique des totaux agrégés exclusivement ; jamais les tables privées. */
const api='https://cihzwaxernachchpjktj.supabase.co/rest/v1/';
const key='sb_publishable_YHtE82cuI72CARv9rScVqw_g3sxbaHG';
const integer=value=>{if(typeof value!=='number'&&!(typeof value==='string'&&/^(0|[1-9][0-9]*)$/.test(value)))return null;
 const n=Number(value);return Number.isSafeInteger(n)&&n>=0?n:null;};
async function get(table,fields){
 const response=await fetch(api+table+'?select='+fields,{cache:'no-store',
  headers:{apikey:key,Accept:'application/json'}});
 if(!response.ok)throw Error('Données V3 non disponibles');
 const rows=await response.json();
 if(!Array.isArray(rows))throw Error('Données V3 illisibles');
 return rows;
}
export async function loadV3ClubStats(){
 const rows=await get('opfc_club_totals','club_id,matches,wins,losses,goals_for,goals_against');
 const result=new Map();
 for(const row of rows){
  const record={matches:integer(row.matches),wins:integer(row.wins),losses:integer(row.losses),
   goalsFor:integer(row.goals_for),goalsAgainst:integer(row.goals_against)};
  if(typeof row.club_id!=='string'||Object.values(record).some(v=>v===null)||
     record.wins+record.losses!==record.matches)throw Error('Bilan de club invalide');
  result.set(row.club_id,record);
 }
 return result;
}
export async function loadV3PlayerPoints(){
 const rows=await get('opfc_player_totals','card_id,points');
 const result=new Map();
 for(const row of rows){
  const points=integer(row.points);
  if(typeof row.card_id!=='string'||points===null)throw Error('Points historiques invalides');
  result.set(row.card_id,points);
 }
 return result;
}
export function clubMetrics(record){
 if(!record)return null;
 const diff=record.goalsFor-record.goalsAgainst;
 const ratio=record.matches>0?100*record.wins/record.matches:null;
 return {...record,diff,ratio};
}

export async function loadV3Milestones(){
 const rows=await get('opfc_v3_player_milestones','card_id,matches_at,goals_at,assists_at,anchors_at,points_at');
 const milestones=new Map();
 for(const row of rows){
  if(typeof row.card_id!=='string')throw Error('Jalons historiques invalides');
  const item={};
  for(const type of ['matches','goals','assists','anchors','points']){
   const stamp=row[type+'_at'];
   if(stamp!==null&&(typeof stamp!=='string'||!Number.isFinite(Date.parse(stamp))))
    throw Error('Date de palier invalide');
   item[type]=stamp;
  }
  milestones.set(row.card_id,item);
 }
 return milestones;
}
