// Cali Aircrew — contact requests Edge Function (Supabase, Deno). First step toward messaging.
// Deployed by GitHub Actions (.github/workflows/deploy-functions.yml) with "Verify JWT" OFF;
// this code checks signed-in users itself (same as the recovery function).
// Secrets: RESEND_API_KEY and MAIL_FROM (project-wide, already set). Optional SITE_URL (default https://caliaircrew.com).
// Database: supabase/017_contact_requests.sql.
//
// Actions (POST JSON {action, ...}):
//   send   {to, note, seq?}   signed in, confirmed email · emails the pilot a short note. The pilot's address is never
//                             shown; the sender's address is the Reply-To, so the pilot answers by replying (or ignores it).
//                             Limits: 10 per sender per day, 2 to the same pilot per week; failed sends don't count.
//   report {id, code, reason?} anyone (one-time code from the email) · marks the request reported for admin review.
import { createClient } from "npm:@supabase/supabase-js@2";

const URL_ = Deno.env.get("SUPABASE_URL") ?? "";
function firstKey(raw: string | undefined): string {
  if (!raw) return "";
  try { const v = JSON.parse(raw); if (typeof v === "string") return v; if (Array.isArray(v)) return String(v[0] ?? ""); if (v && typeof v === "object") return String(Object.values(v)[0] ?? ""); } catch (_) { /* plain string */ }
  return raw;
}
const SERVICE = Deno.env.get("SERVICE_KEY") || firstKey(Deno.env.get("SUPABASE_SECRET_KEYS")) || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = Deno.env.get("MAIL_FROM") ?? "Cali Aircrew <no-reply@caliaircrew.com>";
const SITE = (Deno.env.get("SITE_URL") ?? "https://caliaircrew.com").replace(/\/$/, "");

export const LIMIT_DAY = 10, LIMIT_PILOT_WEEK = 2, NOTE_MAX = 500;
// Same rule as profile text (src/crew.js CONTACTISH): no emails, links or phone numbers in the note.
export const CONTACTISH = /@|https?:|www\.|\.(com|net|org|io)\b|\d{3}[\s.)-]*\d{3}[\s.-]*\d{4}/i;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

export async function sha256(text: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
export function newCode() {
  return Array.from(crypto.getRandomValues(new Uint8Array(18))).map((b) => b.toString(16).padStart(2, "0")).join("");
}
/** "" when the note is fine, otherwise the message to show. */
export function checkNote(note: string): string {
  const n = note.trim();
  if (!n) return "Write a short note.";
  if (n.length > NOTE_MAX) return `Keep the note under ${NOTE_MAX} characters.`;
  if (CONTACTISH.test(n)) return "Leave out phone numbers, email addresses and links. The pilot can reply to you by email.";
  return "";
}
/** "" when the sender is under the limits, otherwise the message to show. Counts exclude failed sends. */
export function checkLimits(today: number, toPilotThisWeek: number): string {
  if (today >= LIMIT_DAY) return `You've sent ${LIMIT_DAY} contact requests today. Try again tomorrow.`;
  if (toPilotThisWeek >= LIMIT_PILOT_WEEK) return "You've already contacted this pilot twice this week. Give them time to reply.";
  return "";
}
export function emailFor(o: { label: string; aircraft: string; note: string; senderLink: string; reportLink: string }) {
  const subject = `${o.label} wants to talk${o.aircraft ? " about a " + o.aircraft : ""}`.slice(0, 180);
  const text = `${o.label} sent you a contact request through Cali Aircrew${o.aircraft ? ` about a ${o.aircraft}` : ""}:\n\n` +
    o.note.trim().split("\n").map((l) => "  " + l).join("\n") + "\n\n" +
    (o.senderLink ? `Their profile: ${o.senderLink}\n\n` : "") +
    `To answer, just reply to this email. Replying shares your email address with them; nothing is shared if you don't.\n` +
    `Verify anyone before you accept work.\n\n` +
    `Something wrong with this request? Report it: ${o.reportLink}\n` +
    `Stop receiving contact requests: ${SITE}/crew/#/account\n\nCali Aircrew`;
  return { subject, text };
}
async function sendMail(to: string, replyTo: string, subject: string, text: string, fetcher = fetch) {
  if (!RESEND) throw new Error("Email sending isn't set up yet (RESEND_API_KEY).");
  const r = await fetcher("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], reply_to: replyTo, subject, text }),
  });
  if (!r.ok) throw new Error("Email service error " + r.status);
}
async function signedInUser(admin: any, req: Request) {
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt || jwt.startsWith("sb_")) return null;
  const { data } = await admin.auth.getUser(jwt);
  return data?.user ?? null;
}
async function countSince(admin: any, col: string, val: string, sinceMs: number, extra?: [string, string]) {
  let q = admin.from("contact_requests").select("id", { count: "exact", head: true }).eq(col, val).neq("status", "failed")
    .gte("created_at", new Date(Date.now() - sinceMs).toISOString());
  if (extra) q = q.eq(extra[0], extra[1]);
  const { count, error } = await q; if (error) throw error;
  return count ?? 0;
}

export async function handle(req: Request, admin: any, fetcher = fetch): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply({ ok: false, message: "POST only" }, 405);
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return reply({ ok: false, message: "Bad request" }, 400); }
  try {
    switch (body.action) {
      case "send": {
        const user = await signedInUser(admin, req); if (!user) return reply({ ok: false, message: "Sign in first." }, 401);
        if (!user.email || !user.email_confirmed_at) return reply({ ok: false, message: "Confirm your email address first." }, 403);
        const to = String(body.to ?? ""), note = String(body.note ?? "").trim();
        const seq = body.seq === undefined || body.seq === null || body.seq === "" ? null : Number(body.seq);
        if (!/^[0-9a-f-]{36}$/i.test(to)) return reply({ ok: false, message: "Unknown profile." }, 400);
        if (to === user.id) return reply({ ok: false, message: "That's your own profile." }, 400);
        if (seq !== null && !(Number.isInteger(seq) && seq >= 0 && seq <= 9999)) return reply({ ok: false, message: "Unknown aircraft." }, 400);
        const bad = checkNote(note); if (bad) return reply({ ok: false, message: bad }, 400);
        const [{ data: prof }, { data: mod }, { data: set }] = await Promise.all([
          admin.from("crew_profiles").select("user_id,published").eq("user_id", to).maybeSingle(),
          admin.from("moderation").select("approved,hidden").eq("user_id", to).maybeSingle(),
          admin.from("member_settings").select("contact_requests").eq("user_id", to).maybeSingle()]);
        if (!prof || !prof.published || !mod || !mod.approved || mod.hidden) return reply({ ok: false, message: "This profile isn't taking requests right now." }, 404);
        if (set && set.contact_requests === false) return reply({ ok: false, message: "This pilot has turned off contact requests." }, 403);
        const lim = checkLimits(await countSince(admin, "sender_id", user.id, 86400_000),
                                await countSince(admin, "sender_id", user.id, 7 * 86400_000, ["recipient_id", to]));
        if (lim) return reply({ ok: false, message: lim }, 429);
        // Who it's from: the sender's operator name (unless private), else their crew name, else a neutral label.
        const [{ data: op }, { data: cp }] = await Promise.all([
          admin.from("operator_profiles").select("name,details,published").eq("user_id", user.id).maybeSingle(),
          admin.from("crew_profiles").select("display_name,details,published").eq("user_id", user.id).maybeSingle()]);
        const opName = op && op.published && op.name && !(op.details && op.details.private) ? String(op.name) : "";
        const label = (opName || (cp && cp.display_name) || "A Cali Aircrew member").slice(0, 120);
        const senderLink = opName ? `${SITE}/crew/#/o/${user.id}` : cp && cp.published ? `${SITE}/crew/#/p/${user.id}` : "";
        let aircraft = "";
        if (seq !== null) { try { const r = await fetcher(`${SITE}/crew/aircraft-names.json`); if (r.ok) aircraft = (await r.json())[String(seq)] || ""; } catch (_) { /* optional */ } }
        const { data: rcpt } = await admin.auth.admin.getUserById(to);
        const rcptEmail = rcpt?.user?.email; if (!rcptEmail) return reply({ ok: false, message: "This profile isn't taking requests right now." }, 404);
        const code = newCode();
        const { data: row, error } = await admin.from("contact_requests").insert({ sender_id: user.id, recipient_id: to, seq, sender_label: label, note, status: "sent", report_hash: await sha256(code) }).select("id").single();
        if (error) throw error;
        const { subject, text } = emailFor({ label, aircraft, note, senderLink, reportLink: `${SITE}/crew/#/report/${row.id}/${code}` });
        try { await sendMail(rcptEmail, user.email, subject, text, fetcher); }
        catch (e) { await admin.from("contact_requests").update({ status: "failed" }).eq("id", row.id); return reply({ ok: false, message: "The email didn't go through. Please try again later." }, 502); }
        return reply({ ok: true, message: "Sent. The pilot will reply to your email if they're interested." });
      }
      case "report": {
        const id = String(body.id ?? ""), code = String(body.code ?? ""), reason = String(body.reason ?? "").trim().slice(0, 500);
        if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f]{36}$/.test(code)) return reply({ ok: false, message: "That report link isn't valid." }, 400);
        const { data: r } = await admin.from("contact_requests").select("id,status,report_hash").eq("id", id).maybeSingle();
        if (!r || !r.report_hash || r.report_hash !== (await sha256(code)) || r.status === "failed") return reply({ ok: false, message: "That report link isn't valid." }, 400);
        if (r.status === "reported" || r.status === "cleared") return reply({ ok: true, message: "Thanks. This request was already reported, and Cali Aircrew is reviewing it." });
        const { error } = await admin.from("contact_requests").update({ status: "reported", reported_at: new Date().toISOString(), report_reason: reason }).eq("id", id);
        if (error) throw error;
        return reply({ ok: true, message: "Thanks. Cali Aircrew will review this request." });
      }
      default:
        return reply({ ok: false, message: "Unknown action" }, 400);
    }
  } catch (e) {
    return reply({ ok: false, message: (e as Error).message || "Something went wrong" }, 500);
  }
}

const adminClient = createClient(URL_ || "http://localhost", SERVICE || "missing", { auth: { persistSession: false, autoRefreshToken: false } });
Deno.serve((req) => SERVICE ? handle(req, adminClient) : Promise.resolve(reply({ ok: false, message: "Server key missing" }, 500)));
