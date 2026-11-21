import { describe, it, expect, vi } from "vitest";
import { searchOpenNeuro, countOpenNeuro, toOpenNeuroDataset, openNeuroUrl, checkOpenNeuro, checkOpenNeuroAll, openNeuroReadable, openNeuroUnreadable } from "./openNeuro";

const node = {
  id: "ds004100",
  latestSnapshot: {
    tag: "1.1.3",
    description: { Name: "HUP iEEG Epilepsy Dataset", Authors: ["A", "B"] },
    summary: { modalities: ["ieeg"], subjects: ["01", "02", "03"], size: 2e9, totalFiles: 120 },
  },
};
const respond = (status, body) =>
  vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });

describe("OpenNeuro", () => {
  it("searches public datasets by words and modality", async () => {
    const fetchFn = respond(200, {
      data: { advancedSearch: { edges: [{ node }], pageInfo: { count: 39, hasNextPage: true, endCursor: "c1" } } },
    });
    const res = await searchOpenNeuro({ query: " epilepsy ", modality: "ieeg", first: 10 }, { fetchFn });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://openneuro.org/crn/graphql");
    expect(JSON.parse(init.body).variables).toEqual({ q: { publicOnly: true, keywords: ["epilepsy"], modality: "ieeg" }, first: 10, after: null });
    expect(res).toEqual({
      datasets: [{ id: "ds004100", name: "HUP iEEG Epilepsy Dataset", tag: "1.1.3", authors: ["A", "B"], modalities: ["ieeg"], subjects: 3, size: 2e9, files: 120 }],
      count: 39,
      next: "c1",
    });
  });

  it("lists everything public without a query, and counts it", async () => {
    const fetchFn = respond(200, { data: { advancedSearch: { edges: [], pageInfo: { count: 1932, hasNextPage: false } } } });
    expect(await countOpenNeuro({ fetchFn })).toBe(1932);
    expect(JSON.parse(fetchFn.mock.calls[0][1].body).variables.q).toEqual({ publicOnly: true });
  });

  it("rejects with OpenNeuro's message", async () => {
    const fetchFn = respond(200, { errors: [{ message: "You do not have access to read this dataset." }] });
    await expect(searchOpenNeuro({}, { fetchFn })).rejects.toThrow("You do not have access");
  });

  it("skips a deleted dataset and keeps the rest", async () => {
    const fetchFn = respond(200, {
      errors: [{ message: "Dataset ds008958 has been deleted. Reason: subject privacy.", path: ["advancedSearch", "edges", 1, "node"] }],
      data: { advancedSearch: { edges: [{ node }, { node: null }], pageInfo: { count: 1932, hasNextPage: true, endCursor: "c1" } } },
    });
    const res = await searchOpenNeuro({}, { fetchFn });
    expect(res.datasets.map((d) => d.id)).toEqual(["ds004100"]);
    expect(res.next).toBe("c1");
  });

  it("names a dataset by its id when it has no title", () => {
    expect(toOpenNeuroDataset({ id: "ds1" }).name).toBe("ds1");
    expect(openNeuroUrl("ds000001")).toBe("https://openneuro.org/datasets/ds000001");
  });
});

describe("OpenNeuro readability", () => {
  const status = (s) => vi.fn().mockResolvedValue({ status: s });
  it("asks once per dataset, anonymously, for its dataset_description.json and README", async () => {
    const fetchFn = status(200);
    expect(await checkOpenNeuro("ds900001", { fetchFn })).toBe(true);
    expect(await checkOpenNeuro("ds900001", { fetchFn })).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(fetchFn).toHaveBeenCalledWith("https://s3.us-east-1.amazonaws.com/openneuro.org/ds900001/dataset_description.json", { method: "HEAD" });
    expect(fetchFn).toHaveBeenCalledWith("https://s3.us-east-1.amazonaws.com/openneuro.org/ds900001/README", { method: "HEAD" });
    expect(openNeuroReadable.get("ds900001")).toBe(true);
  });

  it("takes a 403 as unreadable, and anything else as unknown", async () => {
    expect(await checkOpenNeuro("ds900002", { fetchFn: status(403) })).toBe(false);
    expect(await checkOpenNeuro("ds900003", { fetchFn: status(404) })).toBe(null);
    expect(await checkOpenNeuro("ds900004", { fetchFn: vi.fn().mockRejectedValue(new Error("offline")) })).toBe(null);
    expect(openNeuroUnreadable("ds900002")).toBe(true);
    expect(openNeuroUnreadable("ds900002/sub-01/")).toBe(true);
    expect(openNeuroUnreadable("ds900003")).toBe(false);
    expect(openNeuroUnreadable("ds999999")).toBe(false);
  });

  it("takes a dataset partly released (description readable, README refused) as unreadable", async () => {
    const fetchFn = vi.fn((url) => Promise.resolve({ status: url.endsWith("README") ? 403 : 200 }));
    expect(await checkOpenNeuro("ds900005", { fetchFn })).toBe(false);
  });

  it("takes a missing README as no answer, not a refusal", async () => {
    const fetchFn = vi.fn((url) => Promise.resolve({ status: url.endsWith("README") ? 404 : 200 }));
    expect(await checkOpenNeuro("ds900006", { fetchFn })).toBe(true);
  });

  it("checks a list until it changes", async () => {
    const fetchFn = status(200);
    let n = 0;
    await checkOpenNeuroAll(["ds900010", "ds900011", "ds900012"], { at: 1, fetchFn, current: () => n++ < 2 });
    expect(fetchFn).toHaveBeenCalledTimes(4);
  });
});
