-- OPMercato FC / contrôle anti-abus : projet Supabase OPFC UNIQUEMENT.
-- Limiteur global provisoire pour lancement privé (pas un quota par IP).
-- Pas de privilèges pour les clients web ; seule la fonction Edge appelle la RPC.
create table if not exists public.opfc_rate_counter (
  action text not null check (action in ('create','join')),
  hour_bucket bigint not null,
  hits integer not null default 1 check (hits >= 1),
  primary key (action,hour_bucket)
);
alter table public.opfc_rate_counter enable row level security;
revoke all on public.opfc_rate_counter from public, anon, authenticated;
grant select,insert,update on public.opfc_rate_counter to service_role;

create or replace function public.opfc_take_rate_token(p_action text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_bucket bigint;
  v_limit integer;
  v_count integer;
begin
  if p_action not in ('create','join') or p_action is null then
    raise exception 'Action de limitation invalide';
  end if;
  v_limit := case p_action when 'create' then 30 else 300 end;
  v_bucket := floor(extract(epoch from clock_timestamp()) / 3600)::bigint;
  insert into public.opfc_rate_counter(action,hour_bucket,hits)
  values (p_action,v_bucket,1)
  on conflict (action,hour_bucket) do update
    set hits=public.opfc_rate_counter.hits+1
    where public.opfc_rate_counter.hits<v_limit
  returning hits into v_count;
  return v_count is not null;
end;
$$;
revoke all on function public.opfc_take_rate_token(text) from public, anon, authenticated;
grant execute on function public.opfc_take_rate_token(text) to service_role;
