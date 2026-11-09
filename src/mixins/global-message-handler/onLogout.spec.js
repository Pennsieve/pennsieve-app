import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const signOut = vi.fn();
vi.mock("aws-amplify/auth", () => ({ signOut: (...a) => signOut(...a) }));
vi.mock("@/router", () => ({ default: {} }));
vi.mock("@/composables/useSwitchWorkspace", () => ({ useSwitchWorkspace: () => {} }));
vi.mock("@/composables/useGetToken", () => ({ useGetToken: () => Promise.resolve("") }));

const { default: handler } = await import("./index.js");
const siteConfig = await import("@/site-config/site.json");

describe("logout", () => {
  let replace;
  beforeEach(() => {
    signOut.mockReset();
    replace = vi.fn();
    vi.stubGlobal("location", { replace, href: "" });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("signs out, then goes to Discover, from the profile menu's Sign out", async () => {
    signOut.mockResolvedValue();
    await handler.methods.onLogout.call({}, { toDiscover: true });
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(siteConfig.discoverAppUrl);
  });

  it("still goes to Discover when signing out fails", async () => {
    signOut.mockRejectedValue(new Error("network"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await handler.methods.onLogout.call({}, { toDiscover: true });
    expect(replace).toHaveBeenCalledWith(siteConfig.discoverAppUrl);
  });
});
