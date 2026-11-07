import { describe, it, expect } from "vitest";
import { manifestDiff, diffLines, versionWarnings } from "./manifestDiff";

const v1 = {
  runtime: { cpu: 1024, memory: 2048, computeTypes: ["standard"] },
  parameters: [{ name: "threshold", type: "number", defaultValue: "0.5" }, { name: "mode", type: "string" }],
  inputs: [{ name: "rec", mediaTypes: ["application/edf"] }],
  outputs: [{ name: "ev", mediaTypes: ["application/json"] }],
};
const v2 = {
  runtime: { cpu: 2048, memory: 2048, computeTypes: ["standard"] },
  parameters: [{ name: "threshold", type: "number", defaultValue: "0.3" }, { name: "channel", type: "string" }],
  inputs: [{ name: "rec", mediaTypes: ["application/edf"] }],
  outputs: [{ name: "ev", mediaTypes: ["application/json", "text/csv"] }],
};

describe("manifestDiff", () => {
  it("lists what changes between versions", () => {
    const d = manifestDiff(v1, v2);
    expect(d.parameters).toEqual({ added: ["channel"], removed: ["mode"], changed: ["threshold"] });
    expect(d.inputs).toEqual({ added: [], removed: [], changed: [] });
    expect(d.outputs.changed).toEqual(["ev"]);
    expect(d.runtime).toEqual(["cpu"]);
    expect(d.empty).toBe(false);
    expect(diffLines(d)).toEqual([
      "Parameter added: channel",
      "Parameter removed: mode",
      "Parameter changed: threshold",
      "Output changed: ev",
      "Resources changed: CPU",
    ]);
  });

  it("is empty for the same manifest, and null without one", () => {
    expect(manifestDiff(v1, JSON.parse(JSON.stringify(v1))).empty).toBe(true);
    expect(manifestDiff(v1, null)).toBeNull();
    expect(diffLines(null)).toEqual([]);
  });

  it("warns about what this workflow would lose", () => {
    const d = manifestDiff(v1, v2);
    expect(versionWarnings(d, { mode: "fast" })).toEqual([
      'This workflow sets "mode", which the new version doesn\'t have',
      "Its inputs or outputs changed: check the connections",
    ]);
    expect(versionWarnings(manifestDiff(v1, v1), { mode: "fast" })).toEqual([]);
  });
});
