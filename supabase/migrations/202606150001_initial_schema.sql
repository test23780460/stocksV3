create extension if not exists pgcrypto;

create type public.user_role as enum ('guest', 'free', 'premium', 'admin');
create type public.asset_type as enum ('stock', 'crypto', 'etf', 'index', 'option');
create type public.data_status as enum ('Live', 'Delayed', 'Cached', 'Demo', 'Market closed', 'Stale', 'Incomplete', 'Temporarily unavailable', 'Provider error', 'Rate limited');
create type public.signal_label as enum ('Watch', 'Wait', 'Avoid', 'Research further');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  role public.user_role not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  beginner_mode boolean not null default true,
  compact_mode boolean not null default false,
  theme text not null default 'dark' check (theme in ('dark', 'light')),
  default_watchlist uuid,
  default_chart_interval text not null default '1Y',
  notification_preferences jsonb not null default '{}'::jsonb,
  time_zone text not null default 'America/New_York',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  name text not null,
  asset_type public.asset_type not null,
  exchange text,
  sector text,
  industry text,
  provider text not null default 'manual',
  is_supported boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(symbol, provider)
);

create table public.asset_aliases (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  alias text not null,
  provider text not null,
  unique(asset_id, alias, provider)
);

create table public.market_quotes (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  price numeric not null check (price >= 0),
  open numeric check (open >= 0),
  high numeric check (high >= 0),
  low numeric check (low >= 0),
  previous_close numeric check (previous_close >= 0),
  change numeric,
  change_percent numeric,
  volume numeric check (volume >= 0),
  relative_volume numeric check (relative_volume >= 0),
  market_cap numeric check (market_cap >= 0),
  bid numeric check (bid >= 0),
  ask numeric check (ask >= 0),
  provider text not null,
  provider_timestamp timestamptz not null,
  ingestion_timestamp timestamptz not null default now(),
  data_status public.data_status not null,
  market_status text not null,
  data_quality text not null default 'Normal',
  provider_metadata jsonb not null default '{}'::jsonb,
  unique(asset_id, provider, provider_timestamp)
);

create table public.price_bars (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  interval text not null,
  timestamp timestamptz not null,
  open numeric not null check (open >= 0),
  high numeric not null check (high >= 0),
  low numeric not null check (low >= 0),
  close numeric not null check (close >= 0),
  volume numeric check (volume >= 0),
  adjusted_close numeric check (adjusted_close >= 0),
  split_factor numeric,
  dividend_amount numeric,
  provider text not null,
  data_status public.data_status not null,
  data_quality text not null default 'Normal',
  provider_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(asset_id, interval, timestamp, provider)
);

create table public.market_snapshots (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  snapshot_at timestamptz not null,
  price numeric not null check (price >= 0),
  open numeric,
  high numeric,
  low numeric,
  previous_close numeric,
  change numeric,
  change_percent numeric,
  volume numeric check (volume >= 0),
  relative_volume numeric,
  bid numeric,
  ask numeric,
  provider text not null,
  provider_timestamp timestamptz not null,
  ingestion_run_id uuid,
  data_status public.data_status not null,
  market_status text not null,
  unique(asset_id, snapshot_at, provider)
);

create table public.market_rollups_hourly (
  asset_id uuid not null references public.assets(id) on delete cascade,
  hour_start timestamptz not null,
  open numeric,
  high numeric,
  low numeric,
  close numeric,
  volume numeric,
  provider text not null,
  primary key(asset_id, hour_start, provider)
);

create table public.market_rollups_daily (
  asset_id uuid not null references public.assets(id) on delete cascade,
  day date not null,
  open numeric,
  high numeric,
  low numeric,
  close numeric,
  volume numeric,
  provider text not null,
  primary key(asset_id, day, provider)
);

create table public.technical_indicators (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  timestamp timestamptz not null,
  rsi numeric,
  macd numeric,
  atr numeric,
  sma20 numeric,
  sma50 numeric,
  sma200 numeric,
  ema12 numeric,
  ema26 numeric,
  bollinger_upper numeric,
  bollinger_lower numeric,
  support numeric,
  resistance numeric,
  provider text not null,
  model_version text not null,
  explanations jsonb not null default '{}'::jsonb,
  unique(asset_id, timestamp, model_version)
);

create table public.sector_snapshots (
  id uuid primary key default gen_random_uuid(),
  sector text not null,
  snapshot_at timestamptz not null,
  change_percent numeric,
  breadth_percent numeric,
  risk_score numeric,
  data_status public.data_status not null,
  provider text not null,
  unique(sector, snapshot_at, provider)
);

create table public.index_snapshots (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  snapshot_at timestamptz not null,
  breadth_percent numeric,
  change_percent numeric,
  provider text not null,
  unique(asset_id, snapshot_at, provider)
);

create table public.crypto_snapshots (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  snapshot_at timestamptz not null,
  dominance numeric,
  liquidity_score numeric,
  provider text not null,
  unique(asset_id, snapshot_at, provider)
);

create table public.option_contracts (
  id uuid primary key default gen_random_uuid(),
  underlying_asset_id uuid not null references public.assets(id) on delete cascade,
  symbol text not null,
  expiration_date date not null,
  strike numeric not null,
  contract_type text not null check (contract_type in ('call', 'put')),
  provider text not null,
  created_at timestamptz not null default now(),
  unique(symbol, provider)
);

create table public.option_quotes (
  id uuid primary key default gen_random_uuid(),
  option_contract_id uuid not null references public.option_contracts(id) on delete cascade,
  bid numeric,
  ask numeric,
  last_price numeric,
  volume numeric,
  open_interest numeric,
  implied_volatility numeric,
  intrinsic_value numeric,
  extrinsic_value numeric,
  delta numeric,
  gamma numeric,
  theta numeric,
  vega numeric,
  provider text not null,
  provider_timestamp timestamptz not null,
  ingestion_timestamp timestamptz not null default now(),
  data_status public.data_status not null,
  liquidity_warning text,
  high_risk_warning text not null default 'Options are high risk and research-only.',
  unique(option_contract_id, provider, provider_timestamp)
);

create table public.news_articles (
  id uuid primary key default gen_random_uuid(),
  headline text not null,
  source text not null,
  url text,
  published_at timestamptz not null,
  fetched_at timestamptz not null default now(),
  tone text not null default 'Neutral',
  impact_score numeric,
  summary text,
  provider text not null,
  provider_metadata jsonb not null default '{}'::jsonb,
  unique(provider, url)
);

create table public.news_asset_links (
  news_article_id uuid not null references public.news_articles(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  relevance_score numeric,
  primary key(news_article_id, asset_id)
);

create table public.watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.watchlist_items (
  id uuid primary key default gen_random_uuid(),
  watchlist_id uuid not null references public.watchlists(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(watchlist_id, asset_id)
);

create table public.predictions (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  created_at timestamptz not null default now(),
  horizon text not null,
  signal public.signal_label not null,
  confidence numeric not null check (confidence between 0 and 100),
  risk numeric not null check (risk between 0 and 100),
  safety numeric not null check (safety between 0 and 100),
  possible_gain_percent numeric,
  possible_loss_percent numeric,
  uncertainty text not null,
  thesis jsonb not null,
  invalidation text not null,
  model_version text not null,
  supporting_evidence jsonb not null default '{}'::jsonb,
  immutable_hash text,
  status text not null default 'Open',
  unique(asset_id, created_at, horizon, model_version)
);

create table public.prediction_outcomes (
  prediction_id uuid primary key references public.predictions(id) on delete cascade,
  evaluated_at timestamptz not null default now(),
  outcome text not null,
  start_price numeric,
  end_price numeric,
  realized_change_percent numeric,
  notes text
);

create table public.signal_runs (
  id uuid primary key default gen_random_uuid(),
  run_at timestamptz not null default now(),
  model_version text not null,
  assets_processed integer not null default 0,
  success_count integer not null default 0,
  failure_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb
);

create table public.data_ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  provider text not null,
  status text not null,
  assets_requested integer not null default 0,
  success_count integer not null default 0,
  failure_count integer not null default 0,
  rate_limit_status text,
  metadata jsonb not null default '{}'::jsonb
);

create table public.api_usage_logs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  run_id uuid references public.data_ingestion_runs(id) on delete set null,
  endpoint text not null,
  request_count integer not null default 1,
  status_code integer,
  error_class text,
  logged_at timestamptz not null default now()
);

create table public.historical_backfill_jobs (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid references public.profiles(id) on delete set null,
  status text not null default 'queued',
  mode text not null,
  symbols text[],
  start_date date,
  end_date date,
  rows_imported integer not null default 0,
  symbols_completed integer not null default 0,
  symbols_remaining integer not null default 0,
  last_success_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.historical_backfill_failures (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.historical_backfill_jobs(id) on delete cascade,
  symbol text not null,
  missing_start date,
  missing_end date,
  error_class text,
  error_message text,
  permanent boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.data_quality_events (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references public.assets(id) on delete cascade,
  label text not null check (label in ('Verified', 'Normal', 'Incomplete', 'Stale', 'Suspicious', 'Repaired', 'Missing', 'Provider conflict')),
  severity text not null default 'info',
  detail text not null,
  provider text,
  event_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table public.scan_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  symbol text not null,
  request_type text not null default 'refresh',
  status text not null default 'queued',
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  rate_limit_key text,
  unique(user_id, symbol, request_type, requested_at)
);

create table public.alert_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  asset_id uuid references public.assets(id) on delete cascade,
  alert_type text not null,
  threshold jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.alert_events (
  id uuid primary key default gen_random_uuid(),
  alert_rule_id uuid references public.alert_rules(id) on delete set null,
  asset_id uuid references public.assets(id) on delete cascade,
  event_type text not null,
  message text not null,
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);

create table public.daily_ai_summaries (
  id uuid primary key default gen_random_uuid(),
  summary_date date not null unique,
  title text not null,
  body text not null,
  source_count integer not null default 0,
  confidence_note text not null,
  created_at timestamptz not null default now()
);

create table public.glossary_terms (
  id uuid primary key default gen_random_uuid(),
  term text not null unique,
  category text not null,
  short_definition text not null,
  full_definition text not null,
  beginner_example text not null,
  formula text,
  related_terms text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.aggregate_search_stats (
  symbol text not null,
  day date not null,
  search_count integer not null default 0,
  watchlist_add_count integer not null default 0,
  primary key(symbol, day)
);

create table public.provider_status (
  provider text primary key,
  market_data_status text not null,
  news_data_status text not null,
  last_checked_at timestamptz not null default now(),
  note text
);

create table public.model_versions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  config jsonb not null default '{}'::jsonb,
  active boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_table text,
  target_id uuid,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index idx_assets_symbol on public.assets(symbol);
create index idx_market_quotes_asset_time on public.market_quotes(asset_id, provider_timestamp desc);
create index idx_price_bars_asset_interval_time on public.price_bars(asset_id, interval, timestamp desc);
create index idx_market_snapshots_asset_time on public.market_snapshots(asset_id, snapshot_at desc);
create index idx_news_published_at on public.news_articles(published_at desc);
create index idx_predictions_asset_created on public.predictions(asset_id, created_at desc);
create index idx_scan_requests_status on public.scan_requests(status, requested_at);
create index idx_data_quality_events_asset on public.data_quality_events(asset_id, event_at desc);

