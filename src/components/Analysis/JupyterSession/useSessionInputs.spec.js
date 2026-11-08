import { describe, it, expect } from "vitest";
import { sourceAt, sourceBase, downloadCheck, canAddViews } from "./useSessionInputs";

const GiB = 2 ** 30;

describe("a view's folder in the tree", () => {
  const bossdb = { nodeId: "bossdb-x", inputFolder: "bossdb-x" };
  const nested = { nodeId: "bossdb-x-more", inputFolder: "bossdb-x-more" };
  const root = { nodeId: "node_1", inputFolder: "" };

  it("is input/<its folder>, or input/ for one staged there", () => {
    expect(sourceBase(bossdb)).toBe("input/bossdb-x");
    expect(sourceBase(root)).toBe("input");
  });

  it("holds the folders below it, by whole names", () => {
    expect(sourceAt([bossdb, nested], "input/bossdb-x")).toEqual({ source: bossdb, rel: "" });
    expect(sourceAt([bossdb, nested], "input/bossdb-x/em/sub")).toEqual({ source: bossdb, rel: "em/sub/" });
    expect(sourceAt([bossdb, nested], "input/bossdb-x-more/a")).toEqual({ source: nested, rel: "a/" });
    expect(sourceAt([bossdb], "output")).toBe(null);
    // A view staged in input/ itself holds what no other view's folder does.
    expect(sourceAt([root, bossdb], "input/bossdb-x/a")).toEqual({ source: bossdb, rel: "a/" });
    expect(sourceAt([root, bossdb], "input/sub-01")).toEqual({ source: root, rel: "sub-01/" });
  });
});

describe("adding views", () => {
  it("follows the sidecar when it says, else refuses compliant nodes", () => {
    const compliant = { deploymentMode: "compliant" };
    expect(canAddViews(true, compliant)).toBe(true);
    expect(canAddViews(false, { deploymentMode: "secure" })).toBe(false);
    expect(canAddViews(null, compliant)).toBe(false);
    expect(canAddViews(null, { deploymentMode: "basic" })).toBe(true);
    expect(canAddViews(null, null)).toBe(true);
  });
});

describe("a download", () => {
  it("asks first over 1 GiB, or a tenth of the disk left", () => {
    expect(downloadCheck(500 * 2 ** 20, 50 * GiB)).toEqual({ fits: true, ask: false });
    expect(downloadCheck(2 * GiB, 50 * GiB)).toEqual({ fits: true, ask: true });
    expect(downloadCheck(600 * 2 ** 20, 5 * GiB)).toEqual({ fits: true, ask: true });
    expect(downloadCheck(2 * GiB, null)).toEqual({ fits: true, ask: true });
  });

  it("says when it doesn't fit", () => {
    expect(downloadCheck(100 * GiB, 40 * GiB)).toEqual({ fits: false, ask: true });
  });
});
