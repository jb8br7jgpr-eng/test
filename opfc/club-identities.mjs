/**
 * OPMercato FC — identités VISUELLES des clubs.
 * Les identifiants PSG et OM demeurent les deux positions techniques du moteur.
 * Les choix de club ne modifient jamais les règles ni les scores.
 */
const entries=[
 ['PSG','Pirates Saint-Grandline','#112c59','#ba1738','#ffffff'],
 ['OM','Olympique Marimo','#ffffff','#60b9db','#c4a062'],
 ['BDW','Bayern de Wano','#c12d40','#ffffff','#192e73'],
 ['SPJ','Sporting Jaya','#177d58','#ffffff','#c8d4bf'],
 ['WSC','Water Seven City','#72c3e1','#ffffff','#173653'],
 ['AWC','AC Whole Cake','#20212a','#f04f5c','#ffffff'],
 ['SU','Sabaody United','#b82b39','#dfb45c','#ffffff'],
 ['RM','Real Marineford','#f3f1eb','#b38d45','#7860b6'],
 ['LFC','Loguetown FC','#ad293b','#ffffff','#e2b75f'],
 ['BDR','Borussia Dressrosa','#f4d42e','#171717','#ffffff'],
 ['SKS','Skypieakos','#bf0c16','#f4c34d','#ffffff'],
 ['ALA','Alabastasaray','#9a101c','#f3c75d','#fff3d0'],
 ['RFC','Ryugu FC','#074f9b','#f6d778','#ffffff'],
 ['JVK','Juventus Kuja','#181818','#f3d58e','#ffffff'],
 ['AST','AS Thriller Bark','#821b2b','#e7b253','#171128'],
 ['RBE','RB Enies Lobby','#0c2a58','#df234c','#e6c364'],
 ['FCI','FC Impel Down','#17132a','#8d52ca','#ebc265'],
 ['ATZ','Atlético Zo','#0b285b','#d62342','#ffffff'],
 ['ERG','Erbaf Rangers','#0b3279','#ffffff','#ed3049'],
 ['PHC','Punk Hazard Chiefs','#111111','#f2c336','#ffffff']
];
export const DISPLAY_CLUBS=Object.freeze(entries.map(([id,name,primary,secondary,accent])=>
 Object.freeze({id,name,primary,secondary,accent})));
export const DISPLAY_BY_ID=new Map(DISPLAY_CLUBS.map(x=>[x.id,x]));
/** Abréviation publique ; l'identifiant historique AWC reste compatible avec les parties sauvegardées et le serveur. */
export const displayAbbr=id=>id==='AWC'?'ACW':id;
/** Fichiers des écussons validés : identités affichées, pas les slots du moteur. */
const CLUB_LOGO_NAMES=Object.freeze({
 PSG:'Pirates_Saint_Grandline_logo_2_etoiles.webp',
 OM:'Olympique_Marimo_logo_sans_fond.webp',
 BDW:'bayern_wano.webp',
 SPJ:'sporting_jaya.webp',
 WSC:'water_seven_city.webp',
 AWC:'ac_whole_cake.webp',
 SU:'sabaody_united.webp',
 RM:'real_marineford.webp',
 LFC:'loguetown_fc.webp',
 BDR:'borussia_dressrosa.webp',
 SKS:'SKS.webp',
 ALA:'ALA.webp',
 RFC:'RFC.webp',
 JVK:'JVK.webp',
 AST:'AST.webp',
 RBE:'RBE.webp',
 FCI:'FCI.webp',
 ATZ:'ATZ.webp',
 ERG:'ERG.webp',
 PHC:'PHC.webp'
});
export const clubLogoFile=id=>CLUB_LOGO_NAMES[id]?
 './opfc/club-logos/'+CLUB_LOGO_NAMES[id]:null;
export const SLOT_IDS=Object.freeze(['PSG','OM']);
export const DEFAULT_IDENTITIES=Object.freeze({PSG:'PSG',OM:'OM'});
export const isDisplayClub=id=>typeof id==='string'&&DISPLAY_BY_ID.has(id);
export const displayClub=id=>DISPLAY_BY_ID.get(id)??null;
export function validateDisplayClub(id){
 if(!isDisplayClub(id))throw Error('Club sélectionné invalide');
 return id;
}
export function chooseClubPair(psg='PSG',om='OM'){
 validateDisplayClub(psg);validateDisplayClub(om);
 if(psg===om)throw Error('Les deux joueurs doivent choisir des clubs différents');
 return Object.freeze({PSG:psg,OM:om});
}
export function currentClubChoices(teams){
 const result={...DEFAULT_IDENTITIES};
 if(!Array.isArray(teams))return result;
 for(const team of teams){
  if(SLOT_IDS.includes(team?.club)&&isDisplayClub(team?.identityId))
   result[team.club]=team.identityId;
 }
 // Repli ancien format (partie commencée avant l'ajout des clubs).
 if(result.PSG===result.OM)return {...DEFAULT_IDENTITIES};
 return result;
}
let displayChoices={...DEFAULT_IDENTITIES};
export function setDisplayedClubs(teams){
 displayChoices=currentClubChoices(teams);
 return displayChoices;
}
export function setDisplayedChoices(choices){
 if(!choices)return setDisplayedClubs(null);
 displayChoices=chooseClubPair(choices.PSG,choices.OM);
 return displayChoices;
}
export function visualClub(slot){
 const id=displayChoices[slot]??slot;
 return DISPLAY_BY_ID.get(id)??DISPLAY_BY_ID.get(slot)??null;
}
export const visualName=slot=>visualClub(slot)?.name??'Club inconnu';
export const visualAbbr=slot=>displayAbbr(visualClub(slot)?.id??'—');
