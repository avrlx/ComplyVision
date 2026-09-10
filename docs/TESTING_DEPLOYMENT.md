# Isolated ComplyVision testing deployment

This setup applies only to the `complyvision-testing` branch. The requested name `complyVision testing` is not a valid Git branch name because Git forbids spaces in refs. Do not merge these changes into `main`.

## Supabase testing project

1. Create a new Supabase project owned by the tester. Never reuse either production project URL or keys.
2. In its SQL Editor, run `supabase/setup.sql` from this branch. This creates only the required schema, triggers, grants, and RLS policies; it copies no data.
3. In Authentication > Users, create one dedicated, non-anonymous testing user. Copy its UUID as `COMPLYVISION_TEST_USER_ID`. Do not use a production user UUID.
4. Keep the testing project's service-role key only in the testing Vercel project's encrypted environment variables. It is used by the server-side testing route because the UI login is bypassed. Never prefix it with `NEXT_PUBLIC_`.
5. Enable Vercel Deployment Protection. Without it, anyone who can reach the testing frontend shares access to the dedicated testing workspace data.

## Testing Render service

Create a new Blueprint from this repository and select `render.yaml`. It creates only `complyvision-testing-api` from branch `complyvision-testing`.

Set `SIH_FRONTEND_ORIGINS` to the exact testing Vercel origin, for example `https://complyvision-testing.example.com`. Do not include the production Vercel origin. The backend is stateless and does not access Supabase, so no Supabase keys belong on Render.

Build command: `pip install --upgrade pip && pip install -r requirements.txt`

Start command: `uvicorn api.main:app --host 0.0.0.0 --port $PORT`

Health path: `/health`

## Testing Vercel project

Import the same Git repository as a new Vercel project with these settings:

- Project name: `complyvision-testing`
- Production branch: `complyvision-testing`
- Root directory: `frontend`
- Framework preset: Next.js
- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: leave the Next.js default
- Automatic Git deployments: enabled
- Deployment Protection: enabled

Set these variables only in this testing Vercel project:

```env
COMPLYVISION_APP_ENV=testing
COMPLYVISION_AUTH_ENABLED=false
COMPLYVISION_DATABASE_ENABLED=true
COMPLYVISION_PHONE_AUTH_ENABLED=false
COMPLYVISION_TEST_USER_ID=<dedicated-testing-auth-user-uuid>

NEXT_PUBLIC_API_BASE_URL=https://<testing-render-service>.onrender.com
NEXT_PUBLIC_SITE_URL=https://<testing-vercel-domain>
NEXT_PUBLIC_SUPABASE_URL=https://<testing-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<testing-publishable-or-anon-key>

SUPABASE_SERVICE_ROLE_KEY=<testing-service-role-key>
```

Do not use the prompt's `NEXT_PUBLIC_AUTH_ENABLED` for access control. Any `NEXT_PUBLIC_` value is bundled for the browser. `COMPLYVISION_APP_ENV` and `COMPLYVISION_AUTH_ENABLED` are server-side controls, and production mode forces authentication on even if the latter is accidentally false.

After the first Render deployment provides its URL, set `NEXT_PUBLIC_API_BASE_URL` in Vercel. After the Vercel domain is known, set `SIH_FRONTEND_ORIGINS` in Render. Redeploy both services after changing environment variables.

## Production boundary

Do not change the existing production Vercel project, Render service, Supabase project, or their variables. The `main` branch has no testing deployment changes. Confirm the production Vercel project still tracks `main` and that its existing frontend API URL points to the existing production Render service.

Before accepting the test deployment, compare project refs/hosts rather than secret values:

- Testing Vercel `NEXT_PUBLIC_SUPABASE_URL` host differs from production.
- Testing Vercel `NEXT_PUBLIC_API_BASE_URL` host is the new testing Render service.
- Render `SIH_FRONTEND_ORIGINS` contains only the testing frontend origin.
- No `SUPABASE_SERVICE_ROLE_KEY` is present in Render, source control, or any `NEXT_PUBLIC_` variable.
