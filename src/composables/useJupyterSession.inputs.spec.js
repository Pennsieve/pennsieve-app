import { describe, it, expect, vi } from "vitest";
import { postInputsFetch, getInputsFetch } from "./useJupyterSession";

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
});

describe("getInputsFetch", () => {
  it("reads the sidecar's file states", async () => {
    const fetchFn = respond(200, { files: [{ source: "n", path: "a", state: "done" }] });
    expect(await getInputsFetch("https://k", "tok", { fetchFn })).toHaveLength(1);
    expect(fetchFn.mock.calls[0][1].headers.Authorization).toBe("Bearer tok");
  });
});
