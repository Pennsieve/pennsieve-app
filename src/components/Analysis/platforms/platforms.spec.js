import { describe, it, expect, vi } from "vitest";

vi.mock("@/utils/viewsService", async (orig) => ({
  ...(await orig()),
  createOpenDataView: vi.fn((args) => Promise.resolve({ id: "v1", version: 1, args })),
  createOpenDataViewOf: vi.fn((args) => Promise.resolve({ id: "v2", version: 1, args })),
  createDandiView: vi.fn((args) => Promise.resolve({ id: "v3", version: 1, args })),
  viewForDataset: vi.fn((args) => Promise.resolve({ id: "v4", version: 1, args })),
}));

import { PLATFORMS, PLATFORM_KEYS, platformData, platformReading } from "./index";

const GiB = 2 ** 30;
const SHAPE = [
  "key", "name", "desc", "noun", "mark", "title", "intro", "picker", "selection", "ready", "label", "sameAs",
  "createView", "folderName", "count", "regions", "size", "imaging", "publicBucket", "reads",
];

describe("the data platforms", () => {
  it("each give the whole platform shape, under their key", () => {
    for (const key of PLATFORM_KEYS) {
      const p = PLATFORMS[key];
      expect(p.key).toBe(key);
      for (const field of SHAPE) expect(p[field], `${key}.${field}`).toBeDefined();
      expect(p.viewName || p.sameLabel, `${key} names a duplicate`).toBeDefined();
      expect(p.ready(p.selection()), `${key} empty`).toBe(false);
      expect(p.label(p.selection()), `${key} empty label`).toBe("");
    }
  });

  it("are listed in order", () => {
    expect(PLATFORM_KEYS).toEqual(["discover", "openData", "sparc", "epilepsyScience", "openNeuro", "bossdb", "dandi", "physionet", "allen", "cellxgene", "encode"]);
  });

  it("say where their data lives, and which nodes can reach it", () => {
    const at = (key, part) => platformData(key, { ...PLATFORMS[key].selection(), ...part });
    expect(at("openNeuro").regions).toEqual(["us-east-1"]);
    expect(at("sparc").regions).toEqual(["us-east-1"]);
    expect(at("epilepsyScience").regions).toEqual(["us-east-1"]);
    expect(at("physionet").regions).toEqual(["us-east-1"]);
    expect(at("bossdb").regions).toEqual(["us-east-1"]);
    expect(at("dandi").regions).toEqual(["us-east-2"]);
    expect(at("openData", { dataset: { regions: ["us-west-2"] } }).regions).toEqual(["us-west-2"]);
    expect(at("allen", { dataset: { regions: ["us-west-2"] } }).regions).toEqual(["us-west-2"]);
    expect(at("discover").regions).toEqual([]);
    expect(at("discover").publicBucket).toBe(false);
    for (const k of ["openData", "sparc", "openNeuro", "bossdb", "dandi", "physionet", "allen"]) expect(at(k).publicBucket, k).toBe(true);
    expect(platformData("nope", {})).toEqual({ regions: [], size: null, imaging: false, publicBucket: false });
  });

  it("know the data's size where they can", () => {
    const at = (key, part) => platformData(key, { ...PLATFORMS[key].selection(), ...part }).size;
    expect(at("openNeuro", { dataset: { size: 5 * GiB } })).toBe(5 * GiB);
    expect(at("dandi", { dataset: { size: 7 * GiB } })).toBe(7 * GiB);
    expect(at("discover", { dataset: { size: 3 } })).toBe(3);
    expect(at("openData", { dataset: {} })).toBeNull();
  });

  it("tell imaging data", () => {
    const at = (key, part) => platformData(key, { ...PLATFORMS[key].selection(), ...part }).imaging;
    expect(at("openNeuro", { dataset: { modalities: ["mri"] } })).toBe(true);
    expect(at("openNeuro", { dataset: { modalities: ["eeg"] } })).toBe(false);
    expect(at("openData", { dataset: { keywords: ["biology", "Imaging"] } })).toBe(true);
    expect(at("allen", { dataset: { keywords: ["neurobiology", "imaging"] } })).toBe(true);
    expect(at("sparc", { dataset: { keywords: ["mouse", "microscopy"] } })).toBe(true);
    expect(at("epilepsyScience", { dataset: { keywords: ["ieeg"] } })).toBe(false);
    expect(at("discover")).toBe(false);
  });

  it("make a view of what's chosen", async () => {
    const d = { name: "afdb", title: "MIT-BIH Atrial Fibrillation Database" };
    const view = await PLATFORMS.physionet.createView({ dataset: d, prefix: "1.0.0/" });
    expect(view.args).toEqual({ dataset: "afdb", title: d.title, prefix: "1.0.0/" });
    const picks = [{ prefix: "witvliet2020/Dataset_1/em/", label: "em" }];
    expect((await PLATFORMS.bossdb.createView({ picks })).args.prefixes).toEqual(["witvliet2020/Dataset_1/em/"]);
    const ds = { id: 42, version: 3, name: "Rat heart" };
    expect((await PLATFORMS.discover.createView({ dataset: ds, version: 3 })).args).toEqual({ datasetId: 42, version: 3, name: "Rat heart" });
  });

  it("name the session's folder and tell the same files", () => {
    const on = { dataset: { id: "ds000001", name: "Balloon task" }, prefix: "ds000001/" };
    expect(PLATFORMS.openNeuro.folderName(on, 1)).toBe("openneuro-ds000001");
    expect(PLATFORMS.openNeuro.folderName(on, 2)).toBe("openneuro-ds000001-2");
    expect(PLATFORMS.openNeuro.sameAs(on, { openDataset: "openneuro", viewName: "Balloon task (ds000001/)" })).toBe(true);
    expect(PLATFORMS.openNeuro.sameAs(on, { openDataset: "openneuro", viewName: "Other" })).toBe(false);
    const disc = { dataset: { id: 42, name: "Rat heart" }, version: 3 };
    expect(PLATFORMS.discover.folderName(disc, 1)).toBe("dataset-42-v3");
    expect(PLATFORMS.discover.sameAs(disc, { sourceDatasetId: 42, sourceVersion: 3 })).toBe(true);
    expect(PLATFORMS.discover.sameLabel(disc)).toBe("Version 3 of Rat heart");
    expect(PLATFORMS.dandi.folderName({ dataset: { id: "000003", version: "draft" }, prefix: "" }, 1)).toBe("dandiarchive-000003");
    const lung = { id: "a1", title: "Lung / epithelium", file: "a1.h5ad", size: 5, collectionName: "HLCA" };
    expect(PLATFORMS.cellxgene.folderName({ picks: [lung] }, 1)).toBe("cellxgene-Lung-epithelium");
    expect(PLATFORMS.cellxgene.label({ picks: [lung] })).toBe("CELLxGENE: Lung / epithelium");
    const exp = { accession: "ENCSR000AKP", assay: "RNA-seq", files: [{ key: "a/ENCFF1.bam", size: 3 }] };
    expect(PLATFORMS.encode.folderName({ picks: [exp] }, 1)).toBe("encode-ENCSR000AKP");
    expect(PLATFORMS.encode.folderName({ picks: [exp, exp] }, 1)).toBe("encode-2-experiments");
    expect(platformData("encode", { picks: [exp] })).toMatchObject({ regions: ["us-west-2"], size: 3, publicBucket: true });
    expect(platformData("cellxgene", { picks: [lung, { ...lung, id: "b2", size: 7 }] })).toMatchObject({ regions: ["us-west-2"], size: 12, publicBucket: true });
  });

  it("name the Open Data entries that are their own", () => {
    expect(platformReading("openneuro")?.name).toBe("OpenNeuro");
    expect(platformReading("epilepsy-science")?.name).toBe("Epilepsy.Science");
    expect(platformReading("dandiarchive")?.name).toBe("DANDI");
    expect(platformReading("allen-mouse-brain-atlas")?.name).toBe("Allen Institute");
    expect(platformReading("1000-genomes")).toBeNull();
    expect(platformReading("")).toBeNull();
  });
});
