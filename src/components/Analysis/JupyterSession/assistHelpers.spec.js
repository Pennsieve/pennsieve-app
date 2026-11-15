import { describe, it, expect } from "vitest";
import { ASSIST_NOTE, acceptedCode, assistRequest, cellCode, cellError, deltaText, sessionFiles, sseEvents } from "./assistHelpers";

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
    expect(files[0].note).toContain("Precomputed volume, read in place");
    expect(files[0].note).toContain('CloudVolume("precomputed://https://s3.us-east-1.amazonaws.com/bossdb-open-data/Kasthuri/ac4/em"');
    expect(files[1]).toEqual({ path: "input/bossdb-Kasthuri/notes/readme.txt", size: 120 });
  });
});
