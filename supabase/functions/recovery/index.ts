// Cali Aircrew — account recovery Edge Function (Supabase, Deno).
// Deploy in Supabase: Edge Functions → Deploy a new function → name "recovery" → paste this file.
// Turn OFF "Verify JWT" for this function (the site uses the new publishable key, which is not a JWT);
// this code checks signed-in users itself.
//
// Secrets (Edge Functions → Secrets):
//   RESEND_API_KEY   from resend.com (domain caliaircrew.com verified)
//   MAIL_FROM        e.g.  Cali Aircrew <no-reply@caliaircrew.com>
//   RECOVERY_PEPPER  any long random text (used when hashing codes)
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
//
// Actions (POST JSON {action, ...}):
//   send_confirm              signed in · emails a 6-digit code to the member's saved backup email
//   check_confirm  {code}     signed in · marks the backup email confirmed
//   recover_start  {email}    anyone   · if that sign-in email has a CONFIRMED backup, emails a code to the backup
//                                         (always answers the same way, so it can't be used to find accounts)
//   recover_finish {email, code} anyone · switches the sign-in email to the backup and notifies the old address
import { createClient } from "npm:@supabase/supabase-js@2";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PEPPER = Deno.env.get("RECOVERY_PEPPER") ?? "";
const RESEND = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = Deno.env.get("MAIL_FROM") ?? "Cali Aircrew <no-reply@caliaircrew.com>";
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const GENERIC = { ok: true, message: "If that account has a confirmed backup email, we sent a code to it. It expires in 15 minutes." };

async function sha256(text: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function sixDigits() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
  return String(n).padStart(6, "0");
}
async function sendMail(to: string, subject: string, text: string) {
  if (!RESEND) throw new Error("Email sending isn't set up yet (RESEND_API_KEY).");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject, text }),
  });
  if (!r.ok) throw new Error("Email service error " + r.status);
}
async function recentCodes(userId: string, purpose: string) {
  const { count } = await admin.from("recovery_codes").select("id", { count: "exact", head: true })
    .eq("user_id", userId).eq("purpose", purpose).gte("created_at", new Date(Date.now() - 3600_000).toISOString());
  return count ?? 0;
}
async function issueCode(userId: string, purpose: string, sentTo: string) {
  const code = sixDigits();
  await admin.from("recovery_codes").update({ used: true }).eq("user_id", userId).eq("purpose", purpose).eq("used", false);
  const { error } = await admin.from("recovery_codes").insert({ user_id: userId, purpose, sent_to: sentTo, code_hash: await sha256(PEPPER + ":" + userId + ":" + code) });
  if (error) throw error;
  return code;
}
async function useCode(userId: string, purpose: string, code: string) {
  const { data: rows } = await admin.from("recovery_codes").select("*").eq("user_id", userId).eq("purpose", purpose)
    .eq("used", false).gte("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(1);
  const row = rows && rows[0];
  if (!row || row.attempts >= 5) return false;
  const ok = row.code_hash === (await sha256(PEPPER + ":" + userId + ":" + String(code).trim()));
  await admin.from("recovery_codes").update(ok ? { used: true } : { attempts: row.attempts + 1 }).eq("id", row.id);
  return ok;
}
async function signedInUser(req: Request) {
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt || jwt.startsWith("sb_")) return null;
  const { data } = await admin.auth.getUser(jwt);
  return data?.user ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply({ ok: false, message: "POST only" }, 405);
  let body: Record<string, string> = {};
  try { body = await req.json(); } catch { return reply({ ok: false, message: "Bad request" }, 400); }
  try {
    switch (body.action) {
      case "send_confirm": {
        const user = await signedInUser(req); if (!user) return reply({ ok: false, message: "Sign in first." }, 401);
        const { data: r } = await admin.from("account_recovery").select("backup_email, backup_confirmed").eq("user_id", user.id).maybeSingle();
        if (!r?.backup_email) return reply({ ok: false, message: "Save a backup email first." }, 400);
        if (r.backup_confirmed) return reply({ ok: true, message: "Your backup email is already confirmed." });
        if (await recentCodes(user.id, "confirm_backup") >= 3) return reply({ ok: false, message: "Too many codes requested. Try again in an hour." }, 429);
        const code = await issueCode(user.id, "confirm_backup", r.backup_email);
        await sendMail(r.backup_email, "Confirm your Cali Aircrew backup email",
          `Your code is ${code}\n\nEnter it on your Cali Aircrew Account page to confirm this as your backup email. It expires in 15 minutes.\n\nIf you didn't ask for this, you can ignore this email.`);
        return reply({ ok: true, message: `We sent a 6-digit code to ${r.backup_email}.` });
      }
      case "check_confirm": {
        const user = await signedInUser(req); if (!user) return reply({ ok: false, message: "Sign in first." }, 401);
        if (!(await useCode(user.id, "confirm_backup", body.code ?? ""))) return reply({ ok: false, message: "That code didn't match or has expired." }, 400);
        const { error } = await admin.from("account_recovery").update({ backup_confirmed: true }).eq("user_id", user.id);
        if (error) throw error;
        return reply({ ok: true, message: "Backup email confirmed." });
      }
      case "recover_start": {
        const email = String(body.email ?? "").trim().toLowerCase();
        if (!EMAIL_RE.test(email)) return reply({ ok: false, message: "Enter the email you used to sign in." }, 400);
        const { data: rows } = await admin.rpc("recovery_lookup", { p_email: email });
        const r = rows && rows[0];
        if (r && r.backup_confirmed && r.backup_email && (await recentCodes(r.user_id, "recover")) < 3) {
          const code = await issueCode(r.user_id, "recover", r.backup_email);
          await sendMail(r.backup_email, "Your Cali Aircrew recovery code",
            `Your recovery code is ${code}\n\nEnter it on caliaircrew.com to make this address your new sign-in email. It expires in 15 minutes.\n\nIf you didn't ask for this, ignore this email; nothing changes.`);
        }
        return reply(GENERIC);
      }
      case "recover_finish": {
        const email = String(body.email ?? "").trim().toLowerCase();
        const { data: rows } = await admin.rpc("recovery_lookup", { p_email: email });
        const r = rows && rows[0];
        if (!r || !r.backup_confirmed || !(await useCode(r.user_id, "recover", body.code ?? ""))) return reply({ ok: false, message: "That code didn't match or has expired." }, 400);
        const backup = r.backup_email;
        const { error } = await admin.auth.admin.updateUserById(r.user_id, { email: backup, email_confirm: true });
        if (error) throw error;
        await admin.from("account_recovery").update({ backup_email: "", backup_confirmed: false }).eq("user_id", r.user_id);
        await admin.from("admin_audit").insert({ admin_id: r.user_id, admin_email: backup, action: "self_recover", target_user: r.user_id, target_email: r.sign_in_email, detail: { new_email: backup } });
        try {
          await sendMail(r.sign_in_email, "Your Cali Aircrew sign-in email was changed",
            `The sign-in email for your Cali Aircrew account was changed to ${backup} using your backup email.\n\nIf this wasn't you, reply to this email or use "Can't get in? Ask Cali Aircrew" on caliaircrew.com right away.`);
        } catch (_) { /* the old inbox may be unreachable; that's often why people recover */ }
        return reply({ ok: true, message: `Done. Your sign-in email is now ${backup}. Sign in with it to continue.`, new_email: backup });
      }
      default:
        return reply({ ok: false, message: "Unknown action" }, 400);
    }
  } catch (e) {
    return reply({ ok: false, message: (e as Error).message || "Something went wrong" }, 500);
  }
});
