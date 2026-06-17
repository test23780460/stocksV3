alter table public.watchlists
  add column if not exists is_default boolean not null default false;

alter table public.watchlist_items
  add column if not exists notes text not null default '',
  add column if not exists sort_order integer not null default 0;

alter table public.alert_rules
  add column if not exists last_checked_at timestamptz,
  add column if not exists last_triggered_at timestamptz,
  add column if not exists trigger_count integer not null default 0;

create table if not exists public.provider_failures (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  endpoint text not null,
  symbol text,
  error_class text not null,
  safe_message text not null,
  occurred_at timestamptz not null default now(),
  retry_after_seconds integer,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.server_cache (
  cache_key text primary key,
  value jsonb not null,
  expires_at timestamptz not null,
  stale_until timestamptz,
  provider text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.provider_failures enable row level security;
alter table public.server_cache enable row level security;

create policy "admin read provider failures" on public.provider_failures for select using (public.is_admin());
create policy "admin read server cache" on public.server_cache for select using (public.is_admin());

create policy "admins manage provider failures" on public.provider_failures for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage server cache" on public.server_cache for all using (public.is_admin()) with check (public.is_admin());

create index if not exists idx_provider_failures_provider_time on public.provider_failures(provider, occurred_at desc);
create index if not exists idx_server_cache_expires on public.server_cache(expires_at);
