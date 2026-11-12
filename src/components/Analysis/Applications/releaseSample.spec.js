import { describe, it, expect } from "vitest";
import { pipelineBusy, publicUrl, releaseReportLine, releaseSample, releaseStages, stageReason } from "./releaseSample";

const ASSETS = "https://assets.pennsieve.net/";
const ready = {
  uuid: "ver-015",
  version: "v0.1.5",
  createdAt: "2026-11-11T22:40:00Z",
  status: "deployed",
  fixtures: { status: "ready", files: 7 },
  sampleRun: { status: "ready", durationSeconds: 10 },
  sample: {
    status: "ready",
    pages: 9,
    figures: 6,
    generatedAt: "2026-11-11T23:10:24Z",
    documentKey: "examples/apps/app-1/v0.1.5/76d7.pdf",
    public: { document: "public/apps/app-1/v0.1.5/76d7.pdf", preview: "public/apps/app-1/v0.1.5/76d7.preview.png", crate: "public/apps/app-1/v0.1.5/76d7.ro-crate-metadata.json" },
  },
};

describe("release pipeline stages", () => {
  it("shows the stages a version has, in order, with their tone", () => {
    const stages = releaseStages(ready, ASSETS);
    expect(stages.map((s) => [s.key, s.label, s.text, s.tone])).toEqual([
      ["fixtures", "Fixtures", "Ready", "green"],
      ["sampleRun", "Sample run", "Ready", "green"],
      ["sample", "Report", "Ready", "green"],
    ]);
    // The ready document links its public copy.
    expect(stages[2].href).toBe("https://assets.pennsieve.net/public/apps/app-1/v0.1.5/76d7.pdf");
    expect(stages[0].href).toBeUndefined();
  });

  it("says why a stage stopped short, for people", () => {
    const v = {
      fixtures: { status: "skipped", error: { code: "no_review_block", message: "app.yml has no review block" } },
      sampleRun: { status: "skipped", error: { code: "needs_hardware", message: "gpu" } },
    };
    const [f, r] = releaseStages(v);
    expect([f.tone, f.title]).toEqual(["gray", "the app's test inputs, bundled at release. Skipped: the app.yml has no review block (no test inputs declared)"]);
    expect(r.title).toContain("needs a GPU");
    expect(stageReason({ error: { code: "something_new", message: "the message" } })).toBe("the message");
    expect(stageReason({ status: "ready" })).toBe("");
    expect(releaseStages({ fixtures: { status: "failed", error: { code: "build_failed" } } })[0].tone).toBe("red");
    expect(releaseStages({ fixtures: { status: "building" } })[0].tone).toBe("blue");
  });

  it("has no stages for a version from before the pipeline", () => {
    expect(releaseStages({ uuid: "old", status: "deployed" })).toEqual([]);
    expect(releaseStages(null)).toEqual([]);
  });
});

describe("the app's sample document", () => {
  it("is the newest version's ready, public document, shaped for the sample card", () => {
    const older = { ...ready, uuid: "ver-014", version: "v0.1.4", createdAt: "2026-11-10T00:00:00Z" };
    const s = releaseSample([older, ready], ASSETS);
    expect(s).toEqual({
      pipeline: true,
      versionId: "ver-015",
      app: { tag: "v0.1.5" },
      pages: 9,
      figures: 6,
      createdAt: "2026-11-11T23:10:24Z",
      pdfUrl: "https://assets.pennsieve.net/public/apps/app-1/v0.1.5/76d7.pdf",
      previewUrl: "https://assets.pennsieve.net/public/apps/app-1/v0.1.5/76d7.preview.png",
      crateUrl: "https://assets.pennsieve.net/public/apps/app-1/v0.1.5/76d7.ro-crate-metadata.json",
    });
  });

  it("falls back to an older version's when the newest has none yet, and to nothing without public copies", () => {
    const newer = { uuid: "ver-016", version: "v0.1.6", createdAt: "2026-11-12T00:00:00Z", fixtures: { status: "building" } };
    expect(releaseSample([newer, ready], ASSETS)?.app.tag).toBe("v0.1.5");
    const privateDoc = { ...ready, sample: { ...ready.sample, public: undefined } };
    expect(releaseSample([privateDoc], ASSETS)).toBeNull();
    const failed = { ...ready, sample: { status: "failed", error: { code: "internal" } } };
    expect(releaseSample([failed], ASSETS)).toBeNull();
    expect(releaseSample([ready], "")).toBeNull();
    expect(releaseSample(undefined, ASSETS)).toBeNull();
  });

  it("joins the assets host and a key", () => {
    expect(publicUrl("https://assets.pennsieve.io", "/public/x.pdf")).toBe("https://assets.pennsieve.io/public/x.pdf");
    expect(publicUrl("", "public/x.pdf")).toBe("");
  });
});

describe("whether the pipeline is still at work", () => {
  const now = Date.parse("2026-11-11T23:00:00Z");
  it("is, while a stage runs, or between stages of a fresh release", () => {
    expect(pipelineBusy({ createdAt: "2026-11-11T22:40:00Z", fixtures: { status: "building" } }, now)).toBe(true);
    expect(pipelineBusy({ createdAt: "2026-11-11T22:40:00Z", fixtures: { status: "ready" }, sampleRun: { status: "running" } }, now)).toBe(true);
    expect(pipelineBusy({ createdAt: "2026-11-11T22:40:00Z", fixtures: { status: "ready" } }, now)).toBe(true);
    expect(pipelineBusy({ createdAt: "2026-11-11T22:40:00Z", fixtures: { status: "ready" }, sampleRun: { status: "ready" } }, now)).toBe(true);
  });
  it("is not, once every stage is recorded, or a release has waited too long for the next one", () => {
    expect(pipelineBusy(ready, now)).toBe(false);
    expect(pipelineBusy({ createdAt: "2026-11-11T22:40:00Z", fixtures: { status: "skipped" } }, now)).toBe(false);
    expect(pipelineBusy({ createdAt: "2026-11-11T22:40:00Z", fixtures: { status: "ready" }, sampleRun: { status: "failed" } }, now)).toBe(false);
    expect(pipelineBusy({ createdAt: "2026-11-01T00:00:00Z", fixtures: { status: "ready" } }, now)).toBe(false);
    expect(pipelineBusy({ createdAt: "2026-11-01T00:00:00Z", status: "deployed" }, now)).toBe(false);
  });
});

describe("releaseReportLine", () => {
  const assets = "https://assets.pennsieve.net";
  it("is a link once the report is ready", () => {
    const v = { fixtures: { status: "ready" }, sampleRun: { status: "ready" }, sample: { status: "ready", public: { document: "public/apps/a/v1/x.pdf" } } };
    expect(releaseReportLine(v, assets)).toEqual({ text: "Release report", tone: "link", href: "https://assets.pennsieve.net/public/apps/a/v1/x.pdf" });
  });
  it("says why there is none, and what is under way", () => {
    expect(releaseReportLine({ fixtures: { status: "ready" }, sampleRun: { status: "skipped", error: { code: "needs_hardware" } } }).text).toBe(
      "Release report: not made — needs a GPU, or more memory than the sample runner has"
    );
    expect(releaseReportLine({ fixtures: { status: "ready" }, sampleRun: { status: "skipped", error: { code: "patch_release", message: "a patch release: v1.0.3 keeps the release report of v1.0.2" } } })).toEqual({
      text: "Release report: not made — a patch release; the report of the earlier release in its line stands",
      tone: "muted",
    });
    expect(releaseReportLine({ fixtures: { status: "failed", error: { code: "generator_failed", message: "generator exited 1" } } })).toEqual({
      text: "Release report: failed — generator exited 1",
      tone: "warn",
    });
    expect(releaseReportLine({ fixtures: { status: "building" } }).text).toBe("Release report: building the test inputs…");
    expect(releaseReportLine({ fixtures: { status: "ready" }, sampleRun: { status: "running", source: "node" } }).text).toBe(
      "Release report: running the sample on a compute node of the owner's…"
    );
    expect(releaseReportLine({ fixtures: { status: "ready" }, sampleRun: { status: "ready" } }).text).toBe("Release report: writing…");
    expect(releaseReportLine({ fixtures: { status: "ready" }, sampleRun: { status: "ready" }, sample: { status: "running" } }).text).toBe("Release report: writing…");
  });
  it("is nothing for a version from before the pipeline", () => {
    expect(releaseReportLine({ version: "v0.1.0" })).toBeNull();
    expect(releaseReportLine(null)).toBeNull();
  });
});
