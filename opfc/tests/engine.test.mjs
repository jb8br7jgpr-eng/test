import test from 'node:test';
import assert from 'node:assert/strict';
import {CARDS,CARD_BY_ID,CLUBS} from '../catalog.mjs';
import {rawPositionRating,effectiveRating,matchStats,formationPositions,FORMATIONS,chemistry,chemistryAdvantage,attackingProbability,buildSchedule} from '../rules.mjs';
import {createGame,maxBid,bid,pass,useKings,useObservation,acceptSolo,chooseFormation,place,ready,publicView} from '../engine.mjs';
const id=name=>{const p=CARDS.find(c=>c.name===name);assert.ok(p,name);return p.id;};
const random=(seed=1)=>()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);
const init=()=>createGame({rng:random(12),dice:[4,2]});
const invalid=fn=>assert.throws(fn,/./);
test('50 cartes, 7 groupes, raretés et notes naturelles v0.8',()=>{
 assert.equal(CARDS.length,50);assert.equal(CARD_BY_ID.size,50);
 assert.equal(new Set(CARDS.map(x=>x.group)).size,7);
 const rarity={};for(const p of CARDS){rarity[p.rarity]=(rarity[p.rarity]||0)+1;assert.equal(rawPositionRating(p,p.position),p.rating,p.name);}
 assert.deepEqual(rarity,{DIA:6,OR:14,BRZ:15,ARG:15});
});
test('7 formations officielles avec un gardien',()=>{
 assert.equal(Object.keys(FORMATIONS).length,7);
 for(const n of Object.keys(FORMATIONS)){const ps=formationPositions(n);assert.equal(ps.length,7);assert.equal(ps.filter(p=>p==='GAR').length,1);}
 invalid(()=>formationPositions('4-4-2'));
});
test('Notes effectives de Luffy, Zoro, Jinbe et Loki',()=>{
 const expected={Luffy:[50,56,77,93],Zoro:[27,74,67,90],Jinbe:[67,83,65,58],Loki:[92,68,53,54],Shanks:[37,82,95,86],Mihawk:[30,90,77,75]};
 for(const [name,nums] of Object.entries(expected))assert.deepEqual(['GAR','DEF','MIL','ATT'].map(p=>effectiveRating(id(name),p)),nums);
});
test('Malus de stats différenciés des malus de notes',()=>{
 assert.equal(matchStats(id('Luffy'),'MIL').PUI,95);
 assert.equal(matchStats(id('Luffy'),'DEF').TEC,87);
 assert.equal(matchStats(id('Chopper'),'DEF').GAR,76);
 assert.equal(matchStats(id('Jinbe'),'GAR').DEF,87);
});
test('Entente, plafond et différentiel',()=>{
 assert.equal(chemistry(['Luffy','Zoro','Nami','Robin','Chopper','Sanji','Usopp'].map(id)),10);
 assert.equal(chemistry(['Luffy','Zoro','Robin','Kaido','Shanks','Marco','Crocodile'].map(id)),8);
 assert.equal(chemistryAdvantage([id('Luffy'),id('Zoro')],[id('Luffy')]),1);
});
test('Deux clubs et départ 250 M après dés',()=>{
 const s=init();assert.deepEqual(CLUBS.map(c=>c.id),['PSG','OM']);
 assert.equal(s.teams[0].budget,250);assert.equal(s.teams[1].budget,250);
 assert.equal(s.auction.priority,'PSG');assert.equal(maxBid(s.teams[0]),220);
});
test('Paquet de 50 cartes exclu de la vue publique',()=>{
 const s=init();const view=publicView(s);
 assert.ok(!Object.hasOwn(view,'deck'));assert.ok(!Object.hasOwn(view,'cursor'));
 assert.equal(view.auction.cardId,s.auction.cardId);
});
test('Première offre >=5 M, plafond légal et surenchère +1 M',()=>{
 let s=init();invalid(()=>bid(s,'PSG',4));invalid(()=>bid(s,'PSG',221));
 s=bid(s,'PSG',220);assert.equal(s.teams[0].budget,30);
 assert.equal(s.lastResult.reason,'opponent-unable-to-bid');
});
test('Deux refus sans mise rendent la carte invendue et alternent priorité',()=>{
 let s=init();const first=s.auction.cardId;
 s=pass(s,'PSG');s=pass(s,'OM');
 assert.notEqual(s.auction.cardId,first);assert.equal(s.lastResult.reason,'unsold');
 assert.equal(s.teams[0].refusals,1);assert.equal(s.teams[1].refusals,1);
 assert.equal(s.auction.priority,'OM');
});
test('Passage après offre = gratuit',()=>{
 let s=init();s=bid(s,'PSG',5);s=bid(s,'OM',6);s=pass(s,'PSG');
 assert.equal(s.teams[0].refusals,0);assert.equal(s.teams[1].budget,244);
});
test('Après une offre PSG, OM passe gratuitement',()=>{
 let s=init();s=bid(s,'PSG',5);s=pass(s,'OM');
 assert.equal(s.teams[1].refusals,0);assert.equal(s.teams[0].roster.length,1);
 assert.equal(s.history.filter(x=>x.kind==='pass').at(-1).cost,0);
});
test('Après une offre OM, PSG passe gratuitement',()=>{
 let s=init();s=pass(s,'PSG');s=bid(s,'OM',5);s=pass(s,'PSG');
 assert.equal(s.teams[0].refusals,1); // Seul le premier refus est payant.
 assert.equal(s.history.filter(x=>x.kind==='pass').at(-1).cost,0);
});
test('Même avec 5 refus épuisés, passer après une offre adverse reste gratuit',()=>{
 let s=init();
 for(let i=0;i<5;i++){s=pass(s,s.auction.turn);s=pass(s,s.auction.turn);}
 assert.equal(s.teams[0].refusals,5);assert.equal(s.teams[1].refusals,5);
 s=bid(s,s.auction.turn,5);
 const passer=s.auction.turn,avant=s.teams.find(t=>t.club===passer).refusals;
 s=pass(s,passer);
 assert.equal(s.teams.find(t=>t.club===passer).refusals,avant);
 assert.equal(s.history.filter(x=>x.kind==='pass').at(-1).cost,0);
});
test('Cinq refus maximum; sixième interdit',()=>{
 let s=init();for(let i=0;i<5;i++){s=pass(s,s.auction.turn);s=pass(s,s.auction.turn);}
 assert.equal(s.teams[0].refusals,5);assert.equal(s.teams[1].refusals,5);
 invalid(()=>pass(s,s.auction.turn));
});
test('Haki observation, 5 prochaines cartes, utilisation unique',()=>{
 let s=init();const expected=s.deck.slice(s.cursor,s.cursor+5);
 const out=useObservation(s,'PSG');s=out.state;
 assert.deepEqual(out.peek,expected);assert.equal(s.cursor,1);
 assert.ok(!Object.hasOwn(publicView(s),'deck'));invalid(()=>useObservation(s,'PSG'));
});
test('Haki des Rois : priorité, unique riposte et offre finale',()=>{
 let s=init();invalid(()=>useKings(s,'OM'));
 s=useKings(s,'PSG');s=bid(s,'PSG',5);s=bid(s,'OM',6);s=bid(s,'PSG',7);
 assert.equal(s.teams[0].roster.length,1);assert.equal(s.teams[0].budget,243);
 invalid(()=>useKings(s,'PSG'));
});
test('Haki des Rois ne garantit pas de vainqueur',()=>{
 let s=init();s=useKings(s,'PSG');s=bid(s,'PSG',5);s=bid(s,'OM',220);
 assert.equal(s.lastResult.winner,'OM');
});
test('Placement manuel, formation libre, pas de placement adverse',()=>{
 let s=init();s=bid(s,'PSG',5);s=pass(s,'OM');
 const p=s.teams[0].roster[0];s=place(s,'PSG',p,1);
 assert.equal(s.teams[0].slots[1],p);
 s=chooseFormation(s,'PSG','3-1-2');assert.equal(s.teams[0].slots[1],null);
 invalid(()=>place(s,'OM',p,1));invalid(()=>ready(s,'PSG'));
});
test('Achat seul à 5 M si adversaire a déjà sept recrues',()=>{
 let s=init();s.teams[0].roster=CARDS.slice(0,7).map(x=>x.id);
 s.auction.solo=true;s.auction.turn='OM';s.auction.cardId=CARDS[25].id;
 s=acceptSolo(s,'OM');assert.equal(s.teams[1].budget,245);
});
test('Un mercato complet : deux équipes de sept et aucun doublon',()=>{
 let s=init(),iterations=0;
 while(s.phase==='mercato'){
   assert.ok(iterations++<20);
   if(s.auction.solo){s=acceptSolo(s,s.auction.turn);continue;}
   s=bid(s,s.auction.turn,5);
   if(s.phase==='mercato'&&s.auction.highestBid===5){
     s=bid(s,s.auction.turn,6);
     if(s.phase==='mercato'&&s.auction.highestBid===6)s=pass(s,s.auction.turn);
   }
 }
 assert.equal(s.phase,'lineup');
 for(const t of s.teams){assert.equal(t.roster.length,7);assert.ok(t.budget>=35);
   for(let i=0;i<7;i++)s=place(s,t.club,t.roster[i],i);
   s=ready(s,t.club);
 }
 assert.equal(s.phase,'kickoff-ready');
 assert.equal(new Set(s.teams.flatMap(t=>t.roster)).size,14);
});
test('500 calendriers : 10–12 séquences, 3 par équipe, une par mi-temps',()=>{
 const keep=CARDS.filter(x=>x.position==='GAR');
 const field=CARDS.filter(x=>x.position!=='GAR');
 const a={formation:'2-2-2',slots:[keep[0].id,...field.slice(0,6).map(c=>c.id)]};
 const b={formation:'2-2-2',slots:[keep[1].id,...field.slice(6,12).map(c=>c.id)]};
 assert.ok(attackingProbability(a,b)>=40&&attackingProbability(a,b)<=60);
 for(let seed=1;seed<=500;seed++){
   const schedule=buildSchedule(a,b,random(seed));
   assert.ok(schedule.length>=10&&schedule.length<=12);
   assert.equal(new Set(schedule.map(e=>e.minute)).size,schedule.length);
   for(const club of ['PSG','OM']) {
     assert.ok(schedule.filter(e=>e.attacker===club).length>=3);
     for(const period of [1,2])assert.ok(schedule.some(e=>e.attacker===club&&e.period===period));
   }
 }
});
