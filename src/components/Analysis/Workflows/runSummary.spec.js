import { describe, it, expect } from "vitest";
import { runSummary } from "./runSummary";

const app = (url, inputs, llm = false) => ({
  sourceUrl: url,
  name: url.split("/").pop(),
  versions: [{ version: "v1", manifest: { inputs, outputs: [], runtime: { llm } } }],
});

describe("runSummary", () => {
  const wf = {
    name: "E2E",
    latestVersion: 2,
    dag: [
      { id: "signals", type: "data-source" },
      { id: "a", type: "processor", sourceUrl: "https://github.com/x/ports", tag: "v1", inputs: [{ from: "signals", input: "signals" }] },
      { id: "probe", type: "processor", sourceUrl: "https://github.com/x/probe", tag: "v1" },
      { id: "dl", type: "data-target", targetType: "download" },
      { id: "ds", type: "data-target", targetType: "Pennsieve Dataset", defaultParams: { TARGET_FOLDER: "/e2e-results/" } },
    ],
  };
  const apps = [
    app("https://github.com/x/ports", [{ name: "signals", mediaTypes: ["text/csv"] }]),
    app("https://github.com/x/probe", [], true),
  ];

  it("says what goes in, what runs and where it goes", () => {
    const s = runSummary(wf, apps);
    expect(s.name).toBe("E2E");
    expect(s.version).toBe(2);
    expect(s.stepCount).toBe(2);
    expect(s.usesLLM).toBe(true);
    expect(s.inputs).toEqual([{ id: "signals", name: "signals", hint: "CSV files" }]);
    expect(s.outputs.map((o) => o.where)).toEqual(["as a download", "into e2e-results/"]);
  });

  it("copes with a workflow without app.yml or targets", () => {
    const s = runSummary({ name: "Plain", dag: [{ id: "p", type: "processor", sourceUrl: "https://github.com/x/old" }] }, []);
    expect(s.usesLLM).toBe(false);
    expect(s.inputs).toEqual([]);
    expect(s.outputs).toEqual([]);
    expect(s.version).toBeNull();
  });
});
