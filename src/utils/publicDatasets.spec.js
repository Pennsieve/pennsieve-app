import { describe, it, expect, vi } from "vitest";
import { searchPublicDatasets, pagePublicDatasets, fetchPublicDataset, listPublicDatasets, notebookRoute, browsePublicFiles, authorsLine, countPublicDatasets } from "./publicDatasets";

const config = { discoverUrl: "https://api.pennsieve.net/discover" };

describe("public datasets", () => {
  it("searches, leaving out embargoed datasets", async () => {
    const sendXhr = vi.fn().mockResolvedValue({
      datasets: [
        { id: 1, name: "Open", version: 2, contributors: [{ firstName: "A", lastName: "B" }] },
        { id: 2, name: "Closed", version: 1, embargo: true },
      ],
    });
    const found = await searchPublicDatasets("eeg & sleep", { sendXhr, config });
    expect(sendXhr.mock.calls[0][0]).toBe("https://api.pennsieve.net/discover/search/datasets?limit=25&offset=0&embargo=false&query=eeg%20%26%20sleep");
    expect(found.map((d) => d.name)).toEqual(["Open"]);
    expect(found[0].authors).toBe("A B");
  });

  it("pages through a query's matches, or the newest research datasets", async () => {
    const sendXhr = vi.fn().mockResolvedValue({ totalCount: 192, datasets: [{ id: 1, name: "A" }] });
    const page = await pagePublicDatasets({ query: "eeg", offset: 50 }, { sendXhr, config });
    expect(sendXhr.mock.calls[0][0]).toBe("https://api.pennsieve.net/discover/search/datasets?limit=25&offset=50&embargo=false&query=eeg");
    expect(page.totalCount).toBe(192);
    expect(page.fetched).toBe(1);
    expect(page.datasets.map((d) => d.name)).toEqual(["A"]);
    await pagePublicDatasets({ offset: 25, limit: 100 }, { sendXhr, config });
    expect(sendXhr.mock.calls[1][0]).toBe("https://api.pennsieve.net/discover/datasets?limit=100&offset=25&datasetType=research&embargo=false");
  });

  it("fetches one version, or the latest without one", async () => {
    const sendXhr = vi.fn().mockResolvedValue({ id: 7, name: "Sleep", version: 3, fileCount: 12, embargo: false });
    const d = await fetchPublicDataset(7, 3, { sendXhr, config });
    expect(sendXhr.mock.calls[0][0]).toBe("https://api.pennsieve.net/discover/datasets/7/versions/3");
    expect(d).toMatchObject({ id: 7, name: "Sleep", version: 3, fileCount: 12, embargo: false });
    await fetchPublicDataset("7", null, { sendXhr, config });
    expect(sendXhr.mock.calls[1][0]).toBe("https://api.pennsieve.net/discover/datasets/7");
  });

  it("opens a version in My Workspace's notebook launcher", () => {
    expect(notebookRoute({ id: 7, version: 3 })).toEqual({ name: "my-notebooks", query: { publicDataset: 7, version: 3 } });
    expect(notebookRoute({ id: 7 })).toEqual({ name: "my-notebooks", query: { publicDataset: 7 } });
  });

  it("lists every match in Discover's order, without embargoed datasets or code releases", async () => {
    const sendXhr = vi.fn().mockResolvedValue({
      datasets: [
        { id: 1, name: "Open", version: 2, tags: ["eeg"], license: "MIT License", versionPublishedAt: "2026-11-05T00:00:00Z" },
        { id: 2, name: "Closed", version: 1, embargo: true },
        { id: 3, name: "Code", version: 1, datasetType: "release" },
      ],
    });
    const found = await listPublicDatasets({ query: "eeg", orderBy: "name", orderDirection: "asc" }, { sendXhr, config });
    expect(sendXhr.mock.calls[0][0]).toBe(
      "https://api.pennsieve.net/discover/search/datasets?limit=1000&offset=0&embargo=false&orderBy=name&orderDirection=asc&query=eeg"
    );
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ id: 1, tags: ["eeg"], license: "MIT License", publishedAt: "2026-11-05T00:00:00Z" });
  });

  it("browses a folder with its path in the query, and the ids in the path encoded", async () => {
    const sendXhr = vi.fn().mockResolvedValue({ files: [{ name: "a.csv" }], totalCount: 1 });
    const page = await browsePublicFiles({ id: "1/../x", version: 2, path: "files/a b&c", limit: 10, offset: 20 }, { sendXhr, config });
    expect(sendXhr.mock.calls[0][0]).toBe(
      "https://api.pennsieve.net/discover/datasets/1%2F..%2Fx/versions/2/files/browse?limit=10&offset=20&path=files%2Fa+b%26c"
    );
    expect(page).toEqual({ files: [{ name: "a.csv" }], totalCount: 1 });
  });

  it("names two authors, then et al.", () => {
    const c = (n) => ({ firstName: n, lastName: "X" });
    expect(authorsLine([c("A"), c("B"), c("C")])).toBe("A X, B X, et al.");
    expect(authorsLine([])).toBe("");
  });
});

describe("countPublicDatasets", () => {
  it("is Discover's count of openly published research datasets", async () => {
    const sendXhr = vi.fn().mockResolvedValue({ totalCount: 312, datasets: [] });
    expect(await countPublicDatasets({ sendXhr, config })).toBe(312);
    expect(sendXhr.mock.calls[0][0]).toBe("https://api.pennsieve.net/discover/datasets?limit=1&offset=0&datasetType=research&embargo=false");
  });
});
