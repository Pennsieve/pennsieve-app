import { describe, it, expect } from "vitest";
import {
  routedOutputs,
  portHandleId,
  portOfHandle,
  canConnectFromHandle,
  withPortPrefix,
  withoutPortPrefix,
  prefixParamOf,
  portForLoadedLink,
  attachPorts,
} from "./outputPorts";

const two = { outputs: [{ name: "nwb" }, { name: "figures" }] };
const one = { outputs: [{ name: "nwb" }] };
const app = (ports, id = "a") => ({ id, type: "default", data: { manifestPorts: ports } });
const target = (params, id = "t") => ({ id, type: "data-target", data: { defaultParams: params } });

describe("output ports", () => {
  it("are offered for two or more declared outputs only", () => {
    expect(routedOutputs(two).map((p) => p.name)).toEqual(["nwb", "figures"]);
    expect(routedOutputs(one)).toEqual([]);
    expect(routedOutputs(undefined)).toEqual([]);
  });

  it("round-trip through handle ids", () => {
    expect(portOfHandle(portHandleId("nwb"))).toBe("nwb");
    expect(portOfHandle("source")).toBe("");
    expect(portOfHandle(null)).toBe("");
  });

  it("connect to data targets only, from an output the app declares", () => {
    expect(canConnectFromHandle(app(two), target(), portHandleId("nwb"))).toBe(true);
    expect(canConnectFromHandle(app(two), app(one, "b"), portHandleId("nwb"))).toBe(false);
    expect(canConnectFromHandle(app(two), target(), portHandleId("missing"))).toBe(false);
    // The step's single point connects anywhere, as before.
    expect(canConnectFromHandle(app(two), app(one, "b"), "source")).toBe(true);
  });

  it("set the target's PATH_PREFIX, and clear only the one they set", () => {
    expect(withPortPrefix({ DATASET: "d" }, "nwb")).toEqual({ DATASET: "d", PATH_PREFIX: "nwb" });
    expect(withoutPortPrefix({ PATH_PREFIX: "nwb" }, "nwb")).toEqual({});
    expect(withoutPortPrefix({ PATH_PREFIX: "other" }, "nwb")).toEqual({ PATH_PREFIX: "other" });
    expect(withPortPrefix({}, "nwb", "pathPrefix")).toEqual({ pathPrefix: "nwb" });
    expect(withoutPortPrefix({ pathPrefix: "nwb" }, "nwb")).toEqual({});
  });

  it("use the prefix parameter the target type declares", () => {
    expect(prefixParamOf([{ name: "DATASET_ID" }, { name: "PATH_PREFIX" }])).toBe("PATH_PREFIX");
    expect(prefixParamOf([{ name: "pathPrefix" }])).toBe("pathPrefix");
    expect(prefixParamOf([{ name: "DATASET_ID" }])).toBe("");
    expect(portForLoadedLink(app(two), target({ pathPrefix: "figures" }))).toBe("figures");
  });

  it("are found again on load from the target's prefix", () => {
    expect(portForLoadedLink(app(two), target({ PATH_PREFIX: "figures" }))).toBe("figures");
    expect(portForLoadedLink(app(two), target({ PATH_PREFIX: "/figures/" }))).toBe("figures");
    expect(portForLoadedLink(app(two), target({ PATH_PREFIX: "elsewhere" }))).toBe("");
    expect(portForLoadedLink(app(one), target({ PATH_PREFIX: "nwb" }))).toBe("");
    const edges = attachPorts(
      [{ id: "e", source: "a", target: "t" }, { id: "f", source: "a", target: "b" }],
      [app(two), target({ PATH_PREFIX: "nwb" }), app(one, "b")],
    );
    expect(edges[0].sourceHandle).toBe("out:nwb");
    expect(edges[1].sourceHandle).toBeUndefined();
  });
});
