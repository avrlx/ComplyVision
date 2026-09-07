/** Deployment switches are server-only; opt in after completing docs/AUTH_DATABASE_SETUP.md. */
export function authEnabled() {
  return process.env.COMPLYVISION_AUTH_ENABLED === "true";
}
export function databaseEnabled() {
  return authEnabled() && process.env.COMPLYVISION_DATABASE_ENABLED === "true";
}
export function supabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
export interface AuthProviders { email: boolean; phone: boolean; signup: boolean; unavailable: boolean }
export async function getAuthProviders(): Promise<AuthProviders> {
  const unavailable = { email: false, phone: false, signup: false, unavailable: true };
  if (!supabaseConfigured()) return unavailable;
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "")}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! },
      cache: "no-store", signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return unavailable;
    const settings = await response.json();
    return { email: settings.external?.email === true, phone: settings.external?.phone === true,
      signup: settings.disable_signup === false, unavailable: false };
  } catch { return unavailable; }
}
