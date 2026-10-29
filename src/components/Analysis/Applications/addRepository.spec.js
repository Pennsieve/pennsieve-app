import { describe, it, expect } from "vitest";
import {
  STEPS,
  accessPayload,
  destinationsOf,
  firstToDo,
  loadDraft,
  newDraft,
  nextStep,
  parseRepoInput,
  pickerRepos,
  prevStep,
  saveDraft,
  sharingSummary,
  stepsFor,
} from "./addRepository";

describe("parseRepoInput", () => {
  it("reads owner/repo out of what people paste", () => {
    const want = { owner: "pennsieve-apps", repo: "spike-sorter" };
    expect(parseRepoInput("pennsieve-apps/spike-sorter")).toEqual(want);
    expect(parseRepoInput("https://github.com/pennsieve-apps/spike-sorter")).toEqual(want);
    expect(parseRepoInput("https://github.com/pennsieve-apps/spike-sorter.git")).toEqual(want);
    expect(parseRepoInput("  github.com/pennsieve-apps/spike-sorter/ ")).toEqual(want);
    expect(parseRepoInput("git@github.com:pennsieve-apps/spike-sorter.git")).toEqual(want);
    expect(parseRepoInput("https://github.com/pennsieve-apps/spike-sorter/tree/main")).toEqual(want);
  });
  it("refuses what isn't a repository", () => {
    expect(parseRepoInput("")).toBeNull();
    expect(parseRepoInput("spike-sorter")).toBeNull();
    expect(parseRepoInput("https://github.com/pennsieve-apps")).toBeNull();
    expect(parseRepoInput("-bad/name")).toBeNull();
  });
});

describe("stepsFor", () => {
  const accessible = { kind: "accessible" };

  it("starts on the repository step", () => {
    const steps = stepsFor(newDraft());
    expect(steps.map((s) => s.key)).toEqual([...STEPS]);
    expect(steps[0]).toMatchObject({ current: true, done: false });
    expect(firstToDo(steps)).toBe(0);
  });

  it("moves to the destinations once Pennsieve has access, with sharing next for an App Store app", () => {
    const steps = stepsFor({ ...newDraft(), owner: "o", repo: "r" }, { access: { kind: "added" } });
    expect(steps[0].done).toBe(true);
    expect(steps[1].current).toBe(true);
    expect(steps[2].skipped).toBe(false);
  });

  it("skips sharing for Discover only, and for an app that exists already", () => {
    const discoverOnly = stepsFor({ ...newDraft(), appstore: false, discover: true, settingsSaved: true }, { access: accessible });
    expect(discoverOnly[2]).toMatchObject({ skipped: true, done: false });
    expect(discoverOnly[3].current).toBe(true);
    expect(nextStep(discoverOnly, 1)).toBe(3);
    expect(prevStep(discoverOnly, 3)).toBe(1);

    const exists = stepsFor({ ...newDraft(), settingsSaved: true }, { access: accessible, appExists: true });
    expect(exists[2].skipped).toBe(true);
    expect(exists[3].current).toBe(true);
  });

  it("is done once a release is built, or put off", () => {
    const released = stepsFor({ ...newDraft(), settingsSaved: true, releasedTag: "v1.0.0" }, { access: accessible });
    expect(released.every((s) => s.done || s.skipped)).toBe(true);
    expect(firstToDo(released)).toBe(STEPS.length - 1);
    const later = stepsFor({ ...newDraft(), settingsSaved: true, releaseChoice: "later" }, { access: accessible });
    expect(later[3].done).toBe(true);
  });

  it("does not count the destinations done until they are saved", () => {
    const steps = stepsFor({ ...newDraft(), appstore: true }, { access: accessible });
    expect(steps[1]).toMatchObject({ current: true, done: false });
  });
});

describe("destinations and sharing", () => {
  it("names the destinations as github-service does", () => {
    expect(destinationsOf({ appstore: true, discover: false })).toEqual(["appstore"]);
    expect(destinationsOf({ appstore: true, discover: true })).toEqual(["appstore", "discover"]);
    expect(destinationsOf({ appstore: false, discover: false })).toEqual([]);
  });

  it("summarises the sharing in a phrase", () => {
    expect(sharingSummary({ visibility: "public", entries: [] })).toBe("Public");
    expect(sharingSummary({ visibility: "private", entries: [] })).toBe("Private · only you");
    expect(
      sharingSummary({
        visibility: "private",
        entries: [
          { type: "workspace", id: "w" },
          { type: "user", id: "a" },
          { type: "user", id: "b" },
        ],
      })
    ).toBe("Private · 1 workspace, 2 people");
  });

  it("builds the access payload with the current user kept in", () => {
    const payload = accessPayload(
      {
        visibility: "private",
        entries: [
          { type: "workspace", id: "N:organization:w", organizationId: "N:organization:w" },
          { type: "team", id: "N:team:t", organizationId: "N:organization:w" },
          { type: "user", id: "N:user:u", organizationId: "N:organization:w" },
        ],
      },
      "N:user:me",
      "N:organization:w"
    );
    expect(payload.visibility).toBe("private");
    expect(payload.workspaces).toEqual([{ entityId: "N:organization:w", organizationId: "N:organization:w" }]);
    expect(payload.teams).toEqual([{ entityId: "N:team:t", organizationId: "N:organization:w" }]);
    expect(payload.users.map((u) => u.entityId)).toEqual(["N:user:u", "N:user:me"]);
    expect(accessPayload({ visibility: "public", entries: [] }, "N:user:me", null).users).toEqual([{ entityId: "N:user:me", organizationId: undefined }]);
  });
});

describe("pickerRepos", () => {
  it("lists the repositories Pennsieve sees, the ones with nothing on first", () => {
    const repos = pickerRepos([
      { full_name: "lab/zeta", publishing_to_appstore: true },
      { full_name: "lab/alpha" },
      { html_url: "https://github.com/lab/beta.git", publishing_to_discover: false },
      { name: "no-owner" },
    ]);
    expect(repos.map((r) => r.fullName)).toEqual(["lab/alpha", "lab/beta", "lab/zeta"]);
    expect(repos.map((r) => r.enabled)).toEqual([false, false, true]);
  });
});

describe("the draft", () => {
  it("is kept in storage and resumed", () => {
    const stored = new Map();
    const storage = { getItem: (k) => stored.get(k) ?? null, setItem: (k, v) => stored.set(k, v), removeItem: (k) => stored.delete(k) };
    const draft = { ...newDraft(), owner: "lab", repo: "alpha", discover: true };
    saveDraft(draft, storage);
    expect(loadDraft(storage)).toEqual(draft);
    expect(loadDraft({ getItem: () => "{not json" })).toEqual(newDraft());
  });
});
