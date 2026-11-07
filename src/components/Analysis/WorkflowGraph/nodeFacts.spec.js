import { describe, it, expect } from "vitest";
import { nodeDurationSec, formatRunTime, formatResources } from "./nodeFacts";

describe("nodeDurationSec", () => {
  const startedAt = "2026-10-23T19:35:05Z";
  it("is start to completion", () => {
    expect(nodeDurationSec({ startedAt, completedAt: "2026-10-23T20:31:19Z" })).toBe(3374);
  });
  it("counts to now while running", () => {
    const now = Date.parse("2026-10-23T19:36:05Z");
    expect(nodeDurationSec({ startedAt, status: "STARTED" }, now)).toBe(60);
  });
  it("is nothing before it starts, or without an end", () => {
    expect(nodeDurationSec({})).toBeNull();
    expect(nodeDurationSec({ startedAt, status: "FAILED" })).toBeNull();
  });
});

describe("formatRunTime", () => {
  it("reads naturally at each scale", () => {
    expect(formatRunTime(null)).toBe("");
    expect(formatRunTime(2.4)).toBe("2s");
    expect(formatRunTime(3374)).toBe("56m 14s");
    expect(formatRunTime(3 * 3600 + 125)).toBe("3h 2m");
  });
});

describe("formatResources", () => {
  it("shows vCPU and memory", () => {
    expect(formatResources("1024", "2048")).toBe("1 vCPU · 2 GB");
    expect(formatResources(512, 512)).toBe("0.5 vCPU · 512 MB");
    expect(formatResources("", "")).toBe("");
  });
});
