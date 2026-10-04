-- =============================================================================
-- Cali Aircrew — currency reminder emails. Run once in the SQL Editor (safe to re-run).
-- Version 013 · 2026-10-03 · needs 002, 006, 007 and 011.
--
--   member_settings        a member's email choices (currency reminders on/off; on unless turned off)
--   reminder_log           what was sent, so each reminder goes out once (server only; admins can read)
--   reminder_candidates()  dates to watch: aircraft "current through", FA recurrent, CPR (server only)
-- The daily run is scheduled separately: supabase/014_reminder_schedule.sql (after the function is deployed).
-- =============================================================================
create table if not exists public.member_settings (
  user_id         uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  currency_emails boolean not null default true,
  updated_at      timestamptz not null default now()
);
alter table public.member_settings enable row level security;
revoke all on public.member_settings from anon, authenticated;
grant select, insert, update on public.member_settings to authenticated;
drop policy if exists "own or admin read settings" on public.member_settings;
create policy "own or admin read settings" on public.member_settings for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "own settings" on public.member_settings;
create policy "own settings" on public.member_settings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table if not exists public.reminder_log (
  id       bigint generated always as identity primary key,
  user_id  uuid not null references auth.users (id) on delete cascade,
  kind     text not null check (kind in ('aircraft', 'fa_recurrent', 'cpr')),
  ref      text not null default '',          -- aircraft seq for kind = aircraft
  through  text not null,                     -- YYYY-MM the reminder was about
  stage    text not null check (stage in ('60', '30', 'lapsed')),
  sent_at  timestamptz not null default now(),
  unique (user_id, kind, ref, through, stage)
);
alter table public.reminder_log enable row level security;
revoke all on public.reminder_log from anon, authenticated;
grant select on public.reminder_log to authenticated;
drop policy if exists "admins read reminder log" on public.reminder_log;
create policy "admins read reminder log" on public.reminder_log for select to authenticated using ((select public.is_admin()));

create or replace function public.reminder_candidates()
returns table (user_id uuid, email text, kind text, ref text, school text, through text)
language sql stable security definer set search_path = '' as $$
  with ok as (
    select u.id, u.email::text as email from auth.users u
    left join public.member_settings s on s.user_id = u.id
    where coalesce(s.currency_emails, true) and u.email is not null)
  select ok.id, ok.email, 'aircraft', a.acft_seq::text,
         case when a.training_school = 'other' then coalesce(a.training_other, '') else coalesce(a.training_school, '') end,
         to_char(a.current_until, 'YYYY-MM')
    from public.crew_aircraft a join ok on ok.id = a.user_id
   where a.is_current and a.current_until is not null
  union all
  select ok.id, ok.email, 'fa_recurrent', '', coalesce(p.details->>'fa_school', ''), p.details->>'fa_recurrent'
    from public.crew_profiles p join ok on ok.id = p.user_id
   where coalesce(p.details->>'fa_recurrent', '') ~ '^\d{4}-\d{2}$' and 'flight_attendant' = any (p.crew_types)
  union all
  select ok.id, ok.email, 'cpr', '', '', p.details->>'cpr_until'
    from public.crew_profiles p join ok on ok.id = p.user_id
   where coalesce(p.details->>'cpr_until', '') ~ '^\d{4}-\d{2}$';
$$;
revoke all on function public.reminder_candidates() from public, anon, authenticated;
grant execute on function public.reminder_candidates() to service_role;

select relname as table_name, relrowsecurity as rls_on from pg_class
where relnamespace = 'public'::regnamespace and relname in ('member_settings', 'reminder_log') order by 1;
