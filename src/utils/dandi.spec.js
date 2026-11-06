import { describe, it, expect, vi } from "vitest";
import { searchDandi, countDandi, dandiVersions, listDandiFolder, toDandiset, dandiUrl, dandiViewTitle } from "./dandi";

const respond = (body, status = 200) =>
  vi.fn().mockResolvedValue({ ok: status < 300, status, json: () => Promise.resolve(body) });

// As DANDI's API gives them (abridged).
const published = {
  identifier: "000003",
  contact_person: "Senzai, Yuta",
  modified: "2026-02-18T20:52:00Z",
  most_recent_published_version: { version: "0.260218.2052", name: "Mossy Cells", asset_count: 101, size: 2559248010229 },
  draft_version: { version: "draft", name: "Mossy Cells", asset_count: 101, size: 2433083179847 },
};
const draftOnly = {
  identifier: "002047",
  most_recent_published_version: null,
  draft_version: { version: "draft", name: "CA1 calcium imaging", asset_count: 2200, size: 68072684991 },
};

describe("DANDI", () => {
  it("searches open dandisets with files, most recently changed first", async () => {
    const fetchFn = respond({ count: 56, next: "https://api.dandiarchive.org/api/dandisets/?page=2", results: [published, draftOnly] });
    const res = await searchDandi({ query: " hippocampus " }, { fetchFn });
    const url = new URL(fetchFn.mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe("https://api.dandiarchive.org/api/dandisets/");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      page: "1", page_size: "25", embargoed: "false", empty: "false", ordering: "-modified", search: "hippocampus",
    });
    expect(res.count).toBe(56);
    expect(res.next).toBe(2);
    expect(res.datasets[0]).toEqual({
      id: "000003", name: "Mossy Cells", version: "0.260218.2052", published: true, contact: "Senzai, Yuta",
      files: 101, size: 2559248010229, modified: "2026-02-18T20:52:00Z",
    });
    // Never published: its draft.
    expect(res.datasets[1]).toMatchObject({ id: "002047", version: "draft", published: false, files: 2200 });
  });

  it("counts, and says why a search failed", async () => {
    expect(await countDandi({ fetchFn: respond({ count: 673, results: [] }) })).toBe(673);
    await expect(searchDandi({}, { fetchFn: respond({ detail: "Throttled." }, 429) })).rejects.toThrow("Throttled.");
  });

  it("lists a dandiset's versions, newest published first and the draft last", async () => {
    const fetchFn = respond({
      results: [
        { version: "draft", name: "M", asset_count: 101, size: 2 },
        { version: "0.210812.1448", name: "M", asset_count: 101, size: 3 },
        { version: "0.250624.0409", name: "M", asset_count: 101, size: 3 },
      ],
    });
    expect((await dandiVersions("000003", { fetchFn })).map((v) => v.version)).toEqual(["0.250624.0409", "0.210812.1448", "draft"]);
    expect(fetchFn.mock.calls[0][0]).toBe("https://api.dandiarchive.org/api/dandisets/000003/versions/?page_size=100");
  });

  it("lists a folder of a version, marking Zarr folders", async () => {
    const fetchFn = respond({
      next: null,
      results: [
        { path: "sub-1/ses-1", aggregate_size: 50, asset: null },
        { path: "sub-1/photo.jpg", aggregate_size: 3, asset: { url: "https://dandiarchive.s3.amazonaws.com/blobs/3a5/c1e/3a5c1e01" } },
        { path: "sub-1/image.ome.zarr", aggregate_size: 9, asset: { url: "https://dandiarchive.s3.amazonaws.com/zarr/5650/" } },
      ],
    });
    const level = await listDandiFolder({ id: "000108", version: "draft", prefix: "sub-1/" }, { fetchFn });
    expect(level).toEqual({
      folders: ["ses-1"],
      files: [{ name: "photo.jpg", size: 3, zarr: false }, { name: "image.ome.zarr", size: 9, zarr: true }],
      truncated: false,
    });
    const url = new URL(fetchFn.mock.calls[0][0]);
    expect(url.pathname).toBe("/api/dandisets/000108/versions/draft/assets/paths/");
    expect(url.searchParams.get("path_prefix")).toBe("sub-1");
    // DANDI filters by whole folders: first letters narrow the level read.
    expect((await listDandiFolder({ id: "000108", version: "draft", prefix: "sub-1/", startsWith: "ph" }, { fetchFn })).files).toEqual([
      { name: "photo.jpg", size: 3, zarr: false },
    ]);
  });

  it("names and links a version", () => {
    expect(dandiUrl("000003", "draft")).toBe("https://dandiarchive.org/dandiset/000003/draft");
    expect(dandiViewTitle(toDandiset(published))).toBe("Mossy Cells (DANDI:000003, 0.260218.2052)");
  });
});
