import { describe, it, expect } from "vitest";
import { cardStatus, shownVersion, sortEnvironments, formatBytes, since } from "./environmentCards";

const v = (version, status) => ({ version, status });

describe("cardStatus and shownVersion", () => {
  it("follows the latest version", () => {
    expect(cardStatus({ latest: v(2, "ready") })).toBe("ready");
    expect(cardStatus({ latest: v(2, "building") }, [v(1, "ready")])).toBe("building");
    expect(cardStatus({ latest: v(2, "failed") })).toBe("failed");
  });

  it("describes the newest ready version under a newer build", () => {
    expect(shownVersion({ latest: v(3, "building") }, [v(3, "building"), v(2, "ready"), v(1, "ready")]).version).toBe(2);
    expect(shownVersion({ latest: v(1, "failed") }, [v(1, "failed")]).version).toBe(1);
    expect(shownVersion({ latest: v(4, "ready") }, []).version).toBe(4);
  });
});

describe("sortEnvironments", () => {
  it("puts the user's own first, building ones on top", () => {
    const list = [
      { env: { name: "base", official: true }, status: "ready" },
      { env: { name: "b" }, status: "ready" },
      { env: { name: "a" }, status: "ready" },
      { env: { name: "z" }, status: "building" },
    ];
    expect(sortEnvironments(list).map((e) => e.env.name)).toEqual(["z", "a", "b", "base"]);
  });
});

describe("formatting", () => {
  it("formats sizes and times", () => {
    expect(formatBytes(146712352)).toBe("147 MB");
    expect(formatBytes(2.4e9)).toBe("2.4 GB");
    expect(formatBytes(0)).toBe("");
    const now = Date.parse("2026-10-24T04:00:00Z");
    expect(since("2026-10-24T03:57:00Z", now)).toBe("3 min ago");
    expect(since("2026-10-24T03:59:50Z", now)).toBe("just now");
    expect(since("", now)).toBe("");
  });
});
