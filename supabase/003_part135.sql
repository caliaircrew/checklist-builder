-- Cali Aircrew — Part 135 currency per aircraft. Run once in the SQL Editor (safe to re-run).
-- Version 003 · 2026-10-03
alter table public.crew_aircraft add column if not exists part135 text not null default '';
alter table public.crew_aircraft drop constraint if exists crew_aircraft_part135_check;
alter table public.crew_aircraft add constraint crew_aircraft_part135_check check (part135 in ('', 'SIC', 'PIC'));
select column_name, data_type from information_schema.columns where table_schema = 'public' and table_name = 'crew_aircraft' order by ordinal_position;
