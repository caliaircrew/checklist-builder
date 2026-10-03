-- =============================================================================
-- Cali Aircrew — crew directory (Phase 1) database setup. Run once in the SQL Editor.
-- Version 002 · 2026-10-03 · safe to re-run.
--
-- Tables
--   admins             who can moderate (James, Steve)
--   moderation         per-user approval / hide / FAA-verified flags (admins only write)
--   crew_profiles      one per crew member; public only when published AND approved
--   crew_aircraft      aircraft a crew member flies (aircraft seq from the builder list), hours, type rating
--   operator_profiles  owners / charter operators; public only when published AND approved
--   operator_aircraft  aircraft an operator flies, how many
--   notify_signups     "Get notified" email list from the homepage (insert-only for the public)
--   aircraft_crew_counts / aircraft_operator_counts   public counts per aircraft (views)
--
-- Privacy rules
--   * Anyone can READ published + approved + not-hidden profiles (that is the directory).
--   * A signed-in user can create and change ONLY their own profile rows.
--   * Only admins can approve, hide, or mark FAA-verified, and read the notify list.
--   * Users with Microsoft Authenticator turned on must pass it to change their rows (aal2).
-- =============================================================================

-- ---------- admins ----------
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins a where a.user_id = (select auth.uid()));
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- MFA helper: true when the user has no verified authenticator, or has passed it this session
create or replace function public.mfa_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt() ->> 'aal') = 'aal2', false)
      or not exists (select 1 from auth.mfa_factors f where f.user_id = (select auth.uid()) and f.status = 'verified');
$$;
revoke all on function public.mfa_ok() from public;
grant execute on function public.mfa_ok() to authenticated;

-- ---------- moderation ----------
create table if not exists public.moderation (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  approved     boolean not null default false,
  hidden       boolean not null default false,
  verified_faa boolean not null default false,
  note         text not null default '',
  updated_at   timestamptz not null default now()
);
alter table public.moderation enable row level security;
revoke all on public.moderation from anon, authenticated;
grant select on public.moderation to anon, authenticated;
grant insert, update, delete on public.moderation to authenticated;
drop policy if exists "moderation readable" on public.moderation;
create policy "moderation readable" on public.moderation for select to anon, authenticated using (true);
drop policy if exists "moderation admin write" on public.moderation;
create policy "moderation admin write" on public.moderation for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create or replace function public.is_listed(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.moderation m where m.user_id = uid and m.approved and not m.hidden);
$$;
revoke all on function public.is_listed(uuid) from public;
grant execute on function public.is_listed(uuid) to anon, authenticated;

-- ---------- crew ----------
create table if not exists public.crew_profiles (
  user_id      uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  published    boolean not null default false,
  display_name text not null default '' check (length(display_name) <= 80),
  crew_types   text[] not null default '{}',          -- airplane_pilot, helicopter_pilot, cfi, flight_attendant, ferry_pilot, mechanic
  certificate  text not null default '' check (length(certificate) <= 80),   -- e.g. "ATP", "Commercial, CFII"
  headline     text not null default '' check (length(headline) <= 120),     -- e.g. "Contract captain"
  home_base    text not null default '' check (length(home_base) <= 80),     -- e.g. "Van Nuys (VNY)"
  travel       text not null default '' check (length(travel) <= 120),
  experience   text not null default '' check (length(experience) <= 200),  -- Part 91 / 135 / EMS / tour...
  bio          text not null default '' check (length(bio) <= 2000),
  total_time   integer check (total_time between 0 and 100000),
  availability text not null default '' check (length(availability) <= 200),
  updated_at   timestamptz not null default now()
);
create table if not exists public.crew_aircraft (
  user_id     uuid not null default auth.uid() references public.crew_profiles (user_id) on delete cascade,
  acft_seq    integer not null check (acft_seq >= 0),     -- the builder's permanent aircraft number
  type_rated  boolean not null default false,
  hours       integer check (hours between 0 and 50000),
  primary key (user_id, acft_seq)
);

-- ---------- operators ----------
create table if not exists public.operator_profiles (
  user_id      uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  published    boolean not null default false,
  name         text not null default '' check (length(name) <= 120),   -- company, or "Private owner"
  kind         text not null default 'owner' check (kind in ('owner', 'charter', 'management', 'flight_department')),
  home_base    text not null default '' check (length(home_base) <= 80),
  open_to_contract boolean not null default true,
  about        text not null default '' check (length(about) <= 2000),
  updated_at   timestamptz not null default now()
);
create table if not exists public.operator_aircraft (
  user_id   uuid not null default auth.uid() references public.operator_profiles (user_id) on delete cascade,
  acft_seq  integer not null check (acft_seq >= 0),
  how_many  integer not null default 1 check (how_many between 1 and 500),
  primary key (user_id, acft_seq)
);

-- ---------- row level security for profiles ----------
alter table public.crew_profiles     enable row level security;
alter table public.crew_aircraft     enable row level security;
alter table public.operator_profiles enable row level security;
alter table public.operator_aircraft enable row level security;
revoke all on public.crew_profiles, public.crew_aircraft, public.operator_profiles, public.operator_aircraft from anon, authenticated;
grant select on public.crew_profiles, public.crew_aircraft, public.operator_profiles, public.operator_aircraft to anon, authenticated;
grant insert, update, delete on public.crew_profiles, public.crew_aircraft, public.operator_profiles, public.operator_aircraft to authenticated;

drop policy if exists "crew read" on public.crew_profiles;
create policy "crew read" on public.crew_profiles for select to anon, authenticated
  using ((published and public.is_listed(user_id)) or user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "crew own write" on public.crew_profiles;
create policy "crew own write" on public.crew_profiles for all to authenticated
  using (user_id = (select auth.uid()) and (select public.mfa_ok()))
  with check (user_id = (select auth.uid()) and (select public.mfa_ok()));

drop policy if exists "crew aircraft read" on public.crew_aircraft;
create policy "crew aircraft read" on public.crew_aircraft for select to anon, authenticated
  using (exists (select 1 from public.crew_profiles p where p.user_id = crew_aircraft.user_id));
drop policy if exists "crew aircraft own write" on public.crew_aircraft;
create policy "crew aircraft own write" on public.crew_aircraft for all to authenticated
  using (user_id = (select auth.uid()) and (select public.mfa_ok()))
  with check (user_id = (select auth.uid()) and (select public.mfa_ok()));

drop policy if exists "operator read" on public.operator_profiles;
create policy "operator read" on public.operator_profiles for select to anon, authenticated
  using ((published and public.is_listed(user_id)) or user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "operator own write" on public.operator_profiles;
create policy "operator own write" on public.operator_profiles for all to authenticated
  using (user_id = (select auth.uid()) and (select public.mfa_ok()))
  with check (user_id = (select auth.uid()) and (select public.mfa_ok()));

drop policy if exists "operator aircraft read" on public.operator_aircraft;
create policy "operator aircraft read" on public.operator_aircraft for select to anon, authenticated
  using (exists (select 1 from public.operator_profiles p where p.user_id = operator_aircraft.user_id));
drop policy if exists "operator aircraft own write" on public.operator_aircraft;
create policy "operator aircraft own write" on public.operator_aircraft for all to authenticated
  using (user_id = (select auth.uid()) and (select public.mfa_ok()))
  with check (user_id = (select auth.uid()) and (select public.mfa_ok()));

-- keep updated_at current
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$ begin new.updated_at := now(); return new; end $$;
drop trigger if exists crew_touch on public.crew_profiles;
create trigger crew_touch before update on public.crew_profiles for each row execute function public.touch_updated_at();
drop trigger if exists operator_touch on public.operator_profiles;
create trigger operator_touch before update on public.operator_profiles for each row execute function public.touch_updated_at();
drop trigger if exists moderation_touch on public.moderation;
create trigger moderation_touch before update on public.moderation for each row execute function public.touch_updated_at();

-- ---------- public counts per aircraft (respect the read rules above) ----------
create or replace view public.aircraft_crew_counts with (security_invoker = on) as
  select a.acft_seq, count(*)::int as crew
  from public.crew_aircraft a join public.crew_profiles p on p.user_id = a.user_id
  where p.published and public.is_listed(p.user_id)
  group by a.acft_seq;
create or replace view public.aircraft_operator_counts with (security_invoker = on) as
  select a.acft_seq, count(*)::int as operators
  from public.operator_aircraft a join public.operator_profiles p on p.user_id = a.user_id
  where p.published and public.is_listed(p.user_id)
  group by a.acft_seq;
grant select on public.aircraft_crew_counts, public.aircraft_operator_counts to anon, authenticated;

-- ---------- "Get notified" list ----------
create table if not exists public.notify_signups (
  id         bigint generated always as identity primary key,
  email      text not null check (length(email) <= 254 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  role       text not null default '' check (length(role) <= 40),
  created_at timestamptz not null default now()
);
alter table public.notify_signups enable row level security;
revoke all on public.notify_signups from anon, authenticated;
grant insert (email, role) on public.notify_signups to anon, authenticated;
grant select, delete on public.notify_signups to authenticated;
drop policy if exists "anyone can sign up" on public.notify_signups;
create policy "anyone can sign up" on public.notify_signups for insert to anon, authenticated with check (true);
drop policy if exists "admins read list" on public.notify_signups;
create policy "admins read list" on public.notify_signups for select to authenticated using ((select public.is_admin()));
drop policy if exists "admins tidy list" on public.notify_signups;
create policy "admins tidy list" on public.notify_signups for delete to authenticated using ((select public.is_admin()));

-- ---------- make James and Steve admins ----------
-- Each person must have signed in to the site once first. Put the real addresses in, then run.
insert into public.admins (user_id)
select id from auth.users where lower(email) in (lower('JAMES_EMAIL_HERE'), lower('STEVE_EMAIL_HERE'))
on conflict do nothing;

-- Self-check: every table should show rls_on = true
select relname as table_name, relrowsecurity as rls_on from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r'
  and relname in ('admins','moderation','crew_profiles','crew_aircraft','operator_profiles','operator_aircraft','notify_signups')
order by 1;
