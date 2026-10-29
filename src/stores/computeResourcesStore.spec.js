import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";

vi.mock("@/composables/useGetToken", () => ({ useGetToken: vi.fn(async () => "token") }));

import { useComputeResourcesStore } from "./computeResourcesStore";
import * as siteConfig from "@/site-config/site.json";

const nodesUrl = `${siteConfig.api2Url}/compute/resources/compute-nodes`;

function respond(body) {
  return { ok: true, json: async () => body };
}

describe("compute resources store", () => {
  let fetch;

  beforeEach(() => {
    setActivePinia(createPinia());
    fetch = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetch.mockRestore();
  });

  it("lists the user's own nodes without a query, separately from account-owner", async () => {
    const personal = { uuid: "n1", name: "Mine" };
    fetch.mockResolvedValueOnce(respond({ nodes: [personal], latestVersion: "v1.10.0" }));

    const store = useComputeResourcesStore();
    const nodes = await store.fetchUserOwnedComputeNodes();

    expect(fetch).toHaveBeenCalledWith(nodesUrl, expect.objectContaining({ method: "GET" }));
    expect(nodes).toEqual([personal]);
    expect(store.getScopedComputeNodes("user-owned")).toEqual([personal]);
    expect(store.getScopedComputeNodes("account-owner")).toEqual([]);
  });

  it("still lists account-owner and workspace nodes with their queries", async () => {
    fetch.mockResolvedValue(respond({ nodes: [] }));
    const store = useComputeResourcesStore();

    await store.fetchComputeNodes(null);
    await store.fetchComputeNodes("N:organization:1");

    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      `${nodesUrl}?account_owner=true`,
      `${nodesUrl}?organization_id=N:organization:1`,
    ]);
  });

  it("asks for GPU tiers without organization_id when there is no organization", async () => {
    fetch.mockResolvedValueOnce(respond([{ key: "small" }]));
    const store = useComputeResourcesStore();

    await store.fetchGpuTiers(undefined);

    expect(fetch.mock.calls[0][0]).toBe(`${siteConfig.api2Url}/compute/resources/gpu-tiers`);
  });
});
