# vendor/

Third-party libraries stored in the repository so builds never depend on a download.
`build.py` refuses to build if a file's SHA-256 does not match the value in `data/app.yaml`.

| File | Library | License | Pinned in |
|---|---|---|---|
| `docx-9.6.1.iife.js` | docx (Word export) | MIT, `docx-LICENSE.txt` | `data/app.yaml → docx` |
| `supabase-js-2.117.2.umd.js` | supabase-js (sign-in & sync) | MIT, `supabase-js-LICENSE.txt` | `data/app.yaml → supabase_js` |

To upgrade: replace the file, update the version and sha256 together, bump the app version, and retest.
