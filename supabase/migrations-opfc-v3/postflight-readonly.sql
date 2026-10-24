-- OPFC V3 : AUDIT APRÈS MIGRATION, LECTURE SEULE.
-- Les deux premières requêtes doivent renvoyer zéro ligne.
WITH played AS (
 SELECT home_club AS id,winner,home_score AS scored,away_score AS conceded FROM public.opfc_match_results
 UNION ALL
 SELECT away_club AS id,winner,away_score AS scored,home_score AS conceded FROM public.opfc_match_results
), expected AS (
 SELECT id,count(*)::bigint AS matches,
 count(*) FILTER(WHERE winner=id)::bigint AS wins,
 count(*) FILTER(WHERE winner<>id)::bigint AS losses,
 sum(scored)::bigint AS goals_for,sum(conceded)::bigint AS goals_against
 FROM played GROUP BY id
)
SELECT e.id,e.matches AS expected_matches,a.matches AS stored_matches,
 e.wins AS expected_wins,a.wins AS stored_wins,
 e.losses AS expected_losses,a.losses AS stored_losses,
 e.goals_for AS expected_goals_for,a.goals_for AS stored_goals_for,
 e.goals_against AS expected_goals_against,a.goals_against AS stored_goals_against
FROM expected e LEFT JOIN public.opfc_club_totals a ON a.club_id=e.id
WHERE a.club_id IS NULL OR
 (a.matches,a.wins,a.losses,a.goals_for,a.goals_against)
 IS DISTINCT FROM (e.matches,e.wins,e.losses,e.goals_for,e.goals_against);

WITH expected AS (
 SELECT p.key AS id,sum((p.value->>'points')::bigint) AS points
 FROM public.opfc_match_results r CROSS JOIN LATERAL jsonb_each(r.player_stats) p
 WHERE (p.value->>'points') ~ '^[0-9]+$'
 GROUP BY p.key
)
SELECT e.id,e.points AS expected_points,a.points AS stored_points
FROM expected e LEFT JOIN public.opfc_player_totals a ON a.card_id=e.id
WHERE a.card_id IS NULL OR a.points IS DISTINCT FROM e.points;

-- Tous les tableaux publics sensibles sont couverts par RLS et lisibles par anon.
SELECT c.relname AS table_name,c.relrowsecurity AS rls,
 has_table_privilege('anon','public.'||c.relname,'SELECT') AS anon_can_read,
 has_table_privilege('anon','public.'||c.relname,'INSERT') AS anon_can_insert,
 has_table_privilege('anon','public.'||c.relname,'UPDATE') AS anon_can_update
FROM pg_catalog.pg_class c
WHERE c.relnamespace='public'::regnamespace
AND c.relname IN ('opfc_club_totals','opfc_player_totals','opfc_v3_player_milestones')
ORDER BY c.relname;

-- Cohérence globale : double présence de chaque rencontre, aucune donnée inventée.
SELECT (SELECT count(*) FROM public.opfc_match_results) AS archived_matches,
 (SELECT coalesce(sum(matches),0) FROM public.opfc_club_totals) AS total_club_appearances,
 (SELECT coalesce(sum(wins),0) FROM public.opfc_club_totals) AS total_club_wins,
 (SELECT coalesce(sum(losses),0) FROM public.opfc_club_totals) AS total_club_losses;
