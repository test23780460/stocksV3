alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.assets enable row level security;
alter table public.asset_aliases enable row level security;
alter table public.market_quotes enable row level security;
alter table public.price_bars enable row level security;
alter table public.market_snapshots enable row level security;
alter table public.market_rollups_hourly enable row level security;
alter table public.market_rollups_daily enable row level security;
alter table public.technical_indicators enable row level security;
alter table public.sector_snapshots enable row level security;
alter table public.index_snapshots enable row level security;
alter table public.crypto_snapshots enable row level security;
alter table public.option_contracts enable row level security;
alter table public.option_quotes enable row level security;
alter table public.news_articles enable row level security;
alter table public.news_asset_links enable row level security;
alter table public.watchlists enable row level security;
alter table public.watchlist_items enable row level security;
alter table public.predictions enable row level security;
alter table public.prediction_outcomes enable row level security;
alter table public.signal_runs enable row level security;
alter table public.data_ingestion_runs enable row level security;
alter table public.api_usage_logs enable row level security;
alter table public.historical_backfill_jobs enable row level security;
alter table public.historical_backfill_failures enable row level security;
alter table public.data_quality_events enable row level security;
alter table public.scan_requests enable row level security;
alter table public.alert_rules enable row level security;
alter table public.alert_events enable row level security;
alter table public.daily_ai_summaries enable row level security;
alter table public.glossary_terms enable row level security;
alter table public.aggregate_search_stats enable row level security;
alter table public.provider_status enable row level security;
alter table public.model_versions enable row level security;
alter table public.admin_audit_logs enable row level security;

create or replace function public.current_user_role()
returns public.user_role
language sql
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'guest'::public.user_role);
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.current_user_role() = 'admin'::public.user_role;
$$;

create policy "profiles read own or admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

create policy "profiles update own non-role fields" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

create policy "settings own" on public.user_settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "public market assets readable" on public.assets for select using (true);
create policy "public aliases readable" on public.asset_aliases for select using (true);
create policy "public quotes readable" on public.market_quotes for select using (true);
create policy "public bars readable" on public.price_bars for select using (true);
create policy "public snapshots readable" on public.market_snapshots for select using (true);
create policy "public hourly rollups readable" on public.market_rollups_hourly for select using (true);
create policy "public daily rollups readable" on public.market_rollups_daily for select using (true);
create policy "public technical indicators readable" on public.technical_indicators for select using (true);
create policy "public sector snapshots readable" on public.sector_snapshots for select using (true);
create policy "public index snapshots readable" on public.index_snapshots for select using (true);
create policy "public crypto snapshots readable" on public.crypto_snapshots for select using (true);
create policy "public option contracts readable" on public.option_contracts for select using (true);
create policy "public option quotes readable" on public.option_quotes for select using (true);
create policy "public news readable" on public.news_articles for select using (true);
create policy "public news links readable" on public.news_asset_links for select using (true);
create policy "public predictions readable" on public.predictions for select using (true);
create policy "public outcomes readable" on public.prediction_outcomes for select using (true);
create policy "public daily summaries readable" on public.daily_ai_summaries for select using (true);
create policy "public glossary readable" on public.glossary_terms for select using (true);
create policy "public provider status readable" on public.provider_status for select using (true);
create policy "public model versions readable" on public.model_versions for select using (true);

create policy "watchlists own read" on public.watchlists for select using (user_id = auth.uid());
create policy "watchlists own write" on public.watchlists for insert with check (user_id = auth.uid());
create policy "watchlists own update" on public.watchlists for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "watchlists own delete" on public.watchlists for delete using (user_id = auth.uid());

create policy "watchlist items own read" on public.watchlist_items
  for select using (exists (select 1 from public.watchlists w where w.id = watchlist_id and w.user_id = auth.uid()));
create policy "watchlist items own insert" on public.watchlist_items
  for insert with check (exists (select 1 from public.watchlists w where w.id = watchlist_id and w.user_id = auth.uid()));
create policy "watchlist items own delete" on public.watchlist_items
  for delete using (exists (select 1 from public.watchlists w where w.id = watchlist_id and w.user_id = auth.uid()));

create policy "scan requests own read" on public.scan_requests for select using (user_id = auth.uid() or public.is_admin());
create policy "scan requests own insert" on public.scan_requests for insert with check (user_id = auth.uid());

create policy "alert rules own" on public.alert_rules for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "alert events own read" on public.alert_events
  for select using (
    exists (
      select 1 from public.alert_rules r
      where r.id = alert_rule_id and r.user_id = auth.uid()
    ) or public.is_admin()
  );

create policy "admin read signal runs" on public.signal_runs for select using (public.is_admin());
create policy "admin read ingestion runs" on public.data_ingestion_runs for select using (public.is_admin());
create policy "admin read api logs" on public.api_usage_logs for select using (public.is_admin());
create policy "admin read backfill jobs" on public.historical_backfill_jobs for select using (public.is_admin());
create policy "admin read backfill failures" on public.historical_backfill_failures for select using (public.is_admin());
create policy "admin read quality events" on public.data_quality_events for select using (public.is_admin());
create policy "admin read search aggregates" on public.aggregate_search_stats for select using (public.is_admin());
create policy "admin read audit logs" on public.admin_audit_logs for select using (public.is_admin());

create policy "admins manage public data" on public.assets for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage provider status" on public.provider_status for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage model versions" on public.model_versions for all using (public.is_admin()) with check (public.is_admin());
create policy "admins audit insert" on public.admin_audit_logs for insert with check (public.is_admin());

-- Trusted GitHub Actions writes use the Supabase service-role key, which bypasses RLS.
-- Browser users cannot insert trusted market quotes, predictions, ingestion logs, or provider status.

