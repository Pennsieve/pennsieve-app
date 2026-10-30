import { describe, it, expect } from "vitest";
import {
  isPackageInFlight,
  isPackageReady,
  packageStateLabel,
  packageStatus,
} from "./index";

describe("packageStateLabel", () => {
  it("reads UPLOADED as waiting for the scan", () => {
    expect(packageStateLabel("UPLOADED")).toBe("Scanning…");
  });

  it("gives READY no badge", () => {
    expect(packageStateLabel("READY")).toBe("");
  });

  it("calls an ERROR package with an infected file quarantined", () => {
    expect(packageStateLabel("ERROR", "infected")).toBe("Quarantined");
    expect(packageStateLabel("INFECTED")).toBe("Quarantined");
  });

  it("calls any other ERROR package failed", () => {
    expect(packageStateLabel("ERROR")).toBe("Failed");
    expect(packageStateLabel("ERROR", "failed")).toBe("Failed");
    expect(packageStateLabel("ERROR", "clean")).toBe("Failed");
  });

  it("no longer says Unprocessed or Processed", () => {
    const states = ["UPLOADED", "READY", "PROCESSING", "UNAVAILABLE", "ERROR"];
    for (const s of states) {
      expect(packageStateLabel(s)).not.toMatch(/processed/i);
    }
  });

  it("labels uploads and leaves unknown states blank", () => {
    expect(packageStateLabel("UNAVAILABLE")).toBe("Uploading");
    expect(packageStateLabel("DELETING")).toBe("");
    expect(packageStateLabel(undefined)).toBe("");
  });
});

describe("isPackageReady", () => {
  it("is true only for READY", () => {
    expect(isPackageReady({ content: { state: "READY" } })).toBe(true);
    for (const s of ["UPLOADED", "ERROR", "INFECTED", "PROCESSING", "UNAVAILABLE", ""]) {
      expect(isPackageReady({ content: { state: s } })).toBe(false);
    }
    expect(isPackageReady(undefined)).toBe(false);
  });
});

describe("isPackageInFlight", () => {
  it("covers uploading, scanning and legacy processing", () => {
    expect(isPackageInFlight("UNAVAILABLE")).toBe(true);
    expect(isPackageInFlight("UPLOADED")).toBe(true);
    expect(isPackageInFlight("PROCESSING")).toBe(true);
    expect(isPackageInFlight("READY")).toBe(false);
    expect(isPackageInFlight("ERROR")).toBe(false);
  });
});

describe("packageStatus", () => {
  it("maps states to keys", () => {
    expect(packageStatus("UPLOADED")).toBe("scanning");
    expect(packageStatus("READY")).toBe("ready");
    expect(packageStatus("ERROR")).toBe("failed");
    expect(packageStatus("IMPORTING")).toBe("importing");
  });
});
