import { describe, it, expect, vi } from "vitest";
import { isVersionTag, latestVersion, nextVersions, tagProblem, releaseOutcome, publishRelease, fetchReleaseStatus, releaseNudge } from "./release";

describe("releases", () => {
  it("take version tags only", () => {
    expect(isVersionTag("v1.2.3")).toBe(true);
    expect(isVersionTag("1.2.3")).toBe(true);
    expect(isVersionTag("v1.2.3-rc.1")).toBe(true);
    expect(isVersionTag("latest")).toBe(false);
    expect(isVersionTag("v1.2")).toBe(false);
  });

  it("find the latest version by number, not by text", () => {
    expect(latestVersion(["v1.2.9", "v1.10.0", "v1.3.0", "notes"])).toBe("v1.10.0");
    expect(latestVersion(["v2.0.0-rc.1", "v1.9.0"])).toBe("v2.0.0-rc.1");
    expect(latestVersion(["v2.0.0-rc.1", "v2.0.0"])).toBe("v2.0.0");
    expect(latestVersion([])).toBe("");
  });

  it("suggest the next patch, minor and major, keeping the v", () => {
    expect(nextVersions("v1.3.6")).toEqual({ patch: "v1.3.7", minor: "v1.4.0", major: "v2.0.0" });
    expect(nextVersions("0.4.1")).toEqual({ patch: "0.4.2", minor: "0.5.0", major: "1.0.0" });
    expect(nextVersions("v1.2.0-rc.1").patch).toBe("v1.2.0");
    // A first release: an early version or a first stable one.
    expect(nextVersions("")).toEqual({ patch: "v0.0.1", minor: "v0.1.0", major: "v1.0.0" });
  });

  it("refuse a tag that's taken, not a version, or not newer", () => {
    const known = ["v1.3.6", "1.3.5"];
    expect(tagProblem("v1.3.7", known, "v1.3.6")).toBe("");
    expect(tagProblem("v1.3.6", known, "v1.3.6")).toMatch(/already released/);
    expect(tagProblem("v1.3.5", known, "v1.3.6")).toMatch(/already released/);
    expect(tagProblem("v1.2.0", known, "v1.3.6")).toMatch(/isn't newer/);
    expect(tagProblem("next", known, "v1.3.6")).toMatch(/like v1.2.3/);
    expect(tagProblem("", known, "v1.3.6")).toMatch(/Enter a version/);
    expect(tagProblem("v1.0.0", [], "")).toBe("");
  });

  it("map the service's answers", () => {
    expect(releaseOutcome(201, { releaseUrl: "u", tag: "v1", target: "main" })).toEqual({ kind: "released", url: "u", tag: "v1", target: "main" });
    expect(releaseOutcome(409, { code: "tag_exists", message: "m" }).kind).toBe("tagExists");
    expect(releaseOutcome(409, { code: "permissions_not_accepted", reviewUrl: "r" })).toEqual({ kind: "needsApproval", reviewUrl: "r" });
    expect(releaseOutcome(422, { code: "invalid_app_yml", message: "bad" })).toEqual({ kind: "invalid", message: "bad" });
    expect(releaseOutcome(403, { code: "no_push_access" }).kind).toBe("noPush");
    expect(releaseOutcome(401, { code: "github_not_linked" }).kind).toBe("notLinked");
    expect(releaseOutcome(404, {}).kind).toBe("unavailable");
    expect(releaseOutcome(502, { code: "github_error", message: "Repository rule violations found" })).toEqual({ kind: "error", message: "Repository rule violations found" });
  });

  it("post the tag, and target and notes only when given", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ status: 201, json: async () => ({ releaseUrl: "u", tag: "v1.0.1", target: "main" }) });
    const out = await publishRelease("https://api2", { owner: "o", repo: "r" }, { tag: " v1.0.1 ", notes: "  " }, "tok", fetchImpl);
    expect(out.kind).toBe("released");
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api2/repository/o/r/release");
    expect(JSON.parse(init.body)).toEqual({ tag: "v1.0.1" });
    expect(init.headers.Authorization).toBe("Bearer tok");
  });

  it("nudge when the branch has commits since the latest release", () => {
    expect(releaseNudge({ latestTag: "v1.3.6", commitsSince: 3, canRelease: true })).toBe("3 new commits since v1.3.6");
    expect(releaseNudge({ latestTag: "v1.3.6", commitsSince: 1, canRelease: true })).toBe("1 new commit since v1.3.6");
    expect(releaseNudge({ latestTag: "v1.3.6", commitsSince: 0, canRelease: false })).toBe("");
    expect(releaseNudge({ latestTag: "", commitsSince: 0, canRelease: true })).toBe("");
    expect(releaseOutcome(409, { code: "nothing_to_release" }).kind).toBe("nothingNew");
  });

  it("read the release status, or nothing when it can't be told", async () => {
    const ok = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ latestTag: "v1", commitsSince: 0, canRelease: false }) });
    expect((await fetchReleaseStatus("https://api2", { owner: "o", repo: "r" }, "t", ok)).canRelease).toBe(false);
    expect(ok.mock.calls[0][0]).toBe("https://api2/repository/o/r/release");
    const missing = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
    expect(await fetchReleaseStatus("https://api2", { owner: "o", repo: "r" }, "t", missing)).toBeNull();
  });
});
