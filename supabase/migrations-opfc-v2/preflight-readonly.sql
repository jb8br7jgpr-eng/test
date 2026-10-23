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

-- Contrôles de préparation V2 : ils doivent rester vrais avant toute migration.
-- Une branche Supabase de recette distincte est requise pour les écritures.
SELECT
 EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='opfc_stats') AS schema_stats_present,
 EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='opfc_scorers_capture_final'
   AND NOT tgisinternal) AS trigger_buts_present,
 EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='opfc_backup_capture_new_final'
   AND NOT tgisinternal) AS trigger_sauvegarde_present,
 EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='opfc_finished_online_result'
   AND NOT tgisinternal) AS trigger_finales_en_ligne_present,
 EXISTS(SELECT 1 FROM information_schema.tables
   WHERE table_schema='public' AND table_name='opfc_player_totals')
   AS nouvelle_table_deja_presente;
-- Pour surveiller le risque de migration pendant des parties en cours :
SELECT
 count(*) AS salons_actifs_non_termines,
 count(*) FILTER (WHERE private_state->>'phase'='match') AS rencontres_en_cours
FROM public.opfc_rooms
WHERE status='ready' AND expires_at>now() AND private_state->>'phase'<>'finished';
