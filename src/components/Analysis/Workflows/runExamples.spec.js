import { describe, it, expect, vi } from "vitest";
import {
  canEditWorkflow,
  createExampleCache,
  exampleLabel,
  exampleVersion,
  exhaustedLimit,
  formatResetAt,
  jobActive,
  jobStatusText,
  limitMessage,
  limitRows,
  openPdf,
  setExampleError,
} from "./runExamples";

describe("canEditWorkflow", () => {
  it("follows the workflow's permissions when it has them", () => {
    expect(canEditWorkflow({ createdBy: "N:user:a", permissions: { canEdit: false } }, { id: "N:user:a" })).toBe(false);
    expect(canEditWorkflow({ createdBy: "N:user:a", permissions: { canEdit: true } }, { id: "N:user:b" })).toBe(true);
  });
  it("falls back to its creator", () => {
    expect(canEditWorkflow({ createdBy: "N:user:a" }, { id: "N:user:a" })).toBe(true);
    expect(canEditWorkflow({ createdBy: 7 }, { id: "N:user:b", intId: 7 })).toBe(true);
    expect(canEditWorkflow({ createdBy: "N:user:a" }, { id: "N:user:b" })).toBe(false);
    expect(canEditWorkflow(null, { id: "N:user:a" })).toBe(false);
    expect(canEditWorkflow({ createdBy: "N:user:a" }, null)).toBe(false);
  });
});

describe("example labels", () => {
  it("names an older version's example", () => {
    expect(exampleLabel({ version: 3 })).toBe("Example");
    expect(exampleLabel({ version: 3, fromVersion: 3 })).toBe("Example from version 3");
    expect(exampleVersion({ version: 4 })).toBe(4);
    expect(exampleVersion({ version: 4, fromVersion: 2 })).toBe(2);
    expect(exampleVersion(null)).toBe(null);
  });
});

describe("jobs", () => {
  it("is active while queued or generating", () => {
    expect(jobActive({ status: "QUEUED" })).toBe(true);
    expect(jobActive({ status: "GENERATING" })).toBe(true);
    expect(jobActive({ status: "READY" })).toBe(false);
    expect(jobActive({ status: "FAILED" })).toBe(false);
    expect(jobActive(null)).toBe(false);
  });
  it("says what a job is doing", () => {
    expect(jobStatusText({ status: "GENERATING" })).toMatch(/Generating/);
    expect(jobStatusText({ status: "FAILED", error: "no outputs" })).toBe("The example PDF could not be made: no outputs");
    expect(jobStatusText(null)).toBe("");
  });
});

describe("limits", () => {
  const limits = { workflow: { used: 3, limit: 3 }, user: { used: 1, limit: 10 }, workspace: { used: 4, limit: 20 } };
  it("lists what's left in order", () => {
    expect(limitRows(limits).map((r) => [r.key, r.left])).toEqual([
      ["workflow", 0],
      ["user", 9],
      ["workspace", 16],
    ]);
    expect(limitRows(null)).toEqual([]);
  });
  it("finds the limit used up", () => {
    expect(exhaustedLimit(limits).key).toBe("workflow");
    expect(exhaustedLimit({ user: { used: 0, limit: 10 } })).toBe(null);
  });
  it("says when a limit resets", () => {
    const now = new Date("2026-10-30T12:00:00Z");
    expect(formatResetAt("garbage", now)).toBe("");
    expect(formatResetAt(null, now)).toBe("");
    expect(formatResetAt(Date.parse("2026-10-31T00:00:00Z") / 1000, now)).toMatch(/at/);
    expect(limitMessage("user", undefined)).toMatch(/You've made all.*midnight UTC/);
    expect(limitMessage("workspace", "2026-10-31T00:00:00Z", now)).toMatch(/This workspace.*try again/);
    expect(limitMessage("platform")).toMatch(/Pennsieve's daily budget/);
  });
});

describe("setExampleError", () => {
  it("maps each refusal", () => {
    expect(setExampleError({ status: 403 })).toMatch(/edit the workflow and read every dataset/);
    expect(setExampleError({ status: 409, body: { job: { runId: "r-2" } } })).toMatch(/from run r-2/);
    expect(setExampleError({ status: 409, body: {} })).toMatch(/already being made/);
    expect(setExampleError({ status: 422, body: { message: "run wrote no dataset outputs" } })).toBe(
      "This run can't be an example: run wrote no dataset outputs"
    );
    expect(setExampleError({ status: 422, body: {} })).toMatch(/only a run that succeeded/);
    expect(setExampleError({ status: 429, body: { limit: "workflow" } })).toMatch(/This workflow has had all/);
    expect(setExampleError({ status: 500, message: "boom" })).toBe("Could not set the example: boom");
  });
});

describe("openPdf", () => {
  it("opens a link as it is", async () => {
    const win = { open: vi.fn() };
    await openPdf("https://cdn/x.pdf", win);
    expect(win.open).toHaveBeenCalledWith("https://cdn/x.pdf", "_blank", "noopener");
  });
  it("opens a tab at once and sends it to the fresh link", async () => {
    const tab = { location: { href: "" }, close: vi.fn(), opener: {} };
    const win = { open: vi.fn(() => tab) };
    await openPdf(async () => "https://cdn/y.pdf", win);
    expect(win.open).toHaveBeenCalledWith("", "_blank");
    expect(tab.location.href).toBe("https://cdn/y.pdf");
    expect(tab.opener).toBe(null);
  });
  it("closes the tab when there's no link", async () => {
    const tab = { location: { href: "" }, close: vi.fn() };
    await openPdf(async () => null, { open: () => tab });
    expect(tab.close).toHaveBeenCalled();
  });
});

describe("createExampleCache", () => {
  const unavailable = (err) => !err?.status || err.status === 404;
  it("asks once per workflow while fresh", async () => {
    const cache = createExampleCache(unavailable, 1000);
    const fetch = vi.fn(async () => ({ pdfUrl: "u" }));
    await cache.get("w1", fetch, 0);
    await cache.get("w1", fetch, 500);
    expect(fetch).toHaveBeenCalledTimes(1);
    await cache.get("w1", fetch, 1500);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("stops asking where the feature isn't served", async () => {
    const cache = createExampleCache(unavailable);
    const fetch = vi.fn(async () => Promise.reject(Object.assign(new Error("nf"), { status: 404 })));
    expect(await cache.get("w1", fetch)).toBe(null);
    expect(cache.off).toBe(true);
    expect(await cache.get("w2", fetch)).toBe(null);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("keeps asking after another failure", async () => {
    const cache = createExampleCache(unavailable);
    const fetch = vi.fn(async () => Promise.reject(Object.assign(new Error("x"), { status: 403 })));
    expect(await cache.get("w1", fetch)).toBe(null);
    expect(cache.off).toBe(false);
  });
});
