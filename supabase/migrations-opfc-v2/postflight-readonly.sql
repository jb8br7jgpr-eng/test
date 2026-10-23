-- Après migration : ne modifie rien, vérifier avant de déployer le serveur V2.
SELECT
 (SELECT coalesce(sum(goals),0) FROM public.opfc_scorer_totals) AS existing_goal_totals,
 (SELECT coalesce(sum(goals),0) FROM public.opfc_player_totals) AS new_goal_totals,
 (SELECT count(*) FROM public.opfc_player_totals
  WHERE matches<0 OR goals<0 OR assists<0 OR anchors<0) AS invalid_player_totals,
 (SELECT count(*) FROM public.opfc_match_results
  WHERE jsonb_typeof(player_stats)<>'object') AS invalid_final_payloads;
SELECT coalesce(sum(goals),0) AS goals_unarchived_in_future_finals
FROM public.opfc_match_results
CROSS JOIN LATERAL (SELECT count(*)::bigint AS goals FROM jsonb_array_elements(
 CASE WHEN jsonb_typeof(opfc_match_results.goals)='array'
 THEN opfc_match_results.goals ELSE '[]'::jsonb END)) AS x
WHERE source_key IS NOT NULL;
