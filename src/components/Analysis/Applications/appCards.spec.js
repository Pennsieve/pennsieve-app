import { describe, it, expect } from "vitest";
import { appTitle, ownerAvatar, runsOn, workflowUses, versionState, matchesAppSearch, sortApps } from "./appCards";

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
    expect(ownerAvatar(spike)).toBe("https://github.com/penn-lab.png?size=160");
    expect(ownerAvatar({})).toBe("");
  });

  it("says where it runs and how much it asks for", () => {
    expect(runsOn(spike)).toBe("Standard, Lambda · 2 vCPU · 4 GB");
    expect(runsOn({})).toBe("");
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
