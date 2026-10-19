# OPFC — Mode en ligne, bloc 10A1 (préparation seulement)

**Statut : code préparé sur la branche \`opfc-development\` ; aucun backend installé ou déployé.**

## Séparation obligatoire

Le compte Supabase dispose actuellement de deux projets : OPMercato classique
(\`nezqupnhcqwuewfilioa\`) et ARCHIPEL (\`lrmgtnbxujdvswaykyxi\`).
**Ne pas modifier ces projets pour OPFC.** Prévoir un projet Supabase OPFC dédié,
créé uniquement après autorisation explicite. Aucun changement de \`main\`,
de \`classique.html\`, ni du backend de l'ancien jeu.

## Ce qui est préparé dans le dépôt

- \`opfc/online-protocol.mjs\` : codes de salon à six caractères non ambigus,
  jetons de 256 bits, SHA-256, association jeton → rôle, création du moteur sur
  serveur avec tirages cryptographiques et vue publique explicitement filtrée.
- \`supabase/opfc-schema.sql\` : table \`opfc_rooms\`, RLS, accès service_role
  seul, état privé, jetons hachés, verrouillage de version, expiration à 7 jours.
  **Ce fichier n'est pas une migration activée et ne doit pas être exécuté
  dans un projet non approuvé.**
- \`supabase/functions/opfc-online/index.ts\` : trois actions POST :
  \`create\`, \`join\`, \`get\`. La réunion des deux iPhone se fait via un code ;
  deux \`join\` simultanés ne peuvent pas tous les deux réserver la place.
- \`opfc/tests/online-protocol.test.mjs\` : tests exécutés sur GitHub Actions.

## Contrat d'API du futur service

Créer : \`{ "action":"create", "firstClub":"PSG" }\` → jeton HÔTE +
salon (\`status: waiting\`).

Rejoindre : \`{ "action":"join", "code":"ABC234" }\` → jeton INVITÉ +
salon (\`status: ready\`).

Relire : \`{ "action":"get", "roomId":"<uuid>", "token":"<privé>" }\` →
salon actualisé (permettra au futur client iPhone de synchroniser le lobby).

Les jetons ne doivent pas être copiés dans un lien public, un journal ou
une capture d'écran. Seuls les jetons personnels sont conservés sur chaque iPhone ;
le paquet, les calculs, les choix secrets et l'état maître restent côté serveur.
L'application du jeu classique doit continuer à utiliser sa propre fonction.

## Pour une future mise en service : validations encore nécessaires

1. Accord du propriétaire pour choisir/créer un projet OPFC séparé.
2. Appliquer le SQL dans **ce nouveau projet seulement**.
3. Vérifier l'URL et les secrets Edge dans le projet dédié, définir
   \`OPFC_ALLOWED_ORIGIN=https://jb8br7jgpr-eng.github.io\`.
4. Déployer \`opfc-online\` uniquement dans le projet OPFC. Pour les actions
   anonymes create/join, cette fonction doit être déployée sans vérification
   JWT et protégée par les validations de rôle, des limites de débit et des
   protections anti-abus au niveau Edge/proxy.
5. Construire l'interface de salon et la synchronisation sur deux appareils.
6. Ensuite seulement : ajouter des actions de mercato/match côté serveur, avec
   contrôle strict du tour, versions concurrentes et **vues par joueur** pour
   préserver les Hakis et les décisions tactiques.
7. Tests réseau réels, déconnexions/reprises, puis décision séparée de
   fusion/déploiement du site.

**Ne pas présenter 10A1 comme un mode en ligne jouable** : il prépare les
salons, sans encore synchroniser les enchères ou le match complet.
