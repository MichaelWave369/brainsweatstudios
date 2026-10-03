-- Service-only storage. Browser clients authenticate to the Edge Function,
-- which checks private-group membership and uses versioned compare-and-swap.
create table public.bs_online (
  id uuid primary key default gen_random_uuid(),
  bucket text not null check (bucket in ('device', 'room', 'clan', 'tournament', 'rate')),
  lookup text not null unique check (length(lookup) between 1 and 160),
  data jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 131072),
  version integer not null default 0 check (version >= 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index bs_online_expiry_idx on public.bs_online (expires_at);
create index bs_online_members_idx on public.bs_online using gin ((data -> 'members'))
  where bucket in ('room', 'clan', 'tournament');
alter table public.bs_online enable row level security;
revoke all on public.bs_online from public, anon, authenticated;
-- Explicit grants are required for new projects under the 2026 Data API change.
grant select, insert, update, delete on public.bs_online to service_role;
comment on table public.bs_online is 'Private Brain Sweat online groups. No direct browser access; custom device authentication and authorization live in the Edge Function.';
