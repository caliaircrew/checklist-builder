#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build.py — builds the Aircraft Checklist Builder web app from the YAML data.

Script version : 2.0.0   (semantic versioning; see docs/CHANGE_MANAGEMENT.md)
Owner          : Steve (maintainer)      Product owner: James
Inputs         : data/**/*.yaml, src/app_template.html, vendor/docx-*.iife.js
Outputs        : <out>/index.html, <out>/build_manifest.json

Usage
  python build.py                 # build into ./dist
  python build.py --out _site     # (used by the GitHub Actions workflow)
  python build.py --check         # validate everything, write nothing

Requires Python 3.9+ and PyYAML (pip install -r requirements.txt).
If Node.js is installed, the page's JavaScript is also syntax-checked.

Script change history
  2.10.0 2026-10-03  Steve  Offline install for /checklists/: manifest, icons
                            (site/icons), service worker (network-first page,
                            cached fonts, network-only database). Builds 1.43.
  2.9.0  2026-10-03  Steve  Pick-list 'category' (airplane | helicopter | any)
                            -> LIB_CAT; endorsement validity '12cm'.
                            Builds 1.40 (helicopter lists, SFAR 73).
  2.8.0  2026-10-03  Steve  Content pages: site/pages/*.html rendered into the
                            shared shell (_shell.html + homepage CSS) as
                            /<name>/ (partners, terms, privacy). Builds 1.39.
  2.7.0  2026-10-03  Steve  Admin page: site/admin.html + src/admin.js ->
                            admin/index.html (crew CSS shared, node syntax
                            check, refuses secret keys). Builds app 1.30.
  2.6.0  2026-10-03  Steve  Aircraft 'category' (airplane | helicopter) and
                            engine 'turboshaft' (helicopters only); 'h' flag
                            passed to the builder and crew pages. Builds 1.24.
  2.5.0  2026-10-03  Steve  Crew directory page: site/crew.html + src/crew.js ->
                            crew/index.html with supabase-js, cloud config and
                            the aircraft list (seq, make, model, engine, flags,
                            years); node syntax check. Builds app 1.21.
  2.4.0  2026-10-04  Steve  Site layout: site/home.html becomes the homepage
                            (index.html); the builder moves to
                            checklists/index.html. Homepage checked for the
                            builder link and the safety note. Builds app 1.18.
  2.3.0  2026-10-03  Steve  Bundles supabase-js (vendored, checksum-verified)
                            and the cloud config (project URL + publishable
                            key) from data/app.yaml; refuses secret keys.
                            Builds app 1.15.
  2.2.0  2026-10-03  Steve  Section 'when' line and 'plain' (un-numbered
                            reference block) fields; unique whole-number
                            'order' check. Emits LIB_WHEN / LIB_PLAIN.
                            Builds app 1.09.
  2.1.0  2026-10-03  Steve  Pick-list defaults: section 'default_section' and
                            item 'default: true' become each aircraft's
                            standard default checklist (LIB_DEFAULTS). Builds
                            app 1.08.
  2.0.0  2026-10-03  Steve  Data moved out of the script into YAML files
                            (sections, aircraft, models, endorsements, app
                            settings). Page template moved to src/. Docx
                            library vendored and checksum-verified. Output is
                            index.html for GitHub Pages. Functionally identical
                            to app 1.06 built by 1.2.0 (verified at migration).
  1.2.0  2026-10-03  Steve  (single-file script) Endorsements block + checks.
  1.1.0  2026-10-03  Steve  Model review metadata, SHOW_DRAFTS switch.
  1.0.0  2026-10-03  Steve  First build script; reproduced app 1.03.
"""
from __future__ import annotations
import argparse, datetime as _dt, glob, hashlib, json, os, re, shutil, subprocess, sys, tempfile

try:
    import yaml
except ImportError:
    sys.exit("PyYAML is required:  pip install -r requirements.txt")

SCRIPT_VERSION = "2.10.0"
ROOT = os.path.dirname(os.path.abspath(__file__))
MAX_BYTES = 16 * 1024 * 1024
VALID_TAGS = {"piston", "turboprop", "jet", "turbine", "twin", "retract", "press"}
VALID_VALIDITY = {"none", "90d", "24cm", "12cm", "2cm", "flight"}
PLACEHOLDERS = ["<<<SUPABASE_LIB>>>", "{{CLOUD_CONFIG}}\n", "{{LIB_RAW}}\n", "{{SECTION_MATCH}}", "{{ACFT_RAW}}\n", "{{MODELS}}\n",
                "{{ENDORSEMENTS}}\n", "{{VERSION_AND_CHANGELOG}}\n", "<<<DOCX_LIB>>>"]


class BuildError(Exception):
    pass


def sha256(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def load(path):
    try:
        with open(os.path.join(ROOT, path), encoding="utf-8") as f:
            return yaml.safe_load(f)
    except yaml.YAMLError as e:
        raise BuildError(f"{path}: YAML error — {e}")


def files(pattern):
    return sorted(glob.glob(os.path.join(ROOT, pattern)))


def need(cond, msg):
    if not cond:
        raise BuildError(msg)


def js(s: str) -> str:
    return json.dumps(s, ensure_ascii=False)


def no_bar(s, where):
    need("|" not in s and "`" not in s and "\n" not in s, f"{where}: text may not contain | or ` or a line break -> {s!r}")
    return s


# ---------------------------------------------------------------- app.yaml
def build_app(app):
    for k in ("app_version", "show_drafts", "docx", "changelog"):
        need(k in app, f"data/app.yaml: missing '{k}'")
    cl = app["changelog"]
    need(cl and str(cl[0]["version"]) == str(app["app_version"]),
         f"data/app.yaml: top changelog entry must be version {app['app_version']}")
    seen = set()
    for e in cl:
        v = str(e["version"])
        need(v not in seen, f"data/app.yaml: duplicate changelog version {v}")
        need(e.get("notes"), f"data/app.yaml: changelog {v} has no notes")
        seen.add(v)
    rows = [" " + json.dumps([str(e["version"]), list(e["notes"])], ensure_ascii=False, separators=(",", ":")) for e in cl]
    return "const APP_VERSION=%s;\nconst SHOW_DRAFTS=%s;\nconst CHANGELOG=[\n%s];\n" % (
        js(str(app["app_version"])), "true" if app["show_drafts"] else "false", ",\n".join(rows))


# ---------------------------------------------------------------- sections
def build_sections():
    secs, titles, n_items, defaults, whens, plains, orders, cats = [], set(), 0, {}, {}, [], set(), {}
    for path in files("data/sections/*.yaml"):
        rel = os.path.relpath(path, ROOT)
        d = load(rel)
        need(d and d.get("title") and d.get("items"), f"{rel}: needs title and items")
        t = str(d["title"])
        need(t not in titles, f"{rel}: duplicate section title {t}")
        titles.add(t)
        o = d.get("order")
        need(isinstance(o, int), f"{rel}: order must be a whole number")
        need(o not in orders, f"{rel}: order {o} is used by another section")
        orders.add(o)
        w = d.get("when")
        if w is not None:
            need(isinstance(w, str) and w.strip() and "\n" not in w, f"{rel}: when must be one line of text")
            whens[t] = w.strip()
        need(d.get("plain", False) in (True, False), f"{rel}: plain must be true or false")
        if d.get("plain"):
            plains.append(t)
        cat = d.get("category", "airplane")
        need(cat in ("airplane", "helicopter", "any"), f"{rel}: category must be airplane, helicopter or any")
        if cat != "airplane":
            cats[t] = cat
        ds = d.get("default_section")
        if ds is not None:
            need(ds in ("all", "turbine", "jet", "press", "retract", "twin"),
                 f"{rel}: default_section must be all, turbine, jet, press, retract or twin")
            defaults[t] = ds
        lines = []
        for i, it in enumerate(d["items"], 1):
            tags = it.get("tags", []) or []
            bad = set(tags) - VALID_TAGS
            need(not bad, f"{rel} item {i}: unknown tag(s) {sorted(bad)}")
            need(it.get("default", False) in (True, False), f"{rel} item {i}: default must be true or false")
            if it.get("default"):
                need(ds is not None, f"{rel} item {i}: default item in a section without default_section")
                tags = list(tags) + ["default"]
            if "note" in it:
                lines.append("note:" + no_bar(str(it["note"]), f"{rel} item {i}") + "|" + " ".join(tags))
            else:
                need(it.get("item") and "response" in it, f"{rel} item {i}: needs item and response")
                lines.append(no_bar(str(it["item"]), f"{rel} item {i}") + "|" + no_bar(str(it["response"]), f"{rel} item {i}") + "|" + " ".join(tags))
            n_items += 1
        secs.append((int(d.get("order", 999)), t, lines))
    secs.sort(key=lambda x: x[0])
    need(secs, "data/sections: no pick lists found")
    lib = ("const LIB_RAW={\n" + ",\n".join(f'"{t}":`' + "\n".join(l) + "`" for _, t, l in secs) + "};\n"
           + "const LIB_DEFAULTS=" + json.dumps(defaults, ensure_ascii=False, separators=(",", ":")) + ";\n"
           + "const LIB_WHEN=" + json.dumps(whens, ensure_ascii=False, separators=(",", ":")) + ";\n"
           + "const LIB_PLAIN=" + json.dumps(plains, ensure_ascii=False, separators=(",", ":")) + ";\n"
           + "const LIB_CAT=" + json.dumps(cats, ensure_ascii=False, separators=(",", ":")) + ";\n")
    m = load("data/section-matching.yaml")
    pairs = []
    for i, p in enumerate(m["matching"], 1):
        need(p["list"] in titles, f"data/section-matching.yaml entry {i}: unknown list {p['list']!r}")
        pairs.append([str(p["words"]), p["list"]])
    return lib, json.dumps(pairs, ensure_ascii=False, separators=(",", ":")), len(secs), n_items


# ---------------------------------------------------------------- aircraft
def build_aircraft():
    allac = []
    for path in files("data/aircraft/*.yaml"):
        rel = os.path.relpath(path, ROOT)
        for a in (load(rel) or {}).get("aircraft", []):
            for k in ("seq", "id", "make", "model", "years", "engine"):
                need(k in a, f"{rel}: aircraft {a.get('id','?')} missing '{k}'")
            need(a["engine"] in ("piston", "turboprop", "jet", "turboshaft"), f"{rel}: {a['id']}: engine must be piston, turboprop, jet or turboshaft")
            need(a.get("category", "airplane") in ("airplane", "helicopter"), f"{rel}: {a['id']}: category must be airplane or helicopter")
            need(a["engine"] != "turboshaft" or a.get("category") == "helicopter", f"{rel}: {a['id']}: turboshaft engines are for helicopters")
            allac.append((rel, a))
    allac.sort(key=lambda x: x[1]["seq"])
    seqs = [a["seq"] for _, a in allac]
    need(seqs == list(range(len(seqs))),
         "data/aircraft: 'seq' numbers must run 0,1,2… with no gaps or repeats (append new aircraft with the next number)")
    ids = [a["id"] for _, a in allac]
    dup = {i for i in ids if ids.count(i) > 1}
    need(not dup, f"data/aircraft: duplicate id(s) {sorted(dup)}")
    lines = []
    for rel, a in allac:
        f = ("t" if a.get("twin") else "") + ("r" if a.get("retractable") else "") + ("p" if a.get("pressurized") else "") + ("h" if a.get("category") == "helicopter" else "")
        parts = [str(a["make"]), str(a["model"]), str(a["years"]), a["engine"], f, str(a.get("search_words", "") or "")]
        for p in parts:
            no_bar(p, f"{rel}: {a['id']}")
        lines.append("|".join(parts))
    return "const ACFT_RAW=`" + "\n".join(lines) + "`;\n", {i: n for n, i in enumerate(ids)}, len(ids)


# ---------------------------------------------------------------- models
def build_models(seq_of):
    ents, info, keys = [], {}, set()
    loaded = []
    for path in files("data/models/*.yaml"):
        rel = os.path.relpath(path, ROOT)
        loaded.append((rel, load(rel)))
    loaded.sort(key=lambda x: (x[1].get("order", 999), x[0]))
    for rel, m in loaded:
        for k in ("key", "name", "status", "aircraft", "sections"):
            need(k in m, f"{rel}: missing '{k}'")
        key = str(m["key"])
        need(re.fullmatch(r"[A-Z0-9]+", key), f"{rel}: key must be capital letters/digits")
        need(key not in keys, f"{rel}: duplicate key {key}")
        keys.add(key)
        st = m["status"]
        need(st in ("draft", "reviewed", "retired"), f"{rel}: status must be draft, reviewed or retired")
        rb, rd = str(m.get("reviewed_by") or ""), str(m.get("review_date") or "")
        if st == "reviewed":
            need(rb and re.fullmatch(r"\d{4}-\d{2}-\d{2}", rd), f"{rel}: 'reviewed' needs reviewed_by and review_date (YYYY-MM-DD)")
        seqs = []
        for a in m["aircraft"]:
            need(a in seq_of, f"{rel}: unknown aircraft id {a!r}")
            seqs.append(seq_of[a])
        lines, n_lines = [], 0
        for s in m["sections"]:
            lines.append("## " + no_bar(str(s["title"]), rel))
            for i, it in enumerate(s["items"], 1):
                where = f"{rel} [{s['title']}] item {i}"
                if "note" in it:
                    lines.append("note:" + no_bar(str(it["note"]), where))
                elif "divider" in it:
                    lines.append("div:" + no_bar(str(it["divider"]), where))
                else:
                    need(it.get("item") and it.get("response"), f"{where}: needs item and response")
                    lines.append(("*" if it.get("first_flight") else "") + no_bar(str(it["item"]), where) + "|" + no_bar(str(it["response"]), where))
                n_lines += 1
        ents.append(f'"{key}":{{name:{js(str(m["name"]))},status:{js(st)},author:{js(str(m.get("author") or ""))},'
                    f'reviewed_by:{js(rb)},review_date:{js(rd)},match:a=>{json.dumps(sorted(seqs))}.includes(a.id),\n'
                    f'src:{js(str(m.get("source") or ""))},\ntext:`' + "\n".join(lines) + "`}")
        info[str(m["name"])] = {"sections": len(m["sections"]), "lines": n_lines, "status": st, "reviewed_by": rb, "review_date": rd}
    return "const MODELS={\n" + ",\n".join(ents) + "};\n", info


# ---------------------------------------------------------------- endorsements
def build_endorsements():
    d = load("data/endorsements/ac-61-65k.yaml")
    ids, lines, n_faa, n_draft = set(), [], 0, 0
    for e in d["endorsements"]:
        eid = str(e["id"])
        need(eid not in ids, f"endorsements: duplicate id {eid}")
        ids.add(eid)
        st, val, text = e.get("status", "none"), e.get("validity", "none"), str(e.get("text", "") or "")
        need(st in ("faa", "draft", "none"), f"endorsement {eid}: status must be faa, draft or none")
        need(val in VALID_VALIDITY, f"endorsement {eid}: validity must be one of {sorted(VALID_VALIDITY)}")
        need(bool(text.strip()) == (st != "none"), f"endorsement {eid}: status {st} {'needs' if st!='none' else 'must not have'} text")
        need(text.count("[") == text.count("]"), f"endorsement {eid}: unbalanced [brackets]")
        parts = [eid, str(e["category"]), str(e["title"]), str(e["regulation"]), str(e["ac_page"]),
                 "" if st == "none" else st, "" if val == "none" else val, text]
        for p in parts:
            no_bar(p, f"endorsement {eid}")
        lines.append("|".join(parts))
        n_faa += st == "faa"
        n_draft += st == "draft"
    missing = [f"A.{i}" for i in range(1, 97) if f"A.{i}" not in ids]
    need(not missing, f"endorsements missing from the AC 61-65K list: {missing}")
    raw = "\n".join(lines)
    return "const END_RAW=" + json.dumps(raw, ensure_ascii=False) + ";\n", {
        "total": len(ids), "faa_text": n_faa, "draft_text": n_draft, "no_text": len(ids) - n_faa - n_draft,
        "source": d.get("source", "")}


# ---------------------------------------------------------------- docx library
def load_vendor(name, filename, want):
    path = os.path.join(ROOT, "vendor", filename)
    need(os.path.exists(path), f"missing vendor/{filename}")
    data = open(path, "rb").read()
    need(sha256(data) == want, f"vendor/{filename} checksum mismatch (expected {want})")
    return data.decode("utf-8").replace("</script", "<\\/script").replace("\ufffd", "\\uFFFD")


def cloud_config(app):
    c = app.get("cloud") or {}
    url, key = str(c.get("url") or ""), str(c.get("publishable_key") or "")
    if c.get("enabled"):
        need(re.fullmatch(r"https://[a-z0-9]{20}\.supabase\.co", url), "data/app.yaml cloud.url must look like https://<20-char-ref>.supabase.co")
        need(key.startswith("sb_publishable_"), "data/app.yaml cloud.publishable_key must be the PUBLISHABLE key (sb_publishable_...), never a secret key")
    need("sb_secret_" not in json.dumps(c) and "service_role" not in json.dumps(c), "data/app.yaml must never contain a secret / service_role key")
    on = bool(c.get("enabled"))
    return "const CLOUD=" + json.dumps({"enabled": on, "url": url if on else "", "key": key if on else ""}) + ";\n"


def load_docx(app):
    ver, want = app["docx"]["version"], app["docx"]["sha256"]
    path = os.path.join(ROOT, "vendor", f"docx-{ver}.iife.js")
    need(os.path.exists(path), f"missing {os.path.relpath(path, ROOT)}")
    data = open(path, "rb").read()
    need(sha256(data) == want, f"vendor docx library checksum mismatch (expected {want})")
    return data.decode("utf-8").replace("</script", "<\\/script").replace("\ufffd", "\\uFFFD")


def check_output(html, notes):
    left = re.findall(r"\{\{[A-Z_]+\}\}|<<<[A-Z_]+>>>", html)
    need(not left, f"unreplaced placeholders: {left}")
    need("\ufffd" not in html, "output contains U+FFFD")
    size = len(html.encode("utf-8"))
    need(size <= MAX_BYTES, f"output is {size:,} bytes; limit {MAX_BYTES:,}")
    need("Not FAA-approved" in html, "safety footer text is missing")
    notes.append(f"size {size:,} bytes")
    node = shutil.which("node")
    if node:
        with tempfile.TemporaryDirectory() as td:
            for k, s in enumerate(re.findall(r"<script>(.*?)</script>", html, re.S)):
                p = os.path.join(td, f"s{k}.js")
                open(p, "w", encoding="utf-8").write(s)
                r = subprocess.run([node, "--check", p], capture_output=True, text=True)
                need(r.returncode == 0, f"JavaScript syntax error in script block {k}:\n{r.stderr[-800:]}")
        notes.append("JavaScript syntax OK (node)")
    else:
        notes.append("Node.js not found — JavaScript syntax check skipped")


# Service worker for /checklists/: the page itself is network-first (so updates arrive as soon as you're online) with the
# saved copy as the offline fallback; fonts are cached; sign-in and database calls always go to the network.
SW_JS = r"""// Cali Aircrew checklist builder: offline support. Version __VERSION__ (changes with every build).
const CACHE = "cali-checklists-__VERSION__";
const SHELL = ["./", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("cali-checklists-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (u.origin === location.origin && (r.mode === "navigate" || u.pathname.endsWith("/checklists/") || u.pathname.endsWith("/checklists/index.html"))) {
    e.respondWith(fetch(r).then(res => { if (res.ok) { const c = res.clone(); caches.open(CACHE).then(k => k.put("./", c)); } return res; })
      .catch(() => caches.match("./").then(m => m || caches.match(r))));
    return;
  }
  if (u.origin === location.origin && SHELL.some(p => u.pathname.endsWith(p.replace("./", "")) && p !== "./")) {
    e.respondWith(caches.match(r).then(m => m || fetch(r))); return;
  }
  if (u.hostname === "fonts.googleapis.com" || u.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open(CACHE).then(c => c.match(r).then(m => { const net = fetch(r).then(res => { c.put(r, res.clone()); return res; }).catch(() => m); return m || net; })));
  }
});
"""


def main(argv=None):
    ap = argparse.ArgumentParser(description="Build the Aircraft Checklist Builder.")
    ap.add_argument("--out", default="dist")
    ap.add_argument("--check", action="store_true", help="validate only; write nothing")
    a = ap.parse_args(argv)
    try:
        app = load("data/app.yaml")
        print(f"build.py v{SCRIPT_VERSION} -> app v{app['app_version']}")
        ver_js = build_app(app)
        lib, match, n_secs, n_items = build_sections()
        acft, seq_of, n_ac = build_aircraft()
        models, minfo = build_models(seq_of)
        endo, einfo = build_endorsements()
        tmpl = open(os.path.join(ROOT, "src", "app_template.html"), encoding="utf-8").read()
        for ph in PLACEHOLDERS:
            need(tmpl.count(ph) == 1, f"src/app_template.html must contain {ph.strip()} exactly once")
        html = (tmpl.replace("{{LIB_RAW}}\n", lib).replace("{{SECTION_MATCH}}", match)
                    .replace("{{ACFT_RAW}}\n", acft).replace("{{MODELS}}\n", models)
                    .replace("{{ENDORSEMENTS}}\n", endo).replace("{{VERSION_AND_CHANGELOG}}\n", ver_js)
                    .replace("<<<DOCX_LIB>>>", load_docx(app))
                    .replace("{{CLOUD_CONFIG}}\n", cloud_config(app))
                    .replace("<<<SUPABASE_LIB>>>", load_vendor("supabase-js", f"supabase-js-{app['supabase_js']['version']}.umd.js", app["supabase_js"]["sha256"])))
        notes = []
        check_output(html, notes)
    except BuildError as e:
        print(f"BUILD FAILED: {e}", file=sys.stderr)
        return 1
    print(f"  data OK: {n_items} pick-list items in {n_secs} sections, {n_ac} aircraft, "
          f"{len(minfo)} suggested models, {einfo['total']} endorsements "
          f"({einfo['faa_text']} FAA text, {einfo['draft_text']} draft)")
    for n in notes:
        print("  " + n)
    if a.check:
        print("Check complete — nothing written.")
        return 0
    # Site layout: homepage at the root, the builder at /checklists/
    home_path = os.path.join(ROOT, "site", "home.html")
    try:
        need(os.path.exists(home_path), "missing site/home.html (homepage)")
        home = open(home_path, encoding="utf-8").read()
        c = app.get("cloud") or {}
        home = home.replace("{{CLOUD_JSON}}", json.dumps({"enabled": bool(c.get("enabled")), "url": c.get("url", "") if c.get("enabled") else "", "key": c.get("publishable_key", "") if c.get("enabled") else ""}))
        need('href="checklists/"' in home, "site/home.html must link to the builder at checklists/")
        need("not FAA-approved" in home, "site/home.html must keep the safety note in the footer")
    except BuildError as e:
        print(f"BUILD FAILED: {e}", file=sys.stderr)
        return 1
    # Crew directory page (site/crew.html + src/crew.js) -> crew/index.html
    try:
        crew_html = open(os.path.join(ROOT, "site", "crew.html"), encoding="utf-8").read()
        crew_js = open(os.path.join(ROOT, "src", "crew.js"), encoding="utf-8").read()
        acft_rows = []
        for path in files("data/aircraft/*.yaml"):
            for ac in (load(os.path.relpath(path, ROOT)) or {}).get("aircraft", []):
                fl = ("t" if ac.get("twin") else "") + ("r" if ac.get("retractable") else "") + ("p" if ac.get("pressurized") else "") + ("h" if ac.get("category") == "helicopter" else "")
                acft_rows.append([ac["seq"], str(ac["make"]), str(ac["model"]), ac["engine"], fl, str(ac["years"]), str(ac.get("search_words", "") or "")])
        acft_rows.sort(key=lambda r: r[0])
        c = app.get("cloud") or {}
        cloud = json.dumps({"enabled": bool(c.get("enabled")), "url": c.get("url", "") if c.get("enabled") else "", "key": c.get("publishable_key", "") if c.get("enabled") else ""})
        crew_js = crew_js.replace("{{CLOUD_JSON}}", cloud).replace("{{ACFT_JSON}}", json.dumps(acft_rows, ensure_ascii=False, separators=(",", ":")))
        need("{{" not in crew_js, "src/crew.js has an unfilled {{placeholder}}")
        tmpjs = os.path.join(tempfile.gettempdir(), "crew_check.js")
        open(tmpjs, "w", encoding="utf-8").write(crew_js)
        if shutil.which("node"):
            r = subprocess.run(["node", "--check", tmpjs], capture_output=True, text=True)
            need(r.returncode == 0, "src/crew.js JavaScript syntax error:\n" + r.stderr[-800:])
        crew_page = (crew_html.replace("<<<SUPABASE_LIB>>>", load_vendor("supabase-js", f"supabase-js-{app['supabase_js']['version']}.umd.js", app["supabase_js"]["sha256"]))
                              .replace("{{CREW_APP_JS}}", crew_js.replace("</script", "<\\/script")))
        need("not a broker" in crew_page, "site/crew.html must keep the directory/not-a-broker note")
        # Admin page (site/admin.html + src/admin.js) -> admin/index.html; shares the crew page's styles.
        admin_html = open(os.path.join(ROOT, "site", "admin.html"), encoding="utf-8").read()
        admin_js = open(os.path.join(ROOT, "src", "admin.js"), encoding="utf-8").read()
        admin_js = admin_js.replace("{{CLOUD_JSON}}", cloud).replace("{{ACFT_JSON}}", json.dumps(acft_rows, ensure_ascii=False, separators=(",", ":")))
        need("{{" not in admin_js, "src/admin.js has an unfilled {{placeholder}}")
        need("sb_secret_" not in admin_js and "service_role" not in admin_js, "src/admin.js must never contain a secret/service key")
        open(tmpjs, "w", encoding="utf-8").write(admin_js)
        if shutil.which("node"):
            r = subprocess.run(["node", "--check", tmpjs], capture_output=True, text=True)
            need(r.returncode == 0, "src/admin.js JavaScript syntax error:\n" + r.stderr[-800:])
        crew_css = re.search(r"<style>(.*?)</style>", crew_html, re.S).group(1)
        admin_page = (admin_html.replace("<<<CREW_CSS>>>", crew_css)
                                .replace("<<<SUPABASE_LIB>>>", load_vendor("supabase-js", f"supabase-js-{app['supabase_js']['version']}.umd.js", app["supabase_js"]["sha256"]))
                                .replace("{{ADMIN_APP_JS}}", admin_js.replace("</script", "<\\/script")))
    except BuildError as e:
        print(f"BUILD FAILED: {e}", file=sys.stderr)
        return 1
    # Simple content pages (site/pages/*.html -> <name>/index.html) in the shared shell with the homepage's styles.
    try:
        shell = open(os.path.join(ROOT, "site", "pages", "_shell.html"), encoding="utf-8").read()
        site_css = re.search(r"<style>(.*?)</style>", open(os.path.join(ROOT, "site", "home.html"), encoding="utf-8").read(), re.S).group(1)
        pages_out = {}
        for path in sorted(glob.glob(os.path.join(ROOT, "site", "pages", "*.html"))):
            name = os.path.basename(path)[:-5]
            if name.startswith("_"): continue
            src = open(path, encoding="utf-8").read()
            title = re.search(r"<!--TITLE:\s*(.*?)-->", src).group(1).strip(); desc = re.search(r"<!--DESC:\s*(.*?)-->", src).group(1).strip()
            body, _, script = src.partition("<!--SCRIPT-->")
            body = re.sub(r"<!--(TITLE|DESC):.*?-->\n?", "", body)
            script = script.replace("{{CLOUD_JSON}}", cloud)
            need("{{" not in script, f"site/pages/{name}.html has an unfilled placeholder")
            pages_out[name] = (shell.replace("<<<SITE_CSS>>>", site_css).replace("{{TITLE}}", title).replace("{{DESC}}", desc)
                               .replace("{{PARTNERS_CURRENT}}", ' aria-current="page" style="border-bottom:3px solid var(--blue)"' if name == "partners" else "")
                               .replace("{{BODY}}", body).replace("{{SCRIPT}}", script.replace("</script", "<\\/script")))
            need("{{" not in pages_out[name], f"site/pages/{name}.html left a {{{{placeholder}}}} in the shell")
    except BuildError as e:
        print(f"BUILD FAILED: {e}", file=sys.stderr)
        return 1
    need('id="aQ"' in html and "Checklist builder" in html, "checklist builder page is missing its aircraft search; refusing to publish")
    os.makedirs(os.path.join(a.out, "crew"), exist_ok=True)
    shutil.copyfile(os.path.join(ROOT, "data", "airports-us.json"), os.path.join(a.out, "crew", "airports.json"))
    # seq -> "Make Model" for the reminder emails (read by the reminders Edge Function)
    open(os.path.join(a.out, "crew", "aircraft-names.json"), "w", encoding="utf-8").write(
        json.dumps({str(r[0]): (r[1] + " " + r[2]).strip() for r in acft_rows}, ensure_ascii=False, separators=(",", ":")))
    for page_name, page_html in pages_out.items():   # distinct names: 'html' is the checklist builder, written below
        os.makedirs(os.path.join(a.out, page_name), exist_ok=True)
        open(os.path.join(a.out, page_name, "index.html"), "w", encoding="utf-8").write(page_html)
    os.makedirs(os.path.join(a.out, "admin"), exist_ok=True)
    open(os.path.join(a.out, "admin", "index.html"), "w", encoding="utf-8").write(admin_page)
    os.makedirs(os.path.join(a.out, "crew"), exist_ok=True)
    open(os.path.join(a.out, "crew", "index.html"), "w", encoding="utf-8").write(crew_page)
    os.makedirs(os.path.join(a.out, "checklists"), exist_ok=True)
    data = html.encode("utf-8")
    open(os.path.join(a.out, "checklists", "index.html"), "wb").write(data)
    # Offline install (PWA): manifest, icons and a service worker that keeps the builder on the device.
    ck = os.path.join(a.out, "checklists")
    os.makedirs(os.path.join(ck, "icons"), exist_ok=True)
    for f in glob.glob(os.path.join(ROOT, "site", "icons", "*.png")):
        shutil.copyfile(f, os.path.join(ck, "icons", os.path.basename(f)))
    manifest = {"name": "Cali Aircrew Checklists", "short_name": "Checklists", "start_url": "./", "scope": "./", "display": "standalone",
                "background_color": "#F4F8FC", "theme_color": "#2470B3", "description": "Build, print and fly aircraft checklists, online or offline.",
                "icons": [{"src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png"},
                          {"src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png"},
                          {"src": "icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}]}
    open(os.path.join(ck, "manifest.webmanifest"), "w", encoding="utf-8").write(json.dumps(manifest, indent=1))
    sw_version = hashlib.sha256(data).hexdigest()[:12]
    open(os.path.join(ck, "sw.js"), "w", encoding="utf-8").write(SW_JS.replace("__VERSION__", sw_version))
    open(os.path.join(a.out, "index.html"), "w", encoding="utf-8").write(home)
    inputs = {os.path.relpath(p, ROOT).replace(os.sep, "/"): sha256(open(p, "rb").read())
              for p in files("data/**/*.yaml") + files("data/*.yaml") + [os.path.join(ROOT, "src", "app_template.html")]}
    manifest = {
        "app": app.get("app_name", "Aircraft Checklist Builder"), "app_version": str(app["app_version"]),
        "script_version": SCRIPT_VERSION, "show_drafts": bool(app["show_drafts"]),
        "built_utc": _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "commit": os.environ.get("GITHUB_SHA", ""), "python": sys.version.split()[0],
        "output": {"file": "checklists/index.html", "bytes": len(data), "sha256": sha256(data),
                   "homepage": {"file": "index.html", "sha256": sha256(home.encode("utf-8"))}},
        "inputs": inputs, "docx": app["docx"], "supabase_js": app.get("supabase_js"), "cloud_enabled": bool((app.get("cloud") or {}).get("enabled")),
        "content": {"pick_list_sections": n_secs, "pick_list_items": n_items, "aircraft": n_ac,
                    "suggested_models": minfo, "endorsements": einfo},
        "changelog_top": app["changelog"][0],
    }
    json.dump(manifest, open(os.path.join(a.out, "build_manifest.json"), "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    print(f"Wrote {os.path.join(a.out, 'index.html')} (homepage) and {os.path.join(a.out, 'checklists', 'index.html')}  sha256 {manifest['output']['sha256']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
