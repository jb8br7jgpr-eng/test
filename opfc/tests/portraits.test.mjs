import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {CARDS} from '../catalog.mjs';
import {availablePortraitIds,portraitFile,renderCharacterPortrait} from '../ui-portraits.mjs';

test('Les 50 personnages OPFC possèdent chacun leur véritable portrait WebP',()=>{
 assert.equal(CARDS.length,50);
 assert.equal(availablePortraitIds.length,50);
 const paths=CARDS.map(card=>{
  const path=portraitFile(card.id);
  assert.ok(path,`Portrait absent pour ${card.id}`);
  assert.match(path,/^\.\/portraits_opfc\/[a-z0-9-]+\.webp$/);
  assert.ok(renderCharacterPortrait(card.id).includes('src="'+path+'"'));
  const file=readFileSync(new URL('../../'+path.slice(2),import.meta.url));
  assert.ok(file.length>1000,`Fichier vide ou tronqué : ${path}`);
  assert.equal(file.toString('ascii',0,4),'RIFF',`En-tête RIFF invalide : ${path}`);
  assert.equal(file.toString('ascii',8,12),'WEBP',`Fichier non WebP : ${path}`);
  return path;
 });
 assert.equal(new Set(paths).size,50,'Chaque personnage doit utiliser son propre fichier');
 const assets=readdirSync(new URL('../../portraits_opfc/',import.meta.url))
  .filter(name=>name.endsWith('.webp'));
 assert.equal(assets.length,50,'Le dossier doit contenir exactement 50 portraits WebP');
 assert.deepEqual(assets.sort(),paths.map(path=>path.split('/').at(-1)).sort());
});

test('Les écrans du mode local utilisent le module commun de portraits originaux',()=>{
 for(const module of ['ui.mjs','ui-match.mjs','ui-set-piece.mjs','ui-shootout.mjs','ui-final.mjs']){
  const code=readFileSync(new URL('../'+module,import.meta.url),'utf8');
  assert.match(code,/from '\.\/ui-portraits\.mjs'/,module);
  assert.match(code,/renderCharacterPortrait/,module);
 }
});
