import { describe, it, expect, vi } from "vitest";
import { idcCollections, searchIdc, idcCollection, idcSeries, idcSeriesFolder, idcViewName, createIdcView } from "./idc";

const respond = (body, status = 200) => vi.fn().mockResolvedValue({ ok: status < 300, status, json: () => Promise.resolve(body) });

describe("the Imaging Data Commons", () => {
  it("lists collections, searched by name, cancer type and location", async () => {
    const fetchFn = respond([
      { collection_id: "tcga_brca", collection_name: "TCGA-BRCA", cancer_types: "Breast Cancer", tumor_locations: "Breast", species: "Human", subjects: "1098" },
      { collection_id: "4d_lung", collection_name: "4D-Lung", cancer_types: "Non-small Cell Lung Cancer", tumor_locations: "Lung", species: "Human, Mouse", subjects: "20" },
    ]);
    const list = await idcCollections({ fetchFn });
    expect(list.map((c) => c.id)).toEqual(["4d_lung", "tcga_brca"]);
    expect(list[0]).toMatchObject({ species: ["Human", "Mouse"], subjects: 20 });
    expect(searchIdc(list, "breast").map((c) => c.id)).toEqual(["tcga_brca"]);
    expect(searchIdc(list, "", "Mouse").map((c) => c.id)).toEqual(["4d_lung"]);
  });

  it("reads a collection's modalities", async () => {
    const c = await idcCollection("tcga_brca", { fetchFn: respond({ modalities: ["MG", "SM"], series: "10463", size_TB: "3.082" }) });
    expect(c).toMatchObject({ modalities: ["MG", "SM"], series: 10463, sizeTB: 3.082 });
  });

  it("lists a collection's series of a modality, a page at a time", async () => {
    const fetchFn = respond({
      total_series: "6690",
      series: [
        { crdc_series_uuid: "085e85b3-3780", aws_bucket: "idc-open-data", collection_id: "4d_lung", PatientID: "100_HM10395", Modality: "CT", SeriesDescription: "P4^P100, Gated, 10.0%", instanceCount: 50, series_size_MB: 26.4 },
        { crdc_series_uuid: "sm-1", aws_bucket: "idc-open-data-two", collection_id: "tcga_brca", PatientID: "TCGA-A1", Modality: "SM" },
      ],
    });
    const res = await idcSeries({ collection: "4d_lung", modality: "CT", page: 2 }, { fetchFn });
    const [, init] = fetchFn.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toMatchObject({ filters: { terms: { collection_id: ["4d_lung"], Modality: ["CT"] } }, page: 2 });
    expect(res.total).toBe(6690);
    expect(res.series[0]).toMatchObject({ uuid: "085e85b3-3780", patient: "100_HM10395", size: 26400000, slide: false });
    expect(res.series[1].slide).toBe(true);
  });

  it("names series folders for people, and takes slides as stacks", async () => {
    const ct = { uuid: "085e85b3-3780", bucket: "idc-open-data", collection: "4d_lung", patient: "100_HM10395", modality: "CT", description: "P4^P100/Gated, 10.0%", slide: false };
    const sm = { uuid: "sm-12345678", bucket: "idc-open-data-two", collection: "tcga_brca", patient: "TCGA-A1", modality: "SM", description: "", slide: true };
    expect(idcSeriesFolder(ct)).toBe("100_HM10395/CT P4^P100 Gated, 10.0% (085e85b3)");
    expect(idcSeriesFolder(sm)).toBe("TCGA-A1/SM (sm-12345)");
    expect(idcViewName([ct])).toBe("IDC: 4d_lung 100_HM10395 CT");
    const create = vi.fn().mockResolvedValue({ id: "v" });
    await createIdcView([ct, sm], { create });
    expect(create).toHaveBeenCalledWith({
      dataset: "nci-imaging-data-commons",
      name: "IDC: 2 collections (2 series)",
      groups: [
        { prefix: "085e85b3-3780/", bucket: "idc-open-data", folder: "100_HM10395/CT P4^P100 Gated, 10.0% (085e85b3)" },
        { prefix: "sm-12345678/", bucket: "idc-open-data-two", folder: "TCGA-A1/SM (sm-12345)", stack: "dicom-wsi" },
      ],
    });
  });
});
