/* Cali Aircrew — Find crew matching rules. ONE copy, inserted by build.py into the crew pages (src/crew.js) and the
   daily email job (supabase/functions/reminders), so saved-search alerts always agree with what Find crew shows.
   env = { info: seq -> {engine, twin, heli} | undefined,  ll: airportCode -> [lat, lon] | null }               */
const RATE_LOW = {u500:0, "500":500, "750":750, "1000":1000, "1250":1250, "1500":1500, "2000":2000, "2500":2500, "3000":3000};
const monthNow = () => { const n = new Date(); return n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0"); };
const ROLEF = {
  flight_attendant:[["fa_cpr","CPR / AED current", d => !!d.cpr_until && d.cpr_until >= monthNow()], ["fa_rec","FA recurrent current", d => !!d.fa_recurrent && d.fa_recurrent >= monthNow()],
    ["fa_intl","International trips", d => (d.fa_skills || []).includes("intl")], ["fa_cul","Culinary / chef training", d => (d.fa_skills || []).includes("culinary")], ["fa_food","Food safety certificate", d => !!d.food_safety]],
  mechanic:[["mx_ap","A&P", d => (d.mx_certs || []).includes("ap") || (d.ratings || []).includes("ap")], ["mx_ia","IA", d => (d.mx_certs || []).includes("ia") || (d.ratings || []).includes("ia")],
    ["mx_av","Avionics", d => (d.mx_spec || []).includes("avionics") || (d.mx_certs || []).includes("fcc")], ["mx_aog","AOG road trips", d => !!d.mx_aog], ["mx_135","Part 135 maintenance", d => (d.mx_exp || []).includes("p135")]],
  helicopter_pilot:[["h_nvg","NVG", d => (d.heli_ops || []).includes("nvg")], ["h_ll","Long line / external load", d => (d.heli_ops || []).includes("longline")], ["h_ems","EMS / air medical", d => (d.heli_ops || []).includes("ems")],
    ["h_fire","Firefighting", d => (d.heli_ops || []).includes("fire")], ["h_tour","Tours", d => (d.heli_ops || []).includes("tours")], ["h_r44","R44 SFAR 73", d => (d.sfar73 || []).includes("r44")], ["h_r22","R22 SFAR 73", d => (d.sfar73 || []).includes("r22")]]
};
/* Hours by engine type from per-aircraft hours. Turbine = jet + turboprop + turbine helicopter. */
function hoursByTypeWith(info, aircraft){
  const t = {jet:0, turboprop:0, piston:0, multi:0, heliT:0, heliP:0};
  for (const a of aircraft || []) { const i = info(a.acft_seq), h = +a.hours || 0; if (!i || !h) continue;
    if (i.heli) { if (i.engine === "piston") t.heliP += h; else t.heliT += h; }
    else if (i.engine === "jet") t.jet += h; else if (i.engine === "turboprop") t.turboprop += h; else t.piston += h;
    if (i.twin && !i.heli) t.multi += h; }
  t.turbine = t.jet + t.turboprop + t.heliT; t.heli = t.heliT + t.heliP; return t;
}
const acRate = (d, seq) => (d.ac_rate && seq != null && d.ac_rate[seq]) || d.rate || "";
const distNm = (a, b) => { const R = 3440.065, r = x => x * Math.PI / 180, dLa = r(b[0] - a[0]), dLo = r(b[1] - a[1]);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
/* FAA type ratings a pilot holds: from aircraft marked "type rated", using the rating they picked when an aircraft
   spans two FAA ratings (details.tr_des), plus the single-pilot "S" rating when ticked (details.tr_sp).
   A single-pilot rating also counts for the base rating (CE-525S holders match a CE-525 search). */
function typeRatings(p, ac, env){
  const d = p.details || {}, out = new Set();
  for (const a of ac || []) { if (!a.type_rated) continue; const opts = env.tr ? env.tr(a.acft_seq) : null; if (!opts || !opts.length) continue;
    const pick = opts.find(o => o[0] === (d.tr_des || {})[a.acft_seq]) || opts[0]; out.add(pick[0]); if (pick[1] && (d.tr_sp || {})[a.acft_seq]) out.add(pick[1]); }
  return out;
}
function matchProfile(F, p, ac, env){
  const d = p.details || {}, seq = F.seq != null && F.seq !== "" ? +F.seq : null;
  if (F.type && !(p.crew_types || []).includes(F.type)) return false;
  if (seq != null && !ac.some(a => a.acft_seq === seq)) return false;
  if (F.region && d.region !== F.region) return false;
  if (F.cert && d.cert !== F.cert) return false;
  if (F.avail === "now" && d.status !== "now") return false;
  if (F.avail === "soon" && d.status !== "now" && d.status !== "notice") return false;
  if (F.contract && !(d.looking || []).includes("contract")) return false;
  if (F.p135 && !ac.some(a => a.part135 && (seq == null || a.acft_seq === seq))) return false;
  const rr = acRate(d, seq);
  if (F.rate && rr && rr !== "ask" && RATE_LOW[rr] >= +F.rate) return false;   // "Ask me" and not-stated stay in
  if (F.minTT && (+p.total_time || 0) < +F.minTT) return false;
  if (F.minPIC && (+d.hrs_pic || 0) < +F.minPIC) return false;
  if (F.minTurb && hoursByTypeWith(env.info, ac).turbine < +F.minTurb) return false;
  if (F.minType && seq != null && (+((ac.find(a => a.acft_seq === seq) || {}).hours) || 0) < +F.minType) return false;
  if (F.trn && !(d.training || []).includes(F.trn)) return false;
  if (F.tr && !typeRatings(p, ac, env).has(F.tr)) return false;
  if (F.near) { const c = env.ll(F.near), h = env.ll(d.airport); if (c && (!h || distNm(c, h) > +(F.nm || 100))) return false; }
  for (const k of (F.x || [])) { const f = (ROLEF[F.type] || []).find(r => r[0] === k); if (f && !f[2](d)) return false; }
  if (F.eng && F.type === "mechanic" && !(d.mx_engines || []).includes(F.eng)) return false;
  return true;
}
/* Name shown publicly: initials only when the member chose that ("Dana Pilot" -> "D. P."). */
const publicName = p => (p.details || {}).initials ? String(p.display_name || "").split(/\s+/).filter(Boolean).map(w => w[0].toUpperCase() + ".").join(" ") : (p.display_name || "");
