import { describe, it, expect } from "vitest";
import { APP_FILTER_DEFAULTS, appActiveFilters, appsInStatus, filterApps, visibilityLabel } from "./appFilters";
import { domainCounts, fieldCounts, domainOfTag, fieldOfTag } from "./appDomains";

const app = (name, { tags = [], visibility = "public", status = "active", summary = "" } = {}) => ({
  uuid: name,
  name,
  visibility,
  status,
  summary,
  sourceUrl: `https://github.com/org/${name}`,
  versions: [{ version: "1.0.0", createdAt: "2026-01-01", manifest: { name, tags } }],
});
const spikes = app("spike-detect", { tags: ["electrophysiology", "neuroscience"] });
const genes = app("gene-counts", { tags: ["genomics", "immunology"], visibility: "private" });
const old = app("old-viewer", { tags: ["visualization", "neuroscience"], status: "archived", summary: "Plots traces" });
const apps = [spikes, genes, old];
const keys = (list) => list.map((a) => a.name);

describe("appsInStatus", () => {
  it("keeps active, archived or all", () => {
    expect(keys(appsInStatus(apps, "active"))).toEqual(["spike-detect", "gene-counts"]);
    expect(keys(appsInStatus(apps, "archived"))).toEqual(["old-viewer"]);
    expect(keys(appsInStatus(apps, "all"))).toEqual(["spike-detect", "gene-counts", "old-viewer"]);
  });
});

describe("filterApps", () => {
  it("keeps the active apps by default", () => {
    expect(keys(filterApps(apps))).toEqual(["spike-detect", "gene-counts"]);
  });
  it("filters by visibility", () => {
    expect(keys(filterApps(apps, { visibility: "private" }))).toEqual(["gene-counts"]);
    expect(keys(filterApps(apps, { visibility: "public", status: "all" }))).toEqual(["spike-detect", "old-viewer"]);
  });
  it("filters by domain and field, both holding", () => {
    const ephys = domainOfTag("electrophysiology").key;
    const neuro = fieldOfTag("neuroscience").key;
    expect(keys(filterApps(apps, { status: "all", field: neuro }))).toEqual(["spike-detect", "old-viewer"]);
    expect(keys(filterApps(apps, { status: "all", field: neuro, domain: ephys }))).toEqual(["spike-detect"]);
  });
  it("searches the README summary too", () => {
    expect(keys(filterApps(apps, { status: "all", query: "traces" }))).toEqual(["old-viewer"]);
  });
});

describe("visibilityLabel", () => {
  it("names public and private only", () => {
    expect(visibilityLabel(spikes)).toBe("Public");
    expect(visibilityLabel(genes)).toBe("Private");
    expect(visibilityLabel({ visibility: "shared" })).toBe(null);
  });
});

describe("appActiveFilters", () => {
  const domains = domainCounts(apps);
  const fields = fieldCounts(apps);
  it("is empty at the defaults", () => {
    expect(appActiveFilters(APP_FILTER_DEFAULTS, { domains, fields })).toEqual([]);
  });
  it("names each filter set, in the panel's order", () => {
    const state = { visibility: "private", domain: domainOfTag("genomics").key, field: fieldOfTag("immunology").key, status: "archived" };
    expect(appActiveFilters(state, { domains, fields })).toEqual([
      { key: "visibility", label: "Private" },
      { key: "domain", label: domainOfTag("genomics").label },
      { key: "field", label: fieldOfTag("immunology").label },
      { key: "status", label: "Status: Archived" },
    ]);
  });
});
