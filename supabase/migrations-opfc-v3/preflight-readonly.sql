-- OPFC V3 : AUDIT AVANT MIGRATION, LECTURE SEULE.
-- Aucun DDL, aucune écriture. À exécuter sur OPFC en préparation de la recette.
SELECT count(*) AS matches_archived,
 count(*) FILTER(WHERE mode='local') AS local_matches,
 count(*) FILTER(WHERE mode='online') AS online_matches,
 count(*) FILTER(WHERE shootout IS NOT NULL) AS penalty_winners,
 count(*) FILTER(WHERE player_stats <> '{}'::jsonb) AS matches_with_v2_performances
FROM public.opfc_match_results;

-- Le gagnant doit correspondre exactement à l'une des deux identités publiques.
SELECT source_key,home_club,away_club,winner FROM public.opfc_match_results
WHERE home_club=away_club OR winner NOT IN (home_club,away_club)
 OR home_score<0 OR away_score<0;

-- Totaux des vrais vingt clubs avant import (les matchs locaux et en ligne sont déjà archivés).
WITH events AS (
 SELECT home_club AS club_id,winner,home_score AS goals_for,away_score AS goals_against
 FROM public.opfc_match_results
 UNION ALL
 SELECT away_club AS club_id,winner,away_score AS goals_for,home_score AS goals_against
 FROM public.opfc_match_results
)
SELECT club_id,count(*) AS matches,
 count(*) FILTER(WHERE winner=club_id) AS wins,
 count(*) FILTER(WHERE winner<>club_id) AS losses,
 sum(goals_for) AS goals_for,sum(goals_against) AS goals_against
FROM events GROUP BY club_id ORDER BY club_id;

-- Somme des points utilisables, uniquement les finales contenant les performances V2.
SELECT p.key AS card_id,sum((p.value->>'points')::bigint) AS performance_points
FROM public.opfc_match_results r CROSS JOIN LATERAL jsonb_each(r.player_stats) p
WHERE (p.value->>'points') ~ '^[0-9]+$'
GROUP BY p.key ORDER BY performance_points DESC,card_id;
