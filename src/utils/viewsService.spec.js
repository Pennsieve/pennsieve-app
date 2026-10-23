import { describe, it, expect, vi } from "vitest";
import {
  getView,
  viewsServiceUrl,
  viewForDataset,
  viewDataSource,
  listEntries,
  ViewsServiceError,
} from "./viewsService";
import dev from "../site-config/dev.json";
import prod from "../site-config/prod.json";

const config = { viewsServiceUrl: "https://api2.pennsieve.net/views/" };
const getToken = () => Promise.resolve("tok");

function respond(...bodies) {
  const fn = vi.fn();
  for (const [status, body] of bodies) {
    fn.mockResolvedValueOnce({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    });
  }
  return fn;
}

describe("viewsServiceUrl", () => {
  it("is set only where views-service is deployed", () => {
    expect(viewsServiceUrl(dev)).toBe("https://api2.pennsieve.net/views");
    expect(viewsServiceUrl(prod)).toBe("");
  });
});

describe("viewForDataset", () => {
  const view = { id: "v1", version: 1, sources: [{ datasetId: 7, version: 2 }] };

  it("reuses the user's view of the version", async () => {
    const fetchFn = respond([200, { views: [{ id: "v0", version: 1, sources: [{ datasetId: 7, version: 1 }] }, view] }]);
    expect(await viewForDataset({ datasetId: 7, version: 2, name: "Study" }, { config, getToken, fetchFn })).toBe(view);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0][0]).toBe("https://api2.pennsieve.net/views/me");
    expect(fetchFn.mock.calls[0][1].headers.Authorization).toBe("Bearer tok");
  });

  it("creates one otherwise", async () => {
    const fetchFn = respond([200, { views: [] }], [201, view]);
    expect(await viewForDataset({ datasetId: 7, version: 2, name: "Study" }, { config, getToken, fetchFn })).toEqual(view);
    const [url, init] = fetchFn.mock.calls[1];
    expect(url).toBe("https://api2.pennsieve.net/views/me");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ name: "Study (version 2)", datasetId: 7, version: 2 });
  });

  it("rejects with the service's message", async () => {
    const fetchFn = respond([200, { views: [] }], [400, { message: "only openly published dataset versions" }]);
    const err = await viewForDataset({ datasetId: 7, version: 2, name: "S" }, { config, getToken, fetchFn }).catch((e) => e);
    expect(err).toBeInstanceOf(ViewsServiceError);
    expect(err.status).toBe(400);
    expect(err.message).toMatch(/openly published/);
  });
});

describe("viewDataSource", () => {
  it("is a viewVersion data source", () => {
    expect(viewDataSource({ id: "v1", version: 3 })).toEqual({ kind: "viewVersion", viewId: "v1", viewVersion: 3 });
  });
});

describe("listEntries", () => {
  it("reads every page", async () => {
    const page = (n, from) => Array.from({ length: n }, (_, i) => ({ cratePath: `f${from + i}` }));
    const fetchFn = respond([200, { totalCount: 1500, entries: page(1000, 0) }], [200, { totalCount: 1500, entries: page(500, 1000) }]);
    const entries = await listEntries("v1", 2, { config, getToken, fetchFn });
    expect(entries).toHaveLength(1500);
    expect(fetchFn.mock.calls[1][0]).toBe("https://api2.pennsieve.net/views/v1/versions/2/entries?offset=1000&limit=1000");
  });
});

describe("getView", () => {
  it("is the view's summary", async () => {
    const fetchFn = respond([200, { view: { id: "v1", name: "Study" }, versions: [1] }]);
    expect(await getView("v1", { config, getToken, fetchFn })).toEqual({ id: "v1", name: "Study" });
  });
});
