# Local test setup (rebuild in a fresh Claude sandbox)

Mimics Supabase locally so SQL updates and the crew/admin/builder pages can be tested before publishing.
Nothing here touches production. The only password is the throwaway local Postgres one (`pg`).

## 1. Database (PostgreSQL 16)
```bash
apt-get install -y postgresql-16 && pg_ctlcluster 16 main start      # restart after idle: pg_ctlcluster 16 main start
su postgres -c "psql -c \"alter user postgres password 'pg'\"" && su postgres -c "createdb sb"
su postgres -c "psql -d sb -f tools/testing/sql/sb_stub.sql"          # auth schema, auth.uid()/auth.jwt(), roles anon/authenticated/service_role
for f in supabase/0*.sql; do                                          # apply updates in order; local has no pg_cron/pg_net/vault:
  sed '/^select cron/,$d;/^create extension if not exists pg_cron/d;/^create extension if not exists pg_net/d' "$f" > /tmp/x.sql
  su postgres -c "psql -q -v ON_ERROR_STOP=1 -d sb -f /tmp/x.sql" || echo "FAILED $f"; done
su postgres -c "psql -q -d sb -c 'grant usage on schema public to service_role; grant all on all tables in schema public to service_role;'"
su postgres -c "psql -d sb -f tools/testing/sql/seed.sql" && su postgres -c "psql -d sb -f tools/testing/sql/seed2.sql"   # test users
```
Test users: James `...0a` (admin), Charlie `...0c`, Dana `...0d` (ids `00000000-0000-0000-0000-0000000000XX`).
Permission tests: `sql/t0NN.sql` (run with `psql -d sb -f`), they switch role with
`select set_config('request.jwt.claim.sub','<uuid>',false); set role authenticated;`.

## 2. Browser tests (Playwright + bridge.py)
`pip install playwright psycopg2-binary --break-system-packages && playwright install chromium`
- `python build.py --out /tmp/bNNN` then serve over HTTP (file:// blocks fetch of airports.json):
  `(cd /tmp/bNNN && python3 -m http.server 8NNN &)` — restart it inside each command; background jobs die.
- `bridge.make_test_page(src, dst)` writes a copy of a page whose Supabase client is replaced by a mock that
  calls `op()` (exposed as `__db`), which runs each request in a transaction as the right role/user.
  Sign in by writing localStorage `acb-auth` = `{user:{id,email},aal:'aal1'}` then reload.
  `functions.invoke` is routed to `window.__fn` (expose a Python stand-in) — absent = "not set up".
- Gotchas: hash-only navigation doesn't reload (filters/directory cache persist → go via about:blank);
  builder top-level `let` vars aren't reachable from page.evaluate (assert on the DOM); accept confirm()
  dialogs; grant clipboard permissions; uuid[] columns need the `::uuid[]` cast the bridge applies to `seen`.
- `browser/` has examples (account, recovery UI, profile editor, builder defaults/menu/my items). Update the
  `/tmp/bNNN` paths before running. `t114` is obsolete.

## 3. Edge Functions (Deno)
- Download Deno from GitHub releases (jsr.io is blocked in the sandbox; functions use `npm:` imports).
- `deno check supabase/functions/<name>/index.ts`.
- Unit tests: copy the file up to `Deno.serve(`, drop the createClient import, export the functions, and
  call them with a stand-in `admin` object (`rpc`, `from().select().eq().in().maybeSingle().update()`) and a
  stubbed `globalThis.fetch` (Resend, /crew/*.json). See the old chat's examples in docs/HANDOVER.md §7.
