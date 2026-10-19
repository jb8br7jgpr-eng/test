import test from 'node:test';
import assert from 'node:assert/strict';
import {ROLE_WEIGHTS,selectRole,prepareOpenPlayRoles,finisherFor,selectSetPieceReceiver} from '../roles.mjs';
import {formationPositions} from '../rules.mjs';
const a={formation:'2-2-2',slots:['chopper','jinbe','kaido','shanks','nami','luffy','zoro']};
const b={formation:'2-2-2',slots:['loki','mihawk','monkey-d-garp','katakuri','sabo','sanji','kizaru']};
const scripted=(...draws)=>()=>{if(!draws.length)throw Error('Trop de tirages');return draws.shift();};
test('Pondérations officielles selon le poste réel — trois rôles',()=>{
  assert.deepEqual(ROLE_WEIGHTS.carrier,{ATT:3,MIL:5,DEF:1});
  assert.deepEqual(ROLE_WEIGHTS.partner,{ATT:5,MIL:3,DEF:1});
  assert.deepEqual(ROLE_WEIGHTS.defender,{ATT:1,MIL:2,DEF:5});
});
test('2-2-2 : total porteur 18 parts et chaque MIL exactement 5/18',()=>{
  let out=[];
  for(let i=0;i<18;i++)out.push(selectRole(a,'carrier',{rng:()=> (i+0.5)/18}).cardId);
  const counts=Object.fromEntries(a.slots.map(id=>[id,out.filter(x=>x===id).length]));
  assert.equal(counts.chopper,0);
  assert.deepEqual([counts.jinbe,counts.kaido,counts.shanks,counts.nami,counts.luffy,counts.zoro],[1,1,5,5,3,3]);
});
test('Le gardien ne peut être ni porteur, ni partenaire, ni défenseur',()=>{
  for(const role of Object.keys(ROLE_WEIGHTS)){
    for(const n of [0,0.1,0.5,0.999999]){
      assert.notEqual(selectRole(a,role,{rng:()=>n}).cardId,'chopper');
      assert.notEqual(selectRole(b,role,{rng:()=>n}).cardId,'loki');
    }
  }
});
test('Porteur / partenaire différents, et défenseur adverse',()=>{
  const prepared=prepareOpenPlayRoles(a,b,scripted(0,0,0,0));
  assert.equal(prepared.carrier.cardId,'jinbe');
  assert.equal(prepared.partner.cardId,'kaido');
  assert.equal(prepared.defender.cardId,'mihawk');
  assert.notEqual(prepared.carrier.cardId,prepared.partner.cardId);
  assert.equal(prepared.finishers.COMBINER,prepared.carrier.cardId);
});
test('Finisseurs décidés avant tactiques : 50/50 combinaison, passer et percer fixes',()=>{
  const first=prepareOpenPlayRoles(a,b,scripted(.1,.6,.2,.499999));
  const second=prepareOpenPlayRoles(a,b,scripted(.1,.6,.2,.5));
  assert.equal(finisherFor(first,'COMBINER'),first.carrier.cardId);
  assert.equal(finisherFor(second,'COMBINER'),second.partner.cardId);
  for(const roles of [first,second]){
    assert.equal(finisherFor(roles,'LANCER'),roles.partner.cardId);
    assert.equal(finisherFor(roles,'PERCER'),roles.carrier.cardId);
    assert.ok(Object.isFrozen(roles));
    assert.ok(Object.isFrozen(roles.finishers));
    assert.ok(Object.isFrozen(roles.carrier.stats));
  }
});
test('Réceptionneur corner et coup franc : partenaire pondéré hors passeur',()=>{
  const r=selectSetPieceReceiver(a,'luffy',()=>0);
  assert.equal(r.cardId,'jinbe');
  for(const n of [0,.2,.5,.8,.9999]){
    const v=selectSetPieceReceiver(a,'shanks',()=>n);
    assert.notEqual(v.cardId,'shanks');assert.notEqual(v.cardId,'chopper');
  }
});
test('Le poste réel commande les poids, même hors poste naturel et dans les 7 formations',()=>{
  const swapped={formation:'2-2-2',slots:['chopper','luffy','kaido','shanks','nami','jinbe','zoro']};
  assert.equal(selectRole(swapped,'carrier',{rng:()=>0}).cardId,'luffy'); // DEF ×1, pas ATT ×3
  for(const formation of ['2-2-2','2-3-1','1-2-3','3-2-1','1-3-2','2-1-3','3-1-2']){
    const team={formation,slots:a.slots};
    assert.equal(formationPositions(formation).length,7);
    const x=prepareOpenPlayRoles(team,b,()=>0);
    assert.ok(x.carrier.cardId);assert.ok(x.partner.cardId);assert.ok(x.defender.cardId);
    assert.notEqual(x.partner.cardId,x.carrier.cardId);
  }
});
test('Appels invalides ou composition incomplète refusés',()=>{
  assert.throws(()=>selectRole(a,'inconnu'),/Rôle/);
  assert.throws(()=>selectRole({...a,slots:['chopper',null,...a.slots.slice(2)]},'carrier'),/complète/);
  assert.throws(()=>selectRole({...a,slots:['chopper','chopper',...a.slots.slice(2)]},'carrier'),/Doublon/);
  assert.throws(()=>selectRole(a,'partner',{excludeIds:a.slots.slice(1),rng:()=>0}),/Aucun joueur/);
  assert.throws(()=>selectSetPieceReceiver(a,'loki'),/absent/);
  assert.throws(()=>selectRole(a,'carrier',{rng:()=>1}),/Tirage/);
  assert.throws(()=>selectRole(a,'carrier',{rng:()=>-0.1}),/Tirage/);
  assert.throws(()=>finisherFor(null,'COMBINER'),/préparés/);
  assert.throws(()=>finisherFor({finishers:{}},'EXTRA'),/Tactique/);
});
test('Sélection statistique stable : un milieu ≈ 5/18 sur 18 000 tirages',()=>{
  let seed=123456789;const rng=()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);
  let count=0;
  for(let i=0;i<18000;i++)if(selectRole(a,'carrier',{rng}).cardId==='shanks')count++;
  assert.ok(Math.abs(count/18000-5/18)<0.025,String(count));
});
