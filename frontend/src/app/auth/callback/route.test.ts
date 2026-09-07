// @vitest-environment node
import { expect, it, vi } from "vitest";
import { GET } from "./route";
const exchange = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/config", () => ({ authEnabled: () => true, supabaseConfigured: () => true }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { exchangeCodeForSession: exchange } }) }));
it("accepts a verified email session while rejecting external redirect destinations", async () => {
  exchange.mockResolvedValue({ data: { user: { is_anonymous: false, email_confirmed_at: "2026-09-07" } }, error: null });
  const result = await GET(new Request("http://localhost:3000/auth/callback?code=test-code&next=https://untrusted.example"));
  expect(exchange).toHaveBeenCalledWith("test-code");
  expect(result.headers.get("location")).toBe("http://localhost:3000/");
  expect(result.headers.get("cache-control")).toContain("no-store");
});
it("returns expired links to the login page with a visible error", async () => {
  exchange.mockResolvedValue({ data: { user: null }, error: new Error("expired") });
  const result = await GET(new Request("http://localhost:3000/auth/callback?code=expired"));
  expect(result.headers.get("location")).toBe("http://localhost:3000/login?error=verification_failed");
});
