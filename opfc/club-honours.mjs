/** OPFC — palmarès fictifs des clubs, purement décoratifs et sans incidence sur le jeu. 
 * grandline : Grandline Cup ; league : Ligue du Nouveau Monde ; cup : Coupe des Quatre Mers.
 * Les identifiants sont ceux des clubs visuels de club-identities.mjs.
 */
const honours = [
 ['PSG',4,7,3],
 ['OM',3,5,4],
 ['BDW',6,9,4],
 ['SPJ',2,4,3],
 ['WSC',5,6,2],
 ['AWC',3,4,5],
 ['SU',2,5,3],
 ['RM',7,10,5],
 ['LFC',5,7,4],
 ['BDR',3,6,3],
 ['SKS',2,4,2],
 ['ALA',2,3,2],
 ['RFC',1,3,2],
 ['JVK',4,8,5],
 ['AST',1,2,1],
 ['RBE',2,4,2],
 ['FCI',0,1,1],
 ['ATZ',3,5,3],
 ['ERG',2,3,1],
 ['PHC',1,2,1]
];
export const CLUB_HONOURS = Object.freeze(Object.fromEntries(
 honours.map(([id,grandline,league,cup])=>[id,Object.freeze({grandline,league,cup})])
));
export const CLUB_TROPHIES = Object.freeze([
 Object.freeze({key:'grandline',name:'Grandline Cup',icon:'🏆'}),
 Object.freeze({key:'league',name:'Ligue du Nouveau Monde',icon:'👑'}),
 Object.freeze({key:'cup',name:'Coupe des Quatre Mers',icon:'⚓'})
]);
