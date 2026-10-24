import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CARDS} from '../opfc/catalog.mjs';
import {STADIUMS} from '../opfc/stadiums.mjs';
import {renderPrematch} from '../opfc/prematch.mjs';
import {renderMatchScreen,renderOnlineMatchScreen} from '../opfc/ui-match.mjs';
const file=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const reserved=new Set();
const take=position=>{
 const player=CARDS.find(p=>p.position===position&&!reserved.has(p.id));
 assert.ok(player,'Personnage disponible en '+position);
 reserved.add(player.id);return player.id;
};
const mk=club=>{
 const slots=['GAR','DEF','DEF','MIL','MIL','ATT','ATT'].map(take);
 return {club,identityId:club,formation:'2-2-2',slots,roster:[...slots],ready:false,budget:100,refusals:0};
};
const state=()=>({
 phase:'half-time',competition:'league',stadiumId:'mugiwara',
 teams:[mk('PSG'),mk('OM')],
 match:{minute:45,competition:'league',score:{PSG:0,OM:0},
 statistics:{PSG:{shots:1,onTarget:1,saves:0},OM:{shots:1,onTarget:0,saves:1}},
 history:[],goals:[],action:null}
});
test('Validation mi-temps locale : deux vrais boutons immédiatement au-dessus du terrain',()=>{
 const html=renderMatchScreen(state());
 assert.equal((html.match(/data-action="ready"/g)||[]).length,2);
 assert.ok(html.includes('data-club="PSG"'));
 assert.ok(html.includes('data-club="OM"'));
 assert.ok(html.indexOf('v3-half-ready-card')>html.indexOf('Bilan de la première période'));
});
test('Validation mi-temps en ligne : uniquement le club connecté peut valider',()=>{
 const html=renderOnlineMatchScreen(state(),{myClub:'PSG',hostClub:'PSG'});
 assert.equal((html.match(/data-action="ready"/g)||[]).length,1);
 assert.ok(html.includes('data-club="PSG"'));
 assert.ok(!html.includes('data-action="ready" data-club="OM"'));
 assert.ok(html.includes('En attente de l’autre équipe'));
});
test('Bouton du coup d’envoi avant les compositions détaillées, sans doublon',()=>{
 const s=state();s.phase='kickoff-ready';
 const html=renderPrematch(s);
 assert.equal((html.match(/data-action="match-kickoff"/g)||[]).length,1);
 assert.ok(html.indexOf('data-action="match-kickoff"')<html.indexOf('Compositions officielles'));
 const waiting=renderPrematch(s,{canKickoff:false,waitingMessage:'Attente adversaire'});
 assert.equal((waiting.match(/data-action="match-kickoff"/g)||[]).length,0);
 assert.ok(waiting.indexOf('Attente adversaire')<waiting.indexOf('Compositions officielles'));
});
test('Palette visuellement assumée pour chacun des huit stades, sans toucher au barème des actions',()=>{
 const base=file('../opfc/v3-match.css'),palette=file('../opfc/v3-palette-boost.css');
 const html=file('../opfc.html'),ui=file('../opfc/ui.mjs');
 for(const stadium of STADIUMS)
  assert.ok(base.includes('data-v3-stadium="'+stadium.id+'"'),'palette manquante '+stadium.id);
 for(const sel of ['match-scoreboard','halftime-tactics','opfc-prematch-team','match-faceoff','final-screen'])
  assert.ok(palette.includes(sel),'sélecteur manquant '+sel);
 assert.ok(palette.includes('color-mix('));
 assert.ok(palette.includes('v3-ready-cta'));
 assert.ok(palette.includes('.match-stage:not(.shot-result-panel)'));
 assert.ok(html.includes('v3-palette-boost.css'));
 assert.ok(ui.includes("const themePhases=['lineup'"));
 assert.ok(ui.includes('v3ReadyStrip()+teams()'));
 assert.ok(ui.includes('v3ReadyStrip({onlineClub:ownClub})'));
 assert.ok(!palette.includes('.match-action-type.type-difficile{'));
 assert.ok(!palette.includes('.match-tactical-choices>.match-choice{'));
});
