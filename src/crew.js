/* Cali Aircrew crew directory — profiles (Phase 1, step 2).
   Data lives in Supabase (supabase/002_directory.sql). The page is static; every
   privacy rule is enforced by the database (row level security), not by this code. */
(function(){
"use strict";
const CLOUD = {{CLOUD_JSON}};
const ACFT_ROWS = {{ACFT_JSON}};            // [seq, make, model, engine, flags, years]
const ACFT = ACFT_ROWS.map(r => ({seq:r[0], make:r[1], model:r[2], engine:r[3], twin:r[4].includes("t"), heli:r[4].includes("h"), years:r[5],
  name:((r[1]==="Cessna Citation"?"Cessna":r[1])+" "+String(r[2]).replace(/\s*\(.*?\)/,"")).trim()}));  // same naming as the checklist builder
const BYSEQ = new Map(ACFT.map(a => [a.seq, a]));
const CREW_TYPES = [["airplane_pilot","Airplane pilot"],["helicopter_pilot","Helicopter pilot"],["cfi","Flight instructor"],["flight_attendant","Flight attendant"],["ferry_pilot","Ferry / delivery pilot"],["mechanic","Mechanic (A&P / IA)"]];
const TYPE_LABEL = Object.fromEntries(CREW_TYPES);
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
function drawAcct(){ const b = $("acctBtn"); if (!b) return; b.textContent = user ? "My profile" : "Sign in"; }

/* ---------------- shared bits ---------------- */
const initials = n => (String(n || "").trim().split(/\s+/).map(w => w[0]).join("").slice(0, 2) || "?").toUpperCase();
const fmt = n => (n == null || n === "" || isNaN(n)) ? "" : Number(n).toLocaleString("en-US");
function cardHTML(p, aircraft, mod, opts){
  const types = (p.crew_types || []).map(t => TYPE_LABEL[t]).filter(Boolean);
  const meta = [p.certificate, p.headline].filter(Boolean).join(" · ");
  const ac = (aircraft || []).map(a => ({...a, info:BYSEQ.get(a.acft_seq)})).filter(a => a.info).sort((x, y) => (y.hours || 0) - (x.hours || 0));
  const badges = [];
  if (mod && mod.verified_faa) badges.push(`<span class="badge ok">✓ FAA certificate verified</span>`);
  types.forEach(t => badges.push(`<span class="badge">${esc(t)}</span>`));
  return `<article class="pcard" aria-label="Crew profile">
    <div class="top"><div class="avatar" aria-hidden="true">${esc(initials(p.display_name))}</div>
      <div><h2>${esc(p.display_name) || '<span class="empty">Your name</span>'}</h2>
      <div class="meta">${esc(meta) || '<span class="empty">Certificate · headline</span>'}</div>
      <div class="meta">${p.home_base ? "Based at " + esc(p.home_base) : '<span class="empty">Home base</span>'}</div></div></div>
    ${badges.length ? `<div class="badges">${badges.join("")}</div>` : ""}
    <section><h3>Aircraft and time</h3>
      ${ac.length ? ac.map(a => `<div class="row"><span>${esc(a.info.name)}${a.type_rated ? " · type rated" : ""}</span><b>${a.hours ? fmt(a.hours) + " hrs" : ""}</b></div>`).join("") : '<p class="empty">Add the aircraft you fly.</p>'}
      ${p.total_time ? `<div class="row"><span>Total time</span><b>${fmt(p.total_time)} hrs</b></div>` : ""}
    </section>
    ${(p.availability || p.travel || p.experience) ? `<section><h3>Availability and experience</h3>${p.availability ? `<p>${esc(p.availability)}</p>` : ""}${p.travel ? `<p>${esc(p.travel)}</p>` : ""}${p.experience ? `<p>${esc(p.experience)}</p>` : ""}</section>` : ""}
    ${p.bio ? `<section><h3>About</h3><p>${esc(p.bio)}</p></section>` : ""}
    <div class="actions"><button class="btn primary" type="button" disabled title="Messaging opens soon" style="opacity:.6">Message (coming soon)</button></div>
    <div class="note">${opts && opts.preview ? "Preview: this is how owners and operators will see your profile." : "Profiles are advertisements. Verify licenses, medical and training before hiring."}</div>
  </article>`;
}

/* ---------------- views ---------------- */
async function viewHome(){
  app.innerHTML = `<div class="center"><h1>Crew directory</h1>
    <p>Crew profiles are open now. Find crew search and Browse by aircraft are being built next.</p>
    <div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center"><a class="btn primary" href="#/me">${user ? "Edit my crew profile" : "Create my crew profile"}</a><a class="btn secondary" href="../#notify">Get notified</a></div></div>`;
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
  app.innerHTML = `<div style="max-width:720px;margin:0 auto;display:flex;flex-direction:column;gap:16px"><a href="#/">Back to the crew directory</a>${cardHTML(p, ac || [], mod)}</div>`;
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
  const [{data:p0}, {data:ac0}, {data:mod}] = await Promise.all([
    sb.from("crew_profiles").select("*").eq("user_id", uid).maybeSingle(),
    sb.from("crew_aircraft").select("*").eq("user_id", uid),
    sb.from("moderation").select("*").eq("user_id", uid).maybeSingle()]);
  const P = Object.assign({display_name:"", crew_types:[], certificate:"", headline:"", home_base:"", travel:"", experience:"", bio:"", total_time:null, availability:"", published:false}, p0 || {});
  let AC = (ac0 || []).map(a => ({acft_seq:a.acft_seq, type_rated:!!a.type_rated, hours:a.hours}));
  let dirty = false;
  const statusOf = () => {
    if (!p0) return ["", "Not saved yet"];
    if (!P.published) return ["", "Draft: only you can see it"];
    if (mod && mod.hidden) return ["warn", "Hidden by Cali Aircrew. Contact us"];
    if (mod && mod.approved) return ["ok", "Published and listed"];
    return ["warn", "Published: waiting for review"];
  };
  const field = (id, label, val, attrs) => `<div class="f"><label for="${id}">${label}</label><input id="${id}" value="${esc(val ?? "")}" ${attrs || ""}></div>`;
  app.innerHTML = `
  <div class="pagehead"><div><h1>My crew profile</h1><p>Signed in as ${esc(user.email || "")}</p></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn secondary toggleprev" id="tp" type="button">Preview</button><button class="btn secondary" id="so" type="button">Sign out</button></div></div>
  <div class="split" id="split">
   <div class="formcol">
    <section class="panel" aria-labelledby="h1a"><h2 id="h1a">About you</h2>
      <div class="grid2">${field("dn","Name shown on your profile",P.display_name,'maxlength="80" placeholder="e.g. Jordan R." autocomplete="name"')}${field("ce","Certificate",P.certificate,'maxlength="80" placeholder="e.g. ATP, CFII"')}</div>
      <div class="grid2">${field("hl","Headline",P.headline,'maxlength="120" placeholder="e.g. Contract captain"')}${field("hb","Home base",P.home_base,'maxlength="80" placeholder="e.g. Van Nuys (VNY)"')}</div>
      <div class="f"><span class="lbl" id="ctl">Crew type</span><div class="chips" role="group" aria-labelledby="ctl">${CREW_TYPES.map(([v, l]) => `<label><input type="checkbox" name="ct" value="${v}"${P.crew_types.includes(v) ? " checked" : ""}> ${esc(l)}</label>`).join("")}</div></div>
    </section>
    <section class="panel" aria-labelledby="h1b"><h2 id="h1b">Aircraft and time</h2>
      <p class="hint">Add each aircraft you are current on. Owners search by exact type.</p>
      <div class="f acsearch"><label for="acq">Add an aircraft</label><input id="acq" type="search" autocomplete="off" placeholder="Type to search, e.g. Citation XLS, King Air 350"><div class="acres" id="acres" hidden></div></div>
      <div><button class="btn secondary" id="brw" type="button" aria-expanded="false" aria-controls="acbrowse">Browse the list</button></div>
      <div id="acbrowse" class="browse" hidden></div>
      <div id="aclist"></div>
      <div class="grid2">${field("tt","Total time (hours)",P.total_time ?? "",'inputmode="numeric" placeholder="e.g. 6800"')}</div>
    </section>
    <section class="panel" aria-labelledby="h1c"><h2 id="h1c">Availability and experience</h2>
      ${field("av","Availability",P.availability,'maxlength="200" placeholder="e.g. Most weekdays; Jun 3–7 and Jun 18–30"')}
      ${field("tv","Travel",P.travel,'maxlength="120" placeholder="e.g. Will travel nationwide"')}
      ${field("ex","Experience",P.experience,'maxlength="200" placeholder="e.g. Part 91 and 135, international"')}
      <div class="f"><label for="bio">About you</label><textarea id="bio" maxlength="2000" placeholder="A few sentences owners should know.">${esc(P.bio)}</textarea><small>No phone numbers or email here. Owners will contact you through Cali Aircrew messaging.</small></div>
    </section>
    <section class="panel" aria-labelledby="h1d"><h2 id="h1d">Publish</h2>
      <label class="switch"><input type="checkbox" id="pub"${P.published ? " checked" : ""}> Show my profile in the crew directory</label>
      <p class="hint">New profiles are reviewed by Cali Aircrew before they appear. You can unpublish at any time.</p>
      <div class="savebar"><button class="btn primary" id="save" type="button">Save profile</button><span id="st"></span><span class="err" id="se" role="status"></span></div>
    </section>
   </div>
   <aside class="prevcol" aria-label="Live preview" id="prev"></aside>
  </div>`;
  const read = () => {
    P.display_name = $("dn").value.trim(); P.certificate = $("ce").value.trim(); P.headline = $("hl").value.trim(); P.home_base = $("hb").value.trim();
    P.crew_types = [...app.querySelectorAll('input[name=ct]:checked')].map(i => i.value);
    const tt = $("tt").value.replace(/[^\d]/g, ""); P.total_time = tt ? Math.min(100000, +tt) : null;
    P.availability = $("av").value.trim(); P.travel = $("tv").value.trim(); P.experience = $("ex").value.trim(); P.bio = $("bio").value.trim(); P.published = $("pub").checked;
  };
  const drawStatus = () => { const [k, t] = statusOf(); $("st").innerHTML = `<span class="status ${k}">${esc(t)}${dirty ? " · unsaved changes" : ""}</span>`; };
  const drawPrev = () => { read(); $("prev").innerHTML = cardHTML(P, AC, mod, {preview:true}); };
  const drawAc = () => {
    $("aclist").innerHTML = AC.length ? AC.map((a, i) => { const info = BYSEQ.get(a.acft_seq); return `<div class="acrow"><span class="nm">${esc(info ? info.name : "Aircraft #" + a.acft_seq)}</span>
      <label class="tr"><input type="checkbox" data-tr="${i}"${a.type_rated ? " checked" : ""}> Type rated</label>
      <input class="hrs" data-hr="${i}" inputmode="numeric" placeholder="Hours" aria-label="Hours in ${esc(info ? info.name : "")}" value="${a.hours ?? ""}">
      <button class="iconbtn" type="button" data-rm="${i}" aria-label="Remove ${esc(info ? info.name : "aircraft")}">✕</button></div>`; }).join("") : '<p class="empty" style="margin:0">No aircraft yet.</p>';
  };
  const changed = () => { dirty = true; drawPrev(); drawStatus(); };
  drawAc(); drawPrev(); drawStatus();
  app.querySelector(".formcol").addEventListener("input", e => {
    const t = e.target;
    if (t.dataset.hr != null) { const v = t.value.replace(/[^\d]/g, ""); AC[+t.dataset.hr].hours = v ? Math.min(50000, +v) : null; }
    if (t.id !== "acq") changed();
  });
  app.querySelector(".formcol").addEventListener("change", e => { const t = e.target; if (t.dataset.tr != null) { AC[+t.dataset.tr].type_rated = t.checked; changed(); } else if (t.name === "ct" || t.id === "pub") changed(); });
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
    if (t) { const seq = +t.dataset.tog, i = AC.findIndex(a => a.acft_seq === seq); if (i >= 0) AC.splice(i, 1); else AC.push({acft_seq:seq, type_rated:false, hours:null}); drawAc(); drawBrowse(); changed(); }
  });
  const q = $("acq"), res = $("acres");
  q.addEventListener("input", () => {
    const words = q.value.toUpperCase().replace(/[-–]/g, " ").split(/\s+/).filter(Boolean);
    if (!words.length) { res.hidden = true; return; }
    const have = new Set(AC.map(a => a.acft_seq));
    const hits = ACFT.filter(a => !have.has(a.seq) && words.every(w => (a.name + " " + a.engine).toUpperCase().replace(/[-–]/g, " ").includes(w))).slice(0, 20);
    res.innerHTML = hits.length ? hits.map(a => `<button type="button" data-add="${a.seq}">${esc(a.name)}<small>${esc(a.years)} · ${a.heli ? "Helicopter" : a.engine[0].toUpperCase() + a.engine.slice(1)}${a.twin ? " · twin" : ""}</small></button>`).join("") : '<div style="padding:12px;color:var(--muted)">No match. Try a shorter name.</div>';
    res.hidden = false;
  });
  res.addEventListener("click", e => { const b = e.target.closest("[data-add]"); if (!b) return; AC.push({acft_seq:+b.dataset.add, type_rated:false, hours:null}); q.value = ""; res.hidden = true; drawAc(); changed(); const last = app.querySelector(`[data-hr="${AC.length - 1}"]`); if (last) last.focus(); });
  document.addEventListener("click", e => { if (!e.target.closest(".acsearch")) res.hidden = true; });
  $("tp").onclick = () => { const s = $("split"); s.classList.toggle("showprev"); $("tp").textContent = s.classList.contains("showprev") ? "Edit" : "Preview"; window.scrollTo(0, 0); };
  $("so").onclick = async () => { await sb.auth.signOut(); location.hash = "#/"; };
  $("save").onclick = async () => {
    read(); $("se").textContent = "";
    if (P.published && !P.display_name) { $("se").textContent = "Add the name shown on your profile before publishing."; $("dn").focus(); return; }
    if (P.published && !AC.length) { $("se").textContent = "Add at least one aircraft before publishing."; q.focus(); return; }
    const b = $("save"); b.disabled = true; b.textContent = "Saving…";
    try {
      if (await needMfa()) { b.disabled = false; b.textContent = "Save profile"; signIn(() => $("save").click()); return; }
      const row = {user_id:uid, published:P.published, display_name:P.display_name, crew_types:P.crew_types, certificate:P.certificate, headline:P.headline, home_base:P.home_base, travel:P.travel, experience:P.experience, bio:P.bio, total_time:P.total_time, availability:P.availability};
      const r1 = await sb.from("crew_profiles").upsert(row, {onConflict:"user_id"}); if (r1.error) throw r1.error;
      const r2 = await sb.from("crew_aircraft").delete().eq("user_id", uid); if (r2.error) throw r2.error;
      if (AC.length) { const r3 = await sb.from("crew_aircraft").insert(AC.map(a => ({user_id:uid, acft_seq:a.acft_seq, type_rated:a.type_rated, hours:a.hours}))); if (r3.error) throw r3.error; }
      dirty = false; Object.assign(P, row); if (!p0) { await viewMe(); return; }
      drawStatus(); $("se").textContent = "";
      const ok = document.createElement("span"); ok.className = "status ok"; ok.textContent = "Saved"; $("st").appendChild(ok); setTimeout(() => ok.remove(), 2500);
    } catch (e) { $("se").textContent = "Not saved: " + ((e && e.message) || "check your connection and try again."); }
    finally { b.disabled = false; b.textContent = "Save profile"; }
  };
  window.onbeforeunload = () => dirty ? "You have unsaved changes." : undefined;
}

/* ---------------- router ---------------- */
async function route(){
  const h = location.hash.replace(/^#\/?/, "");
  window.onbeforeunload = null;
  if (h === "me") return viewMe();
  if (h.startsWith("p/")) return viewProfile(h.slice(2));
  return viewHome();
}
window.addEventListener("hashchange", route);
if (sb) {
  sb.auth.onAuthStateChange((ev, session) => { const was = user && user.id; user = (session && session.user) || null; drawAcct();
    if (ev === "INITIAL_SESSION" || (ev === "SIGNED_IN" && was !== (user && user.id)) || ev === "SIGNED_OUT") setTimeout(route, 0); });
} else { drawAcct(); route(); }
})();
