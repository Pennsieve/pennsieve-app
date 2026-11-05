import { describe, it, expect, vi } from "vitest";
import { manifestHead, portalDataset, portalDatasetIds, searchPortal, toPortalDataset } from "./openDataPortals";

// The start of a manifest as the bucket has it: its description, then its
// file list.
const manifest = `{
  "pennsieveDatasetId" : 704,
  "version" : 1,
  "name" : "Lower urinary tract vasculature",
  "description" : "3D visualization",
  "contributors" : [ { "first_name" : "Luke", "last_name" : "Bowden" }, { "first_name" : "Maria", "last_name" : "Daglas" }, { "first_name" : "Janet", "last_name" : "Keast" } ],
  "sourceOrganization" : "SPARC",
  "keywords" : [ "mouse" ],
  "datePublished" : "2026-11-04",
  "@id" : "https://doi.org/10.26275/9hgk-oozi",
  "files" : [ { "name" : "manifest.json", "path" : "manifest.json" }, { "name" : "a.tif"`;

const respond = (status, text) => ({ ok: status < 300, status, text: () => Promise.resolve(text), json: () => Promise.resolve(JSON.parse(text)) });

describe("a portal's datasets", () => {
  it("are its bucket's numbered folders, newest first", async () => {
    const listFolder = vi.fn().mockResolvedValue({ folders: ["10", "704", "99", "docs"] });
    expect(await portalDatasetIds("sparc", { listFolder })).toEqual([704, 99, 10]);
    expect(listFolder).toHaveBeenCalledWith({ dataset: "sparc" });
  });

  it("are found by Discover's search, kept to the bucket's, or by id", async () => {
    const sendXhr = vi.fn().mockResolvedValue({ datasets: [{ id: 5 }, { id: 99 }, { id: 10 }] });
    expect(await searchPortal(" vagus ", [704, 99, 10], { sendXhr })).toEqual([99, 10]);
    expect(sendXhr.mock.calls[0][0]).toBe("https://api.pennsieve.io/discover/search/datasets?limit=500&offset=0&query=vagus");
    expect(await searchPortal("99", [704, 99, 10], { sendXhr })).toEqual([99, 10]);
    expect(await searchPortal("", [704, 99])).toEqual([704, 99]);
  });
});

describe("a manifest", () => {
  it("is read up to its file list", () => {
    expect(manifestHead(manifest)).toMatchObject({ pennsieveDatasetId: 704, name: "Lower urinary tract vasculature" });
    expect(manifestHead('{ "name" : "x", "contributors" : [')).toBe(null);
  });

  it("describes the dataset for the picker", () => {
    const d = toPortalDataset("sparc", manifestHead(manifest));
    expect(d).toMatchObject({
      id: 704,
      version: 1,
      authors: "Luke Bowden, Maria Daglas, et al.",
      organization: "SPARC",
      doi: "10.26275/9hgk-oozi",
      banner: "https://sparc-prod-aod-discover-publish50-use1.s3.amazonaws.com/704/banner.jpg",
    });
  });

  it("is fetched by its start, and whole when the start doesn't reach the files", async () => {
    let fetchFn = vi.fn().mockResolvedValue(respond(206, manifest));
    expect((await portalDataset("epilepsyScience", 704, { fetchFn })).name).toBe("Lower urinary tract vasculature");
    expect(fetchFn.mock.calls[0][0]).toBe("https://edots-prod-aod-discover-publish50-use1.s3.amazonaws.com/704/manifest.json");
    expect(fetchFn.mock.calls[0][1].headers.Range).toBe("bytes=0-16383");

    fetchFn = vi
      .fn()
      .mockResolvedValueOnce(respond(206, '{ "pennsieveDatasetId" : 7, "name" : "Long", "contributors" : ['))
      .mockResolvedValueOnce(respond(200, '{ "pennsieveDatasetId" : 7, "name" : "Long", "files" : [] }'));
    expect((await portalDataset("sparc", 7, { fetchFn })).name).toBe("Long");
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
