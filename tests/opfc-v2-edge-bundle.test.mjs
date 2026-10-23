/** Vérifie la fermeture du graphe de dépendances de la fonction Edge V2.
 * Exécuter : node --test tests/opfc-v2-edge-bundle.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {access,readFile,readdir} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const project=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const edge=join(project,'supabase/functions/opfc-online');
const importsOf=source=>[...source.matchAll(/\b(?:from\s*|import\s*)['"]([^'"]+)['"]/g)].map(x=>x[1]);
const isLocal=s=>s.startsWith('./')||s.startsWith('../');

test('Toutes les dépendances du serveur OPFC V2 existent et sont importables localement',async()=>{
 const list=['index.ts',...((await readdir(join(edge,'opfc'))).map(f=>'opfc/'+f))
  .filter(f=>f.endsWith('.mjs'))];
 assert.ok(list.includes('opfc/player-performance.mjs'));
 assert.ok(list.includes('opfc/stadiums.mjs'));
 for(const file of list){
  const source=await readFile(join(edge,file),'utf8');
  for(const imp of importsOf(source)){
   if(!isLocal(imp))continue;
   assert.equal(imp.includes('?'),false,file+': import avec query string non supporté : '+imp);
   const target=resolve(dirname(join(edge,file)),imp);
   assert.ok(target.startsWith(edge+'/'),file+': import hors du bundle : '+imp);
   await access(target);
  }
 }
});

test('Les cinq moteurs partagés avec le serveur sont strictement alignés',async()=>{
 const shared=['online-market.mjs','online-lineup.mjs','online-match.mjs',
  'match-actions.mjs','set-piece-actions.mjs'];
 for(const name of shared){
  const browser=await readFile(join(project,'opfc',name),'utf8');
  const server=await readFile(join(edge,'opfc',name),'utf8');
  // Les paramètres de version sont seulement destinés au cache du navigateur.
  const normal=browser.replace(/(from ['"]\.\/[^'"]+?)\?v=[^'"]+(['"])/g,'$1$2');
  assert.equal(server,normal,'Code de match divergent entre local et en ligne : '+name);
 }
});

test('Le serveur V2 calcule l’Ancre et reçoit le stade sans exposer de secret',async()=>{
 const source=await readFile(join(edge,'index.ts'),'utf8');
 assert.ok(source.includes("import {matchPerformances} from './opfc/player-performance.mjs'"));
 assert.ok(source.includes("import {isStadium} from './opfc/stadiums.mjs'"));
 assert.ok(source.includes('initial.playerStatsVersion=2'));
 assert.ok(source.includes('transition.state.match.playerStats=stats.players'));
});
