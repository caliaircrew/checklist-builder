# Self-service account recovery — one-time setup

What it does: members confirm a **backup email** on their Account page; if they're ever locked out of their sign-in
email, "Locked out of your email? Use your backup email" (sign-in box) emails a code to the confirmed backup and makes
it their new sign-in email. The old address gets a notice. Microsoft Authenticator, if on, is still required to sign in.

Pieces: `supabase/012_recovery_codes.sql` (database), `supabase/functions/recovery/index.ts` (server-side function),
and Resend (sends the code emails from caliaircrew.com). Until all three are set up, the site shows
"Self-service recovery isn't switched on yet" and offers "Can't get in? Ask Cali Aircrew".

## 1. Resend (sends the emails) — about 10 minutes
1. Go to **resend.com** → Sign up (use caliaircrew@gmail.com).
2. **Domains → Add Domain** → `caliaircrew.com` → region **North Virginia (us-east-1)** → Add.
3. Resend shows 3–4 DNS records (a **TXT** for `resend._domainkey`, an **MX** and a **TXT** for `send`, optional DMARC).
   In **GoDaddy → caliaircrew.com → DNS → Add New Record**, add each one exactly (Type, Name, Value, MX priority 10).
   These are on the `send` and `resend._domainkey` names only; they do not touch the existing email records.
4. Back in Resend, tap **Verify DNS Records** (can take a few minutes to an hour).
5. **API Keys → Create API Key** → name `cali-aircrew-recovery`, permission **Sending access**, domain `caliaircrew.com` →
   copy the key (starts with `re_`). You only see it once.

## 2. Supabase
1. **SQL Editor** → run `supabase/012_recovery_codes.sql` (ends with `recovery_codes | true`).
2. **Edge Functions → Deploy a new function → Via Editor** → name it exactly `recovery` →
   replace the sample code with `supabase/functions/recovery/index.ts` → **Deploy**.
3. Open the `recovery` function → **Details / Settings** → turn **OFF** "Enforce JWT Verification" (Verify JWT) → Save.
   (The site uses Supabase's new publishable key, which isn't a JWT; the function checks signed-in users itself.)
4. **Edge Functions → Secrets → Add new secret**, three of them:
   - `RESEND_API_KEY` = the `re_…` key from Resend
   - `MAIL_FROM` = `Cali Aircrew <no-reply@caliaircrew.com>`
   - `RECOVERY_PEPPER` = any long random text (at least 32 characters)

## 3. Test
1. Account page → add a backup email you can read → Save → **Confirm backup email** → enter the code.
2. Sign out → Sign in → **Locked out of your email? Use your backup email** → enter your sign-in email → enter the code
   from the backup inbox → sign in with the backup address. (Afterwards, change it back on the Account page if you like.)

## Safety notes
- Codes: 6 digits, stored hashed, 15-minute expiry, 5 tries, 3 codes per hour per account.
- "Recover" answers the same way whether or not an account exists, so it can't be used to discover members.
- The service key stays inside Supabase; it is never in the website.
- Every recovery is recorded in the admin audit log ("self_recover").
