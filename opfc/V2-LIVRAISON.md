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
