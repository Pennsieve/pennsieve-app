import { describe, it, expect } from "vitest";
import { applyFilters, matchesSearch, outputOptions, sortWorkflows } from "./galleryFilter";

const spikes = {
  name: "EEG spikes",
  description: "Finds interictal spikes",
  official: true,
  createdAt: "2026-01-01",
  metrics: { totalRuns: 3, lastRunAt: "2026-10-20" },
  dag: [
    { id: "s", type: "data-source" },
    { id: "a", type: "processor", sourceUrl: "https://github.com/org/spike-detect" },
    { id: "t", type: "data-target", targetType: "pennsieve" },
  ],
};
const zipper = {
  name: "Zip it",
  createdAt: "2026-05-01",
  metrics: { totalRuns: 9, lastRunAt: "2026-09-01" },
  dag: [
    { id: "a", type: "processor", sourceUrl: "https://github.com/org/zipper" },
    { id: "t", type: "data-target", targetType: "download" },
  ],
};
const unused = { name: "Alpha", createdAt: "2026-08-01", dag: [] };
const targetTypes = [
  { targetType: "pennsieve", label: "Pennsieve Dataset" },
  { targetType: "download", label: "Download" },
];

describe("matchesSearch", () => {
  it("matches names, descriptions, apps and inputs and outputs", () => {
    expect(matchesSearch(spikes, "interictal")).toBe(true);
    expect(matchesSearch(spikes, "spike-detect")).toBe(true);
    expect(matchesSearch(zipper, "download", { targetTypes })).toBe(true);
    expect(matchesSearch(zipper, "zip download", { targetTypes })).toBe(true);
    expect(matchesSearch(zipper, "zip pennsieve", { targetTypes })).toBe(false);
  });
});

describe("applyFilters", () => {
  const all = [spikes, zipper, unused];
  it("filters by input, output and Pennsieve's", () => {
    expect(applyFilters(all, { input: "dataset" })).toEqual([spikes]);
    expect(applyFilters(all, { input: "none" }).map((w) => w.name)).toEqual(["Zip it", "Alpha"]);
    expect(applyFilters(all, { output: "download" })).toEqual([zipper]);
    expect(applyFilters(all, { officialOnly: true })).toEqual([spikes]);
  });

  it("offers the outputs the list has", () => {
    expect(outputOptions(all, targetTypes)).toEqual([
      { value: "download", label: "Download" },
      { value: "pennsieve", label: "Pennsieve Dataset" },
    ]);
  });
});

describe("sortWorkflows", () => {
  const all = [unused, zipper, spikes];
  it("sorts by use, runs, age or name", () => {
    expect(sortWorkflows(all, "recent").map((w) => w.name)).toEqual(["EEG spikes", "Zip it", "Alpha"]);
    expect(sortWorkflows(all, "runs").map((w) => w.name)).toEqual(["Zip it", "EEG spikes", "Alpha"]);
    expect(sortWorkflows(all, "newest").map((w) => w.name)).toEqual(["Alpha", "Zip it", "EEG spikes"]);
    expect(sortWorkflows(all, "name").map((w) => w.name)).toEqual(["Alpha", "EEG spikes", "Zip it"]);
  });
});
