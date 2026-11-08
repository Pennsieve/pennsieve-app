import { describe, it, expect, vi } from "vitest";
import { postInputsFetch, getInputsFetch, sessionSourcesRequest } from "./useJupyterSession";

const respond = (status, body) =>
  vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === "string" ? body : ""),
  });

describe("postInputsFetch", () => {
  it("asks the sidecar for the files with the session token", async () => {
    const fetchFn = respond(202, { files: [{ source: "n", path: "a", state: "queued" }] });
    const files = await postInputsFetch("https://k", "tok", [{ source: "n", path: "a" }], { fetchFn });
    expect(files).toEqual([{ source: "n", path: "a", state: "queued" }]);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://k/pennsieve/inputs/fetch");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(JSON.parse(init.body)).toEqual({ files: [{ source: "n", path: "a" }] });
  });

  it("sends at most 1000 files a request", async () => {
    const fetchFn = respond(202, { files: [] });
    const files = Array.from({ length: 2500 }, (_, i) => ({ source: "n", path: `f${i}` }));
    await postInputsFetch("https://k", "tok", files, { fetchFn });
    expect(fetchFn.mock.calls.map(([, init]) => JSON.parse(init.body).files.length)).toEqual([1000, 1000, 500]);
  });

  it("rejects with the sidecar's message", async () => {
    await expect(
      postInputsFetch("https://k", "tok", [{ source: "n", path: "a" }], { fetchFn: respond(502, "n: dataset not open\n") })
    ).rejects.toThrow("n: dataset not open");
  });

  it("rejects with the sidecar's message when the files don't fit on the disk", async () => {
    const msg = "The files need 90 GB but the notebook's disk has 40 GB free.";
    await expect(
      postInputsFetch("https://k", "tok", [{ source: "n", path: "a" }], { fetchFn: respond(507, msg) })
    ).rejects.toThrow(msg);
  });

  it("falls back to a status message when the sidecar says nothing", async () => {
    await expect(
      postInputsFetch("https://k", "tok", [{ source: "n", path: "a" }], { fetchFn: respond(507, "") })
    ).rejects.toThrow("(507)");
  });
});

describe("getInputsFetch", () => {
  it("reads the sidecar's file states", async () => {
    const fetchFn = respond(200, { files: [{ source: "n", path: "a", state: "done" }] });
    expect(await getInputsFetch("https://k", "tok", { fetchFn })).toHaveLength(1);
    expect(fetchFn.mock.calls[0][1].headers.Authorization).toBe("Bearer tok");
  });
});

describe("sessionSourcesRequest", () => {
  const sources = [{ name: "", viewId: "v1", version: 1, root: true }, { name: "openneuro-ds000001", viewId: "v2", version: 1, added: true }];

  it("lists, adds and removes the session's views", async () => {
    let fetchFn = respond(200, { sources });
    expect(await sessionSourcesRequest("https://k", "tok", "GET", {}, { fetchFn })).toEqual(sources);
    expect(fetchFn.mock.calls[0][0]).toBe("https://k/pennsieve/inputs/sources");

    fetchFn = respond(201, { sources });
    await sessionSourcesRequest("https://k", "tok", "POST", { body: { name: "openneuro-ds000001", viewId: "v2", version: 1 } }, { fetchFn });
    let [url, init] = fetchFn.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(JSON.parse(init.body)).toEqual({ name: "openneuro-ds000001", viewId: "v2", version: 1 });

    fetchFn = respond(200, { sources: [] });
    await sessionSourcesRequest("https://k", "tok", "DELETE", { name: "openneuro-ds000001" }, { fetchFn });
    [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://k/pennsieve/inputs/sources?name=openneuro-ds000001");
    expect(init.method).toBe("DELETE");
  });

  it("carries whether the sidecar can add views", async () => {
    const list = await sessionSourcesRequest("https://k", "tok", "GET", {}, { fetchFn: respond(200, { sources, canAdd: true }) });
    expect(list.canAdd).toBe(true);
    expect(list).toHaveLength(2);
    const older = await sessionSourcesRequest("https://k", "tok", "GET", {}, { fetchFn: respond(200, { sources }) });
    expect(older.canAdd).toBeUndefined();
  });

  it("is null from a sidecar that can't change its inputs", async () => {
    expect(await sessionSourcesRequest("https://k", "tok", "GET", {}, { fetchFn: respond(404, "not found") })).toBeNull();
  });

  it("rejects with the sidecar's message and status", async () => {
    const err = await sessionSourcesRequest("https://k", "tok", "POST", { body: {} }, { fetchFn: respond(409, "input/x already exists") }).catch((e) => e);
    expect(err.message).toBe("input/x already exists");
    expect(err.status).toBe(409);
  });
});
