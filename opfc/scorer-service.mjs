/**
 * OPFC : statistiques publiques des buteurs, lecture seule.
 * Le navigateur n'a accès qu'à la table des totaux RLS, jamais aux résultats privés.
 * La clé ci-dessous est volontairement une clé PUBLISHABLE (pas un secret).
 */
const endpoint='https://cihzwaxernachchpjktj.supabase.co/rest/v1/opfc_scorer_totals?select=card_id,goals';
const publishableKey='sb_publishable_YHtE82cuI72CARv9rScVqw_g3sxbaHG';
export async function loadScorerTotals(){
 const response=await fetch(endpoint,{
  method:'GET',cache:'no-store',
  headers:{'apikey':publishableKey,'Accept':'application/json'}
 });
 if(!response.ok)throw Error('Statistiques des buteurs indisponibles');
 const rows=await response.json();
 if(!Array.isArray(rows))throw Error('Statistiques des buteurs invalides');
 const totals=new Map();
 for(const row of rows){
  if(typeof row.card_id!=='string'||!Number.isSafeInteger(Number(row.goals))||Number(row.goals)<0)
   throw Error('Statistiques des buteurs illisibles');
  totals.set(row.card_id,Number(row.goals));
 }
 return totals;
}
