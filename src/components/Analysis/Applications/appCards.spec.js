import { describe, it, expect } from "vitest";
import { appTitle, appInitials, appColor, appDescription, versionLabel, runsOn, workflowUses, versionState, matchesAppSearch, sortApps } from "./appCards";

const spike = {
  name: "spike-detect",
  description: "Finds spikes",
  sourceUrl: "https://github.com/penn-lab/spike-detect.git",
  createdAt: "2026-01-01",
  runtimeConfig: { computeTypes: ["standard", "lambda"], cpu: 2048, memory: 4096 },
  versions: [
    { version: "1.0.0", status: "deployed", createdAt: "2026-02-01" },
    { version: "1.1.0", status: "deploying", createdAt: "2026-06-01" },
  ],
};
const zip = { sourceUrl: "https://github.com/acme/zipper", createdAt: "2026-05-01", versions: [] };
const workflows = [
  { dag: [{ sourceUrl: "https://github.com/penn-lab/spike-detect" }] },
  { dag: [{ sourceUrl: "https://github.com/penn-lab/spike-detect/" }, { sourceUrl: "https://github.com/acme/zipper" }] },
];

describe("app cards", () => {
  it("names and pictures an app", () => {
    expect(appTitle(spike)).toBe("spike-detect");
    expect(appTitle(zip)).toBe("zipper");
    expect(appInitials(spike)).toBe("SD");
    expect(appInitials(zip)).toBe("ZI");
    expect(appColor(spike)).toEqual(appColor({ name: "spike-detect" }));
    expect(appColor(spike).background).toMatch(/^hsl\(\d+, 55%, 92%\)$/);
  });

  it("says where it runs and how much it asks for", () => {
    expect(runsOn(spike)).toBe("Standard, Lambda · 2 vCPU · 4 GB");
    expect(runsOn({})).toBe("");
    const declared = { ...spike, versions: [{ version: "v2", createdAt: "2026-07-01", manifest: { description: "From app.yml", runtime: { computeTypes: ["standard"], cpu: 4096 } } }] };
    expect(runsOn(declared)).toBe("Standard · 4 vCPU · 4 GB");
    expect(appDescription(declared)).toBe("From app.yml");
    expect(appDescription(spike)).toBe("Finds spikes");
    expect(appDescription({ name: "zipper", description: "Zipper " })).toBe("");
    expect(versionLabel("v1.1.4")).toBe("v1.1.4");
    expect(versionLabel("1.1.4")).toBe("v1.1.4");
  });

  it("counts the workflows that use it, and its latest version's state", () => {
    expect(workflowUses(spike, workflows)).toBe(2);
    expect(workflowUses(zip, workflows)).toBe(1);
    expect(versionState(spike)).toBe("pending");
    expect(versionState(zip)).toBe("none");
  });

  it("searches name, description, README and repository", () => {
    expect(matchesAppSearch(spike, "penn-lab")).toBe(true);
    expect(matchesAppSearch(zip, "compression", "A compression tool")).toBe(true);
    expect(matchesAppSearch(zip, "spikes")).toBe(false);
  });

  it("sorts by use, update, age and name", () => {
    expect(sortApps([zip, spike], "used", workflows).map(appTitle)).toEqual(["spike-detect", "zipper"]);
    expect(sortApps([spike, zip], "updated").map(appTitle)).toEqual(["spike-detect", "zipper"]);
    expect(sortApps([spike, zip], "newest").map(appTitle)).toEqual(["zipper", "spike-detect"]);
    expect(sortApps([zip, spike], "name").map(appTitle)).toEqual(["spike-detect", "zipper"]);
  });
});

describe("recommended order", () => {
  const v = (status, manifest, createdAt = "2026-01-01") => ({ version: "v1", status, createdAt, manifest });
  it("puts runnable apps first, then those with an app.yml, then the most used", () => {
    const list = [
      { name: "failed", versions: [v("error", { tags: [] })] },
      { name: "bare", versions: [v("deployed", null)] },
      { name: "deploying", versions: [v("deploying", { tags: [] })] },
      { name: "declared", versions: [v("deployed", { tags: [] })] },
      { name: "declared-used", sourceUrl: "https://github.com/x/declared-used", versions: [v("deployed", { tags: [] })] },
    ];
    const workflows = [{ dag: [{ sourceUrl: "https://github.com/x/declared-used" }] }];
    expect(sortApps(list, "recommended", workflows).map((a) => a.name)).toEqual([
      "declared-used",
      "declared",
      "bare",
      "deploying",
      "failed",
    ]);
  });
});
