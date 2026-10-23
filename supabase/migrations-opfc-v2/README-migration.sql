-- OPFC V2, projet OPFC SEULEMENT. À appliquer après sauvegarde et tests en recette.
-- AUCUN effet sur les tables du jeu OPMercato classique.
BEGIN;
ALTER TABLE public.opfc_match_results
 ADD COLUMN IF NOT EXISTS player_stats jsonb NOT NULL DEFAULT '{}'::jsonb,
 ADD COLUMN IF NOT EXISTS anchor_id text;
ALTER TABLE public.opfc_match_results
 DROP CONSTRAINT IF EXISTS opfc_player_stats_is_object;
ALTER TABLE public.opfc_match_results
 ADD CONSTRAINT opfc_player_stats_is_object CHECK (jsonb_typeof(player_stats)='object');

CREATE TABLE IF NOT EXISTS public.opfc_player_totals (
 card_id text PRIMARY KEY,
 matches bigint NOT NULL DEFAULT 0 CHECK (matches>=0),
 goals bigint NOT NULL DEFAULT 0 CHECK (goals>=0),
 assists bigint NOT NULL DEFAULT 0 CHECK (assists>=0),
 anchors bigint NOT NULL DEFAULT 0 CHECK (anchors>=0)
);
ALTER TABLE public.opfc_player_totals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS opfc_player_totals_public_read ON public.opfc_player_totals;
CREATE POLICY opfc_player_totals_public_read ON public.opfc_player_totals
 FOR SELECT TO anon, authenticated USING (true);
REVOKE ALL ON public.opfc_player_totals FROM PUBLIC;
-- Supabase peut appliquer ses default privileges à la création : retirer
-- les droits explicites (INSERT/UPDATE/DELETE/TRUNCATE) des rôles navigateur.
REVOKE ALL ON TABLE public.opfc_player_totals FROM anon, authenticated;
GRANT SELECT ON public.opfc_player_totals TO anon, authenticated;
-- Le backend Edge écrit avec service_role ; jamais les navigateurs.
GRANT SELECT, INSERT, UPDATE ON public.opfc_player_totals TO service_role;

-- Conservation des buts historiques sans reconstituer artificiellement les autres stats.
INSERT INTO public.opfc_player_totals(card_id,goals)
 SELECT card_id,goals FROM public.opfc_scorer_totals
ON CONFLICT(card_id) DO NOTHING;

CREATE OR REPLACE FUNCTION opfc_stats.capture_player_totals()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
DECLARE item record; stat jsonb;
BEGIN
 -- Anciennes parties en ligne terminées pendant la transition :
 -- préserver les buts même si elles ne portaient pas de journal individuel.
 IF NEW.player_stats='{}'::jsonb THEN
  FOR item IN
   SELECT g->>'cardId' AS key,count(*)::bigint AS tally
   FROM pg_catalog.jsonb_array_elements(NEW.goals) AS g
   WHERE g->>'cardId' IS NOT NULL GROUP BY g->>'cardId'
  LOOP
   INSERT INTO public.opfc_player_totals(card_id,goals)
   VALUES(item.key,item.tally)
   ON CONFLICT(card_id) DO UPDATE SET goals=public.opfc_player_totals.goals+EXCLUDED.goals;
  END LOOP;
  RETURN NEW;
 END IF;
 FOR item IN SELECT key,value FROM pg_catalog.jsonb_each(NEW.player_stats) LOOP
  stat:=item.value;
  IF pg_catalog.jsonb_typeof(stat)<>'object' OR
    (stat->>'matches')::integer NOT BETWEEN 0 AND 1 OR
    (stat->>'goals')::integer NOT BETWEEN 0 AND 99 OR
    (stat->>'assists')::integer NOT BETWEEN 0 AND 99 OR
    (stat->>'anchors')::integer NOT BETWEEN 0 AND 1
  THEN RAISE EXCEPTION 'OPFC statistiques invalides'; END IF;
  INSERT INTO public.opfc_player_totals(card_id,matches,goals,assists,anchors)
  VALUES(item.key,(stat->>'matches')::bigint,(stat->>'goals')::bigint,
    (stat->>'assists')::bigint,(stat->>'anchors')::bigint)
  ON CONFLICT(card_id) DO UPDATE SET
   matches=public.opfc_player_totals.matches+EXCLUDED.matches,
   goals=public.opfc_player_totals.goals+EXCLUDED.goals,
   assists=public.opfc_player_totals.assists+EXCLUDED.assists,
   anchors=public.opfc_player_totals.anchors+EXCLUDED.anchors;
 END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION opfc_stats.capture_player_totals() FROM PUBLIC;
DROP TRIGGER IF EXISTS opfc_player_totals_capture_new_final ON public.opfc_match_results;
CREATE TRIGGER opfc_player_totals_capture_new_final
 AFTER INSERT ON public.opfc_match_results FOR EACH ROW
 EXECUTE FUNCTION opfc_stats.capture_player_totals();

-- Les finales en ligne sont archivées automatiquement par le déclencheur existant.
CREATE OR REPLACE FUNCTION public.opfc_record_finished_online_match()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
DECLARE
 c text:=new.private_state->>'competition';
 a text; b text; winning_slot text; winner_id text;
 s_a integer; s_b integer;
BEGIN
 IF c IS NULL OR c NOT IN ('grandline','league','cup') THEN RETURN new; END IF;
 IF new.private_state->>'phase'<>'finished' OR old.private_state->>'phase'='finished' THEN RETURN new; END IF;
 SELECT coalesce(t->>'identityId',t->>'club') INTO a
  FROM pg_catalog.jsonb_array_elements(new.private_state->'teams') AS t WHERE t->>'club'='PSG';
 SELECT coalesce(t->>'identityId',t->>'club') INTO b
  FROM pg_catalog.jsonb_array_elements(new.private_state->'teams') AS t WHERE t->>'club'='OM';
 winning_slot:=new.private_state #>> '{match,winner}';
 IF winning_slot NOT IN ('PSG','OM') OR a IS NULL OR b IS NULL THEN
  RAISE EXCEPTION 'OPFC result invalid'; END IF;
 winner_id:=CASE WHEN winning_slot='PSG' THEN a ELSE b END;
 s_a:=(new.private_state #>> '{match,score,PSG}')::integer;
 s_b:=(new.private_state #>> '{match,score,OM}')::integer;
 INSERT INTO public.opfc_match_results
  (source_key,mode,competition,home_club,away_club,home_score,away_score,winner,shootout,goals,player_stats,anchor_id)
 VALUES('online:'||new.id::text,'online',c,a,b,s_a,s_b,winner_id,
  CASE WHEN new.private_state #>> '{match,victory}'='shootout'
  THEN pg_catalog.jsonb_build_object('home',new.private_state #>> '{match,shootout,score,PSG}',
    'away',new.private_state #>> '{match,shootout,score,OM}')
  ELSE NULL END,
  coalesce(new.private_state #> '{match,goals}','[]'::jsonb),
  coalesce(new.private_state #> '{match,playerStats}','{}'::jsonb),
  new.private_state #>> '{match,anchorId}')
 ON CONFLICT(source_key) DO NOTHING;
 RETURN new;
END $$;
COMMIT;
-- Vérifier les politiques RLS et les totaux, puis tester un INSERT fictif transactionnel avec ROLLBACK.
