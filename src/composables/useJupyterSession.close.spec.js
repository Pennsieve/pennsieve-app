import { describe, it, expect, vi } from "vitest";
import { postSessionClose } from "./useJupyterSession";

const respond = (status) => vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status });

describe("postSessionClose", () => {
  it("is closed when the sidecar answers OK", async () => {
    const fetchFn = respond(200);
    expect(await postSessionClose("https://k", "tok", { fetchFn })).toEqual({ closed: true });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://k/pennsieve/close");
    expect(init.headers.Authorization).toBe("Bearer tok");
  });

  it("is closed when the gateway answers for a task that went away", async () => {
    for (const status of [502, 503, 504]) {
      expect(await postSessionClose("https://k", "tok", { fetchFn: respond(status) })).toEqual({ closed: true });
    }
  });

  it("is closed when the request fails without a response", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await postSessionClose("https://k", "tok", { fetchFn })).toEqual({ closed: true });
  });

  it("is closed when nothing answers in time", async () => {
    const fetchFn = vi.fn((_, { signal }) => new Promise((_, reject) => {
      signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    }));
    expect(await postSessionClose("https://k", "tok", { fetchFn, timeoutMs: 10 })).toEqual({ closed: true });
  });

  it("is still running when the sidecar refuses", async () => {
    expect(await postSessionClose("https://k", "tok", { fetchFn: respond(401) })).toEqual({ closed: false, status: 401 });
  });
});
