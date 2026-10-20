import test from 'node:test';
import assert from 'node:assert/strict';
import {DISPLAY_CLUBS,DISPLAY_BY_ID,chooseClubPair,currentClubChoices,setDisplayedClubs,setDisplayedChoices,visualName,visualAbbr,validateDisplayClub} from '../club-identities.mjs';

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
