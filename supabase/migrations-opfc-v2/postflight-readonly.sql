-- Après migration : ne modifie rien, vérifier avant de déployer le serveur V2.
SELECT
 (SELECT coalesce(sum(goals),0) FROM public.opfc_scorer_totals) AS existing_goal_totals,
 (SELECT coalesce(sum(goals),0) FROM public.opfc_player_totals) AS new_goal_totals,
 (SELECT count(*) FROM public.opfc_player_totals
  WHERE matches<0 OR goals<0 OR assists<0 OR anchors<0) AS invalid_player_totals,
 (SELECT count(*) FROM public.opfc_match_results
  WHERE jsonb_typeof(player_stats)<>'object') AS invalid_final_payloads;
SELECT
 count(*) AS finals_total,
 count(*) FILTER (WHERE player_stats<>'{}'::jsonb) AS finals_with_individual_stats,
 count(*) FILTER (WHERE anchor_id IS NOT NULL) AS finals_with_ancre_dor
FROM public.opfc_match_results;
-- Attention : comparer existing_goal_totals et new_goal_totals uniquement
-- après avoir terminé la migration et les éventuelles files de synchronisation.

-- Contrôles d'intégrité V2 : aucun INSERT / UPDATE, à utiliser sur la base de recette.
-- Chaque finale V2 a exactement 14 titulaires et une Ancre d'Or.
WITH per_final AS (
 SELECT f.source_key, f.anchor_id,
  count(e.key) AS player_count,
  count(*) FILTER (WHERE e.value->>'matches'='1') AS appearances,
  count(*) FILTER (WHERE e.value->>'anchors'='1') AS anchors,
  count(*) FILTER (WHERE e.key=f.anchor_id AND e.value->>'anchors'='1') AS winning_anchor,
  count(*) FILTER (WHERE e.value->>'matches' IS NULL
   OR e.value->>'goals' IS NULL OR e.value->>'assists' IS NULL
   OR e.value->>'anchors' IS NULL) AS incomplete_rows
 FROM public.opfc_match_results AS f
 LEFT JOIN LATERAL pg_catalog.jsonb_each(f.player_stats) AS e(key,value) ON TRUE
 WHERE f.anchor_id IS NOT NULL
 GROUP BY f.source_key,f.anchor_id
)
SELECT count(*) AS v2_finals_checked,
 count(*) FILTER (WHERE player_count<>14 OR appearances<>14 OR anchors<>1
  OR winning_anchor<>1 OR incomplete_rows<>0) AS invalid_v2_finals
FROM per_final;

-- Le catalogue V2 ne doit perdre aucun but ni fabriquer une récompense.
SELECT
 (SELECT coalesce(sum(goals),0) FROM public.opfc_scorer_totals) AS existing_goals,
 (SELECT coalesce(sum(goals),0) FROM public.opfc_player_totals) AS new_goals,
 (SELECT count(*) FROM public.opfc_match_results WHERE anchor_id IS NOT NULL)
    AS v2_finals_with_ancre,
 (SELECT coalesce(sum(anchors),0) FROM public.opfc_player_totals) AS awarded_ancres;

-- Vérification des privilèges : lecture autorisée, aucune écriture depuis un navigateur.
SELECT
 (SELECT relrowsecurity FROM pg_catalog.pg_class
   WHERE oid='public.opfc_player_totals'::regclass) AS rls_enabled,
 pg_catalog.has_table_privilege('anon','public.opfc_player_totals','SELECT') AS public_read,
 pg_catalog.has_table_privilege('anon','public.opfc_player_totals','INSERT') AS public_insert,
 pg_catalog.has_table_privilege('anon','public.opfc_player_totals','UPDATE') AS public_update,
 EXISTS(SELECT 1 FROM pg_catalog.pg_trigger WHERE tgname='opfc_player_totals_capture_new_final'
  AND tgrelid='public.opfc_match_results'::regclass AND NOT tgisinternal)
 AS stats_trigger_present;
