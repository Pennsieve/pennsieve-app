import { describe, it, expect, vi } from "vitest";
import { searchCellxgene, cellxgeneOrganisms, cellxgeneViewName, cellxgeneFolderName, countCellxgene } from "./cellxgene";

const ds = (id, title, collectionName, more = {}) => ({
  id, title, collectionName, file: `${id}.h5ad`, size: 10,
  organisms: ["Homo sapiens"], tissues: [], assays: [], diseases: [], ...more,
});
const lung = ds("a1", "Lung epithelium", "Human Lung Cell Atlas", { tissues: ["lung"] });
const heart = ds("b2", "Cardiomyocytes", "Heart atlas", { tissues: ["heart left ventricle"], diseases: ["dilated cardiomyopathy"] });
const mouse = ds("c3", "Mouse lung", "Tabula Muris", { organisms: ["Mus musculus"], tissues: ["lung"] });

describe("CELLxGENE", () => {
  it("searches titles, collections, tissues and diseases; title or collection matches first", () => {
    expect(searchCellxgene([heart, mouse, lung], "lung").map((d) => d.id)).toEqual(["c3", "a1"]);
    expect(searchCellxgene([mouse, lung], "lung atlas").map((d) => d.id)).toEqual(["a1"]);
    expect(searchCellxgene([heart, lung], "cardiomyopathy").map((d) => d.id)).toEqual(["b2"]);
    expect(searchCellxgene([lung, heart, mouse], "", "Mus musculus").map((d) => d.id)).toEqual(["c3"]);
  });

  it("lists organisms, most datasets first", () => {
    expect(cellxgeneOrganisms([lung, heart, mouse])).toEqual(["Homo sapiens", "Mus musculus"]);
  });

  it("names views and folders after the picks", () => {
    expect(cellxgeneViewName([lung])).toBe("CELLxGENE: Lung epithelium");
    expect(cellxgeneViewName([lung, { ...heart, collectionName: "Human Lung Cell Atlas" }])).toBe("CELLxGENE: Human Lung Cell Atlas (2 datasets)");
    expect(cellxgeneViewName([lung, heart])).toBe("CELLxGENE: 2 datasets");
    expect(cellxgeneFolderName([lung])).toBe("Lung epithelium");
    expect(cellxgeneFolderName([lung, heart, mouse])).toBe("3-datasets");
  });

  it("counts the datasets offered", async () => {
    const load = vi.fn().mockResolvedValue({ datasets: [lung, heart] });
    expect(await countCellxgene({ load })).toBe(2);
  });
});

describe("a CELLxGENE view", () => {
  it("is the release's folder, naming the files picked", async () => {
    const load = vi.fn().mockResolvedValue({ openDataset: "biohub-cellxgene-census", prefix: "2025-01-30/h5ads/" });
    const create = vi.fn().mockResolvedValue({ id: "v1" });
    const { createCellxgeneView } = await import("./cellxgene");
    await createCellxgeneView([lung, heart], { load, create });
    expect(create).toHaveBeenCalledWith({
      dataset: "biohub-cellxgene-census",
      name: "CELLxGENE: 2 datasets",
      groups: [{ prefix: "2025-01-30/h5ads/", paths: ["a1.h5ad", "b2.h5ad"] }],
    });
  });
});
