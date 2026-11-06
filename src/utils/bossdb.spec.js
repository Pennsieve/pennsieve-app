import { describe, it, expect, vi } from "vitest";
import { bossdbCollections, searchBossdb, bossdbExperiments, bossdbChannels, countBossdb, addPick, bossdbViewName } from "./bossdb";

// BossDB's API, as it answers the public token (abridged), by path: it
// can't read every public experiment.
const api = {
  "/collection/witvliet2020/experiment/Dataset_1/": {
    name: "Dataset_1",
    description: "ATUM-SEM volume of a C. elegans L1 larva brain.",
    channels: ["em", "segmentation"],
    num_hierarchy_levels: 4,
  },
  "/collection/witvliet2020/experiment/Dataset_1/channel/em/": { name: "em", type: "image", datatype: "uint8" },
  "/collection/witvliet2020/experiment/Dataset_1/channel/segmentation/": { name: "segmentation", type: "annotation", datatype: "uint64" },
};
const fetchFn = vi.fn((url) => {
  const body = api[url.replace("https://api.bossdb.io/v1", "")];
  return Promise.resolve({
    ok: !!body,
    status: body ? 200 : 403,
    json: () => Promise.resolve(body || { status: 403, message: "Missing read permissions on the resource" }),
  });
});
// The Open Data bucket's folders, by prefix.
const bucket = {
  "": ["witvliet2020/", "Kasthuri/", "alonso-nanclares2024/"],
  "witvliet2020/": ["Dataset_2", "Dataset_1", "Dataset_10"],
  "witvliet2020/Dataset_1/": ["segmentation", "em"],
  "alonso-nanclares2024/AB2/": ["MEC_L1_S1_REG"],
};
const listFolder = vi.fn(({ prefix = "" }) => Promise.resolve({ folders: bucket[prefix] || [] }));

describe("BossDB", () => {
  it("lists the collections in the Open Data bucket", async () => {
    expect(await bossdbCollections({ listFolder })).toEqual(["alonso-nanclares2024", "Kasthuri", "witvliet2020"]);
    expect(listFolder).toHaveBeenCalledWith({ dataset: "bossdb" });
    expect(await countBossdb({ listFolder })).toBe(3);
  });

  it("searches collections by name", () => {
    expect(searchBossdb(["Kasthuri", "kasthuri2015", "witvliet2020"], " KAST 2015 ")).toEqual(["kasthuri2015"]);
    expect(searchBossdb(["a", "b"], "")).toEqual(["a", "b"]);
  });

  it("lists a collection's experiments from the bucket, described where the API can", async () => {
    const list = await bossdbExperiments("witvliet2020", { fetchFn, listFolder });
    expect(list.map((e) => e.name)).toEqual(["Dataset_1", "Dataset_2", "Dataset_10"]);
    expect(list[0]).toEqual({ name: "Dataset_1", description: "ATUM-SEM volume of a C. elegans L1 larva brain.", channels: ["em", "segmentation"], levels: 4 });
    expect(fetchFn.mock.calls[0][1].headers.Authorization).toBe("Token public");
    // One the public token can't read is listed without.
    expect(list[1]).toEqual({ name: "Dataset_2", description: "", channels: null, levels: 0 });
  });

  it("lists an experiment's channels from the bucket, typed where the API can", async () => {
    expect(await bossdbChannels("witvliet2020", "Dataset_1", { fetchFn, listFolder })).toEqual([
      { name: "em", type: "image", datatype: "uint8", description: "", path: "witvliet2020/Dataset_1/em/" },
      { name: "segmentation", type: "segmentation", datatype: "uint64", description: "", path: "witvliet2020/Dataset_1/segmentation/" },
    ]);
    expect(await bossdbChannels("alonso-nanclares2024", "AB2", { fetchFn, listFolder })).toEqual([
      { name: "MEC_L1_S1_REG", type: "", datatype: "", description: "", path: "alonso-nanclares2024/AB2/MEC_L1_S1_REG/" },
    ]);
  });
});

describe("BossDB picks", () => {
  const em1 = { prefix: "witvliet2020/Dataset_1/em/", label: "witvliet2020 · Dataset_1 · em" };
  const em2 = { prefix: "witvliet2020/Dataset_2/em/", label: "witvliet2020 · Dataset_2 · em" };
  const whole = { prefix: "witvliet2020/", label: "witvliet2020 (whole collection)" };
  const other = { prefix: "Kasthuri/", label: "Kasthuri (whole collection)" };

  it("adds a pick, dropping those inside it; one inside a pick is already in", () => {
    let picks = addPick(addPick([], em1), em2);
    expect(picks).toEqual([em1, em2]);
    picks = addPick(picks, whole);
    expect(picks).toEqual([whole]);
    expect(addPick(picks, em1)).toBe(picks);
    // A prefix of a name isn't a folder above it.
    expect(addPick([{ prefix: "witvliet2020/Dataset_1/" }], { prefix: "witvliet2020/Dataset_10/" })).toHaveLength(2);
  });

  it("names a view after what's chosen", () => {
    expect(bossdbViewName([em1])).toBe("BossDB: witvliet2020 · Dataset_1 · em");
    expect(bossdbViewName([em1, em2])).toBe("BossDB: witvliet2020 (2 selections)");
    expect(bossdbViewName([whole, other])).toBe("BossDB: 2 collections (2 selections)");
  });
});
