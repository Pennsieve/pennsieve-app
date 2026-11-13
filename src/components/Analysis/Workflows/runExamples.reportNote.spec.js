import { describe, it, expect, vi } from "vitest";
import {
  appChanges,
  appSteps,
  changesText,
  createVersionCache,
  loadReportNote,
  reportNote,
} from "./runExamples";

const step = (repo, tag, extra = {}) => ({
  id: `${repo}-step`,
  type: "processor",
  sourceUrl: `https://github.com/pennsieve-apps/${repo}`,
  tag,
  ...extra,
});
const wf = (...steps) => ({
  dag: [{ id: "in", type: "data-source" }, ...steps, { id: "out", type: "data-target", dependsOn: [] }],
});

describe("appSteps", () => {
  it("keeps the app steps, named by their repository", () => {
    expect(appSteps(wf(step("eeg-spikes", "v0.1.0", { name: "Spike detection" }), step("eeg-qc.git", "v1.0.0", { variant: "gpu" })))).toEqual([
      { name: "eeg-spikes", sourceUrl: "https://github.com/pennsieve-apps/eeg-spikes", tag: "v0.1.0", variant: "" },
      { name: "eeg-qc", sourceUrl: "https://github.com/pennsieve-apps/eeg-qc.git", tag: "v1.0.0", variant: "gpu" },
    ]);
    expect(appSteps(null)).toEqual([]);
    expect(appSteps({})).toEqual([]);
  });
});

describe("appChanges", () => {
  it("names tag upgrades, added and removed apps, matching repositories loosely", () => {
    const before = appSteps(wf(step("eeg-spikes", "v0.1.0"), step("eeg-old", "v1.0.0"), step("eeg-qc", "v2.0.0")));
    const after = appSteps(wf(step("eeg-spikes", "v0.1.1"), step("eeg-qc", "v2.0.0"), step("eeg-new", "v0.2.0")));
    after[1].sourceUrl = "https://GitHub.com/pennsieve-apps/eeg-qc.git/";
    expect(appChanges(before, after)).toEqual([
      { name: "eeg-spikes", from: "v0.1.0", to: "v0.1.1" },
      { name: "eeg-old", from: "v1.0.0", to: "" },
      { name: "eeg-new", from: "", to: "v0.2.0" },
    ]);
  });
  it("is empty when only non-app details changed", () => {
    expect(appChanges(appSteps(wf(step("a", "v1"))), appSteps(wf(step("a", "v1", { position: { x: 3 } }))))).toEqual([]);
  });
  it("counts a variant change and an app used twice", () => {
    expect(appChanges([{ sourceUrl: "https://x/a", tag: "v1" }], [{ sourceUrl: "https://x/a", tag: "v1", variant: "gpu" }])).toEqual([
      { name: "a", from: "v1", to: "v1 (gpu)" },
    ]);
    expect(
      appChanges(
        [{ sourceUrl: "https://x/a", tag: "v1" }, { sourceUrl: "https://x/a", tag: "v1" }],
        [{ sourceUrl: "https://x/a", tag: "v1" }, { sourceUrl: "https://x/a", tag: "v2" }]
      )
    ).toEqual([{ name: "a", from: "v1", to: "v1, v2" }]);
  });
  it("uses an example app's own name", () => {
    expect(appChanges([{ name: "st-prep", sourceUrl: "https://x/st-prep-repo", tag: "v1" }], [])).toEqual([
      { name: "st-prep", from: "v1", to: "" },
    ]);
  });
});

describe("changesText", () => {
  it("lists a few, then how many more", () => {
    const c = (name) => ({ name, from: "v1", to: "v2" });
    expect(changesText([])).toBe("");
    expect(changesText([c("a"), { name: "b", from: "", to: "v1" }, { name: "c", from: "v1", to: "" }])).toBe(
      "a v1 → v2, b added, c removed"
    );
    expect(changesText([c("a"), c("b"), c("c"), c("d"), c("e")])).toBe("a v1 → v2, b v1 → v2, c v1 → v2 and 2 more");
  });
});

describe("reportNote", () => {
  const v2 = appSteps(wf(step("eeg-spikes", "v0.1.0"), step("eeg-qc", "v1.0.0")));
  const v3 = appSteps(wf(step("eeg-spikes", "v0.1.1"), step("eeg-qc", "v1.0.0")));

  it("says nothing for the version shown's own report", () => {
    expect(reportNote({ version: 3 }, { currentSteps: v3 })).toBe("");
    expect(reportNote(null)).toBe("");
  });
  it("names the apps changed since an older version's report", () => {
    expect(reportNote({ version: 2, fromVersion: 2 }, { reportSteps: v2, currentSteps: v3 })).toBe(
      "Report from version 2; apps have changed since (eeg-spikes v0.1.0 → v0.1.1)"
    );
  });
  it("says only the version when no app changed, or the steps aren't known", () => {
    expect(reportNote({ version: 2, fromVersion: 2 }, { reportSteps: v3, currentSteps: v3 })).toBe("Report from version 2");
    expect(reportNote({ version: 2, fromVersion: 2 }, { currentSteps: v3 })).toBe("Report from version 2");
    expect(reportNote({ version: 2, fromVersion: 2 }, { reportSteps: v2, currentSteps: [] })).toBe("Report from version 2");
  });
  it("compares the example's own apps first, even on the same version", () => {
    const apps = [{ name: "eeg-spikes", sourceUrl: "https://github.com/pennsieve-apps/eeg-spikes", tag: "v0.0.9" }, { name: "eeg-qc", sourceUrl: "https://github.com/pennsieve-apps/eeg-qc", tag: "v1.0.0" }];
    expect(reportNote({ version: 3, apps }, { reportSteps: v3, currentSteps: v3 })).toBe(
      "Apps have changed since this report (eeg-spikes v0.0.9 → v0.1.1)"
    );
    expect(reportNote({ version: 2, fromVersion: 2, apps }, { reportSteps: v3, currentSteps: v3 })).toBe(
      "Report from version 2; apps have changed since (eeg-spikes v0.0.9 → v0.1.1)"
    );
    expect(reportNote({ version: 3, apps: [] }, { currentSteps: v3 })).toBe("");
  });
});

describe("loadReportNote", () => {
  const current = wf(step("eeg-spikes", "v0.1.1"));
  it("loads the report's version only when it needs it", async () => {
    const load = vi.fn(async () => wf(step("eeg-spikes", "v0.1.0")));
    expect(await loadReportNote({ version: 2, fromVersion: 2 }, current, load)).toBe(
      "Report from version 2; apps have changed since (eeg-spikes v0.1.0 → v0.1.1)"
    );
    expect(load).toHaveBeenCalledWith(2);

    load.mockClear();
    expect(await loadReportNote({ version: 3 }, current, load)).toBe("");
    const apps = [{ sourceUrl: "https://github.com/pennsieve-apps/eeg-spikes", tag: "v0.1.0", name: "eeg-spikes" }];
    expect(await loadReportNote({ version: 2, fromVersion: 2, apps }, current, load)).toContain("eeg-spikes v0.1.0 → v0.1.1");
    expect(load).not.toHaveBeenCalled();
  });
  it("still says the version when the load fails", async () => {
    const load = vi.fn(async () => {
      throw new Error("nope");
    });
    expect(await loadReportNote({ version: 2, fromVersion: 2 }, current, load)).toBe("Report from version 2");
    expect(await loadReportNote(null, current, load)).toBe("");
  });
});

describe("createVersionCache", () => {
  it("fetches a version once, and again after a failure", async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new Error("x")).mockResolvedValue({ dag: [] });
    const get = createVersionCache(fetch);
    await expect(get("wf", 2)).rejects.toThrow("x");
    expect(await get("wf", 2)).toEqual({ dag: [] });
    expect(await get("wf", 2)).toEqual({ dag: [] });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledWith("wf", 2);
  });
});
