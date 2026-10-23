# OPFC — V2 : intégration en branche uniquement

Branche : `feature/opfc-stades-stats-ancre-20261023`.

## Périmètre

- 8 stades WebP officiels sélectionnés avant le mercato, affichés en avant-match.
- Avant-match : compétition, stade, écussons, 14 joueurs, postes et notes.
- Buts + portraits des passeurs décisifs sur le résultat final.
- Ancre d'Or calculée à partir des actions déjà résolues : but +5, passe D +3, offensive +1, défensive +2, arrêt +3.
- Catalogue : 4 colonnes MATCHS / BUTS / PASSES D. / ANCRES D'OR ; compteur doré de buts isolé retiré.
- Les 3 actions offensives sont inchangées : Passe courte 50/50 porteur/partenaire ; Passe en profondeur 100% partenaire ; Dribbler 100% porteur.
- Aucun score de séance de tirs au but n'est intégré aux performances individuelles.

## Sécurité et sauvegarde

- `opfc_match_results.source_key` protège de la double comptabilisation. Les déclencheurs de totaux sont **AFTER INSERT** seulement.
- Migration additive préparée : `supabase/migrations-opfc-v2/README-migration.sql`. **Ne pas exécuter sans sauvegarde et validation**.
- La migration amorce `opfc_player_totals.goals` depuis les buts déjà enregistrés et conserve les finales anciennes sans données individuelles.
- `opfc_player_totals` : lecture publique RLS, écriture réservée aux déclencheurs serveur.
- La fonction Edge V2, ainsi que toutes ses dépendances, est préparée dans `supabase/functions/opfc-online/`, mais **non déployée**.
- L'archive immuable existante `opfc_backup.immutable_match_results` conserve `to_jsonb(NEW)`, y compris les champs V2 des futures finales.
- Le jeu OPMercato classique et son projet Supabase distinct sont hors périmètre.

## Avant une publication (exige un accord explicite)

1. Sauvegarder/exporter les finales OPFC, les compteurs existants et la version active de la fonction Edge.
2. Examiner les différences de la branche, la migration SQL et les permissions, puis tester une restauration des sauvegardes.
3. Tester syntaxe/imports et scénarios `node --test opfc/tests/v2.test.mjs`.
4. Installer et vérifier d'abord la migration sur un environnement de recette et comparer les anciens buts.
5. Déployer ensuite la fonction Edge et ses dépendances **sur OPFC uniquement**, dans cet environnement.
6. Tester séparément : match local, deux téléphones en ligne, pénaltys, corners, CF, 0-0, gagnant de l'Ancre d'Or, reconnexion et envoi différé des résultats locaux.
7. Vérifier que les quatre colonnes restent lisibles sur iPhone petit écran et que les 9 illustrations s'affichent avec transparence.
8. Demander l'autorisation de publication, puis planifier les opérations de production dans un ordre préservant les données.
9. Refaire les tests réels après publication et comparer Supabase aux matchs joués.

**Ne jamais fusionner ni déployer sans accord explicite de l'utilisateur.**

## Contrôles effectués pendant la préparation (23/10/2026)

- 9/9 assets `opfc/illustrations` présents et correctement nommés.
- 12/12 modules modifiés analysés sans erreur de syntaxe JavaScript.
- 19 assertions de moteur/rendu sur le code réel : Passe courte 50/50, Passe en profondeur, dribble, buts + assists, duels, gardiens, stade, 14 joueurs, écran final.
- 9 assertions supplémentaires du traitement Edge `record-local` isolé avec base simulée : une finale valide et une finale ancienne acceptées ; passe incorrecte, mauvais club ou mauvaise récompense rejetés.
- Comparaison `main...feature` : seuls OPFC et ses fichiers d'intégration Supabase sont modifiés, aucun fichier de jeu classique.
- Supabase OPFC de production consulté en lecture seule ; Edge toujours à la version 19, aucune migration exécutée.
- **Limitations :** ces vérifications ne constituent ni un lancement GitHub Actions complet, ni une partie de bout en bout sur deux iPhone, ni une migration testée sur une base de recette.

## Compatibilité entre versions — revue de prépublication

- Une partie locale créée par V2 porte `playerStatsVersion=2`, y compris avec le recrutement aléatoire (l'état initial est cloné).
- Un ancien résultat local synchronisé ultérieurement transmet les buts historiques uniquement, **sans inventer** de matchs joués, d'assists ou d'Ancre d'Or.
- Une nouvelle partie en ligne fournit le stade et `playerStatsVersion=2` au serveur. Les anciens salons n'ont ni ce marqueur ni de nouveaux champs de réponse obligatoires.
- Les nouveaux compteurs complets en ligne sont enregistrés uniquement lors d'une fin de match issue d'un état `playerStatsVersion=2`.
- Les anciennes finales en ligne alimentent les buts par la voie de compatibilité SQL `player_stats={}`.
- Les vues en ligne V1/V2 ont été testées hors production : 6 assertions spécifiques à la compatibilité.
- Les résultats locaux V1/V2 ont également été simulés, et 9 assertions de validation serveur ont réussi.
- Contrôle en lecture seule du 23/10/2026 : 5 buts enregistrés dans les finales, 5 dans les totaux de buteurs ; 3 salons non terminés au moment du contrôle.
- Workflow GitHub Actions limité à notre branche : `.github/workflows/opfc-v2-tests.yml`. **Son exécution réussie reste à confirmer** ; sa présence ne vaut pas validation complète.
- Aucun déploiement, aucune migration ni manipulation des salons en production.

## Revue de parcours et lisibilité mobile

- Avant-match en mode local : `endMercato()` rend directement la présentation unique puis la navigation, sans terrain ou budget répété.
- Avant-match en mode en ligne : `onlineSharedMarket()` rend la même présentation que le local, pour l'hôte et son adversaire ; l'hôte seul possède le bouton de coup d'envoi.
- Portraits ronds et noms sur iPhone : flex propre au portrait et au nom, sans agrandissement involontaire des images.
- Les nouvelles règles de stats sont également couvertes par des tests des corners, coups francs combinés et penalties.
- 18 contrôles ciblés supplémentaires de syntaxe, aiguillage d'écran et calculs individuels ont réussi hors navigateur.
- Scripts de contrôle purement en lecture seule : `supabase/migrations-opfc-v2/preflight-readonly.sql` et `postflight-readonly.sql`.
- Le précontrôle de production confirme 2 finales archivées, 5 buts dans les finales et 5 dans le catalogue.
- **Tests encore non réalisés :** navigateur mobile réel, exécution complète GitHub Actions confirmée, SQL sur un Supabase de recette, deux iPhone connectés au serveur de recette.

## Parcours d’avant-match conservé (décision utilisateur du 23/10/2026)

1. **Écran existant, intégralement conservé** : « Les équipes sont prêtes ! », budgets, terrain et compositions. Son bouton fait maintenant passer à la présentation au lieu de déclencher le match directement pour les parties V2.
2. **Nouvel écran supplémentaire** : stade illustré, compétition, écussons des clubs, 14 titulaires avec portraits et notes. Bouton « Donner le coup d’envoi » après validation.
3. **Match** : les probabilités et les mécaniques restent inchangées.

- En **local**, la progression vers le nouvel écran est sauvegardée avec la partie via `prematchSeen`.
- En **ligne**, chaque téléphone envoie sa propre commande `prematch-next` ; le serveur conserve `prematchReady.PSG/OM` et refuse le coup d’envoi avant les deux confirmations. L’hôte seul donne le coup d’envoi.
- En **ancienne partie** sans `playerStatsVersion=2`, rien ne change : pas de nouvel écran imposé, pas de nouveaux champs de synchronisation.
- Nouvelles régressions ajoutées dans `tests/opfc-v2.test.mjs` pour les confirmations, le refus du coup d’envoi prématuré et la compatibilité V1.
- Les copies serveur `supabase/functions/opfc-online/opfc/online-market.mjs` et `online-lineup.mjs` sont alignées avec le code V2.

## Vérification ciblée du double avant-match (23/10/2026)

- Le moteur d'affichage a été exécuté avec une représentation de ses dépendances : 8 contrôles concluants, sur l'ancien écran, la présentation du stade et les deux téléphones.
- Les tests Node `opfc/tests/v2.test.mjs` couvrent maintenant les deux écrans en local et leur synchronisation côté client en ligne.
- Les tests existants `tests/opfc-v2.test.mjs` vérifient déjà que la fonction de jeu en ligne refuse le coup d'envoi avant la confirmation des deux joueurs.
- Contrôle en lecture seule des triggers OPFC : archive immuable et total des buts alimentés uniquement par des insertions de finales ; identifiant `source_key` unique pour éviter les doublons.
- Aucun changement à la mécanique d'enchère, aux choix tactiques, aux notes ou au tirage 50/50 de Passe courte.
- **Attention :** les tests complets via GitHub Actions ou sur deux téléphones restent à confirmer ; aucune migration ni publication effectuée.

## Catalogue — classements validés le 23/10/2026

- **Personnages** : note décroissante (choix initial), matchs joués décroissants, meilleurs buteurs, meilleurs passeurs, plus d'Ancres d'Or, A → Z et Z → A.
- **Clubs** : palmarès et tris existants conservés, avec A → Z **et** Z → A.
- En cas d'égalité statistique : note générale la plus élevée, puis ordre alphabétique croissant ; les tris alphabétiques simples ignorent la note.
- Les filtres personnages (nom, poste, rareté) restent compatibles avec tous les tris ; le filtre de recherche des clubs reste compatible avec les deux sens alphabétiques.
- Quand les statistiques V2 ne sont pas encore accessibles, les tris correspondants retombent provisoirement sur la note, avec message explicite, sans inventer de performances.
- Fichiers : `opfc/catalog-sorting.mjs`, `opfc/catalog-view.mjs`, `opfc-catalogue.html`. Tests : `tests/opfc-v2-catalog-sort.test.mjs`, inclus dans le workflow OPFC V2.
- 13 assertions fonctionnelles du nouveau module de tri et 15 vérifications de syntaxe/intégration des menus réussies en inspection ; exécution complète de GitHub Actions encore à confirmer.

## Vérification finale des tris et totaux de carrière

- Le catalogue propose les classements par matchs, buts, passes décisives, Ancres d'Or, note et les deux sens alphabétiques. Le catalogue clubs a également A → Z et Z → A.
- Le chargement de `opfc_player_totals` rejette maintenant les valeurs `null`, vides, négatives et non entières au lieu de les interpréter comme des zéros. Si le serveur V2 n'est pas disponible, seuls les buts historiques confirmés sont montrés ; les trois autres compteurs restent inconnus.
- Régression automatisée : `tests/opfc-v2-catalog-sort.test.mjs` couvre explicitement les valeurs manquantes et la chaîne feuille de match → compteurs cumulatifs → classement.
- Vérifications sur les modules source : 9 essais de lecture de données et 5 assertions d'intégration moteur-statistiques-catalogue ont réussi.
- Les tests ci-dessus ont été exécutés avec dépendances simulées en lecture seule. L'exécution complète dans GitHub Actions, dans un vrai navigateur et en recette Supabase reste nécessaire avant publication.
