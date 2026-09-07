import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { InspectorProfile } from "./inspector-profile";
const mocks = vi.hoisted(() => ({ update: vi.fn(), single: vi.fn(), maybeSingle: vi.fn(), getUser: vi.fn(), updateUser: vi.fn(), verifyOtp: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { getUser: mocks.getUser, updateUser: mocks.updateUser, verifyOtp: mocks.verifyOtp }, from: () => ({
  select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }),
  update: mocks.update,
}) }) }));
beforeEach(() => {
  mocks.updateUser.mockResolvedValue({ error: null });
  mocks.getUser.mockResolvedValue({ data: { user: { id: "owner", is_anonymous: false, email_confirmed_at: "2026-09-07", email: "owner@example.test" } }, error: null });
  mocks.maybeSingle.mockResolvedValue({ data: { full_name: "Inspector", role: "inspector" }, error: null });
  mocks.update.mockReturnValue({ eq: () => ({ select: () => ({ single: mocks.single }) }) });
  mocks.single.mockResolvedValue({ data: null, error: new Error("Profile update was denied") });
});
it("gates phone changes, preserves role and reports a denied profile update", async () => {
  const user = userEvent.setup();
  render(<InspectorProfile accountId="owner" phoneEnabled={false} />);
  await user.click(screen.getByRole("button", { name: "Open inspector profile" }));
  await screen.findByDisplayValue("Inspector");
  expect(screen.getByRole("button", { name: "Send phone OTP" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Save profile" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Profile update was denied");
  expect(mocks.update.mock.calls[0][0]).not.toHaveProperty("role");
  expect(mocks.updateUser).not.toHaveBeenCalled();
});
it("rejects saving under a switched account", async () => {
  const user = userEvent.setup();
  render(<InspectorProfile accountId="owner" phoneEnabled={false} />);
  await user.click(screen.getByRole("button", { name: "Open inspector profile" }));
  await screen.findByDisplayValue("Inspector");
  mocks.getUser.mockResolvedValue({ data: { user: { id: "other", email_confirmed_at: "2026-09-07", is_anonymous: false } }, error: null });
  await user.click(screen.getByRole("button", { name: "Save profile" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("session changed");
  expect(mocks.update).not.toHaveBeenCalled();
});

it("verifies a linked phone using the authenticated phone-change flow", async () => {
  const user = userEvent.setup();
  mocks.verifyOtp.mockResolvedValue({ error: null, data: { user: { id: "owner", phone: "919876543210", phone_confirmed_at: "2026-09-07" } } });
  render(<InspectorProfile accountId="owner" phoneEnabled />);
  await user.click(screen.getByRole("button", { name: "Open inspector profile" }));
  await screen.findByDisplayValue("Inspector");
  await user.type(screen.getByLabelText("Profile phone number"), "+919876543210");
  await user.click(screen.getByRole("button", { name: "Send phone OTP" }));
  await user.type(screen.getByLabelText("Phone verification code"), "123456");
  await user.click(screen.getByRole("button", { name: "Verify phone" }));
  expect(mocks.verifyOtp).toHaveBeenCalledWith({ phone: "+919876543210", token: "123456", type: "phone_change" });
  expect(await screen.findByText("Phone number verified. You can now use phone OTP login for this account.")).toBeInTheDocument();
});
