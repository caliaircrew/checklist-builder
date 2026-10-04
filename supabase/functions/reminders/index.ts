// Cali Aircrew — currency reminder emails (Supabase Edge Function, Deno).
// Deploy: Edge Functions → Deploy a new function → name "reminders" → paste this file → turn OFF "Verify JWT".
// Runs once a day from Supabase Cron (supabase/014_reminder_schedule.sql), which sends the header x-cron-key.
//
// Secrets (Edge Functions → Secrets): RESEND_API_KEY and MAIL_FROM (already added for recovery), plus
//   REMINDER_KEY  a long random value; the same value is stored in the database vault as "reminder_key".
// Optional: SITE_URL (default https://caliaircrew.com).
//
// What it sends: for each member with reminders on, one email listing every date that is
//   60 days out, 30 days out, or lapsed within the last month — aircraft "current through",
//   flight attendant recurrent, CPR / AED / first aid. "Current through" a month = valid to the end of that month.
// Each reminder is logged (reminder_log) and never sent twice. POST {"dry": true} returns the plan without sending.
import { createClient } from "npm:@supabase/supabase-js@2";

function firstKey(raw: string | undefined): string {
  if (!raw) return "";
  try { const v = JSON.parse(raw); if (typeof v === "string") return v; if (Array.isArray(v)) return String(v[0] ?? ""); if (v && typeof v === "object") return String(Object.values(v)[0] ?? ""); } catch (_) { /* plain */ }
  return raw;
}
const URL_ = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SERVICE_KEY") || firstKey(Deno.env.get("SUPABASE_SECRET_KEYS")) || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = Deno.env.get("MAIL_FROM") ?? "Cali Aircrew <no-reply@caliaircrew.com>";
const KEY = Deno.env.get("REMINDER_KEY") ?? "";
const SITE = (Deno.env.get("SITE_URL") ?? "https://caliaircrew.com").replace(/\/$/, "");

export type Row = { user_id: string; email: string; kind: string; ref: string; school: string; through: string };
export type Due = Row & { stage: "60" | "30" | "lapsed"; days: number };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SCHOOLS: Record<string, string> = { flightsafety: "FlightSafety", cae: "CAE", simcom: "SIMCOM", loft: "LOFT", factory: "factory", inhouse: "in-house", independent: "independent instructor", facts: "FACTS Training", company: "company" };
const monthText = (ym: string) => { const [y, m] = ym.split("-").map(Number); return `${MONTHS[m - 1]} ${y}`; };

/** Which reminder (if any) is due today for a "current through YYYY-MM" date. */
export function stageFor(through: string, today: Date): { stage: "60" | "30" | "lapsed"; days: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(through || ""); if (!m) return null;
  const end = Date.UTC(+m[1], +m[2], 0);                                      // last day of the month
  const t = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const days = Math.round((end - t) / 86400000);
  if (days < 0) return days >= -31 ? { stage: "lapsed", days } : null;
  if (days <= 30) return { stage: "30", days };
  if (days <= 60) return { stage: "60", days };
  return null;
}

/** Reminders due today that haven't been sent, grouped by member. */
export function plan(rows: Row[], sent: Set<string>, today: Date): Map<string, Due[]> {
  const out = new Map<string, Due[]>();
  for (const r of rows) {
    const s = stageFor(r.through, today); if (!s) continue;
    if (sent.has([r.user_id, r.kind, r.ref, r.through, s.stage].join("|"))) continue;
    const list = out.get(r.user_id) ?? []; list.push({ ...r, ...s }); out.set(r.user_id, list);
  }
  return out;
}

export function emailText(items: Due[], names: Record<string, string>): { subject: string; text: string } {
  const label = (d: Due) => d.kind === "aircraft" ? `${names[d.ref] ?? "Aircraft"} currency${d.school ? ` (${SCHOOLS[d.school] ?? d.school})` : ""}`
    : d.kind === "fa_recurrent" ? `Flight attendant recurrent training${d.school ? ` (${SCHOOLS[d.school] ?? d.school})` : ""}` : "CPR / AED / first aid";
  const when = (d: Due) => d.stage === "lapsed" ? `lapsed at the end of ${monthText(d.through)}` : `current through ${monthText(d.through)} (${d.days} day${d.days === 1 ? "" : "s"} left)`;
  const lapsed = items.some(d => d.stage === "lapsed");
  const subject = lapsed ? "Cali Aircrew: currency lapsed" : items.length === 1 ? `Cali Aircrew: ${label(items[0])} coming due` : "Cali Aircrew: currency coming due";
  const lines = items.sort((a, b) => a.days - b.days).map(d => `• ${label(d)}: ${when(d)}`);
  const text = `Hello,\n\nA reminder from Cali Aircrew about dates on your crew profile:\n\n${lines.join("\n")}\n\n` +
    `Once you've completed training, update the date so your profile shows you as current:\n${SITE}/crew/#/me\n\n` +
    (lapsed ? "Until then, your profile shows that currency as expired.\n\n" : "") +
    `You get these emails because these dates are on your Cali Aircrew profile. To turn them off: ${SITE}/crew/#/account\n\nCali Aircrew`;
  return { subject, text };
}

async function sendMail(to: string, subject: string, text: string) {
  if (!RESEND) throw new Error("RESEND_API_KEY missing");
  const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: FROM, to: [to], subject, text }) });
  if (!r.ok) throw new Error("Email service error " + r.status);
}

Deno.serve(async (req) => {
  const reply = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
  if (req.method !== "POST") return reply({ ok: false, message: "POST only" }, 405);
  if (!KEY || req.headers.get("x-cron-key") !== KEY) return reply({ ok: false, message: "Not authorized" }, 401);
  if (!SERVICE) return reply({ ok: false, message: "Server key missing" }, 500);
  let body: { dry?: boolean } = {}; try { body = await req.json(); } catch (_) { /* empty body is fine */ }
  const admin = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: rows, error } = await admin.rpc("reminder_candidates"); if (error) return reply({ ok: false, message: error.message }, 500);
  const ids = [...new Set((rows as Row[]).map(r => r.user_id))];
  const sent = new Set<string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data: logs } = await admin.from("reminder_log").select("user_id,kind,ref,through,stage").in("user_id", ids.slice(i, i + 200));
    (logs ?? []).forEach((l: Record<string, string>) => sent.add([l.user_id, l.kind, l.ref, l.through, l.stage].join("|")));
  }
  const due = plan(rows as Row[], sent, new Date());
  let names: Record<string, string> = {};
  try { const r = await fetch(`${SITE}/crew/aircraft-names.json`); if (r.ok) names = await r.json(); } catch (_) { /* names are optional */ }
  const result = { ok: true, dry: !!body.dry, members: due.size, reminders: 0, emails: 0, failed: 0, preview: [] as unknown[] };
  for (const [uid, items] of due) {
    const { subject, text } = emailText(items, names);
    result.reminders += items.length;
    if (body.dry) { if (result.preview.length < 5) result.preview.push({ subject, items: items.map(d => [d.kind, d.ref, d.through, d.stage]) }); continue; }
    try {
      await sendMail(items[0].email, subject, text);
      await admin.from("reminder_log").insert(items.map(d => ({ user_id: uid, kind: d.kind, ref: d.ref, through: d.through, stage: d.stage })));
      result.emails++;
    } catch (_) { result.failed++; }
  }
  return reply(result);
});
