# Cali Aircrew — handover for a new Claude chat

Written 2026-10-03 (late evening, Pacific) at app version **1.49**. Read this whole file first, then
`docs/ROADMAP.md` (what's done / open) and `CHANGELOG.md` (what each version changed).
Secrets are NOT in this file or the repo; they live in Supabase (Edge Function secrets + Vault).

---

## 0. URGENT — where we stopped

1. **The `reminders` Edge Function in Supabase is still the v1.47 code.** The repo has v1.49
   (`supabase/functions/reminders/index.ts`, 265 lines, line 17 starts
   `// Admin alerts (POST {"mode": "admin"}, hourly)`, `Deno.serve` on line 234).
   The deployed one has `Deno.serve` at line 183 and no admin mode.
   - Effect right now: the hourly cron `cali-admin-alerts` sends `{"mode":"admin"}`, which the old code
     ignores, so it runs the *daily* currency + saved-search job every hour. Harmless (reminders are
     de-duplicated; saved-search matches are announced once) but **admin alerts don't work** and type-rating
     filters in saved-search alerts are ignored until v1.49 is deployed.
   - Verified test: `select status_code, content from net._http_response order by id desc limit 1;` after the
     test call — v1.49 replies contain `"admin":{"recipients":2,...}`.
2. **Why it's stuck:** Steve deploys by pasting code into Supabase → Edge Functions → reminders → Code on an
   iPad. The editor is Monaco (VS Code's editor): **no Select All on iPad** (long-press menu is Monaco's,
   command palette "select all" only finds *Expand Selection*; on-screen keyboard has no ⌘). Workarounds:
   (a) tap at the end of the code and **hold ⌫ until empty**, then paste; (b) run Expand Selection repeatedly
   until the whole file is highlighted; (c) a hardware keyboard: **⌘A** works.
3. **In progress: automatic deploy of Edge Functions from GitHub Actions** so pasting is never needed.
   Steve was creating a **scoped Supabase personal access token** (Supabase → avatar → Account preferences →
   Access Tokens → Generate token). The new UI: choose organization **caliaircrew** + project
   **ezfixcom-bit's Project**; "Permissions" has a **Preset** dropdown (it defaulted to *Full access* — do NOT
   use that) and per-item levels (None / Read / Read-write) grouped in sections (seen: *Project* section with
   Project Settings, Action Runs, Advisors, Analytics Config, Logs, Usage Analytics, SQL Snippets, … "9
   configured"). **Steve could not find an "Edge Functions" item.** Next step: help him find the item that
   covers deploying functions (look through every section; it may be named differently, e.g. under a
   compute/development section), set it to Read-write, Project Settings → Read, everything else None.
   If no scoped permission covers function deploys, options: a classic token (full account access — explain
   the risk), or keep manual pasting. Then: GitHub repo → Settings → Secrets and variables → Actions → new
   secret **`SUPABASE_ACCESS_TOKEN`**, and add a workflow step:
   `supabase functions deploy reminders --project-ref egpfdyvksqierfdkogwe --no-verify-jwt` (and `recovery`)
   using a **current Supabase CLI** (older CLIs reject the new `sbp_v0_…` token format), run when
   `supabase/functions/**` changes.
4. **Steve's screenshot limit** was reached in the old chat — ask for short text descriptions if needed.

---

## 1. People and how to work with them

- **Steve** (building partner; ezfixcom@gmail.com; also signed up as **steve@ezfix.com**, now an **admin**).
  Works on an **iPad** in Safari, sends screenshots, dictates. Prefers clear numbered steps, exact button
  names, what success looks like, and "send a screenshot" checkpoints. Data engineer by trade (SQL-literate).
- **James Bailey** — site owner, CFI, ~16,000 hrs, many Citation type ratings. james@caliaircrew.com is an
  **admin** (sign-in mail forwards to caliaircrew@gmail.com via GoDaddy). Microsoft Authenticator enrolled.
  Cali Aircrew is currently a **DBA of James Bailey**; James decided to form an **LLC**.
- James's standing request: **all profile answers should be dropdowns or checkboxes** (numbers for hours)
  so AI can analyze the data later. Only small free-text fields (bio, company name) and they're reviewed/
  filtered.
- Style: plain language, no jargon without explanation, keep replies scannable on an iPad.

## 2. Accounts, services, configuration (no secrets here)

| Thing | Value |
|---|---|
| Live site | https://caliaircrew.com (home), /checklists/ (builder), /crew/ (directory), /admin/, /partners/, /terms/, /privacy/ |
| GitHub | org **caliaircrew**, repo **checklist-builder**; GitHub Actions builds + deploys Pages on push to main |
| Supabase project | ref **egpfdyvksqierfdkogwe** ("ezfixcom-bit's Project", org caliaircrew, FREE plan), URL https://egpfdyvksqierfdkogwe.supabase.co |
| Publishable key (public) | `sb_publishable_tQh4omSsHDxsiwJjpG808Q_WOJ940Z-` (in data/app.yaml / build) |
| Auth | email one-time code (no passwords); optional Microsoft Authenticator (TOTP); Site URL https://caliaircrew.com/checklists/, redirects https://caliaircrew.com/** |
| Auth email (SMTP) | James's Gmail caliaircrew@gmail.com app password |
| Other email | **Resend** (domain caliaircrew.com verified via GoDaddy Domain Connect), sender `Cali Aircrew <no-reply@caliaircrew.com>` |
| Edge Function secrets (names) | `RESEND_API_KEY`, `MAIL_FROM`, `RECOVERY_PEPPER`, `REMINDER_KEY` (values only in Supabase) |
| Vault secret | `reminder_key` (same value as REMINDER_KEY; used by cron jobs) |
| Cron jobs (pg_cron + pg_net) | `cali-currency-reminders` `0 16 * * *` (9am PDT) → reminders `{}`; `cali-admin-alerts` `5 * * * *` → reminders `{"mode":"admin"}` |
| Edge Functions | `recovery` (deployed, working), `reminders` (deployed v1.47 — needs v1.49, see §0); both **Verify JWT OFF** |
| Admins | james@caliaircrew.com, steve@ezfix.com |
| DNS | GoDaddy (domain owner account) |

GitHub access for Claude: previously a temporary fine-grained token (expires ~2026-10-10, name
"claude-checklist-builder") — **Steve should delete it** and give the new chat a fresh one if Claude needs to
push (repo Contents read/write, Actions read). Never echo tokens in output.

## 3. Repository map

```
build.py                    build + validation (v2.11.0). `python build.py --out DIR` writes the site;
                            `--check` validates only. Also REGENERATES supabase/functions/reminders/index.ts
                            from src/functions/reminders.tpl.ts + src/match.js (commit the result).
data/app.yaml               app_version (1.49), changelog (top entry must equal app_version), supabase cfg
data/aircraft/*.yaml        670 aircraft (seq 0–669; 623–669 helicopters): id, seq, make, model, engine
                            (piston|turboprop|jet|turboshaft), twin, retractable, pressurized, category
data/sections/*.yaml        checklist pick lists; `category: airplane|helicopter|any`; tags piston/turbine/
                            jet/twin/retract/press; default_section; 101–111 = helicopter lists
data/models/                draft model checklists (6, need pilot review)
data/endorsements/ac-61-65k.yaml   CFI endorsements (status faa/draft/none; validity 90d/24cm/12cm/2cm/flight)
                            incl. SFAR 73 drafts S73.1–S73.9 (2024 amended rule)
data/type-ratings.yaml      FAA type rating designators → aircraft ids (115 designators, 243 aircraft;
                            source FAA Order 8900.1 Vol5 Ch2 Sec19 Fig 5-88, 09/14/2026)
data/airports-us.json       OurAirports (public domain): code → "City, ST|lat|lon"
src/app_template.html       checklist builder (single page; Fly mode; offline PWA)
src/crew.js + site/crew.html   /crew/ directory, profiles, operator profiles, account, saved
src/admin.js + site/admin.html  /admin/
src/match.js                SHARED Find-crew matching rules (inserted into crew.js and the reminders function)
src/functions/reminders.tpl.ts  template for the reminders Edge Function
site/home.html, site/pages/*.html (_shell + partners/terms/privacy), site/icons/ (PWA icons)
supabase/001…016_*.sql      database updates (see §4)
supabase/functions/recovery/index.ts, supabase/functions/reminders/index.ts (generated)
docs/ROADMAP.md, STRATEGY.md, CHANGE_MANAGEMENT.md, RECOVERY_SETUP.md, REMINDERS_SETUP.md, HANDOVER.md
CHANGELOG.md
```

Build outputs: /index.html, /checklists/ (+ sw.js, manifest.webmanifest, icons/), /crew/ (+ airports.json,
aircraft-names.json, aircraft-info.json, type-ratings.json), /admin/, /partners/, /terms/, /privacy/.

Build guards worth knowing: builder page must contain the aircraft search (`id="aQ"`), crew page must keep
the "not a broker" note, JS syntax checked with node, YAML validated (unknown ids/tags fail the build).

## 4. Database (all updates applied in production as of 2026-10-03)

001 checklists, my_items · 002 admins, moderation, crew_profiles, crew_aircraft, operator_profiles,
operator_aircraft, notify_signups (+views) · 003/004 details jsonb on crew_profiles + part135 on crew_aircraft
(**004 was only truly applied on 2026-10-03** — before that, tap-to-choose profile answers didn't save) ·
005/006 is_current, current_until, training_school, training_other · 007 admin tables/functions (admin_audit,
search_log, site_settings, partners, aircraft_requests, privacy_requests, crew_bio_pending, admin_* RPCs) ·
008 metrics fix · 009 operator details, op_approved/op_hidden, operator_about_pending · 010 crew_private
(legal name + FAA city/state) · 011 account_recovery, help_requests, delete_my_account() · 012 recovery_codes,
recovery_lookup() · 013 member_settings (currency_emails), reminder_log, reminder_candidates() · 014 cron
schedule (daily) · 015 favorites, saved_searches (seen uuid[], max 10), search_alert_owners() · 016
member_settings.admin_emails, admin_alert_state, admin_alert_recipients(), hourly cron · 017 contact_requests ·
018 checklist sync fix (two-step rule on checklists/my_items uses mfa_ok(); auth.mfa_factors is no longer readable) ·
019 profile photos (crew_profiles.photo, moderation.photo_ok, private bucket crew-photos, admin_photo/_queue).

All tables RLS-on. Audit query (expect "no rows") is in the old chat and docs/ROADMAP 3k — re-create it by
listing expected tables/columns and checking information_schema.

Profile data model: most profile answers live in `crew_profiles.details` (jsonb) — role, cert, ratings,
medical, region, airport, status, looking, travel, passport, experience, languages, areas, since, rate
(+rate_exp/rate_neg), ac_rate{seq}, ac_pic{seq}, ac_sic{seq}, past[seq] (previously flown), hrs_pic,
training[], tr_des{seq}, tr_sp{seq}, jobs[], initials, fa_* , mx_*, heli_ops, sfar73. Hours by engine type
(turbine/jet/turboprop/piston/multi/helicopter) are CALCULATED from per-aircraft hours, not typed.

**Queued for the next database update (020):** see "Next database update" at the top of docs/ROADMAP.md.

## 5. What's built (versions 1.19 → 1.49, highlights)

- Clear-sky design (sky ink #234A6E, sky blue #2470B3, cloud #E4EEF8, page #F4F8FC; Barlow Condensed +
  Source Sans 3), phone tab bar, iPad landscape list+detail.
- Checklist builder: 670 aircraft, pick lists, model checklists, generated defaults (airplane AND helicopter),
  CFI endorsements incl. SFAR 73, Word export, sync to account, **Fly mode** (one section at a time, tap to
  check, swipe, night mode, wake lock), **offline PWA** (Add to Home Screen).
- Crew directory: profiles (airport+city, day rate general and per aircraft, flying now / previously flown,
  PIC/SIC per aircraft, calculated hours, areas, flying since, work history, special training, FAA type
  ratings with single-pilot S, flight attendant / mechanic / helicopter sections), aircraft-context box on
  profiles, Find crew with many filters (aircraft, type, region, cert, availability, Part 135, contract, day
  rate, min total/PIC/turbine/on-type, special training, FAA type rating, near airport + nm, crew-type
  filters), Browse by aircraft, operator profiles + recommended crew, ☆ Save crew, saved searches with daily
  email alerts, ★ Saved page, Share profile, initials-only option, profile strength meter.
- Account: change email, Authenticator on/off, recovery contacts, self-service recovery via confirmed backup
  email (Resend + `recovery` function), download data, delete account, email reminder switch.
- Admin: dashboard, review queue (FAA registry helper, quality flags), users (make admin, lost-phone reset,
  delete), sign-ups, requests (help + partner inquiries), site banner, partners, audit log, backup,
  "Email me admin alerts" switch.
- Emails: daily currency reminders (aircraft current-through, FA recurrent, CPR — 60/30 days and lapsed),
  saved-search digests, hourly admin alerts (needs v1.49 deploy).
- Partners page, Terms + Privacy **drafts** (marked draft; DBA of James Bailey; city/county/retention still
  [bracketed]; attorney review pending).

## 6. Open items (see docs/ROADMAP.md for the full list)

Immediate: §0 (deploy reminders v1.49; finish auto-deploy token or choose a fallback).
Code next (agreed order): one-tap résumé PDF → messaging → availability calendar → automatic FAA airmen
database match (monthly import) → "report this
profile" → Google sign-in (Steve does ~15 min setup) → two admin levels → FAQ/Help page → Stripe/pricing +
featured profiles → day-rate survey → AI features (ask-the-data, market insights, explained matching,
profile helper, moderation pre-screen, checklist suggestions).
Non-code: James fills in his profile; LLC + insurance; Terms/Privacy brackets + California attorney; contact
address decision; invite James's network (private beta); pilot review of 6 draft model checklists; 59 blank
endorsement texts + verify drafts; helicopter CFI review of helicopter lists + SFAR 73 wording;
`show_drafts: false` before public launch.

## 7. How the old chat worked (so the new one can continue the same way)

- Cloned the repo to /tmp, edited files with small Python patch scripts that **assert each anchor matches
  exactly once** (the crew and operator editors share some identical lines — patch only the crew copy).
- Tested with a local PostgreSQL that mimics Supabase roles (anon/authenticated/service_role, auth.uid() via
  `request.jwt.claim.sub`) plus a Playwright "bridge" that routes the page's Supabase calls to that database;
  served builds over a local HTTP server (file:// blocks fetch of airports.json). Deno used to type-check and
  unit-test Edge Function logic with stand-in database/email objects. None of that persists — rebuild as needed.
- Every release: bump `data/app.yaml` app_version + changelog, add a CHANGELOG.md row, tick ROADMAP, commit
  with a descriptive message, push, wait ~85s, confirm the "Build and deploy" Action succeeded.
- Lessons: verify production schema after SQL updates (004 had silently not run); never reuse variable names
  in build.py output steps (1.39 overwrote the builder page — now guarded); quote YAML strings containing
  colons; jsr.io unreachable from the sandbox — use `npm:` imports in Deno; Supabase new API keys mean the
  function reads the server key from SUPABASE_SECRET_KEYS (JSON) with fallbacks.

## 8. Finding more detail

- This repo: docs/ROADMAP.md, CHANGELOG.md, docs/*_SETUP.md, data/*.yaml comments.
- Past chats (same Claude account, Search and reference chats on): search for "Cali Aircrew", "caliaircrew",
  "reminders function", "type ratings", "Fly mode", etc.
