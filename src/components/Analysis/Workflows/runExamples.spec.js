import { describe, it, expect, vi } from "vitest";
import {
  canEditWorkflow,
  downloadPdf,
  samplePdfFilename,
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
  limitSentence,
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
    expect(exampleLabel({ version: 3 })).toBe("Sample output");
    expect(exampleLabel({ version: 3, fromVersion: 3 })).toBe("Sample output from version 3");
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
    expect(jobStatusText({ status: "FAILED", error: "no outputs" })).toBe("The sample output could not be generated: no outputs");
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
    expect(limitMessage("user", undefined)).toMatch(/You've generated all.*midnight UTC/);
    expect(limitMessage("workspace", "2026-10-31T00:00:00Z", now)).toMatch(/This workspace.*try again/);
    expect(limitMessage("platform")).toMatch(/Pennsieve's daily budget/);
  });
});

describe("setExampleError", () => {
  it("maps each refusal", () => {
    expect(setExampleError({ status: 403 })).toMatch(/edit the workflow and read every dataset/);
    expect(setExampleError({ status: 409, body: { job: { runId: "r-2" } } })).toMatch(/from run r-2/);
    expect(setExampleError({ status: 409, body: {} })).toMatch(/already being generated/);
    expect(setExampleError({ status: 422, body: { message: "run wrote no dataset outputs" } })).toBe(
      "This run can't be the sample output: run wrote no dataset outputs"
    );
    expect(setExampleError({ status: 422, body: {} })).toMatch(/only a run that succeeded/);
    expect(setExampleError({ status: 429, body: { limit: "workflow" } })).toMatch(/This workflow has had all/);
    expect(setExampleError({ status: 500, message: "boom" })).toBe("Could not set the sample output: boom");
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

describe("limitSentence", () => {
  const lim = (w, u, s) => ({ workflow: { used: w[0], limit: w[1] }, user: { used: u[0], limit: u[1] }, workspace: { used: s[0], limit: s[1] } });
  it("names the tightest limit", () => {
    expect(limitSentence(lim([1, 3], [2, 10], [5, 20]))).toBe("2 more sample outputs can be generated for this workflow today.");
    expect(limitSentence(lim([0, 3], [9, 10], [5, 20]))).toBe("1 more sample output can be generated by you today.");
    expect(limitSentence(lim([0, 3], [0, 10], [19, 20]))).toBe("1 more sample output can be generated in this workspace today.");
  });
  it("is empty when a limit is used up or there are none", () => {
    expect(limitSentence(lim([3, 3], [0, 10], [0, 20]))).toBe("");
    expect(limitSentence(null)).toBe("");
  });
});

describe("samplePdfFilename", () => {
  it("names the file after the workflow and version", () => {
    expect(samplePdfFilename("Single-cell Spatial Profiling", 3)).toBe("Single-cell Spatial Profiling - sample output v3.pdf");
  });
  it("drops characters file systems refuse, and falls back without a name", () => {
    expect(samplePdfFilename('a/b: "c"?', null)).toBe("a b c - sample output.pdf");
    expect(samplePdfFilename("", 2)).toBe("Workflow - sample output v2.pdf");
  });
});

describe("downloadPdf", () => {
  const makeEnv = (fetchImpl) => {
    const anchor = { click: vi.fn(), remove: vi.fn() };
    return {
      anchor,
      fetch: vi.fn(fetchImpl),
      open: vi.fn(),
      setTimeout: vi.fn(),
      URL: { createObjectURL: vi.fn(() => "blob:x"), revokeObjectURL: vi.fn() },
      document: { createElement: vi.fn(() => anchor), body: { appendChild: vi.fn() } },
    };
  };
  it("saves the fetched PDF under the given name", async () => {
    const env = makeEnv(async () => ({ ok: true, blob: async () => "pdf" }));
    expect(await downloadPdf("https://cdn/x.pdf", "W - sample output v3.pdf", env)).toBe("saved");
    expect(env.anchor.download).toBe("W - sample output v3.pdf");
    expect(env.anchor.href).toBe("blob:x");
    expect(env.anchor.click).toHaveBeenCalled();
    expect(env.open).not.toHaveBeenCalled();
  });
  it("opens the PDF in a new tab where it can't be fetched (CORS, expired link)", async () => {
    const env = makeEnv(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await downloadPdf("https://cdn/x.pdf", "f.pdf", env)).toBe("opened");
    expect(env.open).toHaveBeenCalledWith("https://cdn/x.pdf", "_blank", "noopener");
    const notOk = makeEnv(async () => ({ ok: false, status: 403 }));
    expect(await downloadPdf("https://cdn/x.pdf", "f.pdf", notOk)).toBe("opened");
  });
});

describe("app wording", () => {
  it("names the app's limit and errors", () => {
    expect(limitSentence({ workflow: { used: 1, limit: 3 }, user: { used: 0, limit: 10 } }, "app")).toBe(
      "2 more sample outputs can be generated for this app today."
    );
    expect(setExampleError({ status: 403 }, undefined, "app")).toMatch(/owning the app/);
    expect(setExampleError({ status: 409, body: { message: "the run's results are still being packaged" } }, undefined, "app")).toMatch(/packaged/);
  });
});
