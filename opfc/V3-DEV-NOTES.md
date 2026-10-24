# OPFC V3 — branche de travail, non publiée

Cette branche est séparée de main. Ne pas fusionner, ne pas publier GitHub Pages, ne pas appliquer
de migration sur Supabase sans une nouvelle autorisation explicite de l'utilisateur.

## Cahier des charges accepté
- Huit palettes de stade, uniquement habillage des phases avant-match, match, mi-temps, finale.
- Fiches des vingt clubs : MATCHS / VICTOIRES / DÉFAITES / RATIO puis BUTS MARQUÉS /
  BUTS ENCAISSÉS / DIFFÉRENCE, statistiques de toutes les finales officielles local et en ligne.
- Les tirs au but déterminent la victoire, pas les buts de carrière. Zéro nul.
- Vert pour victoires, buts marqués, ratio >50%, différence positive ; rouge pour défaites,
  buts encaissés, ratio <50%, différence négative ; neutre sur 50% ou 0.
- Hall of Fame sous « Historique des Finales », quatre podiums, portraits de leaders,
  classement complet puis Sept de Légende sur le demi-terrain existant en 2-2-2.
- Sept de Légende : cumul EXCLUSIF des points de la formule actuelle d'Ancre d'Or,
  sélection selon poste naturel. Égalité : conserver les titulaires jusqu'au dépassement.
- Bouton d'aide tactique discret présent pendant les phases match, écran superposé
  sans reconfigurer la disposition. Matrice actuelle +/-8, 0.

## Précautions et limites à vérifier avant publication
- SQL: `supabase/migrations-opfc-v3/README-migration.sql` est un brouillon NON exécuté.
- Les anciennes finales dépourvues de statistiques individuelles n'ont pas de points inventés.
- Backfill historique des clubs : toutes les lignes, sans limitation à 100 finales.
- Ne pas utiliser les positions techniques PSG/OM comme véritables identités des 20 clubs.
- Les égalités Hall of Fame sont départagées par le dernier palier atteint, lu dans
  opfc_v3_player_milestones, pour un ordre cohérent entre appareils.
- Tester explicitement le cas d'un match sauvegardé localement hors ligne puis resynchronisé,
  et les deux clients iPhone sur une même finale enregistrée exactement une fois.
- Tests visuels mobile iOS + tests migrations en recette requis avant publication.

## Contrôles préparés
- Préflight lecture seule : `supabase/migrations-opfc-v3/preflight-readonly.sql`.
- Postflight lecture seule : `supabase/migrations-opfc-v3/postflight-readonly.sql`.
- Avant déploiement : exécuter les scripts en recette, confronter les nombres à l’archive et sauvegarder la production.
- Migration en deux parties DRAFT ; ne jamais exécuter sans feu vert.
