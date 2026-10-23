-- Avant migration : diagnostic strictement en lecture seule.
SELECT
 (SELECT count(*) FROM public.opfc_match_results) AS finals_archived,
 (SELECT coalesce(sum(jsonb_array_length(goals)),0) FROM public.opfc_match_results) AS goals_archived,
 (SELECT coalesce(sum(goals),0) FROM public.opfc_scorer_totals) AS goals_in_catalog,
 (SELECT count(*) FROM public.opfc_rooms WHERE status='ready' AND expires_at>now()
  AND private_state->>'phase' NOT IN ('finished')) AS games_in_progress;
SELECT table_name,column_name,data_type,is_nullable
FROM information_schema.columns
WHERE table_schema='public' AND table_name IN ('opfc_match_results','opfc_scorer_totals')
 AND column_name IN ('goals','source_key','card_id','private_state')
ORDER BY table_name,column_name;
