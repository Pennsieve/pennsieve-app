import { describe, it, expect, vi, afterEach } from "vitest";
import { canUpdateManifest, fetchRepository, repositoryUrl } from "./githubRepository";

describe("githubRepository", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("builds the repository URL", () => {
    expect(repositoryUrl("https://api2", { owner: "Pennsieve", repo: "a b" })).toBe("https://api2/repository/Pennsieve/a%20b");
    expect(repositoryUrl("https://api2", null)).toBe("");
  });

  it("lets the owner or someone who can push update app.yml", () => {
    expect(canUpdateManifest(true, null)).toBe(true);
    expect(canUpdateManifest(false, { viewerCanPush: true })).toBe(true);
    expect(canUpdateManifest(false, { viewer_can_push: true })).toBe(true);
    expect(canUpdateManifest(false, { viewer_can_push: false })).toBe(false);
    expect(canUpdateManifest(false, { viewerCanPush: false })).toBe(false);
    expect(canUpdateManifest(false, { description: "no field" })).toBe(false);
    expect(canUpdateManifest(false, null)).toBe(false);
  });

  it("reads the repository, and gives null when it can't", async () => {
    const token = async () => "t";
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ viewerCanPush: true }) })));
    expect(await fetchRepository("https://api2", { owner: "o", repo: "r" }, token)).toEqual({ viewerCanPush: true });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
    expect(await fetchRepository("https://api2", { owner: "o", repo: "r" }, token)).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    expect(await fetchRepository("https://api2", { owner: "o", repo: "r" }, token)).toBeNull();
  });
});
