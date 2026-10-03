-- =============================================================================
-- checklist-builder — Supabase database setup (run once in the SQL Editor)
-- Version 001 · 2026-10-03
--
-- What this creates
--   public.checklists   one row per saved checklist, per user
--   public.my_items     one row per user: their personal ★ My items
--
-- Privacy rules (Row Level Security)
--   * A signed-in user can read and change ONLY their own rows.
--   * Anyone not signed in can read and change nothing.
--   * If a user has turned on two-step sign-in (Microsoft Authenticator),
--     their rows are only reachable after they pass that second step (aal2).
--
-- Safe to run more than once (uses IF NOT EXISTS / DROP POLICY IF EXISTS).
-- =============================================================================

create table if not exists public.checklists (
  user_id     uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id          text        not null,                 -- the app's own checklist id
  name        text        not null default '',
  acft        text        not null default '',
  data        jsonb       not null,                 -- the whole checklist
  updated     bigint      not null,                 -- device time of last edit (ms); newest wins
  deleted     boolean     not null default false,   -- tombstone so deletes reach every device
  server_time timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.my_items (
  user_id     uuid        primary key default auth.uid() references auth.users (id) on delete cascade,
  data        jsonb       not null default '{}'::jsonb,
  updated     bigint      not null,
  server_time timestamptz not null default now()
);

-- Size guard: a single checklist over 1 MB is almost certainly a mistake.
alter table public.checklists drop constraint if exists checklists_data_size;
alter table public.checklists add  constraint checklists_data_size check (pg_column_size(data) < 1048576);

-- Keep server_time current on every update.
create or replace function public.touch_server_time() returns trigger
language plpgsql set search_path = '' as $$
begin new.server_time := now(); return new; end $$;
drop trigger if exists checklists_touch on public.checklists;
create trigger checklists_touch before update on public.checklists for each row execute function public.touch_server_time();
drop trigger if exists my_items_touch on public.my_items;
create trigger my_items_touch before update on public.my_items for each row execute function public.touch_server_time();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.checklists enable row level security;
alter table public.my_items   enable row level security;

-- Only signed-in users get table privileges at all; anonymous visitors get none.
revoke all on public.checklists from anon;
revoke all on public.my_items   from anon;
grant select, insert, update, delete on public.checklists to authenticated;
grant select, insert, update, delete on public.my_items   to authenticated;

-- Owner-only access
drop policy if exists "own checklists" on public.checklists;
create policy "own checklists" on public.checklists
  for all to authenticated
  using      ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "own my_items" on public.my_items;
create policy "own my_items" on public.my_items
  for all to authenticated
  using      ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Two-step sign-in: users who enrolled an authenticator must be at aal2.
-- (Users without an authenticator are unaffected.)
drop policy if exists "mfa when enrolled" on public.checklists;
create policy "mfa when enrolled" on public.checklists
  as restrictive for all to authenticated
  using (
    array[(select auth.jwt() ->> 'aal')] <@ (
      select case when count(f.id) > 0 then array['aal2'] else array['aal1', 'aal2'] end
      from auth.mfa_factors f
      where f.user_id = (select auth.uid()) and f.status = 'verified'
    )
  );

drop policy if exists "mfa when enrolled" on public.my_items;
create policy "mfa when enrolled" on public.my_items
  as restrictive for all to authenticated
  using (
    array[(select auth.jwt() ->> 'aal')] <@ (
      select case when count(f.id) > 0 then array['aal2'] else array['aal1', 'aal2'] end
      from auth.mfa_factors f
      where f.user_id = (select auth.uid()) and f.status = 'verified'
    )
  );

-- Quick self-check (shows both tables with RLS on):
select relname as table_name, relrowsecurity as rls_on
from pg_class where relname in ('checklists', 'my_items') and relnamespace = 'public'::regnamespace;
