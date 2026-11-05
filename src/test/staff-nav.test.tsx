import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StaffNav } from "@/components/layout/StaffNav";

const mocks = vi.hoisted(() => ({
  cancelQueries: vi.fn(), clear: vi.fn(), signOut: vi.fn(), navigate: vi.fn(), error: vi.fn(),
  profile: { full_name: "Demo Staff", username: "staff", status: "active", is_deleted: false, must_change_password: false, last_login_at: null as string | null },
  roles: ["staff"],
}));

vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ cancelQueries: mocks.cancelQueries, clear: mocks.clear }) }));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
  Link: ({ to, children, activeOptions: _options, activeProps: _props, inactiveProps: _inactive, ...props }: { to: string; children: React.ReactNode; activeOptions?: unknown; activeProps?: unknown; inactiveProps?: unknown }) => <a href={to} {...props}>{children}</a>,
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { signOut: mocks.signOut } } }));
vi.mock("@/lib/staff", () => ({ useMyProfile: () => ({ data: mocks.profile }), useMyRoles: () => ({ data: mocks.roles }) }));
vi.mock("sonner", () => ({ toast: { error: mocks.error } }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.roles = ["staff"];
  mocks.profile = { full_name: "Demo Staff", username: "staff", status: "active", is_deleted: false, must_change_password: false, last_login_at: null };
  mocks.cancelQueries.mockResolvedValue(undefined);
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.navigate.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("dashboard session actions", () => {
  it("cancels queries, clears protected data, terminates the session, then replaces history with /auth", async () => {
    const actions: string[] = [];
    mocks.cancelQueries.mockImplementation(async () => { actions.push("cancel"); });
    mocks.clear.mockImplementation(() => { actions.push("clear"); });
    mocks.signOut.mockImplementation(async () => { actions.push("signOut"); return { error: null }; });
    mocks.navigate.mockImplementation(async () => { actions.push("redirect"); });
    render(<StaffNav />);
    const button = screen.getAllByRole("button", { name: "Sign out" }).at(-1);
    if (!button) throw new Error("Sign-out action missing");
    fireEvent.click(button);
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: "/auth", replace: true }));
    expect(actions).toEqual(["cancel", "clear", "signOut", "redirect"]);
  });

  it("does not claim sign-out succeeded or redirect if terminating the session fails", async () => {
    mocks.signOut.mockResolvedValue({ error: new Error("Failed") });
    render(<StaffNav />);
    const button = screen.getAllByRole("button", { name: "Sign out" }).at(-1);
    if (!button) throw new Error("Sign-out action missing");
    fireEvent.click(button);
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("keeps the temporary-password gate for staff", async () => {
    mocks.profile.must_change_password = true;
    render(<StaffNav />);
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: "/change-password" }));
  });

  it("does not force an administrator into the temporary-password gate", () => {
    mocks.profile.must_change_password = true;
    mocks.roles = ["admin"];
    render(<StaffNav />);
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});