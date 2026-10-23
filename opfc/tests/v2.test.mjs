/** Régressions OPFC V2. Exécuter : node --test opfc/tests/v2.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import {CARDS} from '../catalog.mjs';
import {prepareOpenPlayRoles,finisherFor} from '../roles.mjs';
import {matchPerformances} from '../player-performance.mjs';
import {STADIUMS} from '../stadiums.mjs';
import {renderPrematch} from '../prematch.mjs';
import {renderFinalResult} from '../ui-final.mjs';
import {renderMatchScreen,renderOnlineMatchScreen} from '../ui-match.mjs';

const used=new Set();
const pick=pos=>{
 const card=CARDS.find(c=>c.position===pos&&!used.has(c.id));
 assert.ok(card,'Enough characters by position: '+pos);
 used.add(card.id);
 return card.id;
};
const makeTeam=(club,identityId)=>{
 const slots=['GAR','DEF','DEF','MIL','MIL','ATT','ATT'].map(pick);
 return {club,identityId,formation:'2-2-2',slots,roster:[...slots],ready:true,budget:0,refusals:0,hakis:{observation:false,kings:false}};
};
const teams=[makeTeam('PSG','PSG'),makeTeam('OM','BDW')];
const [A,B]=teams;
const all=teams.flatMap(t=>t.roster);
const matchState=(goals=[],history=[],phase='finished')=>({
 phase,competition:'league',stadiumId:'whole-cake',
 teams:structuredClone(teams),
 match:{goals,history,competition:'league',score:{PSG:goals.filter(g=>g.club==='PSG').length,OM:goals.filter(g=>g.club==='OM').length},
  winner:'PSG',victory:'regulation',statistics:{PSG:{shots:1,onTarget:1,saves:0,sequences:1},OM:{shots:0,onTarget:0,saves:0,sequences:1}}}
});
const rngWithLast=v=>{
 const a=[.1,.2,.3,v];
 return ()=>a.shift()??.5;
};
test('Les huit stades sont uniques et leurs illustrations WebP référencées',()=>{
 assert.equal(STADIUMS.length,8);
 assert.equal(new Set(STADIUMS.map(s=>s.id)).size,8);
 assert.ok(STADIUMS.every(s=>s.image.endsWith('.webp')&&s.capacity>=40000));
});
test('Passe courte conserve le choix 50/50, profondeur toujours au partenaire',()=>{
 for(const q of [.1,.9]){
  const roles=prepareOpenPlayRoles(A,B,rngWithLast(q));
  assert.equal(finisherFor(roles,'COMBINER'),q<.5?roles.carrier.cardId:roles.partner.cardId);
  assert.equal(finisherFor(roles,'LANCER'),roles.partner.cardId);
  assert.equal(finisherFor(roles,'PERCER'),roles.carrier.cardId);
 }
});
test('L autre joueur reçoit la passe D, le tireur reçoit son but',()=>{
 const goals=[{club:'PSG',cardId:A.roster[5],assistId:A.roster[4],minute:24}];
 const history=[{outcome:'goal',details:{kind:'open',duel:{outcome:{outcome:'chance'}},roles:{carrier:{cardId:A.roster[4]},partner:{cardId:A.roster[5]}}}}];
 const p=matchPerformances(matchState(goals,history)).players;
 assert.equal(p[A.roster[5]].goals,1);
 assert.equal(p[A.roster[4]].assists,1);
 assert.equal(p[A.roster[4]].attacks,1);
 assert.equal(p[A.roster[5]].points,5);
 assert.equal(p[A.roster[4]].points,4);
});
test('Défense et arrêts attribués au personnage, tirs au but exclus',()=>{
 const state=matchState([],[
  {outcome:'stopped',details:{kind:'open',duel:{outcome:{outcome:'stopped'}},defenderId:B.roster[1]}},
  {outcome:'save',details:{kind:'penalty',keeperId:B.roster[0]}}
 ]);
 state.match.shootout={timeline:[{club:'PSG',scored:true},{club:'OM',result:'save',scored:false}]};
 const p=matchPerformances(state).players;
 assert.equal(p[B.roster[1]].defenses,1);
 assert.equal(p[B.roster[0]].saves,1);
 assert.equal(p[B.roster[0]].points,3);
});
test('Un joueur obtient une Ancre d Or, même sur un 0-0',()=>{
 const p=matchPerformances(matchState([]));
 assert.equal(Object.values(p.players).filter(x=>x.anchors===1).length,1);
 assert.equal(Object.keys(p.players).length,14);
 assert.ok(p.winner&&all.includes(p.winner));
});
test('Avant-match : 14 titulaires, vraie compétition et stade Whole Cake',()=>{
 const s=matchState([],[],'kickoff-ready');
 const html=renderPrematch(s);
 assert.ok(html.includes('Whole Cake Stadium'));
 assert.ok(html.includes('Championnat du Nouveau Monde'));
 assert.equal((html.match(/opfc-prematch-player/g)||[]).length,14);
});
test('Écran final : passeur avec portrait et récompense Ancre d Or',()=>{
 const goals=[{club:'PSG',cardId:A.roster[5],assistId:A.roster[4],minute:38}];
 const html=renderFinalResult(matchState(goals,[{outcome:'goal',details:{kind:'open',duel:{outcome:{outcome:'chance'}},roles:{carrier:{cardId:A.roster[4]}}}}]));
 assert.ok(html.includes('Passe décisive'));
 assert.ok(html.includes('final-assist-portrait'));
 assert.ok(html.includes('ancre-or.webp'));
 assert.ok(html.includes('Ancre d’Or'));
});


test('Deux écrans avant-match : ancien écran conservé, puis stade en local',()=>{
 const ready=matchState([],[],'kickoff-ready');
 ready.playerStatsVersion=2;
 const original=renderMatchScreen(ready);
 assert.ok(original.includes('Les équipes sont prêtes !'));
 assert.ok(original.includes('match-prematch-next'));
 assert.ok(!original.includes('opfc-prematch-stadium'));
 const presentation=renderMatchScreen({...ready,prematchSeen:true});
 assert.ok(presentation.includes('Whole Cake Stadium'));
 assert.ok(presentation.includes('opfc-prematch-stadium'));
 assert.ok(presentation.includes('match-kickoff'));
});
test('Avant-match en ligne : validations séparées avant le coup d’envoi',()=>{
 const ready=matchState([],[],'kickoff-ready');
 ready.playerStatsVersion=2;
 ready.prematchReady={PSG:false,OM:false};
 const first=renderOnlineMatchScreen(ready,{myClub:'PSG',hostClub:'PSG'});
 assert.ok(first.includes('Les équipes sont prêtes !'));
 assert.ok(first.includes('data-type="prematch-next"'));
 const host=renderOnlineMatchScreen({...ready,prematchReady:{PSG:true,OM:false}},{myClub:'PSG',hostClub:'PSG'});
 assert.ok(host.includes('Whole Cake Stadium'));
 assert.ok(!host.includes('data-type="kickoff"'));
 const guest=renderOnlineMatchScreen({...ready,prematchReady:{PSG:true,OM:false}},{myClub:'OM',hostClub:'PSG'});
 assert.ok(guest.includes('data-type="prematch-next"'));
 const both={...ready,prematchReady:{PSG:true,OM:true}};
 const finalHost=renderOnlineMatchScreen(both,{myClub:'PSG',hostClub:'PSG'});
 const finalGuest=renderOnlineMatchScreen(both,{myClub:'OM',hostClub:'PSG'});
 assert.ok(finalHost.includes('data-type="kickoff"'));
 assert.ok(!finalGuest.includes('data-type="kickoff"'));
});
