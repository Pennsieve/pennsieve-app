import { describe, it, expect } from "vitest";
import {
  nodeTab,
  nodeStatus,
  canToggleStatus,
  nodeCapabilities,
  recentNodeRuns,
  relativeTime,
  formatAccountId,
  deploymentMode,
  DEPLOYMENT_MODES,
  contrastRatio,
  limitSummary,
  nodeGpu,
  gpuName,
  gpuOffer,
  gpuTaskResources,
  notebookCeiling,
  notebookLimitText,
  notebookLimitWarning,
  tierNotebookLine,
  NON_NOTEBOOK_LIMIT_KEYS,
  NOTEBOOKS_OFF,
} from "./computeNodeHelpers";

describe("compute node page", () => {
  it("lands on the tab in the URL, or the one a section link is on", () => {
    expect(nodeTab({ tab: "access" })).toBe("access");
    expect(nodeTab({ tab: "nonsense" })).toBe("overview");
    expect(nodeTab({}, "#quotas")).toBe("settings");
    expect(nodeTab({}, "#llm-budget")).toBe("settings");
    expect(nodeTab({}, "#pipeline-budget")).toBe("settings");
    expect(nodeTab({ tab: "reference-data" })).toBe("overview");
    expect(nodeTab({ tab: "advanced" }, "#quotas")).toBe("advanced");
    expect(nodeTab()).toBe("overview");
  });

  it("says the status, and when it can be toggled", () => {
    expect(nodeStatus({ status: "Enabled" })).toBe("Enabled");
    expect(nodeStatus({ status: "stopped" })).toBe("Paused");
    expect(nodeStatus({ status: "Destroying" })).toBe("Destroying");
    expect(nodeStatus({})).toBe("Pending");
    expect(canToggleStatus({ status: "Paused" })).toBe(true);
    expect(canToggleStatus({ status: "Pending" })).toBe(false);
    expect(nodeStatus({ status: "Updating" })).toBe("Updating");
    expect(canToggleStatus({ status: "Updating" })).toBe(false);
  });

  it("names the deployment mode", () => {
    expect(deploymentMode({ deploymentMode: "COMPLIANT" }).label).toBe("Compliant");
  });

  it("lists what it can do", () => {
    const caps = nodeCapabilities(
      { maxInteractiveSessions: 3, maxGpuInstances: 2, gpuTier: "small", enableLLMAccess: false },
      [{ tier: "small", gpu: "T4", gpuMemoryGB: 16 }]
    );
    expect(caps.map((c) => [c.key, c.on, c.detail])).toEqual([
      ["notebooks", true, "Up to 3 at a time"],
      ["gpu", true, "T4, 16 GB · up to 2"],
      ["ai", false, "Not enabled"],
    ]);
  });

  it("picks the node's latest runs", () => {
    const runs = [
      { uuid: "a", computeNodeUuid: "n1", startedAt: "2026-10-01T00:00:00Z" },
      { uuid: "b", computeNodeUuid: "n2", startedAt: "2026-10-03T00:00:00Z" },
      { uuid: "c", computeNodeUuid: "n1", startedAt: "2026-10-02T00:00:00Z" },
    ];
    expect(recentNodeRuns(runs, "n1").map((r) => r.uuid)).toEqual(["c", "a"]);
    expect(recentNodeRuns(runs, "n1", 1).map((r) => r.uuid)).toEqual(["c"]);
  });

  it("formats times and account ids", () => {
    const now = new Date("2026-10-24T12:00:00Z").getTime();
    expect(relativeTime("2026-10-24T11:58:00Z", now)).toBe("2 min ago");
    expect(relativeTime("2026-10-24T09:00:00Z", now)).toBe("3 h ago");
    expect(relativeTime("2026-10-20T12:00:00Z", now)).toBe("4 d ago");
    expect(relativeTime("", now)).toBe("");
    expect(formatAccountId("123456789012")).toBe("1234-5678-9012");
  });

  it("sums up a budget row's limits in one line", () => {
    expect(limitSummary({ dailyCostUsd: 5, monthlyCostUsd: null, maxConcurrentRuns: 3 })).toBe("$5.00 a day · 3 runs at once");
    expect(limitSummary({ maxConcurrentRuns: 1 })).toBe("1 run at once");
    expect(limitSummary({ maxConcurrentRuns: 3, maxInteractiveSessions: 2 })).toBe("3 runs at once · 2 notebooks open");
    expect(limitSummary({ maxInteractiveSessions: 1 })).toBe("1 notebook open");
    expect(limitSummary({ maxInteractiveSessions: 0 })).toBe("0 notebooks open");
    expect(limitSummary({ dailyCostUsd: 0 })).toBe("$0.00 a day");
    expect(limitSummary({})).toBe("");
    expect(limitSummary(null)).toBe("");
    expect(limitSummary({ maxConcurrentRuns: 3, maxInteractiveSessions: 2 }, NON_NOTEBOOK_LIMIT_KEYS)).toBe("3 runs at once");
  });
});

// A tier's notebooks-open limit only narrows the node's own ceiling
// (maxInteractiveSessions on the node record).
describe("notebook limits against the node's ceiling", () => {
  it("reads the ceiling off the node, 0 when sessions are off", () => {
    expect(notebookCeiling({ maxInteractiveSessions: 2 })).toBe(2);
    expect(notebookCeiling({ maxInteractiveSessions: 0 })).toBe(0);
    expect(notebookCeiling({})).toBe(0);
    expect(notebookCeiling(null)).toBe(0);
  });

  it("says what an unset tier comes to", () => {
    expect(notebookLimitText(null, 2)).toBe("No limit (node allows up to 2)");
    expect(notebookLimitText(undefined, 2)).toBe("No limit (node allows up to 2)");
    expect(notebookLimitWarning(null, 2)).toBe("");
    expect(tierNotebookLine(null, 2)).toBe("Notebooks open: No limit (node allows up to 2)");
    expect(tierNotebookLine({ maxInteractiveSessions: null }, 2)).toBe("Notebooks open: No limit (node allows up to 2)");
  });

  it("shows a limit at or below the ceiling as is, without a warning", () => {
    expect(notebookLimitText(1, 2)).toBe("1 notebook open");
    expect(notebookLimitText(2, 2)).toBe("2 notebooks open");
    expect(notebookLimitText(0, 2)).toBe("0 notebooks open");
    expect(notebookLimitWarning(2, 2)).toBe("");
    expect(notebookLimitWarning(0, 2)).toBe("");
    expect(tierNotebookLine({ maxInteractiveSessions: 1 }, 2)).toBe("1 notebook open");
  });

  it("flags a limit above the ceiling, which has no effect", () => {
    expect(notebookLimitText(5, 2)).toBe("5 notebooks open (node allows up to 2)");
    expect(notebookLimitWarning(5, 2)).toBe("This node allows at most 2 open notebooks; a higher limit has no effect.");
    expect(notebookLimitWarning(3, 1)).toBe("This node allows at most 1 open notebook; a higher limit has no effect.");
    expect(tierNotebookLine({ maxInteractiveSessions: 5 }, 2)).toBe("5 notebooks open (node allows up to 2)");
  });

  it("says notebooks are off when the node has no sessions", () => {
    expect(NOTEBOOKS_OFF).toBe("Notebooks are off on this node");
    for (const ceiling of [0, null, undefined]) {
      expect(notebookLimitText(null, ceiling)).toBe(NOTEBOOKS_OFF);
      expect(notebookLimitText(3, ceiling)).toBe(NOTEBOOKS_OFF);
      expect(notebookLimitWarning(3, ceiling)).toBe("");
      expect(tierNotebookLine({ maxInteractiveSessions: 3 }, ceiling)).toBe(NOTEBOOKS_OFF);
    }
  });
});

// GET /compute/resources/gpu-tiers, as account-service lists them; taskCpu
// and taskMemoryMiB (what a GPU task gets) where the tiers carry them.
const TIERS = [
  { tier: "small", instanceType: "g4dn.xlarge", gpu: "NVIDIA T4", gpuMemoryGB: 16, vcpus: 4, memoryGB: 16, pricePerHour: 0.526 },
  { tier: "medium", instanceType: "g6.2xlarge", gpu: "NVIDIA L4", gpuMemoryGB: 24, vcpus: 8, memoryGB: 32, pricePerHour: 0.978, taskCpu: 8192, taskMemoryMiB: 30720 },
];

describe("a node's GPU", () => {
  it("is null for a node without GPUs", () => {
    expect(nodeGpu({ maxGpuInstances: 0, gpuTier: "medium" }, TIERS)).toBeNull();
    expect(nodeGpu({}, TIERS)).toBeNull();
    expect(nodeGpu(null, TIERS)).toBeNull();
    expect(gpuOffer(null)).toBe("CPU only");
  });

  it("takes what a GPU task gets from its tier, exact where the tiers say", () => {
    const g = nodeGpu({ maxGpuInstances: 2, gpuTier: "medium" }, TIERS);
    expect(g).toEqual({ tier: "medium", model: "NVIDIA L4", vramGB: 24, instanceType: "g6.2xlarge", vcpu: 8, memoryGB: 30, approx: false, pricePerHour: 0.978, maxInstances: 2 });
    expect(gpuName(g)).toBe("NVIDIA L4 · 24 GB");
    expect(gpuOffer(g)).toBe("GPU: NVIDIA L4 · 24 GB · up to 2 instances");
    expect(gpuTaskResources(g)).toBe("8 vCPU / 30 GB");
    expect(gpuTaskResources(g, " · ")).toBe("8 vCPU · 30 GB");
  });

  it("derives them from the instance (less the agent's headroom) and says so, else", () => {
    const g = nodeGpu({ maxGpuInstances: 1 }, TIERS); // small, the default tier
    expect(g.vcpu).toBe(4);
    expect(g.memoryGB).toBe(15);
    expect(g.approx).toBe(true);
    expect(gpuOffer(g)).toBe("GPU: NVIDIA T4 · 16 GB · up to 1 instance");
    expect(gpuTaskResources(g)).toBe("≈ 4 vCPU / 15 GB");
  });

  it("names the tier until the tiers load", () => {
    const g = nodeGpu({ maxGpuInstances: 2, gpuTier: "large" }, []);
    expect(g.model).toBe("");
    expect(gpuName(g)).toBe("large tier");
    expect(gpuOffer(g)).toBe("GPU: large tier · up to 2 instances");
    expect(gpuTaskResources(g)).toBe("");
  });
});

describe("node tiers (NodeTierBadge)", () => {
  it("gives each tier its colour, icon and one-line tooltip", () => {
    expect(deploymentMode({ deploymentMode: "basic" })).toMatchObject({ key: "basic", icon: "shield", tooltip: "Default AWS network; for public or low-risk data." });
    expect(deploymentMode({ deploymentMode: "secure" })).toMatchObject({ key: "secure", color: "#2563eb", tooltip: "Private network with controlled internet access." });
    expect(deploymentMode({ deploymentMode: "Compliant" })).toMatchObject({ key: "compliant", color: "#7c3aed", icon: "shield-check", tooltip: "Private network, no internet; for regulated data." });
  });
  it("reads a node without one, or an unknown one, as Basic", () => {
    expect(deploymentMode({}).key).toBe("basic");
    expect(deploymentMode({ deploymentMode: "other" }).key).toBe("basic");
  });
  it("has text that passes WCAG AA on its tint", () => {
    for (const m of DEPLOYMENT_MODES) expect(contrastRatio(m.color, m.background)).toBeGreaterThanOrEqual(4.5);
  });
  it("measures contrast as WCAG does", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });
});
