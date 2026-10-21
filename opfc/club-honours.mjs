/** OPFC — les trois compétitions, dans leur ordre officiel.
 * Clés historiques inchangées pour préserver les titres et les parties sauvegardées.
 * Les palmarès sont calculés à partir de Supabase, jamais codés en dur.
 */
import {DISPLAY_CLUBS} from './club-identities.mjs';
export const CLUB_TROPHIES=Object.freeze([
 Object.freeze({key:'league',name:'Championnat du Nouveau Monde',icon:'👑',image:null}),
 Object.freeze({key:'cup',name:'Coupe des Quatre Mers',icon:'⚓',image:null}),
 Object.freeze({key:'grandline',name:'Grandline Champions Cup',icon:'🏆',image:'./opfc/illustrations/grandline_cup_trophee.PNG'})
]);
export const CLUB_HONOURS=Object.freeze(Object.fromEntries(
 DISPLAY_CLUBS.map(club=>[club.id,Object.freeze({grandline:0,league:0,cup:0})])
));
export const isCompetition=id=>CLUB_TROPHIES.some(x=>x.key===id);
export const competitionName=id=>CLUB_TROPHIES.find(x=>x.key===id)?.name??'Grandline Champions Cup';

/** Sélecteur visuel commun aux deux modes ; les illustrations manquantes sont provisoires.
 * Aucun identifiant de compétition, score ou mécanisme du jeu n'est modifié.
 */
export function renderCompetitionPicker(selected='league',action='choose-competition'){
 return '<div class="opfc-competition-grid" role="group" aria-label="Choisir la compétition">'+
  CLUB_TROPHIES.map(t=>{
   const active=t.key===selected;
   const visual=t.image?
    '<img class="opfc-competition-art" src="'+t.image+'" alt="" loading="lazy" decoding="async">':
    '<span class="opfc-competition-art opfc-competition-placeholder" aria-hidden="true"><span>'+t.icon+'</span><small>Visuel à venir</small></span>';
   return '<button type="button" class="opfc-competition-choice'+(active?' is-selected':'')+
    '" data-action="'+action+'" data-competition="'+t.key+'" aria-pressed="'+active+
    '" aria-label="'+t.name+(active?' · sélectionnée':'')+'">'+
    '<span class="opfc-competition-visual">'+visual+'</span>'+
    '<span class="opfc-competition-name">'+t.name+'</span>'+
    '<span class="opfc-competition-check" aria-hidden="true">'+(active?'✓ Sélectionnée':'Choisir')+'</span></button>';
  }).join('')+'</div>';
}
