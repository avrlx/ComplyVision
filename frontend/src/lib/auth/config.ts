/** Security-sensitive deployment switches are server-only. */
export function appEnvironment() {
  return process.env.COMPLYVISION_APP_ENV;
}
export function testingMode() {
  return appEnvironment() === "testing";
}
export function authEnabled() {
  if (appEnvironment() === "production") return true;
  if (testingMode()) return false;
  return process.env.COMPLYVISION_AUTH_ENABLED === "true";
}
export function databaseEnabled() {
  return process.env.COMPLYVISION_DATABASE_ENABLED === "true" && (authEnabled() || testingMode());
}
export function supabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
export function testingDatabaseConfigured() {
  return Boolean(
    testingMode() &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    testingWorkspaceUserId(),
  );
}
export function testingWorkspaceUserId() {
  const value = process.env.COMPLYVISION_TEST_USER_ID;
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : undefined;
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
    return { email: settings.external?.email === true, phone: process.env.COMPLYVISION_PHONE_AUTH_ENABLED === "true" && settings.external?.phone === true,
      signup: settings.disable_signup === false, unavailable: false };
  } catch { return unavailable; }
}
