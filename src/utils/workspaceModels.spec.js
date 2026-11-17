import { describe, it, expect, vi } from "vitest";
import { listWorkspaceModels } from "./workspaceModels";

const config = { api2Url: "https://api2.pennsieve.net" };
const getToken = () => Promise.resolve("tok");
const respond = (status, body) =>
  vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });

describe("listWorkspaceModels", () => {
  it("lists the names of the dataset's models that have a version, sorted", async () => {
    const fetchFn = respond(200, [
      { model: { id: "m2", name: "sample", latest_version: { version: 1 } } },
      { model: { id: "m1", name: "participant", latest_version: { version: 2 } } },
      { model: { id: "m3", name: "draft", latest_version: null } },
    ]);
    expect(await listWorkspaceModels("N:dataset:abc", { config, getToken, fetchFn })).toEqual(["participant", "sample"]);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://api2.pennsieve.net/metadata/models?dataset_id=N%3Adataset%3Aabc");
    expect(init.headers.Authorization).toBe("Bearer tok");
  });

  it("is empty for no dataset, a dataset without models, or one the user can't read", async () => {
    expect(await listWorkspaceModels("", { config, getToken, fetchFn: respond(200, []) })).toEqual([]);
    expect(await listWorkspaceModels("N:dataset:abc", { config, getToken, fetchFn: respond(200, []) })).toEqual([]);
    expect(await listWorkspaceModels("N:dataset:abc", { config, getToken, fetchFn: respond(403, {}) })).toEqual([]);
    expect(await listWorkspaceModels("N:dataset:abc", { config, getToken, fetchFn: respond(404, {}) })).toEqual([]);
  });

  it("fails on a service error", async () => {
    await expect(listWorkspaceModels("N:dataset:abc", { config, getToken, fetchFn: respond(500, {}) })).rejects.toThrow("500");
  });
});
