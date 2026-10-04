-- Cali Aircrew — admin metrics work whether or not the checklist sync tables (001) exist. Run once (safe to re-run).
-- Version 008 · 2026-10-03 · the same function is now in 007 as well.
create or replace function public.admin_metrics() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb; ck bigint := 0; cu bigint := 0;
begin
  perform public.admin_guard();
  -- Checklist sync tables are optional (supabase/001); count them only if they exist.
  if to_regclass('public.checklists') is not null then
    execute 'select count(*) filter (where not deleted), count(distinct user_id) filter (where not deleted) from public.checklists' into ck, cu;
  end if;
  select jsonb_build_object(
    'users_total',   (select count(*) from auth.users),
    'users_7d',      (select count(*) from auth.users where created_at >= now() - interval '7 days'),
    'users_30d',     (select count(*) from auth.users where created_at >= now() - interval '30 days'),
    'active_30d',    (select count(*) from auth.users where last_sign_in_at >= now() - interval '30 days'),
    'mfa_users',     (select count(distinct user_id) from auth.mfa_factors where status = 'verified'),
    'admins',        (select count(*) from public.admins),
    'users_weekly',  (select coalesce(jsonb_agg(n order by wk), '[]'::jsonb) from (
                        select w.wk, (select count(*) from auth.users u where u.created_at >= w.wk and u.created_at < w.wk + interval '7 days') n
                        from generate_series(date_trunc('week', now()) - interval '11 weeks', date_trunc('week', now()), interval '1 week') w(wk)) x),
    'searches_7d',   (select count(*) from public.search_log where at >= now() - interval '7 days'),
    'searches_30d',  (select count(*) from public.search_log where at >= now() - interval '30 days'),
    'searches_weekly', (select coalesce(jsonb_agg(n order by wk), '[]'::jsonb) from (
                        select w.wk, (select count(*) from public.search_log s where s.at >= w.wk and s.at < w.wk + interval '7 days') n
                        from generate_series(date_trunc('week', now()) - interval '11 weeks', date_trunc('week', now()), interval '1 week') w(wk)) x),
    'checklists_total', ck,
    'checklist_users',  cu,
    'checklist_sync',   to_regclass('public.checklists') is not null,
    'notify_total',  (select count(*) from public.notify_signups),
    'notify_7d',     (select count(*) from public.notify_signups where created_at >= now() - interval '7 days'),
    'notify_by_role', (select coalesce(jsonb_object_agg(role, n), '{}'::jsonb) from (select coalesce(nullif(role, ''), 'unknown') role, count(*) n from public.notify_signups group by 1) x),
    'aircraft_requests_open', (select count(*) from public.aircraft_requests where status = 'open'),
    'privacy_open',  (select count(*) from public.privacy_requests where status = 'open'),
    'pending_text',  (select count(*) from public.crew_bio_pending),
    'db_bytes',      pg_database_size(current_database())
  ) into r;
  return r;
end $$;
grant execute on function public.admin_metrics() to authenticated;
select 'admin_metrics updated' as result;
