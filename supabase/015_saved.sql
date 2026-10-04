-- =============================================================================
-- Cali Aircrew — favorites and saved searches (with email alerts). Run once in the SQL Editor (safe to re-run).
-- Version 015 · 2026-10-03 · needs 002 and 013.
--   favorites        crew a member saved (private to that member)
--   saved_searches   a member's saved Find crew searches; "alerts" emails new matches daily (the reminders job)
--                    seen = crew already shown or emailed for this search, so each new pilot is announced once
-- =============================================================================
create table if not exists public.favorites (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  crew_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, crew_id)
);
alter table public.favorites enable row level security;
revoke all on public.favorites from anon, authenticated;
grant select, insert, delete on public.favorites to authenticated;
drop policy if exists "own favorites" on public.favorites;
create policy "own favorites" on public.favorites for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table if not exists public.saved_searches (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (length(name) between 1 and 80),
  filters    jsonb not null default '{}'::jsonb check (jsonb_typeof(filters) = 'object' and pg_column_size(filters) < 4096),
  alerts     boolean not null default true,
  seen       uuid[] not null default '{}',
  last_alert timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists saved_searches_user on public.saved_searches (user_id);
alter table public.saved_searches enable row level security;
revoke all on public.saved_searches from anon, authenticated;
grant select, insert, update, delete on public.saved_searches to authenticated;
drop policy if exists "own saved searches" on public.saved_searches;
create policy "own saved searches" on public.saved_searches for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- at most 10 saved searches per member
create or replace function public.saved_searches_limit() returns trigger language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.saved_searches where user_id = new.user_id) >= 10 then
    raise exception 'You can save up to 10 searches. Delete one first.';
  end if;
  return new;
end $$;
drop trigger if exists saved_searches_limit on public.saved_searches;
create trigger saved_searches_limit before insert on public.saved_searches for each row execute function public.saved_searches_limit();

-- the daily job (service key) needs each alerting search's owner email
create or replace function public.search_alert_owners() returns table (id bigint, email text)
language sql stable security definer set search_path = '' as $$
  select s.id, u.email::text from public.saved_searches s join auth.users u on u.id = s.user_id
  where s.alerts and u.email is not null;
$$;
revoke all on function public.search_alert_owners() from public, anon, authenticated;
grant execute on function public.search_alert_owners() to service_role;

select relname as table_name, relrowsecurity as rls_on from pg_class
where relnamespace = 'public'::regnamespace and relname in ('favorites', 'saved_searches') order by 1;
