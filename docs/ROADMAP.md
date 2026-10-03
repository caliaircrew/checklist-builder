# Cali Aircrew roadmap

Tick items as they are done (edit this file, or ask Claude to). Order = planned order of work.

## A. Housekeeping
- [ ] 1. Supabase URL Configuration: Site URL `https://caliaircrew.com/checklists/`; Redirect URLs include `https://caliaircrew.com/**` (keep the github.io entries)
- [ ] 2. GitHub Pages: Enforce HTTPS on once the certificate is issued
- [ ] 3. Delete Steve's old "Supabase checklist" Gmail app password (James's account is the sender now)
- [ ] 4. Delete the temporary GitHub fine-grained token after the session (expires ~2026-10-10)

## B. Checklist builder
- [ ] 5. Helicopters: ~40 types, helicopter category, ~10 helicopter pick lists, helicopter defaults (v1.20)
- [ ] 6. SFAR 73 (Robinson R22/R44) awareness-training endorsements, verified against the FAA text
- [ ] 7. Offline install (PWA): home-screen icon, works without signal

## C. Website
- [ ] 8. Partners page (small): insurance, sim training, flight schools; labeled sponsored; "Become a partner" contact
- [ ] 9. Terms of Use + Privacy Policy: Claude drafts, aviation attorney reviews
- [ ] 10. Contact address (caliaircrew@gmail.com or @caliaircrew.com mailbox); move sign-in email sender to it

## D. Crew directory — Phase 1 (private beta)
- [ ] 11. Supabase tables + RLS for profiles (public only when published)
- [ ] 12. Crew types: airplane pilot, helicopter pilot, CFI/CFII/CFI-H, corporate flight attendant, ferry/delivery pilot, mechanic (A&P/IA)
- [ ] 13. Profile editor (build → publish/unpublish) and public profile page
- [ ] 14. Find crew search (crew type, aircraft type, area); Find a CFI view
- [ ] 15. Admin review for James (approve, hide, handle reports)
- [ ] 16. Homepage update; invite James's network

## E. Crew directory — Phase 2
- [ ] 17. One-tap résumé PDF from the profile
- [ ] 18. Owner accounts + messaging (pilots choose when to share phone/email)
- [ ] 19. Availability calendar (dates, home base, travel radius)
- [ ] 20. Verification badges (FAA airmen database match; sim training checked by James)
- [ ] 21. Currency & expiration tracker with email reminders; "current" badge; owner aircraft inspections due

## F. Business & launch
- [ ] 22. LLC / insurance decision; attorney sign-off on terms
- [ ] 23. Pricing + Stripe; paid partner listings
- [ ] 24. Public launch

## G. Content (ongoing)
- [ ] 25. Type-qualified pilot review of the 6 draft model checklists; rebuild Citation XLS without the Jet Linx card
- [ ] 26. Endorsements: fill 59 blank texts, verify 27 drafts against AC 61-65K
- [ ] 27. Set `show_drafts: false` before public launch

## Guardrails (from earlier decisions)
- Directory, not a broker: never arrange or sell flights; no trip/job posting board for now.
- Profiles are advertisements; members verify each other. Show badges, never store or display ID/medical documents publicly.
- Text-message two-step sign-in costs money (~$75/mo Supabase add-on + per-text fees): stay with Microsoft Authenticator.
