# vendor/

`docx-9.6.1.iife.js` is the browser build of the open-source **docx** library (MIT license, see `docx-LICENSE.txt`),
used to create the Word files inside the app. It is stored here so builds never depend on a download.

`build.py` refuses to build if this file's SHA-256 does not match `data/app.yaml → docx.sha256`.
To upgrade: replace the file, update `docx.version` and `docx.sha256` together, bump the app version, and test the Word export.
