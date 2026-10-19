# OPMercato FC — Le Classique de Grand Line

## État sur `opfc-development`

Le **mode local** comprend : 50 personnages et portraits, mercato, enchères, terrains, compositions, actions, mi-temps, corners, coups francs, penalties, tirs au but et résultat final.

Le **mode en ligne** comprend : salons privés à deux joueurs, enchères et compositions synchronisées, choix tactiques confidentiels, actions du match, mi-temps, tirs au but et écran final. L'interface iPhone est raccordée aux commandes serveur.

### Backend dédié — opérationnel

- Projet Supabase indépendant : `OPMercato FC`, `cihzwaxernachchpjktj` (Paris, `eu-west-3`).
- Base `public.opfc_rooms`, RLS activé, aucun accès direct aux joueurs.
- Fonction Edge `opfc-online` installée ; seuls les jetons individuels authentifient les salons et les commandes.
- `opfc/online-config.mjs` pointe vers la véritable fonction de ce projet sur la branche de développement.
- Un test **réel** via GitHub Actions a validé la création d'un salon, deux participants, une enchère, la lecture synchronisée, le rejet d'une version obsolète et d'un jeton invalide.

**IMPORTANT : le site OPFC n'est toujours pas déployé publiquement.** La branche `main` et OPMercato classique restent inchangés. ARCHIPEL est en pause, pas supprimé. Ne pas modifier les backends de ces jeux.

## Vérification

- `node --test opfc/tests/*.test.mjs` : moteur, vues publiques et choix privés, interactions locales/réseau.
- `opfc/browser/mobile-preview.mjs` : parcours complet du mode local sur iPhone simulé.
- `opfc/browser/online-dual-preview.mjs` : deux navigateurs iPhone connectés à un serveur simulé reproduisant les transitions officielles.
- `opfc/browser/real-edge-smoke.mjs` : test HTTP d'intégration contre le **vrai** backend OPFC, exécuté par `.github/workflows/opfc-real-edge-smoke.yml`.

## Restant avant publication

1. Ajouter des limites de débit / protections anti-abus aux points d'entrée anonymes `create` et `join`.
2. Tester un match complet sur le **vrai** serveur avec deux téléphones physiques, y compris perte de réseau, reconnexion et confidentialité.
3. Valider visuellement les deux modes dans leur version publique.
4. Obtenir le feu vert **séparé** de l'utilisateur avant fusion ou déploiement du site.

Voir `ONLINE_SETUP.md` pour la configuration du service.
