// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { authEnabled, databaseEnabled, getAuthProviders, testingDatabaseConfigured, testingMode } from "./config";
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it("requires explicit deployment activation and fails closed on provider lookup failure", async () => {
  vi.stubEnv("COMPLYVISION_AUTH_ENABLED", "false"); vi.stubEnv("COMPLYVISION_DATABASE_ENABLED", "true");
  expect(authEnabled()).toBe(false); expect(databaseEnabled()).toBe(false);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.example");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-test-key");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ external: { phone: false, email: true }, disable_signup: false }))));
  expect(await getAuthProviders()).toEqual({ email: true, phone: false, signup: true, unavailable: false });
  vi.mocked(fetch).mockRejectedValue(new Error("Offline"));
  expect(await getAuthProviders()).toEqual({ email: false, phone: false, signup: false, unavailable: true });
});
it("allows the auth bypass only in an explicit server-side testing environment", () => {
  vi.stubEnv("COMPLYVISION_APP_ENV", "production"); vi.stubEnv("COMPLYVISION_AUTH_ENABLED", "false");
  expect(authEnabled()).toBe(true); expect(testingMode()).toBe(false);
  vi.stubEnv("COMPLYVISION_APP_ENV", "testing"); vi.stubEnv("COMPLYVISION_AUTH_ENABLED", "true"); vi.stubEnv("COMPLYVISION_DATABASE_ENABLED", "true");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://testing.example"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "server-secret");
  vi.stubEnv("COMPLYVISION_TEST_USER_ID", "11111111-1111-4111-8111-111111111111");
  expect(authEnabled()).toBe(false); expect(databaseEnabled()).toBe(true); expect(testingDatabaseConfigured()).toBe(true);
});
it("keeps phone disabled by deployment choice even when Supabase enables it", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.example");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-test-key");
  vi.stubEnv("COMPLYVISION_PHONE_AUTH_ENABLED", "false");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ external: { email: true, phone: true }, disable_signup: false }))));
  expect((await getAuthProviders()).phone).toBe(false);
});
