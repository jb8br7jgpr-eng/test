-- OPFC V3 — DRAFT UNIQUEMENT : NE PAS EXÉCUTER SUR LA PRODUCTION SANS ACCORD.
-- Migration additive, uniquement pour le projet OPFC. Aucun moteur de jeu touché.
BEGIN;
ALTER TABLE public.opfc_player_totals ADD COLUMN IF NOT EXISTS points bigint NOT NULL DEFAULT 0 CHECK (points>=0);
-- Reconstruire les points réels des résultats V2 possédant des statistiques individuelles.
-- Les anciennes finales V1 sans détail contribuent zéro point, jamais une estimation.
WITH recorded AS (
 SELECT entry.key AS card_id, SUM((entry.value->>'points')::bigint) AS total
 FROM public.opfc_match_results r
 CROSS JOIN LATERAL jsonb_each(r.player_stats) entry
 WHERE jsonb_typeof(r.player_stats)='object'
  AND (entry.value->>'points') ~ '^[0-9]+$'
 GROUP BY entry.key
)
UPDATE public.opfc_player_totals p SET points=COALESCE(recorded.total,0)
FROM recorded WHERE p.card_id=recorded.card_id;

CREATE TABLE IF NOT EXISTS public.opfc_club_totals (
 club_id text PRIMARY KEY,
 matches bigint NOT NULL DEFAULT 0 CHECK(matches>=0),
 wins bigint NOT NULL DEFAULT 0 CHECK(wins>=0),
 losses bigint NOT NULL DEFAULT 0 CHECK(losses>=0),
 goals_for bigint NOT NULL DEFAULT 0 CHECK(goals_for>=0),
 goals_against bigint NOT NULL DEFAULT 0 CHECK(goals_against>=0),
 CONSTRAINT opfc_v3_no_draws CHECK(matches=wins+losses)
);
ALTER TABLE public.opfc_club_totals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS opfc_club_totals_read ON public.opfc_club_totals;
CREATE POLICY opfc_club_totals_read ON public.opfc_club_totals
 FOR SELECT TO anon,authenticated USING(true);
REVOKE ALL ON public.opfc_club_totals FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.opfc_club_totals TO anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.opfc_club_totals TO service_role;

-- Reconstitution exhaustive à partir des résultats officiels, non de l'API d'historique limitée à 100.
INSERT INTO public.opfc_club_totals(club_id,matches,wins,losses,goals_for,goals_against)
SELECT id,COUNT(*),
 SUM(CASE WHEN winner=id THEN 1 ELSE 0 END),
 SUM(CASE WHEN winner<>id THEN 1 ELSE 0 END),
 SUM(scored),SUM(conceded)
FROM (
 SELECT home_club AS id,winner,home_score AS scored,away_score AS conceded FROM public.opfc_match_results
 UNION ALL
 SELECT away_club AS id,winner,away_score AS scored,home_score AS conceded FROM public.opfc_match_results
) historic
GROUP BY id
ON CONFLICT (club_id) DO UPDATE SET matches=excluded.matches,wins=excluded.wins,
 losses=excluded.losses,goals_for=excluded.goals_for,goals_against=excluded.goals_against;

CREATE OR REPLACE FUNCTION public.opfc_v3_record_club_totals()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN
 IF NEW.home_club=NEW.away_club OR
    NEW.winner NOT IN (NEW.home_club,NEW.away_club) OR
    NEW.home_score<0 OR NEW.away_score<0 THEN
   RAISE EXCEPTION 'OPFC V3: résultat historique de club invalide';
 END IF;
 INSERT INTO public.opfc_club_totals(club_id,matches,wins,losses,goals_for,goals_against)
 VALUES(NEW.home_club,1,(NEW.winner=NEW.home_club)::int,
        (NEW.winner<>NEW.home_club)::int,NEW.home_score,NEW.away_score)
 ON CONFLICT(club_id) DO UPDATE SET
 matches=public.opfc_club_totals.matches+1,wins=public.opfc_club_totals.wins+excluded.wins,
 losses=public.opfc_club_totals.losses+excluded.losses,
 goals_for=public.opfc_club_totals.goals_for+excluded.goals_for,
 goals_against=public.opfc_club_totals.goals_against+excluded.goals_against;
 INSERT INTO public.opfc_club_totals(club_id,matches,wins,losses,goals_for,goals_against)
 VALUES(NEW.away_club,1,(NEW.winner=NEW.away_club)::int,
        (NEW.winner<>NEW.away_club)::int,NEW.away_score,NEW.home_score)
 ON CONFLICT(club_id) DO UPDATE SET
 matches=public.opfc_club_totals.matches+1,wins=public.opfc_club_totals.wins+excluded.wins,
 losses=public.opfc_club_totals.losses+excluded.losses,
 goals_for=public.opfc_club_totals.goals_for+excluded.goals_for,
 goals_against=public.opfc_club_totals.goals_against+excluded.goals_against;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.opfc_v3_record_player_points()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
DECLARE item record; score bigint;
BEGIN
 IF NEW.player_stats IS NULL OR jsonb_typeof(NEW.player_stats)<>'object' THEN RETURN NEW; END IF;
 FOR item IN SELECT key,value FROM jsonb_each(NEW.player_stats) LOOP
  IF (item.value->>'points') !~ '^[0-9]+$' THEN
   RAISE EXCEPTION 'OPFC V3: points de performance invalides';
  END IF;
  score=(item.value->>'points')::bigint;
  INSERT INTO public.opfc_player_totals(card_id,points) VALUES(item.key,score)
   ON CONFLICT(card_id) DO UPDATE
   SET points=public.opfc_player_totals.points+excluded.points;
 END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.opfc_v3_record_club_totals() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.opfc_v3_record_player_points() FROM PUBLIC;
DROP TRIGGER IF EXISTS opfc_v3_club_result_insert ON public.opfc_match_results;
CREATE TRIGGER opfc_v3_club_result_insert AFTER INSERT ON public.opfc_match_results
 FOR EACH ROW EXECUTE FUNCTION public.opfc_v3_record_club_totals();
DROP TRIGGER IF EXISTS opfc_v3_points_result_insert ON public.opfc_match_results;
CREATE TRIGGER opfc_v3_points_result_insert AFTER INSERT ON public.opfc_match_results
 FOR EACH ROW EXECUTE FUNCTION public.opfc_v3_record_player_points();
COMMIT;
-- Avant tout déploiement : recette, sauvegardes, rollback, assertions de parité V2.
