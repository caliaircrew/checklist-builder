# Cali Aircrew roadmap

Tick items as they are done (edit this file, or ask Claude to). Order = planned order of work.

## A. Housekeeping
- [x] 3a. Run supabase/004_profile_choices.sql (includes 003) in the Supabase SQL Editor — actually applied 2026-10-03 21:11 (earlier it had not run: details/part135 were missing in production, so tap-to-choose profile answers could not be saved before this)
- [x] 3e. Run supabase/009_operators.sql
- [x] 3f. Run supabase/010_crew_private.sql
- [x] 3g. Run supabase/011_account.sql
- [x] 3i. Run supabase/013_reminders.sql (2026-10-03)
- [ ] 3j. Reminders setup (docs/REMINDERS_SETUP.md): deploy reminders function, REMINDER_KEY secret, vault secret, run 014
- [ ] 3k. Run the "missing objects" audit query after every database update (expect no rows)
- [x] 3h. Recovery setup (docs/RECOVERY_SETUP.md): Resend account + GoDaddy DNS, run 012, deploy the recovery Edge Function, set 3 secrets (Account page: recovery contacts, help requests, delete my account) (private FAA-verification details) (operator profiles)
- [x] 3d. supabase/008_metrics_fix.sql and supabase/001_checklists.sql applied 2026-10-03 (checklist sync tables were missing in production until now)
- [x] 3c. Run supabase/007_admin.sql (admin page, review of free text, search metrics, banner, partners, requests)
- [x] 3b. Run supabase/006_currency_details.sql (includes 005: Current checkbox, current-through month, training school)
- [x] 1. Supabase URL Configuration: Site URL `https://caliaircrew.com/checklists/`; Redirect URLs include `https://caliaircrew.com/**` (keep the github.io entries)
- [x] 2. GitHub Pages: Enforce HTTPS on once the certificate is issued
- [x] 3. Delete Steve's old "Supabase checklist" Gmail app password (James's account is the sender now)
- [ ] 4. Delete the temporary GitHub fine-grained token after the session (expires ~2026-10-10)

## B. Checklist builder
- [x] 5. Helicopters: [x] 47 types + helicopter category (v1.24); [x] 11 helicopter pick lists and helicopter defaults in the checklist builder
- [x] 6. SFAR 73 (Robinson R22/R44) endorsements S73.1–S73.9 added as drafts from SFAR No. 73 as amended 2024 (v1.40); [ ] a helicopter CFI compares wording with current AC 61-65 / FAA guidance and marks them faa
- [x] 7. Offline install (PWA) (v1.43): home-screen icon, works without signal
- [x] 7b. Checklist builder theme matches the rest of the site: clear-sky palette, white top bar with Cali Aircrew logo and the same menu (Checklists, Crew, Partners, Sign in), Barlow Condensed + Source Sans 3, sky-blue main buttons, 8 px spacing, phone bottom tab bar (printed card keeps its black-and-white print style)
- [x] 7a. Fly mode (v1.43) (iPad landscape): one section at a time, large type, tap to check each line, swipe to next section, Reset; optional night mode (dim red on black); "verify against AFM/POH" note

## C. Website
- [x] 8. Partners page (small): insurance, sim training, flight schools; labeled sponsored; "Become a partner" contact
- [ ] 9. Terms of Use + Privacy Policy: [x] drafts v0.1 published as drafts (v1.39) · [ ] fill [brackets] (entity, address, county, retention) · [ ] California attorney review · [ ] set effective date
- [ ] 9a. FAQ page and Help / Contact page; social links in the footer
- [ ] 9b. Testimonials section on the homepage (once James's network is using it; real quotes with permission only)
- [ ] 10. Contact address (caliaircrew@gmail.com or @caliaircrew.com mailbox); move sign-in email sender to it

## D. Crew directory — Phase 1 (private beta)
- [x] 11. Supabase tables + RLS for profiles (public only when published)
- [x] 12. Crew types: airplane pilot, helicopter pilot, CFI/CFII/CFI-H, corporate flight attendant, ferry/delivery pilot, mechanic (A&P/IA)
- [x] 13. Profile editor (build → publish/unpublish) and public profile page
- [x] 14. Find crew search (crew type, aircraft type, area); Find a CFI view
- [x] 14c. Quick links under the Find crew search: Contract pilots · Available now · Part 135 current · CFIs near me · Helicopter pilots
- [x] 14a. Browse by aircraft: categories → model tiles with crew counts (only types with published crew); aircraft pages with crew current on the type, "Build a checklist", "I fly this aircraft", training partners; same tiles in the profile editor
- [x] 14b. Operator profiles moved into Phase 1: owner/charter operator, home base, aircraft operated, "Open to contract crew" switch; aircraft pages get a second tab "Operators flying this aircraft" so pilots can browse by the aircraft they fly (directory, not job posts)
- [x] 14d. Recommended crew for operators: an operator profile's aircraft + base automatically shows matching crew (type, region, available now, Part 135)
- [x] 15. Admin page (caliaircrew.com/admin, admins only; database functions gated by is_admin(), no secret keys in the browser):
  - [x] 15a. Dashboard: users, profiles by status (draft / waiting / listed / hidden), operators, Get-notified sign-ups, new this week
  - [x] 15b. Review queue: approve, hide, mark FAA verified (with FAA registry link), notes; re-review when a listed profile's free text changes
  - [x] 15c. User management: search users by email, last sign-in, view profile, hide/unhide, make or remove admin, delete account (with confirmation)
  - [x] 15d. Sign-in help: no passwords exist (email codes); "lost phone" reset removes a user's Microsoft Authenticator so they can sign in with an email code and set it up again
  - [x] 15h. Extras in v1.30: quality flags, FAA registry shortcut, bulk approve, zero-result searches and owner metrics, announcement banner, partner listings, aircraft requests, CCPA privacy request log, plan-limit meters, JSON backup
  - [ ] 15i. Later: two admin levels (reviewer vs owner)
  - [ ] 15d2. Locked out of email: admin moves the account to a new sign-in email ONLY after identity is confirmed outside email (phone call, known contact, name + FAA certificate matched on the FAA registry); logged in the audit log
  - [x] 15e. Get-notified list: view, export CSV, remove
  - [ ] 15f. Reports from users ("report this profile") — audit log of admin actions [x] done (v1.30)
  - [x] 15g. Database update 005 (admin functions: list users, remove authenticator, delete user, audit log)
- [ ] 16. Homepage update; invite James's network
- [x] 16a. Account settings for users: change my sign-in email (confirmed from the new inbox), turn Microsoft Authenticator on/off, download my data, delete my account (v1.36)
- [ ] 16b. Several ways in, one account (Supabase identity linking), shown on Account → Ways to sign in:
  - [ ] Email code (always; the fallback)
  - [ ] Continue with Google (free; Google Cloud OAuth client + Supabase provider, ~15 min setup)
  - [ ] Face ID / Touch ID passkeys (when Supabase passkeys leave beta)
  - [ ] Continue with Apple (needs Apple Developer account, $99/yr)
  - [ ] Microsoft Authenticator as optional two-step (already built)
  - [x] Recovery email (Google style, self-service; live 2026-10-03: backup-email confirmation verified end to end): user adds and confirms a backup email on Account. Sign-in screen: "Locked out? Send a recovery link to my backup email" → one-time link (short expiry, rate-limited) lets them set a new main sign-in email. If Microsoft Authenticator is on, the recovery still asks for its code. The old address gets a "your sign-in email changed" notice. Needs a Supabase Edge Function (server-side, holds the service key; never in the browser)
  - [x] If all else fails: "Still locked out? Ask Cali Aircrew" form → appears in the admin page's help queue and emails James; he confirms identity outside email (15d2) before moving the account
  - [ ] Recovery phone number (optional) used only by an admin to confirm identity; no SMS codes ($75/mo add-on, weaker)

## D2. Profile upgrade (James's requests, 2026-10-03) — build next, in this order
- [x] 34. Richer crew profile page (v1.41) (what an operator sees after tapping a pilot):
  - [x] Location: home airport with its city and state (e.g. "KCCR · Concord, CA"), region, travel range
  - [x] Aircraft split into "Flying now" and "Previously flown", each with hours, type rating, currency and Part 135 seat; total time, PIC, turbine and helicopter time at the top
  - [x] Contract day rate (v1.41: shown to everyone when listed, or "Ask me"; members-only visibility later): amount per day (USD) with "+ expenses" / "negotiable" options; pilot chooses who sees it (everyone, or signed-in operators only); operators can filter "day rate up to $X"; feeds the anonymous day-rate survey (24a)
- [x] 35. Role-specific profile questions (v1.41; James approved the draft lists 2026-10-03) (James reviews the draft lists first):
  - [x] 35a. Flight attendant: corporate FA training and recurrent (provider + current-through month), CPR/AED/first aid, food safety, international and catering skills, cabins worked, passport
  - [x] 35b. Mechanic: A&P / IA / repairman / avionics, factory training by aircraft and engine, specialties, inspection programs, AOG road trips, Part 135 / 145 experience
  - [x] 35c. Helicopter pilot: turbine vs piston time, NVG, long line / external load, EMS, tours, firefighting, mountain and offshore, SFAR 73 (R22/R44) endorsements
  - [x] Each crew type sees only its own questions · [x] Find crew filters adapt to the crew type chosen (v1.42)

## E. Crew directory — Phase 2
- [ ] 17. One-tap résumé PDF from the profile
- [ ] 18. Messaging between operators and crew (pilots choose when to share phone/email); later "Notify me" when a new operator of an aircraft type joins
- [ ] 19. Availability calendar (dates, home base, travel radius)
- [ ] 20. Verification badges (FAA airmen database match; sim training checked by James)
  - [x] 20a. Private legal name + FAA address city/state on crew profiles, shown in admin review; FAA button copies the legal last name (v1.32)
  - [ ] 20b. Monthly import of the FAA Airmen Certification Releasable Database (GitHub Action), storing only what matching needs; automatic "Likely FAA match: certificate level, ratings, type ratings, city/state" or "No FAA match found" in admin review. Admin always confirms; withheld addresses and common names handled as suggestions, never auto-approval
- [ ] 21. Currency & expiration tracker: [x] "current" badge (v1.28/1.29) · [x] email reminders for aircraft currency, FA recurrent, CPR (v1.44) · [ ] setup: 013 + reminders function + REMINDER_KEY + vault + 014 (docs/REMINDERS_SETUP.md) · [ ] FAA medical and flight review dates · [ ] owner aircraft inspections due

## F. Business & launch
- [ ] 22. LLC / insurance decision; attorney sign-off on terms. Cali Aircrew is currently a DBA of James Bailey; James decided (2026-10-03) to form an LLC. Then: update Terms/Privacy to name the LLC, refile the fictitious business name under the LLC if keeping "Cali Aircrew" as a DBA, business bank account, insurance (general + professional/tech E&O), and Stripe/partners under the LLC
- [ ] 23. Pricing + Stripe; paid partner listings
- [ ] 24. Public launch

## G. Content (ongoing)
- [ ] 24a. Contract day-rate survey: anonymous "day rate on your type, by region" form; publish aggregated West Coast results (minimum sample size before showing a number)
- [ ] 24b. Crew Lounge-style blog (later): checklist tips, currency reminders, West Coast ops notes
- [ ] 25. Type-qualified pilot review of the 6 draft model checklists; rebuild Citation XLS without the Jet Linx card
- [ ] 26. Endorsements: fill 59 blank texts, verify 27 drafts against AC 61-65K
- [ ] 27. Set `show_drafts: false` before public launch

## H. AI on the site (requirements gathering; structured data first)
Why the profile is mostly checkboxes and dropdowns: normalized values (role, certificate, ratings, region, availability, experience, per-aircraft hours / currency / school / Part 135) let AI analyze and match reliably; free text is kept small and reviewed.
- [ ] 28. Admin "Ask the data": plain-English questions answered from the directory ("How many Part 135 PIC-current Citation pilots in Southern California are available this month?"), via a server-side function using read-only views and aggregate data only (no private fields to the model)
- [ ] 29. Market insights for James: supply vs. demand by aircraft and region (zero-result searches, recruiting targets), trends over time, weekly summary email
- [ ] 30. Smarter recommended crew for operators: ranking explained in plain words ("current on your XLS, 135 PIC, based in SoCal, available now")
- [ ] 31. Profile helper for pilots: suggestions to complete or strengthen a profile; flags inconsistencies (hours on type > total time, expired currency)
- [ ] 32. Moderation assist: pre-screen free text (contact details, inappropriate content) before James reviews; never auto-approve
- [ ] 33. Checklist builder assist: suggest checklist items for an aircraft from its POH-style data, always marked as suggestions to verify against the AFM/POH
- Guardrails: privacy first (no legal names, recovery contacts or emails sent to the model), admins confirm AI suggestions, every AI feature labeled as such, costs capped

## Design
- Look and feel: "clear sky" palette (sky ink #234A6E, sky blue #2470B3 for the main action, cloud #E4EEF8, page #F4F8FC, white cards, sage for verified/current), Barlow Condensed + Source Sans 3, white top bar on computers, bottom tab bar on phones. Design canvas: https://claude.ai/artifact/Aq6Toqrz36YdWrZXiHgfjz
- Layout rules: spacing on an 8 px scale (8/16/24/32/48/64); repeated items (steps, cards, tiles) in equal-width grids so icons, circles and headings line up regardless of text length; one main (sky-blue) action per screen.
- Homepage headline: "Find the right pilot for every aircraft, / and the right tool for the job."
- [x] Clear-sky look and new headline on the live homepage (v1.20); checklist builder: see item 7b
- iPad rule: portrait shows one thing at a time; landscape shows a list on the left and details on the right (rotating never changes how anything works):
  - Find crew: results left, selected profile right
  - Browse by aircraft: categories left, tiles / aircraft page right
  - My profile editor: form left, live public-profile preview right
  - Messages: conversations left, open conversation right
  - Crew profile: details beside the availability calendar
  - CFI endorsements and résumé: form beside the finished version
  - Checklist builder: editor + print preview (done), plus Fly mode (item 7a)

### Screens on the design canvas
- [x] Style guide · Homepage · Find crew · Browse by aircraft · Aircraft page (Citation XLS) · Crew profile (phone) · Checklist builder (phone)
- [ ] Find crew, iPad landscape (results + profile side by side)
- [ ] Fly mode (iPad landscape, day and night)
- [ ] My profile editor (with live preview; "I fly this aircraft" tiles)
- [ ] Operator profile + aircraft page "Operators flying this aircraft" tab
- [ ] Sign in and Account (two-step sign-in, currency and expiration tracker)
- [ ] Messages
- [ ] Availability calendar
- [ ] One-tap résumé (PDF)
- [ ] Partners page
- [ ] Admin review
- [ ] Terms and Privacy
- Find a CFI = a preset view of Find crew (no separate design)

## Guardrails (from earlier decisions)
- Competitive note (BizJetJobs, reviewed 2026-10-03): established national job board + recruiting. Our position: free West Coast directory with per-aircraft detail (hours, type rating, Part 135 SIC/PIC, available now), helicopters, and free pilot tools; no job board. Borrow ideas, never copy their content or design.
- No aircraft-for-sale or charter listings (different business; charter-broker risk). Operator profiles ("aircraft that need crew") are Phase 2.
- Directory, not a broker: never arrange or sell flights; no trip/job posting board for now.
- Profiles are advertisements; members verify each other. Show badges, never store or display ID/medical documents publicly.
- Text-message two-step sign-in costs money (~$75/mo Supabase add-on + per-text fees): stay with Microsoft Authenticator.
