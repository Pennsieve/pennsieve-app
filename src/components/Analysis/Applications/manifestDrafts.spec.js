import { describe, it, expect, beforeEach } from "vitest";
import { saveManifestDraft, getManifestDraft, clearManifestDraft, draftOutdatedBy } from "./manifestDrafts";

describe("app.yml drafts", () => {
  beforeEach(() => localStorage.clear());

  it("are kept per app, in this browser, until cleared", () => {
    expect(getManifestDraft("a")).toBeNull();
    expect(saveManifestDraft("a", "application:\n  name: a\n")).toBe(true);
    expect(getManifestDraft("a").yaml).toBe("application:\n  name: a\n");
    expect(getManifestDraft("b")).toBeNull();
    clearManifestDraft("a");
    expect(getManifestDraft("a")).toBeNull();
  });

  it("give way to a release made after they were saved", () => {
    const draft = { yaml: "x", savedAt: "2026-10-26T10:00:00Z" };
    expect(draftOutdatedBy(draft, [{ createdAt: "2026-10-25T09:00:00Z" }])).toBe(false);
    expect(draftOutdatedBy(draft, [{ createdAt: "2026-10-26T11:00:00Z" }])).toBe(true);
    expect(draftOutdatedBy({ yaml: "x" }, [{ createdAt: "2026-10-26T11:00:00Z" }])).toBe(false);
  });
});
