/* Cali Aircrew crew directory — profiles (Phase 1, step 2).
   Data lives in Supabase (supabase/002_directory.sql). The page is static; every
   privacy rule is enforced by the database (row level security), not by this code. */
(function(){
"use strict";
const CLOUD = {{CLOUD_JSON}};
const ACFT_ROWS = {{ACFT_JSON}};            // [seq, make, model, engine, flags, years, search words]
const ACFT = ACFT_ROWS.map(r => ({seq:r[0], make:r[1], model:r[2], engine:r[3], twin:r[4].includes("t"), heli:r[4].includes("h"), years:r[5], alias:r[6] || "",
  name:((r[1]==="Cessna Citation"?"Cessna":r[1])+" "+String(r[2]).replace(/\s*\(.*?\)/,"")).trim()}));  // same naming as the checklist builder
const BYSEQ = new Map(ACFT.map(a => [a.seq, a]));
const CREW_TYPES = [["airplane_pilot","Airplane pilot"],["helicopter_pilot","Helicopter pilot"],["cfi","Flight instructor"],["flight_attendant","Flight attendant"],["ferry_pilot","Ferry / delivery pilot"],["mechanic","Mechanic (A&P / IA)"]];
const TYPE_LABEL = Object.fromEntries(CREW_TYPES);
/* Tap-to-choose profile options. Values are stored in crew_profiles.details (jsonb) so search can filter exactly.
   Keep values stable; labels can change. */
const OPT = {
  role:[["pic","Captain / PIC"],["sic","First officer / SIC"],["either","Either seat"],["cfi","Flight instructor"],["fa","Flight attendant"],["mech","Mechanic"]],
  cert:[["none","None / not a pilot"],["private","Private"],["commercial","Commercial"],["atp","ATP"]],
  ratings:[["instrument","Instrument"],["multi","Multi-engine"],["sea","Seaplane"],["helicopter","Helicopter"],["cfi","CFI"],["cfii","CFII"],["mei","MEI"],["cfih","CFI-H"],["ap","A&P"],["ia","IA"]],
  medical:[["first","First class"],["second","Second class"],["third","Third class"],["basicmed","BasicMed"],["na","Not required"]],
  region:[["socal","Southern California"],["norcal","Northern California"],["pnw","Pacific Northwest"],["southwest","Southwest"],["mountain","Mountain"],["texas","Texas"],["midwest","Midwest"],["southeast","Southeast"],["florida","Florida"],["northeast","Northeast"],["hawaii","Hawaii"],["alaska","Alaska"],["intl","Outside the US"]],
  status:[["now","Available now"],["notice","Available with notice"],["no","Not currently available"]],
  looking:[["contract","Contract trips"],["fulltime","Full-time"],["parttime","Part-time"],["weekends","Weekends"],["shortnotice","Short notice (24 hours)"],["ferry","Ferry and delivery"],["instruction","Instruction"]],
  travel:[["local","Local only"],["300nm","Within 300 nm"],["westcoast","West Coast"],["national","Nationwide"],["international","International"]],
  experience:[["p91","Part 91"],["p135","Part 135 charter"],["p91k","Part 91K fractional"],["p121","Part 121 airline"],["corporate","Corporate flight department"],["intl","International / oceanic"],["mountain","Mountain flying"],["ems","Medevac / EMS"],["tours","Aerial tours"],["utility","Utility / external load"],["military","Military"]],
  school:[["flightsafety","FlightSafety"],["cae","CAE (SimuFlite)"],["simcom","SIMCOM"],["loft","LOFT (Carlsbad)"],["factory","Manufacturer / factory"],["inhouse","Company in-house (Part 135)"],["independent","Independent instructor"],["other","Other"]],
  opkind:[["owner","Private owner"],["charter","Charter operator (Part 135)"],["management","Management company"],["flight_department","Corporate flight department"],["school","Flight school"],["other","Other"]],
  oplook:[["pic","Captain / PIC"],["sic","First officer / SIC"],["fa","Flight attendant"],["mech","Mechanic"],["cfi","Flight instructor"]],
  opops:[["p91","Part 91"],["p135","Part 135"],["p91k","Part 91K"]],
  opwork:[["contract","Contract trips"],["fulltime","Full-time"],["parttime","Part-time"]],
  languages:[["en","English"],["es","Spanish"],["fr","French"],["pt","Portuguese"],["de","German"],["zh","Mandarin"],["other","Other"]]
};
const LBL = k => Object.fromEntries(OPT[k]);
const lbl = (k, v) => LBL(k)[v] || "";
/* Currency on one aircraft: "current" until the end of the 'current through' month, then "expired". */
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const ym = d => d ? String(d).slice(0, 7) : "";                                   // "2027-03-01" -> "2027-03"
const ymText = d => { const m = /^(\d{4})-(\d{2})/.exec(d || ""); return m ? MONTHS[+m[2] - 1] + " " + m[1] : ""; };
const thisYM = () => { const n = new Date(); return n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0"); };
const curState = a => !a.is_current ? "" : (a.current_until && ym(a.current_until) < thisYM()) ? "expired" : "current";
const schoolText = a => a.training_school === "other" ? (a.training_other || "Other") : lbl("school", a.training_school);
const curText = a => { const st = curState(a); if (!st) return "";
  const until = ymText(a.current_until), sch = schoolText(a);
  return (st === "expired" ? " · currency expired " + until : " · current" + (until ? " through " + until : "")) + (sch ? " · " + sch : ""); };
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const app = $("app");
document.getElementById("yr").textContent = new Date().getFullYear();

let sb = null, user = null;
if (CLOUD.enabled && window.supabase) {
  try { sb = window.supabase.createClient(CLOUD.url, CLOUD.key, {auth:{persistSession:true, autoRefreshToken:true, detectSessionInUrl:true, storageKey:"acb-auth"}}); } catch (e) { sb = null; }
}

/* ---------------- sign-in (same account as the checklist builder) ---------------- */
async function needMfa(){ const r = await sb.auth.mfa.getAuthenticatorAssuranceLevel(); const a = r && r.data; return !!(a && a.nextLevel === "aal2" && a.currentLevel !== "aal2"); }
async function mfaVerify(code){
  if (!/^\d{6}$/.test(code)) return "Enter the 6-digit code from Microsoft Authenticator.";
  const {data:f, error:e1} = await sb.auth.mfa.listFactors(); if (e1) return e1.message;
  const t = ((f && f.totp) || []).find(x => x.status === "verified") || ((f && f.totp) || [])[0]; if (!t) return "No authenticator is set up for this account.";
  const {data:ch, error:e2} = await sb.auth.mfa.challenge({factorId:t.id}); if (e2) return e2.message;
  const {error:e3} = await sb.auth.mfa.verify({factorId:t.id, challengeId:ch.id, code}); return e3 ? e3.message : "";
}
function modal(html){ const m = document.createElement("div"); m.className = "modal"; m.innerHTML = `<div class="box2" role="dialog" aria-modal="true">${html}</div>`; document.body.appendChild(m); m.addEventListener("click", e => { if (e.target === m) m.remove(); }); return m; }
function signIn(after){
  const m = modal(`<h2>Sign in</h2><p class="hint" style="margin:0">Same sign-in as the checklist builder. We email you a code; no passwords.</p><div id="si"></div><div class="err" id="sim" role="status"></div><button class="btn secondary" id="six" type="button">Close</button>`);
  const box = m.querySelector("#si"), msg = t => { m.querySelector("#sim").textContent = t || ""; };
  m.querySelector("#six").onclick = () => m.remove();
  let email = "";
  const s1 = () => { box.innerHTML = `<div class="f"><label for="sie">Email</label><input id="sie" type="email" autocomplete="email" autocapitalize="none" placeholder="you@example.com"></div><button class="btn primary" id="sis" type="button" style="width:100%;margin-top:12px">Email me a sign-in code</button>`;
    const e = box.querySelector("#sie"), b = box.querySelector("#sis"); e.value = email; e.focus();
    const go = async () => { email = e.value.trim().toLowerCase(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return msg("Enter a valid email address."); msg(""); b.disabled = true; b.textContent = "Sending…";
      const {error} = await sb.auth.signInWithOtp({email, options:{shouldCreateUser:true, emailRedirectTo:location.origin + location.pathname}});
      b.disabled = false; b.textContent = "Email me a sign-in code"; if (error) return msg(error.message); s2(); };
    b.onclick = go; e.onkeydown = ev => { if (ev.key === "Enter") go(); }; };
  const s2 = () => { box.innerHTML = `<p style="margin:0">We emailed a code to <b>${esc(email)}</b>. Type it here, or tap the link in the email on this device.</p><div class="f" style="margin-top:12px"><label for="sic">Sign-in code</label><input id="sic" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="123456"></div><button class="btn primary" id="siv" type="button" style="width:100%;margin-top:12px">Sign in</button>`;
    const c = box.querySelector("#sic"), b = box.querySelector("#siv"); c.focus();
    const go = async () => { const token = c.value.replace(/\s/g, ""); if (!/^\d{6,10}$/.test(token)) return msg("Enter the code from the email."); msg(""); b.disabled = true;
      const {error} = await sb.auth.verifyOtp({email, token, type:"email"}); b.disabled = false; if (error) return msg(error.message);
      if (await needMfa()) return s3(); m.remove(); after && after(); };
    b.onclick = go; c.onkeydown = ev => { if (ev.key === "Enter") go(); }; };
  const s3 = () => { box.innerHTML = `<p style="margin:0">Open <b>Microsoft Authenticator</b> and type the 6-digit code for Checklist Builder.</p><div class="f" style="margin-top:12px"><label for="sit">Authenticator code</label><input id="sit" inputmode="numeric" autocomplete="one-time-code" maxlength="6"></div><button class="btn primary" id="sig" type="button" style="width:100%;margin-top:12px">Verify</button>`;
    const c = box.querySelector("#sit"), b = box.querySelector("#sig"); c.focus();
    const go = async () => { b.disabled = true; const r = await mfaVerify(c.value.trim()); b.disabled = false; if (r) return msg(r); m.remove(); after && after(); };
    b.onclick = go; c.onkeydown = ev => { if (ev.key === "Enter") go(); }; };
  if (user) s3(); else s1();
}
function drawAcct(){ const b = $("acctBtn"); if (!b) return; b.textContent = user ? "My profile" : "Sign in";
  const al = $("adminLink"); if (al) al.hidden = true;
  if (user && sb && al) sb.rpc("is_admin").then(r => { if (r && r.data === true) al.hidden = false; }, () => {}); }
async function drawBanner(){
  if (!sb) return; try { const {data} = await sb.from("site_settings").select("value").eq("key", "banner").maybeSingle();
    const v = data && data.value; const el = $("sitebanner"); if (!el) return;
    if (v && v.on && v.text) { el.textContent = v.text; el.className = "sitebanner" + (v.kind === "warn" ? " warn" : ""); el.hidden = false; } else el.hidden = true; } catch (e) {} }
drawBanner();

/* ---------------- shared bits ---------------- */
const initials = n => (String(n || "").trim().split(/\s+/).map(w => w[0]).join("").slice(0, 2) || "?").toUpperCase();
const fmt = n => (n == null || n === "" || isNaN(n)) ? "" : Number(n).toLocaleString("en-US");
function cardHTML(p, aircraft, mod, opts){
  const d = p.details || {};
  const types = (p.crew_types || []).map(t => TYPE_LABEL[t]).filter(Boolean);
  const metaParts = [lbl("cert", d.cert) && d.cert !== "none" ? lbl("cert", d.cert) : p.certificate, lbl("role", d.role) || p.headline].filter(Boolean);
  const base = [d.airport, lbl("region", d.region)].filter(Boolean).join(" · ") || p.home_base;
  const ac = (aircraft || []).map(a => ({...a, info:BYSEQ.get(a.acft_seq)})).filter(a => a.info).sort((x, y) => (y.hours || 0) - (x.hours || 0));
  const chips = (k, arr) => (arr || []).map(v => lbl(k, v)).filter(Boolean).map(t => `<span class="badge">${esc(t)}</span>`).join("");
  const badges = [];
  if (mod && mod.verified_faa) badges.push(`<span class="badge ok">✓ FAA certificate verified</span>`);
  if ((aircraft || []).some(a => a.part135)) badges.push(`<span class="badge ok">✓ Part 135 current</span>`);
  if (d.status === "now") badges.push(`<span class="badge ok">Available now</span>`);
  else if (d.status === "notice") badges.push(`<span class="badge">Available with notice</span>`);
  types.forEach(t => badges.push(`<span class="badge">${esc(t)}</span>`));
  const block = (title, html) => html ? `<section><h3>${title}</h3><div class="chips2">${html}</div></section>` : "";
  const availText = [lbl("status", d.status), d.travel ? "Will travel: " + lbl("travel", d.travel) : "", d.passport ? "Valid passport" : ""].filter(Boolean).join(" · ");
  return `<article class="pcard" aria-label="Crew profile">
    <div class="top"><div class="avatar" aria-hidden="true">${esc(initials(p.display_name))}</div>
      <div><h2>${esc(p.display_name) || '<span class="empty">Your name</span>'}</h2>
      <div class="meta">${esc(metaParts.join(" · ")) || '<span class="empty">Certificate · role</span>'}</div>
      <div class="meta">${base ? "Based in " + esc(base) : '<span class="empty">Home base</span>'}</div></div></div>
    ${badges.length ? `<div class="badges">${badges.join("")}</div>` : ""}
    <section><h3>Aircraft and time</h3>
      ${ac.length ? ac.map(a => `<div class="row"><span>${esc(a.info.name)}${a.type_rated ? " · type rated" : ""}${esc(curText(a))}${a.part135 ? " · 135 " + esc(a.part135) : ""}</span><b>${a.hours ? fmt(a.hours) + " hrs" : ""}</b></div>`).join("") : '<p class="empty">Add the aircraft you fly.</p>'}
      ${p.total_time ? `<div class="row"><span>Total time</span><b>${fmt(p.total_time)} hrs</b></div>` : ""}
    </section>
    ${block("Ratings", chips("ratings", d.ratings) + (d.medical ? `<span class="badge">Medical: ${esc(lbl("medical", d.medical))}</span>` : ""))}
    ${(availText || (d.looking || []).length) ? `<section><h3>Availability</h3>${availText ? `<p>${esc(availText)}</p>` : ""}${(d.looking || []).length ? `<div class="chips2" style="margin-top:8px">${chips("looking", d.looking)}</div>` : ""}</section>` : ""}
    ${block("Experience", chips("experience", d.experience))}
    ${block("Languages", chips("languages", d.languages))}
    ${p.bio ? `<section><h3>More about me</h3><p>${esc(p.bio)}</p></section>` : ""}
    <div class="actions"><button class="btn primary" type="button" disabled title="Messaging opens soon" style="opacity:.6">Message (coming soon)</button></div>
    <div class="note">${opts && opts.preview ? "Preview: this is how owners and operators will see your profile." : "Profiles are advertisements. Verify licenses, medical and training before hiring."}</div>
  </article>`;
}

/* ---------------- views ---------------- */
/* ---------------- directory data (listed profiles only; the database decides what is visible) ---------------- */
let DIR = null;
async function loadDir(force){
  if (DIR && !force && Date.now() - DIR.at < 60000) return DIR;
  const [{data:ps, error:e1}, {data:acs}, {data:mods}] = await Promise.all([
    sb.from("crew_profiles").select("*"), sb.from("crew_aircraft").select("*"), sb.from("moderation").select("*")]);
  if (e1) throw e1;
  const mod = new Map((mods || []).map(m => [m.user_id, m]));
  const acBy = new Map(); (acs || []).forEach(a => { if (!acBy.has(a.user_id)) acBy.set(a.user_id, []); acBy.get(a.user_id).push(a); });
  const listed = (ps || []).filter(p => { const m = mod.get(p.user_id); return p.published && m && m.approved && !m.hidden; });
  const count = new Map(); listed.forEach(p => (acBy.get(p.user_id) || []).forEach(a => count.set(a.acft_seq, (count.get(a.acft_seq) || 0) + 1)));
  DIR = {at:Date.now(), listed, acBy, mod, count};
  return DIR;
}
const QUICK = [["contract","Contract pilots"],["now","Available now"],["soon","Now or with notice"],["p135","Part 135 current"],["cfi","CFIs"],["heli","Helicopter pilots"]];
let F = {seq:null, type:"", region:"", cert:"", avail:"", p135:false, contract:false};
function matches(p, ac){
  const d = p.details || {};
  if (F.type && !(p.crew_types || []).includes(F.type)) return false;
  if (F.seq != null && !ac.some(a => a.acft_seq === F.seq)) return false;
  if (F.region && d.region !== F.region) return false;
  if (F.cert && d.cert !== F.cert) return false;
  if (F.avail === "now" && d.status !== "now") return false;
  if (F.avail === "soon" && d.status !== "now" && d.status !== "notice") return false;
  if (F.contract && !(d.looking || []).includes("contract")) return false;
  if (F.p135 && !ac.some(a => a.part135 && (F.seq == null || a.acft_seq === F.seq))) return false;
  return true;
}
function rank(p, ac, mod){
  const d = p.details || {}, t = F.seq != null ? (ac.find(a => a.acft_seq === F.seq) || {}) : {}, onType = t.hours || 0;
  return (d.status === "now" ? 2e9 : d.status === "notice" ? 1e9 : 0) + (curState(t) === "current" ? 4e8 : 0) + (mod && mod.verified_faa ? 1e8 : 0) + onType * 1000 + (p.total_time || 0);
}
function resultHTML(p, ac, mod, active){
  const d = p.details || {};
  const top = (F.seq != null ? ac.filter(a => a.acft_seq === F.seq) : ac.slice().sort((x, y) => (y.hours || 0) - (x.hours || 0))).slice(0, 2)
    .map(a => { const i = BYSEQ.get(a.acft_seq); return i ? `${esc(i.name)}${esc(curText(a))}${a.hours ? " · " + fmt(a.hours) + " hrs" : ""}${a.part135 ? " · 135 " + esc(a.part135) : ""}` : ""; }).filter(Boolean);
  const meta = [lbl("cert", d.cert) && d.cert !== "none" ? lbl("cert", d.cert) : "", lbl("role", d.role)].filter(Boolean).join(" · ") || [p.certificate, p.headline].filter(Boolean).join(" · ");
  const base = [d.airport, lbl("region", d.region)].filter(Boolean).join(" · ") || p.home_base;
  const b = [];
  if (mod && mod.verified_faa) b.push(`<span class="badge ok">✓ FAA verified</span>`);
  if (ac.some(a => a.part135)) b.push(`<span class="badge ok">Part 135</span>`);
  if (d.status === "now") b.push(`<span class="badge ok">Available now</span>`);
  else if (d.status === "notice") b.push(`<span class="badge">Available with notice</span>`);
  return `<a class="res${active ? " on" : ""}" href="#/p/${esc(p.user_id)}" data-id="${esc(p.user_id)}">
    <span class="avatar sm" aria-hidden="true">${esc(initials(p.display_name))}</span>
    <span class="rbody"><b class="rname">${esc(p.display_name)}</b><span class="rmeta">${esc(meta)}${base ? " · " + esc(base) : ""}</span>
    ${top.length ? `<span class="rac">${top.join("<br>")}</span>` : ""}${b.length ? `<span class="chips2">${b.join("")}</span>` : ""}</span></a>`;
}
const LOGGED = new Set(); let logTimer = null;
function logSearch(n){
  if (!sb || (F.seq == null && !F.region)) return;
  const filters = {type:F.type, cert:F.cert, avail:F.avail, p135:F.p135, contract:F.contract};
  const key = JSON.stringify([F.seq, F.region, filters]); if (LOGGED.has(key)) return;
  clearTimeout(logTimer);
  logTimer = setTimeout(() => { LOGGED.add(key); sb.from("search_log").insert({acft_seq:F.seq, region:F.region || "", filters, results:n}).then(() => {}, () => {}); }, 1500);
}
const wide = () => window.matchMedia("(min-width: 1024px), (min-width: 760px) and (orientation: landscape)").matches;
function tabs(which){ const t = (h, k, l) => `<a role="tab" href="${h}"${which === k ? ' aria-selected="true" class="on"' : ""}>${l}</a>`;
  return `<div class="seg" role="tablist" aria-label="Directory">${t("#/", "search", "Crew")}${t("#/operators", "ops", "Operators")}${t("#/aircraft", "browse", "By aircraft")}</div>`; }
function selectHTML(id, k, label, val, first){ return `<div class="f"><label for="${id}">${label}</label><select id="${id}"><option value="">${first}</option>${OPT[k].map(([v, l]) => `<option value="${v}"${v === val ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></div>`; }

async function viewFind(){
  if (!sb) { app.innerHTML = `<p class="err">The directory isn't available right now.</p>`; return; }
  const qs = new URLSearchParams((location.hash.split("?")[1]) || "");
  if (qs.has("acft")) { F = {...F, seq:+qs.get("acft")}; }
  app.innerHTML = `<div class="pagehead"><div><h1>Find crew</h1><p>Professional, type-current crew. Profiles are reviewed before they appear.</p></div>${tabs("search")}</div>
  <div class="quick" role="group" aria-label="Quick filters">${QUICK.map(([k, l]) => `<button type="button" class="pill" data-q="${k}">${esc(l)}</button>`).join("")}</div>
  <section class="panel filters" aria-label="Filters">
    <div class="fgrid">
      <div class="f acsearch"><label for="fa">Aircraft</label><input id="fa" type="search" autocomplete="off" placeholder="Any aircraft, e.g. Citation XLS"><div class="acres" id="fares" hidden></div></div>
    </div>
    <details class="more" id="more"><summary>More filters</summary><div class="fgrid" style="margin-top:12px">
      <div class="f"><label for="ft">Crew type</label><select id="ft"><option value="">Any crew</option>${CREW_TYPES.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join("")}</select></div>
      ${selectHTML("fr", "region", "Region", F.region, "Anywhere")}
      ${selectHTML("fc", "cert", "Certificate", F.cert, "Any certificate")}
      <div class="f"><label for="fv">Availability</label><select id="fv"><option value="">Any</option><option value="now">Available now</option><option value="soon">Now or with notice</option></select></div>
    </div></details>
    <div class="savebar"><label class="switch"><input type="checkbox" id="fp"> Part 135 current</label><button class="btn secondary" id="fx" type="button" style="margin-left:auto">Clear</button></div>
  </section>
  <div class="mdsplit"><div class="results" id="res" aria-live="polite"><p>Loading crew…</p></div><aside class="detail" id="det" aria-label="Selected profile"></aside></div>`;
  const ui = () => { $("fa").value = F.seq != null && BYSEQ.get(F.seq) ? BYSEQ.get(F.seq).name : ""; $("ft").value = F.type; $("fr").value = F.region; $("fc").value = F.cert; $("fv").value = F.avail; $("fp").checked = F.p135;
    app.querySelectorAll("[data-q]").forEach(b => { const k = b.dataset.q, on = k === "now" ? F.avail === "now" : k === "soon" ? F.avail === "soon" : k === "p135" ? F.p135 : k === "contract" ? F.contract : k === "cfi" ? F.type === "cfi" : F.type === "helicopter_pilot"; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); }); };
  if (wide() || F.type || F.region || F.cert || F.avail) $("more").open = true;
  let D; try { D = await loadDir(); } catch (e) { $("res").innerHTML = `<p class="err">Couldn't load the directory. Check your connection and try again.</p>`; return; }
  let active = null;
  const show = id => { active = id; const p = D.listed.find(x => x.user_id === id); $("det").innerHTML = p ? cardHTML(p, D.acBy.get(id) || [], D.mod.get(id)) : ""; app.querySelectorAll(".res").forEach(r => r.classList.toggle("on", r.dataset.id === id)); };
  const draw = () => {
    ui();
    const hits = D.listed.filter(p => matches(p, D.acBy.get(p.user_id) || [])).sort((a, b) => rank(b, D.acBy.get(b.user_id) || [], D.mod.get(b.user_id)) - rank(a, D.acBy.get(a.user_id) || [], D.mod.get(a.user_id)));
    const label = F.seq != null && BYSEQ.get(F.seq) ? " on the " + BYSEQ.get(F.seq).name : "";
    $("res").innerHTML = `<p class="count">${hits.length} crew${esc(label)}</p>` + (hits.length ? hits.map(p => resultHTML(p, D.acBy.get(p.user_id) || [], D.mod.get(p.user_id), p.user_id === active)).join("")
      : `<div class="panel"><p style="margin:0">No listed crew match yet. Try fewer filters${D.listed.length ? "" : ". The directory is new: profiles appear here once they're reviewed"}.</p><p style="margin:0"><a href="#/me">List yourself</a> · <a href="../#notify">Get notified</a></p></div>`);
    logSearch(hits.length);
    if (wide() && hits.length) show(hits.some(h => h.user_id === active) ? active : hits[0].user_id); else $("det").innerHTML = "";
  };
  $("res").addEventListener("click", e => { const r = e.target.closest(".res"); if (!r || !wide()) return; e.preventDefault(); show(r.dataset.id); });
  app.querySelector(".quick").addEventListener("click", e => { const b = e.target.closest("[data-q]"); if (!b) return; const k = b.dataset.q;
    if (k === "now" || k === "soon") F.avail = F.avail === k ? "" : k; else if (k === "p135") F.p135 = !F.p135; else if (k === "contract") F.contract = !F.contract;
    else if (k === "cfi") F.type = F.type === "cfi" ? "" : "cfi"; else if (k === "heli") F.type = F.type === "helicopter_pilot" ? "" : "helicopter_pilot"; draw(); });
  app.querySelector(".filters").addEventListener("change", e => { const t = e.target; if (t.id === "ft") F.type = t.value; if (t.id === "fr") F.region = t.value; if (t.id === "fc") F.cert = t.value; if (t.id === "fv") F.avail = t.value; if (t.id === "fp") F.p135 = t.checked; draw(); });
  $("fx").onclick = () => { F = {seq:null, type:"", region:"", cert:"", avail:"", p135:false, contract:false}; draw(); };
  const fa = $("fa"), fr = $("fares");
  fa.addEventListener("input", () => { const words = fa.value.toUpperCase().replace(/[-–]/g, " ").split(/\s+/).filter(Boolean);
    if (!words.length) { fr.hidden = true; if (F.seq != null) { F.seq = null; draw(); } return; }
    const cw = words.map(w => w.replace(/[^A-Z0-9]/g, ""));
    const hits = ACFT.filter(a => { const hay = (a.name + " " + a.alias + " " + a.engine + (a.heli ? " HELICOPTER" : "")).toUpperCase().replace(/[-–]/g, " "), hc = hay.replace(/[^A-Z0-9]/g, ""); return words.every((w, i) => hay.includes(w) || (cw[i] && hc.includes(cw[i]))); })
      .sort((x, y) => (D.count.get(y.seq) || 0) - (D.count.get(x.seq) || 0)).slice(0, 15);
    fr.innerHTML = hits.map(a => `<button type="button" data-f="${a.seq}">${esc(a.name)}<small>${D.count.get(a.seq) || 0} listed crew · ${esc(a.years)}</small></button>`).join("") || '<div style="padding:12px;color:var(--muted)">No match.</div>'; fr.hidden = false; });
  fr.addEventListener("click", e => { const b = e.target.closest("[data-f]"); if (!b) return; F.seq = +b.dataset.f; fr.hidden = true; draw(); });
  document.addEventListener("click", e => { if (!e.target.closest(".acsearch")) fr.hidden = true; });
  draw();
}

const CATS2 = [["jet","Jets"],["turboprop","Turboprops"],["ptwin","Piston twins"],["psingle","Piston singles"],["heli","Helicopters"]];
const catOf2 = a => a.heli ? "heli" : a.engine === "jet" ? "jet" : a.engine === "turboprop" ? "turboprop" : a.twin ? "ptwin" : "psingle";
const makeOf2 = a => /^Cessna/.test(a.make) ? "Cessna" : /^Bombardier/.test(a.make) ? "Bombardier" : /^Dassault/.test(a.make) ? "Dassault" : /^Embraer/.test(a.make) ? "Embraer" : a.make;
let BR = {cat:"", make:"", all:false};
async function viewBrowse(){
  if (!sb) { app.innerHTML = `<p class="err">The directory isn't available right now.</p>`; return; }
  app.innerHTML = `<div class="pagehead"><div><h1>Browse by aircraft</h1><p>Start from the aircraft you fly or operate and see who is current on it.</p></div>${tabs("browse")}</div><div id="br"><p>Loading…</p></div>`;
  let D, O; try { [D, O] = await Promise.all([loadDir(), loadOps()]); } catch (e) { $("br").innerHTML = `<p class="err">Couldn't load the directory.</p>`; return; }
  const draw = () => {
    const has = a => D.count.get(a.seq) || O.count.get(a.seq);
    const pool = ACFT.filter(a => (BR.all || has(a)) && (!BR.cat || catOf2(a) === BR.cat));
    const cats = CATS2.filter(([k]) => ACFT.some(a => catOf2(a) === k && (BR.all || has(a))));
    const makes = BR.cat ? [...new Set(pool.map(makeOf2))].sort((x, y) => x.localeCompare(y)) : [];
    const list = pool.filter(a => !BR.make || makeOf2(a) === BR.make).sort((x, y) => ((D.count.get(y.seq) || 0) + (O.count.get(y.seq) || 0)) - ((D.count.get(x.seq) || 0) + (O.count.get(x.seq) || 0)) || x.name.localeCompare(y.name));
    const tile = a => `<a class="mtile" href="#/a/${a.seq}"><span>${esc(a.name)}</span><small>${D.count.get(a.seq) || 0} crew${O.count.get(a.seq) ? " · " + O.count.get(a.seq) + " operator" + (O.count.get(a.seq) === 1 ? "" : "s") : ""} · ${esc(a.years)}</small></a>`;
    $("br").innerHTML = `<div class="browse">
      <div class="pills" role="group" aria-label="Category"><button type="button" class="pill${!BR.cat ? " on" : ""}" data-c="">All</button>${cats.map(([k, l]) => `<button type="button" class="pill${k === BR.cat ? " on" : ""}" data-c="${k}">${esc(l)}</button>`).join("")}</div>
      ${makes.length > 1 ? `<div class="pills makes" role="group" aria-label="Manufacturer"><button type="button" class="pill${!BR.make ? " on" : ""}" data-m="">All makers</button>${makes.map(m => `<button type="button" class="pill${m === BR.make ? " on" : ""}" data-m="${esc(m)}">${esc(m)}</button>`).join("")}</div>` : ""}
      <label class="switch"><input type="checkbox" id="ball"${BR.all ? " checked" : ""}> Show all ${ACFT.length} aircraft, including ones with no listed crew yet</label>
      ${list.length ? `<div class="mtiles">${list.slice(0, 300).map(tile).join("")}</div>` : `<p style="margin:0">No listed crew yet${BR.cat ? " in this category" : ""}. Profiles appear once they're reviewed. <a href="#/me">List yourself</a></p>`}
    </div>`;
  };
  $("br").addEventListener("click", e => { const c = e.target.closest("[data-c]"), m = e.target.closest("[data-m]");
    if (c) { BR.cat = c.dataset.c; BR.make = ""; draw(); } else if (m) { BR.make = m.dataset.m; draw(); } });
  $("br").addEventListener("change", e => { if (e.target.id === "ball") { BR.all = e.target.checked; BR.make = ""; draw(); } });
  draw();
}

async function viewAircraft(seq, which){
  const a = BYSEQ.get(seq);
  if (!a) { app.innerHTML = `<div class="center"><h1>Aircraft not found</h1><a class="btn secondary" href="#/aircraft">Browse by aircraft</a></div>`; return; }
  document.title = a.name + " crew · Cali Aircrew";
  const cat = (CATS2.find(([k]) => k === catOf2(a)) || ["", ""])[1];
  const facts = [["Category", cat], ["Engines", a.heli ? (a.engine === "piston" ? "Piston" : "Turbine") + (a.twin ? " twin" : " single") : (a.engine === "piston" ? "Piston" : a.engine === "turboprop" ? "Turboprop" : "Jet") + (a.twin ? " twin" : " single")], ["Years", a.years]];
  app.innerHTML = `<nav aria-label="Breadcrumb" class="crumbs"><a href="#/aircraft">Aircraft</a> › <span>${esc(cat)}</span> › <span aria-current="page">${esc(a.name)}</span></nav>
  <div class="acbanner"><div><h1>${esc(a.name)}</h1></div><div class="facts">${facts.map(([k, v]) => `<div><span>${k}</span><b>${esc(v)}</b></div>`).join("")}</div></div>
  <div class="seg" role="tablist" aria-label="On this aircraft" style="margin:16px 0"><a role="tab"${which !== "ops" ? ' class="on" aria-selected="true"' : ""} href="#/a/${seq}">Crew on this aircraft</a><a role="tab"${which === "ops" ? ' class="on" aria-selected="true"' : ""} href="#/a/${seq}/ops">Operators flying it</a></div>
  <div class="acpage"><section class="panel" style="flex:999 1 520px;min-width:0"><div id="acrew"><p>Loading crew…</p></div></section>
    <div style="flex:1 1 300px;display:flex;flex-direction:column;gap:16px">
      <section class="panel"><h2>Checklist</h2><p class="hint" style="font-size:16px">${a.heli ? "Helicopter checklists are coming next. You can start one now from your own lines." : "Start from this aircraft's default and make it yours. Verify against your AFM/POH."}</p><a class="btn secondary" href="../checklists/#acft=${seq}">Build a checklist</a></section>
      <section class="panel"><h2>Fly this aircraft?</h2><p class="hint" style="font-size:16px">Add it to your free crew profile so owners can find you.</p><a class="btn primary" href="#/me">I fly this aircraft</a></section>
      <section class="panel"><h2>Training</h2><p class="hint" style="font-size:16px">Training partners for this type will appear here.</p><a href="../#partners">Become a partner</a></section>
    </div></div>`;
  if (which === "ops") {
    let O; try { O = await loadOps(); } catch (e) { $("acrew").innerHTML = `<p class="err">Couldn't load operators.</p>`; return; }
    const hits = O.listed.filter(o => (O.acBy.get(o.user_id) || []).some(x => x.acft_seq === seq)).sort((x, y) => (y.open_to_contract ? 1 : 0) - (x.open_to_contract ? 1 : 0));
    $("acrew").innerHTML = `<h2 style="margin:0 0 8px;font:700 26px/1.1 var(--display);color:var(--ink)">Operators flying this aircraft</h2><p class="count">${hits.length} listed operator${hits.length === 1 ? "" : "s"}</p>` +
      (hits.length ? hits.map(o => opResultHTML(o, O.acBy.get(o.user_id) || [], seq)).join("") : `<p style="margin:0">No listed operators for this aircraft yet. <a href="#/op">Operate one? List it.</a></p>`);
    return;
  }
  let D; try { D = await loadDir(); } catch (e) { $("acrew").innerHTML = `<p class="err">Couldn't load crew.</p>`; return; }
  const saved = F; F = {seq, type:"", region:"", cert:"", avail:"", p135:false, contract:false};
  const hits = D.listed.filter(p => (D.acBy.get(p.user_id) || []).some(x => x.acft_seq === seq)).sort((x, y) => rank(y, D.acBy.get(y.user_id) || [], D.mod.get(y.user_id)) - rank(x, D.acBy.get(x.user_id) || [], D.mod.get(x.user_id)));
  $("acrew").innerHTML = `<h2 style="margin:0 0 8px;font:700 26px/1.1 var(--display);color:var(--ink)">Crew current on this aircraft</h2><p class="count">${hits.length} listed crew</p>` +
    (hits.length ? hits.slice(0, 8).map(p => resultHTML(p, D.acBy.get(p.user_id) || [], D.mod.get(p.user_id))).join("") + (hits.length > 8 ? `<a class="btn primary" href="#/?acft=${seq}">See all ${hits.length} crew</a>` : "")
      : `<p style="margin:0">No listed crew on this aircraft yet. <a href="#/me">Fly it? List yourself.</a></p>`);
  F = saved;
}

async function viewProfile(id){
  app.innerHTML = `<p>Loading profile…</p>`;
  if (!sb) { app.innerHTML = `<p class="err">The directory isn't available right now.</p>`; return; }
  const [{data:p}, {data:ac}, {data:mod}] = await Promise.all([
    sb.from("crew_profiles").select("*").eq("user_id", id).maybeSingle(),
    sb.from("crew_aircraft").select("*").eq("user_id", id),
    sb.from("moderation").select("*").eq("user_id", id).maybeSingle()]);
  if (!p) { app.innerHTML = `<div class="center"><h1>Profile not found</h1><p>It may be unpublished or waiting for review.</p><a class="btn secondary" href="#/">Back to the crew directory</a></div>`; return; }
  document.title = (p.display_name || "Crew profile") + " · Cali Aircrew";
  app.innerHTML = `<div style="max-width:720px;margin:0 auto;display:flex;flex-direction:column;gap:16px"><a href="javascript:history.length>1?history.back():location.hash='#/'">← Back</a>${cardHTML(p, ac || [], mod)}</div>`;
}

async function viewMe(){
  if (!sb) { app.innerHTML = `<p class="err">Sign-in isn't available right now.</p>`; return; }
  if (!user) {
    app.innerHTML = `<div class="center"><h1>Your crew profile</h1><p>Sign in to create your free profile. You choose when owners and operators can see it.</p><button class="btn primary" id="go" type="button">Sign in</button></div>`;
    $("go").onclick = () => signIn(route); return;
  }
  if (await needMfa()) {
    app.innerHTML = `<div class="center"><h1>One more step</h1><p>Two-step sign-in is on for this account. Enter your Microsoft Authenticator code to edit your profile.</p><button class="btn primary" id="go" type="button">Enter code</button></div>`;
    $("go").onclick = () => signIn(route); return;
  }
  app.innerHTML = `<p>Loading your profile…</p>`;
  const uid = user.id;
  const [{data:p0}, {data:ac0}, {data:mod}, pendRes] = await Promise.all([
    sb.from("crew_profiles").select("*").eq("user_id", uid).maybeSingle(),
    sb.from("crew_aircraft").select("*").eq("user_id", uid),
    sb.from("moderation").select("*").eq("user_id", uid).maybeSingle(),
    sb.from("crew_bio_pending").select("bio").eq("user_id", uid).maybeSingle()]);
  const privRes = await sb.from("crew_private").select("*").eq("user_id", uid).maybeSingle();
  const PV = Object.assign({legal_first:"", legal_last:"", faa_city:"", faa_state:""}, privRes && !privRes.error && privRes.data ? privRes.data : {});
  const publicBio = (p0 && p0.bio) || "";
  let pendingBio = pendRes && !pendRes.error && pendRes.data ? pendRes.data.bio : null;   // null = nothing waiting (or review not switched on yet)
  const P = Object.assign({display_name:"", crew_types:[], certificate:"", headline:"", home_base:"", travel:"", experience:"", bio:"", total_time:null, availability:"", published:false, details:{}}, p0 || {});
  if (pendingBio != null) P.bio = pendingBio;
  P.details = Object.assign({role:"", cert:"", ratings:[], medical:"", region:"", airport:"", status:"", looking:[], travel:"", passport:false, experience:[], languages:[]}, P.details || {});
  let AC = (ac0 || []).map(a => ({acft_seq:a.acft_seq, type_rated:!!a.type_rated, is_current:!!a.is_current, current_until:a.current_until || null, training_school:a.training_school || "", training_other:a.training_other || "", hours:a.hours, part135:a.part135 || ""}));
  let dirty = false;
  const statusOf = () => {
    if (!p0) return ["", "Not saved yet"];
    if (!P.published) return ["", "Draft: only you can see it"];
    if (mod && mod.hidden) return ["warn", "Hidden by Cali Aircrew. Contact us"];
    if (mod && mod.approved) return ["ok", "Published and listed"];
    return ["warn", "Published: waiting for review"];
  };
  const field = (id, label, val, attrs) => `<div class="f"><label for="${id}">${label}</label><input id="${id}" value="${esc(val ?? "")}" ${attrs || ""}></div>`;
  const D = P.details;
  const sel = (id, k, label, val, first) => `<div class="f"><label for="${id}">${label}</label><select id="${id}"><option value="">${first || "Choose…"}</option>${OPT[k].map(([v, l]) => `<option value="${v}"${v === val ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></div>`;
  const multi = (name, k, label, vals) => `<div class="f"><span class="lbl" id="l-${name}">${label}</span><div class="chips" role="group" aria-labelledby="l-${name}">${OPT[k].map(([v, l]) => `<label><input type="checkbox" name="${name}" value="${v}"${(vals || []).includes(v) ? " checked" : ""}> ${esc(l)}</label>`).join("")}</div></div>`;
  app.innerHTML = `
  <div class="pagehead"><div><h1>My crew profile</h1><p>Signed in as ${esc(user.email || "")}. Mostly taps: choose what fits, then Save.</p></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn secondary" href="#/op">Operator profile</a><button class="btn secondary toggleprev" id="tp" type="button">Preview</button><button class="btn secondary" id="so" type="button">Sign out</button></div></div>
  <div class="split" id="split">
   <div class="formcol">
    <section class="panel" aria-labelledby="h1a"><h2 id="h1a">About you</h2>
      <div class="grid2"><div class="f"><label for="dn">Name shown on your profile</label><input id="dn" value="${esc(P.display_name)}" maxlength="80" placeholder="e.g. Jordan R." autocomplete="name"></div>${sel("role", "role", "Role", D.role)}</div>
      <div class="grid2">${sel("cert", "cert", "Certificate", D.cert)}${sel("med", "medical", "FAA medical", D.medical)}</div>
      ${multi("rt", "ratings", "Ratings (tap all that apply)", D.ratings)}
      <div class="f"><span class="lbl" id="ctl">Crew type</span><div class="chips" role="group" aria-labelledby="ctl">${CREW_TYPES.map(([v, l]) => `<label><input type="checkbox" name="ct" value="${v}"${P.crew_types.includes(v) ? " checked" : ""}> ${esc(l)}</label>`).join("")}</div></div>
    </section>
    <section class="panel" aria-labelledby="h1h"><h2 id="h1h">Home base</h2>
      <div class="grid2">${sel("reg", "region", "Region", D.region)}<div class="f"><label for="apt">Airport (optional)</label><input id="apt" value="${esc(D.airport)}" maxlength="8" placeholder="e.g. VNY" autocapitalize="characters"></div></div>
    </section>
    <section class="panel" aria-labelledby="h1b"><h2 id="h1b">Aircraft and time</h2>
      <p class="hint">Add each aircraft you are current on. Owners search by exact type.</p>
      <div class="f acsearch"><label for="acq">Add an aircraft</label><input id="acq" type="search" autocomplete="off" placeholder="Type to search, e.g. Citation XLS, King Air 350"><div class="acres" id="acres" hidden></div></div>
      <div><button class="btn secondary" id="brw" type="button" aria-expanded="false" aria-controls="acbrowse">Browse the list</button></div>
      <div id="acbrowse" class="browse" hidden></div>
      <p class="hint" style="margin:0">Can't find your aircraft? <a href="#" id="acreq">Request it</a></p>
      <div id="aclist"></div>
      <div class="grid2"><div class="f"><label for="tt">Total time (hours)</label><input id="tt" value="${P.total_time ?? ""}" inputmode="numeric" placeholder="e.g. 6800"></div></div>
    </section>
    <section class="panel" aria-labelledby="h1c"><h2 id="h1c">Availability</h2>
      <div class="grid2">${sel("stat", "status", "Status", D.status)}${sel("trv", "travel", "Will travel", D.travel)}</div>
      ${multi("lk", "looking", "Looking for (tap all that apply)", D.looking)}
      <label class="switch"><input type="checkbox" id="pp"${D.passport ? " checked" : ""}> I have a valid passport</label>
    </section>
    <section class="panel" aria-labelledby="h1e"><h2 id="h1e">Experience</h2>
      ${multi("xp", "experience", "Tap all that apply", D.experience)}
      ${multi("lg", "languages", "Languages (optional)", D.languages)}
    </section>
    <section class="panel" aria-labelledby="h1v"><h2 id="h1v">FAA verification (private)</h2>
      <p class="hint">Used only by Cali Aircrew to check your certificate in the FAA airmen registry for the <b>FAA verified</b> badge. Never shown on your profile. Enter it exactly as on your FAA certificate.</p>
      <div class="grid2"><div class="f"><label for="lf">Legal first name</label><input id="lf" maxlength="60" autocomplete="given-name" value="${esc(PV.legal_first)}"></div><div class="f"><label for="ll">Legal last name</label><input id="ll" maxlength="60" autocomplete="family-name" value="${esc(PV.legal_last)}"></div></div>
      <div class="grid2"><div class="f"><label for="fc">City on your FAA address</label><input id="fc" maxlength="60" value="${esc(PV.faa_city)}"></div><div class="f"><label for="fs">State</label><select id="fs"><option value="">Choose…</option><option value="AL">AL</option><option value="AK">AK</option><option value="AZ">AZ</option><option value="AR">AR</option><option value="CA">CA</option><option value="CO">CO</option><option value="CT">CT</option><option value="DE">DE</option><option value="DC">DC</option><option value="FL">FL</option><option value="GA">GA</option><option value="HI">HI</option><option value="ID">ID</option><option value="IL">IL</option><option value="IN">IN</option><option value="IA">IA</option><option value="KS">KS</option><option value="KY">KY</option><option value="LA">LA</option><option value="ME">ME</option><option value="MD">MD</option><option value="MA">MA</option><option value="MI">MI</option><option value="MN">MN</option><option value="MS">MS</option><option value="MO">MO</option><option value="MT">MT</option><option value="NE">NE</option><option value="NV">NV</option><option value="NH">NH</option><option value="NJ">NJ</option><option value="NM">NM</option><option value="NY">NY</option><option value="NC">NC</option><option value="ND">ND</option><option value="OH">OH</option><option value="OK">OK</option><option value="OR">OR</option><option value="PA">PA</option><option value="RI">RI</option><option value="SC">SC</option><option value="SD">SD</option><option value="TN">TN</option><option value="TX">TX</option><option value="UT">UT</option><option value="VT">VT</option><option value="VA">VA</option><option value="WA">WA</option><option value="WV">WV</option><option value="WI">WI</option><option value="WY">WY</option><option value="PR">PR</option><option value="GU">GU</option><option value="VI">VI</option><option value="XX">Outside the US</option></select></div></div>
    </section>
    <section class="panel" aria-labelledby="h1f"><h2 id="h1f">Anything else (optional)</h2>
      <div class="f"><label for="bio">A few words owners should know</label><textarea id="bio" maxlength="2000" placeholder="Optional.">${esc(P.bio)}</textarea><small>No phone numbers or email here. Owners will contact you through Cali Aircrew messaging. Changes to this text are reviewed before they show publicly.</small><span class="status warn" id="pendnote"${pendingBio != null ? "" : " hidden"}>Your new text is waiting for review. Owners see your previous text until then.</span></div>
    </section>
    <section class="panel" aria-labelledby="h1d"><h2 id="h1d">Publish</h2>
      <label class="switch"><input type="checkbox" id="pub"${P.published ? " checked" : ""}> Show my profile in the crew directory</label>
      <p class="hint">New profiles are reviewed by Cali Aircrew before they appear. You can unpublish at any time.</p>
      <div class="savebar"><button class="btn primary" id="save" type="button">Save profile</button><span id="st"></span><span class="err" id="se" role="status"></span></div>
    </section>
   </div>
   <aside class="prevcol" aria-label="Live preview" id="prev"></aside>
  </div>`;
  $("fs").value = PV.faa_state || "";
  const checked = n => [...app.querySelectorAll(`input[name=${n}]:checked`)].map(i => i.value);
  const read = () => {
    Object.assign(PV, {legal_first:$("lf").value.trim(), legal_last:$("ll").value.trim(), faa_city:$("fc").value.trim(), faa_state:$("fs").value});
    P.display_name = $("dn").value.trim();
    Object.assign(D, {role:$("role").value, cert:$("cert").value, medical:$("med").value, ratings:checked("rt"), region:$("reg").value, airport:$("apt").value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8),
      status:$("stat").value, travel:$("trv").value, looking:checked("lk"), passport:$("pp").checked, experience:checked("xp"), languages:checked("lg")});
    P.crew_types = checked("ct");
    const tt = $("tt").value.replace(/[^\d]/g, ""); P.total_time = tt ? Math.min(100000, +tt) : null;
    P.bio = $("bio").value.trim(); P.published = $("pub").checked;
    // plain-text copies for older pages and simple display
    P.certificate = [lbl("cert", D.cert), ...D.ratings.map(r => lbl("ratings", r))].filter(Boolean).join(", ").slice(0, 80);
    P.headline = lbl("role", D.role); P.home_base = [D.airport, lbl("region", D.region)].filter(Boolean).join(" · ").slice(0, 80);
    P.availability = [lbl("status", D.status), ...D.looking.map(v => lbl("looking", v))].filter(Boolean).join(", ").slice(0, 200);
    P.travel = lbl("travel", D.travel); P.experience = D.experience.map(v => lbl("experience", v)).join(", ").slice(0, 200);
    P.details = D;
  };
  const drawStatus = () => { const [k, t] = statusOf(); $("st").innerHTML = `<span class="status ${k}">${esc(t)}${dirty ? " · unsaved changes" : ""}</span>`; };
  const drawPrev = () => { read(); $("prev").innerHTML = cardHTML(P, AC, mod, {preview:true}); };
  const drawAc = () => {
    $("aclist").innerHTML = AC.length ? AC.map((a, i) => { const info = BYSEQ.get(a.acft_seq); return `<div class="acrow"><span class="nm">${esc(info ? info.name : "Aircraft #" + a.acft_seq)}</span>
      <label class="tr"><input type="checkbox" data-tr="${i}"${a.type_rated ? " checked" : ""}> Type rated</label>
      <label class="tr"><input type="checkbox" data-cur="${i}"${a.is_current ? " checked" : ""}> Current</label>
      <input class="hrs" data-hr="${i}" inputmode="numeric" placeholder="Hours" aria-label="Hours in ${esc(info ? info.name : "")}" value="${a.hours ?? ""}">
      <select class="p135" data-p135="${i}" aria-label="Part 135 currency in ${esc(info ? info.name : "")}"><option value=""${!a.part135 ? " selected" : ""}>Not 135 current</option><option value="SIC"${a.part135 === "SIC" ? " selected" : ""}>135 current · SIC</option><option value="PIC"${a.part135 === "PIC" ? " selected" : ""}>135 current · PIC</option></select>
      <button class="iconbtn" type="button" data-rm="${i}" aria-label="Remove ${esc(info ? info.name : "aircraft")}">✕</button>
      ${a.is_current ? `<div class="acsub"><div class="f"><label for="cu${i}">Current through</label><input type="month" id="cu${i}" data-cu="${i}" value="${esc(ym(a.current_until))}" min="2000-01" max="2040-12"></div>
        <div class="f"><label for="sc${i}">Training school</label><select id="sc${i}" data-sc="${i}"><option value="">Choose…</option>${OPT.school.map(([v, l]) => `<option value="${v}"${v === a.training_school ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></div>
        ${a.training_school === "other" ? `<div class="f"><label for="so${i}">School name</label><input id="so${i}" data-so="${i}" maxlength="60" value="${esc(a.training_other)}" placeholder="e.g. company or instructor"></div>` : ""}
        ${curState(a) === "expired" ? `<p class="err" style="margin:0;align-self:end">This date has passed, so the aircraft shows as currency expired.</p>` : ""}</div>` : ""}</div>`; }).join("") : '<p class="empty" style="margin:0">No aircraft yet.</p>';
  };
  const changed = () => { dirty = true; drawPrev(); drawStatus(); };
  drawAc(); drawPrev(); drawStatus();
  app.querySelector(".formcol").addEventListener("input", e => {
    const t = e.target;
    if (t.dataset.hr != null) { const v = t.value.replace(/[^\d]/g, ""); AC[+t.dataset.hr].hours = v ? Math.min(50000, +v) : null; }
    if (t.dataset.so != null) AC[+t.dataset.so].training_other = t.value.slice(0, 60);
    if (t.id !== "acq") changed();
  });
  app.querySelector(".formcol").addEventListener("change", e => { const t = e.target; if (t.dataset.p135 != null) { AC[+t.dataset.p135].part135 = t.value; changed(); } else if (t.dataset.tr != null) { AC[+t.dataset.tr].type_rated = t.checked; changed(); } else if (t.dataset.cur != null) { AC[+t.dataset.cur].is_current = t.checked; drawAc(); changed(); }
    else if (t.dataset.cu != null) { AC[+t.dataset.cu].current_until = t.value ? t.value + "-01" : null; drawAc(); changed(); }
    else if (t.dataset.sc != null) { AC[+t.dataset.sc].training_school = t.value; if (t.value !== "other") AC[+t.dataset.sc].training_other = ""; drawAc(); changed(); } else if (t.tagName === "SELECT" || t.type === "checkbox") changed(); });
  $("aclist").addEventListener("click", e => { const b = e.target.closest("[data-rm]"); if (!b) return; AC.splice(+b.dataset.rm, 1); drawAc(); if (!$("acbrowse").hidden) drawBrowse(); changed(); });
  /* browse: category -> manufacturer -> model tiles; tap to add or remove */
  const CATS = [["jet","Jets"],["turboprop","Turboprops"],["ptwin","Piston twins"],["psingle","Piston singles"],["heli","Helicopters"]];
  const catOf = a => a.heli ? "heli" : a.engine === "jet" ? "jet" : a.engine === "turboprop" ? "turboprop" : a.twin ? "ptwin" : "psingle";
  const makeOf = a => /^Cessna/.test(a.make) ? "Cessna" : /^Bombardier/.test(a.make) ? "Bombardier" : /^Dassault/.test(a.make) ? "Dassault" : /^Embraer/.test(a.make) ? "Embraer" : a.make;
  let bcat = null, bmake = null;
  const drawBrowse = () => {
    const box = $("acbrowse"), have = new Set(AC.map(a => a.acft_seq));
    const cats = CATS.filter(([k]) => ACFT.some(a => catOf(a) === k));
    let h = `<div class="pills" role="group" aria-label="Aircraft category">${cats.map(([k, l]) => `<button type="button" class="pill${k === bcat ? " on" : ""}" data-cat="${k}" aria-pressed="${k === bcat}">${esc(l)}</button>`).join("")}</div>`;
    if (bcat) {
      const makes = [...new Set(ACFT.filter(a => catOf(a) === bcat).map(makeOf))].sort((x, y) => x.localeCompare(y));
      h += `<div class="pills makes" role="group" aria-label="Manufacturer">${makes.map(m => `<button type="button" class="pill${m === bmake ? " on" : ""}" data-make="${esc(m)}" aria-pressed="${m === bmake}">${esc(m)}</button>`).join("")}</div>`;
      if (bmake) {
        const list = ACFT.filter(a => catOf(a) === bcat && makeOf(a) === bmake);
        h += `<div class="mtiles">${list.map(a => { const on = have.has(a.seq); return `<button type="button" class="mtile${on ? " on" : ""}" data-tog="${a.seq}" aria-pressed="${on}"><span>${esc(a.name.replace(new RegExp("^" + bmake.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s+"), ""))}</span><small>${on ? "✓ Added" : "＋ Add"} · ${esc(a.years)}</small></button>`; }).join("")}</div>`;
      } else h += `<p class="hint">Pick a manufacturer.</p>`;
    }
    box.innerHTML = h;
  };
  $("brw").onclick = () => { const box = $("acbrowse"); box.hidden = !box.hidden; $("brw").setAttribute("aria-expanded", String(!box.hidden)); $("brw").textContent = box.hidden ? "Browse the list" : "Close the list"; if (!box.hidden) drawBrowse(); };
  $("acbrowse").addEventListener("click", e => {
    const c = e.target.closest("[data-cat]"), m = e.target.closest("[data-make]"), t = e.target.closest("[data-tog]");
    if (c) { bcat = c.dataset.cat === bcat ? null : c.dataset.cat; bmake = null; drawBrowse(); return; }
    if (m) { bmake = m.dataset.make === bmake ? null : m.dataset.make; drawBrowse(); return; }
    if (t) { const seq = +t.dataset.tog, i = AC.findIndex(a => a.acft_seq === seq); if (i >= 0) AC.splice(i, 1); else AC.push({acft_seq:seq, type_rated:false, is_current:false, current_until:null, training_school:"", training_other:"", hours:null, part135:""}); drawAc(); drawBrowse(); changed(); }
  });
  const q = $("acq"), res = $("acres");
  q.addEventListener("input", () => {
    const words = q.value.toUpperCase().replace(/[-–]/g, " ").split(/\s+/).filter(Boolean);
    if (!words.length) { res.hidden = true; return; }
    const have = new Set(AC.map(a => a.acft_seq));
    const cw = words.map(w => w.replace(/[^A-Z0-9]/g, ""));
    const hits = ACFT.filter(a => { if (have.has(a.seq)) return false; const hay = (a.name + " " + a.alias + " " + a.engine + (a.heli ? " HELICOPTER" : "")).toUpperCase().replace(/[-–]/g, " "), hc = hay.replace(/[^A-Z0-9]/g, ""); return words.every((w, i) => hay.includes(w) || (cw[i] && hc.includes(cw[i]))); }).slice(0, 20);
    res.innerHTML = hits.length ? hits.map(a => `<button type="button" data-add="${a.seq}">${esc(a.name)}<small>${esc(a.years)} · ${a.heli ? "Helicopter · " + (a.engine === "piston" ? "piston" : "turbine") : a.engine[0].toUpperCase() + a.engine.slice(1)}${a.twin ? " · twin" : ""}</small></button>`).join("") : '<div style="padding:12px;color:var(--muted)">No match. Try a shorter name.</div>';
    res.hidden = false;
  });
  res.addEventListener("click", e => { const b = e.target.closest("[data-add]"); if (!b) return; AC.push({acft_seq:+b.dataset.add, type_rated:false, is_current:false, current_until:null, training_school:"", training_other:"", hours:null, part135:""}); q.value = ""; res.hidden = true; drawAc(); changed(); const last = app.querySelector(`[data-hr="${AC.length - 1}"]`); if (last) last.focus(); });
  document.addEventListener("click", e => { if (!e.target.closest(".acsearch")) res.hidden = true; });
  $("acreq").onclick = e => { e.preventDefault();
    const m = modal(`<h2>Request an aircraft</h2><p class="hint" style="margin:0">Tell us the make and model (and anything that helps, like years or variant). We'll add it to the list.</p><div class="f"><label for="rq">Aircraft</label><textarea id="rq" maxlength="200" style="min-height:90px" placeholder="e.g. Pilatus PC-24 (2024 avionics)"></textarea></div><div class="err" id="rqm" role="status"></div><div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn primary" id="rqs" type="button">Send request</button><button class="btn secondary" id="rqx" type="button">Cancel</button></div>`);
    m.querySelector("#rqx").onclick = () => m.remove(); m.querySelector("#rq").focus();
    m.querySelector("#rqs").onclick = async () => { const t = m.querySelector("#rq").value.trim(); if (t.length < 3) { m.querySelector("#rqm").textContent = "Type the aircraft name."; return; }
      const {error} = await sb.from("aircraft_requests").insert({request:t}); if (error) { m.querySelector("#rqm").textContent = "Couldn't send it right now. Please try again later."; return; }
      m.querySelector(".box2").innerHTML = `<h2>Thanks!</h2><p style="margin:0">We'll review it and add it to the list.</p><button class="btn primary" type="button" id="rqok">Done</button>`; m.querySelector("#rqok").onclick = () => m.remove(); }; };
  $("tp").onclick = () => { const s = $("split"); s.classList.toggle("showprev"); $("tp").textContent = s.classList.contains("showprev") ? "Edit" : "Preview"; window.scrollTo(0, 0); };
  $("so").onclick = async () => { await sb.auth.signOut(); location.hash = "#/"; };
  $("save").onclick = async () => {
    read(); $("se").textContent = "";
    if (P.published && !P.display_name) { $("se").textContent = "Add the name shown on your profile before publishing."; $("dn").focus(); return; }
    if (P.published && !AC.length) { $("se").textContent = "Add at least one aircraft before publishing."; q.focus(); return; }
    const b = $("save"); b.disabled = true; b.textContent = "Saving…";
    try {
      if (await needMfa()) { b.disabled = false; b.textContent = "Save profile"; signIn(() => $("save").click()); return; }
      const row = {user_id:uid, published:P.published, display_name:P.display_name, crew_types:P.crew_types, certificate:P.certificate, headline:P.headline, home_base:P.home_base, travel:P.travel, experience:P.experience, bio:P.bio, total_time:P.total_time, availability:P.availability, details:P.details};
      let r1 = await sb.from("crew_profiles").upsert(row, {onConflict:"user_id"});
      if (r1.error && /details/i.test(r1.error.message || "")) { const {details, ...plain} = row; r1 = await sb.from("crew_profiles").upsert(plain, {onConflict:"user_id"}); if (!r1.error) $("se").textContent = "Saved. Some choices will be kept once the Cali Aircrew setup step is finished."; }
      if (r1.error) throw r1.error;
      // Free text: with review switched on (database update 007), new text waits in crew_bio_pending.
      if (P.bio !== publicBio) {
        const rp = await sb.from("crew_bio_pending").upsert({user_id:uid, bio:P.bio}, {onConflict:"user_id"});
        pendingBio = rp.error ? null : P.bio;
      } else if (pendingBio != null) { await sb.from("crew_bio_pending").delete().eq("user_id", uid); pendingBio = null; }
      if ($("pendnote")) $("pendnote").hidden = pendingBio == null;
      // Private FAA-verification details (database update 010); saved quietly, skipped if not set up yet.
      if (PV.legal_first || PV.legal_last || PV.faa_city || PV.faa_state || (privRes && privRes.data))
        await sb.from("crew_private").upsert({user_id:uid, legal_first:PV.legal_first, legal_last:PV.legal_last, faa_city:PV.faa_city, faa_state:PV.faa_state}, {onConflict:"user_id"}).then(() => {}, () => {});
      const r2 = await sb.from("crew_aircraft").delete().eq("user_id", uid); if (r2.error) throw r2.error;
      if (AC.length) {
        // Newer columns (part135 from 004, is_current from 005) are dropped one by one if the database hasn't been upgraded yet.
        const cols = ["part135", "is_current", "current_until", "training_school", "training_other"], skipped = [];
        const rowsOf = () => AC.map(a => { const r = {user_id:uid, acft_seq:a.acft_seq, type_rated:a.type_rated, hours:a.hours, part135:a.part135 || "", is_current:!!a.is_current,
          current_until:a.is_current ? (a.current_until || null) : null, training_school:a.is_current ? (a.training_school || "") : "", training_other:a.is_current && a.training_school === "other" ? (a.training_other || "").trim() : ""}; skipped.forEach(k => delete r[k]); return r; });
        let r3 = await sb.from("crew_aircraft").insert(rowsOf());
        for (let tries = 0; r3.error && tries < cols.length; tries++) {
          const miss = cols.find(k => !skipped.includes(k) && new RegExp(k, "i").test(r3.error.message || "")); if (!miss) break;
          skipped.push(miss); r3 = await sb.from("crew_aircraft").insert(rowsOf());
        }
        if (!r3.error && skipped.length) $("se").textContent = "Saved, but " + [...new Set(skipped.map(k => k === "part135" ? "Part 135" : k === "is_current" ? "Current" : "currency details"))].join(" and ") + " isn't switched on yet (Cali Aircrew setup step pending).";
        if (r3.error) throw r3.error; }
      dirty = false; Object.assign(P, row); if (!p0) { const note = $("se").textContent; await viewMe(); if (note && $("se")) $("se").textContent = note; return; }
      drawStatus(); $("se").textContent = "";
      const ok = document.createElement("span"); ok.className = "status ok"; ok.textContent = "Saved"; $("st").appendChild(ok); setTimeout(() => ok.remove(), 2500);
    } catch (e) { $("se").textContent = "Not saved: " + ((e && e.message) || "check your connection and try again."); }
    finally { b.disabled = false; b.textContent = "Save profile"; }
  };
  window.onbeforeunload = () => dirty ? "You have unsaved changes." : undefined;
}

/* ---------------- operators ---------------- */
let OPS = null;
async function loadOps(force){
  if (OPS && !force && Date.now() - OPS.at < 60000) return OPS;
  const [{data:ps, error:e1}, {data:acs}, {data:mods}] = await Promise.all([
    sb.from("operator_profiles").select("*"), sb.from("operator_aircraft").select("*"), sb.from("moderation").select("*")]);
  if (e1) throw e1;
  const mod = new Map((mods || []).map(m => [m.user_id, m]));
  const acBy = new Map(); (acs || []).forEach(a => { if (!acBy.has(a.user_id)) acBy.set(a.user_id, []); acBy.get(a.user_id).push(a); });
  const listed = (ps || []).filter(o => { const m = mod.get(o.user_id); return o.published && m && m.op_approved && !m.op_hidden; });
  const count = new Map(); listed.forEach(o => (acBy.get(o.user_id) || []).forEach(a => count.set(a.acft_seq, (count.get(a.acft_seq) || 0) + 1)));
  OPS = {at:Date.now(), listed, acBy, mod, count};
  return OPS;
}
const opName = o => (o.details || {}).private || !o.name ? "Private owner" : o.name;
function opCardHTML(o, aircraft, opts){
  const d = o.details || {}, chips = (k, arr) => (arr || []).map(v => lbl(k, v)).filter(Boolean).map(t => `<span class="badge">${esc(t)}</span>`).join("");
  const base = [d.airport, lbl("region", d.region)].filter(Boolean).join(" · ");
  const ac = (aircraft || []).map(a => ({...a, info:BYSEQ.get(a.acft_seq)})).filter(a => a.info);
  const block = (t, h) => h ? `<section><h3>${t}</h3><div class="chips2">${h}</div></section>` : "";
  return `<article class="pcard" aria-label="Operator profile">
    <div class="top"><div class="avatar" aria-hidden="true">✈</div><div><h2>${esc(opName(o)) || '<span class="empty">Name</span>'}</h2>
      <div class="meta">${esc(lbl("opkind", o.kind)) || '<span class="empty">Type of operator</span>'}</div>
      <div class="meta">${base ? "Based in " + esc(base) : '<span class="empty">Home base</span>'}</div></div></div>
    ${o.open_to_contract ? `<div class="badges"><span class="badge ok">✓ Open to contract crew</span></div>` : ""}
    <section><h3>Aircraft</h3>${ac.length ? ac.map(a => `<div class="row"><span>${esc(a.info.name)}</span><b>${a.how_many > 1 ? "× " + a.how_many : ""}</b></div>`).join("") : '<p class="empty">Add the aircraft you operate.</p>'}</section>
    ${block("Looking for", chips("oplook", d.looking))}
    ${block("Operations", chips("opops", d.ops) + chips("opwork", d.work))}
    ${o.about ? `<section><h3>About</h3><p>${esc(o.about)}</p></section>` : ""}
    <div class="actions"><button class="btn primary" type="button" disabled title="Messaging opens soon" style="opacity:.6">Message (coming soon)</button></div>
    <div class="note">${opts && opts.preview ? "Preview: this is how crew will see your operator profile." : "Cali Aircrew is a directory, not a broker. Verify operators before accepting work."}</div>
  </article>`;
}
function opResultHTML(o, ac, seq){
  const d = o.details || {}, base = [d.airport, lbl("region", d.region)].filter(Boolean).join(" · ");
  const list = (seq != null ? ac.filter(a => a.acft_seq === seq) : ac).slice(0, 3).map(a => { const i = BYSEQ.get(a.acft_seq); return i ? esc(i.name) + (a.how_many > 1 ? " × " + a.how_many : "") : ""; }).filter(Boolean);
  return `<a class="res" href="#/o/${esc(o.user_id)}" data-id="${esc(o.user_id)}"><span class="avatar sm" aria-hidden="true">✈</span>
    <span class="rbody"><b class="rname">${esc(opName(o))}</b><span class="rmeta">${esc(lbl("opkind", o.kind))}${base ? " · " + esc(base) : ""}</span>
    ${list.length ? `<span class="rac">${list.join("<br>")}</span>` : ""}<span class="chips2">${o.open_to_contract ? `<span class="badge ok">Open to contract crew</span>` : ""}${(d.looking || []).slice(0, 3).map(v => `<span class="badge">${esc(lbl("oplook", v))}</span>`).join("")}</span></span></a>`;
}
let OF = {seq:null, region:"", open:false};
async function viewOperators(){
  if (!sb) { app.innerHTML = `<p class="err">The directory isn't available right now.</p>`; return; }
  app.innerHTML = `<div class="pagehead"><div><h1>Operators</h1><p>Owners and operators who fly the aircraft you're current on.</p></div>${tabs("ops")}</div>
  <section class="panel filters" aria-label="Filters"><div class="fgrid">
    <div class="f acsearch"><label for="oa">Aircraft</label><input id="oa" type="search" autocomplete="off" placeholder="Any aircraft, e.g. Citation XLS"><div class="acres" id="oares" hidden></div></div>
    ${selectHTML("orr", "region", "Region", OF.region, "Anywhere")}</div>
    <div class="savebar"><label class="switch"><input type="checkbox" id="oo"${OF.open ? " checked" : ""}> Open to contract crew</label><button class="btn secondary" id="ox" type="button" style="margin-left:auto">Clear</button></div></section>
  <div class="mdsplit"><div class="results" id="ores"><p>Loading operators…</p></div><aside class="detail" id="odet" aria-label="Selected operator"></aside></div>
  <p class="hint" style="margin-top:16px">Own or operate an aircraft? <a href="#/op">Create your free operator profile.</a></p>`;
  let O; try { O = await loadOps(); } catch (e) { $("ores").innerHTML = `<p class="err">Couldn't load operators.</p>`; return; }
  let active = null;
  const show = id => { active = id; const o = O.listed.find(x => x.user_id === id); $("odet").innerHTML = o ? opCardHTML(o, O.acBy.get(id) || []) : ""; app.querySelectorAll("#ores .res").forEach(r => r.classList.toggle("on", r.dataset.id === id)); };
  const draw = () => {
    $("oa").value = OF.seq != null && BYSEQ.get(OF.seq) ? BYSEQ.get(OF.seq).name : ""; $("orr").value = OF.region; $("oo").checked = OF.open;
    const hits = O.listed.filter(o => (OF.seq == null || (O.acBy.get(o.user_id) || []).some(a => a.acft_seq === OF.seq)) && (!OF.region || (o.details || {}).region === OF.region) && (!OF.open || o.open_to_contract))
      .sort((x, y) => (y.open_to_contract ? 1 : 0) - (x.open_to_contract ? 1 : 0));
    $("ores").innerHTML = `<p class="count">${hits.length} operator${hits.length === 1 ? "" : "s"}</p>` + (hits.length ? hits.map(o => opResultHTML(o, O.acBy.get(o.user_id) || [], OF.seq)).join("")
      : `<div class="panel"><p style="margin:0">No listed operators match yet. The directory is new: operator profiles appear here once they're reviewed.</p></div>`);
    if (wide() && hits.length) show(hits.some(h => h.user_id === active) ? active : hits[0].user_id); else $("odet").innerHTML = "";
  };
  $("ores").addEventListener("click", e => { const r = e.target.closest(".res"); if (!r || !wide()) return; e.preventDefault(); show(r.dataset.id); });
  app.querySelector(".filters").addEventListener("change", e => { if (e.target.id === "orr") OF.region = e.target.value; if (e.target.id === "oo") OF.open = e.target.checked; draw(); });
  $("ox").onclick = () => { OF = {seq:null, region:"", open:false}; draw(); };
  const fa = $("oa"), fr = $("oares");
  fa.addEventListener("input", () => { const hits = searchAcftList(fa.value, s => O.count.get(s) || 0);
    if (!fa.value.trim()) { fr.hidden = true; if (OF.seq != null) { OF.seq = null; draw(); } return; }
    fr.innerHTML = hits.map(a => `<button type="button" data-f="${a.seq}">${esc(a.name)}<small>${O.count.get(a.seq) || 0} listed operators · ${esc(a.years)}</small></button>`).join("") || '<div style="padding:12px;color:var(--muted)">No match.</div>'; fr.hidden = false; });
  fr.addEventListener("click", e => { const b = e.target.closest("[data-f]"); if (!b) return; OF.seq = +b.dataset.f; fr.hidden = true; draw(); });
  document.addEventListener("click", e => { if (!e.target.closest(".acsearch")) fr.hidden = true; });
  draw();
}
function searchAcftList(q, score){
  const words = q.toUpperCase().replace(/[-–]/g, " ").split(/\s+/).filter(Boolean); if (!words.length) return [];
  const cw = words.map(w => w.replace(/[^A-Z0-9]/g, ""));
  return ACFT.filter(a => { const hay = (a.name + " " + a.alias + " " + a.engine + (a.heli ? " HELICOPTER" : "")).toUpperCase().replace(/[-–]/g, " "), hc = hay.replace(/[^A-Z0-9]/g, ""); return words.every((w, i) => hay.includes(w) || (cw[i] && hc.includes(cw[i]))); })
    .sort((x, y) => score(y.seq) - score(x.seq)).slice(0, 15);
}
async function viewOperator(id){
  if (!sb) return;
  app.innerHTML = `<p>Loading…</p>`;
  const [{data:o}, {data:ac}] = await Promise.all([sb.from("operator_profiles").select("*").eq("user_id", id).maybeSingle(), sb.from("operator_aircraft").select("*").eq("user_id", id)]);
  if (!o) { app.innerHTML = `<div class="center"><h1>Operator not found</h1><p>It may be unpublished or waiting for review.</p><a class="btn secondary" href="#/operators">Operators</a></div>`; return; }
  document.title = opName(o) + " · Cali Aircrew";
  app.innerHTML = `<div style="max-width:720px;margin:0 auto;display:flex;flex-direction:column;gap:16px"><a href="#/operators">← Operators</a>${opCardHTML(o, ac || [])}</div>`;
}

async function viewOpMe(){
  if (!sb) { app.innerHTML = `<p class="err">Sign-in isn't available right now.</p>`; return; }
  if (!user) { app.innerHTML = `<div class="center"><h1>Operator profile</h1><p>Owners, charter operators and flight departments: sign in to list the aircraft you operate and the crew you need. Free.</p><button class="btn primary" id="go" type="button">Sign in</button></div>`; $("go").onclick = () => signIn(route); return; }
  if (await needMfa()) { app.innerHTML = `<div class="center"><h1>One more step</h1><p>Enter your Microsoft Authenticator code to edit your profile.</p><button class="btn primary" id="go" type="button">Enter code</button></div>`; $("go").onclick = () => signIn(route); return; }
  app.innerHTML = `<p>Loading your operator profile…</p>`;
  const uid = user.id;
  const [{data:o0}, {data:ac0}, {data:mod}, pr] = await Promise.all([sb.from("operator_profiles").select("*").eq("user_id", uid).maybeSingle(), sb.from("operator_aircraft").select("*").eq("user_id", uid),
    sb.from("moderation").select("*").eq("user_id", uid).maybeSingle(), sb.from("operator_about_pending").select("about").eq("user_id", uid).maybeSingle()]);
  const publicAbout = (o0 && o0.about) || ""; let pendingAbout = pr && !pr.error && pr.data ? pr.data.about : null;
  const P = Object.assign({name:"", kind:"", open_to_contract:true, about:"", published:false, details:{}}, o0 || {});
  if (pendingAbout != null) P.about = pendingAbout;
  const D = P.details = Object.assign({private:false, region:"", airport:"", looking:[], ops:[], work:[]}, P.details || {});
  let AC = (ac0 || []).map(a => ({acft_seq:a.acft_seq, how_many:a.how_many || 1}));
  let dirty = false;
  const statusOf = () => !o0 ? ["", "Not saved yet"] : !P.published ? ["", "Draft: only you can see it"] : mod && mod.op_hidden ? ["warn", "Hidden by Cali Aircrew. Contact us"] : mod && mod.op_approved ? ["ok", "Published and listed"] : ["warn", "Published: waiting for review"];
  const sel = (id, k, label, val) => `<div class="f"><label for="${id}">${label}</label><select id="${id}"><option value="">Choose…</option>${OPT[k].map(([v, l]) => `<option value="${v}"${v === val ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></div>`;
  const multi = (name, k, label, vals) => `<div class="f"><span class="lbl" id="l-${name}">${label}</span><div class="chips" role="group" aria-labelledby="l-${name}">${OPT[k].map(([v, l]) => `<label><input type="checkbox" name="${name}" value="${v}"${(vals || []).includes(v) ? " checked" : ""}> ${esc(l)}</label>`).join("")}</div></div>`;
  app.innerHTML = `<div class="pagehead"><div><h1>My operator profile</h1><p>For owners, charter operators and flight departments. Mostly taps.</p></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn secondary" href="#/me">Crew profile</a><button class="btn secondary toggleprev" id="tp" type="button">Preview</button></div></div>
  <div class="split" id="split"><div class="formcol">
    <section class="panel"><h2>Who you are</h2>
      <div class="grid2">${sel("ok", "opkind", "Type of operator", P.kind)}<div class="f"><label for="on">Company name</label><input id="on" maxlength="120" value="${esc(D.private ? "" : P.name)}" placeholder="e.g. Coastal Jets LLC"${D.private ? " disabled" : ""}></div></div>
      <label class="switch"><input type="checkbox" id="opriv"${D.private ? " checked" : ""}> Show me as "Private owner" (your name is not shown)</label></section>
    <section class="panel"><h2>Home base</h2><div class="grid2">${sel("org", "region", "Region", D.region)}<div class="f"><label for="oap">Airport (optional)</label><input id="oap" maxlength="8" value="${esc(D.airport)}" placeholder="e.g. SNA" autocapitalize="characters"></div></div></section>
    <section class="panel"><h2>Aircraft you operate</h2>
      <div class="f acsearch"><label for="oq">Add an aircraft</label><input id="oq" type="search" autocomplete="off" placeholder="Type to search, e.g. Citation XLS, King Air 350"><div class="acres" id="oqr" hidden></div></div>
      <div><button class="btn secondary" id="obrw" type="button">Browse the list</button></div><div id="obrowse" class="browse" hidden></div>
      <div id="oacl"></div></section>
    <section class="panel"><h2>Crew you need</h2>
      <label class="switch"><input type="checkbox" id="oopen"${P.open_to_contract ? " checked" : ""}> Open to contract crew</label>
      ${multi("olk", "oplook", "Looking for (tap all that apply)", D.looking)}${multi("oops", "opops", "Operations", D.ops)}${multi("owk", "opwork", "Work type", D.work)}</section>
    <section class="panel"><h2>About (optional)</h2><div class="f"><label for="oab">A few words crew should know</label><textarea id="oab" maxlength="2000">${esc(P.about)}</textarea><small>No phone numbers or email here. Changes are reviewed before they show publicly.</small><span class="status warn" id="opend"${pendingAbout != null ? "" : " hidden"}>Your new text is waiting for review.</span></div></section>
    <section class="panel"><h2>Publish</h2><label class="switch"><input type="checkbox" id="opub"${P.published ? " checked" : ""}> Show my operator profile to crew</label>
      <p class="hint">Reviewed by Cali Aircrew before it appears. You can unpublish at any time.</p>
      <div class="savebar"><button class="btn primary" id="osave" type="button">Save operator profile</button><span id="ost"></span><span class="err" id="ose" role="status"></span></div></section>
    <section class="panel" aria-labelledby="rch"><h2 id="rch">Recommended crew</h2><p class="hint">Listed crew current on your aircraft, best matches first.</p><div id="reco"><p class="empty" style="margin:0">Add an aircraft to see matches.</p></div></section>
  </div><aside class="prevcol" aria-label="Live preview" id="oprev"></aside></div>`;
  const checked = n => [...app.querySelectorAll(`input[name=${n}]:checked`)].map(i => i.value);
  const read = () => { D.private = $("opriv").checked; P.kind = $("ok").value; P.name = D.private ? "" : $("on").value.trim(); D.region = $("org").value; D.airport = $("oap").value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    P.open_to_contract = $("oopen").checked; D.looking = checked("olk"); D.ops = checked("oops"); D.work = checked("owk"); P.about = $("oab").value.trim(); P.published = $("opub").checked;
    P.home_base = [D.airport, lbl("region", D.region)].filter(Boolean).join(" · ").slice(0, 80); };
  const drawStatus = () => { const [k, t] = statusOf(); $("ost").innerHTML = `<span class="status ${k}">${esc(t)}${dirty ? " · unsaved changes" : ""}</span>`; };
  const drawPrev = () => { read(); $("oprev").innerHTML = opCardHTML(P, AC, {preview:true}); };
  const drawAc = () => { $("oacl").innerHTML = AC.length ? AC.map((a, i) => { const info = BYSEQ.get(a.acft_seq); return `<div class="acrow" style="grid-template-columns:minmax(0,1fr) 120px 44px"><span class="nm">${esc(info ? info.name : "#" + a.acft_seq)}</span>
      <select class="p135" data-hm="${i}" aria-label="How many">${[1,2,3,4,5,6,7,8,9,10].map(n => `<option value="${n}"${n === a.how_many ? " selected" : ""}>${n === 10 ? "10+" : n} aircraft</option>`).join("")}</select>
      <button class="iconbtn" type="button" data-orm="${i}" aria-label="Remove">✕</button></div>`; }).join("") : '<p class="empty" style="margin:0">No aircraft yet.</p>'; };
  let reco = null;
  const drawReco = async () => {
    if (!AC.length) { $("reco").innerHTML = '<p class="empty" style="margin:0">Add an aircraft to see matches.</p>'; return; }
    try { reco = reco || await loadDir(); } catch (e) { return; }
    const seqs = new Set(AC.map(a => a.acft_seq)), want135 = D.ops.includes("p135");
    const hits = reco.listed.filter(p => p.user_id !== uid && (reco.acBy.get(p.user_id) || []).some(a => seqs.has(a.acft_seq))).map(p => { const ac = reco.acBy.get(p.user_id) || [], d = p.details || {}, mine = ac.filter(a => seqs.has(a.acft_seq));
      const sc = (d.region && d.region === D.region ? 40 : 0) + (d.status === "now" ? 30 : d.status === "notice" ? 15 : 0) + (mine.some(a => curState(a) === "current") ? 20 : 0) + (want135 && mine.some(a => a.part135) ? 20 : 0) + ((reco.mod.get(p.user_id) || {}).verified_faa ? 10 : 0);
      return {p, ac, sc, seq:mine[0].acft_seq}; }).sort((x, y) => y.sc - x.sc).slice(0, 6);
    const saved = F; $("reco").innerHTML = hits.length ? hits.map(h => { F = {...F, seq:h.seq}; return resultHTML(h.p, h.ac, reco.mod.get(h.p.user_id)); }).join("") : '<p style="margin:0">No listed crew on your aircraft yet. As pilots join, the best matches appear here.</p>'; F = saved;
  };
  const changed = () => { dirty = true; drawPrev(); drawStatus(); };
  drawAc(); drawPrev(); drawStatus(); drawReco();
  const form = app.querySelector(".formcol");
  form.addEventListener("input", e => { if (e.target.id !== "oq") changed(); });
  form.addEventListener("change", e => { const t = e.target;
    if (t.id === "opriv") { $("on").disabled = t.checked; if (t.checked) $("on").value = ""; }
    if (t.dataset.hm != null) AC[+t.dataset.hm].how_many = +t.value;
    if (t.id === "org" || t.name === "oops") drawReco(); changed(); });
  $("oacl").addEventListener("click", e => { const b = e.target.closest("[data-orm]"); if (!b) return; AC.splice(+b.dataset.orm, 1); drawAc(); changed(); drawReco(); if (!$("obrowse").hidden) drawOB(); });
  const add = seq => { if (!AC.some(a => a.acft_seq === seq)) AC.push({acft_seq:seq, how_many:1}); drawAc(); changed(); drawReco(); };
  const q = $("oq"), qr = $("oqr");
  q.addEventListener("input", () => { const have = new Set(AC.map(a => a.acft_seq)); const hits = searchAcftList(q.value, () => 0).filter(a => !have.has(a.seq));
    if (!q.value.trim()) { qr.hidden = true; return; } qr.innerHTML = hits.map(a => `<button type="button" data-oadd="${a.seq}">${esc(a.name)}<small>${esc(a.years)}</small></button>`).join("") || '<div style="padding:12px;color:var(--muted)">No match.</div>'; qr.hidden = false; });
  qr.addEventListener("click", e => { const b = e.target.closest("[data-oadd]"); if (!b) return; q.value = ""; qr.hidden = true; add(+b.dataset.oadd); });
  document.addEventListener("click", e => { if (!e.target.closest(".acsearch")) qr.hidden = true; });
  let bc = null, bm = null;
  const drawOB = () => { const have = new Set(AC.map(a => a.acft_seq));
    let h = `<div class="pills">${CATS2.map(([k, l]) => `<button type="button" class="pill${k === bc ? " on" : ""}" data-oc="${k}">${esc(l)}</button>`).join("")}</div>`;
    if (bc) { const makes = [...new Set(ACFT.filter(a => catOf2(a) === bc).map(makeOf2))].sort((x, y) => x.localeCompare(y));
      h += `<div class="pills makes">${makes.map(m => `<button type="button" class="pill${m === bm ? " on" : ""}" data-om="${esc(m)}">${esc(m)}</button>`).join("")}</div>`;
      if (bm) h += `<div class="mtiles">${ACFT.filter(a => catOf2(a) === bc && makeOf2(a) === bm).map(a => `<button type="button" class="mtile${have.has(a.seq) ? " on" : ""}" data-ot="${a.seq}"><span>${esc(a.name)}</span><small>${have.has(a.seq) ? "✓ Added" : "＋ Add"} · ${esc(a.years)}</small></button>`).join("")}</div>`; }
    $("obrowse").innerHTML = h; };
  $("obrw").onclick = () => { const b = $("obrowse"); b.hidden = !b.hidden; $("obrw").textContent = b.hidden ? "Browse the list" : "Close the list"; if (!b.hidden) drawOB(); };
  $("obrowse").addEventListener("click", e => { const c = e.target.closest("[data-oc]"), m = e.target.closest("[data-om]"), t = e.target.closest("[data-ot]");
    if (c) { bc = c.dataset.oc === bc ? null : c.dataset.oc; bm = null; drawOB(); } else if (m) { bm = m.dataset.om === bm ? null : m.dataset.om; drawOB(); }
    else if (t) { const seq = +t.dataset.ot, i = AC.findIndex(a => a.acft_seq === seq); if (i >= 0) { AC.splice(i, 1); drawAc(); changed(); drawReco(); } else add(seq); drawOB(); } });
  $("tp").onclick = () => { const s = $("split"); s.classList.toggle("showprev"); $("tp").textContent = s.classList.contains("showprev") ? "Edit" : "Preview"; window.scrollTo(0, 0); };
  $("osave").onclick = async () => {
    read(); $("ose").textContent = "";
    if (P.published && !P.kind) { $("ose").textContent = "Choose the type of operator before publishing."; $("ok").focus(); return; }
    if (P.published && !AC.length) { $("ose").textContent = "Add at least one aircraft before publishing."; q.focus(); return; }
    const b = $("osave"); b.disabled = true; b.textContent = "Saving…";
    try {
      if (await needMfa()) { b.disabled = false; b.textContent = "Save operator profile"; signIn(() => $("osave").click()); return; }
      const row = {user_id:uid, published:P.published, name:P.name, kind:P.kind || "owner", home_base:P.home_base, open_to_contract:P.open_to_contract, about:P.about, details:D};
      const r1 = await sb.from("operator_profiles").upsert(row, {onConflict:"user_id"});
      if (r1.error) throw new Error(/details|kind_check/.test(r1.error.message || "") ? "Operator profiles need one Cali Aircrew setup step (database update 009)." : r1.error.message);
      if (P.about !== publicAbout) { const rp = await sb.from("operator_about_pending").upsert({user_id:uid, about:P.about}, {onConflict:"user_id"}); pendingAbout = rp.error ? null : P.about; }
      else if (pendingAbout != null) { await sb.from("operator_about_pending").delete().eq("user_id", uid); pendingAbout = null; }
      $("opend").hidden = pendingAbout == null;
      const r2 = await sb.from("operator_aircraft").delete().eq("user_id", uid); if (r2.error) throw r2.error;
      if (AC.length) { const r3 = await sb.from("operator_aircraft").insert(AC.map(a => ({user_id:uid, acft_seq:a.acft_seq, how_many:a.how_many}))); if (r3.error) throw r3.error; }
      dirty = false; OPS = null; if (!o0) { await viewOpMe(); return; }
      drawStatus(); const ok = document.createElement("span"); ok.className = "status ok"; ok.textContent = "Saved"; $("ost").appendChild(ok); setTimeout(() => ok.remove(), 2500);
    } catch (e) { $("ose").textContent = "Not saved: " + ((e && e.message) || "check your connection and try again."); }
    finally { b.disabled = false; b.textContent = "Save operator profile"; }
  };
  window.onbeforeunload = () => dirty ? "You have unsaved changes." : undefined;
}

/* ---------------- router ---------------- */
async function route(){
  const h = location.hash.replace(/^#\/?/, "");
  window.onbeforeunload = null;
  if (h === "me") return viewMe();
  if (h.startsWith("p/")) return viewProfile(h.slice(2));
  if (h === "aircraft") return viewBrowse();
  if (h.startsWith("a/")) { const [n, w] = h.slice(2).split("/"); return viewAircraft(+n, w); }
  if (h === "op") return viewOpMe();
  if (h === "operators") return viewOperators();
  if (h.startsWith("o/")) return viewOperator(h.slice(2));
  return viewFind();
}
window.addEventListener("hashchange", route);
if (sb) {
  sb.auth.onAuthStateChange((ev, session) => { const was = user && user.id; user = (session && session.user) || null; drawAcct();
    if (ev === "INITIAL_SESSION" || (ev === "SIGNED_IN" && was !== (user && user.id)) || ev === "SIGNED_OUT") setTimeout(route, 0); });
} else { drawAcct(); route(); }
})();
