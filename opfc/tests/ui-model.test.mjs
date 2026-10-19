import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,bid,pass,place,ready,useKings} from '../engine.mjs';
import {CARD_BY_ID} from '../catalog.mjs';
import {FORMATION_NAMES,uiAuction,uiTeam,uiRoster,cardStats,currentAuctionEnding,clubName} from '../ui-model.mjs';
import {effectiveRating} from '../rules.mjs';
const random=()=>0.125;
test('Les 7 formations sélectionnables correspondent au moteur',()=>{
 assert.deepEqual(FORMATION_NAMES,['2-2-2','2-3-1','1-2-3','3-2-1','1-3-2','2-1-3','3-1-2']);
});
test('Le premier écran montre la carte officielle, la mise et les budgets légaux',()=>{
 const s=createGame({dice:[5,2],rng:random});
 const v=uiAuction(s);
 assert.equal(v.card.id,s.auction.cardId);
 assert.equal(v.minimum,5);assert.equal(v.maximum,220);
 assert.equal(v.canBid,true);assert.equal(v.canPass,true);
 assert.equal(v.canKings,true);assert.equal(v.canObserve,true);
 assert.equal(cardStats(v.card).length,6);
 assert.equal(clubName('PSG'),'Pirates Saint-Grandline');
});
test('Passer ne consomme pas de refus après avoir participé',()=>{
 let s=createGame({dice:[5,2],rng:random});
 s=bid(s,'PSG',5);
 const v=uiAuction(s);
 assert.equal(v.team.club,'OM');
 assert.equal(v.minimum,6);
 assert.equal(v.canKings,false);
 assert.equal(v.canPass,true);
 s=bid(s,'OM',6);
 assert.equal(uiAuction(s).everOffered,true);
});
test('Haki des Rois désactive le passage de son détenteur avant sa première offre',()=>{
 let s=createGame({dice:[5,2],rng:random});
 s=useKings(s,'PSG');
 const v=uiAuction(s);
 assert.equal(v.canPass,false);assert.equal(v.canKings,false);
 assert.equal(v.canBid,true);
});
test('Les notes par case, le banc et les alertes hors poste sont correctes',()=>{
 let s=createGame({dice:[5,2],rng:random});
 const t=s.teams[0];
 assert.equal(uiTeam(t).lineup.length,7);
 assert.equal(uiTeam(t).rosterCount,0);
 t.roster=['luffy','zoro','chopper'];
 s=place(s,'PSG','luffy',1);
 const u=uiTeam(s.teams[0]);
 assert.equal(u.lineup[1].cardId,'luffy');
 assert.equal(u.lineup[1].outOfPosition,true);
 assert.equal(u.lineup[1].rating,56);
 assert.deepEqual(u.bench.map(x=>x.id),['zoro','chopper']);
 assert.equal(u.canReady,false);
 assert.equal(CARD_BY_ID.get('luffy').name,'Luffy');
});
test('Chaque vente clôturée produit un seul écran de résultat, sans autre changement moteur',()=>{
 let s=createGame({dice:[5,2],rng:random});
 const before=s;
 s=bid(s,'PSG',5);
 assert.equal(currentAuctionEnding(before,s),null);
 const after=pass(s,'OM');
 const result=currentAuctionEnding(s,after);
 assert.equal(result.winner,'PSG');assert.equal(result.price,5);
 assert.equal(currentAuctionEnding(after,after),null);
});

test('Liste : GAR/DEF/MIL/ATT viennent de la case jouée, jamais du poste d’origine',()=>{
 const s=createGame({dice:[5,2],rng:random});
 const team=s.teams.find(t=>t.club==='PSG');
 team.roster=['luffy','zoro','nami','chopper','jinbe','sanji','usopp'];
 team.formation='2-2-2';
 // Gardiens naturels en attaque ; Luffy attaquant naturel dans les buts.
 team.slots=['luffy','jinbe','nami','usopp','sanji','chopper','zoro'];
 const entries=uiRoster(team);
 assert.deepEqual(entries.map(x=>x.position),['GAR','DEF','DEF','MIL','MIL','ATT','ATT']);
 assert.equal(entries[0].cardId,'luffy');
 const chopper=entries.find(x=>x.cardId==='chopper');
 assert.equal(CARD_BY_ID.get('chopper').position,'GAR');
 assert.equal(chopper.position,'ATT');
 assert.equal(chopper.rating,effectiveRating('chopper','ATT'));
 assert.equal(chopper.outOfPosition,true);
 assert.equal(entries.find(x=>x.cardId==='luffy').position,'GAR');
 assert.equal(entries.find(x=>x.cardId==='luffy').outOfPosition,true);
 assert.equal(entries.every(x=>x.placed),true);
 // Une modification de formation recalcule position, ordre et note de chaque recrue.
 team.formation='3-2-1';
 const newEntries=uiRoster(team);
 assert.deepEqual(newEntries.map(x=>x.position),['GAR','DEF','DEF','DEF','MIL','MIL','ATT']);
 const moved=newEntries.find(x=>x.cardId==='chopper');
 assert.equal(moved.position,'MIL');
 assert.equal(moved.rating,effectiveRating('chopper','MIL'));
 assert.equal(moved.outOfPosition,true);
 assert.deepEqual(team.roster,['luffy','zoro','nami','chopper','jinbe','sanji','usopp'],
  'Le tri ne doit jamais modifier l’ordre de recrutement dans le moteur');
});
test('Une recrue non placée figure en bas avec un poste et une note à définir',()=>{
 const s=createGame({dice:[5,2],rng:random});
 const team=s.teams.find(t=>t.club==='PSG');
 team.roster=['chopper','luffy','zoro'];
 team.slots=['luffy',null,null,null,null,null,null];
 const list=uiRoster(team);
 assert.deepEqual(list.map(x=>x.cardId),['luffy','chopper','zoro']);
 assert.equal(list[0].position,'GAR');
 assert.equal(list[0].rating,effectiveRating('luffy','GAR'));
 for(const p of list.slice(1)){
  assert.equal(p.position,null);
  assert.equal(p.rating,null);
  assert.equal(p.placed,false);
 }
});
