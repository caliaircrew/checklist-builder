\set ON_ERROR_STOP 1
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
set role authenticated;
select 'with checklists table: ' || (public.admin_metrics()->>'checklist_sync');
reset role;
drop table public.my_items; drop table public.checklists cascade;
\i /tmp/ghrepo/supabase/008_metrics_fix.sql
set role authenticated;
select 'without checklists table: sync=' || (public.admin_metrics()->>'checklist_sync') || ' total=' || (public.admin_metrics()->>'checklists_total');
