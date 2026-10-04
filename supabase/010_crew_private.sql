-- Cali Aircrew — private FAA-verification details on crew profiles. Run once in the SQL Editor (safe to re-run).
-- Version 010 · 2026-10-03 · needs 002 and 007.
-- Legal name and FAA address city/state, used only by admins to check the FAA airmen registry.
-- Visible to the crew member and admins only; never shown publicly; not part of the public profile.
create table if not exists public.crew_private (
  user_id     uuid primary key default auth.uid() references public.crew_profiles (user_id) on delete cascade,
  legal_first text not null default '' check (length(legal_first) <= 60),
  legal_last  text not null default '' check (length(legal_last) <= 60),
  faa_city    text not null default '' check (length(faa_city) <= 60),
  faa_state   text not null default '' check (length(faa_state) <= 2),
  updated_at  timestamptz not null default now()
);
alter table public.crew_private enable row level security;
revoke all on public.crew_private from anon, authenticated;
grant select, insert, update, delete on public.crew_private to authenticated;
drop policy if exists "own or admin read private" on public.crew_private;
create policy "own or admin read private" on public.crew_private for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "own private details" on public.crew_private;
create policy "own private details" on public.crew_private for all to authenticated
  using (user_id = (select auth.uid()) and (select public.mfa_ok()))
  with check (user_id = (select auth.uid()) and (select public.mfa_ok()));
drop trigger if exists crew_private_touch on public.crew_private;
create trigger crew_private_touch before update on public.crew_private for each row execute function public.touch_updated_at();
select relname as table_name, relrowsecurity as rls_on from pg_class where relnamespace = 'public'::regnamespace and relname = 'crew_private';
