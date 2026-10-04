-- Cali Aircrew — "Current" checkbox per aircraft on crew profiles. Run once in the SQL Editor (safe to re-run).
-- Version 005 · 2026-10-03
alter table public.crew_aircraft add column if not exists is_current boolean not null default false;
select column_name, data_type from information_schema.columns where table_schema = 'public' and table_name = 'crew_aircraft' order by ordinal_position;
