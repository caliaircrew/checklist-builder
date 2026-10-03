# Changelog

## App
| Version | Date | Change |
|---|---|---|
| 1.08 | 2026-10-03 | Default checklist for every aircraft (model checklist, or standard built from the general lists and labeled not yet POH-specific); picking an aircraft loads it; Reset to default (top and Step 2). ★ My items: personal pick-list lines kept on the device, survive Reset, travel in checklist files. Fixed ⋯ menu not opening after first use; caution notes now follow aircraft type. |
| 1.07 | 2026-10-03 | Site built and published automatically from the GitHub repository (GitHub Actions). No feature changes. |
| 1.06 | 2026-10-03 | CFI endorsements screen: all 96 AC 61-65K endorsements, fill-in blanks, validity dates, Word export with AC-format signature lines. |
| 1.05 | 2026-10-03 | 11 new section lists (Passing 10,000, Flight levels/RVSM, High-altitude oxygen, Cruise check, Transition level, Below 10,000, Final/stabilized, Go-around, Quick turn, Cold weather, Briefings). |
| 1.04 | 2026-10-03 | Aircraft list ≈150 models; draft suggested checklists for Cirrus SR22 and Piper Archer; review status shown. |
| 1.03 | 2026-10-03 | Suggested model checklists: Challenger 605, Citation XLS/XLS+, CJ3/CJ3+, Cessna 172S. Not-FAA-approved footer. |
| 1.02 | 2026-10-03 | Find your aircraft (Cessna, Citation, Challenger). |
| 1.01 | 2026-10-03 | Version display; checklist version + New revision; drag and type-a-number reordering. |
| 1.00 | 2026-10-03 | Pick lists, custom lines/sections, Standard and Large print, Word export, save/open files. |

## Build script
| Version | Date | Change |
|---|---|---|
| 2.1.0 | 2026-10-03 | Pick-list default fields (`default_section`, item `default`) and LIB_DEFAULTS output. Builds app 1.08. |
| 2.0.0 | 2026-10-03 | Repository layout: data in YAML, template in src/, vendored docx, index.html output, GitHub Actions deploy. Verified identical app output to 1.2.0. |
| 1.2.0 | 2026-10-03 | Endorsements data block and validation (single-file script). |
| 1.1.0 | 2026-10-03 | Model review metadata, SHOW_DRAFTS switch. |
| 1.0.0 | 2026-10-03 | First build script. |
