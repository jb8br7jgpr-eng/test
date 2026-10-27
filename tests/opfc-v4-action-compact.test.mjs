/** OPFC — anti-régression CSS de la charte des actions compactes.
 * Aucun calcul, portrait, résultat ou sélecteur de l'autre jeu n'est touché. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const style=read('opfc/v4-action-compact.css');
const page=read('opfc.html');
const match=read('opfc/ui-match.mjs');
const setpiece=read('opfc/ui-set-piece.mjs');
const shootout=read('opfc/ui-shootout.mjs');
const widgets=read('opfc/ui-match-widgets.mjs');

test('Feuille CSS isolée et chargée en dernier uniquement dans OPFC',()=>{
 const link='./opfc/v4-action-compact.css?v=opfc-action-compact-20261028';
 assert.ok(page.includes(link));
 assert.ok(page.indexOf(link)>page.indexOf('ui-classic-auction.css'));
 assert.ok(style.includes('#opfc-app'));
 assert.ok(style.includes(':not(.shot-result-panel)'));
 assert.ok(!style.includes('display:none'));
 assert.ok(!style.includes('text-overflow:ellipsis'));
});

test('Trois colonnes de tactiques, deux pour les sept tireurs, contenu intégral',()=>{
 assert.ok(style.includes('grid-template-columns:repeat(3,minmax(0,1fr))'));
 assert.ok(style.includes('grid-template-columns:repeat(2,minmax(0,1fr))'));
 assert.ok(style.includes(':has(.setpiece-taker)'));
 assert.ok(style.includes('grid-column:1/-1'));
 assert.ok(style.includes('max-width:120px'));
 assert.ok(style.includes('max-width:108px'));
 assert.ok(style.includes('.match-keeper-hint'));
 assert.ok(style.includes('font-size:10px'));
 assert.ok(style.includes('.match-shot-recommendation'));
 assert.ok(style.includes('.receiver-card-warning')===false); // le signal reste rendu par le moteur existant
 assert.ok(setpiece.includes('const ids=team?.slots??[]'));
 assert.ok(setpiece.includes("renderCharacterPortrait(id,'setpiece-taker-portrait')"));
});

test('Aides existantes et commandes local / en ligne inchangées',()=>{
 for(const message of [
  'Contre surtout le dribble','Contre surtout la passe en profondeur',
  'Contre surtout la passe courte','Contre surtout le ballon piqué',
  'Contre surtout la frappe placée','Contre surtout la frappe puissante',
  'Contre surtout la frappe directe','Contre surtout le centre',
  'Contre surtout la combinaison courte'
 ])assert.ok(widgets.includes(message),'Aide perdue : '+message);
 assert.ok(match.includes("['LANCER','Passe en profondeur']"));
 assert.ok(setpiece.includes("'corner-gesture-choice'"));
 assert.ok(shootout.includes('match-shootout-choose'));
 assert.ok(widgets.includes('data-recommended'));
});

test('Styles réservés aux choix ou transitions, non aux résultats',()=>{
 // Les résultats sont un composant autonome « .shot-result-panel ».
 assert.ok(style.includes('.match-stage:not(.shot-result-panel)'));
 assert.ok(style.includes(':has(.match-faceoff-immersive)'));
 assert.ok(style.includes(':has(.match-tactical-choices)'));
 assert.ok(style.includes('#opfc-app .match-handover'));
 assert.ok(!/\.shot-result-panel\s*\{/.test(style));
 assert.ok(!/\.shot-result-unified\s*\{/.test(style));
 assert.ok(!/\.final-screen\s*\{/.test(style));
});
