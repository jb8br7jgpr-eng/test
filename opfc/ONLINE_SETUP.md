# OPFC — Préparation du mode en ligne (10A4)

**Statut :** interface et moteur réseau développés sur `opfc-development` et contrôlés avec deux navigateurs mobiles et un serveur simulé. **Aucun backend OPFC réel n'a encore été créé, configuré ou déployé. Aucun déploiement du site.**

## Isolation impérative

OPFC doit avoir son propre projet Supabase. Ne pas modifier les deux projets existants :
- OPMercato classique : `nezqupnhcqwuewfilioa`
- ARCHIPEL : `lrmgtnbxujdvswaykyxi`

Les modifications de `main`, de `classique.html` ou des fonctions/SQL de ces deux projets restent interdites sans accord explicite.

## Code déjà prêt dans le dépôt

- `opfc/online-protocol.mjs` : salons à code privé, jetons aléatoires de 256 bits, association jeton → club, rôle et vues filtrées.
- `opfc/online-market.mjs`, `online-lineup.mjs`, `online-match.mjs`, `online-set-piece.mjs`, `online-endgame.mjs` : transitions serveur officielles pour mercato, formations, matchs, phases arrêtées, mi-temps, TAB, finale.
- `opfc/online-client.mjs` : appels HTTP avec version, conservation locale du jeton personnel et actualisation.
- `opfc/ui.mjs`, `ui-online.mjs`, `ui-online-game.mjs` : interface de salon et jeu connecté sur iPhone, boutons réservés à chaque club.
- `supabase/opfc-schema.sql` : table `opfc_rooms`, état privé, hash des jetons, verrou de version, RLS et expiration.
- `supabase/functions/opfc-online/index.ts` : fonction Edge `opfc-online` avec POST `create`, `join`, `get`, `market`, `lineup`, `match` ; CORS pour l'origine du site et les en-têtes `Content-Type` / `Cache-Control`.

### Garanties
Les requêtes de jeu identifient le club via **son jeton personnel**, jamais un club fourni par le client. Le serveur conserve le paquet, les choix privés et le programme des séquences. La vue envoyée aux iPhone exclut les données secrètes. Les écritures concurrentes utilisent `expectedVersion` et répondent 409 si l'état a changé.

Les tests unitaires et tests iPhone sur serveur simulé ne remplacent PAS un test réseau réel : aucune assertion de disponibilité réelle du backend n'est faite.

## Conditions avant mise en service

1. Demander l'accord de l'utilisateur sur **l'organisation Supabase**, le coût présenté par Supabase et la création d'un **troisième projet indépendant**.
2. Créer uniquement le projet approuvé, de préférence dans la région française `eu-west-3`, puis appliquer `supabase/opfc-schema.sql` uniquement dans ce projet.
3. Prévoir des limites de débit et une protection anti-abus sur les actions anonymes `create` et `join`. Le contrôle d'origine CORS n'est pas une protection suffisante contre les scripts hors navigateur.
4. Déployer exclusivement la fonction `opfc-online` du projet approuvé avec configuration adaptée aux actions anonymes. Conserver les clés `service_role` exclusivement côté serveur et définir `OPFC_ALLOWED_ORIGIN=https://jb8br7jgpr-eng.github.io`.
5. Renseigner dans `opfc/online-config.mjs` **uniquement** l'URL Edge OPFC et, si nécessaire, la clé **publique**, jamais une clé de service.
6. Vérifier le fonctionnement sur **deux vrais iPhone**, avec un réseau réel : entrée de salon, mercato complet, compositions, choix secrets, résultat final, reconnexion, sécurité, erreurs et conflits.
7. Obtenir une **autorisation distincte** avant fusion sur `main` et déploiement du site accessible au public.

La création d'un projet ou l'application de SQL et de fonctions sont des actions distantes, interdites sans autorisation expresse.
