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
} from "./computeNodeHelpers";

describe("compute node page", () => {
  it("lands on the tab in the URL, or the one a section link is on", () => {
    expect(nodeTab({ tab: "access" })).toBe("access");
    expect(nodeTab({ tab: "nonsense" })).toBe("overview");
    expect(nodeTab({}, "#quotas")).toBe("settings");
    expect(nodeTab({}, "#llm-budget")).toBe("settings");
    expect(nodeTab({}, "#pipeline-budget")).toBe("settings");
    expect(nodeTab({}, "#reference-data")).toBe("reference-data");
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
});
