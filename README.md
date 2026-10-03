# Aircraft Checklist Builder

A point-and-click tool for building printable two-column aircraft checklists (dot leaders, numbered lines, black
section bars) and CFI logbook endorsements. It runs in any browser, installs on iPad/iPhone/Android, and exports
Word files.

> **Safety notice.** Pick lists and suggested model checklists are **suggestions only**. They are not FAA-approved
> and are not manufacturer checklists. Every item must be verified against the aircraft's approved AFM/POH, and every
> endorsement against the current FAA AC 61-65, before use. The instructor or pilot remains responsible.

## How it works

```
data/*.yaml  ──►  build.py  ──►  dist/index.html  ──►  GitHub Pages (checklists.caliaircrew.com)
src/app_template.html ─┘          (one self-contained page, works offline once installed)
```

Every push to `main` runs **.github/workflows/build-and-deploy.yml**: it validates all data, builds the page, and
publishes it. Pull requests are built and checked but not published.

## What's where

| Path | What it holds |
|---|---|
| `data/app.yaml` | App version, the `show_drafts` release switch, the "What's new" list, pinned Word-export library |
| `data/sections/NN-*.yaml` | General pick lists, one file per checklist section (Preflight … Briefings) |
| `data/section-matching.yaml` | Which pick list opens for a typed section name (first match wins) |
| `data/aircraft/<make>.yaml` | The "Find your aircraft" list, one file per make |
| `data/models/*.yaml` | Suggested checklists for specific models, with review status |
| `data/endorsements/ac-61-65k.yaml` | All 96 AC 61-65K endorsements (+ § 61.195(h)) with wording status |
| `site/home.html` | The Cali Aircrew homepage (site root). Plain HTML; edit the wording freely |
| `src/app_template.html` | Page layout, styles and behavior (placeholders are filled from the data) |
| `vendor/` | docx (Word export) and supabase-js (sign-in & sync), checksum-verified |
| `supabase/` | Database setup SQL for optional accounts (run once in Supabase's SQL Editor) |
| `docs/CHANGE_MANAGEMENT.md` | How changes are requested, reviewed, versioned, released and rolled back |
| `CHANGELOG.md` | Release history |

## Build it yourself

```
pip install -r requirements.txt
python build.py            # writes dist/index.html and dist/build_manifest.json
python build.py --check    # validate only
```
Open `dist/index.html` in a browser to try it.

## Common edits (each is a pull request — see docs/CHANGE_MANAGEMENT.md)

* **Add an item to a pick list:** add a line to the right `data/sections/*.yaml`, e.g.
  `- {item: Fuel Caps, response: SECURE}` — add `tags: [jet]` (piston, turboprop, jet, turbine, twin, retract, press)
  if it only applies to some aircraft. A caution line is `- {note: NO TAKEOFF WITH FROST ON WINGS}`.
* **Section timing and reference blocks:** in a section file, `when:` is the line printed under the heading (e.g. "Between 500 and 1,500 ft AGL") and `plain: true` prints the section without line numbers (used for V-speeds, frequencies, phone numbers). `order:` sets its place in the list.
* **Change an aircraft's standard default:** in `data/sections/*.yaml`, `default_section` says which aircraft get that section (all, turbine, jet, press, retract, twin) and `default: true` marks the items included. Aircraft with a suggested model checklist use that instead.
* **★ My items** (personal lines) are stored only in each user's browser, not in this repository. They never change the shared lists.
* **Add an aircraft:** append to its make's file with the **next unused `seq`** (never renumber or delete).
* **Add a suggested model checklist:** copy a file in `data/models/`, give it a new `key`, `status: draft`,
  list its `aircraft` ids. Only a qualified pilot on the type may change it to `status: reviewed` (with
  `reviewed_by` and `review_date`).
* **Verify an endorsement:** compare `text` word-for-word with the current AC 61-65 page shown, then set `status: faa`.
* **Public release:** set `show_drafts: false` in `data/app.yaml` so only reviewed models appear.

Then bump `app_version` and add a changelog entry at the top of `data/app.yaml`. The build fails if you forget.
