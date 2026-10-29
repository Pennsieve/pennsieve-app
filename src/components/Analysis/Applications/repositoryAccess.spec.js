import { describe, it, expect } from "vitest";
import { accessOutcome, hasAccess, manualAccessUrl, requestRepositoryAccess } from "./repositoryAccess";

const installation = { id: 7, name: "lab", config_url: "https://github.com/organizations/lab/settings/installations/7" };

describe("accessOutcome", () => {
  it("reads github-service's statuses", () => {
    expect(accessOutcome(200, { status: "accessible", installation }).kind).toBe("accessible");
    expect(accessOutcome(200, { status: "added", installation, repository: { full_name: "lab/r" } })).toMatchObject({ kind: "added", repository: { full_name: "lab/r" } });
    expect(accessOutcome(404, { status: "no_installation", owner: "lab" })).toEqual({ kind: "noInstallation", owner: "lab", installation: null });
    expect(accessOutcome(404, { status: "not_visible", installation })).toMatchObject({ kind: "notVisible", installation });
    expect(accessOutcome(403, { status: "not_admin", installation })).toMatchObject({ kind: "notAdmin", installation });
  });
  it("tells an unlinked account from a missing route, and reports the rest", () => {
    expect(accessOutcome(404, { message: "GitHub profile not found for user 3" }).kind).toBe("notLinked");
    expect(accessOutcome(404, {}).kind).toBe("unavailable");
    expect(accessOutcome(500, { message: "boom" })).toEqual({ kind: "error", message: "boom" });
    expect(accessOutcome(502).message).toMatch(/502/);
  });
  it("knows which outcomes mean access", () => {
    expect(hasAccess({ kind: "accessible" })).toBe(true);
    expect(hasAccess({ kind: "added" })).toBe(true);
    expect(hasAccess({ kind: "notVisible" })).toBe(false);
    expect(hasAccess(null)).toBe(false);
  });
});

describe("manualAccessUrl", () => {
  it("links to the installation's settings when known, else the app's install page", () => {
    expect(manualAccessUrl({ kind: "notVisible", installation }, "https://github.com/apps/pennsieve")).toBe(installation.config_url);
    expect(manualAccessUrl({ kind: "noInstallation" }, "https://github.com/apps/pennsieve/")).toBe("https://github.com/apps/pennsieve/installations/new");
  });
});

describe("requestRepositoryAccess", () => {
  it("posts to the repository's access route with the token and never throws", async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url, init });
      return { status: 200, json: async () => ({ status: "added", installation }) };
    };
    const outcome = await requestRepositoryAccess("https://api2", { owner: "lab", repo: "my repo" }, "tok", fetchImpl);
    expect(outcome.kind).toBe("added");
    expect(calls[0].url).toBe("https://api2/repository/lab/my%20repo/access");
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.headers.Authorization).toBe("Bearer tok");

    const failed = await requestRepositoryAccess("https://api2", { owner: "lab", repo: "r" }, "tok", async () => {
      throw new Error("offline");
    });
    expect(failed).toEqual({ kind: "error", message: "offline" });
  });
});
