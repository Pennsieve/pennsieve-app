import { describe, it, expect } from "vitest";
import { ASSIST_NOTE, acceptedCode, assistRequest, cellCode, cellError, deltaText, addCellSpend, budgetPause, cellSpendLabel, cellSpendTitle, requestCost, runSpend, sessionFiles, sseEvents, stepLabel, usageLine } from "./assistHelpers";

const delta = (text) => `event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":${JSON.stringify(text)}}}\n\n`;

describe("sseEvents", () => {
  it("parses complete events and keeps the rest", () => {
    const { events, rest } = sseEvents(delta("import ") + delta("pandas") + 'event: message_stop\ndata: {"type":"mes');
    expect(events.map(deltaText).join("")).toBe("import pandas");
    expect(rest).toBe('event: message_stop\ndata: {"type":"mes');
  });

  it("throws an error event's message", () => {
    const { events } = sseEvents('event: error\ndata: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}\n\n');
    expect(() => deltaText(events[0])).toThrow("Overloaded");
  });

  it("ignores other events", () => {
    const { events } = sseEvents('event: ping\ndata: {"type":"ping"}\n\n');
    expect(deltaText(events[0])).toBe("");
  });
});

describe("cellCode", () => {
  it("takes the code out of fences, finished or still arriving", () => {
    expect(cellCode("```python\nimport pandas as pd\n```")).toBe("import pandas as pd");
    expect(cellCode("```python\nimport pan")).toBe("import pan");
    expect(cellCode("x = 1\n")).toBe("x = 1");
  });

  it("notes what wrote an accepted cell, once", () => {
    expect(acceptedCode("x = 1")).toBe(`${ASSIST_NOTE}\nx = 1`);
    expect(acceptedCode(`${ASSIST_NOTE}\nx = 2`)).toBe(`${ASSIST_NOTE}\nx = 2`);
  });
});

describe("assistRequest", () => {
  const cells = [
    { id: "a", cell_type: "code", source: "import pandas as pd" },
    { id: "b", cell_type: "markdown", source: "# Notes" },
    { id: "c", cell_type: "code", source: "" },
    {
      id: "d",
      cell_type: "code",
      source: "df.plot(x='tme')",
      outputs: [{ output_type: "error", ename: "KeyError", evalue: "'tme'", traceback: ["\x1b[31mKeyError\x1b[0m: 'tme'"] }],
    },
  ];

  it("sends the code cells above, the cell and the file", () => {
    const body = assistRequest({ prompt: "plot it", cell: cells[3], cells, kernelName: "Python 3.12.3", file: "input/a.csv" });
    expect(body).toMatchObject({ mode: "write", prompt: "plot it", kernel: "Python 3.12.3", cell: "df.plot(x='tme')", before: ["import pandas as pd"], file: "input/a.csv" });
    expect(body.error).toBeUndefined();
  });

  it("puts the file asked about first", () => {
    const files = [{ path: "input/a.csv" }, { path: "input/em", note: "read in place" }];
    const body = assistRequest({ prompt: "x", cell: cells[2], cells, file: "input/em/", files });
    expect(body.files.map((f) => f.path)).toEqual(["input/em", "input/a.csv"]);
  });

  it("sends a fix with the cell's error, without colours", () => {
    expect(cellError(cells[0])).toBe("");
    const body = assistRequest({ mode: "fix", cell: cells[3], cells });
    expect(body.error).toBe("KeyError: 'tme'\nKeyError: 'tme'");
  });
});

describe("sessionFiles", () => {
  it("lists a view's files and stacks under its folder", () => {
    const sources = [
      {
        inputFolder: "bossdb-Kasthuri",
        entries: [{ cratePath: "notes/readme.txt", size: 120 }],
        stacks: [{ cratePath: "ac4/em/", location: "s3://bossdb-open-data/Kasthuri/ac4/em/", region: "us-east-1", format: "neuroglancer-precomputed" }],
      },
    ];
    const files = sessionFiles(sources, "Python 3.12.3");
    expect(files[0].path).toBe("input/bossdb-Kasthuri/ac4/em");
    expect(files[0].note).toContain("Precomputed volume, read in place from cloud storage (not on the session's disk). Open it with:\nfrom cloudvolume import CloudVolume");
    expect(files[0].note).toContain('CloudVolume("precomputed://https://s3.us-east-1.amazonaws.com/bossdb-open-data/Kasthuri/ac4/em"');
    expect(files[1]).toEqual({ path: "input/bossdb-Kasthuri/notes/readme.txt", size: 120 });
  });
});

describe("agent display", () => {
  it("says what each step did", () => {
    expect(stepLabel({ tool: "read_file", summary: "input/a.csv" })).toBe("Read input/a.csv");
    expect(stepLabel({ tool: "inspect", summary: "df.columns" })).toBe("Looked at df.columns");
    expect(stepLabel({ tool: "run_code", summary: "the fix" })).toBe("Ran the fix");
  });

  it("sums a request's tokens and gives its cost and the run's", () => {
    const usage = { input_tokens: 3000, cache_read_input_tokens: 600, output_tokens: 180 };
    const budget = { requestUsd: 0.03, runUsedUsd: 0.58, runBudgetUsd: 2 };
    expect(usageLine(usage, budget)).toBe("3.0k new + 600 cached tokens in, 180 out · about $0.03 · $0.58 of this run's $2.00");
    expect(usageLine({ input_tokens: 900, output_tokens: 20 }, null)).toBe("900 new tokens in, 20 out");
    expect(usageLine(null, { requestUsd: 0.004 })).toBe("about $0.004");
  });
});

describe("runSpend", () => {
  it("says the run's spend of its budget", () => {
    expect(runSpend({ runUsedUsd: 0.58, runBudgetUsd: 2 })).toEqual({ used: 0.58, total: 2, scope: "run", fraction: 0.29, text: "$0.58 of $2.00" });
    expect(runSpend({ runUsedUsd: 3, runBudgetUsd: 2 }).fraction).toBe(1);
    expect(runSpend({ runUsedUsd: 0.5 })).toBeNull();
    expect(runSpend(null)).toBeNull();
  });

  it("falls back to the node's budget for a run without one", () => {
    const s = runSpend({ periodUsedUsd: 1.1, periodBudgetUsd: 5, period: "daily" });
    expect([s.scope, s.when, s.text]).toEqual(["node", "today", "$1.10 of $5.00 today"]);
    expect(s.fraction).toBeCloseTo(0.22);
    expect(requestCost({ periodUsedUsd: 1.1 }, { periodUsedUsd: 1.13 })).toBeCloseTo(0.03);
    expect(requestCost(null, { requestUsd: 0.02 })).toBe(0.02);
    expect(requestCost(null, { periodUsedUsd: 1 })).toBeNull();
  });
});

describe("a cell's spend", () => {
  it("adds each request's tokens and cost", () => {
    let spend = addCellSpend(null, { input_tokens: 3000, output_tokens: 200 }, 0.03);
    spend = addCellSpend(spend, { input_tokens: 1000, output_tokens: 100, cache_read_input_tokens: 500 }, null);
    expect(spend).toEqual({ requests: 2, tokens: 4800, usd: 0.03 });
    expect(cellSpendLabel(spend)).toBe("$0.03");
    expect(cellSpendTitle(spend)).toBe("AI assistant on this cell: 2 requests, 4.8k tokens, about $0.03");
  });

  it("shows tokens without a cost, and nothing without requests", () => {
    expect(cellSpendLabel(addCellSpend(null, { input_tokens: 1200, output_tokens: 80 }, null))).toBe("1.3k tok");
    expect(cellSpendLabel(null)).toBe("");
  });
});

describe("budgetPause", () => {
  it("pauses the assistant only when a budget is used up", () => {
    expect(budgetPause({ periodUsedUsd: 4.9, periodBudgetUsd: 5, period: "daily" })).toBe("");
    expect(budgetPause({ periodUsedUsd: 5, periodBudgetUsd: 5, period: "daily" })).toMatch(/^This compute node's AI budget for today is used up/);
    expect(budgetPause({ runUsedUsd: 2, runBudgetUsd: 2 })).toMatch(/^This run's AI budget is used up/);
    expect(budgetPause(null)).toBe("");
  });
});
