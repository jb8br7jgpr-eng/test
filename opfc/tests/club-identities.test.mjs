import test from 'node:test';
import assert from 'node:assert/strict';
import {DISPLAY_CLUBS,DISPLAY_BY_ID,chooseClubPair,currentClubChoices,setDisplayedClubs,setDisplayedChoices,visualName,visualAbbr,validateDisplayClub} from '../club-identities.mjs';
import {renderFinalResult} from '../ui-final.mjs';

test('Dix identités One Piece uniques et Borussia Dressrosa BDR',()=>{
 assert.equal(DISPLAY_CLUBS.length,10);
 assert.equal(new Set(DISPLAY_CLUBS.map(x=>x.id)).size,10);
 assert.equal(DISPLAY_BY_ID.get('BDR')?.name,'Borussia Dressrosa');
 assert.equal(DISPLAY_BY_ID.has('AJD'),false);
});
test('Chaque joueur choisit son propre club, sans doublon',()=>{
 assert.deepEqual(chooseClubPair('BDW','LFC'),{PSG:'BDW',OM:'LFC'});
 assert.throws(()=>chooseClubPair('RM','RM'),/différents/);
 assert.throws(()=>validateDisplayClub('AAA'),/invalide/);
});
test('Sauvegardes historiques sans identité : PSG contre OM',()=>{
 assert.deepEqual(currentClubChoices([{club:'PSG'},{club:'OM'}]),{PSG:'PSG',OM:'OM'});
 assert.equal(setDisplayedClubs([{club:'PSG'},{club:'OM'}]).OM,'OM');
 assert.equal(visualName('PSG'),'Pirates Saint-Grandline');
});
test('Identités affichées indépendantes des identifiants moteur',()=>{
 setDisplayedChoices({PSG:'BDW',OM:'RM'});
 assert.equal(visualAbbr('PSG'),'BDW');
 assert.equal(visualAbbr('OM'),'RM');
 assert.equal(visualName('OM'),'Real Marineford');
 setDisplayedClubs(null);
});

test('Feuille de match et tirs au but : BDW contre BDR sans faux noms PSG/OM',()=>{
 const fixture={
  version:1,phase:'finished',
  teams:[{club:'PSG',identityId:'BDW'},{club:'OM',identityId:'BDR'}],
  match:{
   winner:'PSG',victory:'shootout',score:{PSG:2,OM:2},
   statistics:{
    PSG:{shots:8,onTarget:4,saves:2,sequences:6},
    OM:{shots:9,onTarget:5,saves:2,sequences:7}
   },
   goals:[],
   shootout:{score:{PSG:5,OM:4},timeline:[
    {club:'PSG',shooterId:'luffy',scored:true,result:'goal'}
   ]}
  }
 };
 const html=renderFinalResult(fixture);
 assert.match(html,/Victoire de Bayern de Wano/);
 assert.match(html,/BDW/);
 assert.match(html,/BDR/);
 assert.match(html,/5 – 4/);
 assert.doesNotMatch(html,/<strong>PSG<\/strong>|<strong>OM<\/strong>|<h4>PSG<\/h4>|<h4>OM<\/h4>/);
 setDisplayedClubs(null);
});
