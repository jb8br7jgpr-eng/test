/** OPFC — Revanche officielle, moteur pur commun local/serveur.
 * Même clubs, effectifs, formations et PLACEMENTS DE FIN DE MATCH.
 * Le résultat précédent est conservé dans l'historique persistant avant appel.
 * Ici seules les données de rencontre sont réinitialisées.
 */
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function prepareRematch(state,{matchRecordId}={}){
 if(state?.phase!=='finished'||!state.match?.winner)throw Error('Revanche : résultat final absent');
 if(typeof matchRecordId!=='string'||!uuid.test(matchRecordId))throw Error('Revanche : identifiant officiel invalide');
 if(state.matchRecordId===matchRecordId)throw Error('Revanche : identifiant déjà utilisé');
 if(!Array.isArray(state.teams)||state.teams.length!==2)throw Error('Revanche : deux équipes requises');
 const clubs=new Set();
 const players=new Set();
 for(const team of state.teams){
  if(!['PSG','OM'].includes(team.club)||clubs.has(team.club))throw Error('Revanche : clubs invalides');
  clubs.add(team.club);
  if(!Array.isArray(team.roster)||team.roster.length!==7||
    !Array.isArray(team.slots)||team.slots.length!==7||
    new Set(team.roster).size!==7||new Set(team.slots).size!==7||
    team.slots.some(id=>!team.roster.includes(id)) ||
    team.roster.some(id=>players.has(id)))throw Error('Revanche : compositions incompatibles');
  team.roster.forEach(id=>players.add(id));
 }
 const next=structuredClone(state);
 next.phase='kickoff-ready';
 next.match=null;
 next.matchRecordId=matchRecordId;
 next.rematchNumber=(state.rematchNumber??0)+1;
 next.prematchSeen=true; // Le local retourne directement sur la présentation du stade.
 next.prematchReady={PSG:false,OM:false}; // Chacun valide l'avant-match en ligne.
 next.teams.forEach(team=>team.ready=true);
 delete next.rematch;
 delete next.onlineRequestIds; // Pas de rejouabilité d'anciennes commandes dans la nouvelle rencontre.
 return next;
}
