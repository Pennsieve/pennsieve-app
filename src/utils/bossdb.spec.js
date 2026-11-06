import { describe, it, expect, vi } from "vitest";
import { bossdbCollections, searchBossdb, bossdbExperiments, bossdbChannels, countBossdb } from "./bossdb";

// BossDB's API, as it answers (abridged), by path.
const api = {
  "/collection/": { collections: ["witvliet2020", "Kasthuri", "not_in_bucket", "kasthuri2015"] },
  "/collection/witvliet2020/": { name: "witvliet2020", experiments: ["Dataset_2", "Dataset_1", "Dataset_10"] },
  "/collection/witvliet2020/experiment/Dataset_1/": {
    name: "Dataset_1",
    description: "ATUM-SEM volume of a C. elegans L1 larva brain.",
    channels: ["em", "segmentation", "elsewhere"],
    num_hierarchy_levels: 4,
  },
  "/collection/witvliet2020/experiment/Dataset_2/": { name: "Dataset_2", channels: ["em"] },
  "/collection/witvliet2020/experiment/Dataset_1/channel/em/": {
    name: "em", type: "image", datatype: "uint8", bucket: "bossdb-open-data", cv_path: "witvliet2020/Dataset_1/em",
  },
  "/collection/witvliet2020/experiment/Dataset_1/channel/segmentation/": {
    name: "segmentation", type: "annotation", datatype: "uint64", bucket: "bossdb-open-data", cv_path: "/witvliet2020/Dataset_1/segmentation/",
  },
  "/collection/witvliet2020/experiment/Dataset_1/channel/elsewhere/": { name: "elsewhere", type: "image", storage_type: "spdb" },
};
const fetchFn = vi.fn((url, init) => {
  const path = url.replace("https://api.bossdb.io/v1", "");
  const body = api[path];
  return Promise.resolve({ ok: !!body, status: body ? 200 : 404, json: () => Promise.resolve(body || { detail: "Not found" }), init });
});
const listFolder = vi.fn().mockResolvedValue({ folders: ["Kasthuri", "kasthuri2015", "witvliet2020", "zhang2025"] });

describe("BossDB", () => {
  it("lists the public collections that are in the Open Data bucket", async () => {
    expect(await bossdbCollections({ fetchFn, listFolder })).toEqual(["Kasthuri", "kasthuri2015", "witvliet2020"]);
    expect(fetchFn.mock.calls[0][1].headers.Authorization).toBe("Token public");
    expect(listFolder).toHaveBeenCalledWith({ dataset: "bossdb" });
    expect(await countBossdb({ fetchFn, listFolder })).toBe(3);
  });

  it("searches collections by name", () => {
    expect(searchBossdb(["Kasthuri", "kasthuri2015", "witvliet2020"], " KAST 2015 ")).toEqual(["kasthuri2015"]);
    expect(searchBossdb(["a", "b"], "")).toEqual(["a", "b"]);
  });

  it("describes a collection's experiments, in order", async () => {
    const list = await bossdbExperiments("witvliet2020", { fetchFn });
    expect(list.map((e) => e.name)).toEqual(["Dataset_1", "Dataset_2", "Dataset_10"]);
    expect(list[0]).toEqual({ name: "Dataset_1", description: "ATUM-SEM volume of a C. elegans L1 larva brain.", channels: ["em", "segmentation", "elsewhere"], levels: 4 });
    // One BossDB couldn't describe is still listed.
    expect(list[2]).toEqual({ name: "Dataset_10", description: "", channels: [], levels: 0 });
  });

  it("offers only the channels stored in the Open Data bucket, with their folders", async () => {
    const channels = await bossdbChannels("witvliet2020", "Dataset_1", ["em", "segmentation", "elsewhere"], { fetchFn });
    expect(channels).toEqual([
      { name: "em", type: "image", datatype: "uint8", description: "", path: "witvliet2020/Dataset_1/em/" },
      { name: "segmentation", type: "segmentation", datatype: "uint64", description: "", path: "witvliet2020/Dataset_1/segmentation/" },
    ]);
  });
});
