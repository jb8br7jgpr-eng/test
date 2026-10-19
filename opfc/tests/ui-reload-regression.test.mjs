import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,ready} from '../engine.mjs';
import {dispatchOpenMatch} from '../ui-match.mjs';
import {resolveMatchMoment,continueMatch,resumeMatch} from '../match.mjs';

const key='opfc-v08-local-dev';
const store=new Map();
const handlers=new Map();
const app={innerHTML:'',addEventListener(name,fn){handlers.set(name,fn);}};
globalThis.localStorage={
 getItem:k=>store.get(k)??null,
 setItem:(k,v)=>store.set(k,v),
 removeItem:k=>store.delete(k)
};
globalThis.document={getElementById:id=>id==='opfc-app'?app:null};
const random=seed=>()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);
const PSG=['chopper','jinbe','kaido','shanks','nami','luffy','zoro'];
const OM=['loki','mihawk','monkey-d-garp','katakuri','sabo','sanji','kizaru'];
function prepared(){
 const s=createGame({dice:[5,2],rng:random(5)});
 s.phase='kickoff-ready';s.auction=null;
 for(const t of s.teams){t.roster=[...(t.club==='PSG'?PSG:OM)];t.slots=[...t.roster];t.formation='2-2-2';t.ready=true;}
 return s;
}
const state=()=>JSON.parse(store.get(key)).game;
function seed(s){store.set(key,JSON.stringify({game:s,firstClub:'PSG',beforeForm:{PSG:'2-2-2',OM:'2-2-2'}}));}
async function reload(){
 handlers.clear();
 await import('../ui.mjs?regression-reload='+Math.random());
}
function click(action,data={}){
 const btn={dataset:{action,...data},disabled:false};
 handlers.get('click')({target:{closest(){return btn;}}});
}
test('Rechargement pendant un choix confidentiel : écran couvert et tactique précédente invisible',async()=>{
 let s;
 for(let n=1;n<=200;n++){
   const candidate=dispatchOpenMatch(prepared(),'kickoff',{rng:random(n)});
   if(candidate.match.schedule[0].type==='open'){s=candidate;break;}
 }
 assert.ok(s,'Un calendrier commençant par une action ouverte existe');
 s=dispatchOpenMatch(s,'begin-open',{rng:()=>.3});
 seed(s);await reload();
 assert.match(app.innerHTML,/Passe le téléphone/);
 assert.doesNotMatch(app.innerHTML,/data-choice="COMBINER"/);
 click('match-uncover');
 assert.match(app.innerHTML,/data-choice="COMBINER"/);
 click('match-choose',{choice:'COMBINER'});
 assert.equal(state().match.action.stage,'defense-choice');
 assert.match(app.innerHTML,/Passe le téléphone/);
 assert.doesNotMatch(app.innerHTML,/data-choice="COMBINER"/);
 await reload();
 assert.match(app.innerHTML,/Passe le téléphone/);
 assert.doesNotMatch(app.innerHTML,/data-choice="COMBINER"/);
 click('match-uncover');
 assert.match(app.innerHTML,/data-choice="PRESSER"/);
 assert.doesNotMatch(app.innerHTML,/data-choice="COMBINER"/);
});
test('Rechargement à la mi-temps puis reprise via le bouton réel',async()=>{
 let s=dispatchOpenMatch(prepared(),'kickoff',{rng:random(31)});
 for(let n=0;s.phase!=='half-time';n++){
   assert.ok(n<30,'La première période doit se terminer');
   if(s.phase==='moment-result'){s=continueMatch(s);continue;}
   assert.equal(s.phase,'match');
   s=resolveMatchMoment(s,{outcome:'stopped'});
 }
 assert.equal(s.phase,'half-time');
 for(const club of ['PSG','OM'])s=ready(s,club);
 assert.equal(s.phase,'resume-ready');
 seed(s);await reload();
 assert.match(app.innerHTML,/Reprendre la deuxième mi-temps/);
 click('match-resume');
 assert.equal(state().phase,'match');
 assert.equal(state().match.score.PSG,0);
});
test('Rechargement de la feuille finale : statistiques et résultat conservés',async()=>{
 let s=dispatchOpenMatch(prepared(),'kickoff',{rng:random(12)});
 for(let n=0;!['finished','shootout-ready'].includes(s.phase);n++){
   assert.ok(n<45);
   if(s.phase==='half-time'){s=ready(ready(s,'PSG'),'OM');s=resumeMatch(s);continue;}
   if(s.phase==='moment-result'){s=continueMatch(s);continue;}
   const attacker=s.match.schedule[s.match.index].attacker;
   s=resolveMatchMoment(s,{outcome:attacker==='PSG'?'goal':'stopped',scorerId:attacker==='PSG'?s.teams.find(t=>t.club==='PSG').slots[5]:null});
 }
 assert.equal(s.phase,'finished');
 seed(s);await reload();
 assert.match(app.innerHTML,/Buteurs du match/);
 assert.match(app.innerHTML,/Statistiques comparées/);
 assert.match(app.innerHTML,/Victoire de Pirates Saint-Grandline/);
 assert.equal(state().match.winner,'PSG');
});
