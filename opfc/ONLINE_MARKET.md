# OPFC — Bloc 10A3A : synchronisation du mercato (non déployé)

**Statut :** moteur du marché partagé et protocole client/Edge développés sur \`opfc-development\`. Aucun projet Supabase créé, aucune migration exécutée, aucun déploiement ni modification du mode classique.

## Flux sécurisé à deux téléphones

1. Chaque joueur rejoint le salon préparé aux blocs 10A1/10A2.
2. \`POST {action:"get",roomId,token}\` renvoie un \`room\` et, lorsque le deuxième joueur est connecté, \`game\` — uniquement une **vue filtrée** du mercato et du club authentifié.
3. \`POST {action:"market",roomId,token,expectedVersion,command}\` accepte les commandes strictement limitées à \`bid\`, \`pass\`, \`kings\`, \`observation\` et \`solo\`. La commande \`bid\` demande un \`amount\` entier.
4. Le serveur identifie le club depuis le **jeton privé**, lit son état maître côté serveur et appelle directement les fonctions de \`engine.mjs\`. Le client ne peut ni choisir le club, ni envoyer ses propres règles, ni transmettre un état complet.
5. La base de données ne sauvegarde l'action que si \`version\` correspond à \`expectedVersion\` et \`status\` est \`ready\`. Toute collision renvoie HTTP 409 ; l'autre iPhone peut actualiser au lieu d'écraser la dernière enchère.
6. Le jeu conserve les révélations d'Observation dans la section \`onlinePrivate\` de l'état serveur. Elles sont restituées **uniquement au joueur concerné** après une reconnexion. L'autre club ne voit jamais les cinq cartes.
7. Le serveur ne publie jamais le paquet, son curseur, l'historique interne, le jeton ni \`onlinePrivate\`. La synchronisation demeure une vue privée par club.

## Modules

- \`opfc/online-market.mjs\` : transitions serveur du mercato et projection publique par joueur.
- \`supabase/functions/opfc-online/index.ts\` : intégration GET / MARKET côté Edge avec authentification et verrou de version.
- \`opfc/online-client.mjs\` : \`marketGame\`, \`refreshRoom()\`, \`marketAction(command)\`.
- \`opfc/tests/online-market.test.mjs\` : sécurité des mutations et des vues, règles et tests de recrutement complet.
- \`opfc/tests/online-market-client.test.mjs\` : simulation de deux téléphones, collisions et secrets, sans accès réseau réel.

## Restant indispensable

- **10A3B** : synchroniser les compositions, le coup d'envoi, toutes les actions du match et les tactiques secrètes avec une autorité serveur à chaque transition.
- **10A4** : raccorder ces actions serveur aux interfaces iPhone existantes et gérer les erreurs réseau, la reconnexion, les remplacements visuels.
- Créer/configurer un projet Supabase OPFC **uniquement sur approbation explicite**, mettre en place les protections anti-abus, puis mener de vrais tests à deux téléphones.
- Le schéma SQL \`opfc-schema.sql\` est toujours **non appliqué**.

**Ne pas déclarer le mode en ligne jouable tant que ces étapes ne sont pas terminées.**
