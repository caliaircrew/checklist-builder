-- Cali Aircrew — structured profile choices (and Part 135 per aircraft). Run once in the SQL Editor (safe to re-run).
-- Version 004 · 2026-10-03 · includes everything in 003, so running 004 alone is enough.

-- Part 135 currency per aircraft (same as 003)
alter table public.crew_aircraft add column if not exists part135 text not null default '';
alter table public.crew_aircraft drop constraint if exists crew_aircraft_part135_check;
alter table public.crew_aircraft add constraint crew_aircraft_part135_check check (part135 in ('', 'SIC', 'PIC'));

-- Tap-to-choose profile details (role, certificate, ratings, medical, region, availability, travel,
-- passport, experience, languages) kept together so search can filter on them.
alter table public.crew_profiles add column if not exists details jsonb not null default '{}'::jsonb;
alter table public.crew_profiles drop constraint if exists crew_profiles_details_check;
alter table public.crew_profiles add constraint crew_profiles_details_check
  check (jsonb_typeof(details) = 'object' and pg_column_size(details) < 8192);
create index if not exists crew_profiles_details_gin on public.crew_profiles using gin (details);

select table_name, column_name, data_type from information_schema.columns
where table_schema = 'public' and ((table_name = 'crew_aircraft' and column_name = 'part135') or (table_name = 'crew_profiles' and column_name = 'details'));
