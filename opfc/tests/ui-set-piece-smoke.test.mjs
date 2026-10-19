import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../engine.mjs';
import {kickoffMatch} from '../match.mjs';

const PSG=['chopper','jinbe','kaido','shanks','nami','luffy','zoro'];
const OM=['loki','mihawk','monkey-d-garp','katakuri','sabo','sanji','kizaru'];
const seeded=start=>()=>((start=(Math.imul(1664525,start)+1013904223)>>>0)/4294967296);
function getPenaltyMatch(){
 const base=createGame({dice:[5,2],rng:seeded(1)});
 base.phase='kickoff-ready';base.auction=null;
 for(const t of base.teams){t.roster=[...(t.club==='PSG'?PSG:OM)];t.slots=[...t.roster];t.ready=true;t.formation='2-2-2';}
 for(let i=1;i<1200;i++){
  const s=kickoffMatch(base,seeded(i));
  if(s.match.schedule[0].type==='penalty')return s;
 }
 throw Error('Aucun penalty en première séquence');
}
const cache=new Map(),listeners={};
const root={innerHTML:'',addEventListener:(event,callback)=>{listeners[event]=callback;}};
const fixture=getPenaltyMatch();
cache.set('opfc-v08-local-dev',JSON.stringify({game:fixture,firstClub:'PSG',beforeForm:{PSG:'2-2-2',OM:'2-2-2'}}));
globalThis.localStorage={
 getItem:key=>cache.get(key)??null,
 setItem:(key,val)=>cache.set(key,val),
 removeItem:key=>cache.delete(key)
};
globalThis.document={getElementById:id=>id==='opfc-app'?root:null};
await import('../ui.mjs');
const game=()=>JSON.parse(cache.get('opfc-v08-local-dev')).game;
const click=(action,data={})=>listeners.click({target:{closest:()=>({dataset:{action,...data},disabled:false})}});
test('Écran navigateur : penalty direct, transmission confidentielle, résultat et Continuer',()=>{
 assert.match(root.innerHTML,/Penalty/);
 assert.match(root.innerHTML,/Commencer cette phase arrêtée/);
 click('match-begin-setpiece');
 assert.match(root.innerHTML,/Passe le téléphone/);
 assert.doesNotMatch(root.innerHTML,/data-action="match-taker"/);
 click('match-uncover');
 assert.match(root.innerHTML,/Choisis le tireur/);
 const id=game().teams.find(t=>t.club===game().match.action.attacker).slots[4];
 click('match-taker',{card:id});
 assert.equal(game().match.action.stage,'attack-choice');
 assert.match(root.innerHTML,/Passe le téléphone/);
 click('match-uncover');
 assert.match(root.innerHTML,/data-choice="GAUCHE"/);
 click('match-choose',{choice:'GAUCHE'});
 assert.equal(game().match.action.choices.attack,'GAUCHE');
 assert.match(root.innerHTML,/Passe le téléphone/);
 assert.doesNotMatch(root.innerHTML,/Les deux directions sont verrouillées/);
 click('match-uncover');
 click('match-choose',{choice:'DROITE'});
 assert.equal(game().match.action.stage,'penalty-ready');
 assert.match(root.innerHTML,/Révéler les directions/);
 click('match-reveal-penalty');
 assert.equal(game().phase,'moment-result');
 assert.equal(game().match.history.length,1);
 assert.match(root.innerHTML,/Continuer/);
 click('match-continue-result');
 assert.equal(game().match.index,1);
 assert.ok(game().phase==='match'||game().phase==='half-time');
});
