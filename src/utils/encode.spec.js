import { describe, it, expect, vi } from "vitest";
import { searchEncode, encodeFiles, encodeKey, defaultFiles, encodeViewName, createEncodeView, countEncode } from "./encode";

const respond = (status, body) => vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });

describe("ENCODE", () => {
  it("searches released experiments by words, assay and organism", async () => {
    const fetchFn = respond(200, {
      total: 2131,
      "@graph": [{ accession: "ENCSR000AKP", assay_title: "Histone ChIP-seq", biosample_summary: "Homo sapiens liver", lab: { title: "Bernstein" }, date_released: "2012-01-01" }],
      facets: [
        { field: "assay_title", terms: [{ key: "TF ChIP-seq", doc_count: 9 }, { key: "empty", doc_count: 0 }] },
        { field: "replicates.library.biosample.donor.organism.scientific_name", terms: [{ key: "Homo sapiens", doc_count: 5 }] },
      ],
    });
    const res = await searchEncode({ query: " liver ", assay: "Histone ChIP-seq", organism: "Homo sapiens", from: 25 }, { fetchFn });
    const url = new URL(fetchFn.mock.calls[0][0]);
    expect(url.pathname).toBe("/search/");
    expect(url.searchParams.get("searchTerm")).toBe("liver");
    expect(url.searchParams.get("assay_title")).toBe("Histone ChIP-seq");
    expect(url.searchParams.get("replicates.library.biosample.donor.organism.scientific_name")).toBe("Homo sapiens");
    expect(url.searchParams.get("from")).toBe("25");
    expect(url.searchParams.getAll("field")).toContain("biosample_summary");
    expect(res.total).toBe(2131);
    expect(res.experiments[0]).toMatchObject({ accession: "ENCSR000AKP", assay: "Histone ChIP-seq", lab: "Bernstein" });
    expect(res.assays).toEqual(["TF ChIP-seq"]);
    expect(res.organisms).toEqual(["Homo sapiens"]);
  });

  it("finds nothing without failing", async () => {
    const res = await searchEncode({ query: "zzz" }, { fetchFn: respond(404, { "@graph": [], total: 0 }) });
    expect(res.experiments).toEqual([]);
    await expect(searchEncode({}, { fetchFn: respond(500, {}) })).rejects.toThrow(/500/);
  });

  it("counts released experiments", async () => {
    expect(await countEncode({ fetchFn: respond(200, { total: 27043, "@graph": [] }) })).toBe(27043);
  });

  it("lists an experiment's files in the public bucket, the default analysis first", async () => {
    const fetchFn = respond(200, {
      "@graph": [
        { accession: "ENCFF600THN", s3_uri: "s3://encode-public/2022/06/14/b/ENCFF600THN.bam", file_type: "bam", output_type: "alignments", file_size: 20 },
        { accession: "ENCFF465GBD", s3_uri: "s3://encode-public/2022/06/14/a/ENCFF465GBD.bigWig", file_type: "bigWig", output_type: "signal p-value", preferred_default: true },
        { accession: "ENCFF000OUT", s3_uri: "s3://elsewhere/x.bam" },
      ],
    });
    const files = await encodeFiles("ENCSR000AKP", { fetchFn });
    expect(new URL(fetchFn.mock.calls[0][0]).searchParams.get("dataset")).toBe("/experiments/ENCSR000AKP/");
    expect(files.map((f) => f.accession)).toEqual(["ENCFF465GBD", "ENCFF600THN"]);
    expect(files[0]).toMatchObject({ key: "2022/06/14/a/ENCFF465GBD.bigWig", name: "ENCFF465GBD.bigWig", preferred: true });
    expect(defaultFiles(files).map((f) => f.accession)).toEqual(["ENCFF465GBD"]);
    expect(encodeKey("s3://other/x")).toBe("");
  });

  it("makes a view of each experiment's files in its folder", async () => {
    const picks = [
      { accession: "ENCSR000AKP", assay: "Histone ChIP-seq", files: [{ key: "2022/a/ENCFF1.bigWig" }] },
      { accession: "ENCSR000BBB", assay: "RNA-seq", files: [{ key: "2021/b/ENCFF2.bam" }, { key: "2021/c/ENCFF3.bam" }] },
    ];
    expect(encodeViewName(picks.slice(0, 1))).toBe("ENCODE: ENCSR000AKP (Histone ChIP-seq)");
    const create = vi.fn().mockResolvedValue({ id: "v" });
    await createEncodeView(picks, { create });
    expect(create).toHaveBeenCalledWith({
      dataset: "encode-project",
      name: "ENCODE: 2 experiments",
      groups: [
        { paths: ["2022/a/ENCFF1.bigWig"], folder: "ENCSR000AKP" },
        { paths: ["2021/b/ENCFF2.bam", "2021/c/ENCFF3.bam"], folder: "ENCSR000BBB" },
      ],
    });
  });
});
