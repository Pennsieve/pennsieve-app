import { describe, it, expect } from "vitest";
import { appYmlFor, installUrl, loadDraft, newDraft, saveDraft, slugify, stepsFor, templateUrl } from "./publishApp";

describe("slugify", () => {
  it("makes a repository name from an app's name", () => {
    expect(slugify("My Brain MRI app!")).toBe("my-brain-mri-app");
    expect(slugify("  spaced   out ")).toBe("spaced-out");
    expect(slugify("")).toBe("");
  });
});

describe("appYmlFor", () => {
  it("writes the app's manifest from the draft, with the compute types chosen", () => {
    const yml = appYmlFor({ ...newDraft(), name: "Spike Sorter", description: "Sorts spikes.", tags: "ephys, sorting", lambda: true, cpu: "2048", memory: "4096", inputs: "recordings", outputs: "spikes, report" });
    expect(yml).toMatch(/^# yaml-language-server/);
    expect(yml).toMatch(/name: Spike Sorter/);
    expect(yml).toMatch(/description: Sorts spikes\./);
    expect(yml).toMatch(/type: processor/);
    expect(yml).toMatch(/- ephys\n\s+- sorting/);
    expect(yml).toMatch(/cpu: 2048/);
    expect(yml).toMatch(/memory: 4096/);
    expect(yml).toMatch(/computeTypes:\n\s+- standard\n\s+- lambda/);
    expect(yml).not.toMatch(/- gpu/);
    expect(yml).toMatch(/inputs:\n\s+- name: recordings/);
    expect(yml).toMatch(/outputs:\n\s+- name: spikes\n[\s\S]*- name: report/);
  });
});

describe("templateUrl and installUrl", () => {
  it("prefills GitHub's create-from-template page and points at the app's install page", () => {
    const url = templateUrl({ ...newDraft(), name: "Spike Sorter", description: "Sorts spikes.", owner: "lab" });
    expect(url).toMatch(/^https:\/\/github\.com\/new\?/);
    expect(url).toMatch(/template_owner=Pennsieve/);
    expect(url).toMatch(/template_name=processor-template-python/);
    expect(url).toMatch(/name=spike-sorter/);
    expect(url).toMatch(/owner=lab/);
    expect(url).toMatch(/visibility=public/);
    expect(installUrl("https://github.com/apps/pennsieve-test/")).toBe("https://github.com/apps/pennsieve-test/installations/new");
  });
});

describe("stepsFor", () => {
  const byKey = (steps) => Object.fromEntries(steps.map((s) => [s.key, s]));
  it("moves one step at a time, with what the services say counting for the author", () => {
    let s = byKey(stepsFor(newDraft()));
    expect(s.describe.current).toBe(true);
    s = byKey(stepsFor({ ...newDraft(), name: "x" }));
    expect(s.describe.done).toBe(true);
    expect(s.create.current).toBe(true);
    s = byKey(stepsFor({ ...newDraft(), name: "x" }, { installed: true }));
    expect(s.create.done).toBe(true);
    expect(s.install.done).toBe(true);
    expect(s.manifest.current).toBe(true);
    s = byKey(stepsFor({ ...newDraft(), name: "x", manifest: true }, { installed: true }));
    expect(s.release.current).toBe(true);
    s = byKey(stepsFor({ ...newDraft(), name: "x", manifest: true }, { installed: true, released: true }));
    expect(s.release.done).toBe(true);
    expect(stepsFor({ ...newDraft(), name: "x", manifest: true }, { installed: true, released: true }).some((x) => x.current)).toBe(false);
  });
  it("does not count the manifest done before the app is installed", () => {
    const s = byKey(stepsFor({ ...newDraft(), name: "x", created: true, manifest: true }));
    expect(s.create.done).toBe(true);
    expect(s.install.current).toBe(true);
    expect(s.manifest.done).toBe(false);
  });
});

describe("draft storage", () => {
  it("round-trips through storage and survives garbage", () => {
    const store = new Map();
    const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
    saveDraft({ ...newDraft(), name: "x", owner: "lab" }, storage);
    expect(loadDraft(storage).owner).toBe("lab");
    store.set("pennsieve.publishApp.draft", "{not json");
    expect(loadDraft(storage).name).toBe("");
  });
});
