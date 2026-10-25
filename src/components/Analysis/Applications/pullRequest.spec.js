import { describe, it, expect, vi } from "vitest";
import { pullRequestOutcome, openAppYmlPullRequest } from "./pullRequest";

describe("pullRequestOutcome", () => {
  it("maps each answer", () => {
    expect(pullRequestOutcome(201, { pullRequestUrl: "u", number: 7, branch: "b", created: true })).toEqual({
      kind: "opened", url: "u", number: 7, branch: "b",
    });
    expect(
      pullRequestOutcome(409, { code: "permissions_not_accepted", reviewUrl: "https://github.com/organizations/Pennsieve/settings/installations/1" })
    ).toEqual({ kind: "needsApproval", reviewUrl: "https://github.com/organizations/Pennsieve/settings/installations/1", organization: true });
    expect(pullRequestOutcome(409, { code: "permissions_not_accepted", reviewUrl: "https://github.com/settings/installations/2" }).organization).toBe(false);
    expect(pullRequestOutcome(403, { code: "no_push_access" }).kind).toBe("noPush");
    expect(pullRequestOutcome(401, { code: "github_not_linked" }).kind).toBe("notLinked");
    expect(pullRequestOutcome(404, {}).kind).toBe("unavailable");
    expect(pullRequestOutcome(502, { code: "github_error", message: "Validation Failed" })).toEqual({ kind: "error", message: "Validation Failed" });
  });

  it("posts the app.yml and reads the answer", async () => {
    const fetchImpl = vi.fn(async () => ({ status: 201, json: async () => ({ pullRequestUrl: "u", number: 3, branch: "b" }) }));
    const out = await openAppYmlPullRequest("https://api2", { owner: "o", repo: "r" }, "a: 1\n", "tok", fetchImpl);
    expect(out.kind).toBe("opened");
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api2/repository/o/r/app-yml");
    expect(JSON.parse(init.body)).toEqual({ content: "a: 1\n" });
    expect(init.headers.Authorization).toBe("Bearer tok");
  });

  it("never throws", async () => {
    const out = await openAppYmlPullRequest("https://api2", { owner: "o", repo: "r" }, "a: 1", "t", async () => {
      throw new Error("offline");
    });
    expect(out).toEqual({ kind: "error", message: "offline" });
  });
});
