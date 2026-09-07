// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";
import { proxy } from "./proxy";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), enabled: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ authEnabled: mocks.enabled, supabaseConfigured: () => true }));
vi.mock("@supabase/ssr", () => ({ createServerClient: (_url: string, _key: string, options: { cookies: { setAll: (values: unknown[]) => void } }) => ({ auth: { getUser: async () => {
  options.cookies.setAll([{ name: "refreshed", value: "session", options: { path: "/", httpOnly: true } }]);
  return mocks.getUser();
} } }) }));
beforeEach(() => { mocks.enabled.mockReturnValue(true); mocks.getUser.mockResolvedValue({ data: { user: null }, error: null }); });
it("redirects unauthenticated users and preserves refreshed cookies on redirects", async () => {
  const response = await proxy(new NextRequest("http://localhost:3000/"));
  expect(response.headers.get("location")).toBe("http://localhost:3000/login");
  expect(response.cookies.get("refreshed")?.value).toBe("session");
  expect(response.headers.get("Cache-Control")).toContain("no-store");
});
it("keeps the session workspace accessible when auth is deliberately disabled", async () => {
  mocks.enabled.mockReturnValue(false);
  const response = await proxy(new NextRequest("http://localhost:3000/"));
  expect(response.status).toBe(200); expect(mocks.getUser).not.toHaveBeenCalled();
});
