// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { reportFixture } from "@/test/report-fixture";

const userId = "11111111-1111-4111-8111-111111111111";
const inspectionId = "22222222-2222-4222-8222-222222222222";
const mocks = vi.hoisted(() => ({ from: vi.fn(), insert: vi.fn(), single: vi.fn() }));

vi.mock("@/lib/auth/config", () => ({
  databaseEnabled: () => true,
  supabaseConfigured: () => true,
  testingMode: () => true,
  testingDatabaseConfigured: () => true,
  testingWorkspaceUserId: () => userId,
}));
vi.mock("@/lib/supabase/admin", () => ({ createTestingAdminClient: () => ({ from: mocks.from }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(() => { throw new Error("authenticated client must not be used"); }) }));

import { GET, POST } from "./route";

beforeEach(() => {
  mocks.from.mockReset(); mocks.insert.mockReset(); mocks.single.mockReset();
  mocks.from.mockReturnValue({ insert: mocks.insert });
  mocks.insert.mockReturnValue({ select: () => ({ single: mocks.single }) });
  mocks.single.mockResolvedValue({ data: { id: inspectionId }, error: null });
});

it("uses only the server-side testing client and fixed testing identity", async () => {
  const response = await POST(new Request("https://testing.example/api/inspections", {
    method: "POST",
    headers: { origin: "https://testing.example", "Content-Type": "application/json", "X-ComplyVision-User": userId },
    body: JSON.stringify({ id: inspectionId, report: reportFixture() }),
  }));
  expect(response.status).toBe(201);
  expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: userId }));
});

it("rejects callers that do not use the configured testing workspace", async () => {
  const response = await GET(new Request("https://testing.example/api/inspections", {
    headers: { "X-ComplyVision-User": inspectionId },
  }));
  expect(response.status).toBe(401);
  expect(mocks.from).not.toHaveBeenCalled();
});
