// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { GET, POST } from "./route";
import { reportFixture } from "@/test/report-fixture";
const mocks = vi.hoisted(() => ({ user: vi.fn(), from: vi.fn(), insert: vi.fn(), single: vi.fn(), enabled: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ databaseEnabled: mocks.enabled, supabaseConfigured: () => true }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: mocks.user }, from: mocks.from }) }));
const userId = "11111111-1111-4111-8111-111111111111";
const id = "22222222-2222-4222-8222-222222222222";
beforeEach(() => {
  mocks.enabled.mockReturnValue(true);
  mocks.user.mockResolvedValue({ data: { user: { id: userId, is_anonymous: false, email_confirmed_at: "2026-09-07" } }, error: null });
  mocks.from.mockReturnValue({ insert: mocks.insert });
  mocks.insert.mockReturnValue({ select: () => ({ single: mocks.single }) });
  mocks.single.mockResolvedValue({ data: { id }, error: null });
});
const request = (body: unknown, origin = "http://localhost:3000", expectedUser = userId) => new Request("http://localhost:3000/api/inspections", {
  method: "POST", headers: { origin, "Content-Type": "application/json", "X-ComplyVision-User": expectedUser }, body: JSON.stringify(body),
});
it("derives ownership and outcome from the verified user and canonical report", async () => {
  const response = await POST(request({ id, user_id: "attacker", status: "PASS", report: reportFixture() }));
  expect(response.status).toBe(201);
  expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: userId, status: "REVIEW" }));
});
it("rejects cross-origin writes and switched or anonymous accounts", async () => {
  expect((await POST(request({}, "https://elsewhere.example"))).status).toBe(403);
  expect((await POST(request({}, undefined, id))).status).toBe(401);
  mocks.user.mockResolvedValue({ data: { user: { id: userId, is_anonymous: true, email_confirmed_at: "2026-09-07" } }, error: null });
  expect((await POST(request({ id, report: reportFixture() }))).status).toBe(401);
  expect(mocks.from).not.toHaveBeenCalled();
});
it("fails closed before database setup and reports write failure honestly", async () => {
  mocks.enabled.mockReturnValue(false);
  expect((await GET(new Request("http://localhost:3000/api/inspections"))).status).toBe(503);
  mocks.enabled.mockReturnValue(true);
  mocks.single.mockResolvedValue({ data: null, error: { code: "42501" } });
  const response = await POST(request({ id, report: reportFixture() }));
  expect(response.status).toBe(503);
  expect((await response.json()).error).toContain("Report not saved");
});
