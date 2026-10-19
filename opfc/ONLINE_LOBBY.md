# OPFC — Bloc 10A2 : salons privés sur iPhone (non déployés)

**Statut :** interface et client réseau préparés sur \`opfc-development\`, sans serveur OPFC connecté et sans changement de \`main\`.

## Parcours préparé

1. Depuis l'accueil OPFC, toucher **Mode en ligne · salons privés**.
2. **Créer une partie** : le club de l'hôte reste celui choisi à l'accueil ; le serveur générera un code à six caractères.
3. **Rejoindre une partie** : saisir ce code sur le deuxième iPhone ; le deuxième joueur obtient le club opposé.
4. **Salon** : afficher le code, copier uniquement le code, montrer la présence de l'adversaire, actualiser manuellement et, lorsque le backend existe, actualiser automatiquement toutes les quatre secondes pendant l'attente.
5. **Reprise** : conserver le jeton privé dans une clé locale dédiée \`opfc-v1-online-session\` ; relire le salon après rechargement du navigateur.
6. **Quitter sur cet appareil** : effacer seulement la session locale du salon après confirmation ; ne pas supprimer le salon serveur ni la sauvegarde du jeu local.

## Séparation stricte

- \`opfc/online-config.mjs\` contient actuellement une URL vide. Les opérations créer/rejoindre sont **désactivées** tant qu'un vrai projet Supabase OPFC dédié n'est pas approuvé, créé et déployé.
- \`opfc/online-client.mjs\` valide les réponses de l'API, n'envoie jamais les jetons en URL, utilise uniquement POST/HTTPS, refuse les projets Supabase de OPMercato classique et ARCHIPEL.
- \`opfc/ui-online.mjs\` affiche uniquement les données de salon visibles par les joueurs. Aucun jeton de session n'est injecté dans le HTML.
- Le jeu **local** garde sa propre sauvegarde \`opfc-v08-local-dev\` et demeure indépendant du salon.
- Même lorsqu'un salon sera opérationnel, **les enchères et les actions de match ne sont pas encore synchronisées**. Elles nécessitent l'autorité serveur et des vues différentes selon le joueur (à développer dans les prochains blocs).

## Avant essais sur deux iPhone

Le propriétaire devra approuver un **projet Supabase OPFC séparé**. Ensuite seulement : y appliquer le schéma de \`supabase/opfc-schema.sql\`, déployer et sécuriser \`opfc-online\`, remplir l'URL dédiée dans \`opfc/online-config.mjs\` et tester sur appareils.

Aucune commande de ce bloc ne déploie le site GitHub Pages, n'applique une migration SQL, ne modifie l'Edge Function du classique ou ne crée de projet Supabase.
