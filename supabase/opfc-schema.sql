-- OPFC / bloc 10A1 — SCHÉMA PROPOSÉ, NON APPLIQUÉ.
-- À appliquer UNIQUEMENT sur un projet Supabase OPFC approuvé et dédié.
-- Aucun objet d'OPMercato classique ou d'ARCHIPEL ne doit être modifié.
-- La fonction Edge parle à cette table avec la clé SERVICE_ROLE seulement.

create table if not exists public.opfc_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique
    check (code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$'),
  host_club text not null check (host_club in ('PSG','OM')),
  host_token_hash text not null check (host_token_hash ~ '^[0-9a-f]{64}$'),
  guest_token_hash text check (guest_token_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'waiting'
    check (status in ('waiting','ready','finished')),
  private_state jsonb not null,
  version bigint not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  constraint opfc_guest_ready_consistency check
    ((status = 'waiting' and guest_token_hash is null) or
     (status <> 'waiting' and guest_token_hash is not null))
);

create index if not exists opfc_rooms_expiry
  on public.opfc_rooms (expires_at);

-- Aucun accès direct à la table pour une clé publiée sur iPhone.
alter table public.opfc_rooms enable row level security;
revoke all privileges on public.opfc_rooms from public, anon, authenticated;
grant select, insert, update, delete on public.opfc_rooms to service_role;

comment on table public.opfc_rooms is
  'OPFC independent rooms. Stored private game state must never be selected by mobile clients.';
