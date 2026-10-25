-- OPFC — BROUILLON STRICTEMENT NON APPLIQUÉ (branche de préparation).
-- Ne jamais exécuter sur la production sans validation explicite + pré/postflight.
-- Remplace la clé salon par une clé de MATCH ; premier match historique sans
-- matchRecordId conserve la clé online:<room_uuid> par compatibilité.
-- L'enregistrement du résultat et toutes les statistiques restent déclenchés
-- au passage officiel vers phase='finished', pas lors du clic Revanche.
BEGIN;
CREATE OR REPLACE FUNCTION public.opfc_record_finished_online_match()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
 c text:=new.private_state->>'competition';
 a text; b text; winning_slot text; winner_id text;
 s_a integer; s_b integer;
 match_uuid text:=coalesce(nullif(new.private_state->>'matchRecordId',''),new.id::text);
BEGIN
 IF c IS NULL OR c NOT IN ('grandline','league','cup') THEN RETURN new; END IF;
 IF new.private_state->>'phase'<>'finished' OR old.private_state->>'phase'='finished' THEN RETURN new; END IF;
 IF match_uuid !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
  RAISE EXCEPTION 'OPFC invalid official match ID'; END IF;
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
 VALUES('online:'||match_uuid,'online',c,a,b,s_a,s_b,winner_id,
  CASE WHEN new.private_state #>> '{match,victory}'='shootout'
  THEN pg_catalog.jsonb_build_object('home',new.private_state #>> '{match,shootout,score,PSG}',
    'away',new.private_state #>> '{match,shootout,score,OM}')
  ELSE NULL END,
  coalesce(new.private_state #> '{match,goals}','[]'::jsonb),
  coalesce(new.private_state #> '{match,playerStats}','{}'::jsonb),
  new.private_state #>> '{match,anchorId}')
 ON CONFLICT(source_key) DO NOTHING;
 RETURN new;
END $function$;
COMMIT;

-- Vérifications READ-ONLY obligatoires avant tout déploiement futur :
-- 1) Premier résultat online:room_id compté une fois, tous les anciens résultats intacts.
-- 2) Seconde rencontre du même salon reçoit online:matchRecordId différent.
-- 3) INSERT active UNE fois les triggers de joueurs/club/Hall/Ancre/milestones.
-- 4) Une requête doublon ne déclenche aucun INSERT ni incrément.
-- 5) Échec d'insertion = rollback du résultat (pas de statistique perdue).
