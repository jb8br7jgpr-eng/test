import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';

// Contrat statique de préparation : jamais d'appel réseau ni de provisionnement.
// Protège les intégrations critiques sur la branche de développement.
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const content=p=>readFileSync(resolve(root,p),'utf8');
test('Un projet Supabase OPFC dédié doit rester non configuré avant accord explicite',()=>{
 const config=content('opfc/online-config.mjs');
 assert.match(config,/OPFC_ONLINE_API_URL=''/);
 assert.match(config,/OPFC_ONLINE_PUBLISHABLE_KEY=''/);
 assert.doesNotMatch(config,/nezqupnhcqwuewfilioa|lrmgtnbxujdvswaykyxi/);
});
test('Edge accepte les en-têtes réels des fetch de l’iPhone, avec origine limitée',()=>{
 const edge=content('supabase/functions/opfc-online/index.ts');
 assert.match(edge,/Access-Control-Allow-Headers[^;\n]*Cache-Control/);
 assert.match(edge,/Access-Control-Allow-Headers[^;\n]*Content-Type/);
 assert.match(edge,/Access-Control-Allow-Origin/);
 assert.match(edge,/requestOrigin&&requestOrigin!==origin/);
 assert.match(edge,/Content-Length/);
 assert.match(edge,/if\(body\.action==='create'\)/);
 assert.match(edge,/if\(body\.action==='join'\)/);
 assert.match(edge,/if\(body\.action==='get'\)/);
 for(const action of ['market','lineup','match'])
  assert.ok(edge.includes("if(body.action==='"+action+"')"));
 assert.match(edge,/expectedVersion/);
 assert.doesNotMatch(edge,/host_token_hash.*response\(/);
});
test('Le SQL isole l’état privé et impose un contrôle d’accès service_role',()=>{
 const sql=content('supabase/opfc-schema.sql');
 assert.match(sql,/opfc_rooms/);
 assert.match(sql,/private_state jsonb not null/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/revoke all privileges/);
 assert.match(sql,/service_role/);
 assert.match(sql,/expires_at/);
});
