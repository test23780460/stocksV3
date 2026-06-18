alter type public.data_status add value if not exists 'Real-time IEX';
alter type public.data_status add value if not exists 'Provider-supplied';
alter type public.data_status add value if not exists 'Near real-time';
alter type public.data_status add value if not exists 'Intraday snapshot';
alter type public.data_status add value if not exists 'End-of-day';
alter type public.data_status add value if not exists 'Unavailable';

create table if not exists public.market_assets (
  symbol text primary key,
  company_name text not null,
  exchange text,
  asset_type text not null default 'stock',
  active boolean not null default true,
  tradable boolean,
  shortable boolean,
  marginable boolean,
  easy_to_borrow boolean,
  fractionable boolean,
  sector text,
  industry text,
  provider text not null,
  metadata jsonb not null default '{}'::jsonb,
  last_reference_update timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint market_assets_symbol_format check (symbol ~ '^[A-Z0-9.\-]{1,12}$')
);

create table if not exists public.latest_quotes (
  symbol text primary key references public.market_assets(symbol) on delete cascade,
  price numeric not null check (price >= 0),
  bid numeric check (bid >= 0),
  ask numeric check (ask >= 0),
  open numeric check (open >= 0),
  high numeric check (high >= 0),
  low numeric check (low >= 0),
  previous_close numeric check (previous_close >= 0),
  change numeric,
  change_percent numeric,
  volume numeric check (volume >= 0),
  average_volume numeric check (average_volume >= 0),
  relative_volume numeric check (relative_volume >= 0),
  dollar_volume numeric check (dollar_volume >= 0),
  provider text not null,
  feed text not null,
  data_status text not null,
  market_status text not null,
  provider_timestamp timestamptz,
  collected_at timestamptz not null default now(),
  scan_tier text not null default 'broad',
  scanner_score numeric check (scanner_score between 0 and 100),
  stale_after timestamptz not null default now() + interval '15 minutes',
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.daily_bars (
  id bigserial primary key,
  symbol text not null references public.market_assets(symbol) on delete cascade,
  trading_date date not null,
  open numeric not null check (open >= 0),
  high numeric not null check (high >= 0),
  low numeric not null check (low >= 0),
  close numeric not null check (close >= 0),
  volume numeric check (volume >= 0),
  vwap numeric,
  provider text not null,
  collected_at timestamptz not null default now(),
  unique(symbol, trading_date, provider)
);

create table if not exists public.intraday_bars (
  id bigserial primary key,
  symbol text not null references public.market_assets(symbol) on delete cascade,
  interval text not null,
  bar_timestamp timestamptz not null,
  open numeric not null check (open >= 0),
  high numeric not null check (high >= 0),
  low numeric not null check (low >= 0),
  close numeric not null check (close >= 0),
  volume numeric check (volume >= 0),
  vwap numeric,
  provider text not null,
  collected_at timestamptz not null default now(),
  unique(symbol, interval, bar_timestamp, provider)
);

create table if not exists public.scanner_results (
  symbol text not null references public.market_assets(symbol) on delete cascade,
  scanner_type text not null,
  rank integer not null,
  score numeric not null check (score between 0 and 100),
  reasons jsonb not null default '[]'::jsonb,
  price numeric check (price >= 0),
  change_percent numeric,
  relative_volume numeric,
  volatility numeric,
  tier text not null,
  first_detected timestamptz not null default now(),
  last_detected timestamptz not null default now(),
  expires_at timestamptz not null,
  data_status text not null,
  primary key(symbol, scanner_type)
);

create table if not exists public.collector_status (
  collector_id text primary key,
  status text not null,
  current_version text,
  started_at timestamptz,
  stopped_at timestamptz,
  last_heartbeat timestamptz,
  last_daily_scan timestamptz,
  last_broad_scan timestamptz,
  last_priority_scan timestamptz,
  websocket_status text,
  live_symbols jsonb not null default '[]'::jsonb,
  assets_scanned integer not null default 0,
  records_written integer not null default 0,
  current_job text,
  last_error text,
  last_error_at timestamptz,
  process_id integer,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.collector_jobs (
  id uuid primary key default gen_random_uuid(),
  collector_id text not null,
  job_type text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null,
  assets_attempted integer not null default 0,
  assets_succeeded integer not null default 0,
  assets_failed integer not null default 0,
  records_written integer not null default 0,
  error_summary text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.provider_health (
  provider text not null,
  capability text not null,
  status text not null,
  last_success timestamptz,
  last_failure timestamptz,
  last_error text,
  rate_limited_until timestamptz,
  average_response_ms numeric,
  requests_today integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  primary key(provider, capability)
);

create table if not exists public.user_symbol_interest (
  symbol text primary key references public.market_assets(symbol) on delete cascade,
  interest_score numeric not null default 0,
  watchlist_count integer not null default 0,
  search_count integer not null default 0,
  page_view_count integer not null default 0,
  alert_count integer not null default 0,
  calculated_at timestamptz not null default now()
);

create index if not exists idx_latest_quotes_score on public.latest_quotes(scanner_score desc nulls last, collected_at desc);
create index if not exists idx_latest_quotes_collected on public.latest_quotes(collected_at desc);
create index if not exists idx_latest_quotes_stale_after on public.latest_quotes(stale_after);
create index if not exists idx_daily_bars_symbol_date on public.daily_bars(symbol, trading_date desc);
create index if not exists idx_intraday_bars_symbol_time on public.intraday_bars(symbol, interval, bar_timestamp desc);
create index if not exists idx_scanner_results_type_rank on public.scanner_results(scanner_type, rank);
create index if not exists idx_collector_status_heartbeat on public.collector_status(last_heartbeat desc);
create index if not exists idx_provider_health_status on public.provider_health(status, provider);

alter table public.market_assets enable row level security;
alter table public.latest_quotes enable row level security;
alter table public.daily_bars enable row level security;
alter table public.intraday_bars enable row level security;
alter table public.scanner_results enable row level security;
alter table public.collector_status enable row level security;
alter table public.collector_jobs enable row level security;
alter table public.provider_health enable row level security;
alter table public.user_symbol_interest enable row level security;

drop policy if exists "public collector assets readable" on public.market_assets;
create policy "public collector assets readable" on public.market_assets for select using (true);

drop policy if exists "public latest quotes readable" on public.latest_quotes;
create policy "public latest quotes readable" on public.latest_quotes for select using (true);

drop policy if exists "public daily bars readable" on public.daily_bars;
create policy "public daily bars readable" on public.daily_bars for select using (true);

drop policy if exists "public intraday bars readable" on public.intraday_bars;
create policy "public intraday bars readable" on public.intraday_bars for select using (true);

drop policy if exists "public scanner results readable" on public.scanner_results;
create policy "public scanner results readable" on public.scanner_results for select using (expires_at > now());

drop policy if exists "public collector status readable" on public.collector_status;
create policy "public collector status readable" on public.collector_status for select using (true);

drop policy if exists "public provider health readable" on public.provider_health;
create policy "public provider health readable" on public.provider_health for select using (true);

drop policy if exists "public aggregated interest readable" on public.user_symbol_interest;
create policy "public aggregated interest readable" on public.user_symbol_interest for select using (true);
