# ComplyVision authentication, saved history, and PDF export

PDF export works immediately, including in the session workspace. Auth and database code are installed but default to disabled until provisioned. Neither switch changes OCR, extraction, measurements, rule decisions, or the canonical report.

## 1. Supabase credentials and email sign-in

In `frontend/.env.local` (or the hosting environment), set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from your Supabase project's API settings. Use the publishable key, never a secret or service-role key. Configure `NEXT_PUBLIC_SITE_URL` for your deployment.

In Supabase Authentication:

1. Enable Email. Configure production SMTP and the desired signup policy.
2. For numeric codes, optionally configure the **Magic Link** and **Confirm signup** email templates to display `{{ .Token }}`. The UI accepts either the default email sign-in link or a numeric OTP. Templates containing `{{ .ConfirmationURL }}` can remain unchanged when using links.
3. Set the Site URL to your frontend origin (`http://localhost:3000` locally) and allow `http://localhost:3000/auth/callback` in Authentication → URL Configuration → Redirect URLs. Add the equivalent callback for each deployed origin. Configure OTP expiry, rate limits, and your email/SMS delivery limits. The UI adds a 60-second resend cooldown; Supabase must enforce abuse limits independently.
4. Disable anonymous sign-ins unless another application on the same project needs them. This app rejects anonymous users even if that Supabase feature is enabled.
5. Set `COMPLYVISION_AUTH_ENABLED=true`, rebuild/restart the frontend, and validate sign-in with a real test account. Auth failures deny workspace access. With the flag false, the app explicitly remains a session workspace.

Sign-in uses an existing account by default. Select **Create a new account** to request registration when signup is permitted. OTP success requires a real Supabase session with a confirmed email or phone. There are no demo codes.

## 2. Phone OTP (not configured yet)

1. In Authentication → Sign In / Providers → Phone, configure an SMS provider supported by Supabase (for example Twilio), including its sender and delivery requirements for your intended countries. Enter provider credentials only in Supabase's secure dashboard.
2. When phone support is intentionally activated in the future, set `COMPLYVISION_PHONE_AUTH_ENABLED=true` and enable the Phone provider. Set the SMS template to include the OTP token, and configure expiry/rate limits. Complete any sender registration required by the provider.
3. Reload `/login`. The phone deployment switch defaults to false, keeping the phone section disabled. The page reads Supabase's public auth settings. Phone OTP stays disabled when the provider is off or its settings cannot be checked.
4. Using your own test phone, request a code with an international number (e.g. `+91…`), verify it, sign out, and sign back in. Test an expired/wrong code and resend limits. Actual SMS delivery has **not** been tested in this change; toggling the provider alone does not prove delivery works.

See [Supabase phone login](https://supabase.com/docs/guides/auth/phone-login) and [email OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless).

## 3. Database migrations and access checks

Keep `COMPLYVISION_DATABASE_ENABLED=false` while provisioning. For SQL Editor setup, run the complete `supabase/setup.sql` file; it installs the schema and permissions in one transaction and supports rerunning. Alternatively, apply the SQL files in `supabase/migrations/` in order using your migration workflow. If 001–004 have already been applied, apply 005 and 006. If 005 is already applied, apply only 006. Apply each migration once and keep the numbered order. The initial schema also uses restricted grants; 005 hardens deployments that previously used an earlier draft.

The schema stores an immutable canonical report and its status under the authenticated user's ID. Profiles are created/backfilled automatically. Full-name and optional profile fields have column-level update grants; role, ID, and timestamps cannot be changed by clients. There is no administrative role editor. Reports have select/insert access only, RLS ownership checks, and an additional restriction against anonymous Auth sessions. `NOT_APPLICABLE` is supported.

Local tests execute all migrations in real PostgreSQL (PGlite) with two authenticated roles/identities and anonymous access. **Hosted migrations and hosted RLS have not been verified.** Before enabling persistence, use two real test accounts and the publishable key plus each user's access token to confirm:

- Each account can insert/read its own report and profile.
- The other account cannot read that report, insert with its owner's ID, or change its profile.
- Anonymous requests cannot read/insert records.
- Updating a profile role, editing/deleting a saved report, and indexing a REVIEW report as PASS are rejected.

Then set `COMPLYVISION_DATABASE_ENABLED=true`, restart, analyze a sample, confirm there is no “not yet saved” indicator, reload and reopen the report. Sign out and verify that another account cannot see it. Never use a service-role key to test RLS; it bypasses RLS.

The workspace fetches history from the database in batches of 20 until all pages are loaded, so dashboard totals include older inspections. Loading and database errors are shown before rendering dashboard counts. Failures keep the analysis in memory with a visible error and retry; retry uses the same ID and never overwrites the original record. Export before leaving if a report is unsaved. Records are user-owned decision-support data, not signed certificates or tamper-proof evidence of backend execution. JSON export retains the canonical content.

## 4. PDF export and deployment boundaries

**Export PDF** is available in both the detailed report and report archive. It includes exact outcomes, declarations, all rule reasons/evidence, processing notes, measurements, OCR, and embedded image evidence. Long content paginates; images retain aspect ratio. The bundled DejaVu font includes its license. Unsupported glyphs are represented as Unicode code points; JSON retains the original text.

The existing FastAPI `/health` and `/analyze` remain unchanged. Authentication protects the frontend workspace and personal database access; it does not add authentication or rate limits to the stateless FastAPI service. Configure backend network access/rate limits as appropriate for deployment. No SQL migration is run automatically by the frontend.

## Verification

From `frontend`: `npm test`, `npm run lint`, and `npm run build`.

Relevant tests cover real SQL ownership/privileges, provider gating, SMS verification, refreshed cookies on redirects, authenticated save authorization, save failure/retry/reload, and multi-page PDF output. Actual provider delivery and hosted RLS require the setup checks above.


## PR #5 account and source-preview follow-up

Signed-in users can open **Inspector account** from the workspace. With database access enabled, **Inspector Profile** edits professional details and shows the administrator-controlled role. A profile update must return the owned row before the UI claims success. Account changes cannot save to a different identity. Phone changes require an enabled provider and real `phone_change` OTP verification; email remains read-only in this interface.

Inspections retain the original filename and an optional JPEG preview, downscaled to at most 900 pixels on the longest side and bounded to 2 MB. Reopened reports show **Uploaded package preview**. Preview generation is best-effort; the original analysis, canonical report, and evidence are not resized or altered. Migration 006 bounds preview data at the database layer as well. The preview is private under the existing report RLS policies.

The auth callback supports PKCE links with destinations restricted to the workspace or account page. Numeric OTP remains the primary login flow.


## Current local configuration

The supplied project URL and publishable key are in ignored `frontend/.env.local`. Local email authentication is enabled. Supabase's public settings returned HTTP 200 and confirmed email enabled, phone disabled. Phone remains explicitly disabled in the app even if the provider later changes. Restart the frontend after changing environment settings.

The database code is installed, but the publishable key cannot run administrative SQL. Run `supabase/setup.sql` in this project's SQL Editor and verify private access with test accounts, then set `COMPLYVISION_DATABASE_ENABLED=true` locally and restart. Until then, signed-in users can analyze images and export reports with session history. Actual email delivery still requires signing in with your own email; no email or SMS was sent during automated verification.
