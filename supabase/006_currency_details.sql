-- Cali Aircrew — currency details per aircraft: "current through" month and training school. Run once (safe to re-run).
-- Version 006 · 2026-10-03 · includes 005 (is_current), so running 006 alone is enough.
alter table public.crew_aircraft add column if not exists is_current boolean not null default false;
alter table public.crew_aircraft add column if not exists current_until date;
alter table public.crew_aircraft add column if not exists training_school text not null default '';
alter table public.crew_aircraft add column if not exists training_other text not null default '';
alter table public.crew_aircraft drop constraint if exists crew_aircraft_training_check;
alter table public.crew_aircraft add constraint crew_aircraft_training_check
  check (length(training_school) <= 40 and length(training_other) <= 60);
select column_name, data_type from information_schema.columns where table_schema = 'public' and table_name = 'crew_aircraft' order by ordinal_position;
