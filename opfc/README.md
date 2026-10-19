# OPMercato FC — Le Classique de Grand Line

## Statut sur `opfc-development`
Jeu local : mercato, placements, match, mi-temps, coups de pied arrêtés, penalties, tirs au but, statistiques et victoire.
50 personnages avec portraits WebP ; deux clubs et 7 joueurs par équipe.
Jeu en ligne : protocole privé, autorité serveur pour toutes les phases, interface mobile raccordée aux commandes et synchronisation par salon à deux joueurs.

**Aucun déploiement public d'OPFC ni de backend OPFC.**
La branche `main`, OPMercato classique, ARCHIPEL et leurs backends doivent rester inchangés sans accord explicite.

## Tests
- `node --test opfc/tests/*.test.mjs` : moteur, affichage public, confidentialité, concurrence, marché, compositions, match et fin.
- `opfc/browser/mobile-preview.mjs` : parcours local sur Chrome aux largeurs iPhone.
- `opfc/browser/online-dual-preview.mjs` : deux navigateurs mobiles et serveur simulé exécutant les transitions officielles, **sans backend réel**.
- GitHub Actions : `opfc-regression.yml`, `opfc-engine-tests.yml`, `opfc-mobile-preview.yml`.

## Étapes restantes
1. Autorisation explicite et vérification du coût d'un projet Supabase **OPFC dédié**.
2. Schéma SQL, limites de débit, déploiement Edge et configuration de l'URL dans `opfc/online-config.mjs`, uniquement dans le nouveau projet.
3. Recette réelle à deux iPhone : reconnexion, réseau instable, interruptions, parties complètes et confidentialité.
4. Accord explicite séparé avant déploiement du site / fusion sur `main`.

Voir `ONLINE_SETUP.md` pour le plan de mise en service.
