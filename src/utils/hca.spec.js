import { describe, it, expect, vi } from "vitest";
import {
  hcaProjectTitles,
  searchHcaTitles,
  hcaProjects,
  hcaFormats,
  hcaFiles,
  defaultFormats,
  hcaFileNames,
  hcaFolder,
  createHcaView,
} from "./hca";

const respond = (body, status = 200) => vi.fn().mockResolvedValue({ ok: status < 300, status, json: () => Promise.resolve(body) });
const filtersOf = (fetchFn, call = 0) => JSON.parse(new URL(fetchFn.mock.calls[call][0]).searchParams.get("filters"));

describe("the Human Cell Atlas", () => {
  it("lists open-access projects' titles, with the filters' choices", async () => {
    const fetchFn = respond({
      pagination: { total: 58 },
      termFacets: {
        projectTitle: { terms: [{ term: "Lung atlas" }, { term: "A lung study" }] },
        genusSpecies: { terms: [{ term: "Homo sapiens" }] },
        organ: { terms: [{ term: "lung" }, { term: null }] },
        libraryConstructionApproach: { terms: [{ term: "10x 3' v3" }] },
      },
    });
    const res = await hcaProjectTitles({ species: "Homo sapiens", organ: "lung" }, { fetchFn });
    expect(filtersOf(fetchFn)).toEqual({ accessible: { is: [true] }, genusSpecies: { is: ["Homo sapiens"] }, organ: { is: ["lung"] } });
    expect(res).toMatchObject({ titles: ["A lung study", "Lung atlas"], total: 58, organs: ["lung"], assays: ["10x 3' v3"] });
    expect(searchHcaTitles(res.titles, "lung ATLAS")).toEqual(["Lung atlas"]);
  });

  it("reads the projects shown, in their order", async () => {
    const hit = (title, id) => ({
      projects: [{ projectId: id, projectTitle: title, projectShortname: `${id}-short`, estimatedCellCount: 9 }],
      donorOrganisms: [{ genusSpecies: ["Homo sapiens"] }],
      samples: [{ organ: ["lung"], disease: ["normal", "COVID-19"] }],
      protocols: [{ libraryConstructionApproach: ["10x 3' v3"] }, { instrumentManufacturerModel: ["x"] }],
    });
    const fetchFn = respond({ hits: [hit("B", "b1"), hit("A", "a1")] });
    const projects = await hcaProjects(["A", "B"], { fetchFn });
    expect(filtersOf(fetchFn).projectTitle).toEqual({ is: ["A", "B"] });
    expect(projects.map((p) => p.id)).toEqual(["a1", "b1"]);
    expect(projects[0]).toMatchObject({ shortname: "a1-short", species: ["Homo sapiens"], organs: ["lung"], assays: ["10x 3' v3"], diseases: ["COVID-19"] });
  });

  it("lists a project's files of the formats chosen, raw reads left out to start with", async () => {
    const formats = await hcaFormats("p1", { fetchFn: respond({ termFacets: { fileFormat: { terms: [{ term: "fastq.gz", count: 900 }, { term: "h5ad", count: 2 }] } } }) });
    expect(defaultFormats(formats)).toEqual(["h5ad"]);
    const fetchFn = respond({
      hits: [
        { files: [{ uuid: "f1", name: "atlas.h5ad", format: "h5ad", size: 5, sha256: "aa", contentDescription: ["Matrix"] }] },
        { files: [{ uuid: "f2", name: "nosha.h5ad", format: "h5ad" }] },
      ],
      pagination: { next: "https://next" },
    });
    const page = await hcaFiles("p1", ["h5ad"], { fetchFn });
    expect(filtersOf(fetchFn)).toMatchObject({ projectId: { is: ["p1"] }, fileFormat: { is: ["h5ad"] } });
    expect(page.files).toEqual([{ id: "f1", name: "atlas.h5ad", format: "h5ad", size: 5, sha256: "aa", content: "Matrix", matrix: true }]);
    expect(page.next).toBe("https://next");
  });

  it("makes a view of each project's files, by their keys, under their names, in its folder", async () => {
    const files = [
      { id: "11111111-x", name: "matrix.h5ad", sha256: "aa" },
      { id: "22222222-x", name: "matrix.h5ad", sha256: "bb" },
      { id: "33333333-x", name: "cells.loom", sha256: "cc" },
    ];
    expect(hcaFileNames(files)).toEqual({ "aa.sha256": "matrix (11111111).h5ad", "bb.sha256": "matrix (22222222).h5ad", "cc.sha256": "cells.loom" });
    expect(hcaFolder({ id: "p1", shortname: "Lung/Airway atlas" })).toBe("Lung-Airway atlas");
    const create = vi.fn().mockResolvedValue({ id: "v" });
    await createHcaView([{ id: "p1", title: "Lung atlas", shortname: "LungAtlas", files: files.slice(2) }], { create });
    expect(create).toHaveBeenCalledWith({
      dataset: "humancellatlas",
      name: "HCA: Lung atlas",
      groups: [{ prefix: "file/", paths: ["cc.sha256"], names: { "cc.sha256": "cells.loom" }, folder: "LungAtlas" }],
    });
  });
});
