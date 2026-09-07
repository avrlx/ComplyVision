// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { authEnabled, databaseEnabled, getAuthProviders } from "./config";
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
