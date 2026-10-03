# Change management

## Versions
| What | Format | Bump when | Where |
|---|---|---|---|
| **App** | two decimals (1.06 → 1.07) | anything a user can see: items, aircraft, models, wording, layout, behavior | `data/app.yaml` → `app_version` + top `changelog` entry |
| **Build script** | MAJOR.MINOR.PATCH | `build.py` itself changes. MAJOR = data format or output breaks; MINOR = new capability; PATCH = fix, same output | `build.py` → `SCRIPT_VERSION` + history in its header |
| **Word library** | pinned version + SHA-256 | only on deliberate upgrade; change both together | `data/app.yaml` → `docx` |

The build refuses to run if the top changelog entry doesn't match `app_version`.

## Making a change
1. **Request** — open an Issue (or note it in the pull request): what is changing, why, who asked, and the source
   document (AFM/POH page, AC 61-65 page).
2. **Branch & edit** — change only the files involved.
3. **Version** — bump `app_version` and add the changelog entry.
4. **Pull request** — fill in the template checklist. The automatic build must pass.
5. **Review** — checklist *content* is reviewed by a qualified pilot on that type; endorsement wording against the AC.
   Code/layout changes are reviewed by the maintainer.
6. **Merge** — merging to `main` publishes automatically (about a minute).
7. **Verify** — open the live site, check the version badge and What's new, spot-check the change.
8. **Record** — GitHub keeps who/what/when. The deploy run stores `build_manifest.json` (versions, input and output
   SHA-256 hashes, content counts, review status of each model).

## Rollback
* Fast: in GitHub, open the last good commit and **Revert** the bad pull request; merging the revert republishes the
  previous version.
* Each deploy's `build_manifest.json` output hash identifies exactly what was live.
* Checklist files people saved (.json) open in any version.

## Data rules the build enforces
* Pick-list items need `item` + `response` (or `note`); tags must be from: piston, turboprop, jet, turbine, twin,
  retract, press. No `|`, backticks or line breaks inside text.
* Aircraft `seq` runs 0,1,2… with no gaps; ids are unique. **Append only** — saved user checklists refer to aircraft
  by `seq`. Never renumber, delete or reuse.
* Models: unique `key`, valid `status` (draft / reviewed / retired), `reviewed` requires `reviewed_by` and
  `review_date` (YYYY-MM-DD), every `aircraft` id must exist.
* Endorsements: all A.1–A.96 present, unique ids, `status` faa/draft/none with text only when not none, balanced
  `[brackets]`, valid `validity`.
* Output must contain the "Not FAA-approved" footer, have no unfilled placeholders, and be under 16 MB.

## Safety / content rules
* Suggested checklists start as **draft**. Only a pilot qualified on the type may mark one **reviewed**.
* Before any public release set `show_drafts: false`.
* Never copy an operator's or manufacturer's copyrighted checklist into the data without permission. (The Citation
  XLS draft was built from an operator card and must be rebuilt from other sources before public release.)
* Emergency/abnormal procedures are deliberately out of scope.
* Endorsement wording: `status: faa` only after a word-for-word comparison with the current AC 61-65 revision.

## Known limitations (as of app 1.06)
* Aircraft list ≈150 common models; years approximate.
* 6 suggested models, all draft.
* Endorsements: 11 verified FAA wording, 27 draft, 59 without stored wording.
* Offline install (service worker + home-screen icon) not yet added — planned next.
