import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/composables/useGetToken", () => ({
  useGetToken: async () => "tok",
  useGetAllTokens: async () => ({}),
}));

import { actions } from "./analysisModule";

const rootState = { config: { api2Url: "https://api2" } };
const base = "https://api2/compute/workflows";

const respond = (status, body) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? "" : JSON.stringify(body)),
  });

let fetchMock;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("fetchRunExample", () => {
  it("returns the latest job and today's limits", async () => {
    const limits = { workflow: { used: 1, limit: 3 }, user: { used: 2, limit: 10 }, workspace: { used: 3, limit: 20 } };
    fetchMock.mockReturnValue(respond(200, { job: { status: "READY" }, limits }));
    const out = await actions.fetchRunExample({ rootState }, "run-1");
    expect(fetchMock).toHaveBeenCalledWith(`${base}/runs/run-1/example`, expect.objectContaining({ method: "GET" }));
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer tok");
    expect(out).toEqual({ job: { status: "READY" }, limits });
  });
  it.each([404, 503])("is null where the route isn't served (%s)", async (status) => {
    fetchMock.mockReturnValue(respond(status, { message: "Not Found" }));
    expect(await actions.fetchRunExample({ rootState }, "run-1")).toBe(null);
  });
  it("is null when the request fails outright (no CORS on a missing route)", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await actions.fetchRunExample({ rootState }, "run-1")).toBe(null);
  });
  it("rejects on other errors", async () => {
    fetchMock.mockReturnValue(respond(500, { message: "boom" }));
    await expect(actions.fetchRunExample({ rootState }, "run-1")).rejects.toMatchObject({ status: 500 });
  });
});

describe("setRunExample", () => {
  it("posts refresh and returns the job (202)", async () => {
    fetchMock.mockReturnValue(respond(202, { job: { status: "QUEUED" } }));
    const out = await actions.setRunExample({ rootState }, { runId: "run-1", refresh: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${base}/runs/run-1/example`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ refresh: true });
    expect(out).toEqual({ job: { status: "QUEUED" }, example: null });
  });
  it("returns the existing example (200)", async () => {
    fetchMock.mockReturnValue(respond(200, { job: { status: "READY" }, example: { pdfUrl: "https://cdn/x.pdf" } }));
    const out = await actions.setRunExample({ rootState }, { runId: "run-1" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ refresh: false });
    expect(out.example.pdfUrl).toBe("https://cdn/x.pdf");
  });
  it("rejects with the status and body (429)", async () => {
    fetchMock.mockReturnValue(respond(429, { message: "limit", limit: "user", resetAt: "2026-10-31T00:00:00Z" }));
    await expect(actions.setRunExample({ rootState }, { runId: "run-1" })).rejects.toMatchObject({
      status: 429,
      body: { limit: "user", resetAt: "2026-10-31T00:00:00Z" },
    });
  });
  it("rejects where the route isn't served, too", async () => {
    fetchMock.mockReturnValue(respond(404, { message: "Not Found" }));
    await expect(actions.setRunExample({ rootState }, { runId: "run-1" })).rejects.toMatchObject({ status: 404 });
  });
});

describe("workflow examples", () => {
  it("fetches the workflow's example", async () => {
    fetchMock.mockReturnValue(respond(200, { example: { version: 2, fromVersion: 2, pdfUrl: "u" } }));
    const out = await actions.fetchWorkflowExample({ rootState }, "wf-1");
    expect(fetchMock.mock.calls[0][0]).toBe(`${base}/definitions/wf-1/example`);
    expect(out.fromVersion).toBe(2);
  });
  it("is null when there's none, or the route isn't served", async () => {
    fetchMock.mockReturnValueOnce(respond(200, { example: null }));
    expect(await actions.fetchWorkflowExample({ rootState }, "wf-1")).toBe(null);
    fetchMock.mockReturnValueOnce(respond(404, {}));
    expect(await actions.fetchWorkflowExample({ rootState }, "wf-1")).toBe(null);
  });
  it("rejects where the route isn't served when strict", async () => {
    fetchMock.mockReturnValue(respond(404, {}));
    await expect(actions.fetchWorkflowExample({ rootState }, { uuid: "wf-1", strict: true })).rejects.toMatchObject({
      status: 404,
    });
  });
  it("fetches a version's example", async () => {
    fetchMock.mockReturnValue(respond(200, { example: { version: 3 } }));
    const out = await actions.fetchWorkflowVersionExample({ rootState }, { uuid: "wf-1", version: 3 });
    expect(fetchMock.mock.calls[0][0]).toBe(`${base}/definitions/wf-1/versions/3/example`);
    expect(out).toEqual({ version: 3 });
  });
  it("deletes a version's example (204)", async () => {
    fetchMock.mockReturnValue(respond(204));
    await actions.deleteWorkflowVersionExample({ rootState }, { uuid: "wf-1", version: 3 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${base}/definitions/wf-1/versions/3/example`);
    expect(init.method).toBe("DELETE");
  });
});
