import { describe, it, expect, vi } from "vitest";
import { sessionEnvironmentRequest, SessionEnvironmentsUnavailable } from "./useJupyterSession";

const respond = (status, body) =>
  vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === "string" ? body : ""),
  });

describe("sessionEnvironmentRequest", () => {
  it("switches with the session token", async () => {
    const fetchFn = respond(202, { active: null, switch: { state: "resolving" } });
    const state = await sessionEnvironmentRequest("https://k", "tok", "POST", { environmentId: "e", version: 2 }, { fetchFn });
    expect(state.switch.state).toBe("resolving");
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://k/pennsieve/environments");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(JSON.parse(init.body)).toEqual({ environmentId: "e", version: 2 });
  });

  it("reads the state without a body", async () => {
    const fetchFn = respond(200, { active: { environmentId: "e", version: 2 }, switch: null });
    expect((await sessionEnvironmentRequest("https://k", "tok", "GET", undefined, { fetchFn })).active.version).toBe(2);
    expect(fetchFn.mock.calls[0][1].body).toBeUndefined();
  });

  it("tells an older session apart from a failure", async () => {
    await expect(sessionEnvironmentRequest("https://k", "tok", "GET", undefined, { fetchFn: respond(404, "") }))
      .rejects.toBeInstanceOf(SessionEnvironmentsUnavailable);
    await expect(sessionEnvironmentRequest("https://k", "tok", "POST", {}, { fetchFn: respond(409, "the environment is already being switched\n") }))
      .rejects.toThrow("the environment is already being switched");
  });
});
