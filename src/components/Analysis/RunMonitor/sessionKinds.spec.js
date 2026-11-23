import { describe, it, expect, vi, beforeEach } from "vitest";

// The flag comes from the built site's config, so set it here.
const enabled = { webAppSessions: true };
vi.mock("@/utils/features", () => ({ isFeatureEnabled: (name) => enabled[name] }));

import {
  isNotebookSession,
  sessionAllowed,
  sessionKind,
  sessionOffered,
  sessionStep,
  sessionWords,
  webAppSessionUrl,
} from "./sessionKinds";

const notebook = { id: "nb", type: "processor", runtimeConfig: { interactive: true, sessionType: "jupyter" } };
const webapp = { id: "review", type: "processor", runtimeConfig: { interactive: true, sessionType: "webapp" } };
const batch = { id: "n4", type: "processor", runtimeConfig: {} };

describe("a run's live session", () => {
  beforeEach(() => {
    enabled.webAppSessions = true;
  });

  it("is the DAG's interactive step", () => {
    expect(sessionStep([batch, webapp])).toBe(webapp);
    expect(sessionStep([batch])).toBeNull();
    expect(sessionStep(undefined)).toBeNull();
  });

  it("is a notebook unless its app says otherwise", () => {
    expect(sessionKind(notebook)).toBe("jupyter");
    expect(sessionKind(webapp)).toBe("webapp");
    expect(sessionKind({ runtimeConfig: { interactive: true } })).toBe("jupyter");
    expect(isNotebookSession(notebook)).toBe(true);
    expect(isNotebookSession(webapp)).toBe(false);
  });

  it("offers a notebook while the run is active, a web app only while its step runs", () => {
    expect(sessionOffered(notebook, { runActive: true, stepStatus: "NOT_STARTED" })).toBe(true);
    expect(sessionOffered(webapp, { runActive: true, stepStatus: "NOT_STARTED" })).toBe(false);
    expect(sessionOffered(webapp, { runActive: true, stepStatus: "STARTED" })).toBe(true);
    expect(sessionOffered(webapp, { runActive: true, stepStatus: "SUCCEEDED" })).toBe(false);
    expect(sessionOffered(webapp, { runActive: false, stepStatus: "STARTED" })).toBe(false);
    expect(sessionOffered(null, { runActive: true, stepStatus: "STARTED" })).toBe(false);
  });

  it("offers no web app session while the site flag is off, and still offers a notebook", () => {
    enabled.webAppSessions = false;
    expect(sessionAllowed(webapp)).toBe(false);
    expect(sessionOffered(webapp, { runActive: true, stepStatus: "STARTED" })).toBe(false);
    expect(sessionAllowed(notebook)).toBe(true);
    expect(sessionOffered(notebook, { runActive: true, stepStatus: "STARTED" })).toBe(true);
  });

  it("is named for its kind", () => {
    expect(sessionWords(notebook).open).toBe("Open Notebook");
    expect(sessionWords(webapp).open).toBe("Open App");
    // A kind this app doesn't know yet opens like a web app.
    expect(sessionWords({ runtimeConfig: { interactive: true, sessionType: "viewer" } }).open).toBe("Open App");
  });

  it("opens a web app at its own host, with the token for the auth proxy", () => {
    expect(webAppSessionUrl({ kernelUrl: "https://run-1.basic.sessions.example/", token: "a.b+c" })).toBe(
      "https://run-1.basic.sessions.example/?token=a.b%2Bc"
    );
  });
});
