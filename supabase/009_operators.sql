-- =============================================================================
-- Cali Aircrew — operator profiles (owners, charter operators…). Run once in the SQL Editor (safe to re-run).
-- Version 009 · 2026-10-03 · needs 002 and 007.
--
-- Adds
--   operator_profiles.details   tap-to-choose answers (looking for, operations, work type, region, airport)
--   operator kinds              + flight school, other
--   moderation.op_approved / op_hidden   operator profiles are reviewed separately from crew profiles
--   operator_about_pending      an operator's new "About" text, waiting for review (like crew_bio_pending)
--   admin_moderate_operator / admin_decline_operator_text   (admins only, audited)
-- Operators are public only when published AND op_approved AND NOT op_hidden.
-- =============================================================================

alter table public.operator_profiles add column if not exists details jsonb not null default '{}'::jsonb;
alter table public.operator_profiles drop constraint if exists operator_profiles_details_check;
alter table public.operator_profiles add constraint operator_profiles_details_check
  check (jsonb_typeof(details) = 'object' and pg_column_size(details) < 8192);
alter table public.operator_profiles drop constraint if exists operator_profiles_kind_check;
alter table public.operator_profiles add constraint operator_profiles_kind_check
  check (kind in ('owner', 'charter', 'management', 'flight_department', 'school', 'other'));

alter table public.moderation add column if not exists op_approved boolean not null default false;
alter table public.moderation add column if not exists op_hidden boolean not null default false;

create or replace function public.is_listed_op(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.moderation m where m.user_id = uid and m.op_approved and not m.op_hidden);
$$;
revoke all on function public.is_listed_op(uuid) from public;
grant execute on function public.is_listed_op(uuid) to anon, authenticated;

drop policy if exists "operator read" on public.operator_profiles;
create policy "operator read" on public.operator_profiles for select to anon, authenticated
  using ((published and public.is_listed_op(user_id)) or user_id = (select auth.uid()) or (select public.is_admin()));

create or replace view public.aircraft_operator_counts with (security_invoker = on) as
  select a.acft_seq, count(*)::int as operators
  from public.operator_aircraft a join public.operator_profiles p on p.user_id = a.user_id
  where p.published and public.is_listed_op(p.user_id)
  group by a.acft_seq;
grant select on public.aircraft_operator_counts to anon, authenticated;

-- ---------- operator "About" text waits for review ----------
create table if not exists public.operator_about_pending (
  user_id    uuid primary key default auth.uid() references public.operator_profiles (user_id) on delete cascade,
  about      text not null default '' check (length(about) <= 2000),
  updated_at timestamptz not null default now()
);
alter table public.operator_about_pending enable row level security;
revoke all on public.operator_about_pending from anon, authenticated;
grant select, insert, update, delete on public.operator_about_pending to authenticated;
drop policy if exists "own or admin read pending about" on public.operator_about_pending;
create policy "own or admin read pending about" on public.operator_about_pending for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "own pending about" on public.operator_about_pending;
create policy "own pending about" on public.operator_about_pending for all to authenticated
  using (user_id = (select auth.uid()) and (select public.mfa_ok()))
  with check (user_id = (select auth.uid()) and (select public.mfa_ok()));

create or replace function public.operator_about_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Only admins change the public About text; the page saves new text into operator_about_pending.
  if public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then new.about := ''; else new.about := old.about; end if;
  return new;
end $$;
drop trigger if exists operator_about_guard on public.operator_profiles;
create trigger operator_about_guard before insert or update on public.operator_profiles for each row execute function public.operator_about_guard();

-- ---------- admin functions ----------
create or replace function public.admin_moderate_operator(p_user uuid, p_approved boolean, p_hidden boolean, p_note text, p_approve_text boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare pend text;
begin
  perform public.admin_guard();
  insert into public.moderation (user_id, op_approved, op_hidden, note)
  values (p_user, coalesce(p_approved, false), coalesce(p_hidden, false), left(coalesce(p_note, ''), 1000))
  on conflict (user_id) do update set op_approved = excluded.op_approved, op_hidden = excluded.op_hidden;   -- the crew review's note is left as is
  if p_approve_text then
    select about into pend from public.operator_about_pending where user_id = p_user;
    if found then
      update public.operator_profiles set about = pend where user_id = p_user;
      delete from public.operator_about_pending where user_id = p_user;
    end if;
  end if;
  perform public.admin_log('moderate_operator', p_user, jsonb_build_object('approved', p_approved, 'hidden', p_hidden, 'approved_text', p_approve_text));
end $$;

create or replace function public.admin_decline_operator_text(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.admin_guard();
  delete from public.operator_about_pending where user_id = p_user;
  perform public.admin_log('decline_operator_text', p_user, '{}'::jsonb);
end $$;

revoke all on function public.admin_moderate_operator(uuid, boolean, boolean, text, boolean), public.admin_decline_operator_text(uuid) from public, anon;
grant execute on function public.admin_moderate_operator(uuid, boolean, boolean, text, boolean), public.admin_decline_operator_text(uuid) to authenticated;

-- Self-check
select relname as table_name, relrowsecurity as rls_on from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r' and relname in ('operator_profiles', 'operator_aircraft', 'operator_about_pending')
order by 1;
