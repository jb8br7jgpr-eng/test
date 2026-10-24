-- DEUXIÈME SCRIPT V3 : DRAFT, après README-migration.sql, jamais en production sans accord.
BEGIN;
-- Migration brève : aucune finale insérée entre le backfill et les triggers.
-- Si une partie termine au même instant, abandonner plutôt que bloquer le jeu.
SET LOCAL lock_timeout = '3s';
LOCK TABLE public.opfc_match_results IN SHARE ROW EXCLUSIVE MODE;
CREATE TABLE IF NOT EXISTS public.opfc_v3_player_milestones(
 card_id text PRIMARY KEY,
 matches_at timestamptz, goals_at timestamptz,assists_at timestamptz,
 anchors_at timestamptz,points_at timestamptz
);
ALTER TABLE public.opfc_v3_player_milestones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS opfc_v3_milestones_read ON public.opfc_v3_player_milestones;
CREATE POLICY opfc_v3_milestones_read ON public.opfc_v3_player_milestones FOR SELECT TO anon,authenticated USING(true);
REVOKE ALL ON public.opfc_v3_player_milestones FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.opfc_v3_player_milestones TO anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.opfc_v3_player_milestones TO service_role;
-- Palier = dernière finale officielle dans laquelle le compteur a réellement progressé.
INSERT INTO public.opfc_v3_player_milestones(card_id,matches_at,goals_at,assists_at,anchors_at,points_at)
SELECT p.key,
 max(r.played_at) FILTER(WHERE COALESCE((p.value->>'matches')::bigint,0)>0),
 max(r.played_at) FILTER(WHERE COALESCE((p.value->>'goals')::bigint,0)>0),
 max(r.played_at) FILTER(WHERE COALESCE((p.value->>'assists')::bigint,0)>0),
 max(r.played_at) FILTER(WHERE COALESCE((p.value->>'anchors')::bigint,0)>0),
 max(r.played_at) FILTER(WHERE COALESCE((p.value->>'points')::bigint,0)>0)
FROM public.opfc_match_results r CROSS JOIN LATERAL jsonb_each(r.player_stats) p
GROUP BY p.key
ON CONFLICT(card_id) DO UPDATE SET
 matches_at=excluded.matches_at,goals_at=excluded.goals_at,assists_at=excluded.assists_at,
 anchors_at=excluded.anchors_at,points_at=excluded.points_at;
-- Récupérer aussi les dates des buts historiques V1 sans player_stats.
INSERT INTO public.opfc_v3_player_milestones(card_id,goals_at)
SELECT goal.value->>'cardId',max(r.played_at)
FROM public.opfc_match_results r CROSS JOIN LATERAL jsonb_array_elements(r.goals) goal
WHERE goal.value->>'cardId' IS NOT NULL GROUP BY goal.value->>'cardId'
ON CONFLICT(card_id) DO UPDATE SET goals_at=GREATEST(public.opfc_v3_player_milestones.goals_at,excluded.goals_at);
CREATE OR REPLACE FUNCTION public.opfc_v3_capture_milestones()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
DECLARE p record; goal record;
BEGIN
 FOR p IN SELECT key,value FROM pg_catalog.jsonb_each(NEW.player_stats) LOOP
  INSERT INTO public.opfc_v3_player_milestones(card_id,matches_at,goals_at,assists_at,anchors_at,points_at)
  VALUES(p.key,
   CASE WHEN COALESCE((p.value->>'matches')::bigint,0)>0 THEN NEW.played_at END,
   CASE WHEN COALESCE((p.value->>'goals')::bigint,0)>0 THEN NEW.played_at END,
   CASE WHEN COALESCE((p.value->>'assists')::bigint,0)>0 THEN NEW.played_at END,
   CASE WHEN COALESCE((p.value->>'anchors')::bigint,0)>0 THEN NEW.played_at END,
   CASE WHEN COALESCE((p.value->>'points')::bigint,0)>0 THEN NEW.played_at END)
  ON CONFLICT(card_id) DO UPDATE SET
  matches_at=GREATEST(public.opfc_v3_player_milestones.matches_at,excluded.matches_at),
  goals_at=GREATEST(public.opfc_v3_player_milestones.goals_at,excluded.goals_at),
  assists_at=GREATEST(public.opfc_v3_player_milestones.assists_at,excluded.assists_at),
  anchors_at=GREATEST(public.opfc_v3_player_milestones.anchors_at,excluded.anchors_at),
  points_at=GREATEST(public.opfc_v3_player_milestones.points_at,excluded.points_at);
 END LOOP;
 FOR goal IN SELECT x.value->>'cardId' AS card_id FROM pg_catalog.jsonb_array_elements(NEW.goals) x LOOP
  IF goal.card_id IS NOT NULL THEN
   INSERT INTO public.opfc_v3_player_milestones(card_id,goals_at)VALUES(goal.card_id,NEW.played_at)
   ON CONFLICT(card_id) DO UPDATE SET goals_at=GREATEST(public.opfc_v3_player_milestones.goals_at,excluded.goals_at);
  END IF;
 END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.opfc_v3_capture_milestones() FROM PUBLIC;
DROP TRIGGER IF EXISTS opfc_v3_capture_milestones_final ON public.opfc_match_results;
CREATE TRIGGER opfc_v3_capture_milestones_final AFTER INSERT ON public.opfc_match_results
 FOR EACH ROW EXECUTE FUNCTION public.opfc_v3_capture_milestones();
COMMIT;
