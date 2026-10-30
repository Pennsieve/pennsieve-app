import { describe, it, expect } from "vitest";
import {
  STATUS_EVENT,
  VARIANT_STATUS_EVENT,
  parseStatus,
  recordStatusEvent,
  versionBuilding,
  versionsToWatch,
  withLiveStatus,
} from "./liveStatus";
import { releaseProgress, versionVariants } from "./versionVariants";

// DynaSD v0.3.0 being built: the version (cpu, the default) and its gpu
// variant registering. As the API lists it (variants as a list).
const app = () => ({
  uuid: "app-1",
  versions: [
    { uuid: "ver-022", version: "v0.2.2", createdAt: "2026-10-01", status: "deployed", manifest: {} },
    {
      uuid: "ver-030",
      version: "v0.3.0",
      createdAt: "2026-10-29",
      status: "registering",
      manifest: {},
      defaultVariant: "cpu",
      variants: [
        { id: "cpu", name: "CPU", default: true, status: "registering" },
        { id: "gpu", name: "GPU", default: false, status: "registering" },
      ],
    },
  ],
});
// An event as the status lambda publishes it (app-deploy-service #209).
const event = (status, variant, extra = {}) => ({
  application_id: "ver-030",
  deployment_id: "dep",
  status,
  is_error: status.startsWith("error"),
  source: "DeployTaskStateChangeHandler",
  ...(variant && { variant }),
  ...extra,
});
const v030 = (a) => a.versions.find((v) => v.uuid === "ver-030");

describe("live build status", () => {
  it("reads a failure's reason from the status, or from the event", () => {
    expect(parseStatus({ status: "error: target cuda not found", is_error: true })).toEqual({ status: "error", failureReason: "target cuda not found" });
    expect(parseStatus({ status: "error", failureReason: "OOM" })).toEqual({ status: "error", failureReason: "OOM" });
    expect(parseStatus({ status: "deployed" })).toEqual({ status: "deployed", failureReason: "" });
  });

  it("moves only the variant on a variant's event: a failed GPU build leaves the version as it is", () => {
    const live = recordStatusEvent({}, VARIANT_STATUS_EVENT, event("error: no space left", "gpu"));
    const shown = v030(withLiveStatus(app(), live));
    expect(shown.status).toBe("registering");
    expect(shown.variants.map((v) => [v.id, v.status, v.failureReason || ""])).toEqual([
      ["cpu", "registering", ""],
      ["gpu", "error", "no space left"],
    ]);
  });

  it("moves the version, and its default variant, on the version's event", () => {
    let live = recordStatusEvent({}, VARIANT_STATUS_EVENT, event("error: no space left", "gpu"));
    live = recordStatusEvent(live, STATUS_EVENT, event("deployed", "cpu"));
    const shown = v030(withLiveStatus(app(), live));
    expect(shown.status).toBe("deployed");
    expect(shown.variants.map((v) => [v.id, v.status])).toEqual([
      ["cpu", "deployed"],
      ["gpu", "error"],
    ]);
  });

  it("keeps updating a version without variants as before", () => {
    const plain = { versions: [{ uuid: "ver-1", version: "v1", status: "registering" }] };
    const live = recordStatusEvent({}, STATUS_EVENT, { application_id: "ver-1", status: "deployed" });
    expect(withLiveStatus(plain, live).versions[0]).toEqual({ uuid: "ver-1", version: "v1", status: "deployed", variants: undefined });
  });

  it("ignores other events, events without a version, and variant events without a variant", () => {
    const live = {};
    expect(recordStatusEvent(live, "something-else", event("deployed"))).toBe(live);
    expect(recordStatusEvent(live, STATUS_EVENT, { status: "deployed" })).toBe(live);
    expect(recordStatusEvent(live, VARIANT_STATUS_EVENT, event("deployed"))).toBe(live);
    const a = app();
    expect(withLiveStatus(a, live)).toBe(a);
  });

  it("lays statuses over variants stored as a map too", () => {
    const a = app();
    v030(a).variants = { cpu: { name: "CPU", status: "registering" }, gpu: { name: "GPU", status: "registering" } };
    v030(a).variantOrder = ["cpu", "gpu"];
    const live = recordStatusEvent({}, VARIANT_STATUS_EVENT, event("deployed", "gpu"));
    expect(v030(withLiveStatus(a, live)).variants.gpu.status).toBe("deployed");
    expect(versionVariants(withLiveStatus(a, live), "v0.3.0").map((v) => v.status)).toEqual(["registering", "deployed"]);
  });

  it("listens to the versions still building, and lets them go when done", () => {
    const a = app();
    expect(versionsToWatch(a)).toEqual(["ver-030"]);
    expect(versionsToWatch(a, { latest: true })).toEqual(["ver-030"]);
    let live = recordStatusEvent({}, STATUS_EVENT, event("deployed", "cpu"));
    // The gpu build is still going.
    expect(versionsToWatch(withLiveStatus(a, live))).toEqual(["ver-030"]);
    live = recordStatusEvent(live, VARIANT_STATUS_EVENT, event("deployed", "gpu"));
    expect(versionsToWatch(withLiveStatus(a, live))).toEqual([]);
    // No status recorded isn't a build under way.
    expect(versionBuilding({ status: "deployed", variants: [{ id: "x", status: "" }] })).toBe(false);
  });
});

describe("release progress, polled", () => {
  it("reads each variant's status from versions[].variants[].status, the version's own staying apart", () => {
    const a = app();
    v030(a).status = "deployed";
    v030(a).variants[0].status = "deployed";
    v030(a).variants[1] = { ...v030(a).variants[1], status: "error", failureReason: "target cuda not found" };
    const p = releaseProgress(a, "v0.3.0");
    expect(p.done).toBe(true);
    expect(p.rows.map((r) => [r.id, r.status, r.failureReason])).toEqual([
      ["cpu", "deployed", ""],
      ["gpu", "error", "target cuda not found"],
    ]);
    expect(v030(a).status).toBe("deployed");
  });

  it("follows live events between polls", () => {
    const live = recordStatusEvent({}, VARIANT_STATUS_EVENT, event("deployed", "gpu"));
    const p = releaseProgress(withLiveStatus(app(), live), "v0.3.0");
    expect(p.rows.map((r) => r.status)).toEqual(["registering", "deployed"]);
    expect(p.done).toBe(false);
  });
});
