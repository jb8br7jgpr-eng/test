/** Classements V3 indépendants du moteur de match. Postes naturels et points officiels. */
export const CATEGORIES=Object.freeze([
 {key:'goals',title:'Roi des buteurs',icon:'⚽',unit:'buts'},
 {key:'assists',title:'Maître des passes',icon:'🎯',unit:'passes'},
 {key:'matches',title:'Record de matchs',icon:'👕',unit:'matchs'},
 {key:'anchors',title:'Roi des Ancres d’Or',icon:'⚓',unit:'Ancres d’Or'}
]);
export const SEATS=Object.freeze({GAR:1,DEF:2,MIL:2,ATT:2});
export function rankCards(cards,metric,totals,{incumbents=[]}={}){
 return [...cards].sort((a,b)=>{
  const ap=Number(totals.get(a.id)?.[metric]??0),bp=Number(totals.get(b.id)?.[metric]??0);
  const ai=incumbents.indexOf(a.id),bi=incumbents.indexOf(b.id);
  return bp-ap||(ai!==-1&&bi===-1?-1:bi!==-1&&ai===-1?1:
   ai!==-1&&bi!==-1?ai-bi:a.id.localeCompare(b.id));
 });
}
export function hallSeven(cards,points,incumbents={}){
 const totals=new Map([...points].map(([id,n])=>[id,{points:n}]));
 const selected=[];
 for(const [position,count] of Object.entries(SEATS)){
  const sorted=rankCards(cards.filter(c=>c.position===position),'points',totals,
    {incumbents:incumbents[position]??[]});
  selected.push(...sorted.slice(0,count).map(c=>({id:c.id,position,points:points.get(c.id)??0})));
 }
 return selected;
}
