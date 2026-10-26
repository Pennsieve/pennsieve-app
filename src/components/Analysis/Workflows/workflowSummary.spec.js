import { describe, it, expect } from "vitest";
import { ioSummary, appNames, usageLine, cardText } from "./workflowSummary";

const wf = {
  dag: [
    { id: "s", type: "data-source" },
    { id: "a", type: "processor", sourceUrl: "https://github.com/org/bandpass" },
    { id: "b", type: "processor", sourceUrl: "https://github.com/org/spike-detect.git" },
    { id: "c", type: "processor", sourceUrl: "https://github.com/org/bandpass" },
    { id: "t", type: "data-target", targetType: "pennsieve" },
  ],
};

describe("ioSummary", () => {
  it("says what goes in, how many steps, and what comes out", () => {
    expect(ioSummary(wf, [{ targetType: "pennsieve", label: "Pennsieve Dataset" }])).toBe(
      "Dataset files → 3 steps → Pennsieve Dataset"
    );
    expect(ioSummary({ dag: [{ id: "a", type: "processor" }] })).toBe("No input → 1 step → Results");
  });
});

describe("appNames", () => {
  it("names each app once, from the app list or the repository", () => {
    const apps = [{ name: "Spike detection", source: { url: "https://github.com/org/spike-detect" } }];
    expect(appNames(wf, apps)).toEqual(["bandpass", "Spike detection"]);
  });
});

describe("usageLine", () => {
  it("says how often and when it last ran", () => {
    expect(usageLine({ metrics: { totalRuns: 12, lastRunAt: "x" } }, () => "2 days ago")).toBe("Run 12× · last 2 days ago");
    expect(usageLine({ metrics: { totalRuns: 3 } }, () => "")).toBe("Run 3×");
    expect(usageLine({}, () => "")).toBe("Never run");
  });
});

describe("cardText", () => {
  it("is the summary, else the description as plain text", () => {
    expect(cardText({ summary: "Ports and LLM", description: "# Long" })).toBe("Ports and LLM");
    expect(cardText({ description: "End-to-end test.\n\n- **signals** (CSV) and `events` feed [A](https://x).\n## Next" }))
      .toBe("End-to-end test. signals (CSV) and events feed A. Next");
    expect(cardText({})).toBe("");
  });
});
