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
