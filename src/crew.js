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
  languages:[["en","English"],["es","Spanish"],["fr","French"],["pt","Portuguese"],["de","German"],["zh","Mandarin"],["other","Other"]],
  rate:[["u500","Under $500"],["500","$500–750"],["750","$750–1,000"],["1000","$1,000–1,250"],["1250","$1,250–1,500"],["1500","$1,500–2,000"],["2000","$2,000–2,500"],["2500","$2,500–3,000"],["3000","$3,000 or more"],["ask","Ask me"]],
  rate_max:[["750","Up to $750"],["1000","Up to $1,000"],["1250","Up to $1,250"],["1500","Up to $1,500"],["2000","Up to $2,000"],["2500","Up to $2,500"],["3000","Up to $3,000"]],
  fa_school:[["facts","FACTS Training"],["flightsafety","FlightSafety"],["cae","CAE"],["company","Company / flight department"],["other","Other"]],
  fa_skills:[["intl","International trips"],["catering","Catering coordination"],["culinary","Culinary / chef training"],["wine","Wine service"],["galley","Galley management"],["vip","VIP / head-of-state service"],["medical","EMT / medical training"],["security","Security awareness training"]],
  mx_certs:[["ap","A&P"],["ia","IA (Inspection Authorization)"],["repairman","Repairman certificate"],["fcc","FCC GROL (avionics)"]],
  mx_engines:[["pt6","Pratt & Whitney PT6"],["pw300","Pratt & Whitney PW300"],["pw500","Pratt & Whitney PW500 / PW600"],["fj44","Williams FJ44"],["tfe731","Honeywell TFE731"],["htf7000","Honeywell HTF7000"],["br700","Rolls-Royce BR700"],["m250","Rolls-Royce M250 / RR300"],["arriel","Safran Arriel / Arrius"],["piston","Lycoming / Continental piston"]],
  mx_spec:[["avionics","Avionics"],["powerplant","Engines / powerplant"],["airframe","Airframe / structures"],["composites","Sheet metal & composites"],["interiors","Interiors"],["inspections","Inspections (phase / annual)"],["ndt","NDT"],["aog","AOG troubleshooting"]],
  mx_exp:[["p91","Part 91 maintenance"],["p135","Part 135 maintenance"],["p145","Part 145 repair station"],["factory","Factory service center"],["fltdept","Corporate flight department"]],
  heli_ops:[["nvg","Night vision goggles (NVG)"],["longline","Long line / external load"],["ems","EMS / air medical"],["tours","Tours"],["utility","Utility / powerline"],["fire","Firefighting (agency carded)"],["mountain","Mountain / high altitude"],["offshore","Offshore / over water"],["law","Law enforcement"],["eng","News / ENG"],["ag","Agricultural"]],
  sfar73:[["r22","R22 PIC endorsement (SFAR 73)"],["r44","R44 PIC endorsement (SFAR 73)"]],
  training:[["rvsm","RVSM"],["nat","Oceanic / NAT HLA"],["pacific","Pacific crossing"],["intl","International procedures"],["cpdlc","CPDLC / FANS datalink"],["uprt","Upset prevention (UPRT)"],["highalt","High-altitude training"],["hud","HUD / EVS"]],
  minhrs:[["250","250+"],["500","500+"],["1000","1,000+"],["1500","1,500+"],["2500","2,500+"],["3000","3,000+"],["5000","5,000+"],["10000","10,000+"]],
  nearnm:[["50","Within 50 nm"],["100","Within 100 nm"],["200","Within 200 nm"],["300","Within 300 nm"]],
  jobkind:[["p135","Part 135 charter"],["p91k","Fractional (Part 91K)"],["corp","Corporate flight department"],["mgmt","Management company"],["owner","Private owner"],["p121","Airline (Part 121)"],["school","Flight school"],["ems","EMS / air medical"],["military","Military"],["gov","Government / agency"],["contract","Self-employed contract"],["other","Other"]],
  jobrole:[["captain","Captain / PIC"],["fo","First officer / SIC"],["chief","Chief pilot"],["doa","Director of operations / aviation"],["cfi","Flight instructor"],["fa","Flight attendant"],["mech","Mechanic"],["dom","Director of maintenance"],["other","Other"]]
};
/* Company names show publicly without review, so anything that looks like contact details is never shown. */
const CONTACTISH = /@|https?:|www\.|\.(com|net|org|io)\b|\d{3}[\s.)-]*\d{3}[\s.-]*\d{4}/i;
const psText = (d, seq) => { const pi = (d.ac_pic || {})[seq], si = (d.ac_sic || {})[seq]; return [pi ? "PIC " + fmt(pi) : "", si ? "SIC " + fmt(si) : ""].filter(Boolean).join(" · "); };
/* ---- shared matching rules (src/match.js, inserted by build.py) ---- */
/*{{MATCH_JS}}*/
const hoursByType = aircraft => hoursByTypeWith(sq => BYSEQ.get(sq), aircraft);
/* FAA type rating designators per aircraft seq: [[designator, single-pilot designator or ""], ...] (data/type-ratings.yaml) */
const TR = {{TR_JSON}};
const ENV = {info:sq => BYSEQ.get(sq), ll:code => airportLL(code), tr:sq => TR[sq] || null};
const TR_ALL = [...new Set(Object.values(TR).flat().flatMap(o => [o[0], o[1]]).filter(Boolean))].sort();
/* "CE-525S" / "CE-560XL" for one aircraft row (empty when the aircraft has no FAA type rating) */
const trOf = (d, a) => { const o = TR[a.acft_seq]; if (!o || !a.type_rated) return ""; const pick = o.find(x => x[0] === (d.tr_des || {})[a.acft_seq]) || o[0]; return pick[1] && (d.tr_sp || {})[a.acft_seq] ? pick[1] : pick[0]; };
/* Airport code -> "City, ST" (OurAirports, public domain), loaded once when a page needs it. */
let AIRPORTS = null, airportsP = null;
const loadAirports = () => airportsP || (airportsP = fetch("airports.json").then(r => r.ok ? r.json() : {}).catch(() => ({})).then(m => (AIRPORTS = m)));
const airportRec = code => { const c = String(code || "").toUpperCase().trim(); return AIRPORTS && c ? (AIRPORTS[c] || AIRPORTS["K" + c] || (c.length === 4 && c[0] === "K" ? AIRPORTS[c.slice(1)] : "") || "") : ""; };
const airportCity = code => airportRec(code).split("|")[0] || "";
const airportLL = code => { const p = airportRec(code).split("|"); return p.length === 3 ? [+p[1], +p[2]] : null; };
/* "Current through" month: dropdown of months from 1 year ago to 3 years ahead (value YYYY-MM). */
const monthOpts = val => { const n = new Date(), out = ['<option value="">Not current / not sure</option>'];
  for (let i = -12; i <= 36; i++) { const d = new Date(n.getFullYear(), n.getMonth() + i, 1), v = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); out.push(`<option value="${v}"${v === val ? " selected" : ""}>${MONTHS[d.getMonth()]} ${d.getFullYear()}</option>`); }
  if (val && !out.some(o => o.includes(`"${val}"`))) out.splice(1, 0, `<option value="${val}" selected>${ymText(val + "-01")}</option>`);
  return out.join(""); };
const yearOpts = val => { const y = new Date().getFullYear(); let h = '<option value="">Choose…</option>'; for (let i = y; i >= 1980; i--) h += `<option value="${i}"${String(i) === String(val) ? " selected" : ""}>${i}</option>`; return h; };
const throughText = v => v ? (v < thisYM() ? "expired " + ymText(v + "-01") : "current through " + ymText(v + "-01")) : "";
const rateText = d => !d.rate ? "" : d.rate === "ask" ? "Ask me" : lbl("rate", d.rate) + " per day" + (d.rate_exp ? " + expenses" : "") + (d.rate_neg ? " · negotiable" : "");
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
let FAV = null, favFor = null;   // Set of favorite crew ids for the signed-in member (null when signed out or not set up)
async function loadFav(){ if (!sb || !user) { FAV = null; favFor = null; return; } if (favFor === user.id && FAV) return;
  const {data, error} = await sb.from("favorites").select("crew_id"); FAV = error ? null : new Set((data || []).map(r => r.crew_id)); favFor = user.id; }
function toast(t){ let el = document.getElementById("toast"); if (!el) { el = document.createElement("div"); el.id = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
  el.textContent = t; el.className = "show"; clearTimeout(el._t); el._t = setTimeout(() => { el.className = ""; }, 2600); }
async function shareProfile(id, name){ const url = location.origin + location.pathname + "#/p/" + id;
  try { if (navigator.share) { await navigator.share({title:(name || "Crew profile") + " · Cali Aircrew", url}); return; } } catch (e) { if (e && e.name === "AbortError") return; }
  try { await navigator.clipboard.writeText(url); toast("Link copied"); } catch (_) { prompt("Copy this link:", url); } }
document.addEventListener("click", async e => {
  const sh = e.target.closest("[data-share]"); if (sh) { e.preventDefault(); shareProfile(sh.dataset.share, sh.dataset.name); return; }
  const fv = e.target.closest("[data-fav]"); if (!fv) return; e.preventDefault();
  if (!user) { signIn(route); return; } await loadFav(); if (!FAV) { toast("Saving crew switches on after a Cali Aircrew setup step."); return; }
  const id = fv.dataset.fav, on = FAV.has(id);
  const {error} = on ? await sb.from("favorites").delete().eq("crew_id", id) : await sb.from("favorites").insert({crew_id:id});
  if (error) { toast("Couldn't save: " + error.message); return; }
  on ? FAV.delete(id) : FAV.add(id); document.querySelectorAll(`[data-fav="${id}"]`).forEach(b => { b.textContent = FAV.has(id) ? "★ Saved" : "☆ Save"; b.setAttribute("aria-pressed", String(FAV.has(id))); });
  toast(FAV.has(id) ? "Saved to your list" : "Removed from your list");
  document.querySelectorAll(`.res[data-id="${id}"] .rname`).forEach(n => { n.querySelector("span[title=Saved]")?.remove(); if (FAV.has(id)) n.insertAdjacentHTML("beforeend", ' <span title="Saved" aria-label="Saved">★</span>'); });
});
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
function signIn(after, presetEmail){
  const m = modal(`<h2>Sign in</h2><p class="hint" style="margin:0">Same sign-in as the checklist builder. We email you a code; no passwords.</p><div id="si"></div><div class="err" id="sim" role="status"></div><button class="btn secondary" id="six" type="button">Close</button><p class="hint" style="margin:0"><a href="#" id="sirec">Locked out of your email? Use your backup email</a> · <a href="#" id="sihelp">Can't get in? Ask Cali Aircrew</a></p>`);
  m.querySelector("#sirec").onclick = e => { e.preventDefault(); m.remove(); recoverFlow(); };
  m.querySelector("#sihelp").onclick = e => { e.preventDefault(); m.remove(); helpRequest(); };
  const box = m.querySelector("#si"), msg = t => { m.querySelector("#sim").textContent = t || ""; };
  m.querySelector("#six").onclick = () => m.remove();
  let email = presetEmail || "";
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
let IS_ADMIN = false;
function showAdmin(){ const al = $("adminLink"); if (al) al.hidden = !IS_ADMIN; document.querySelectorAll(".adminbtn").forEach(b => b.hidden = !IS_ADMIN); }
async function contactCall(body){
  // Calls the "contact" Edge Function. Returns {ok, message}.
  try {
    const {data, error} = await sb.functions.invoke("contact", {body});
    if (!error) return data || {ok:false, message:"No answer"};
    let j = null; try { j = await error.context.json(); } catch (_) {}
    return j && j.message ? j : {ok:false, message:"Contact requests aren't switched on yet."};
  } catch (e) { return {ok:false, message:"Contact requests aren't available right now."}; }
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-contact]"); if (!b) return; e.preventDefault();
  if (!user) { signIn(route); return; }
  if (b.dataset.contact === user.id) { toast("That's your own profile."); return; }
  const seqs = (b.dataset.ac || "").split(",").filter(Boolean).map(Number).filter(n => BYSEQ.has(n)), ctx = b.dataset.ctx;
  const m = modal(`<h2>Contact ${esc(b.dataset.name || "this pilot")}</h2>
    <p class="hint" style="margin:0">They get your note by email from Cali Aircrew. If they're interested they reply to you directly; their address stays private until they do.</p>
    ${seqs.length ? `<div class="f"><label for="cta">About which aircraft? (optional)</label><select id="cta"><option value="">Not about a specific aircraft</option>${seqs.map(n => `<option value="${n}"${String(n) === ctx ? " selected" : ""}>${esc(BYSEQ.get(n).name)}</option>`).join("")}</select></div>` : ""}
    <div class="f"><label for="ctn">Your note</label><textarea id="ctn" maxlength="500" rows="5" placeholder="Dates, route, what you need. No phone numbers, emails or links."></textarea><small id="ctc">0 / 500</small></div>
    <p class="hint" style="margin:0">Your email (${esc(user.email || "")}) is shared with this pilot as the reply address.</p>
    <div class="err" id="ctm" role="status"></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn primary" id="cts" type="button">Send</button><button class="btn secondary" id="ctq" type="button">Cancel</button></div>`);
  const n = m.querySelector("#ctn"), msg = t => { m.querySelector("#ctm").textContent = t; };
  n.oninput = () => { m.querySelector("#ctc").textContent = n.value.length + " / 500"; msg(CONTACTISH.test(n.value) ? "Leave out phone numbers, email addresses and links. The pilot can reply to you by email." : ""); };
  m.querySelector("#ctq").onclick = () => m.remove();
  m.querySelector("#cts").onclick = async () => {
    const note = n.value.trim(); if (!note) return msg("Write a short note."); if (CONTACTISH.test(note)) return msg("Leave out phone numbers, email addresses and links.");
    const go = m.querySelector("#cts"); go.disabled = true; go.textContent = "Sending…";
    const sel = m.querySelector("#cta"), r = await contactCall({action:"send", to:b.dataset.contact, note, seq:sel && sel.value ? +sel.value : null});
    go.disabled = false; go.textContent = "Send";
    if (!r.ok) return msg(r.message);
    m.querySelector(".box2").innerHTML = `<h2>Sent</h2><p>${esc(r.message)}</p><button class="btn primary" type="button" id="ctd">Done</button>`; m.querySelector("#ctd").onclick = () => m.remove();
  };
});
async function viewReport(rest){
  const [id, code] = rest.split("/");
  app.innerHTML = `<div class="center" style="max-width:560px"><h1>Report a contact request</h1><p>Tell Cali Aircrew what was wrong with it (optional). The sender isn't told who reported it.</p>
    <div class="f" style="text-align:left"><label for="rpr">What happened?</label><textarea id="rpr" maxlength="500" rows="4" placeholder="e.g. spam, rude, not a real job"></textarea></div>
    <div class="err" id="rpm" role="status"></div><button class="btn primary" id="rps" type="button">Send report</button></div>`;
  $("rps").onclick = async () => { $("rps").disabled = true;
    const r = await contactCall({action:"report", id, code, reason:$("rpr").value.trim()});
    if (!r.ok) { $("rps").disabled = false; $("rpm").textContent = r.message; return; }
    app.innerHTML = `<div class="center"><h1>Thank you</h1><p>${esc(r.message)}</p><a class="btn secondary" href="#/">Back to the crew directory</a></div>`; };
}
async function recoveryCall(body){
  // Calls the "recovery" Edge Function. Returns {ok, message, ...}. Works signed in or out.
  try {
    const {data, error} = await sb.functions.invoke("recovery", {body});
    if (!error) return data || {ok:false, message:"No answer"};
    let j = null; try { j = await error.context.json(); } catch (_) {}
    if (j && j.message) return j;
    return {ok:false, off:true, message:"Self-service recovery isn't switched on yet. Use \"Can't get in? Ask Cali Aircrew\" instead."};
  } catch (e) { return {ok:false, off:true, message:"Self-service recovery isn't available right now. Use \"Can't get in? Ask Cali Aircrew\" instead."}; }
}
function recoverFlow(){
  const m = modal(`<h2>Use your backup email</h2><div id="rf"></div><div class="err" id="rfm" role="status"></div><div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn secondary" id="rfx" type="button">Close</button></div>
    <p class="hint" style="margin:0"><a href="#" id="rfh">Still stuck? Ask Cali Aircrew</a></p>`);
  const box = m.querySelector("#rf"), msg = (t, ok) => { const e = m.querySelector("#rfm"); e.className = ok ? "okmsg" : "err"; e.textContent = t || ""; };
  m.querySelector("#rfx").onclick = () => m.remove(); m.querySelector("#rfh").onclick = e => { e.preventDefault(); m.remove(); helpRequest(); };
  let email = "";
  box.innerHTML = `<p style="margin:0">If you confirmed a backup email on your Account page, we'll send a code there and make it your new sign-in email.</p>
    <div class="f" style="margin-top:12px"><label for="rfe">The email you used to sign in</label><input id="rfe" type="email" autocomplete="email" autocapitalize="none"></div><button class="btn primary" id="rfs" type="button" style="width:100%;margin-top:12px">Send a code to my backup email</button>`;
  m.querySelector("#rfs").onclick = async () => { email = m.querySelector("#rfe").value.trim().toLowerCase(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return msg("Enter the email you used to sign in.");
    m.querySelector("#rfs").disabled = true; const r = await recoveryCall({action:"recover_start", email}); m.querySelector("#rfs").disabled = false;
    if (!r.ok) return msg(r.message); msg(r.message, true);
    box.innerHTML = `<div class="f"><label for="rfc">6-digit code from your backup email</label><input id="rfc" inputmode="numeric" autocomplete="one-time-code" maxlength="6"></div><button class="btn primary" id="rfv" type="button" style="width:100%;margin-top:12px">Make my backup my sign-in email</button>`;
    m.querySelector("#rfv").onclick = async () => { const code = m.querySelector("#rfc").value.trim(); if (!/^\d{6}$/.test(code)) return msg("Enter the 6-digit code.");
      m.querySelector("#rfv").disabled = true; const f = await recoveryCall({action:"recover_finish", email, code}); m.querySelector("#rfv").disabled = false;
      if (!f.ok) return msg(f.message); msg("");
      box.innerHTML = `<p style="margin:0">✓ ${esc(f.message)}</p><button class="btn primary" id="rfgo" type="button" style="width:100%;margin-top:12px">Sign in with ${esc(f.new_email || "my backup email")}</button>`;
      m.querySelector("#rfgo").onclick = () => { m.remove(); signIn(route, f.new_email || ""); }; }; };
}
function helpRequest(){
  const m = modal(`<h2>Can't get in?</h2><p class="hint" style="margin:0">Lost access to your email or your phone? Tell us and Cali Aircrew will contact you to confirm it's you, usually within a day or two. We never ask for passwords or codes.</p>
    <div class="f"><label for="hre">Email you can read now</label><input id="hre" type="email" autocomplete="email" autocapitalize="none" maxlength="254"></div>
    <div class="f"><label for="hrm">What happened (include your old sign-in email)</label><textarea id="hrm" maxlength="1000" style="min-height:110px"></textarea></div>
    <div class="err" id="hrx" role="status"></div><div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn primary" id="hrs" type="button">Send</button><button class="btn secondary" id="hrc" type="button">Cancel</button></div>`);
  m.querySelector("#hrc").onclick = () => m.remove();
  m.querySelector("#hrs").onclick = async () => { const email = m.querySelector("#hre").value.trim(), message = m.querySelector("#hrm").value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { m.querySelector("#hrx").textContent = "Enter an email you can read now."; return; }
    const {error} = sb ? await sb.from("help_requests").insert({email, message, kind:"locked_out"}) : {error:true};
    if (error) { m.querySelector("#hrx").textContent = "Couldn't send it right now. Please try again later."; return; }
    m.querySelector(".box2").innerHTML = `<h2>Request sent</h2><p style="margin:0">Cali Aircrew will email ${esc(email)} to confirm it's you. Watch for it, including your spam folder.</p><button class="btn primary" type="button" id="hrok">Done</button>`;
    m.querySelector("#hrok").onclick = () => m.remove(); };
}
function drawAcct(){ const b = $("acctBtn"); if (!b) return; b.textContent = user ? "My profile" : "Sign in";
  IS_ADMIN = false; showAdmin();
  if (user && sb) sb.rpc("is_admin").then(r => { IS_ADMIN = !!(r && r.data === true); showAdmin(); }, () => {}); }
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
  const city = airportCity(d.airport);
  const base = [d.airport ? d.airport + (city ? " · " + city : "") : "", lbl("region", d.region)].filter(Boolean).join(" · ") || p.home_base;
  const ac = (aircraft || []).map(a => ({...a, info:BYSEQ.get(a.acft_seq)})).filter(a => a.info).sort((x, y) => (y.hours || 0) - (x.hours || 0));
  const past = new Set(d.past || []), nowAc = ac.filter(a => !past.has(a.acft_seq)), pastAc = ac.filter(a => past.has(a.acft_seq));
  const types0 = p.crew_types || [], isFA = types0.includes("flight_attendant"), isMX = types0.includes("mechanic"), isHeli = types0.includes("helicopter_pilot");
  const pilotish = types0.some(t => /pilot|cfi/.test(t)), faOnly = isFA && !pilotish && !isMX;
  const trLabel = isMX && !pilotish ? "factory trained" : faOnly ? "trained on type" : "type rated";
  const acRow = a => { const r = (d.ac_rate || {})[a.acft_seq]; return `<div class="row"><span>${esc(a.info.name)}${a.type_rated ? " · " + (trOf(d, a) && trLabel === "type rated" ? "type rated " + trOf(d, a) : trLabel) : ""}${esc(curText(a))}${a.part135 ? " · 135 " + esc(a.part135) : ""}${r && r !== "ask" ? ` · <b>${esc(lbl("rate", r))}/day</b>` : ""}</span><b>${a.hours ? fmt(a.hours) + " hrs" : ""}${psText(d, a.acft_seq) ? `<small style="display:block;font-weight:400">${esc(psText(d, a.acft_seq))}</small>` : ""}</b></div>`; };
  const HT = hoursByType(aircraft);
  const hrs = [["Total", p.total_time], ["PIC", d.hrs_pic], ["Turbine", HT.turbine], ["Jet", HT.jet], ["Turboprop", HT.turboprop], ["Piston", HT.piston], ["Multi-engine", HT.multi],
    ["Helicopter", HT.heli], ["Helicopter turbine", HT.heliT && HT.heliP ? HT.heliT : 0], ["Helicopter piston", HT.heliT && HT.heliP ? HT.heliP : 0]].filter(([, v]) => v);
  const ctxSeq = opts && opts.ctx != null ? +opts.ctx : null, ctx = ctxSeq != null ? ac.find(a => a.acft_seq === ctxSeq) : null;
  const ctxBox = ctx ? `<section class="ctxbox" aria-label="On the ${esc(ctx.info.name)}"><h3>On the ${esc(ctx.info.name)}</h3>
      <div class="ctxgrid">${[[ctx.type_rated ? (trLabel[0].toUpperCase() + trLabel.slice(1)) + (trOf(d, ctx) && trLabel === "type rated" ? " " + trOf(d, ctx) : "") : "Not type rated", ""],
        [curState(ctx) === "current" ? "Current" : curState(ctx) === "expired" ? "Currency expired" : "Currency not listed", ctx.current_until ? ymText(ctx.current_until) + (schoolText(ctx) ? " · " + schoolText(ctx) : "") : schoolText(ctx)],
        [ctx.hours ? fmt(ctx.hours) + " hrs" : "Hours not listed", psText(d, ctxSeq) || "on type"], [ctx.part135 ? "Part 135 " + ctx.part135 : "Not 135 current", ""],
        [acRate(d, ctxSeq) && acRate(d, ctxSeq) !== "ask" ? lbl("rate", acRate(d, ctxSeq)) + "/day" : acRate(d, ctxSeq) === "ask" ? "Day rate: ask" : "Day rate not listed", (d.ac_rate || {})[ctxSeq] ? "on this aircraft" : ""],
        [past.has(ctxSeq) ? "Previously flown" : "Flying now", ""]].map(([a, b]) => `<div><b>${esc(a)}</b>${b ? `<span>${esc(b)}</span>` : ""}</div>`).join("")}</div></section>` : "";
  const jobs = (d.jobs || []).filter(j => j.kind || j.company).slice().sort((x, y) => (y.to === "now") - (x.to === "now") || (+y.to || 0) - (+x.to || 0) || (+y.from || 0) - (+x.from || 0));
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
      <div><h2>${esc(publicName(p)) || '<span class="empty">Your name</span>'}</h2>
      ${metaParts.length ? `<div class="meta">${esc(metaParts.join(" · "))}</div>` : opts && opts.preview ? '<div class="meta"><span class="empty">Certificate · role</span></div>' : ""}
      <div class="meta">${base ? "Based at " + esc(base) : '<span class="empty">Home base</span>'}${d.travel ? " · will travel: " + esc(lbl("travel", d.travel)) : ""}</div>
      ${(d.areas || []).length ? `<div class="meta">Flies in: ${esc(d.areas.map(v => lbl("region", v)).filter(Boolean).join(", "))}</div>` : ""}
      ${d.since ? `<div class="meta">Flying since ${esc(d.since)}</div>` : ""}
      ${rateText(d) ? `<div class="meta"><b>Contract day rate:</b> ${esc(rateText(d))}</div>` : ""}</div></div>
    ${badges.length ? `<div class="badges">${badges.join("")}</div>` : ""}
    ${ctxBox}
    ${hrs.length ? `<section><h3>Flight time</h3><div class="hrsgrid">${hrs.map(([k, v]) => `<div><b>${fmt(v)}</b><span>${esc(k)}</span></div>`).join("")}</div>${HT.turbine || HT.piston || HT.heli ? `<p class="hint" style="margin:6px 0 0">Turbine, jet, turboprop, piston, multi-engine and helicopter time are added up from the hours on each aircraft.</p>` : ""}</section>` : ""}
    <section><h3>${faOnly ? "Aircraft cabins" : "Flying now"}</h3>
      ${nowAc.length ? nowAc.map(acRow).join("") : '<p class="empty">Add the aircraft you fly.</p>'}
    </section>
    ${pastAc.length ? `<section><h3>Previously flown</h3>${pastAc.map(acRow).join("")}</section>` : ""}
    ${jobs.length ? `<section><h3>Work history</h3>${jobs.map(j => { const ai = j.seq ? BYSEQ.get(+j.seq) : null;
      return `<div class="row"><span><b>${esc(lbl("jobrole", j.role) || "Role")}</b>${j.kind ? " · " + esc(lbl("jobkind", j.kind)) : ""}${j.company && !CONTACTISH.test(j.company) ? " · " + esc(j.company) : ""}${ai ? `<br><small>${esc(ai.name)}</small>` : ""}</span><b>${esc((j.from || "") + (j.from || j.to ? "–" : "") + (j.to === "now" ? "present" : (j.to || "")))}</b></div>`; }).join("")}</section>` : ""}
    ${isFA && (d.fa_school || d.fa_year || d.fa_recurrent || d.cpr_until || d.food_safety || (d.fa_skills || []).length) ? `<section><h3>Flight attendant</h3>
      ${d.fa_school || d.fa_year || d.fa_recurrent ? `<div class="row"><span>Corporate FA training${d.fa_school ? ": " + esc(lbl("fa_school", d.fa_school)) : ""}${d.fa_year ? " (" + esc(d.fa_year) + ")" : ""}</span><b>${esc(d.fa_recurrent ? "Recurrent " + throughText(d.fa_recurrent) : "")}</b></div>` : ""}
      ${d.cpr_until ? `<div class="row"><span>CPR / AED / first aid</span><b${d.cpr_until < thisYM() ? ' style="color:#A12A20"' : ""}>${esc(throughText(d.cpr_until))}</b></div>` : ""}
      ${d.food_safety ? `<div class="row"><span>Food safety certificate</span><b>✓</b></div>` : ""}
      ${(d.fa_skills || []).length ? `<div class="chips2" style="margin-top:8px">${chips("fa_skills", d.fa_skills)}</div>` : ""}</section>` : ""}
    ${isMX && ((d.mx_certs || []).length || (d.mx_engines || []).length || (d.mx_spec || []).length || (d.mx_exp || []).length || d.mx_aog || d.mx_tools) ? `<section><h3>Maintenance</h3>
      ${(d.mx_certs || []).length ? `<div class="chips2">${chips("mx_certs", d.mx_certs)}</div>` : ""}
      ${(d.mx_engines || []).length ? `<p style="margin:10px 0 4px"><b>Engines</b></p><div class="chips2">${chips("mx_engines", d.mx_engines)}</div>` : ""}
      ${(d.mx_spec || []).length ? `<p style="margin:10px 0 4px"><b>Specialties</b></p><div class="chips2">${chips("mx_spec", d.mx_spec)}</div>` : ""}
      ${(d.mx_exp || []).length ? `<p style="margin:10px 0 4px"><b>Experience</b></p><div class="chips2">${chips("mx_exp", d.mx_exp)}</div>` : ""}
      ${d.mx_aog || d.mx_tools ? `<p style="margin:10px 0 0">${[d.mx_aog ? "Available for AOG road trips" : "", d.mx_tools ? "Owns tools" : ""].filter(Boolean).join(" · ")}</p>` : ""}</section>` : ""}
    ${isHeli && ((d.heli_ops || []).length || (d.sfar73 || []).length) ? `<section><h3>Helicopter</h3><div class="chips2">${chips("heli_ops", d.heli_ops)}${chips("sfar73", d.sfar73)}</div></section>` : ""}
    ${block("Ratings", [...new Set(ac.map(a => trLabel === "type rated" ? trOf(d, a) : "").filter(Boolean))].map(t => `<span class="badge ok">Type rating ${esc(t)}</span>`).join("") + chips("ratings", d.ratings) + (d.medical ? `<span class="badge">Medical: ${esc(lbl("medical", d.medical))}</span>` : ""))}
    ${(availText || (d.looking || []).length) ? `<section><h3>Availability</h3>${availText ? `<p>${esc(availText)}</p>` : ""}${(d.looking || []).length ? `<div class="chips2" style="margin-top:8px">${chips("looking", d.looking)}</div>` : ""}</section>` : ""}
    ${block("Experience", chips("experience", d.experience))}
    ${block("Special training", chips("training", d.training))}
    ${block("Languages", chips("languages", d.languages))}
    ${p.bio ? `<section><h3>More about me</h3><p>${esc(p.bio)}</p></section>` : ""}
    <div class="actions">${opts && opts.preview ? `<button class="btn primary" type="button" disabled style="opacity:.6">Contact</button>` : `<button class="btn primary" type="button" data-contact="${esc(p.user_id)}" data-name="${esc(publicName(p))}" data-ac="${esc(ac.map(a => a.acft_seq).join(","))}" data-ctx="${ctxSeq != null ? ctxSeq : ""}">Contact</button>`}${opts && opts.preview ? "" : `<button class="btn secondary" type="button" data-fav="${esc(p.user_id)}" aria-pressed="${!!(FAV && FAV.has(p.user_id))}">${FAV && FAV.has(p.user_id) ? "★ Saved" : "☆ Save"}</button><button class="btn secondary" type="button" data-share="${esc(p.user_id)}" data-name="${esc(publicName(p))}">Share</button>`}</div>
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
const QUICK = [["contract","Contract pilots"],["now","Available now"],["soon","Now or with notice"],["p135","Part 135 current"],["cfi","CFIs"],["heli","Helicopter pilots"],["fa","Flight attendants"],["mx","Mechanics"]];
let F = {seq:null, type:"", region:"", cert:"", avail:"", p135:false, contract:false, rate:"", x:[], eng:"", minTT:"", minPIC:"", minTurb:"", minType:"", near:"", nm:"100", trn:"", tr:""};
function describeF(F){
  const a = F.seq != null && BYSEQ.get(+F.seq) ? BYSEQ.get(+F.seq).name : "";
  const parts = [a, F.type ? TYPE_LABEL[F.type] : "", F.region ? lbl("region", F.region) : "", F.cert ? lbl("cert", F.cert) : "",
    F.avail === "now" ? "Available now" : F.avail === "soon" ? "Now or with notice" : "", F.p135 ? "Part 135" : "", F.contract ? "Contract" : "",
    F.rate ? lbl("rate_max", F.rate) + "/day" : "", F.minTT ? lbl("minhrs", F.minTT) + " total" : "", F.minPIC ? lbl("minhrs", F.minPIC) + " PIC" : "",
    F.minTurb ? lbl("minhrs", F.minTurb) + " turbine" : "", F.minType ? lbl("minhrs", F.minType) + " on type" : "", F.trn ? lbl("training", F.trn) : "",
    F.near ? `within ${F.nm || 100} nm of ${F.near}` : "", F.tr ? "Type rating " + F.tr : ""].filter(Boolean);
  return (parts.join(" · ") || "All crew").slice(0, 80);
}
function matches(p, ac){ return matchProfile(F, p, ac, ENV); }
function rank(p, ac, mod){
  const d = p.details || {}, t = F.seq != null ? (ac.find(a => a.acft_seq === F.seq) || {}) : {}, onType = t.hours || 0;
  return (d.status === "now" ? 2e9 : d.status === "notice" ? 1e9 : 0) + (curState(t) === "current" ? 4e8 : 0) + (mod && mod.verified_faa ? 1e8 : 0) + onType * 1000 + (p.total_time || 0);
}
function resultHTML(p, ac, mod, active){
  const d = p.details || {};
  const top = (F.seq != null ? ac.filter(a => a.acft_seq === F.seq) : ac.slice().sort((x, y) => (y.hours || 0) - (x.hours || 0))).slice(0, 2)
    .map(a => { const i = BYSEQ.get(a.acft_seq); return i ? `${esc(i.name)}${esc(curText(a))}${a.hours ? " · " + fmt(a.hours) + " hrs" : ""}${a.part135 ? " · 135 " + esc(a.part135) : ""}` : ""; }).filter(Boolean);
  const meta = [lbl("cert", d.cert) && d.cert !== "none" ? lbl("cert", d.cert) : "", lbl("role", d.role)].filter(Boolean).join(" · ") || [p.certificate, p.headline].filter(Boolean).join(" · ");
  const base = [d.airport ? d.airport + (airportCity(d.airport) ? " · " + airportCity(d.airport) : "") : "", lbl("region", d.region)].filter(Boolean).join(" · ") || p.home_base;
  const b = [];
  if (F.near && airportLL(F.near) && airportLL(d.airport)) b.push(`<span class="badge">${fmt(Math.round(distNm(airportLL(F.near), airportLL(d.airport))))} nm from ${esc(F.near)}</span>`);
  const rr = acRate(d, F.seq); if (rr && rr !== "ask") b.push(`<span class="badge">${esc(lbl("rate", rr))}/day</span>`);
  if (mod && mod.verified_faa) b.push(`<span class="badge ok">✓ FAA verified</span>`);
  if (ac.some(a => a.part135)) b.push(`<span class="badge ok">Part 135</span>`);
  if (d.status === "now") b.push(`<span class="badge ok">Available now</span>`);
  else if (d.status === "notice") b.push(`<span class="badge">Available with notice</span>`);
  return `<a class="res${active ? " on" : ""}" href="#/p/${esc(p.user_id)}${F.seq != null ? "?a=" + F.seq : ""}" data-id="${esc(p.user_id)}">
    <span class="avatar sm" aria-hidden="true">${esc(initials(p.display_name))}</span>
    <span class="rbody"><b class="rname">${esc(publicName(p))}${FAV && FAV.has(p.user_id) ? ' <span title="Saved" aria-label="Saved">★</span>' : ""}</b><span class="rmeta">${esc([meta, base].filter(Boolean).join(" · "))}</span>
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
  loadAirports().then(() => { if (typeof window.__redrawFind === "function") window.__redrawFind(); });
  app.innerHTML = `<div class="pagehead"><div><h1>Find crew</h1><p>Professional, type-current crew. Profiles are reviewed before they appear.</p>${user ? `<p style="margin:8px 0 0;display:flex;gap:8px;flex-wrap:wrap"><button class="btn secondary" id="svs" type="button">☆ Save this search</button><a class="btn secondary" href="#/saved">★ Saved</a></p>` : ""}</div>${tabs("search")}</div>
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
      ${selectHTML("fdr", "rate_max", "Contract day rate", F.rate, "Any rate")}
      ${selectHTML("ftt", "minhrs", "Total time", F.minTT, "Any")}
      ${selectHTML("fpic", "minhrs", "PIC time", F.minPIC, "Any")}
      ${selectHTML("ftur", "minhrs", "Turbine time", F.minTurb, "Any")}
      ${selectHTML("ftyp", "minhrs", "Hours on the searched aircraft", F.minType, "Any")}
      ${selectHTML("ftrn", "training", "Special training", F.trn, "Any")}
      <div class="f"><label for="ftr">FAA type rating</label><select id="ftr"><option value="">Any</option>${TR_ALL.map(t => `<option value="${esc(t)}"${t === F.tr ? " selected" : ""}>${esc(t)}</option>`).join("")}</select></div>
      <div class="f"><label for="fnear">Near airport</label><input id="fnear" maxlength="5" autocapitalize="characters" placeholder="e.g. VNY" value="${esc(F.near)}"><small id="fnearc" aria-live="polite"></small></div>
      ${selectHTML("fnm", "nearnm", "Distance", F.nm, "Within 100 nm")}
    </div></details>
    <div id="rolef" class="rolef" hidden></div>
    <div class="savebar"><label class="switch"><input type="checkbox" id="fp"> Part 135 current</label><button class="btn secondary" id="fx" type="button" style="margin-left:auto">Clear</button></div>
  </section>
  <div class="mdsplit"><div class="results" id="res" aria-live="polite"><p>Loading crew…</p></div><aside class="detail" id="det" aria-label="Selected profile"></aside></div>`;
  const ui = () => { $("fa").value = F.seq != null && BYSEQ.get(F.seq) ? BYSEQ.get(F.seq).name : ""; $("ft").value = F.type; $("fr").value = F.region; $("fc").value = F.cert; $("fv").value = F.avail; $("fp").checked = F.p135; $("fdr").value = F.rate;
    $("ftt").value = F.minTT; $("fpic").value = F.minPIC; $("ftur").value = F.minTurb; $("ftyp").value = F.minType; $("ftrn").value = F.trn; $("ftr").value = F.tr || ""; $("fnm").value = F.nm || "100"; $("ftyp").disabled = F.seq == null;
    if (document.activeElement !== $("fnear")) $("fnear").value = F.near;
    $("fnearc").textContent = F.near ? (airportCity(F.near) ? "✓ " + airportCity(F.near) : AIRPORTS ? "Airport code not found" : "") : "";
    app.querySelectorAll("[data-q]").forEach(b => { const k = b.dataset.q, on = k === "now" ? F.avail === "now" : k === "soon" ? F.avail === "soon" : k === "p135" ? F.p135 : k === "contract" ? F.contract : k === "cfi" ? F.type === "cfi" : k === "fa" ? F.type === "flight_attendant" : k === "mx" ? F.type === "mechanic" : F.type === "helicopter_pilot"; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); });
    const rf = ROLEF[F.type], box = $("rolef"); box.hidden = !rf;
    box.innerHTML = rf ? `<span class="lbl">${esc(TYPE_LABEL[F.type])} filters</span><div class="chips">${rf.map(([k, l]) => `<label><input type="checkbox" data-x="${k}"${(F.x || []).includes(k) ? " checked" : ""}> ${esc(l)}</label>`).join("")}</div>${F.type === "mechanic" ? `<div class="f" style="max-width:340px;margin-top:8px"><label for="feng">Engine</label><select id="feng"><option value="">Any engine</option>${OPT.mx_engines.map(([v, l]) => `<option value="${v}"${v === F.eng ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></div>` : ""}` : ""; };
  if (F.type || F.region || F.cert || F.avail || F.rate || F.minTT || F.minPIC || F.minTurb || F.minType || F.near || F.trn || F.tr) $("more").open = true;
  let D; try { D = await loadDir(); } catch (e) { $("res").innerHTML = `<p class="err">Couldn't load the directory. Check your connection and try again.</p>`; return; }
  let active = null, lastHits = [];
  await loadFav();
  if ($("svs")) $("svs").onclick = async () => {
    if (!user) { signIn(route); return; }
    const m = modal(`<h2>Save this search</h2><div class="f"><label for="ssn">Name</label><input id="ssn" maxlength="80" value="${esc(describeF(F))}"></div>
      <label class="switch"><input type="checkbox" id="ssa" checked> Email me when new crew match (checked daily)</label><p class="hint" style="margin:0">Find it again under ★ Saved.</p>
      <div class="err" id="ssm" role="status"></div><div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn primary" id="sss" type="button">Save</button><button class="btn secondary" id="ssx" type="button">Cancel</button></div>`);
    m.querySelector("#ssx").onclick = () => m.remove();
    m.querySelector("#sss").onclick = async () => { const name = m.querySelector("#ssn").value.trim() || describeF(F);
      const filters = Object.fromEntries(Object.entries(F).filter(([k, v]) => v !== "" && v != null && v !== false && !(Array.isArray(v) && !v.length)));
      const {error} = await sb.from("saved_searches").insert({name:name.slice(0, 80), filters, alerts:m.querySelector("#ssa").checked, seen:lastHits.map(p => p.user_id)});
      if (error) { m.querySelector("#ssm").textContent = /saved_searches/.test(error.message) ? "Saved searches switch on after a Cali Aircrew setup step." : error.message; return; }
      m.remove(); toast("Search saved"); };
  };
  const show = id => { active = id; const p = D.listed.find(x => x.user_id === id); $("det").innerHTML = p ? cardHTML(p, D.acBy.get(id) || [], D.mod.get(id), {ctx:F.seq}) : ""; app.querySelectorAll(".res").forEach(r => r.classList.toggle("on", r.dataset.id === id)); };
  const draw = () => {
    ui();
    const hits = lastHits = D.listed.filter(p => matches(p, D.acBy.get(p.user_id) || [])).sort((a, b) => rank(b, D.acBy.get(b.user_id) || [], D.mod.get(b.user_id)) - rank(a, D.acBy.get(a.user_id) || [], D.mod.get(a.user_id)));
    const label = F.seq != null && BYSEQ.get(F.seq) ? " on the " + BYSEQ.get(F.seq).name : "";
    $("res").innerHTML = `<p class="count">${hits.length} crew${esc(label)}</p>` + (hits.length ? hits.map(p => resultHTML(p, D.acBy.get(p.user_id) || [], D.mod.get(p.user_id), p.user_id === active)).join("")
      : `<div class="panel"><p style="margin:0">No listed crew match yet. Try fewer filters${D.listed.length ? "" : ". The directory is new: profiles appear here once they're reviewed"}.</p><p style="margin:0"><a href="#/me">List yourself</a> · <a href="../#notify">Get notified</a></p></div>`);
    logSearch(hits.length);
    if (wide() && hits.length) show(hits.some(h => h.user_id === active) ? active : hits[0].user_id); else $("det").innerHTML = "";
  };
  window.__redrawFind = () => { if (location.hash === "" || location.hash.startsWith("#/") && !/^#\/(p|me|op|account|aircraft|ops|o)\b/.test(location.hash)) draw(); };
  $("res").addEventListener("click", e => { const r = e.target.closest(".res"); if (!r || !wide()) return; e.preventDefault(); show(r.dataset.id); });
  app.querySelector(".quick").addEventListener("click", e => { const b = e.target.closest("[data-q]"); if (!b) return; const k = b.dataset.q;
    if (k === "now" || k === "soon") F.avail = F.avail === k ? "" : k; else if (k === "p135") F.p135 = !F.p135; else if (k === "contract") F.contract = !F.contract;
    else if (k === "cfi") F.type = F.type === "cfi" ? "" : "cfi"; else if (k === "heli") F.type = F.type === "helicopter_pilot" ? "" : "helicopter_pilot";
    else if (k === "fa") F.type = F.type === "flight_attendant" ? "" : "flight_attendant"; else if (k === "mx") F.type = F.type === "mechanic" ? "" : "mechanic";
    F.x = (F.x || []).filter(x => (ROLEF[F.type] || []).some(r => r[0] === x)); if (F.type !== "mechanic") F.eng = ""; draw(); });
  app.querySelector(".filters").addEventListener("change", e => { const t = e.target;
    if (t.dataset.x) { F.x = (F.x || []).filter(x => x !== t.dataset.x); if (t.checked) F.x.push(t.dataset.x); draw(); return; }
    if (t.id === "feng") { F.eng = t.value; draw(); return; }
    if (t.id === "ft") { F.type = t.value; F.x = []; F.eng = ""; } if (t.id === "fr") F.region = t.value; if (t.id === "fc") F.cert = t.value; if (t.id === "fv") F.avail = t.value; if (t.id === "fp") F.p135 = t.checked; if (t.id === "fdr") F.rate = t.value;
    if (t.id === "ftt") F.minTT = t.value; if (t.id === "fpic") F.minPIC = t.value; if (t.id === "ftur") F.minTurb = t.value; if (t.id === "ftyp") F.minType = t.value; if (t.id === "ftrn") F.trn = t.value; if (t.id === "ftr") F.tr = t.value; if (t.id === "fnm") F.nm = t.value;
    draw(); });
  $("fnear").addEventListener("input", () => { const v = $("fnear").value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5); F.near = airportLL(v) ? v : ""; if (!v) F.near = ""; draw(); if (v && !airportLL(v)) $("fnearc").textContent = AIRPORTS ? "Airport code not found" : ""; });
  $("fx").onclick = () => { F = {seq:null, type:"", region:"", cert:"", avail:"", p135:false, contract:false, rate:"", x:[], eng:"", minTT:"", minPIC:"", minTurb:"", minType:"", near:"", nm:"100", trn:"", tr:""}; draw(); };
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

async function viewProfile(id0){
  const [id, q] = String(id0).split("?"), ctxSeq = new URLSearchParams(q || "").get("a");
  app.innerHTML = `<p>Loading profile…</p>`;
  if (!sb) { app.innerHTML = `<p class="err">The directory isn't available right now.</p>`; return; }
  const [{data:p}, {data:ac}, {data:mod}] = await Promise.all([
    sb.from("crew_profiles").select("*").eq("user_id", id).maybeSingle(),
    sb.from("crew_aircraft").select("*").eq("user_id", id),
    sb.from("moderation").select("*").eq("user_id", id).maybeSingle()]);
  if (!p) { app.innerHTML = `<div class="center"><h1>Profile not found</h1><p>It may be unpublished or waiting for review.</p><a class="btn secondary" href="#/">Back to the crew directory</a></div>`; return; }
  document.title = (publicName(p) || "Crew profile") + " · Cali Aircrew";
  await Promise.all([loadAirports(), loadFav()]);
  app.innerHTML = `<div style="max-width:720px;margin:0 auto;display:flex;flex-direction:column;gap:16px"><a href="javascript:history.length>1?history.back():location.hash='#/'">← Back</a>${cardHTML(p, ac || [], mod, {ctx:ctxSeq != null && ctxSeq !== "" ? +ctxSeq : null})}</div>`;
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
  P.details = Object.assign({role:"", cert:"", ratings:[], medical:"", region:"", airport:"", status:"", looking:[], travel:"", passport:false, experience:[], languages:[],
    past:[], hrs_pic:null, hrs_turbine:null, hrs_heli:null, hrs_heli_turbine:null, hrs_heli_piston:null, rate:"", rate_exp:false, rate_neg:false,
    fa_school:"", fa_year:"", fa_recurrent:"", cpr_until:"", food_safety:false, fa_skills:[], mx_certs:[], mx_engines:[], mx_spec:[], mx_exp:[], mx_aog:false, mx_tools:false, heli_ops:[], sfar73:[],
    ac_rate:{}, areas:[], since:"", jobs:[], ac_pic:{}, ac_sic:{}, training:[], tr_des:{}, tr_sp:{}}, P.details || {});
  await loadAirports();
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
    <div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn primary adminbtn" href="../admin/" hidden>Admin</a><a class="btn secondary" href="#/account">Account</a><a class="btn secondary" href="#/op">Operator profile</a>${p0 && p0.published && mod && mod.approved && !mod.hidden ? `<button class="btn secondary" type="button" data-share="${esc(uid)}" data-name="${esc(publicName(P))}">Share my profile</button>` : ""}<button class="btn secondary toggleprev" id="tp" type="button">Preview</button><button class="btn secondary" id="so" type="button">Sign out</button></div></div>
  <div class="split" id="split">
   <div class="formcol">
    <section class="panel strength" aria-labelledby="h1s"><h2 id="h1s">Profile strength</h2><div class="meter" aria-hidden="true"><span id="smeter"></span></div><p id="stext" style="margin:0"></p><ul id="stips" class="hint" style="margin:0;padding-left:20px"></ul></section>
    <section class="panel" aria-labelledby="h1a"><h2 id="h1a">About you</h2>
      <div class="grid2"><div class="f"><label for="dn">Name shown on your profile</label><input id="dn" value="${esc(P.display_name)}" maxlength="80" placeholder="e.g. Jordan R." autocomplete="name"></div>${sel("role", "role", "Role", D.role)}</div>
      <div class="grid2">${sel("cert", "cert", "Certificate", D.cert)}${sel("med", "medical", "FAA medical", D.medical)}</div>
      ${multi("rt", "ratings", "Ratings (tap all that apply)", D.ratings)}
      <label class="switch"><input type="checkbox" id="ini"${D.initials ? " checked" : ""}> Show only my initials publicly (e.g. "D. P."); operators still see your full profile details</label>
      <div class="f"><span class="lbl" id="ctl">Crew type</span><div class="chips" role="group" aria-labelledby="ctl">${CREW_TYPES.map(([v, l]) => `<label><input type="checkbox" name="ct" value="${v}"${P.crew_types.includes(v) ? " checked" : ""}> ${esc(l)}</label>`).join("")}</div></div>
    </section>
    <section class="panel" aria-labelledby="h1h"><h2 id="h1h">Home base</h2>
      <div class="grid2">${sel("reg", "region", "Region", D.region)}<div class="f"><label for="apt">Home airport code</label><input id="apt" value="${esc(D.airport)}" maxlength="5" placeholder="e.g. VNY or KVNY" autocapitalize="characters"><small id="aptcity" aria-live="polite"></small></div></div>
      ${multi("ar", "region", "Areas I fly in (tap all that apply)", D.areas)}
      <div class="grid2"><div class="f"><label for="since">Flying since</label><select id="since">${yearOpts(D.since)}</select></div></div>
    </section>
    <section class="panel" aria-labelledby="h1b"><h2 id="h1b">Aircraft and time</h2>
      <p class="hint">Add each aircraft you are current on. Owners search by exact type.</p>
      <div class="f acsearch"><label for="acq">Add an aircraft</label><input id="acq" type="search" autocomplete="off" placeholder="Type to search, e.g. Citation XLS, King Air 350"><div class="acres" id="acres" hidden></div></div>
      <div><button class="btn secondary" id="brw" type="button" aria-expanded="false" aria-controls="acbrowse">Browse the list</button></div>
      <div id="acbrowse" class="browse" hidden></div>
      <p class="hint" style="margin:0">Can't find your aircraft? <a href="#" id="acreq">Request it</a></p>
      <div id="aclist"></div>
      <div class="grid2"><div class="f"><label for="tt">Total time (hours)</label><input id="tt" value="${P.total_time ?? ""}" inputmode="numeric" placeholder="e.g. 6800"></div>
        <div class="f"><label for="hpic">PIC (hours)</label><input id="hpic" value="${D.hrs_pic ?? ""}" inputmode="numeric"></div>
</div>
      <div id="hcalc" class="hint" aria-live="polite"></div>
    </section>
    <section class="panel" aria-labelledby="h1c"><h2 id="h1c">Availability</h2>
      <div class="grid2">${sel("stat", "status", "Status", D.status)}${sel("trv", "travel", "Will travel", D.travel)}</div>
      ${multi("lk", "looking", "Looking for (tap all that apply)", D.looking)}
      <label class="switch"><input type="checkbox" id="pp"${D.passport ? " checked" : ""}> I have a valid passport</label>
      <div class="grid2">${sel("rate", "rate", "Contract day rate (general)", D.rate, "Not shown")}<div class="f"><span class="lbl">Day rate details</span><div class="chips"><label><input type="checkbox" id="rexp"${D.rate_exp ? " checked" : ""}> Plus expenses</label><label><input type="checkbox" id="rneg"${D.rate_neg ? " checked" : ""}> Negotiable</label></div></div></div>
      <small>Shown on your profile when listed. You can also set a different rate on each aircraft under Aircraft and time. Choose "Ask me" if you'd rather discuss it.</small>
    </section>
    <section class="panel" aria-labelledby="h1fa" id="secfa" hidden><h2 id="h1fa">Flight attendant</h2>
      <div class="grid2">${sel("fas", "fa_school", "Corporate FA initial training", D.fa_school)}<div class="f"><label for="fay">Year of initial training</label><select id="fay">${yearOpts(D.fa_year)}</select></div></div>
      <div class="grid2"><div class="f"><label for="far">Recurrent current through</label><select id="far">${monthOpts(D.fa_recurrent)}</select></div><div class="f"><label for="cpr">CPR / AED / first aid current through</label><select id="cpr">${monthOpts(D.cpr_until)}</select></div></div>
      <label class="switch"><input type="checkbox" id="food"${D.food_safety ? " checked" : ""}> Food safety certificate (e.g. ServSafe)</label>
      ${multi("fsk", "fa_skills", "Skills (tap all that apply)", D.fa_skills)}
      <small>Add the aircraft cabins you've worked under Aircraft and time.</small>
    </section>
    <section class="panel" aria-labelledby="h1mx" id="secmx" hidden><h2 id="h1mx">Maintenance</h2>
      ${multi("mxc", "mx_certs", "Certificates", D.mx_certs)}
      ${multi("mxe", "mx_engines", "Engines you're trained on", D.mx_engines)}
      ${multi("mxs", "mx_spec", "Specialties", D.mx_spec)}
      ${multi("mxx", "mx_exp", "Experience", D.mx_exp)}
      <label class="switch"><input type="checkbox" id="aog"${D.mx_aog ? " checked" : ""}> Available for AOG road trips</label>
      <label class="switch"><input type="checkbox" id="tools"${D.mx_tools ? " checked" : ""}> I own my tools</label>
      <small>Add the aircraft you're factory trained on under Aircraft and time.</small>
    </section>
    <section class="panel" aria-labelledby="h1hl" id="secheli" hidden><h2 id="h1hl">Helicopter</h2>
      <small>Helicopter turbine and piston time are added up from the hours on each helicopter under Aircraft and time.</small>
      ${multi("hop", "heli_ops", "Missions and equipment (tap all that apply)", D.heli_ops)}
      ${multi("s73", "sfar73", "Robinson SFAR 73", D.sfar73)}
    </section>
    <section class="panel" aria-labelledby="h1e"><h2 id="h1e">Experience</h2>
      ${multi("xp", "experience", "Tap all that apply", D.experience)}
      ${multi("lg", "languages", "Languages (optional)", D.languages)}
      ${multi("trn", "training", "Special training (tap all that apply)", D.training)}
    </section>
    <section class="panel" aria-labelledby="h1w"><h2 id="h1w">Work history</h2>
      <p class="hint" style="margin:0">Where you fly now and where you've flown. Company names are optional.</p>
      <div id="jobs"></div><div><button class="btn secondary" id="jobadd" type="button">＋ Add a job</button></div>
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
    D.initials = $("ini").checked;
    const num = id => { const v = ($(id) ? $(id).value : "").replace(/[^\d]/g, ""); return v ? Math.min(100000, +v) : null; };
    Object.assign(D, {hrs_pic:num("hpic"), hrs_turbine:null, hrs_heli:null, areas:checked("ar"), since:$("since").value, rate:$("rate").value, rate_exp:$("rexp").checked, rate_neg:$("rneg").checked,
      fa_school:$("fas").value, fa_year:$("fay").value, fa_recurrent:$("far").value, cpr_until:$("cpr").value, food_safety:$("food").checked, fa_skills:checked("fsk"),
      mx_certs:checked("mxc"), mx_engines:checked("mxe"), mx_spec:checked("mxs"), mx_exp:checked("mxx"), mx_aog:$("aog").checked, mx_tools:$("tools").checked,
      hrs_heli_turbine:null, hrs_heli_piston:null, heli_ops:checked("hop"), sfar73:checked("s73")});
    D.ac_rate = Object.fromEntries(Object.entries(D.ac_rate || {}).filter(([k, v]) => v && AC.some(a => a.acft_seq === +k)));
    for (const m of ["tr_des", "tr_sp"]) D[m] = Object.fromEntries(Object.entries(D[m] || {}).filter(([k, v]) => v && AC.some(a => a.acft_seq === +k && a.type_rated)));
    for (const m of ["ac_pic", "ac_sic"]) D[m] = Object.fromEntries(Object.entries(D[m] || {}).filter(([k, v]) => v && AC.some(a => a.acft_seq === +k)));
    D.training = checked("trn");
    drawStrength();
    D.jobs = (D.jobs || []).map(j => ({kind:j.kind || "", role:j.role || "", company:String(j.company || "").trim().slice(0, 60), seq:j.seq || "", from:j.from || "", to:j.to || ""})).slice(0, 8);   // blank rows stay while editing; dropped when saving
    const HT = hoursByType(AC); if ($("hcalc")) $("hcalc").textContent = HT.turbine || HT.piston || HT.heli ? "Calculated from your aircraft hours: " + [["turbine", HT.turbine], ["jet", HT.jet], ["turboprop", HT.turboprop], ["piston", HT.piston], ["multi-engine", HT.multi], ["helicopter", HT.heli]].filter(([, v]) => v).map(([k, v]) => fmt(v) + " " + k).join(" · ") : "Enter hours on each aircraft above; turbine, jet, turboprop, piston, multi-engine and helicopter time are added up for you.";
    if (!D.rate || D.rate === "ask") { D.rate_exp = false; D.rate_neg = false; }
    const has = t => P.crew_types.includes(t);
    $("secfa").hidden = !has("flight_attendant"); $("secmx").hidden = !has("mechanic"); $("secheli").hidden = !has("helicopter_pilot");
    if (!has("flight_attendant")) Object.assign(D, {fa_school:"", fa_year:"", fa_recurrent:"", cpr_until:"", food_safety:false, fa_skills:[]});
    if (!has("mechanic")) Object.assign(D, {mx_certs:[], mx_engines:[], mx_spec:[], mx_exp:[], mx_aog:false, mx_tools:false});
    if (!has("helicopter_pilot")) Object.assign(D, {hrs_heli_turbine:null, hrs_heli_piston:null, heli_ops:[], sfar73:[]});
    D.past = (D.past || []).filter(sq => AC.some(a => a.acft_seq === sq));
    const apc = airportCity(D.airport); if ($("aptcity")) $("aptcity").textContent = D.airport ? (apc ? "✓ " + apc : "Code not found. Use the FAA or ICAO code, e.g. VNY or KVNY.") : "";
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
      <label class="tr"><input type="checkbox" data-tr="${i}"${a.type_rated ? " checked" : ""}> Type rated${TR[a.acft_seq] && TR[a.acft_seq].length === 1 ? " (" + esc(TR[a.acft_seq][0][0]) + ")" : ""}</label>
      ${a.type_rated && TR[a.acft_seq] && TR[a.acft_seq].length > 1 ? `<select class="p135" data-trd="${a.acft_seq}" aria-label="Which FAA type rating">${TR[a.acft_seq].map(o => `<option value="${esc(o[0])}"${o[0] === (D.tr_des || {})[a.acft_seq] ? " selected" : ""}>${esc(o[0])}</option>`).join("")}</select>` : ""}
      ${a.type_rated && TR[a.acft_seq] && ((TR[a.acft_seq].find(o => o[0] === (D.tr_des || {})[a.acft_seq]) || TR[a.acft_seq][0])[1]) ? `<label class="tr"><input type="checkbox" data-trsp="${a.acft_seq}"${(D.tr_sp || {})[a.acft_seq] ? " checked" : ""}> Single-pilot (${esc((TR[a.acft_seq].find(o => o[0] === (D.tr_des || {})[a.acft_seq]) || TR[a.acft_seq][0])[1])})</label>` : ""}
      <label class="tr"><input type="checkbox" data-cur="${i}"${a.is_current ? " checked" : ""}> Current</label>
      <label class="tr"><input type="checkbox" data-now="${a.acft_seq}"${(D.past || []).includes(a.acft_seq) ? "" : " checked"}> Flying it now</label>
      <select class="p135" data-acrate="${a.acft_seq}" aria-label="Day rate on ${esc(info ? info.name : "")}"><option value="">Day rate: general</option>${OPT.rate.map(([v, l]) => `<option value="${v}"${(D.ac_rate || {})[a.acft_seq] === v ? " selected" : ""}>${esc(l)}/day</option>`).join("")}</select>
      <input class="hrs" data-hr="${i}" inputmode="numeric" placeholder="Total hrs" aria-label="Total hours in ${esc(info ? info.name : "")}" value="${a.hours ?? ""}">
      <input class="hrs" data-pic="${a.acft_seq}" inputmode="numeric" placeholder="PIC hrs" aria-label="PIC hours in ${esc(info ? info.name : "")}" value="${(D.ac_pic || {})[a.acft_seq] ?? ""}">
      <input class="hrs" data-sic="${a.acft_seq}" inputmode="numeric" placeholder="SIC hrs" aria-label="SIC hours in ${esc(info ? info.name : "")}" value="${(D.ac_sic || {})[a.acft_seq] ?? ""}">
      <select class="p135" data-p135="${i}" aria-label="Part 135 currency in ${esc(info ? info.name : "")}"><option value=""${!a.part135 ? " selected" : ""}>Not 135 current</option><option value="SIC"${a.part135 === "SIC" ? " selected" : ""}>135 current · SIC</option><option value="PIC"${a.part135 === "PIC" ? " selected" : ""}>135 current · PIC</option></select>
      <button class="iconbtn" type="button" data-rm="${i}" aria-label="Remove ${esc(info ? info.name : "aircraft")}">✕</button>
      ${a.is_current ? `<div class="acsub"><div class="f"><label for="cu${i}">Current through</label><input type="month" id="cu${i}" data-cu="${i}" value="${esc(ym(a.current_until))}" min="2000-01" max="2040-12"></div>
        <div class="f"><label for="sc${i}">Training school</label><select id="sc${i}" data-sc="${i}"><option value="">Choose…</option>${OPT.school.map(([v, l]) => `<option value="${v}"${v === a.training_school ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></div>
        ${a.training_school === "other" ? `<div class="f"><label for="so${i}">School name</label><input id="so${i}" data-so="${i}" maxlength="60" value="${esc(a.training_other)}" placeholder="e.g. company or instructor"></div>` : ""}
        ${curState(a) === "expired" ? `<p class="err" style="margin:0;align-self:end">This date has passed, so the aircraft shows as currency expired.</p>` : ""}</div>` : ""}</div>`; }).join("") : '<p class="empty" style="margin:0">No aircraft yet.</p>';
  };
  const yr = (v, first) => { const y = new Date().getFullYear(); let h = `<option value="">${first}</option>`; for (let i = y; i >= 1970; i--) h += `<option value="${i}"${String(i) === String(v) ? " selected" : ""}>${i}</option>`; return h; };
  const drawJobs = () => {
    D.jobs = D.jobs || [];
    $("jobs").innerHTML = D.jobs.length ? D.jobs.map((j, i) => `<div class="jobrow">
      <div class="f"><label for="jk${i}">Type of operation</label><select id="jk${i}" data-job="${i}:kind"><option value="">Choose…</option>${OPT.jobkind.map(([v, l]) => `<option value="${v}"${v === j.kind ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></div>
      <div class="f"><label for="jr${i}">Role</label><select id="jr${i}" data-job="${i}:role"><option value="">Choose…</option>${OPT.jobrole.map(([v, l]) => `<option value="${v}"${v === j.role ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></div>
      <div class="f"><label for="jc${i}">Company (optional)</label><input id="jc${i}" data-job="${i}:company" maxlength="60" value="${esc(j.company)}" placeholder="e.g. company or owner name"></div>
      <div class="f"><label for="ja${i}">Aircraft</label><select id="ja${i}" data-job="${i}:seq"><option value="">Various / not listed</option>${AC.map(a => { const n = BYSEQ.get(a.acft_seq); return n ? `<option value="${a.acft_seq}"${String(a.acft_seq) === String(j.seq) ? " selected" : ""}>${esc(n.name)}</option>` : ""; }).join("")}</select></div>
      <div class="f"><label for="jf${i}">From</label><select id="jf${i}" data-job="${i}:from">${yr(j.from, "Year")}</select></div>
      ${j.to === "now" ? `<div class="f"><span class="lbl">To</span><span>Present</span></div>` : `<div class="f"><label for="jt${i}">To</label><select id="jt${i}" data-job="${i}:to">${yr(j.to, "Year")}</select></div>`}
      <label class="tr"><input type="checkbox" data-job="${i}:to"${j.to === "now" ? " checked" : ""}> I work here now</label>
      <button class="iconbtn" type="button" data-jobrm="${i}" aria-label="Remove this job">✕</button></div>`).join("") : '<p class="empty" style="margin:0">No jobs added yet.</p>';
    $("jobadd").hidden = D.jobs.length >= 8;
  };
  /* Profile strength: what operators search on. Each item is a [done, tip] pair; the top three missing show as tips. */
  const drawStrength = () => {
    if (!$("smeter")) return;
    const any = AC.length > 0, hrsAll = any && AC.every(a => a.hours), isPilot = P.crew_types.some(t => /pilot|cfi/.test(t));
    const items = [[!!P.display_name, "Add the name shown on your profile"], [P.crew_types.length > 0, "Choose your crew type"], [!!D.role, "Choose your role"],
      [!isPilot || !!D.cert, "Choose your certificate"], [!isPilot || !!D.medical, "Choose your FAA medical"], [!!D.region, "Choose your region"], [!!airportCity(D.airport), "Add your home airport code"],
      [any, "Add the aircraft you fly"], [hrsAll, "Add hours on each aircraft (operators filter by time on type)"], [AC.some(a => a.is_current && a.current_until), "Mark an aircraft Current with a 'current through' month"],
      [!isPilot || !!P.total_time, "Add your total time"], [!isPilot || !!D.hrs_pic, "Add your PIC time"], [!!D.status, "Set your availability"], [(D.looking || []).length > 0, "Choose what you're looking for"],
      [!!(D.rate || Object.keys(D.ac_rate || {}).length), "Set a day rate (or choose Ask me)"], [(D.experience || []).length > 0, "Tap your experience"], [(D.jobs || []).some(j => j.kind || j.company), "Add your work history"],
      [!!(PV.legal_last), "Add your legal name for the FAA verified badge"]];
    const done = items.filter(i => i[0]).length, pct = Math.round(100 * done / items.length);
    $("smeter").style.width = pct + "%"; $("stext").innerHTML = `<b>${pct}% complete.</b> ${pct >= 90 ? "Great: operators can find you in most searches." : "Complete profiles show up in more searches."}`;
    $("stips").innerHTML = items.filter(i => !i[0]).slice(0, 3).map(i => `<li>${esc(i[1])}</li>`).join("");
  };
  const changed = () => { dirty = true; drawPrev(); drawStatus(); };
  drawAc(); drawJobs(); drawPrev(); drawStatus();
  $("jobadd").onclick = () => { D.jobs = D.jobs || []; if (D.jobs.length < 8) D.jobs.push({kind:"", role:"", company:"", seq:"", from:"", to:""}); drawJobs(); };
  $("jobs").addEventListener("click", e => { const b = e.target.closest("[data-jobrm]"); if (!b) return; D.jobs.splice(+b.dataset.jobrm, 1); drawJobs(); changed(); });
  app.querySelector(".formcol").addEventListener("input", e => {
    const t = e.target;
    if (t.dataset.hr != null) { const v = t.value.replace(/[^\d]/g, ""); AC[+t.dataset.hr].hours = v ? Math.min(50000, +v) : null; }
    if (t.dataset.so != null) AC[+t.dataset.so].training_other = t.value.slice(0, 60);
    for (const k of ["pic", "sic"]) if (t.dataset[k] != null) { const m = "ac_" + k, v = t.value.replace(/[^\d]/g, ""); D[m] = D[m] || {}; if (v) D[m][t.dataset[k]] = Math.min(50000, +v); else delete D[m][t.dataset[k]]; }
    if (t.dataset.job != null && t.tagName === "INPUT" && t.type !== "checkbox") { const [i, k] = t.dataset.job.split(":"); D.jobs[+i][k] = t.value.slice(0, 60); }
    if (t.id !== "acq") changed();
  });
  app.querySelector(".formcol").addEventListener("change", e => { const t = e.target; if (t.dataset.p135 != null) { AC[+t.dataset.p135].part135 = t.value; changed(); } else if (t.dataset.tr != null) { AC[+t.dataset.tr].type_rated = t.checked; drawAc(); changed(); }
    else if (t.dataset.trd != null) { D.tr_des = D.tr_des || {}; D.tr_des[t.dataset.trd] = t.value; drawAc(); changed(); }
    else if (t.dataset.trsp != null) { D.tr_sp = D.tr_sp || {}; if (t.checked) D.tr_sp[t.dataset.trsp] = true; else delete D.tr_sp[t.dataset.trsp]; changed(); } else if (t.dataset.cur != null) { AC[+t.dataset.cur].is_current = t.checked; drawAc(); changed(); }
    else if (t.dataset.acrate != null) { D.ac_rate = D.ac_rate || {}; if (t.value) D.ac_rate[t.dataset.acrate] = t.value; else delete D.ac_rate[t.dataset.acrate]; changed(); }
    else if (t.dataset.job != null) { const [i, k] = t.dataset.job.split(":"); D.jobs[+i][k] = t.type === "checkbox" ? (t.checked ? "now" : "") : t.value; if (k === "to" && t.type === "checkbox") drawJobs(); changed(); }
    else if (t.dataset.now != null) { const sq = +t.dataset.now; D.past = (D.past || []).filter(x => x !== sq); if (!t.checked) D.past.push(sq); changed(); }
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
  $("save").onclick = async () => { D.jobs = (D.jobs || []).filter(x => x.kind || x.role || x.company || x.from); 
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
      // Admins' own text goes public directly (the database allows it), so nothing waits for review.
      if (P.bio !== publicBio && !IS_ADMIN) {
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
    <div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn primary adminbtn" href="../admin/" hidden>Admin</a><a class="btn secondary" href="#/account">Account</a><a class="btn secondary" href="#/me">Crew profile</a><button class="btn secondary toggleprev" id="tp" type="button">Preview</button></div></div>
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
      if (P.about !== publicAbout && !IS_ADMIN) { const rp = await sb.from("operator_about_pending").upsert({user_id:uid, about:P.about}, {onConflict:"user_id"}); pendingAbout = rp.error ? null : P.about; }
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

/* ---------------- saved searches and saved crew ---------------- */
async function viewSaved(){
  if (!sb) return;
  if (!user) { app.innerHTML = `<div class="center"><h1>Saved</h1><p>Sign in to see your saved searches and saved crew.</p><button class="btn primary" id="go" type="button">Sign in</button></div>`; $("go").onclick = () => signIn(route); return; }
  app.innerHTML = `<p>Loading…</p>`;
  const [ss, D] = await Promise.all([sb.from("saved_searches").select("id,name,filters,alerts,created_at").order("created_at", {ascending:false}), loadDir()]); await loadFav();
  if (ss.error) { app.innerHTML = `<div class="center"><h1>Saved</h1><p>Saved searches and saved crew switch on after a Cali Aircrew setup step.</p><a class="btn secondary" href="#/">Back to Find crew</a></div>`; return; }
  const favs = D.listed.filter(p => FAV && FAV.has(p.user_id));
  app.innerHTML = `<div class="pagehead"><div><h1>Saved</h1><p>Your saved searches and the crew you saved. Only you can see this page.</p></div>${tabs("")}</div>
  <section class="panel"><h2>Saved searches</h2>${(ss.data || []).length ? (ss.data || []).map(x => `<div class="row" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:10px 0;border-bottom:1px solid #D6E0EA">
      <span style="flex:1;min-width:200px"><b>${esc(x.name)}</b><br><small>${esc(describeF(x.filters || {}))}</small></span>
      <label class="tr"><input type="checkbox" data-alert="${x.id}"${x.alerts ? " checked" : ""}> Email new matches</label>
      <button class="btn secondary" type="button" data-open="${x.id}">Open</button><button class="btn secondary" type="button" data-del="${x.id}" aria-label="Delete ${esc(x.name)}">Delete</button></div>`).join("")
    : '<p class="empty" style="margin:0">No saved searches yet. In Find crew, set your filters and tap ☆ Save this search.</p>'}</section>
  <section class="panel"><h2>Saved crew</h2><div class="results">${favs.length ? favs.map(p => resultHTML(p, D.acBy.get(p.user_id) || [], D.mod.get(p.user_id))).join("") : '<p class="empty" style="margin:0">No saved crew yet. Tap ☆ Save on a profile.</p>'}</div></section>`;
  app.addEventListener("click", async function h(e){
    if (!location.hash.startsWith("#/saved")) { app.removeEventListener("click", h); return; }
    const o = e.target.closest("[data-open]"), d = e.target.closest("[data-del]");
    if (o) { const x = ss.data.find(r => String(r.id) === o.dataset.open); F = Object.assign({seq:null, type:"", region:"", cert:"", avail:"", p135:false, contract:false, rate:"", x:[], eng:"", minTT:"", minPIC:"", minTurb:"", minType:"", near:"", nm:"100", trn:"", tr:""}, x.filters || {}); location.hash = "#/"; }
    if (d && confirm("Delete this saved search?")) { await sb.from("saved_searches").delete().eq("id", +d.dataset.del); viewSaved(); }
  });
  app.querySelectorAll("[data-alert]").forEach(cb => cb.onchange = async () => { const {error} = await sb.from("saved_searches").update({alerts:cb.checked}).eq("id", +cb.dataset.alert); toast(error ? "Not saved: " + error.message : cb.checked ? "Alerts on" : "Alerts off"); });
}

/* ---------------- account ---------------- */
async function viewAccount(){
  if (!sb) return;
  if (!user) { app.innerHTML = `<div class="center"><h1>Account</h1><p>Sign in to manage your account.</p><button class="btn primary" id="go" type="button">Sign in</button></div>`; $("go").onclick = () => signIn(route); return; }
  if (await needMfa()) { app.innerHTML = `<div class="center"><h1>One more step</h1><p>Enter your Microsoft Authenticator code to manage your account.</p><button class="btn primary" id="go" type="button">Enter code</button></div>`; $("go").onclick = () => signIn(route); return; }
  const uid = user.id, {data:f} = await sb.auth.mfa.listFactors(), mfaOn = ((f && f.totp) || []).some(x => x.status === "verified");
  const rr = await sb.from("account_recovery").select("*").eq("user_id", uid).maybeSingle(), R = (rr && !rr.error && rr.data) || {backup_email:"", phone:"", backup_confirmed:false}, recOk = !(rr && rr.error);
  app.innerHTML = `<div class="pagehead"><div><h1>Account</h1><p>Signed in as ${esc(user.email || "")}</p></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn primary adminbtn" href="../admin/" hidden>Admin</a><a class="btn secondary" href="#/me">Crew profile</a><a class="btn secondary" href="#/op">Operator profile</a><button class="btn secondary" id="so" type="button">Sign out</button></div></div>
  <div style="display:flex;flex-direction:column;gap:24px;max-width:760px">
    <section class="panel"><h2>Sign-in email</h2><p class="hint">You sign in with a code sent to this address. To change it, enter the new address; we'll email a confirmation link, and the change finishes when you tap it.</p>
      <div class="grid2"><div class="f"><label for="ne">New sign-in email</label><input id="ne" type="email" autocomplete="email" autocapitalize="none" maxlength="254"></div></div>
      <div class="savebar"><button class="btn primary" id="nes" type="button">Change email</button><span class="err" id="nem" role="status"></span></div></section>
    <section class="panel"><h2>Two-step sign-in</h2><div id="mfa"></div></section>
    <section class="panel"><h2>Recovery contacts</h2>
      <p class="hint">If you ever lose access to your email or phone, Cali Aircrew uses these to confirm it's you. Private: only you and Cali Aircrew admins can see them.</p>
      ${recOk ? `<div class="grid2"><div class="f"><label for="rbe">Backup email</label><input id="rbe" type="email" autocapitalize="none" maxlength="254" value="${esc(R.backup_email)}"></div><div class="f"><label for="rph">Mobile phone (optional)</label><input id="rph" type="tel" autocomplete="tel" maxlength="30" value="${esc(R.phone)}"></div></div>
      <div id="bconf">${R.backup_email ? (R.backup_confirmed ? `<p class="okmsg" style="margin:0">✓ Backup email confirmed. If you're ever locked out of your sign-in email, use "Locked out of your email?" in the sign-in box.</p>`
        : `<p class="hint" style="margin:0">Not confirmed yet. Confirm it so you can recover your account on your own.</p><div><button class="btn secondary" id="bcs" type="button">Confirm backup email</button></div>`) : ""}</div>
      <div class="savebar"><button class="btn primary" id="rs" type="button">Save recovery contacts</button><span id="rsm" role="status"></span></div>` : `<p class="hint" style="margin:0">Recovery contacts switch on after a Cali Aircrew setup step.</p>`}</section>
    <section class="panel"><h2>Email reminders</h2>
      <label class="switch"><input type="checkbox" id="remind"> Email me 60 and 30 days before an aircraft currency, flight attendant recurrent or CPR date runs out, and when it lapses</label>
      <label class="switch"><input type="checkbox" id="ctok"> Let owners and operators send me contact requests by email (your address stays private unless you reply)</label><div id="ctmsg" class="hint" role="status"></div>
      <p class="hint" style="margin:0">Uses the "current through" months on your crew profile. Sent to ${esc(user.email || "your sign-in email")}.</p><span id="remmsg" role="status"></span></section>
    <section class="panel"><h2>Your data</h2><p class="hint">Download everything Cali Aircrew holds about your account: profiles, aircraft, saved checklists and recovery contacts.</p>
      <div><button class="btn secondary" id="dl" type="button">Download my data</button></div></section>
    <section class="panel" style="border-color:#E4B7B2"><h2>Delete my account</h2><p class="hint">Permanently deletes your account, crew and operator profiles, aircraft, saved checklists and recovery contacts. This can't be undone.</p>
      <div class="grid2"><div class="f"><label for="de">Type your sign-in email to confirm</label><input id="de" type="email" autocapitalize="none"></div></div>
      <div class="savebar"><button class="btn danger" id="del" type="button" style="background:#fff;color:#8A2A20;border:2px solid #8A2A20">Delete my account</button><span class="err" id="dem" role="status"></span></div></section>
  </div>`;
  $("so").onclick = async () => { await sb.auth.signOut(); location.hash = "#/"; };
  const ms = await sb.from("member_settings").select("*").eq("user_id", uid).maybeSingle();
  const ctOk = !(ms && ms.error) && !(ms && ms.data && !("contact_requests" in ms.data));
  $("ctok").checked = !(ms && ms.data && ms.data.contact_requests === false); $("ctok").disabled = !ctOk;
  $("ctok").onchange = async () => { const on = $("ctok").checked;
    const {error} = await sb.from("member_settings").upsert({user_id:uid, contact_requests:on, updated_at:new Date().toISOString()}, {onConflict:"user_id"});
    $("ctmsg").className = error ? "err" : "okmsg"; $("ctmsg").textContent = error ? "Not saved: " + error.message : on ? "Contact requests on." : "Contact requests off."; };
  const remOk = !(ms && ms.error); $("remind").checked = !(ms && ms.data && ms.data.currency_emails === false); $("remind").disabled = !remOk;
  if (!remOk) $("remmsg").textContent = "Reminders switch on after a Cali Aircrew setup step.";
  $("remind").onchange = async () => { const on = $("remind").checked;
    const {error} = await sb.from("member_settings").upsert({user_id:uid, currency_emails:on, updated_at:new Date().toISOString()}, {onConflict:"user_id"});
    $("remmsg").className = error ? "err" : "okmsg"; $("remmsg").textContent = error ? "Not saved: " + error.message : on ? "Reminders on." : "Reminders off."; };
  $("nes").onclick = async () => { const ne = $("ne").value.trim().toLowerCase(); const msg = t => { $("nem").textContent = t; };
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ne)) return msg("Enter the new email address.");
    if (ne === (user.email || "").toLowerCase()) return msg("That's already your sign-in email.");
    const {error} = await sb.auth.updateUser({email:ne}, {emailRedirectTo:location.origin + location.pathname + "#/account"});
    if (error) return msg(error.message);
    $("nem").className = "okmsg"; msg(`Check ${ne} (and, if asked, your current inbox) for a confirmation link. Your sign-in email changes after you tap it.`); };
  const box = $("mfa");
  const drawM = on => { box.innerHTML = on ? `<p style="margin:0">✓ On. After the email code, Microsoft Authenticator asks for a 6-digit code.</p><div><button class="btn secondary" id="mfoff" type="button">Turn off two-step sign-in</button></div>`
      : `<p class="hint" style="margin:0">Extra security: after the email code, you also type a code from <b>Microsoft Authenticator</b> on your phone. Tip: add it on two devices so losing one doesn't lock you out.</p><div><button class="btn primary" id="mfon" type="button">Turn on with Microsoft Authenticator</button></div>`;
    if (on) $("mfoff").onclick = async () => { if (!confirm("Turn off two-step sign-in?")) return; const {data:ff} = await sb.auth.mfa.listFactors(); for (const x of (ff && ff.all) || []) if (x.factor_type === "totp") await sb.auth.mfa.unenroll({factorId:x.id}); try { await sb.auth.refreshSession(); } catch (_) {} drawM(false); };
    else $("mfon").onclick = enroll; };
  const enroll = async () => { const {data:ff} = await sb.auth.mfa.listFactors(); for (const x of (ff && ff.all) || []) if (x.factor_type === "totp" && x.status !== "verified") await sb.auth.mfa.unenroll({factorId:x.id});
    const {data, error} = await sb.auth.mfa.enroll({factorType:"totp", friendlyName:"Microsoft Authenticator " + new Date().toISOString().slice(0, 16), issuer:"Cali Aircrew"});
    if (error) { box.insertAdjacentHTML("beforeend", `<p class="err">${esc(error.message)}</p>`); return; }
    box.innerHTML = `<ol style="padding-left:20px;margin:0"><li>Open <b>Microsoft Authenticator</b>, tap <b>＋</b>, then <b>Other account</b>.</li><li>Scan this code. (On this same phone? Choose <b>Enter code manually</b>.)</li><li>Type the 6-digit code it shows, then tap Confirm.</li></ol>
      <div style="text-align:center"><img src="${data.totp.qr_code}" alt="QR code for Microsoft Authenticator" style="width:200px;height:200px;background:#fff;padding:8px;border-radius:8px"></div>
      <p class="hint" style="margin:0">Manual setup key: <code style="user-select:all;word-break:break-all">${esc(data.totp.secret)}</code></p>
      <div class="grid2"><div class="f"><label for="mfc">6-digit code</label><input id="mfc" inputmode="numeric" autocomplete="one-time-code" maxlength="6"></div></div><div><button class="btn primary" id="mfok" type="button">Confirm</button></div><p class="err" id="mfe"></p>`;
    $("mfok").onclick = async () => { const code = $("mfc").value.trim(); if (!/^\d{6}$/.test(code)) { $("mfe").textContent = "Enter the 6-digit code."; return; }
      const {data:ch, error:e1} = await sb.auth.mfa.challenge({factorId:data.id}); if (e1) { $("mfe").textContent = e1.message; return; }
      const {error:e2} = await sb.auth.mfa.verify({factorId:data.id, challengeId:ch.id, code}); if (e2) { $("mfe").textContent = e2.message; return; } drawM(true); }; };
  drawM(mfaOn);
  if (recOk) $("rs").onclick = async () => { const be = $("rbe").value.trim().toLowerCase(), ph = $("rph").value.trim();
    if (be && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(be)) { $("rsm").className = "err"; $("rsm").textContent = "Enter a valid backup email, or leave it blank."; return; }
    if (be && be === (user.email || "").toLowerCase()) { $("rsm").className = "err"; $("rsm").textContent = "Use a different address from your sign-in email."; return; }
    const {error} = await sb.from("account_recovery").upsert({user_id:uid, backup_email:be, phone:ph}, {onConflict:"user_id"});
    $("rsm").className = error ? "err" : "okmsg"; $("rsm").textContent = error ? "Not saved: " + error.message : "Saved."; };
  const bcs = $("bcs");
  if (bcs) bcs.onclick = async () => { bcs.disabled = true; const r = await recoveryCall({action:"send_confirm"}); bcs.disabled = false;
    const box = $("bconf"); if (!r.ok) { box.insertAdjacentHTML("beforeend", `<p class="err" style="margin:0">${esc(r.message)}</p>`); return; }
    box.innerHTML = `<p class="okmsg" style="margin:0">${esc(r.message)}</p><div class="grid2"><div class="f"><label for="bcc">6-digit code</label><input id="bcc" inputmode="numeric" autocomplete="one-time-code" maxlength="6"></div></div><div><button class="btn primary" id="bcv" type="button">Confirm</button></div><p class="err" id="bcm" style="margin:0"></p>`;
    $("bcv").onclick = async () => { const code = $("bcc").value.trim(); if (!/^\d{6}$/.test(code)) { $("bcm").textContent = "Enter the 6-digit code."; return; }
      const c = await recoveryCall({action:"check_confirm", code}); if (!c.ok) { $("bcm").textContent = c.message; return; }
      box.innerHTML = `<p class="okmsg" style="margin:0">✓ Backup email confirmed. If you're ever locked out of your sign-in email, use "Locked out of your email?" in the sign-in box.</p>`; }; };
  $("dl").onclick = async () => { const get = (t, k) => sb.from(t).select("*").eq(k || "user_id", uid).then(r => r.error ? [] : r.data || [], () => []);
    const [cp, ca, cv, cb, op, oa, ob, ck, mi, ar] = await Promise.all(["crew_profiles", "crew_aircraft", "crew_private", "crew_bio_pending", "operator_profiles", "operator_aircraft", "operator_about_pending", "checklists", "my_items", "account_recovery"].map(t => get(t)));
    const out = {exported_at:new Date().toISOString(), account:{id:uid, email:user.email}, crew_profile:cp, crew_aircraft:ca, crew_private:cv, crew_text_waiting_for_review:cb, operator_profile:op, operator_aircraft:oa, operator_text_waiting_for_review:ob, checklists:ck, my_items:mi, recovery_contacts:ar};
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], {type:"application/json"})); a.download = "my-cali-aircrew-data.json"; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); };
  $("del").onclick = async () => { const typed = $("de").value.trim(); if (!typed) { $("dem").textContent = "Type your sign-in email first."; return; }
    if (!confirm("Delete your Cali Aircrew account permanently? This can't be undone.")) return;
    const {error} = await sb.rpc("delete_my_account", {p_confirm_email:typed}); if (error) { $("dem").textContent = error.message; return; }
    location.hash = "#/deleted";   // the sign-out below redraws the page; this route shows the confirmation
    try { await sb.auth.signOut(); } catch (_) {} try { localStorage.removeItem("acb-auth"); } catch (_) {} route(); };
}

/* ---------------- router ---------------- */
async function route(){ await route0(); showAdmin(); }
async function route0(){
  const h = location.hash.replace(/^#\/?/, "");
  window.onbeforeunload = null;
  if (h === "me") return viewMe();
  if (h.startsWith("p/")) return viewProfile(h.slice(2));
  if (h === "aircraft") return viewBrowse();
  if (h.startsWith("a/")) { const [n, w] = h.slice(2).split("/"); return viewAircraft(+n, w); }
  if (h === "op") return viewOpMe();
  if (h === "account") return viewAccount();
  if (h.startsWith("report/")) return viewReport(h.slice(7));
  if (h === "saved") return viewSaved();
  if (h === "deleted") { app.innerHTML = `<div class="center"><h1>Account deleted</h1><p>Your account and everything in it have been removed. Thanks for flying with Cali Aircrew.</p><a class="btn secondary" href="../">Home</a></div>`; return; }
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
