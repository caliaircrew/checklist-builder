## What changed and why
<!-- Who asked for it, which aircraft / section / endorsement, and the source document. -->

## Checklist
- [ ] `data/app.yaml`: `app_version` bumped (two decimals, e.g. 1.06 → 1.07) and a matching entry added at the TOP of `changelog`
- [ ] `build.py` version bumped and history updated (only if the script itself changed)
- [ ] The automatic build on this pull request passed (green check)
- [ ] Tested the preview on an iPad/phone and a computer: aircraft search, pick list, load suggested checklist, move/delete lines, Standard/Large print, Word download
- [ ] Checklist content: reviewed against the AFM/POH by a qualified pilot on the type (name: ______)
- [ ] Endorsement wording: compared word-for-word with the current AC 61-65 before setting `status: faa`
- [ ] New aircraft were added with the next unused `seq` (none renumbered or deleted)
