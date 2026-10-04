/* Cali Aircrew admin page. Every action is a database call that checks is_admin() itself;
   this page holds no secret keys and grants nothing on its own. Needs supabase/007_admin.sql. */
(function(){
"use strict";
const CLOUD = {{CLOUD_JSON}};
const ACFT_ROWS = {{ACFT_JSON}};
const ACFT = ACFT_ROWS.map(r => ({seq:r[0], name:((r[1] === "Cessna Citation" ? "Cessna" : r[1]) + " " + String(r[2]).replace(/\s*\(.*?\)/, "")).trim(), heli:r[4].includes("h")}));
const BYSEQ = new Map(ACFT.map(a => [a.seq, a]));
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt = n => Number(n || 0).toLocaleString("en-US");
const day = d => d ? new Date(d).toLocaleDateString("en-US", {month:"short", day:"numeric", year:"numeric"}) : "—";
const app = $("app");
const L = {
  region:{socal:"Southern California",norcal:"Northern California",pnw:"Pacific Northwest",southwest:"Southwest",mountain:"Mountain",texas:"Texas",midwest:"Midwest",southeast:"Southeast",florida:"Florida",northeast:"Northeast",hawaii:"Hawaii",alaska:"Alaska",intl:"Outside the US"},
  type:{airplane_pilot:"Airplane pilot",helicopter_pilot:"Helicopter pilot",cfi:"Flight instructor",flight_attendant:"Flight attendant",ferry_pilot:"Ferry / delivery pilot",mechanic:"Mechanic"},
  role:{pic:"Captain / PIC",sic:"First officer / SIC",either:"Either seat",cfi:"Flight instructor",fa:"Flight attendant",mech:"Mechanic"},
  cert:{none:"None",private:"Private",commercial:"Commercial",atp:"ATP"},
  notify:{pilot:"Pilot",cfi:"CFI",flight_attendant:"Flight attendant",mechanic:"Mechanic",owner:"Aircraft owner",charter:"Charter operator",partner:"Partner / business",unknown:"Not given"}
};
const FREE = {db:500 * 1024 * 1024, mau:50000};            // Supabase free plan limits
const FAA_URL = "https://amsrvs.registry.faa.gov/airmeninquiry/";

let sb = null, user = null, D = null;
document.addEventListener("change", async e => { if (e.target.id !== "admAlerts") return; const on = e.target.checked;
  const {error} = await sb.from("member_settings").upsert({user_id:user.id, admin_emails:on, updated_at:new Date().toISOString()}, {onConflict:"user_id"});
  if (error) { e.target.checked = !on; alert("Not saved: " + error.message); return; } D.adminEmails = on; });
if (CLOUD.enabled && window.supabase) sb = window.supabase.createClient(CLOUD.url, CLOUD.key, {auth:{persistSession:true, autoRefreshToken:true, detectSessionInUrl:true, storageKey:"acb-auth"}});

/* ---------------- gate: signed in, authenticator passed if enrolled, admin ---------------- */
async function needMfa(){ const r = await sb.auth.mfa.getAuthenticatorAssuranceLevel(); const a = r && r.data; return !!(a && a.nextLevel === "aal2" && a.currentLevel !== "aal2"); }
async function gate(){
  if (!sb) { app.innerHTML = `<p class="err">Admin isn't available right now.</p>`; return false; }
  const {data:{session}} = await sb.auth.getSession(); user = session && session.user;
  if (!user) { app.innerHTML = `<div class="center"><h1>Admin</h1><p>Sign in first on the crew page, then come back here.</p><a class="btn primary" href="../crew/#/me">Sign in</a></div>`; return false; }
  if (await needMfa()) {
    app.innerHTML = `<div class="center"><h1>Authenticator code</h1><p>Enter the 6-digit code from Microsoft Authenticator.</p><div class="f" style="width:220px"><label for="tc">Code</label><input id="tc" inputmode="numeric" maxlength="6" autocomplete="one-time-code"></div><button class="btn primary" id="tg" type="button">Verify</button><p class="err" id="tm"></p></div>`;
    $("tg").onclick = async () => { const code = $("tc").value.trim();
      const {data:f} = await sb.auth.mfa.listFactors(); const t = ((f && f.totp) || []).find(x => x.status === "verified");
      if (!t) return; const {data:ch, error:e1} = await sb.auth.mfa.challenge({factorId:t.id}); if (e1) { $("tm").textContent = e1.message; return; }
      const {error} = await sb.auth.mfa.verify({factorId:t.id, challengeId:ch.id, code}); if (error) { $("tm").textContent = error.message; return; } start(); };
    return false;
  }
  const {data:isAdmin, error} = await sb.rpc("is_admin");
  if (error || isAdmin !== true) { app.innerHTML = `<div class="center"><h1>Admins only</h1><p>${esc(user.email)} doesn't have admin access.</p><a class="btn secondary" href="../">Home</a></div>`; return false; }
  return true;
}

/* ---------------- data ---------------- */
async function load(){
  const q = (name, fn) => fn.then(r => { if (r.error) throw new Error(name + ": " + r.error.message); return r.data; });
  const [metrics, search, users, profiles, aircraft, mods, pending, notify, acreq, privacy, partners, banner, audit] = await Promise.all([
    q("metrics", sb.rpc("admin_metrics")), q("search", sb.rpc("admin_search_stats", {p_days:30})), q("users", sb.rpc("admin_users")),
    q("profiles", sb.from("crew_profiles").select("*")), q("aircraft", sb.from("crew_aircraft").select("*")), q("moderation", sb.from("moderation").select("*")),
    q("pending", sb.from("crew_bio_pending").select("*")), q("notify", sb.from("notify_signups").select("*").order("created_at", {ascending:false})),
    q("requests", sb.from("aircraft_requests").select("*").order("created_at", {ascending:false})), q("privacy", sb.from("privacy_requests").select("*").order("received_on", {ascending:false})),
    q("partners", sb.from("partners").select("*").order("sort").order("name")), q("banner", sb.from("site_settings").select("*").eq("key", "banner").maybeSingle()),
    q("audit", sb.from("admin_audit").select("*").order("id", {ascending:false}).limit(300))]);
  // Operator profiles (database update 009). Older databases simply show none.
  const soft = fn => fn.then(r => r.error ? [] : (r.data || []), () => []);
  const [ops, opac, oppend, priv, help, recov] = await Promise.all([soft(sb.from("operator_profiles").select("*")), soft(sb.from("operator_aircraft").select("*")), soft(sb.from("operator_about_pending").select("*")), soft(sb.from("crew_private").select("*")),
    soft(sb.from("help_requests").select("*").order("created_at", {ascending:false})), soft(sb.from("account_recovery").select("*"))]);
  const msr = await sb.from("member_settings").select("admin_emails").eq("user_id", user.id).maybeSingle();
  const adminEmails = msr && !msr.error ? !(msr.data && msr.data.admin_emails === false) : null;   // null = alerts not set up yet
  // Waiting text that is identical to the public text isn't really waiting.
  const pubBio = new Map(profiles.map(p => [p.user_id, p.bio || ""]));
  const mod = new Map(mods.map(m => [m.user_id, m])), acBy = new Map(), pend = new Map(pending.filter(p => (p.bio || "") !== pubBio.get(p.user_id)).map(p => [p.user_id, p]));
  aircraft.forEach(a => { if (!acBy.has(a.user_id)) acBy.set(a.user_id, []); acBy.get(a.user_id).push(a); });
  const email = new Map(users.map(u => [u.user_id, u.email]));
  const statusOf = p => { const m = mod.get(p.user_id); if (m && m.hidden) return "hidden"; if (!p.published) return "draft"; return m && m.approved ? "listed" : "waiting"; };
  const opAcBy = new Map(); opac.forEach(a => { if (!opAcBy.has(a.user_id)) opAcBy.set(a.user_id, []); opAcBy.get(a.user_id).push(a); });
  const opStatus = o => { const m = mod.get(o.user_id); if (m && m.op_hidden) return "hidden"; if (!o.published) return "draft"; return m && m.op_approved ? "listed" : "waiting"; };
  D = {metrics, search, users, profiles, acBy, mod, pend, notify, acreq, privacy, partners, banner:(banner && banner.value) || {on:false, text:"", kind:"info"}, audit, email, statusOf,
       ops, opAcBy, opPend:new Map(oppend.filter(p => (p.about || "") !== ((ops.find(o => o.user_id === p.user_id) || {}).about || "")).map(p => [p.user_id, p])), opStatus, priv:new Map(priv.map(p => [p.user_id, p])), help, recov:new Map(recov.map(r => [r.user_id, r])), adminEmails};
}

/* ---------------- quality flags ---------------- */
const thisYM = () => { const n = new Date(); return n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0"); };
function flags(p){
  const f = [], ac = D.acBy.get(p.user_id) || [], d = p.details || {}, text = ((D.pend.get(p.user_id) || {}).bio || p.bio || "") + " " + (d.jobs || []).map(j => j.company || "").join(" ");
  if (!ac.length) f.push(["bad", "No aircraft"]);
  if (p.total_time && ac.some(a => (a.hours || 0) > p.total_time)) f.push(["bad", "Hours on a type exceed total time"]);
  if (ac.some(a => a.is_current && a.current_until && String(a.current_until).slice(0, 7) < thisYM())) f.push(["", "Currency date has passed"]);
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(text)) f.push(["bad", "Email address in free text"]);
  if (/(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/.test(text)) f.push(["bad", "Phone number in free text"]);
  if (/https?:\/\/|www\./i.test(text)) f.push(["", "Link in free text"]);
  const pv = D.priv.get(p.user_id); if (!pv || !pv.legal_last) f.push(["", "No legal name for FAA check"]);
  if (!d.role) f.push(["", "No role"]); if (!d.region) f.push(["", "No region"]); if (!d.cert) f.push(["", "No certificate"]);
  const same = D.profiles.filter(x => x.user_id !== p.user_id && x.display_name && x.display_name.trim().toLowerCase() === (p.display_name || "").trim().toLowerCase());
  if (same.length) f.push(["", "Same name as another profile"]);
  return f;
}
const completeness = p => { const d = p.details || {}, ac = D.acBy.get(p.user_id) || [];
  const parts = [p.display_name, d.role, d.cert, d.region, (p.crew_types || []).length, ac.length, ac.some(a => a.hours), p.total_time, d.status, (d.experience || []).length];
  return Math.round(100 * parts.filter(Boolean).length / parts.length); };

/* ---------------- views ---------------- */
const TABS = [["dash","Dashboard"],["review","Review"],["users","Users"],["signups","Sign-ups"],["requests","Requests"],["site","Site"],["audit","Audit log"],["backup","Backup"]];
let tab = "dash";
function shell(body){
  const waiting = new Set([...D.profiles.filter(p => D.statusOf(p) === "waiting").map(p => p.user_id), ...D.pend.keys()]).size
    + new Set([...D.ops.filter(o => D.opStatus(o) === "waiting").map(o => o.user_id), ...D.opPend.keys()]).size;
  const reqs = D.acreq.filter(r => r.status === "open").length + D.privacy.filter(r => r.status === "open").length + D.help.filter(r => r.status === "open").length;
  app.innerHTML = `<div class="pagehead"><div><h1>Admin</h1><p>Signed in as ${esc(user.email)} · <a href="#" id="rl">Refresh</a></p></div></div>
    <nav class="atabs" aria-label="Admin sections">${TABS.map(([k, l]) => `<a href="#${k}" class="${k === tab ? "on" : ""}">${l}${k === "review" && waiting ? ` <span class="n">${waiting}</span>` : ""}${k === "requests" && reqs ? ` <span class="n">${reqs}</span>` : ""}</a>`).join("")}</nav>
    <div id="body">${body}</div><p class="err" id="msg" role="status"></p>`;
  $("rl").onclick = async e => { e.preventDefault(); await refresh(); };
}
const say = (t, ok) => { const m = $("msg"); if (m) { m.className = ok ? "okmsg" : "err"; m.textContent = t; } };
async function act(fn, okText){ try { const r = await fn(); if (r && r.error) throw r.error; await refresh(okText); } catch (e) { say("Didn't work: " + ((e && e.message) || e)); } }
async function refresh(okText){ await load(); render(); if (okText) say(okText, true); }

function bars(values, labels, color){
  const max = Math.max(1, ...values), w = 600, h = 140, bw = w / values.length;
  return `<svg viewBox="0 0 ${w} ${h + 22}" role="img" aria-label="${esc(labels.title)}">${values.map((v, i) => { const bh = Math.round((h - 16) * v / max);
    return `<rect x="${i * bw + 4}" y="${h - bh}" width="${bw - 8}" height="${bh}" rx="3" fill="${color}"></rect><text x="${i * bw + bw / 2}" y="${h - bh - 4}" text-anchor="middle" font-size="12" fill="#3A4A5B">${v || ""}</text>`; }).join("")}
    <text x="0" y="${h + 18}" font-size="12" fill="#5B6B7C">12 weeks ago</text><text x="${w}" y="${h + 18}" font-size="12" fill="#5B6B7C" text-anchor="end">this week</text></svg>`;
}
function blist(rows, total){ const max = Math.max(1, ...rows.map(r => r[1]));
  return rows.length ? `<ul class="blist">${rows.map(([k, v]) => `<li><span>${esc(k)}</span><b>${fmt(v)}${total ? ` <small style="color:var(--muted);font-weight:400">(${Math.round(100 * v / total)}%)</small>` : ""}</b><span class="bar"><i style="width:${Math.round(100 * v / max)}%"></i></span></li>`).join("")}</ul>` : `<p class="empty" style="margin:0">Nothing yet.</p>`; }
const count = (arr, key) => { const m = new Map(); arr.forEach(x => [].concat(key(x)).filter(Boolean).forEach(k => m.set(k, (m.get(k) || 0) + 1))); return [...m.entries()].sort((a, b) => b[1] - a[1]); };

function viewDash(){
  const M = D.metrics, S = D.search, P = D.profiles, listed = P.filter(p => D.statusOf(p) === "listed");
  const by = st => P.filter(p => D.statusOf(p) === st).length;
  const ac = p => D.acBy.get(p.user_id) || [];
  const now = listed.filter(p => (p.details || {}).status === "now").length, notice = listed.filter(p => (p.details || {}).status === "notice").length;
  const p135 = listed.filter(p => ac(p).some(a => a.part135)).length, ver = listed.filter(p => (D.mod.get(p.user_id) || {}).verified_faa).length;
  const types = new Set(); listed.forEach(p => ac(p).forEach(a => types.add(a.acft_seq)));
  const comp = P.length ? Math.round(P.reduce((s, p) => s + completeness(p), 0) / P.length) : 0;
  const owners = (M.notify_by_role.owner || 0) + (M.notify_by_role.charter || 0);
  const kpi = (v, t, sub) => `<div class="kpi"><b>${v}</b><span>${t}</span>${sub ? `<small>${sub}</small>` : ""}</div>`;
  const dbPct = Math.min(100, Math.round(100 * M.db_bytes / FREE.db)), mauPct = Math.min(100, Math.round(100 * M.active_30d / FREE.mau));
  const acName = s => (BYSEQ.get(s) || {}).name || "Aircraft #" + s;
  const opsListed = D.ops.filter(o => D.opStatus(o) === "listed"), opTypes = new Set(); opsListed.forEach(o => (D.opAcBy.get(o.user_id) || []).forEach(a => opTypes.add(a.acft_seq)));
  const both = [...types].filter(t => opTypes.has(t)).length;
  return `
  ${D.adminEmails === null ? "" : `<label class="switch" style="margin:0 0 12px"><input type="checkbox" id="admAlerts"${D.adminEmails ? " checked" : ""}> Email me admin alerts (new profiles to review, help requests, partner inquiries; checked hourly)</label>`}
  <h2 class="sect" style="margin-top:0">At a glance</h2>
  <div class="kgrid">
    ${kpi(fmt(listed.length), "Listed crew", `${by("waiting")} waiting · ${by("draft")} drafts · ${by("hidden")} hidden`)}
    ${kpi(fmt(M.users_total), "Accounts", `+${M.users_7d} this week · +${M.users_30d} in 30 days`)}
    ${kpi(fmt(M.active_30d), "Active (30 days)", "signed in within 30 days")}
    ${kpi(fmt(M.searches_7d), "Searches this week", `${fmt(M.searches_30d)} in 30 days`)}
    ${kpi(fmt(types.size), "Aircraft types covered", "with at least one listed pilot")}
    ${kpi(fmt(M.notify_total), "Get-notified sign-ups", `+${M.notify_7d} this week · ${owners} owners/operators`)}
    ${kpi(fmt(opsListed.length), "Listed operators", `${D.ops.filter(o => D.opStatus(o) === "waiting").length} waiting · ${opsListed.filter(o => o.open_to_contract).length} open to contract crew`)}
    ${kpi(fmt(both), "Aircraft with crew and operators", "where pilots and operators meet")}
  </div>
  <h2 class="sect">Crew supply</h2>
  <div class="kgrid">
    ${kpi(fmt(now), "Available now", `${notice} more with notice`)}
    ${kpi(fmt(p135), "Part 135 current", listed.length ? Math.round(100 * p135 / listed.length) + "% of listed" : "")}
    ${kpi(fmt(ver), "FAA verified", listed.length ? Math.round(100 * ver / listed.length) + "% of listed" : "")}
    ${kpi(comp + "%", "Average profile completeness", "all profiles")}
    ${M.checklist_sync === false ? kpi("Off", "Checklist sync", "run supabase/001_checklists.sql to turn it on") : kpi(fmt(M.checklists_total), "Checklists saved", `by ${fmt(M.checklist_users)} signed-in pilots`)}
    ${kpi(fmt(M.mfa_users), "Accounts with authenticator", `${M.admins} admin${M.admins === 1 ? "" : "s"}`)}
  </div>
  <div class="cols" style="margin-top:16px">
    <section class="panel"><h2>Listed crew by type</h2>${blist(count(listed, p => (p.crew_types || []).map(t => L.type[t] || t)), listed.length)}</section>
    <section class="panel"><h2>Listed crew by region</h2>${blist(count(listed, p => L.region[(p.details || {}).region] || "Not given"), listed.length)}</section>
    <section class="panel"><h2>Top aircraft by listed crew</h2>${blist(count(listed, p => ac(p).map(a => acName(a.acft_seq))).slice(0, 10))}</section>
  </div>
  <h2 class="sect">Owner demand (last 30 days)</h2>
  <div class="cols">
    <section class="panel"><h2>Most-searched aircraft</h2>${blist(S.top_aircraft.map(r => [acName(r.acft_seq) + ` · avg ${r.avg_results} results`, r.n]))}</section>
    <section class="panel"><h2>Most-searched regions</h2>${blist(S.top_regions.map(r => [L.region[r.region] || r.region, r.n]))}</section>
    <section class="panel"><h2>Searches with zero results</h2><p class="hint">Recruit pilots for these.</p>${blist(S.zero_results.map(r => [[r.acft_seq != null ? acName(r.acft_seq) : "Any aircraft", r.region ? L.region[r.region] || r.region : "anywhere"].join(" · "), r.n]))}</section>
  </div>
  <h2 class="sect">Growth</h2>
  <div class="cols">
    <section class="panel chart"><h2>New accounts per week</h2>${bars(M.users_weekly, {title:"New accounts per week"}, "#2470B3")}</section>
    <section class="panel chart"><h2>Searches per week</h2>${bars(M.searches_weekly, {title:"Searches per week"}, "#3F6B55")}</section>
    <section class="panel"><h2>Get-notified by role</h2>${blist(Object.entries(M.notify_by_role).map(([k, v]) => [L.notify[k] || k, v]).sort((a, b) => b[1] - a[1]), M.notify_total)}</section>
  </div>
  <h2 class="sect">Plan limits</h2>
  <div class="cols">
    <section class="panel"><h2>Database size</h2><div class="meter${dbPct > 80 ? " hi" : ""}"><i style="width:${Math.max(1, dbPct)}%"></i></div><p class="hint">${(M.db_bytes / 1048576).toFixed(1)} MB of 500 MB on the free plan (${dbPct}%).</p></section>
    <section class="panel"><h2>Monthly active users</h2><div class="meter${mauPct > 80 ? " hi" : ""}"><i style="width:${Math.max(1, mauPct)}%"></i></div><p class="hint">About ${fmt(M.active_30d)} of 50,000 on the free plan.</p></section>
    <section class="panel"><h2>Sign-in emails</h2><p class="hint">Sent through Gmail: about 30 per hour. If sign-up days get busy, move to a dedicated email service.</p></section>
  </div>`;
}

function itemHTML(p, mode){
  const d = p.details || {}, m = D.mod.get(p.user_id) || {}, ac = D.acBy.get(p.user_id) || [], pend = D.pend.get(p.user_id), fl = flags(p);
  const acLine = a => { const i = BYSEQ.get(a.acft_seq); return `${esc(i ? i.name : "#" + a.acft_seq)}${a.type_rated ? " · type rated" : ""}${a.is_current ? " · current" + (a.current_until ? " through " + String(a.current_until).slice(0, 7) : "") : ""}${a.training_school ? " · " + esc(a.training_school === "other" ? a.training_other : a.training_school) : ""}${a.part135 ? " · 135 " + esc(a.part135) : ""}${a.hours ? " · " + fmt(a.hours) + " hrs" : ""}`; };
  return `<article class="item" data-id="${esc(p.user_id)}">
    <div style="display:flex;gap:12px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap">
      <label class="switch" style="font-size:15px"><input type="checkbox" class="pick" value="${esc(p.user_id)}"> <h3>${esc(p.display_name || "(no name)")}</h3></label>
      <span class="tag ${D.statusOf(p) === "listed" ? "ok" : "warn"}">${esc(D.statusOf(p))}</span></div>
    <div class="meta">${esc(D.email.get(p.user_id) || "")} · ${esc([L.cert[d.cert], L.role[d.role], d.airport, L.region[d.region]].filter(Boolean).join(" · "))} · ${p.total_time ? fmt(p.total_time) + " hrs total" : "no total time"} · updated ${day(p.updated_at)}</div>
    ${fl.length ? `<div class="flags">${fl.map(([k, t]) => `<span class="flag ${k}">${esc(t)}</span>`).join("")}</div>` : `<div class="flags"><span class="tag ok">No issues found</span></div>`}
    ${(() => { const pv = D.priv.get(p.user_id); return pv && pv.legal_last ? `<div class="old" style="color:var(--text)"><b>For the FAA check:</b> ${esc(pv.legal_last)}, ${esc(pv.legal_first)}${pv.faa_city || pv.faa_state ? " · " + esc([pv.faa_city, pv.faa_state === "XX" ? "outside the US" : pv.faa_state].filter(Boolean).join(", ")) : ""}</div>` : ""; })()}
    <div style="font-size:16px;line-height:1.6">${ac.map(acLine).join("<br>") || '<span class="empty">No aircraft</span>'}</div>
    ${pend ? `<div><b>New text waiting for review</b><div class="pend">${esc(pend.bio)}</div>${p.bio ? `<b style="display:block;margin-top:8px">Currently public</b><div class="old">${esc(p.bio)}</div>` : ""}</div>` : (p.bio ? `<div class="old">${esc(p.bio)}</div>` : "")}
    <div class="f" style="max-width:520px"><label for="n-${esc(p.user_id)}">Private note (admins only)</label><input id="n-${esc(p.user_id)}" class="note" value="${esc(m.note || "")}" maxlength="1000"></div>
    <div class="acts">
      ${mode === "text" ? `<button class="btn primary sm" data-a="approvetext">Approve new text</button><button class="btn secondary sm" data-a="declinetext">Decline new text</button>`
        : `<button class="btn primary sm" data-a="approve">Approve</button><button class="btn secondary sm" data-a="approvever">Approve + FAA verified</button>`}
      <button class="btn secondary sm" data-a="hide">${m.hidden ? "Unhide" : "Hide"}</button>
      <a class="btn secondary sm" data-a="faa" href="${FAA_URL}" target="_blank" rel="noopener">FAA registry</a>
      <a class="btn secondary sm" href="../crew/#/p/${esc(p.user_id)}" target="_blank" rel="noopener">View as public</a>
    </div></article>`;
}
const OPK = {owner:"Private owner", charter:"Charter operator (Part 135)", management:"Management company", flight_department:"Corporate flight department", school:"Flight school", other:"Other"};
function opItemHTML(o, mode){
  const d = o.details || {}, m = D.mod.get(o.user_id) || {}, ac = D.opAcBy.get(o.user_id) || [], pend = D.opPend.get(o.user_id), txt = (pend && pend.about) || o.about || "";
  const fl = []; if (!ac.length) fl.push(["bad", "No aircraft"]); if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(txt)) fl.push(["bad", "Email address in text"]); if (/(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/.test(txt)) fl.push(["bad", "Phone number in text"]); if (!d.region) fl.push(["", "No region"]);
  return `<article class="item op" data-id="${esc(o.user_id)}">
    <div style="display:flex;gap:12px;justify-content:space-between;flex-wrap:wrap"><h3>✈ ${esc(d.private || !o.name ? "Private owner" : o.name)}</h3><span class="tag ${D.opStatus(o) === "listed" ? "ok" : "warn"}">operator · ${esc(D.opStatus(o))}</span></div>
    <div class="meta">${esc(D.email.get(o.user_id) || "")} · ${esc(OPK[o.kind] || o.kind)} · ${esc([d.airport, L.region[d.region]].filter(Boolean).join(" · ") || "no base")}${o.open_to_contract ? " · open to contract crew" : ""}</div>
    ${fl.length ? `<div class="flags">${fl.map(([k, t]) => `<span class="flag ${k}">${esc(t)}</span>`).join("")}</div>` : `<div class="flags"><span class="tag ok">No issues found</span></div>`}
    <div style="font-size:16px;line-height:1.6">${ac.map(a => esc((BYSEQ.get(a.acft_seq) || {}).name || "#" + a.acft_seq) + (a.how_many > 1 ? " × " + a.how_many : "")).join("<br>") || '<span class="empty">No aircraft</span>'}</div>
    ${pend ? `<div><b>New text waiting for review</b><div class="pend">${esc(pend.about)}</div>${o.about ? `<b style="display:block;margin-top:8px">Currently public</b><div class="old">${esc(o.about)}</div>` : ""}</div>` : (o.about ? `<div class="old">${esc(o.about)}</div>` : "")}
    <div class="acts">${mode === "text" ? `<button class="btn primary sm" data-oa="approvetext">Approve new text</button><button class="btn secondary sm" data-oa="declinetext">Decline new text</button>` : `<button class="btn primary sm" data-oa="approve">Approve operator</button>`}
      <button class="btn secondary sm" data-oa="hide">${m.op_hidden ? "Unhide" : "Hide"}</button><a class="btn secondary sm" href="../crew/#/o/${esc(o.user_id)}" target="_blank" rel="noopener">View as public</a></div></article>`;
}
function viewReview(){
  const waiting = D.profiles.filter(p => D.statusOf(p) === "waiting").sort((a, b) => String(a.updated_at).localeCompare(String(b.updated_at)));
  const textOnly = D.profiles.filter(p => D.pend.has(p.user_id) && D.statusOf(p) !== "waiting");
  const listed = D.profiles.filter(p => ["listed", "hidden"].includes(D.statusOf(p)));
  const opWait = D.ops.filter(o => D.opStatus(o) === "waiting"), opText = D.ops.filter(o => D.opPend.has(o.user_id) && D.opStatus(o) !== "waiting"), opListed = D.ops.filter(o => ["listed", "hidden"].includes(D.opStatus(o)));
  return `<div class="toolbar"><button class="btn primary" id="bulk" type="button">Approve selected</button><span class="hint">Tick profiles, then approve them together. Their new text is approved too.</span></div>
  <h2 class="sect" style="margin-top:0">Waiting for review (${waiting.length})</h2>
  <div style="display:flex;flex-direction:column;gap:16px">${waiting.map(p => itemHTML(p, "new")).join("") || '<p class="empty">Nothing waiting.</p>'}</div>
  <h2 class="sect">Changed free text on listed profiles (${textOnly.length})</h2>
  <div style="display:flex;flex-direction:column;gap:16px">${textOnly.map(p => itemHTML(p, "text")).join("") || '<p class="empty">Nothing waiting.</p>'}</div>
  <h2 class="sect">Operators waiting for review (${opWait.length})</h2>
  <div style="display:flex;flex-direction:column;gap:16px">${opWait.map(o => opItemHTML(o, "new")).join("") || '<p class="empty">Nothing waiting.</p>'}</div>
  ${opText.length ? `<h2 class="sect">Changed operator text (${opText.length})</h2><div style="display:flex;flex-direction:column;gap:16px">${opText.map(o => opItemHTML(o, "text")).join("")}</div>` : ""}
  <h2 class="sect">Listed and hidden operators (${opListed.length})</h2>
  <div style="display:flex;flex-direction:column;gap:16px">${opListed.map(o => opItemHTML(o, "listed")).join("") || '<p class="empty">None yet.</p>'}</div>
  <h2 class="sect">Listed and hidden crew profiles (${listed.length})</h2>
  <div style="display:flex;flex-direction:column;gap:16px">${listed.map(p => itemHTML(p, "listed")).join("") || '<p class="empty">None yet.</p>'}</div>`;
}
function bindReview(){
  $("body").addEventListener("click", e => {
    const b = e.target.closest("[data-oa]"); if (!b) return; const id = b.closest(".item").dataset.id, m = D.mod.get(id) || {}, a = b.dataset.oa;
    if (a === "approve") return act(() => sb.rpc("admin_moderate_operator", {p_user:id, p_approved:true, p_hidden:false, p_note:m.note || "", p_approve_text:true}), "Operator approved.");
    if (a === "hide") return act(() => sb.rpc("admin_moderate_operator", {p_user:id, p_approved:!!m.op_approved, p_hidden:!m.op_hidden, p_note:m.note || "", p_approve_text:false}), m.op_hidden ? "Unhidden." : "Hidden.");
    if (a === "approvetext") return act(() => sb.rpc("admin_moderate_operator", {p_user:id, p_approved:!!m.op_approved, p_hidden:!!m.op_hidden, p_note:m.note || "", p_approve_text:true}), "New text approved.");
    if (a === "declinetext") return act(() => sb.rpc("admin_decline_operator_text", {p_user:id}), "New text declined.");
  });
  $("body").addEventListener("click", async e => {
    const b = e.target.closest("[data-a]"); if (!b) return; const it = b.closest(".item"), id = it.dataset.id, m = D.mod.get(id) || {}, note = it.querySelector(".note").value;
    const a = b.dataset.a;
    if (a === "faa") {   // a real link opens the FAA page (Safari blocks script-opened tabs); copy the last name in the same tap
      const p = D.profiles.find(x => x.user_id === id), pv = D.priv.get(id); const last = pv && pv.legal_last ? pv.legal_last : (p.display_name || "");
      try { navigator.clipboard.writeText(last).catch(() => {}); } catch (_) {}
      say(pv && pv.legal_last ? `FAA Airmen Inquiry opened in a new tab. Search: Last name "${pv.legal_last}" (copied), First name "${pv.legal_first}"${pv.faa_state && pv.faa_state !== "XX" ? `, State ${pv.faa_state}` : ""}. Match the certificate level, then come back and tap Approve + FAA verified.` : "Opened the FAA Airmen Inquiry. This pilot hasn't added a legal name yet; the profile name was copied.", true); return; }
    if (a === "approve") return act(() => sb.rpc("admin_moderate", {p_user:id, p_approved:true, p_hidden:false, p_verified:!!m.verified_faa, p_note:note, p_approve_text:true}), "Approved.");
    if (a === "approvever") return act(() => sb.rpc("admin_moderate", {p_user:id, p_approved:true, p_hidden:false, p_verified:true, p_note:note, p_approve_text:true}), "Approved and marked FAA verified.");
    if (a === "hide") return act(() => sb.rpc("admin_moderate", {p_user:id, p_approved:!!m.approved, p_hidden:!m.hidden, p_verified:!!m.verified_faa, p_note:note, p_approve_text:false}), m.hidden ? "Unhidden." : "Hidden from the directory.");
    if (a === "approvetext") return act(() => sb.rpc("admin_moderate", {p_user:id, p_approved:!!m.approved, p_hidden:!!m.hidden, p_verified:!!m.verified_faa, p_note:note, p_approve_text:true}), "New text approved.");
    if (a === "declinetext") return act(() => sb.rpc("admin_decline_text", {p_user:id}), "New text declined; the previous text stays.");
  });
  $("bulk").onclick = async () => { const ids = [...document.querySelectorAll(".pick:checked")].map(i => i.value); if (!ids.length) return say("Tick at least one profile.");
    for (const id of ids) { const m = D.mod.get(id) || {}; const r = await sb.rpc("admin_moderate", {p_user:id, p_approved:true, p_hidden:false, p_verified:!!m.verified_faa, p_note:m.note || "", p_approve_text:true}); if (r.error) return say("Stopped: " + r.error.message); }
    await refresh(`Approved ${ids.length} profile${ids.length === 1 ? "" : "s"}.`); };
}

let uq = "";
function viewUsers(){
  const rows = D.users.filter(u => !uq || (u.email + " " + u.display_name).toLowerCase().includes(uq.toLowerCase()));
  const st = u => !u.has_profile ? "" : u.hidden ? `<span class="tag bad">hidden</span>` : !u.published ? `<span class="tag">draft</span>` : u.approved ? `<span class="tag ok">listed</span>` : `<span class="tag warn">waiting</span>`;
  return `<div class="toolbar"><div class="f"><label for="uq">Search users</label><input id="uq" type="search" value="${esc(uq)}" placeholder="email or name"></div><span class="hint">${rows.length} of ${D.users.length}</span></div>
  <div class="tblwrap"><table class="tbl"><thead><tr><th>Email</th><th>Name</th><th>Joined</th><th>Last sign-in</th><th>Profile</th><th>Security</th><th>Actions</th></tr></thead><tbody>
  ${rows.map(u => `<tr data-id="${esc(u.user_id)}" data-email="${esc(u.email)}"><td>${esc(u.email)}${u.is_admin ? ' <span class="tag ok">admin</span>' : ""}</td><td>${esc(u.display_name)}</td><td>${day(u.created_at)}</td><td>${day(u.last_sign_in_at)}</td><td>${st(u)}</td><td>${u.has_mfa ? "Authenticator on" : "Email only"}${(() => { const r = D.recov.get(u.user_id); return r && (r.backup_email || r.phone) ? `<br><small>Recovery: ${esc([r.backup_email, r.phone].filter(Boolean).join(" · "))}</small>` : ""; })()}</td>
    <td><div class="acts">${u.has_profile ? `<a class="btn secondary sm" href="../crew/#/p/${esc(u.user_id)}" target="_blank" rel="noopener">View</a><button class="btn secondary sm" data-u="hide">${u.hidden ? "Unhide" : "Hide"}</button>` : ""}
      ${u.has_mfa ? `<button class="btn secondary sm" data-u="mfa">Lost phone reset</button>` : ""}
      <button class="btn secondary sm" data-u="admin">${u.is_admin ? "Remove admin" : "Make admin"}</button>
      ${u.is_admin ? "" : `<button class="btn danger sm" data-u="del">Delete</button>`}</div></td></tr>`).join("")}
  </tbody></table></div>`;
}
function bindUsers(){
  $("uq").oninput = e => { uq = e.target.value; const pos = e.target.selectionStart; render(); const el = $("uq"); el.focus(); el.setSelectionRange(pos, pos); };
  $("body").addEventListener("click", e => {
    const b = e.target.closest("[data-u]"); if (!b) return; const tr = b.closest("tr"), id = tr.dataset.id, em = tr.dataset.email, a = b.dataset.u, m = D.mod.get(id) || {};
    if (a === "hide") return act(() => sb.rpc("admin_moderate", {p_user:id, p_approved:!!m.approved, p_hidden:!m.hidden, p_verified:!!m.verified_faa, p_note:m.note || "", p_approve_text:false}), m.hidden ? "Unhidden." : "Hidden.");
    if (a === "mfa") { if (!confirm(`Remove Microsoft Authenticator from ${em}?\n\nOnly do this after confirming who they are outside email (phone call, someone you know, FAA registry). They will sign in with an email code and can set it up again.`)) return;
      return act(() => sb.rpc("admin_remove_mfa", {p_user:id}), "Authenticator removed. They can sign in with an email code now."); }
    if (a === "admin") { const make = b.textContent.startsWith("Make"); if (!confirm(make ? `Give ${em} full admin access?` : `Remove admin access from ${em}?`)) return;
      return act(() => sb.rpc("admin_set_admin", {p_user:id, p_make:make}), make ? "Admin access given." : "Admin access removed."); }
    if (a === "del") { const typed = prompt(`Delete ${em} permanently?\n\nThis removes their account, profile, aircraft and synced checklists. It cannot be undone.\n\nType their email address to confirm:`); if (typed == null) return;
      return act(() => sb.rpc("admin_delete_user", {p_user:id, p_confirm_email:typed}), "Account deleted."); }
  });
}

let roleF = "";
function csv(rows, cols){ const q = v => { const s = String(v ?? ""); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }; return [cols.join(","), ...rows.map(r => cols.map(c => q(r[c])).join(","))].join("\n"); }
function download(name, text, type){ const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], {type})); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }
function viewSignups(){
  const rows = D.notify.filter(n => !roleF || (n.role || "unknown") === roleF);
  return `<div class="toolbar"><div class="f"><label for="rf">Role</label><select id="rf"><option value="">All roles</option>${Object.entries(L.notify).map(([k, v]) => `<option value="${k}"${k === roleF ? " selected" : ""}>${v}</option>`).join("")}</select></div>
    <button class="btn primary" id="dl" type="button">Download spreadsheet (CSV)</button><span class="hint">${rows.length} sign-ups</span></div>
  <div class="tblwrap"><table class="tbl"><thead><tr><th>Email</th><th>Role</th><th>Signed up</th><th></th></tr></thead><tbody>
  ${rows.map(n => `<tr><td>${esc(n.email)}</td><td>${esc(L.notify[n.role || "unknown"] || n.role)}</td><td>${day(n.created_at)}</td><td><button class="btn secondary sm" data-n="${n.id}">Remove</button></td></tr>`).join("")}</tbody></table></div>`;
}
function bindSignups(){
  $("rf").onchange = e => { roleF = e.target.value; render(); };
  $("dl").onclick = () => download("cali-aircrew-signups.csv", csv(D.notify.filter(n => !roleF || (n.role || "unknown") === roleF).map(n => ({...n, role:L.notify[n.role || "unknown"] || n.role})), ["email", "role", "created_at"]), "text/csv");
  $("body").addEventListener("click", e => { const b = e.target.closest("[data-n]"); if (!b || !confirm("Remove this sign-up?")) return; act(() => sb.from("notify_signups").delete().eq("id", +b.dataset.n), "Removed."); });
}

function viewRequests(){
  return `<h2 class="sect" style="margin-top:0">Sign-in help and partner inquiries</h2>
  <p class="hint">Confirm who they are <b>outside email</b> (phone call, someone you know, FAA registry, their saved recovery contacts in Users) before changing anything. Then use Users → Lost phone reset, or ask Steve/Claude to move their account to a new email.</p>
  <div class="tblwrap"><table class="tbl"><thead><tr><th>Received</th><th>Reply to</th><th>What happened</th><th>Status</th><th></th></tr></thead><tbody>
  ${D.help.map(r => `<tr><td>${day(r.created_at)}</td><td>${esc(r.email)}</td><td>${esc(r.message)}</td><td><span class="tag ${r.status === "open" ? "warn" : "ok"}">${esc(r.status)}</span></td><td>${r.status === "open" ? `<button class="btn secondary sm" data-h="${r.id}">Mark done</button>` : ""}</td></tr>`).join("") || '<tr><td colspan="5" class="empty">No requests.</td></tr>'}
  </tbody></table></div>
  <h2 class="sect">Aircraft requests</h2>
  <div class="tblwrap"><table class="tbl"><thead><tr><th>Request</th><th>From</th><th>Date</th><th>Status</th><th></th></tr></thead><tbody>
  ${D.acreq.map(r => `<tr><td>${esc(r.request)}</td><td>${esc(D.email.get(r.user_id) || "")}</td><td>${day(r.created_at)}</td><td><span class="tag ${r.status === "open" ? "warn" : r.status === "added" ? "ok" : ""}">${esc(r.status)}</span></td>
    <td><div class="acts">${r.status === "open" ? `<button class="btn secondary sm" data-r="${r.id}" data-s="added">Added</button><button class="btn secondary sm" data-r="${r.id}" data-s="declined">Decline</button>` : `<button class="btn secondary sm" data-r="${r.id}" data-s="open">Reopen</button>`}</div></td></tr>`).join("") || '<tr><td colspan="5" class="empty">No requests yet.</td></tr>'}
  </tbody></table></div><p class="hint">When you mark one Added, tell Claude or Steve the aircraft so it goes into the aircraft list.</p>
  <h2 class="sect">Privacy requests (California CCPA)</h2>
  <section class="panel"><h2>Log a request</h2><p class="hint">Record each request to see, correct or delete someone's data, or to opt out, and mark it done once handled (within 45 days).</p>
    <div class="fgrid"><div class="f"><label for="pe">Email</label><input id="pe" type="email" maxlength="254"></div>
    <div class="f"><label for="pk">Request</label><select id="pk"><option value="access">See my data</option><option value="delete">Delete my data</option><option value="correct">Correct my data</option><option value="opt_out">Opt out</option></select></div>
    <div class="f"><label for="pn">Notes</label><input id="pn" maxlength="1000"></div></div><div><button class="btn primary" id="padd" type="button">Add request</button></div></section>
  <div class="tblwrap" style="margin-top:16px"><table class="tbl"><thead><tr><th>Received</th><th>Email</th><th>Request</th><th>Notes</th><th>Status</th><th></th></tr></thead><tbody>
  ${D.privacy.map(r => `<tr><td>${day(r.received_on)}</td><td>${esc(r.email)}</td><td>${esc({access:"See data", delete:"Delete data", correct:"Correct data", opt_out:"Opt out"}[r.kind])}</td><td>${esc(r.notes)}</td>
    <td>${r.status === "done" ? `<span class="tag ok">done ${day(r.completed_on)}</span>` : `<span class="tag warn">open · due ${day(new Date(new Date(r.received_on).getTime() + 45 * 864e5))}</span>`}</td>
    <td>${r.status === "open" ? `<button class="btn secondary sm" data-p="${r.id}">Mark done</button>` : ""}</td></tr>`).join("") || '<tr><td colspan="6" class="empty">No requests logged.</td></tr>'}
  </tbody></table></div>`;
}
function bindRequests(){
  $("body").addEventListener("click", e => {
    const hq = e.target.closest("[data-h]"); if (hq) return act(() => sb.from("help_requests").update({status:"done"}).eq("id", +hq.dataset.h), "Marked done.");
    const r = e.target.closest("[data-r]"); if (r) return act(() => sb.from("aircraft_requests").update({status:r.dataset.s}).eq("id", +r.dataset.r), "Updated.");
    const p = e.target.closest("[data-p]"); if (p) return act(() => sb.from("privacy_requests").update({status:"done", completed_on:new Date().toISOString().slice(0, 10)}).eq("id", +p.dataset.p), "Marked done.");
  });
  $("padd").onclick = () => { const email = $("pe").value.trim(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return say("Enter the requester's email.");
    act(() => sb.from("privacy_requests").insert({email, kind:$("pk").value, notes:$("pn").value.trim()}), "Request logged."); };
}

function viewSite(){
  const B = D.banner;
  return `<section class="panel"><h2>Announcement banner</h2><p class="hint">Shows at the top of the homepage, crew pages and checklist builder.</p>
    <label class="switch"><input type="checkbox" id="bon"${B.on ? " checked" : ""}> Show the banner</label>
    <div class="fgrid"><div class="f" style="grid-column:span 2"><label for="btx">Message (up to 200 characters)</label><input id="btx" maxlength="200" value="${esc(B.text)}" placeholder="e.g. The crew directory is now open in Arizona!"></div>
    <div class="f"><label for="bk">Style</label><select id="bk"><option value="info"${B.kind !== "warn" ? " selected" : ""}>Information (blue)</option><option value="warn"${B.kind === "warn" ? " selected" : ""}>Notice (amber)</option></select></div></div>
    <div><button class="btn primary" id="bsave" type="button">Save banner</button></div></section>
  <section class="panel" style="margin-top:16px"><h2>Partners</h2><p class="hint">Shown in the Partners strip on the homepage while active and not past their end date. Label paid listings as sponsored in your agreements.</p>
    <div class="fgrid"><div class="f"><label for="pna">Name</label><input id="pna" maxlength="80"></div>
      <div class="f"><label for="pca">Category</label><select id="pca"><option value="insurance">Insurance</option><option value="training">Simulator / training</option><option value="school">Flight school</option><option value="fbo">FBO</option><option value="maintenance">Maintenance</option><option value="other">Other</option></select></div>
      <div class="f"><label for="pur">Website (https://…)</label><input id="pur" maxlength="200" placeholder="https://"></div>
      <div class="f"><label for="pen">Ends on (optional)</label><input id="pen" type="date"></div></div>
    <div><button class="btn primary" id="padd2" type="button">Add partner</button></div>
    <div class="tblwrap"><table class="tbl"><thead><tr><th>Name</th><th>Category</th><th>Website</th><th>Ends</th><th>Status</th><th></th></tr></thead><tbody>
    ${D.partners.map(p => `<tr><td>${esc(p.name)}</td><td>${esc(p.category)}</td><td>${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.url)}</a>` : ""}</td><td>${p.ends_on ? day(p.ends_on) : "—"}</td>
      <td>${p.active && (!p.ends_on || p.ends_on >= new Date().toISOString().slice(0, 10)) ? '<span class="tag ok">showing</span>' : '<span class="tag">off</span>'}</td>
      <td><div class="acts"><button class="btn secondary sm" data-pt="${p.id}" data-on="${p.active ? 0 : 1}">${p.active ? "Turn off" : "Turn on"}</button><button class="btn danger sm" data-ptd="${p.id}">Delete</button></div></td></tr>`).join("") || '<tr><td colspan="6" class="empty">No partners yet.</td></tr>'}
    </tbody></table></div></section>`;
}
function bindSite(){
  $("bsave").onclick = () => act(() => sb.rpc("admin_set_banner", {p_on:$("bon").checked, p_text:$("btx").value.trim(), p_kind:$("bk").value}), "Banner saved.");
  $("padd2").onclick = () => { const name = $("pna").value.trim(), url = $("pur").value.trim(); if (!name) return say("Enter the partner's name."); if (url && !/^https:\/\/\S+$/i.test(url)) return say("The website must start with https://");
    act(() => sb.from("partners").insert({name, category:$("pca").value, url, ends_on:$("pen").value || null}), "Partner added."); };
  $("body").addEventListener("click", e => {
    const t = e.target.closest("[data-pt]"); if (t) return act(() => sb.from("partners").update({active:t.dataset.on === "1"}).eq("id", +t.dataset.pt), "Updated.");
    const d = e.target.closest("[data-ptd]"); if (d && confirm("Delete this partner?")) return act(() => sb.from("partners").delete().eq("id", +d.dataset.ptd), "Deleted.");
  });
}

function viewAudit(){
  const what = {self_delete:"Member deleted own account", moderate_operator:"Operator review", decline_operator_text:"Declined operator text", moderate:"Review decision", decline_text:"Declined new text", remove_authenticator:"Lost phone reset", make_admin:"Made admin", remove_admin:"Removed admin", delete_account:"Deleted account", banner:"Changed banner"};
  return `<p class="hint">The latest 300 admin actions. Entries can't be edited or deleted from here.</p><div class="tblwrap"><table class="tbl"><thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Account</th><th>Details</th></tr></thead><tbody>
  ${D.audit.map(a => `<tr><td>${esc(new Date(a.at).toLocaleString("en-US"))}</td><td>${esc(a.admin_email)}</td><td>${esc(what[a.action] || a.action)}</td><td>${esc(a.target_email)}</td><td><small>${esc(Object.entries(a.detail || {}).map(([k, v]) => k + ": " + v).join(", "))}</small></td></tr>`).join("") || '<tr><td colspan="5" class="empty">Nothing yet.</td></tr>'}
  </tbody></table></div>`;
}

function viewBackup(){
  return `<section class="panel"><h2>Download a backup</h2><p class="hint" style="font-size:16px">One file with everything in the directory: accounts (email, dates), crew profiles, aircraft, review decisions, pending text, sign-ups, requests, partners, banner and the audit log. Pilots' personal checklists are not included (they're private to each pilot). Keep the file somewhere safe; it contains personal information.</p>
    <div><button class="btn primary" id="bk1" type="button">Download backup (JSON)</button></div>
    <p class="hint">Also: Supabase keeps its own daily backups on paid plans. On the free plan, download one of these regularly, for example monthly.</p></section>`;
}
function bindBackup(){
  $("bk1").onclick = () => { const out = {exported_at:new Date().toISOString(), exported_by:user.email, users:D.users, crew_profiles:D.profiles, crew_aircraft:[...D.acBy.values()].flat(), moderation:[...D.mod.values()], crew_bio_pending:[...D.pend.values()],
      crew_private:[...D.priv.values()], operator_profiles:D.ops, operator_aircraft:[...D.opAcBy.values()].flat(), operator_about_pending:[...D.opPend.values()], notify_signups:D.notify, aircraft_requests:D.acreq, privacy_requests:D.privacy, partners:D.partners, banner:D.banner, admin_audit:D.audit};
    download("cali-aircrew-backup-" + new Date().toISOString().slice(0, 10) + ".json", JSON.stringify(out, null, 1), "application/json"); say("Backup downloaded.", true); };
}

function render(){
  const v = {dash:[viewDash], review:[viewReview, bindReview], users:[viewUsers, bindUsers], signups:[viewSignups, bindSignups], requests:[viewRequests, bindRequests], site:[viewSite, bindSite], audit:[viewAudit], backup:[viewBackup, bindBackup]}[tab] || [viewDash];
  shell(v[0]()); if (v[1]) v[1]();
}
async function start(){
  if (!(await gate())) return;
  app.innerHTML = `<p>Loading admin data…</p>`;
  try { await load(); } catch (e) {
    app.innerHTML = `<div class="center"><h1>Admin needs one setup step</h1><p>Run <b>supabase/007_admin.sql</b> in the Supabase SQL Editor, then reload this page.</p><p class="hint">${esc(e.message || e)}</p></div>`; return; }
  tab = (location.hash.slice(1) || "dash"); render();
}
window.addEventListener("hashchange", () => { tab = location.hash.slice(1) || "dash"; if (D) render(); });
start();
})();
