/** Tri déterministe du catalogue OPFC : n'écrit aucune donnée ni règle de match.
 * Les statistiques manquantes restent distinctes de zéro tant que la V2
 * n'a pas été synchronisée, pour ne pas inventer un classement.
 */
const compareNames=(a,b)=>a.name.localeCompare(b.name,'fr',{sensitivity:'base'});
const compareRatings=(a,b)=>b.rating-a.rating||compareNames(a,b);
const STAT_MODES=Object.freeze({matches:'matches',goals:'goals',assists:'assists',anchors:'anchors'});
export const characterStatSortAvailable=(mode,totals,complete)=>Boolean(
 totals&&(mode==='goals'||(complete&&Object.hasOwn(STAT_MODES,mode)))
);
export function sortCatalogCharacters(cards,mode,{totals=null,complete=false}={}){
 const statKey=STAT_MODES[mode];
 if(mode==='alpha')return [...cards].sort(compareNames);
 if(mode==='alpha-desc')return [...cards].sort((a,b)=>compareNames(b,a));
 if(statKey&&characterStatSortAvailable(mode,totals,complete)){
  const value=card=>{
   const row=totals.get(card.id);
   if(!row)return complete?0:(mode==='goals'?0:null);
   const n=row[statKey];
   return Number.isSafeInteger(n)&&n>=0?n:null;
  };
  return [...cards].sort((a,b)=>{
   const av=value(a),bv=value(b);
   // Absence réelle de valeur : à la fin, sans la présenter comme un zéro.
   if(av===null||bv===null){
    if(av===null&&bv!==null)return 1;
    if(bv===null&&av!==null)return -1;
   }
   return (bv??0)-(av??0)||compareRatings(a,b);
  });
 }
 return [...cards].sort(compareRatings);
}
export function sortCatalogClubs(clubs,mode,honours,trophies){
 const total=club=>trophies.reduce((sum,t)=>sum+(honours?.[club.id]?.[t.key]??0),0);
 if(mode==='alpha')return [...clubs].sort(compareNames);
 if(mode==='alpha-desc')return [...clubs].sort((a,b)=>compareNames(b,a));
 if(mode==='total')
  return [...clubs].sort((a,b)=>total(b)-total(a)||compareNames(a,b));
 return [...clubs].sort((a,b)=>
  (honours?.[b.id]?.[mode]??0)-(honours?.[a.id]?.[mode]??0)||
  total(b)-total(a)||compareNames(a,b));
}
