/** OPFC — les 3 compétitions officielles et le palmarès initial vierge.
 * Les trophées réels sont calculés à partir de l'historique Supabase, jamais codés en dur.
 */
import {DISPLAY_CLUBS} from './club-identities.mjs';
export const CLUB_TROPHIES=Object.freeze([
 Object.freeze({key:'grandline',name:'Grandline Cup',icon:'🏆'}),
 Object.freeze({key:'league',name:'Ligue du Nouveau Monde',icon:'👑'}),
 Object.freeze({key:'cup',name:'Coupe des Quatre Mers',icon:'⚓'})
]);
export const CLUB_HONOURS=Object.freeze(Object.fromEntries(
 DISPLAY_CLUBS.map(club=>[club.id,Object.freeze({grandline:0,league:0,cup:0})])
));
export const isCompetition=id=>CLUB_TROPHIES.some(x=>x.key===id);
export const competitionName=id=>CLUB_TROPHIES.find(x=>x.key===id)?.name??'Grandline Cup';
