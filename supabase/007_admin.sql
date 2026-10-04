-- =============================================================================
-- Cali Aircrew — admin page database update. Run once in the SQL Editor (safe to re-run).
-- Version 007 · 2026-10-03 · needs 002 (and 004/006 for the newer profile fields).
--
-- Adds
--   admin_audit        every admin action (who, what, when)
--   search_log         anonymous Find crew searches (aircraft, region, result count) for demand metrics
--   site_settings      site-wide settings; key 'banner' = announcement shown at the top of every page
--   partners           partner listings (insurance, training, schools…) managed from the admin page
--   aircraft_requests  "Can't find your aircraft? Request it" from pilots
--   privacy_requests   log of California (CCPA) data access / deletion requests
--   crew_bio_pending   a crew member's new "Anything else" text, waiting for review before it shows publicly
--   admin_* functions  everything the admin page does; each one refuses unless the caller is an admin
--
-- Safety
--   No secret keys in the browser: each admin_* function checks public.is_admin() first.
--   Admins cannot delete another admin (remove admin first) or remove the last admin.
--   Deleting an account requires typing that account's email address.
-- =============================================================================

-- ---------- audit log ----------
create table if not exists public.admin_audit (
  id           bigint generated always as identity primary key,
  at           timestamptz not null default now(),
  admin_id     uuid,
  admin_email  text not null default '',
  action       text not null,
  target_user  uuid,
  target_email text not null default '',
  detail       jsonb not null default '{}'::jsonb
);
alter table public.admin_audit enable row level security;
revoke all on public.admin_audit from anon, authenticated;
grant select on public.admin_audit to authenticated;
drop policy if exists "admins read audit" on public.admin_audit;
create policy "admins read audit" on public.admin_audit for select to authenticated using ((select public.is_admin()));

create or replace function public.admin_log(p_action text, p_target uuid, p_detail jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.admin_audit (admin_id, admin_email, action, target_user, target_email, detail)
  values ((select auth.uid()),
          coalesce((select u.email from auth.users u where u.id = (select auth.uid())), ''),
          p_action, p_target,
          coalesce((select u.email from auth.users u where u.id = p_target), ''),
          coalesce(p_detail, '{}'::jsonb));
end $$;
revoke all on function public.admin_log(text, uuid, jsonb) from public, anon, authenticated;

create or replace function public.admin_guard() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
end $$;
revoke all on function public.admin_guard() from public, anon, authenticated;

-- ---------- anonymous search log (demand metrics) ----------
create table if not exists public.search_log (
  id        bigint generated always as identity primary key,
  at        timestamptz not null default now(),
  acft_seq  integer check (acft_seq is null or acft_seq >= 0),
  region    text not null default '' check (length(region) <= 20),
  filters   jsonb not null default '{}'::jsonb check (pg_column_size(filters) < 1024),
  results   integer not null default 0 check (results between 0 and 100000)
);
alter table public.search_log enable row level security;
revoke all on public.search_log from anon, authenticated;
grant insert (acft_seq, region, filters, results) on public.search_log to anon, authenticated;
grant select on public.search_log to authenticated;
drop policy if exists "anyone logs a search" on public.search_log;
create policy "anyone logs a search" on public.search_log for insert to anon, authenticated with check (true);
drop policy if exists "admins read searches" on public.search_log;
create policy "admins read searches" on public.search_log for select to authenticated using ((select public.is_admin()));
create index if not exists search_log_at on public.search_log (at);

-- ---------- site settings (announcement banner) ----------
create table if not exists public.site_settings (
  key        text primary key check (key in ('banner')),
  value      jsonb not null default '{}'::jsonb check (pg_column_size(value) < 4096),
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
revoke all on public.site_settings from anon, authenticated;
grant select on public.site_settings to anon, authenticated;
drop policy if exists "settings readable" on public.site_settings;
create policy "settings readable" on public.site_settings for select to anon, authenticated using (true);
insert into public.site_settings (key, value) values ('banner', '{"on": false, "text": "", "kind": "info"}') on conflict (key) do nothing;

create or replace function public.admin_set_banner(p_on boolean, p_text text, p_kind text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.admin_guard();
  if length(coalesce(p_text, '')) > 200 then raise exception 'Banner text is limited to 200 characters'; end if;
  insert into public.site_settings (key, value, updated_at)
  values ('banner', jsonb_build_object('on', p_on, 'text', coalesce(p_text, ''), 'kind', case when p_kind in ('info', 'warn') then p_kind else 'info' end), now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
  perform public.admin_log('banner', null, jsonb_build_object('on', p_on, 'text', p_text));
end $$;

-- ---------- partners ----------
create table if not exists public.partners (
  id        bigint generated always as identity primary key,
  name      text not null check (length(name) between 1 and 80),
  category  text not null default 'other' check (category in ('insurance', 'training', 'school', 'fbo', 'maintenance', 'other')),
  url       text not null default '' check (url = '' or url ~* '^https://[^\s]+$'),
  blurb     text not null default '' check (length(blurb) <= 200),
  active    boolean not null default true,
  ends_on   date,
  sort      integer not null default 100,
  created_at timestamptz not null default now()
);
alter table public.partners enable row level security;
revoke all on public.partners from anon, authenticated;
grant select on public.partners to anon, authenticated;
grant insert, update, delete on public.partners to authenticated;
drop policy if exists "current partners readable" on public.partners;
create policy "current partners readable" on public.partners for select to anon, authenticated
  using ((active and (ends_on is null or ends_on >= current_date)) or (select public.is_admin()));
drop policy if exists "admins manage partners" on public.partners;
create policy "admins manage partners" on public.partners for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------- aircraft requests ----------
create table if not exists public.aircraft_requests (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id    uuid default auth.uid() references auth.users (id) on delete set null,
  request    text not null check (length(request) between 3 and 200),
  status     text not null default 'open' check (status in ('open', 'added', 'declined')),
  note       text not null default '' check (length(note) <= 200)
);
alter table public.aircraft_requests enable row level security;
revoke all on public.aircraft_requests from anon, authenticated;
grant select, update on public.aircraft_requests to authenticated;
grant insert (request) on public.aircraft_requests to authenticated;
drop policy if exists "signed-in users request aircraft" on public.aircraft_requests;
create policy "signed-in users request aircraft" on public.aircraft_requests for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "own or admin read requests" on public.aircraft_requests;
create policy "own or admin read requests" on public.aircraft_requests for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "admins update requests" on public.aircraft_requests;
create policy "admins update requests" on public.aircraft_requests for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------- privacy (CCPA) request log ----------
create table if not exists public.privacy_requests (
  id           bigint generated always as identity primary key,
  received_on  date not null default current_date,
  email        text not null check (length(email) <= 254),
  kind         text not null check (kind in ('access', 'delete', 'correct', 'opt_out')),
  status       text not null default 'open' check (status in ('open', 'done')),
  notes        text not null default '' check (length(notes) <= 1000),
  completed_on date
);
alter table public.privacy_requests enable row level security;
revoke all on public.privacy_requests from anon, authenticated;
grant select, insert, update, delete on public.privacy_requests to authenticated;
drop policy if exists "admins manage privacy requests" on public.privacy_requests;
create policy "admins manage privacy requests" on public.privacy_requests for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------- free text waits for review ----------
-- crew_profiles.bio is the PUBLIC text and only changes when an admin approves.
-- A crew member's new text goes to crew_bio_pending (visible to them and admins only).
create table if not exists public.crew_bio_pending (
  user_id    uuid primary key default auth.uid() references public.crew_profiles (user_id) on delete cascade,
  bio        text not null default '' check (length(bio) <= 2000),
  updated_at timestamptz not null default now()
);
alter table public.crew_bio_pending enable row level security;
revoke all on public.crew_bio_pending from anon, authenticated;
grant select, insert, update, delete on public.crew_bio_pending to authenticated;
drop policy if exists "own or admin read pending text" on public.crew_bio_pending;
create policy "own or admin read pending text" on public.crew_bio_pending for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "own pending text" on public.crew_bio_pending;
create policy "own pending text" on public.crew_bio_pending for all to authenticated
  using (user_id = (select auth.uid()) and (select public.mfa_ok()))
  with check (user_id = (select auth.uid()) and (select public.mfa_ok()));

create or replace function public.crew_bio_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Only admins change the public text. Crew members' new text is saved by the page into crew_bio_pending.
  if public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then new.bio := ''; else new.bio := old.bio; end if;
  return new;
end $$;
drop trigger if exists crew_bio_guard on public.crew_profiles;
create trigger crew_bio_guard before insert or update on public.crew_profiles for each row execute function public.crew_bio_guard();

-- ---------- admin functions ----------
create or replace function public.admin_users() returns table (
  user_id uuid, email text, created_at timestamptz, last_sign_in_at timestamptz, has_mfa boolean, is_admin boolean,
  has_profile boolean, published boolean, approved boolean, hidden boolean, display_name text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.admin_guard();
  return query
    select u.id, u.email::text, u.created_at, u.last_sign_in_at,
           exists (select 1 from auth.mfa_factors f where f.user_id = u.id and f.status = 'verified'),
           exists (select 1 from public.admins a where a.user_id = u.id),
           p.user_id is not null, coalesce(p.published, false), coalesce(m.approved, false), coalesce(m.hidden, false),
           coalesce(p.display_name, '')
    from auth.users u
    left join public.crew_profiles p on p.user_id = u.id
    left join public.moderation m on m.user_id = u.id
    order by u.created_at desc;
end $$;

create or replace function public.admin_moderate(p_user uuid, p_approved boolean, p_hidden boolean, p_verified boolean, p_note text, p_approve_text boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare pend text;
begin
  perform public.admin_guard();
  insert into public.moderation (user_id, approved, hidden, verified_faa, note)
  values (p_user, coalesce(p_approved, false), coalesce(p_hidden, false), coalesce(p_verified, false), left(coalesce(p_note, ''), 1000))
  on conflict (user_id) do update set approved = excluded.approved, hidden = excluded.hidden, verified_faa = excluded.verified_faa, note = excluded.note;
  if p_approve_text then
    select bio into pend from public.crew_bio_pending where user_id = p_user;
    if found then
      update public.crew_profiles set bio = pend where user_id = p_user;
      delete from public.crew_bio_pending where user_id = p_user;
    end if;
  end if;
  perform public.admin_log('moderate', p_user, jsonb_build_object('approved', p_approved, 'hidden', p_hidden, 'verified_faa', p_verified, 'approved_text', p_approve_text));
end $$;

create or replace function public.admin_decline_text(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.admin_guard();
  delete from public.crew_bio_pending where user_id = p_user;
  perform public.admin_log('decline_text', p_user, '{}'::jsonb);
end $$;

create or replace function public.admin_remove_mfa(p_user uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  perform public.admin_guard();
  delete from auth.mfa_factors where user_id = p_user;
  get diagnostics n = row_count;
  perform public.admin_log('remove_authenticator', p_user, jsonb_build_object('factors_removed', n));
  return n;
end $$;

create or replace function public.admin_set_admin(p_user uuid, p_make boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.admin_guard();
  if p_make then
    insert into public.admins (user_id) values (p_user) on conflict do nothing;
  else
    if (select count(*) from public.admins) <= 1 and exists (select 1 from public.admins where user_id = p_user) then
      raise exception 'Cannot remove the last admin';
    end if;
    delete from public.admins where user_id = p_user;
  end if;
  perform public.admin_log(case when p_make then 'make_admin' else 'remove_admin' end, p_user, '{}'::jsonb);
end $$;

create or replace function public.admin_delete_user(p_user uuid, p_confirm_email text) returns void
language plpgsql security definer set search_path = '' as $$
declare em text;
begin
  perform public.admin_guard();
  select u.email into em from auth.users u where u.id = p_user;
  if em is null then raise exception 'No such user'; end if;
  if lower(trim(coalesce(p_confirm_email, ''))) <> lower(em) then raise exception 'Type the account''s email address exactly to confirm'; end if;
  if p_user = (select auth.uid()) then raise exception 'You cannot delete your own account here'; end if;
  if exists (select 1 from public.admins where user_id = p_user) then raise exception 'Remove admin access first'; end if;
  perform public.admin_log('delete_account', p_user, jsonb_build_object('email', em));
  delete from auth.users where id = p_user;
end $$;

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

create or replace function public.admin_search_stats(p_days integer) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb; since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)));
begin
  perform public.admin_guard();
  select jsonb_build_object(
    'top_aircraft', (select coalesce(jsonb_agg(x order by x.n desc), '[]'::jsonb) from (
        select acft_seq, count(*) n, round(avg(results), 1) avg_results from public.search_log
        where at >= since and acft_seq is not null group by acft_seq order by count(*) desc limit 15) x),
    'top_regions', (select coalesce(jsonb_agg(x order by x.n desc), '[]'::jsonb) from (
        select region, count(*) n from public.search_log where at >= since and region <> '' group by region order by count(*) desc limit 15) x),
    'zero_results', (select coalesce(jsonb_agg(x order by x.n desc), '[]'::jsonb) from (
        select acft_seq, region, count(*) n from public.search_log
        where at >= since and results = 0 and (acft_seq is not null or region <> '') group by acft_seq, region order by count(*) desc limit 20) x)
  ) into r;
  return r;
end $$;

-- Who can call what: admin functions are callable by signed-in users and refuse non-admins inside.
revoke all on function public.admin_users(), public.admin_moderate(uuid, boolean, boolean, boolean, text, boolean), public.admin_decline_text(uuid),
  public.admin_remove_mfa(uuid), public.admin_set_admin(uuid, boolean), public.admin_delete_user(uuid, text), public.admin_metrics(),
  public.admin_search_stats(integer), public.admin_set_banner(boolean, text, text) from public, anon;
grant execute on function public.admin_users(), public.admin_moderate(uuid, boolean, boolean, boolean, text, boolean), public.admin_decline_text(uuid),
  public.admin_remove_mfa(uuid), public.admin_set_admin(uuid, boolean), public.admin_delete_user(uuid, text), public.admin_metrics(),
  public.admin_search_stats(integer), public.admin_set_banner(boolean, text, text) to authenticated;

-- Self-check: new tables with row level security on
select relname as table_name, relrowsecurity as rls_on from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r'
  and relname in ('admin_audit', 'search_log', 'site_settings', 'partners', 'aircraft_requests', 'privacy_requests', 'crew_bio_pending')
order by 1;
